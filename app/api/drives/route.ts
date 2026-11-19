import {
  buildChanges,
  ensureDriveDatabase,
  getDriveById,
  recordHistory,
  selectDriveFields,
  serializeDrive,
  summarizeChanges,
  type DriveRecord,
} from "../../../db/drive-store";
import { authorizeTrackerApi } from "../../tracker-access";

type DrivePayload = {
  id?: number;
  ids?: number[];
  updates?: BulkDriveUpdates;
  driveNumber?: string;
  label?: string;
  date?: string;
  status?: string;
  totalGb?: number;
  spaceLeftGb?: number;
  contents?: string;
  deletePermission?: string;
  brand?: string;
  customBrand?: string;
  locationType?: string;
  location?: string;
  note?: string;
};

type BulkDriveUpdates = {
  status?: string;
  deletePermission?: string;
  brand?: string;
  customBrand?: string;
  locationType?: string;
  location?: string;
};

const validStatuses = new Set(["waiting", "processing", "processed"]);
const validPermissions = new Set(["clear", "ask", "protected"]);
const validBrands = new Set(["samsung", "sandisk", "other"]);
const validLocations = new Set(["4dv-studio", "data-center", "other"]);
const globalHistoryFields = new Set([
  "status",
  "location",
  "contents",
  "totalGb",
  "spaceLeftGb",
  "brand",
  "customBrand",
  "deletePermission",
  "photoName",
]);

const bulkUpdateFields = new Set([
  "status",
  "deletePermission",
  "brand",
  "customBrand",
  "locationType",
  "location",
]);

function cleanPayload(payload: DrivePayload) {
  const driveNumber = payload.driveNumber?.trim().toUpperCase() ?? "";
  const label = payload.label?.trim() ?? "";
  const date = payload.date?.trim() || new Date().toISOString().slice(0, 10);
  const status = validStatuses.has(payload.status ?? "")
    ? payload.status!
    : "waiting";
  const totalGb = Math.round(Number(payload.totalGb));
  const spaceLeftGb = Math.round(Number(payload.spaceLeftGb));
  const contents = payload.contents?.trim() ?? "";
  const deletePermission = validPermissions.has(payload.deletePermission ?? "")
    ? payload.deletePermission!
    : "ask";
  const brand = validBrands.has(payload.brand ?? "") ? payload.brand! : "other";
  const customBrand = brand === "other" ? payload.customBrand?.trim() ?? "" : "";
  const locationType = validLocations.has(payload.locationType ?? "")
    ? payload.locationType!
    : "other";
  const location =
    locationType === "4dv-studio"
      ? "4DV Studio"
      : locationType === "data-center"
        ? "Data Center"
        : payload.location?.trim() ?? "";
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
    brand,
    customBrand,
    locationType,
    location,
    note,
  };
}

async function updateDriveRecord(
  d1: D1Database,
  id: number,
  drive: ReturnType<typeof cleanPayload>,
) {
  await d1
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
        brand = ?,
        custom_brand = ?,
        location_type = ?,
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
      drive.brand,
      drive.customBrand,
      drive.locationType,
      drive.location,
      drive.note,
      id,
    )
    .run();
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

