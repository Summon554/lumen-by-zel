import { supabase } from "@/integrations/supabase/client";

const BUCKET = "lumen-media";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function uploadUserFile(
  userId: string,
  file: File,
  folder: "avatars" | "posts" | "covers" | "chat",
) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is too large (max 10MB)");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function getSignedUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresIn);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((d) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}