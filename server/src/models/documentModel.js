import { query } from "../config/db.js";

export async function listDocuments() {
  const { rows } = await query(
    `SELECT id, title, description, file_name, file_path, created_at 
       FROM documents 
      ORDER BY created_at DESC`,
  );
  return rows;
}

export async function createDocument({
  title,
  description,
  fileName,
  filePath,
  uploadedBy,
}) {
  const { rows } = await query(
    `INSERT INTO documents (title, description, file_name, file_path, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, created_at`,
    [title, description, fileName, filePath, uploadedBy],
  );
  return rows[0];
}

export async function getDocumentById(id) {
  const { rows } = await query(`SELECT * FROM documents WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function deleteDocument(id) {
  await query(`DELETE FROM documents WHERE id = $1`, [id]);
}
