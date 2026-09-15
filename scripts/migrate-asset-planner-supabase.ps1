param(
  [Parameter(Mandatory = $true)]
  [string]$SourceProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$DestinationProjectRef,

  [string]$SchemaFile = (Join-Path $PSScriptRoot '..\supabase\migrations\202609150001_asset_planner_import.sql'),

  [switch]$SkipStorage
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$sourceToken = $env:SUPABASE_SOURCE_ACCESS_TOKEN
$destinationToken = $env:SUPABASE_DEST_ACCESS_TOKEN

if ([string]::IsNullOrWhiteSpace($sourceToken) -or [string]::IsNullOrWhiteSpace($destinationToken)) {
  throw 'Defina SUPABASE_SOURCE_ACCESS_TOKEN e SUPABASE_DEST_ACCESS_TOKEN apenas no processo atual.'
}

function Invoke-ManagementQuery {
  param(
    [string]$Token,
    [string]$ProjectRef,
    [string]$Sql,
    [bool]$ReadOnly = $true
  )

  $headers = @{
    Authorization = "Bearer $Token"
    'Content-Type' = 'application/json'
  }
  $body = @{ query = $Sql; read_only = $ReadOnly } | ConvertTo-Json -Compress
  $response = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" -Headers $headers -Body $body
  return @($response | ForEach-Object { $_ })
}

function Get-ServiceRoleKey {
  param([string]$Token, [string]$ProjectRef)

  $response = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$ProjectRef/api-keys?reveal=true" -Headers @{ Authorization = "Bearer $Token" }
  $keys = @($response | ForEach-Object { $_ })
  $serviceRole = $keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1
  if (-not $serviceRole.api_key) {
    throw "service_role não encontrada no projeto $ProjectRef"
  }
  return $serviceRole.api_key
}

function Get-RestRows {
  param([string]$ProjectRef, [string]$ServiceRoleKey, [string]$Table, [string]$Select = '*')

  $allRows = [Collections.Generic.List[object]]::new()
  $offset = 0
  $pageSize = 1000

  do {
    $headers = @{
      Authorization = "Bearer $ServiceRoleKey"
      apikey = $ServiceRoleKey
    }
    $response = Invoke-RestMethod -Method Get -Uri "https://$ProjectRef.supabase.co/rest/v1/$Table`?select=$Select&limit=$pageSize&offset=$offset" -Headers $headers
    $page = @($response | ForEach-Object { $_ })
    foreach ($row in $page) { $allRows.Add($row) }
    $offset += $page.Count
  } while ($page.Count -eq $pageSize)

  return $allRows.ToArray()
}

function Send-RestRows {
  param([string]$ProjectRef, [string]$ServiceRoleKey, [string]$Table, [object[]]$Rows)

  if ($Rows.Count -eq 0) { return }
  $headers = @{
    Authorization = "Bearer $ServiceRoleKey"
    apikey = $ServiceRoleKey
    Prefer = 'resolution=merge-duplicates,return=minimal'
    'Content-Type' = 'application/json'
  }
  $body = $Rows | ConvertTo-Json -Depth 100 -Compress
  Invoke-RestMethod -Method Post -Uri "https://$ProjectRef.supabase.co/rest/v1/$Table`?on_conflict=id" -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
}

function Send-RestRowsInBatches {
  param([string]$ProjectRef, [string]$ServiceRoleKey, [string]$Table, [object[]]$Rows, [int]$BatchSize = 250)

  for ($offset = 0; $offset -lt $Rows.Count; $offset += $BatchSize) {
    $last = [Math]::Min($offset + $BatchSize - 1, $Rows.Count - 1)
    $batch = @($Rows[$offset..$last])
    Send-RestRows $ProjectRef $ServiceRoleKey $Table $batch
  }
}

function ConvertTo-EncodedObjectPath {
  param([string]$Path)
  return (($Path -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
}

function Copy-StorageObjects {
  param(
    [string]$SourceRef,
    [string]$SourceServiceRole,
    [string]$DestinationRef,
    [string]$DestinationServiceRole,
    [object[]]$Objects
  )

  $tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("asset-planner-migration-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tempRoot | Out-Null

  try {
    $index = 0
    foreach ($object in $Objects) {
      $index++
      $encodedPath = ConvertTo-EncodedObjectPath $object.name
      $tempFile = Join-Path $tempRoot ([Guid]::NewGuid().ToString('N'))
      $sourceHeaders = @{ Authorization = "Bearer $SourceServiceRole"; apikey = $SourceServiceRole }
      $destinationHeaders = @{
        Authorization = "Bearer $DestinationServiceRole"
        apikey = $DestinationServiceRole
        'x-upsert' = 'true'
      }
      $mimeType = if ($object.mimetype) { [string]$object.mimetype } else { 'application/octet-stream' }

      $attempt = 0
      while ($true) {
        try {
          $attempt++
          Invoke-WebRequest -Method Get -Uri "https://$SourceRef.supabase.co/storage/v1/object/asset-files/$encodedPath" -Headers $sourceHeaders -OutFile $tempFile | Out-Null
          Invoke-RestMethod -Method Post -Uri "https://$DestinationRef.supabase.co/storage/v1/object/asset-files/$encodedPath" -Headers $destinationHeaders -ContentType $mimeType -InFile $tempFile | Out-Null
          break
        }
        catch {
          if ($attempt -ge 3) { throw }
          Start-Sleep -Seconds ([Math]::Pow(2, $attempt))
        }
      }

      Remove-Item -LiteralPath $tempFile -Force
      if (($index % 20) -eq 0 -or $index -eq $Objects.Count) {
        Write-Host "Storage: $index/$($Objects.Count) arquivos copiados"
      }
    }
  }
  finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    $systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolvedTemp.StartsWith($systemTemp, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedTemp -Leaf).StartsWith('asset-planner-migration-')) {
      Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host '1/5 Aplicando expansão de schema no projeto oficial...'
$schemaSql = Get-Content -LiteralPath $SchemaFile -Raw
Invoke-ManagementQuery $destinationToken $DestinationProjectRef $schemaSql $false | Out-Null

Write-Host '2/5 Lendo dados do projeto de origem...'
$sourceServiceRole = Get-ServiceRoleKey $sourceToken $SourceProjectRef
$destinationServiceRole = Get-ServiceRoleKey $destinationToken $DestinationProjectRef
$layouts = Get-RestRows $SourceProjectRef $sourceServiceRole 'planner_layouts'
$layoutBackups = Get-RestRows $SourceProjectRef $sourceServiceRole 'planner_layouts_backup'
$auditEntries = Get-RestRows $SourceProjectRef $sourceServiceRole 'planner_audit_log'
$sourceCollaborators = Get-RestRows $SourceProjectRef $sourceServiceRole 'collaborators'
$destinationProfiles = Get-RestRows $DestinationProjectRef $destinationServiceRole 'profiles' 'id,email'
$sourceStorageHost = "$SourceProjectRef.supabase.co"
$destinationStorageHost = "$DestinationProjectRef.supabase.co"

foreach ($row in @($layouts) + @($layoutBackups)) {
  $payloadJson = $row.payload | ConvertTo-Json -Depth 100 -Compress
  $row.payload = ($payloadJson.Replace($sourceStorageHost, $destinationStorageHost) | ConvertFrom-Json)
}

$profileByEmail = @{}
foreach ($profile in $destinationProfiles) {
  if ($profile.email) { $profileByEmail[[string]$profile.email.ToLowerInvariant()] = $profile.id }
}

$plannerCollaborators = @($sourceCollaborators | ForEach-Object {
  $mappedUserId = $null
  if ($_.email) { $mappedUserId = $profileByEmail[[string]$_.email.ToLowerInvariant()] }
  [ordered]@{
    id = $_.id
    name = $_.name
    role = $_.role
    color = $_.color
    photo_url = if ($_.photo_url) { ([string]$_.photo_url).Replace($sourceStorageHost, $destinationStorageHost) } else { $null }
    active = $_.active
    created_at = $_.created_at
    updated_at = $_.updated_at
    email = $_.email
    user_id = $mappedUserId
    source_user_id = $_.user_id
    is_admin = $_.is_admin
    can_add = $_.can_add
    can_edit = $_.can_edit
    can_move = $_.can_move
    can_manage_collaborators = $_.can_manage_collaborators
    access_requested_at = $_.access_requested_at
  }
})

Write-Host '3/5 Gravando dados de forma idempotente...'
Send-RestRowsInBatches $DestinationProjectRef $destinationServiceRole 'planner_layouts' $layouts 10
Send-RestRowsInBatches $DestinationProjectRef $destinationServiceRole 'planner_layouts_backup' $layoutBackups 1
Send-RestRowsInBatches $DestinationProjectRef $destinationServiceRole 'planner_audit_log' $auditEntries 250
Send-RestRowsInBatches $DestinationProjectRef $destinationServiceRole 'planner_collaborators' $plannerCollaborators 100

$maxAuditId = ($auditEntries | Measure-Object -Property id -Maximum).Maximum
if ($maxAuditId) {
  Invoke-ManagementQuery $destinationToken $DestinationProjectRef "select setval(pg_get_serial_sequence('public.planner_audit_log','id'), greatest(coalesce((select max(id) from public.planner_audit_log), 1), 1), true)" $false | Out-Null
}

Write-Host '4/5 Copiando arquivos do bucket asset-files...'
$storageObjects = Invoke-ManagementQuery $sourceToken $SourceProjectRef "select name, coalesce((metadata->>'size')::bigint, 0) as size, metadata->>'mimetype' as mimetype from storage.objects where bucket_id = 'asset-files' order by name" $true
if ($SkipStorage) {
  Write-Host 'Storage já copiado; pulando reenvio e mantendo a verificação final.'
}
else {
  Copy-StorageObjects $SourceProjectRef $sourceServiceRole $DestinationProjectRef $destinationServiceRole $storageObjects
}

Write-Host '5/5 Verificando contagens e volume...'
$sourceSummary = (Invoke-ManagementQuery $sourceToken $SourceProjectRef @"
select json_build_object(
  'planner_layouts', (select count(*) from public.planner_layouts),
  'planner_layouts_backup', (select count(*) from public.planner_layouts_backup),
  'planner_audit_log', (select count(*) from public.planner_audit_log),
  'planner_collaborators', (select count(*) from public.collaborators),
  'storage_objects', (select count(*) from storage.objects where bucket_id = 'asset-files'),
  'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = 'asset-files')
) as summary
"@ $true)[0].summary

$destinationSummary = (Invoke-ManagementQuery $destinationToken $DestinationProjectRef @"
select json_build_object(
  'planner_layouts', (select count(*) from public.planner_layouts),
  'planner_layouts_backup', (select count(*) from public.planner_layouts_backup),
  'planner_audit_log', (select count(*) from public.planner_audit_log),
  'planner_collaborators', (select count(*) from public.planner_collaborators),
  'storage_objects', (select count(*) from storage.objects where bucket_id = 'asset-files'),
  'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = 'asset-files')
) as summary
"@ $true)[0].summary

$fields = @('planner_layouts', 'planner_layouts_backup', 'planner_audit_log', 'planner_collaborators', 'storage_objects', 'storage_bytes')
foreach ($field in $fields) {
  if ([int64]$sourceSummary.$field -ne [int64]$destinationSummary.$field) {
    throw "Verificação falhou em $field`: origem=$($sourceSummary.$field), destino=$($destinationSummary.$field)"
  }
}

[pscustomobject]@{
  planner_layouts = $destinationSummary.planner_layouts
  planner_layouts_backup = $destinationSummary.planner_layouts_backup
  planner_audit_log = $destinationSummary.planner_audit_log
  planner_collaborators = $destinationSummary.planner_collaborators
  storage_objects = $destinationSummary.storage_objects
  storage_bytes = $destinationSummary.storage_bytes
} | ConvertTo-Json -Compress | Write-Host

Write-Host 'Migração concluída e verificada.'
