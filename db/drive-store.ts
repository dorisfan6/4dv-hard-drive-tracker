import { getD1 } from ".";

export type DriveRecord = {
  id: number;
  driveNumber: string;
  label: string;
  date: string;
  status: string;
  totalGb: number;
  spaceLeftGb: number;
  contents: string;
  deletePermission: string;
  brand: string;
  customBrand: string;
  locationType: string;
  location: string;
  note: string;
  photoKey: string;
  photoName: string;
  photoType: string;
  updatedAt: string;
};

export type HistoryChange = {
  field: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
};

export const selectDriveFields = `
  SELECT
    id,
    drive_number AS driveNumber,
    label,
    date,
    status,
    total_gb AS totalGb,
    space_left_gb AS spaceLeftGb,
    contents,
    delete_permission AS deletePermission,
    brand,
    custom_brand AS customBrand,
    location_type AS locationType,
    location,
    note,
    photo_key AS photoKey,
    photo_name AS photoName,
    photo_type AS photoType,
    updated_at AS updatedAt
  FROM drives
`;

const seedDrives = [
  ["BR-01", "PRIMARY RAID", "2026-07-29", "processing", 8000, 1200, "Neemo MVC, Rain selects, Working exports", "ask", "samsung", "", "4dv-studio", "4DV Studio", "Current edit — confirm with post before clearing."],
  ["BR-02", "SHUTTLE A", "2026-07-28", "waiting", 4000, 3600, "Verified backup only", "clear", "sandisk", "", "4dv-studio", "4DV Studio", "Ready for the next transfer."],
  ["BR-03", "MASTER ARCHIVE", "2026-07-24", "processed", 8000, 420, "Burberry Rain masters, ProRes finals, Audio masters", "protected", "samsung", "", "data-center", "Data Center", "Two-copy master archive. Do not repurpose."],
  ["BR-04", "4DV CAPTURE", "2026-07-29", "processing", 2000, 80, "4DV source, Fog tests, Capture cache", "ask", "other", "LaCie", "4dv-studio", "4DV Studio", "Check whether source is on BR-03 before deleting cache."],
  ["BR-05", "FIELD DRIVE", "2026-07-27", "processed", 4000, 2800, "Rain coat wet, DNRain, Camera reports", "clear", "sandisk", "", "4dv-studio", "4DV Studio", "Originals copied to archive."],
  ["BR-06", "REVIEW / TEMP", "2026-07-21", "waiting", 5000, 4100, "Old exports, Temp renders, Review links", "ask", "other", "G-Drive", "other", "Post desk", "Likely reusable after producer approval."],
] as const;

const trackedFields: Array<{
  key: keyof DriveRecord;
  label: string;
}> = [
  { key: "driveNumber", label: "Hard drive #" },
  { key: "label", label: "Label" },
  { key: "status", label: "Status" },
  { key: "contents", label: "Contents" },
  { key: "totalGb", label: "Total storage" },
  { key: "spaceLeftGb", label: "Space left" },
  { key: "deletePermission", label: "Delete permission" },
  { key: "brand", label: "Brand" },
  { key: "customBrand", label: "Other brand" },
  { key: "locationType", label: "Location type" },
  { key: "location", label: "Physical location" },
  { key: "date", label: "Last checked" },
  { key: "note", label: "Note" },
  { key: "photoName", label: "Photo" },
];

