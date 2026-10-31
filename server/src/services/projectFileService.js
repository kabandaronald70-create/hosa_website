import { supabase } from "../config/supabase.js";

export async function uploadProjectFile(
  userId,
  fileBuffer,
  mimetype,
  originalName,
) {
  const ext = originalName.split(".").pop();
  const fileName = `proj-${userId}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("project-files") // Create this bucket in Supabase
    .upload(fileName, fileBuffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return { storagePath: fileName, originalName };
}

export async function uploadProjectImage(
  userId,
  fileBuffer,
  mimetype,
  originalName,
) {
  const ext = originalName.split(".").pop();
  const fileName = `img-${userId}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("project-files")
    .upload(fileName, fileBuffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase image upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("project-files")
    .getPublicUrl(fileName);
  return urlData.publicUrl;
}
