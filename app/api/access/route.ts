import {
  clearTrackerAccessCookie,
  createTrackerAccessToken,
  trackerAccessCookie,
  verifyTrackerPassword,
} from "../../../lib/tracker-auth";

function usesSecureCookie(request: Request) {
  return new URL(request.url).protocol === "https:";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { password?: string };
    const password = payload.password ?? "";
    if (!(await verifyTrackerPassword(password))) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return Response.json(
        { error: "That password is not correct." },
        { status: 401 },
      );
    }

    const token = await createTrackerAccessToken();
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": trackerAccessCookie(token, usesSecureCookie(request)),
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Password access is not configured yet." },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": clearTrackerAccessCookie(usesSecureCookie(request)),
      },
    },
  );
}
