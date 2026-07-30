import { getPhotosBucket } from "../../../../db";
import {
  buildChanges,
  ensureDriveDatabase,
  getDriveById,
  recordHistory,
  serializeDrive,
  summarizeChanges,
} from "../../../../db/drive-store";
import { requireTrackerAccess } from "../../../../lib/tracker-auth";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

function photoError(error: unknown, status = 500) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Photo upload failed." },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const accessResponse = await requireTrackerAccess(request);
    if (accessResponse) return accessResponse;
    const key = new URL(request.url).searchParams.get("key") ?? "";
    if (!key.startsWith("drive-photos/")) {
      return new Response("Not found", { status: 404 });
    }
    const object = await getPhotosBucket().get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("ETag", object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error) {
    return photoError(error);
  }
}

export async function POST(request: Request) {
  try {
    const accessResponse = await requireTrackerAccess(request);
    if (accessResponse) return accessResponse;
    const formData = await request.formData();
    const driveId = Number(formData.get("driveId"));
    const photo = formData.get("photo");
    if (!Number.isInteger(driveId) || driveId <= 0) {
      return photoError(new Error("A valid drive id is required."), 400);
    }
    if (!(photo instanceof File)) {
      return photoError(new Error("Choose a photo to upload."), 400);
    }
    if (!allowedTypes.has(photo.type)) {
      return photoError(
        new Error("Use a JPG, PNG, or WebP photo."),
        415,
      );
    }
    if (photo.size > maxBytes) {
      return photoError(new Error("Photo must be 8 MB or smaller."), 413);
    }

    const d1 = await ensureDriveDatabase();
    const before = await getDriveById(d1, driveId);
    if (!before) return photoError(new Error("Drive not found."), 404);

    const extension =
      photo.type === "image/png"
        ? "png"
        : photo.type === "image/webp"
          ? "webp"
          : "jpg";
    const key = `drive-photos/${driveId}/${crypto.randomUUID()}.${extension}`;
    await getPhotosBucket().put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type },
      customMetadata: { originalName: photo.name, driveId: String(driveId) },
    });
    await d1
      .prepare(`
        UPDATE drives SET
          photo_key = ?,
          photo_name = ?,
          photo_type = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(key, photo.name.slice(0, 240), photo.type, driveId)
      .run();
    const after = await getDriveById(d1, driveId);
    if (!after) throw new Error("Could not load the updated drive.");
    const changes = buildChanges(before, after);
    await recordHistory(
      d1,
      driveId,
      "photo",
      summarizeChanges(changes),
      before,
      after,
      changes,
    );
    return Response.json({ drive: serializeDrive(after) }, { status: 201 });
  } catch (error) {
    return photoError(error);
  }
}
