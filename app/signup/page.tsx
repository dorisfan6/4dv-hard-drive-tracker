import { redirect } from "next/navigation";
import { AccessGate } from "../AccessGate";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";
import { getTrackerAccess } from "../../db/access-store";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const user = await getChatGPTUser();
  const signInPath = chatGPTSignInPath("/signup");
  const signOutPath = chatGPTSignOutPath("/signup");

  if (!user) {
    return (
      <AccessGate
        user={null}
        status="signed-out"
        signInPath={signInPath}
        signOutPath={signOutPath}
        mode="signup"
      />
    );
  }

  const identity = { email: user.email, displayName: user.displayName };
  const access = await getTrackerAccess(identity);
  if (access.status === "approved") redirect("/");

  return (
    <AccessGate
      user={identity}
      status={access.status}
      signInPath={signInPath}
      signOutPath={signOutPath}
      mode="signup"
    />
  );
}
