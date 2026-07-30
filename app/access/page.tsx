import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isTrackerAccessTokenValid,
  TRACKER_COOKIE_NAME,
} from "../../lib/tracker-auth";
import { AccessForm } from "./AccessForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Access — 4DV Studio Hard Drive Tracking System",
  description: "Password-protected access to the 4DV Studio hard drive tracker.",
};

export default async function AccessPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TRACKER_COOKIE_NAME)?.value ?? "";
  let authorized = false;
  try {
    authorized = await isTrackerAccessTokenValid(token);
  } catch {
    // The form displays a configuration error if hosted secrets are unavailable.
  }
  if (authorized) redirect("/");

  return (
    <main className="access-page">
      <section className="access-card">
        <div className="access-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>4DV Studio</span>
        </div>
        <div className="access-heading">
          <p>Protected workspace</p>
          <h1>Hard Drive<br />Tracking System</h1>
          <span>Enter the shared password to view and update the drive inventory.</span>
        </div>
        <AccessForm />
        <p className="access-footnote">Authorized studio access only</p>
      </section>
    </main>
  );
}
