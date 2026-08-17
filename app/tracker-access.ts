import { getChatGPTUser } from "./chatgpt-auth";
import { getTrackerAccess, type TrackerIdentity } from "../db/access-store";

export async function getCurrentTrackerIdentity(): Promise<TrackerIdentity | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  return { email: user.email, displayName: user.displayName };
}

export async function getCurrentTrackerAccess() {
  const identity = await getCurrentTrackerIdentity();
  if (!identity) return { identity: null, access: null };
  return { identity, access: await getTrackerAccess(identity) };
}

export async function authorizeTrackerApi() {
  const { identity, access } = await getCurrentTrackerAccess();
  if (!identity || !access) {
    return {
      identity: null,
      access: null,
      error: Response.json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }
  if (access.status !== "approved") {
    return {
      identity,
      access,
      error: Response.json(
        { error: "Your tracker access is awaiting owner approval." },
        { status: 403 },
      ),
    };
  }
  return { identity, access, error: null };
}