export async function GET(request: Request) {
  const authorization = await authorizeTrackerApi();
  if (authorization.error) return authorization.error;
  try {
    const d1 = await ensureDriveDatabase();
    const url = new URL(request.url);
    const historyFor = Number(url.searchParams.get("historyFor"));

    if (url.searchParams.get("history") === "all") {
      const result = await d1
        .prepare(`
          SELECT
            h.id,
            h.drive_id AS driveId,
            d.drive_number AS driveNumber,
            d.label AS driveLabel,
            h.action,
            h.summary,
            h.changes_json AS changesJson,
            h.before_snapshot AS beforeSnapshot,
            h.after_snapshot AS afterSnapshot,
            h.created_at AS createdAt
          FROM drive_history h
          INNER JOIN drives d ON d.id = h.drive_id
          ORDER BY h.created_at DESC, h.id DESC
          LIMIT 500
        `)
        .all<{
          id: number;
          driveId: number;
          driveNumber: string;
          driveLabel: string;
          action: string;
          summary: string;
          changesJson: string;
          beforeSnapshot: string;
          afterSnapshot: string;
          createdAt: string;
        }>();
      const history = result.results.flatMap((entry) => {
        const changes = (JSON.parse(entry.changesJson || "[]") as Array<{
          field: string;
          label: string;
          before: string | number | null;
          after: string | number | null;
        }>).filter((change) => globalHistoryFields.has(change.field));
        if (!changes.length && !["baseline", "created"].includes(entry.action)) {
          return [];
        }
        return [{ ...entry, changesJson: undefined, changes }];
      });
      return Response.json({ history });
    }

    if (Number.isInteger(historyFor) && historyFor > 0) {
      const result = await d1
        .prepare(`
          SELECT
            id,
            action,
            summary,
            changes_json AS changesJson,
            before_snapshot AS beforeSnapshot,
            after_snapshot AS afterSnapshot,
            created_at AS createdAt
          FROM drive_history
          WHERE drive_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .bind(historyFor)
        .all<{
          id: number;
          action: string;
          summary: string;
          changesJson: string;
          beforeSnapshot: string;
          afterSnapshot: string;
          createdAt: string;
        }>();
      return Response.json({
        history: result.results.map((entry) => ({
          ...entry,
          changes: JSON.parse(entry.changesJson || "[]"),
          changesJson: undefined,
        })),
      });
    }

    const result = await d1
      .prepare(`${selectDriveFields} ORDER BY drive_number COLLATE NOCASE ASC`)
      .all<DriveRecord>();
    return Response.json({ drives: result.results.map(serializeDrive) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeTrackerApi();
  if (authorization.error) return authorization.error;
  try {
    const d1 = await ensureDriveDatabase();
    const drive = cleanPayload((await request.json()) as DrivePayload);
    const result = await d1
      .prepare(`
        INSERT INTO drives (
          drive_number, label, date, status, total_gb, space_left_gb,
          contents, delete_permission, brand, custom_brand,
          location_type, location, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        drive.brand,
        drive.customBrand,
        drive.locationType,
        drive.location,
        drive.note,
      )
      .first<{ id: number }>();
    if (!result?.id) throw new Error("Could not create drive record.");
    const created = await getDriveById(d1, result.id);
    if (!created) throw new Error("Could not load the new drive record.");
    await recordHistory(
      d1,
      result.id,
      "created",
      "Drive registered",
      null,
      created,
      [],
    );
    return Response.json({ id: result.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeTrackerApi();
  if (authorization.error) return authorization.error;
  try {
    const d1 = await ensureDriveDatabase();
    const payload = (await request.json()) as DrivePayload;

    if (Array.isArray(payload.ids)) {
      const ids = [...new Set(payload.ids.map(Number))];
      const updates = payload.updates ?? {};
      const updateKeys = Object.keys(updates);
      if (
        !ids.length ||
        ids.length > 100 ||
        ids.some((id) => !Number.isInteger(id) || id <= 0)
      ) {
        return Response.json(
          { error: "Select between 1 and 100 valid drives." },
          { status: 400 },
        );
      }
      if (
        !updateKeys.length ||
        updateKeys.some((key) => !bulkUpdateFields.has(key))
      ) {
        return Response.json(
          { error: "Choose at least one supported field to update." },
          { status: 400 },
        );
      }

      const prepared: Array<{
        id: number;
        before: DriveRecord;
        drive: ReturnType<typeof cleanPayload>;
      }> = [];
      for (const id of ids) {
        const before = await getDriveById(d1, id);
        if (!before) {
          return Response.json(
            { error: `Drive ${id} was not found.` },
            { status: 404 },
          );
        }
        prepared.push({
          id,
          before,
          drive: cleanPayload({ ...before, ...updates }),
        });
      }

      let changedCount = 0;
      for (const item of prepared) {
        await updateDriveRecord(d1, item.id, item.drive);
        const after = await getDriveById(d1, item.id);
        if (!after) throw new Error("Could not load a bulk-updated drive.");
        const changes = buildChanges(item.before, after);
        if (changes.length) {
          changedCount += 1;
          await recordHistory(
            d1,
            item.id,
            "bulk-updated",
            summarizeChanges(changes),
            item.before,
            after,
            changes,
          );
        }
      }
      return Response.json({ ok: true, changedCount });
    }

    const id = Number(payload.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "A valid drive id is required." }, { status: 400 });
    }
    const before = await getDriveById(d1, id);
    if (!before) return Response.json({ error: "Drive not found." }, { status: 404 });
    const drive = cleanPayload(payload);
    await updateDriveRecord(d1, id, drive);
    const after = await getDriveById(d1, id);
    if (!after) throw new Error("Could not load the updated drive.");
    const changes = buildChanges(before, after);
    if (changes.length) {
      await recordHistory(
        d1,
        id,
        "updated",
        summarizeChanges(changes),
        before,
        after,
        changes,
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeTrackerApi();
  if (authorization.error) return authorization.error;
  try {
    const d1 = await ensureDriveDatabase();
    const payload = (await request.json()) as DrivePayload;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "A valid drive id is required." }, { status: 400 });
    }
    const results = await d1.batch([
      d1.prepare("DELETE FROM drive_history WHERE drive_id = ?").bind(id),
      d1.prepare("DELETE FROM drives WHERE id = ?").bind(id),
    ]);
    if (!results[1]?.meta.changes) {
      return Response.json({ error: "Drive not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
