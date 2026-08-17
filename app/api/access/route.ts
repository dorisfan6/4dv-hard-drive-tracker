import {
  getTrackerAccess,
  listTrackerAccessRequests,
  requestTrackerAccess,
  reviewTrackerAccessRequest,
} from "../../../db/access-store";
import { getCurrentTrackerIdentity } from "../../tracker-access";

function accessError(error: unknown, status = 500) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Access request failed." },
    { status },
  );
}

export async function GET() {
  try {
    const identity = await getCurrentTrackerIdentity();
    if (!identity) return accessError(new Error("Sign in to continue."), 401);
    const access = await getTrackerAccess(identity);
    const requests = access.isOwner ? await listTrackerAccessRequests() : [];
    return Response.json({ access, requests });
  } catch (error) {
    return accessError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await getCurrentTrackerIdentity();
    if (!identity) return accessError(new Error("Sign in to continue."), 401);
    const body = (await request.json()) as { displayName?: string; note?: string };
    const access = await requestTrackerAccess(
      identity,
      body.displayName || identity.displayName,
      body.note || "",
    );
    return Response.json({ access }, { status: 201 });
  } catch (error) {
    return accessError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await getCurrentTrackerIdentity();
    if (!identity) return accessError(new Error("Sign in to continue."), 401);
    const body = (await request.json()) as {
      email?: string;
      decision?: "approved" | "rejected";
    };
    if (!body.email || !["approved", "rejected"].includes(body.decision || "")) {
      return accessError(new Error("Choose an access request and decision."), 400);
    }
    const result = await reviewTrackerAccessRequest(
      identity,
      body.email,
      body.decision!,
    );
    return Response.json(result);
  } catch (error) {
    const status = error instanceof Error && error.message.includes("Only") ? 403 : 500;
    return accessError(error, status);
  }
}
