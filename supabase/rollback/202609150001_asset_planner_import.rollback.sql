-- Destructive rollback. Review before running: it removes all imported planner data/files.
begin;

delete from storage.objects where bucket_id = 'asset-files';
delete from storage.buckets where id = 'asset-files';

drop table if exists public.planner_audit_log;
drop table if exists public.planner_layouts_backup;
drop table if exists public.planner_layouts;
drop table if exists public.planner_collaborators;
drop function if exists public.set_asset_planner_updated_at();

commit;
