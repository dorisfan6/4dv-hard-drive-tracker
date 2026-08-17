"use client";

import { FormEvent, useState } from "react";
import type { AccessStatus } from "../db/access-store";

type AccessGateProps = {
  user: { email: string; displayName: string } | null;
  status: AccessStatus | "signed-out";
  signInPath: string;
  signOutPath: string;
  mode?: "login" | "signup";
};

export function AccessGate({
  user,
  status: initialStatus,
  signInPath,
  signOutPath,
  mode = "login",
}: AccessGateProps) {
  const [status, setStatus] = useState(initialStatus);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function requestAccess(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, note }),
      });
      const payload = (await response.json()) as {
        access?: { status: AccessStatus };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not submit request.");
      setStatus(payload.access?.status || "pending");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = status === "pending";
  const rejected = status === "rejected";

  return (
    <main className="access-shell">
      <section className="access-brand-panel">
        <div className="access-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>4DV Studio</span>
        </div>
        <div className="access-brand-copy">
          <p className="access-eyebrow">Secure studio operations</p>
          <h1>Hard Drive<br />Tracking System</h1>
          <p>
            One approved workspace for drive inventory, available capacity,
            processing status, photos, and change history.
          </p>
        </div>
        <div className="access-brand-foot">4DV Studio · Internal access only</div>
      </section>

      <section className="access-card-panel">
        <div className="access-card">
          {status === "signed-out" ? (
            <>
              {mode === "signup" ? (
                <>
                  <div className="access-icon" aria-hidden="true">＋</div>
                  <p className="access-kicker">New workspace account</p>
                  <h2>Create your account</h2>
                  <p className="access-copy">
                    First confirm your email identity. Then you can
                    complete your profile and send it to the tracker owner for approval.
                  </p>
                  <a className="button button-primary access-primary" href={signInPath}>
                    Continue to sign up
                  </a>
                  <p className="access-switch">Already registered? <a href="/">Log in</a></p>
                </>
              ) : (
                <>
                  <div className="access-icon" aria-hidden="true">↗</div>
                  <p className="access-kicker">Email sign in</p>
                  <h2>Welcome back</h2>
                  <p className="access-copy">
                    Log in with your approved email account to open the hard drive tracker.
                  </p>
                  <a className="button button-primary access-primary" href={signInPath}>
                    Log in with email account
                  </a>
                  <div className="access-divider"><span>New to the tracker?</span></div>
                  <a className="button access-primary access-secondary" href="/signup">
                    Create an account
                  </a>
                  <p className="access-security">No separate tracker password is stored.</p>
                </>
              )}
            </>
          ) : pending ? (
            <>
              <div className="access-state-dot access-state-pending" aria-hidden="true" />
              <p className="access-kicker">Request received</p>
              <h2>Waiting for owner approval</h2>
              <p className="access-copy">
                Your request for <strong>{user?.email}</strong> is in the approval queue.
                You can enter the tracker as soon as the owner approves it.
              </p>
              <button className="button access-primary" onClick={() => window.location.reload()}>
                Check approval status
              </button>
              <a className="access-link" href={signOutPath}>Use a different account</a>
              <a className="access-link" href="/">Back to log in</a>
            </>
          ) : (
            <>
              <div className={`access-state-dot ${rejected ? "access-state-rejected" : ""}`} aria-hidden="true" />
              <p className="access-kicker">{rejected ? "Request not approved" : "New account"}</p>
              <h2>{rejected ? "Request access again" : "Register for access"}</h2>
              <p className="access-copy">
                The tracker owner reviews every new registration before drive data becomes available.
              </p>
              <form className="access-form" onSubmit={requestAccess}>
                <label>
                  <span>Name</span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input value={user?.email || ""} readOnly aria-readonly="true" />
                </label>
                <label>
                  <span>Why do you need access? <em>Optional</em></span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                    placeholder="Team, project, or responsibility"
                  />
                </label>
                {error ? <p className="access-error" role="alert">{error}</p> : null}
                <button className="button button-primary access-primary" disabled={submitting}>
                  {submitting ? "Submitting…" : "Request owner approval"}
                </button>
              </form>
              <a className="access-link" href={signOutPath}>Use a different account</a>
              <a className="access-link" href="/">Back to log in</a>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
