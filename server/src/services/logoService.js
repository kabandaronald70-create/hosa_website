import { supabase } from "../config/supabase.js"; // Adjust path if your supabase client is elsewhere

export async function uploadBusinessLogo(
  userId,
  fileBuffer,
  mimetype,
  originalName,
) {
  // Create a unique file name (e.g., "user-id-1234567.png")
  const ext = originalName.split(".").pop();
  const fileName = `logo-${userId}-${Date.now()}.${ext}`;

  // Upload to the 'business-logos' bucket
  const { data, error } = await supabase.storage
    .from("business-logos")
    .upload(fileName, fileBuffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from("business-logos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