export async function ensureDriveDatabase() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS drives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drive_number TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        total_gb INTEGER NOT NULL,
        space_left_gb INTEGER NOT NULL,
        contents TEXT NOT NULL DEFAULT '',
        delete_permission TEXT NOT NULL DEFAULT 'ask',
        brand TEXT NOT NULL DEFAULT 'other',
        custom_brand TEXT NOT NULL DEFAULT '',
        location_type TEXT NOT NULL DEFAULT 'other',
        location TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        photo_key TEXT NOT NULL DEFAULT '',
        photo_name TEXT NOT NULL DEFAULT '',
        photo_type TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `),
    d1.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS drives_drive_number_idx
      ON drives (drive_number)
    `),
  ]);

  const schemaReady = await d1
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind("drive_schema_v2")
    .first<{ value: string }>();

  if (!schemaReady) {
    const columnResult = await d1
      .prepare("PRAGMA table_info(drives)")
      .all<{ name: string }>();
    const columns = new Set(columnResult.results.map((column) => column.name));
    const additions = [
      ["brand", "ALTER TABLE drives ADD COLUMN brand TEXT NOT NULL DEFAULT 'other'"],
      ["custom_brand", "ALTER TABLE drives ADD COLUMN custom_brand TEXT NOT NULL DEFAULT ''"],
      ["location_type", "ALTER TABLE drives ADD COLUMN location_type TEXT NOT NULL DEFAULT 'other'"],
      ["photo_key", "ALTER TABLE drives ADD COLUMN photo_key TEXT NOT NULL DEFAULT ''"],
      ["photo_name", "ALTER TABLE drives ADD COLUMN photo_name TEXT NOT NULL DEFAULT ''"],
      ["photo_type", "ALTER TABLE drives ADD COLUMN photo_type TEXT NOT NULL DEFAULT ''"],
    ] as const;

    for (const [column, statement] of additions) {
      if (!columns.has(column)) await d1.prepare(statement).run();
    }

    await d1
      .prepare(`
        UPDATE drives SET status = CASE status
          WHEN 'in-use' THEN 'processing'
          WHEN 'ready' THEN 'waiting'
          WHEN 'full' THEN 'processed'
          WHEN 'archive' THEN 'processed'
          WHEN 'needs-review' THEN 'waiting'
          ELSE status
        END
        WHERE status IN ('in-use', 'ready', 'full', 'archive', 'needs-review')
      `)
      .run();
    await d1
      .prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)")
      .bind("drive_schema_v2", "true")
      .run();
  }

  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS drive_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drive_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        summary TEXT NOT NULL,
        changes_json TEXT NOT NULL DEFAULT '[]',
        before_snapshot TEXT NOT NULL DEFAULT '',
        after_snapshot TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    d1.prepare(`
      CREATE INDEX IF NOT EXISTS drive_history_drive_id_idx
      ON drive_history (drive_id)
    `),
  ]);

  const seeded = await d1
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind("sample_seeded")
    .first<{ value: string }>();

  if (!seeded) {
    const count = await d1
      .prepare("SELECT COUNT(*) AS count FROM drives")
      .first<{ count: number }>();
    const statements: D1PreparedStatement[] = [];
    if (!count?.count) {
      for (const drive of seedDrives) {
        statements.push(
          d1
            .prepare(`
              INSERT INTO drives (
                drive_number, label, date, status, total_gb, space_left_gb,
                contents, delete_permission, brand, custom_brand,
                location_type, location, note
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(...drive),
        );
      }
    }
    statements.push(
      d1
        .prepare("INSERT INTO app_state (key, value) VALUES (?, ?)")
        .bind("sample_seeded", "true"),
    );
    await d1.batch(statements);
  }

  const historyStarted = await d1
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind("history_started_v2")
    .first<{ value: string }>();

  if (!historyStarted) {
    const existing = await d1
      .prepare(`${selectDriveFields} ORDER BY id ASC`)
      .all<DriveRecord>();
    const statements: D1PreparedStatement[] = existing.results.map((drive) =>
      d1
        .prepare(`
          INSERT INTO drive_history (
            drive_id, action, summary, changes_json, before_snapshot, after_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          drive.id,
          "baseline",
          "History tracking started",
          JSON.stringify([]),
          "",
          JSON.stringify(driveSnapshot(drive)),
        ),
    );
    statements.push(
      d1
        .prepare("INSERT INTO app_state (key, value) VALUES (?, ?)")
        .bind("history_started_v2", "true"),
    );
    await d1.batch(statements);
  }

  return d1;
}

export async function getDriveById(d1: D1Database, id: number) {
  return d1
    .prepare(`${selectDriveFields} WHERE id = ?`)
    .bind(id)
    .first<DriveRecord>();
}

export function serializeDrive(drive: DriveRecord) {
  return {
    ...drive,
    photoUrl: drive.photoKey
      ? `/api/drives/photo?key=${encodeURIComponent(drive.photoKey)}`
      : "",
  };
}

export function driveSnapshot(drive: DriveRecord) {
  return Object.fromEntries(
    trackedFields.map(({ key }) => [key, drive[key] ?? ""]),
  );
}

export function buildChanges(
  before: DriveRecord,
  after: DriveRecord,
): HistoryChange[] {
  return trackedFields.flatMap(({ key, label }) => {
    const beforeValue = before[key] ?? "";
    const afterValue = after[key] ?? "";
    return beforeValue === afterValue
      ? []
      : [
          {
            field: key,
            label,
            before: beforeValue as string | number,
            after: afterValue as string | number,
          },
        ];
  });
}

export function summarizeChanges(changes: HistoryChange[]) {
  if (changes.some((change) => change.field === "status")) {
    return "Processing status updated";
  }
  if (changes.some((change) => change.field === "contents")) {
    return "Stored contents updated";
  }
  if (changes.some((change) => change.field === "photoName")) {
    return "Drive photo updated";
  }
  return `${changes.length} field${changes.length === 1 ? "" : "s"} updated`;
}

export async function recordHistory(
  d1: D1Database,
  driveId: number,
  action: string,
  summary: string,
  before: DriveRecord | null,
  after: DriveRecord,
  changes: HistoryChange[],
) {
  await d1
    .prepare(`
      INSERT INTO drive_history (
        drive_id, action, summary, changes_json, before_snapshot, after_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      driveId,
      action,
      summary,
      JSON.stringify(changes),
      before ? JSON.stringify(driveSnapshot(before)) : "",
      JSON.stringify(driveSnapshot(after)),
    )
    .run();
}
