import { redirect } from "next/navigation";
import { AccessAdmin } from "../AccessAdmin";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getTrackerAccess, listTrackerAccessRequests } from "../../db/access-store";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const user = await requireChatGPTUser("/access");
  const identity = { email: user.email, displayName: user.displayName };
  const access = await getTrackerAccess(identity);
  if (!access.isOwner) redirect("/");
  return (
    <AccessAdmin
      owner={identity}
      initialRequests={await listTrackerAccessRequests()}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
