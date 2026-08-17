import { getD1 } from ".";

export type AccessStatus = "unregistered" | "pending" | "approved" | "rejected";

export type TrackerIdentity = {
  email: string;
  displayName: string;
};

export type TrackerAccess = {
  email: string;
  displayName: string;
  note: string;
  status: AccessStatus;
  isOwner: boolean;
  requestedAt: string;
  reviewedAt: string;
  reviewedBy: string;
};

export type AccessRequestRecord = Omit<TrackerAccess, "isOwner">;

export const TRACKER_OWNER_EMAIL = "yinuofan@4dv.ai";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function ensureAccessDatabase() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS tracker_users (
        email TEXT PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TEXT NOT NULL DEFAULT '',
        reviewed_by TEXT NOT NULL DEFAULT ''
      )
    `),
    d1.prepare(`
      CREATE INDEX IF NOT EXISTS tracker_users_status_idx
      ON tracker_users (status, requested_at)
    `),
  ]);

  await d1
    .prepare(`
      INSERT INTO tracker_users (
        email, display_name, note, status, reviewed_at, reviewed_by
      ) VALUES (?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?)
      ON CONFLICT(email) DO UPDATE SET
        status = 'approved',
        reviewed_at = CASE
          WHEN tracker_users.reviewed_at = '' THEN CURRENT_TIMESTAMP
          ELSE tracker_users.reviewed_at
        END,
        reviewed_by = ?
    `)
    .bind(
      TRACKER_OWNER_EMAIL,
      "Tracker owner",
      "Owner account",
      TRACKER_OWNER_EMAIL,
      TRACKER_OWNER_EMAIL,
    )
    .run();
  return d1;
}

export async function getTrackerAccess(
  identity: TrackerIdentity,
): Promise<TrackerAccess> {
  const d1 = await ensureAccessDatabase();
  const email = normalizeEmail(identity.email);
  const record = await d1
    .prepare(`
      SELECT
        email,
        display_name AS displayName,
        note,
        status,
        requested_at AS requestedAt,
        reviewed_at AS reviewedAt,
        reviewed_by AS reviewedBy
      FROM tracker_users
      WHERE email = ?
    `)
    .bind(email)
    .first<AccessRequestRecord>();
  const isOwner = email === TRACKER_OWNER_EMAIL;
  return {
    email,
    displayName: record?.displayName || identity.displayName || email,
    note: record?.note || "",
    status: isOwner ? "approved" : record?.status || "unregistered",
    isOwner,
    requestedAt: record?.requestedAt || "",
    reviewedAt: record?.reviewedAt || "",
    reviewedBy: record?.reviewedBy || "",
  };
}

export async function requestTrackerAccess(
  identity: TrackerIdentity,
  displayName: string,
  note: string,
) {
  const d1 = await ensureAccessDatabase();
  const email = normalizeEmail(identity.email);
  if (!email) throw new Error("A signed-in email is required.");
  if (email === TRACKER_OWNER_EMAIL) return getTrackerAccess(identity);
  const cleanName = displayName.trim().slice(0, 120) || identity.displayName || email;
  const cleanNote = note.trim().slice(0, 500);
  await d1
    .prepare(`
      INSERT INTO tracker_users (
        email, display_name, note, status, requested_at, reviewed_at, reviewed_by
      ) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP, '', '')
      ON CONFLICT(email) DO UPDATE SET
        display_name = excluded.display_name,
        note = excluded.note,
        status = 'pending',
        requested_at = CURRENT_TIMESTAMP,
        reviewed_at = '',
        reviewed_by = ''
    `)
    .bind(email, cleanName, cleanNote)
    .run();
  return getTrackerAccess({ email, displayName: cleanName });
}

export async function listTrackerAccessRequests() {
  const d1 = await ensureAccessDatabase();
  const result = await d1
    .prepare(`
      SELECT
        email,
        display_name AS displayName,
        note,
        status,
        requested_at AS requestedAt,
        reviewed_at AS reviewedAt,
        reviewed_by AS reviewedBy
      FROM tracker_users
      WHERE email != ?
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        requested_at DESC
    `)
    .bind(TRACKER_OWNER_EMAIL)
    .all<AccessRequestRecord>();
  return result.results;
}

export async function reviewTrackerAccessRequest(
  reviewer: TrackerIdentity,
  email: string,
  decision: "approved" | "rejected",
) {
  const reviewerAccess = await getTrackerAccess(reviewer);
  if (!reviewerAccess.isOwner) throw new Error("Only the tracker owner can review access.");
  const targetEmail = normalizeEmail(email);
  if (!targetEmail || targetEmail === TRACKER_OWNER_EMAIL) {
    throw new Error("Choose a valid access request.");
  }
  const d1 = await ensureAccessDatabase();
  const result = await d1
    .prepare(`
      UPDATE tracker_users SET
        status = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ?
      WHERE email = ?
    `)
    .bind(decision, reviewerAccess.email, targetEmail)
    .run();
  if (!result.meta.changes) throw new Error("Access request not found.");
  return { email: targetEmail, status: decision };
}
