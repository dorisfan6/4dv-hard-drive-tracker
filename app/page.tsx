import { AccessGate } from "./AccessGate";
import { DriveDashboard } from "./DriveDashboard";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import { getTrackerAccess, listTrackerAccessRequests } from "../db/access-store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const signInPath = chatGPTSignInPath("/");
  const signOutPath = chatGPTSignOutPath("/");
  if (!user) {
    return <AccessGate user={null} status="signed-out" signInPath={signInPath} signOutPath={signOutPath} />;
  }

  const identity = { email: user.email, displayName: user.displayName };
  const access = await getTrackerAccess(identity);
  if (access.status !== "approved") {
    redirect("/signup");
  }

  const pendingCount = access.isOwner
    ? (await listTrackerAccessRequests()).filter((request) => request.status === "pending").length
    : 0;
  return (
    <DriveDashboard
      currentUser={identity}
      isOwner={access.isOwner}
      pendingAccessCount={pendingCount}
      signOutPath={signOutPath}
    />
  );
}
