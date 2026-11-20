import { query } from "../config/db.js";

export const DOCUMENT_ACCESS_LEVELS = Object.freeze({
  SUPER_ADMIN_ONLY: "super_admin_only",
  LEADERSHIP_ONLY: "leadership_only",
  APPROVED_MEMBERS: "approved_members",
});

export function canAccessDocument(
  document,
  {
    isSuperAdmin = false,
    isApprovedMember = false,
    hasCurrentLeadership = false,
  } = {},
) {
  if (!document) return false;

  if (isSuperAdmin) return true;

  switch (document.access_level) {
    case DOCUMENT_ACCESS_LEVELS.SUPER_ADMIN_ONLY:
      return false;

    case DOCUMENT_ACCESS_LEVELS.LEADERSHIP_ONLY:
      return hasCurrentLeadership;

    case DOCUMENT_ACCESS_LEVELS.APPROVED_MEMBERS:
      return isApprovedMember;

    default:
      return false;
  }
}

export async function listDocuments() {
  const { rows } = await query(
    `SELECT id, title, description, file_name,
       access_level, created_at
       FROM documents
      ORDER BY created_at DESC`,
  );

  return rows;
}

export async function listAccessibleDocuments({
  isSuperAdmin = false,
  isApprovedMember = false,
  hasCurrentLeadership = false,
} = {}) {
  const { rows } = await query(
    `SELECT id, title, description, file_name, file_path,
            access_level, created_at
       FROM documents
      WHERE
            ($1::boolean)
         OR ($2::boolean AND access_level = 'approved_members')
         OR ($3::boolean AND access_level = 'leadership_only')
      ORDER BY created_at DESC`,
    [isSuperAdmin, isApprovedMember, hasCurrentLeadership],
  );

  return rows;
}

export async function createDocument({
  title,
  description,
  fileName,
  filePath,
  uploadedBy,
  accessLevel = DOCUMENT_ACCESS_LEVELS.SUPER_ADMIN_ONLY,
}) {
  if (!Object.values(DOCUMENT_ACCESS_LEVELS).includes(accessLevel)) {
    throw new Error("Invalid document access level.");
  }

  const { rows } = await query(
    `INSERT INTO documents (
        title,
        description,
        file_name,
        file_path,
        uploaded_by,
        access_level
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, access_level, created_at`,
    [title, description, fileName, filePath, uploadedBy, accessLevel],
  );

  return rows[0];
}

export async function getDocumentById(id) {
  const { rows } = await query(`SELECT * FROM documents WHERE id = $1`, [id]);

  return rows[0] || null;
}

export async function updateDocumentAccessLevel(id, accessLevel) {
  if (!Object.values(DOCUMENT_ACCESS_LEVELS).includes(accessLevel)) {
    throw new Error("Invalid document access level.");
  }

  const { rows } = await query(
    `UPDATE documents
        SET access_level = $2
      WHERE id = $1
      RETURNING id, title, access_level`,
    [id, accessLevel],
  );

  return rows[0] || null;
}

export async function deleteDocument(id) {
  await query(`DELETE FROM documents WHERE id = $1`, [id]);
}
