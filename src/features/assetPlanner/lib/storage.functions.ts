import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

const BUCKET = "asset-files";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });

export async function uploadAssetFile(
  file: File,
  folder = "documents",
): Promise<{ url: string; path: string }> {
  if (isSupabaseConfigured) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  return {
    url: await fileToDataUrl(file),
    path: `local/${folder}/${Date.now()}-${file.name}`,
  };
}

export async function removeAssetFile(path?: string): Promise<void> {
  if (!path || path.startsWith("local/")) return;
  if (isSupabaseConfigured) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  }
}

export async function downloadAssetFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Falha ao baixar arquivo");
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
