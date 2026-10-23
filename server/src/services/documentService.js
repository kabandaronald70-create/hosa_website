import { supabase } from "../config/supabase.js";

export async function uploadDocumentToStorage(
  userId,
  fileBuffer,
  mimetype,
  originalName,
) {
  // Generate a safe, unique file name
  const ext = originalName.split(".").pop();
  const fileName = `doc-${userId}-${Date.now()}.${ext}`;

  // Upload to the 'hosa-documents' bucket
  const { data, error } = await supabase.storage
    .from("hosa-documents")
    .upload(fileName, fileBuffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase document upload failed: ${error.message}`);
  }

  // Return the file path (we will use this to generate secure URLs later)
  return fileName;
}
