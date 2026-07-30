"use client";

import { FormEvent, useState } from "react";

export function AccessForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not unlock the tracker.");
      }
      window.location.assign("/");
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "Could not unlock the tracker.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="access-form" onSubmit={unlock}>
      <label htmlFor="tracker-password">Password</label>
      <input
        id="tracker-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Enter password"
        autoFocus
        required
      />
      {error ? <p className="access-error" role="alert">{error}</p> : null}
      <button className="button button-primary access-submit" disabled={submitting}>
        {submitting ? "Checking…" : "Open tracking system"}
      </button>
    </form>
  );
}
