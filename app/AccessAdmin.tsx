"use client";

import { useMemo, useState } from "react";
import type { AccessRequestRecord } from "../db/access-store";

type AccessAdminProps = {
  owner: { email: string; displayName: string };
  initialRequests: AccessRequestRecord[];
  signOutPath: string;
  preview?: boolean;
};

function formatRequestDate(value: string) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AccessAdmin({ owner, initialRequests, signOutPath, preview = false }: AccessAdminProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [busyEmail, setBusyEmail] = useState("");
  const [error, setError] = useState("");
  const visible = useMemo(
    () => requests.filter((request) => filter === "all" || request.status === filter),
    [filter, requests],
  );
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  async function decide(email: string, decision: "approved" | "rejected") {
    setBusyEmail(email);
    setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/access", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, decision }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not update access.");
      }
      setRequests((current) => current.map((request) =>
        request.email === email
          ? {
              ...request,
              status: decision,
              reviewedAt: new Date().toISOString(),
              reviewedBy: owner.email,
            }
          : request,
      ));
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Could not update access.");
    } finally {
      setBusyEmail("");
    }
  }

  return (
    <div className="approval-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">4DV Studio</span>
        </a>
        <div className="account-cluster">
          <div className="account-copy"><strong>{owner.displayName}</strong><span>{owner.email}</span></div>
          <a className="button button-small" href={signOutPath}>Sign out</a>
        </div>
      </header>
      <main className="approval-main">
        <div className="approval-heading">
          <div>
            <p className="access-kicker">Owner controls</p>
            <h1>Access requests</h1>
            <p>Approve only people who should be able to view and edit studio drive records.</p>
          </div>
          <a className="button" href="/">← Back to tracker</a>
        </div>
        <div className="approval-summary">
          <strong>{pendingCount}</strong>
          <span>request{pendingCount === 1 ? "" : "s"} waiting for review</span>
        </div>
        <div className="approval-filters" aria-label="Filter access requests">
          {(["pending", "approved", "rejected", "all"] as const).map((value) => (
            <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        {error ? <div className="error-banner" role="alert">{error}</div> : null}
        <section className="approval-list">
          {visible.length ? visible.map((request) => (
            <article className="approval-request" key={request.email}>
              <div className="approval-avatar" aria-hidden="true">
                {(request.displayName || request.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="approval-person">
                <strong>{request.displayName || "Unnamed user"}</strong>
                <span>{request.email}</span>
                <small>Requested {formatRequestDate(request.requestedAt)}</small>
              </div>
              <p className="approval-note">{request.note || "No access note provided."}</p>
              <span className={`approval-status approval-status-${request.status}`}>{request.status}</span>
              <div className="approval-actions">
                <button
                  className="button button-small"
                  disabled={busyEmail === request.email || request.status === "rejected"}
                  onClick={() => void decide(request.email, "rejected")}
                >Reject</button>
                <button
                  className="button button-primary button-small"
                  disabled={busyEmail === request.email || request.status === "approved"}
                  onClick={() => void decide(request.email, "approved")}
                >Approve</button>
              </div>
            </article>
          )) : <div className="approval-empty">No {filter === "all" ? "" : `${filter} `}access requests.</div>}
        </section>
      </main>
    </div>
  );
}
