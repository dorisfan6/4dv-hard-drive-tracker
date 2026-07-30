import { env } from "cloudflare:workers";

export const TRACKER_COOKIE_NAME = "tracker_access";

const sessionMessage = "4dv-hard-drive-tracker-access-v1";
const sessionDurationSeconds = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function getAuthConfig() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const password = runtimeEnv.TRACKER_PASSWORD ?? "";
  const sessionSecret = runtimeEnv.TRACKER_SESSION_SECRET ?? "";
  if (!password || !sessionSecret) {
    throw new Error("Tracker access protection is not configured.");
  }
  return { password, sessionSecret };
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqual(left: string, right: string) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export async function verifyTrackerPassword(candidate: string) {
  const { password, sessionSecret } = getAuthConfig();
  const [candidateDigest, passwordDigest] = await Promise.all([
    hmac(candidate, sessionSecret),
    hmac(password, sessionSecret),
  ]);
  return constantTimeEqual(candidateDigest, passwordDigest);
}

export async function createTrackerAccessToken() {
  const { password, sessionSecret } = getAuthConfig();
  return hmac(`${sessionMessage}:${password}`, sessionSecret);
}

export async function isTrackerAccessTokenValid(token: string) {
  if (!token) return false;
  const expected = await createTrackerAccessToken();
  return constantTimeEqual(token, expected);
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}

export async function isTrackerRequestAuthorized(request: Request) {
  const token = readCookie(request.headers.get("cookie"), TRACKER_COOKIE_NAME);
  return isTrackerAccessTokenValid(token);
}

export async function requireTrackerAccess(request: Request) {
  try {
    if (await isTrackerRequestAuthorized(request)) return null;
    return Response.json(
      { error: "Enter the tracker password to continue." },
      { status: 401 },
    );
  } catch {
    return Response.json(
      { error: "Tracker access protection is unavailable." },
      { status: 503 },
    );
  }
}

export function trackerAccessCookie(token: string, secure: boolean) {
  return [
    `${TRACKER_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    `Max-Age=${sessionDurationSeconds}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearTrackerAccessCookie(secure: boolean) {
  return [
    `${TRACKER_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}
