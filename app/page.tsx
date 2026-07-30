import { DriveDashboard } from "./DriveDashboard";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isTrackerAccessTokenValid,
  TRACKER_COOKIE_NAME,
} from "../lib/tracker-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TRACKER_COOKIE_NAME)?.value ?? "";
  let authorized = false;
  try {
    authorized = await isTrackerAccessTokenValid(token);
  } catch {
    authorized = false;
  }
  if (!authorized) redirect("/access");
  return <DriveDashboard />;
}
