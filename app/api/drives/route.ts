import { getD1 } from "../../../db";

type DrivePayload = {
  id?: number;
  driveNumber?: string;
  label?: string;
  date?: string;
  status?: string;
  totalGb?: number;
  spaceLeftGb?: number;
  contents?: string;
  deletePermission?: string;
  location?: string;
  note?: string;
};

const validStatuses = new Set([
  "ready",
  "in-use",
  "full",
  "archive",
  "needs-review",
]);

const validPermissions = new Set(["clear", "ask", "protected"]);

const selectDrivesSql = `
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
    location,
    note,
    updated_at AS updatedAt
  FROM drives
  ORDER BY drive_number COLLATE NOCASE ASC
`;

const seedDrives = [
  {
    driveNumber: "BR-01",
    label: "PRIMARY RAID",
    date: "2026-07-29",
    status: "in-use",
    totalGb: 8000,
    spaceLeftGb: 1200,
    contents: "Neemo MVC, Rain selects, Working exports",
    deletePermission: "ask",
    location: "Edit Bay A",
    note: "Current edit — confirm with post before clearing.",
  },
  {
    driveNumber: "BR-02",
    label: "SHUTTLE A",
    date: "2026-07-28",
    status: "ready",
    totalGb: 4000,
    spaceLeftGb: 3600,
    contents: "Verified backup only",
    deletePermission: "clear",
    location: "Shelf A · 02",
    note: "Ready for the next transfer.",
  },
  {
    driveNumber: "BR-03",
    label: "MASTER ARCHIVE",
    date: "2026-07-24",
    status: "archive",
    totalGb: 8000,
    spaceLeftGb: 420,
    contents: "Burberry Rain masters, ProRes finals, Audio masters",
    deletePermission: "protected",
    location: "Archive cabinet",
    note: "Two-copy master archive. Do not repurpose.",
  },
  {
    driveNumber: "BR-04",
    label: "4DV CAPTURE",
    date: "2026-07-29",
    status: "full",
    totalGb: 2000,
    spaceLeftGb: 80,
    contents: "4DV source, Fog tests, Capture cache",
    deletePermission: "ask",
    location: "Capture station",
    note: "Check whether source is on BR-03 before deleting cache.",
  },
  {
    driveNumber: "BR-05",
    label: "FIELD DRIVE",
    date: "2026-07-27",
    status: "ready",
    totalGb: 4000,
    spaceLeftGb: 2800,
    contents: "Rain coat wet, DNRain, Camera reports",
    deletePermission: "clear",
    location: "Shelf A · 05",
    note: "Originals copied to archive.",
  },
  {
    driveNumber: "BR-06",
    label: "REVIEW / TEMP",
    date: "2026-07-21",
    status: "needs-review",
    totalGb: 5000,
    spaceLeftGb: 4100,
    contents: "Old exports, Temp renders, Review links",
    deletePermission: "ask",
    location: "Post desk",
    note: "Likely reusable after producer approval.",
  },
];

async function ensureDatabase() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS drives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drive_number TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        total_gb INTEGER NOT NULL,
        space_left_gb INTEGER NOT NULL,
        contents TEXT NOT NULL DEFAULT '',
        delete_permission TEXT NOT NULL DEFAULT 'ask',
        location TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
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

  const seeded = await d1
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind("sample_seeded")
    .first<{ value: string }>();

  if (!seeded) {
    const count = await d1
      .prepare("SELECT COUNT(*) AS count FROM drives")
      .first<{ count: number }>();

    const statements = [];
    if (!count?.count) {
      for (const drive of seedDrives) {
        statements.push(
          d1
            .prepare(`
              INSERT INTO drives (
                drive_number, label, date, status, total_gb, space_left_gb,
                contents, delete_permission, location, note
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              drive.driveNumber,
              drive.label,
              drive.date,
              drive.status,
              drive.totalGb,
              drive.spaceLeftGb,
              drive.contents,
              drive.deletePermission,
              drive.location,
              drive.note,
            ),
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

  return d1;
}

function cleanPayload(payload: DrivePayload) {
  const driveNumber = payload.driveNumber?.trim().toUpperCase() ?? "";
  const label = payload.label?.trim() ?? "";
  const date = payload.date?.trim() || new Date().toISOString().slice(0, 10);
  const status = validStatuses.has(payload.status ?? "")
    ? payload.status!
    : "ready";
  const totalGb = Math.round(Number(payload.totalGb));
  const spaceLeftGb = Math.round(Number(payload.spaceLeftGb));
  const contents = payload.contents?.trim() ?? "";
  const deletePermission = validPermissions.has(payload.deletePermission ?? "")
    ? payload.deletePermission!
    : "ask";
  const location = payload.location?.trim() ?? "";
  const note = payload.note?.trim() ?? "";

  if (!driveNumber) throw new Error("Hard drive # is required.");
  if (!Number.isFinite(totalGb) || totalGb <= 0) {
    throw new Error("Total storage must be greater than zero.");
  }
  if (
    !Number.isFinite(spaceLeftGb) ||
    spaceLeftGb < 0 ||
    spaceLeftGb > totalGb
  ) {
    throw new Error("Space left must be between zero and total storage.");
  }

  return {
    driveNumber,
    label,
    date,
    status,
    totalGb,
    spaceLeftGb,
    contents,
    deletePermission,
    location,
    note,
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  const duplicate = message.includes("UNIQUE constraint failed");
  return Response.json(
    {
      error: duplicate
        ? "That hard drive # already exists. Use a unique number."
        : message,
    },
    { status: duplicate ? 409 : 500 },
  );
}

export async function GET() {
  try {
    const d1 = await ensureDatabase();
    const result = await d1.prepare(selectDrivesSql).all();
    return Response.json({ drives: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const d1 = await ensureDatabase();
    const drive = cleanPayload((await request.json()) as DrivePayload);
    const result = await d1
      .prepare(`
        INSERT INTO drives (
          drive_number, label, date, status, total_gb, space_left_gb,
          contents, delete_permission, location, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `)
      .bind(
        drive.driveNumber,
        drive.label,
        drive.date,
        drive.status,
        drive.totalGb,
        drive.spaceLeftGb,
        drive.contents,
        drive.deletePermission,
        drive.location,
        drive.note,
      )
      .first<{ id: number }>();
    return Response.json({ id: result?.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const d1 = await ensureDatabase();
    const payload = (await request.json()) as DrivePayload;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "A valid drive id is required." }, { status: 400 });
    }
    const drive = cleanPayload(payload);
    const result = await d1
      .prepare(`
        UPDATE drives SET
          drive_number = ?,
          label = ?,
          date = ?,
          status = ?,
          total_gb = ?,
          space_left_gb = ?,
          contents = ?,
          delete_permission = ?,
          location = ?,
          note = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        drive.driveNumber,
        drive.label,
        drive.date,
        drive.status,
        drive.totalGb,
        drive.spaceLeftGb,
        drive.contents,
        drive.deletePermission,
        drive.location,
        drive.note,
        id,
      )
      .run();
    if (!result.meta.changes) {
      return Response.json({ error: "Drive not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const d1 = await ensureDatabase();
    const payload = (await request.json()) as DrivePayload;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "A valid drive id is required." }, { status: 400 });
    }
    const result = await d1
      .prepare("DELETE FROM drives WHERE id = ?")
      .bind(id)
      .run();
    if (!result.meta.changes) {
      return Response.json({ error: "Drive not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
