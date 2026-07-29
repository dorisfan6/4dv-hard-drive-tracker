"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DriveStatus =
  | "ready"
  | "in-use"
  | "full"
  | "archive"
  | "needs-review";

type DeletePermission = "clear" | "ask" | "protected";

type Drive = {
  id: number;
  driveNumber: string;
  label: string;
  date: string;
  status: DriveStatus;
  totalGb: number;
  spaceLeftGb: number;
  contents: string;
  deletePermission: DeletePermission;
  location: string;
  note: string;
  updatedAt: string;
};

type DriveForm = Omit<Drive, "id" | "updatedAt">;
type Filter = "all" | "ready" | "review" | "can-fit";

const blankForm: DriveForm = {
  driveNumber: "",
  label: "",
  date: new Date().toISOString().slice(0, 10),
  status: "ready",
  totalGb: 4000,
  spaceLeftGb: 4000,
  contents: "",
  deletePermission: "ask",
  location: "",
  note: "",
};

const statusLabels: Record<DriveStatus, string> = {
  ready: "Ready",
  "in-use": "In use",
  full: "Full",
  archive: "Archive",
  "needs-review": "Review",
};

const deleteLabels: Record<DeletePermission, string> = {
  clear: "Clear",
  ask: "Ask first",
  protected: "Protected",
};

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All drives" },
  { value: "ready", label: "Ready" },
  { value: "can-fit", label: "Can take files" },
  { value: "review", label: "Needs review" },
];

function formatStorage(gb: number) {
  if (gb >= 1000) {
    const tb = gb / 1000;
    return `${Number.isInteger(tb) ? tb.toFixed(0) : tb.toFixed(1)} TB`;
  }
  return `${Math.round(gb)} GB`;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function contentTags(contents: string) {
  const tags = contents
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return tags.length ? tags.slice(0, 3) : ["Empty"];
}

function capacityPercent(drive: Drive) {
  if (!drive.totalGb) return 0;
  return Math.min(
    100,
    Math.max(0, ((drive.totalGb - drive.spaceLeftGb) / drive.totalGb) * 100),
  );
}

function DriveIdentity({ drive }: { drive: Drive }) {
  return (
    <div className="drive-id">
      <span className="drive-glyph" aria-hidden="true" />
      <div>
        <div className="drive-number">{drive.driveNumber}</div>
        <div className="drive-label">{drive.label || "Unlabeled drive"}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: DriveStatus }) {
  return (
    <span className={`status-pill status-${status}`}>
      {statusLabels[status]}
    </span>
  );
}

function DeletePill({
  permission,
}: {
  permission: DeletePermission;
}) {
  return (
    <span className={`delete-pill delete-${permission}`}>
      {deleteLabels[permission]}
    </span>
  );
}

function Capacity({ drive }: { drive: Drive }) {
  const used = capacityPercent(drive);
  return (
    <div>
      <div className="capacity-line">
        <strong>{formatStorage(drive.spaceLeftGb)}</strong>
        <span>of {formatStorage(drive.totalGb)}</span>
      </div>
      <div className="progress-track" aria-label={`${Math.round(used)}% used`}>
        <div
          className={`progress-fill ${drive.spaceLeftGb / drive.totalGb < 0.12 ? "progress-low" : ""}`}
          style={{ width: `${used}%` }}
        />
      </div>
    </div>
  );
}

export function DriveDashboard() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [fitSize, setFitSize] = useState(500);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DriveForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function loadDrives() {
    try {
      setError("");
      const response = await fetch("/api/drives", { cache: "no-store" });
      const payload = (await response.json()) as {
        drives?: Drive[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not load drives.");
      setDrives(payload.drives || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the inventory.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDrives();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    const totalCapacity = drives.reduce((sum, drive) => sum + drive.totalGb, 0);
    const totalFree = drives.reduce((sum, drive) => sum + drive.spaceLeftGb, 0);
    return {
      total: drives.length,
      free: totalFree,
      ready: drives.filter((drive) => drive.status === "ready").length,
      review: drives.filter(
        (drive) =>
          drive.status === "needs-review" || drive.deletePermission === "ask",
      ).length,
      usedPercent: totalCapacity
        ? Math.round(((totalCapacity - totalFree) / totalCapacity) * 100)
        : 0,
    };
  }, [drives]);

  const fitCandidates = useMemo(
    () =>
      drives
        .filter(
          (drive) =>
            ["ready", "needs-review"].includes(drive.status) &&
            drive.spaceLeftGb >= Math.max(0, fitSize || 0),
        )
        .sort((a, b) => b.spaceLeftGb - a.spaceLeftGb),
    [drives, fitSize],
  );

  const filteredDrives = useMemo(() => {
    const query = search.trim().toLowerCase();
    return drives.filter((drive) => {
      const matchesSearch =
        !query ||
        [
          drive.driveNumber,
          drive.label,
          drive.contents,
          drive.note,
          drive.location,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "ready" && drive.status === "ready") ||
        (filter === "review" &&
          (drive.status === "needs-review" ||
            drive.deletePermission === "ask")) ||
        (filter === "can-fit" &&
          ["ready", "needs-review"].includes(drive.status) &&
          drive.spaceLeftGb > 0);

      return matchesSearch && matchesFilter;
    });
  }, [drives, filter, search]);

  function openNew() {
    setEditingId(null);
    setForm({ ...blankForm, date: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  }

  function openEdit(drive: Drive) {
    setEditingId(drive.id);
    setForm({
      driveNumber: drive.driveNumber,
      label: drive.label,
      date: drive.date.slice(0, 10),
      status: drive.status,
      totalGb: drive.totalGb,
      spaceLeftGb: drive.spaceLeftGb,
      contents: drive.contents,
      deletePermission: drive.deletePermission,
      location: drive.location,
      note: drive.note,
    });
    setModalOpen(true);
  }

  function updateField<K extends keyof DriveForm>(
    key: K,
    value: DriveForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveDrive(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/drives", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const payload = (await response.json()) as {
        drive?: Drive;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not save drive.");
      await loadDrives();
      setModalOpen(false);
      setToast(editingId ? "Drive updated" : "Drive added");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save drive.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteDrive() {
    if (!editingId) return;
    const confirmed = window.confirm(
      `Remove ${form.driveNumber} from this inventory? This does not delete files from the physical drive.`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch("/api/drives", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not remove drive.");
      await loadDrives();
      setModalOpen(false);
      setToast("Drive removed from inventory");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove drive.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand-copy">
            <span className="brand-name">Drive Ledger</span>
            <span className="brand-subtitle">Production storage register</span>
          </div>
        </div>
        <div className="sync-status">
          <span className="sync-dot" aria-hidden="true" />
          <span>Shared inventory</span>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <div>
            <p className="eyebrow">Burberry Rain · Media Operations</p>
            <h1>
              Know what’s on <em>every drive.</em>
            </h1>
          </div>
          <div className="hero-side">
            <p>
              One source of truth for capacity, contents, and clearance—so the
              team knows what can be deleted and where the next file belongs.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={openNew}>
                <span aria-hidden="true">＋</span> Add hard drive
              </button>
              <a className="button button-ghost" href="#fit-checker">
                Check a file <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </section>

        <section className="stats-grid" aria-label="Storage overview">
          <article className="stat-card">
            <div className="stat-label">
              Total drives <span className="stat-index">01</span>
            </div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-caption">registered in this workspace</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">
              Space left <span className="stat-index">02</span>
            </div>
            <div className="stat-value">{formatStorage(stats.free)}</div>
            <div className="stat-caption">{stats.usedPercent}% used overall</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">
              Ready now <span className="stat-index">03</span>
            </div>
            <div className="stat-value">{stats.ready}</div>
            <div className="stat-caption">can receive new files</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">
              Check first <span className="stat-index">04</span>
            </div>
            <div className="stat-value">{stats.review}</div>
            <div className="stat-caption">need a deletion decision</div>
          </article>
        </section>

        <section className="fit-panel" id="fit-checker">
          <div>
            <h2 className="fit-title">Will the new file fit?</h2>
            <p className="fit-copy">
              Enter its size and see the safest available destinations.
            </p>
          </div>
          <label className="fit-input-wrap">
            <input
              className="fit-input"
              type="number"
              min="0"
              value={fitSize}
              onChange={(event) => setFitSize(Number(event.target.value))}
              aria-label="New file size in gigabytes"
            />
            <span className="fit-unit">GB</span>
          </label>
          <div className="fit-result" aria-live="polite">
            <span className="fit-result-label">Best options</span>
            {fitCandidates.length ? (
              fitCandidates.slice(0, 3).map((drive) => (
                <button
                  className="fit-drive"
                  key={drive.id}
                  onClick={() => openEdit(drive)}
                >
                  <strong>{drive.driveNumber}</strong>
                  <span>{formatStorage(drive.spaceLeftGb)} free</span>
                </button>
              ))
            ) : (
              <span className="fit-empty">No cleared drive has enough room.</span>
            )}
          </div>
        </section>

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="button button-small" onClick={() => void loadDrives()}>
              Try again
            </button>
          </div>
        ) : null}

        <section className="inventory">
          <div className="section-head">
            <div>
              <h2 className="section-title">Drive inventory</h2>
              <p className="section-kicker">
                硬盘清单 · {filteredDrives.length} of {drives.length} shown
              </p>
            </div>
            <button className="button button-ghost" onClick={openNew}>
              ＋ New record
            </button>
          </div>

          <div className="toolbar">
            <label className="search-box">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search drive #, contents, location or note…"
                aria-label="Search drive inventory"
              />
            </label>
            <div className="filter-tabs" aria-label="Filter drives">
              {filters.map((item) => (
                <button
                  className="filter-tab"
                  aria-pressed={filter === item.value}
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div className="loading-state">Loading the drive register…</div>
            ) : filteredDrives.length === 0 ? (
              <div className="empty-state">
                No drives match this view. Try another filter or add a record.
              </div>
            ) : (
              <>
                <table className="drive-table">
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "4%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Hard drive #</th>
                      <th>Status</th>
                      <th>Contents / 里面有什么</th>
                      <th>Space left</th>
                      <th>Can delete?</th>
                      <th>Date</th>
                      <th>Location</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrives.map((drive) => (
                      <tr key={drive.id}>
                        <td>
                          <DriveIdentity drive={drive} />
                        </td>
                        <td>
                          <StatusPill status={drive.status} />
                        </td>
                        <td>
                          <div className="content-list">
                            {contentTags(drive.contents).map((tag) => (
                              <span className="content-tag" key={tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          {drive.note ? (
                            <div className="cell-subtle">{drive.note}</div>
                          ) : null}
                        </td>
                        <td>
                          <Capacity drive={drive} />
                        </td>
                        <td>
                          <DeletePill permission={drive.deletePermission} />
                        </td>
                        <td>
                          <span className="cell-subtle">
                            {formatDate(drive.date)}
                          </span>
                        </td>
                        <td>
                          <span className="cell-subtle">
                            {drive.location || "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="row-action"
                            onClick={() => openEdit(drive)}
                            aria-label={`Edit ${drive.driveNumber}`}
                          >
                            →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mobile-cards">
                  {filteredDrives.map((drive) => (
                    <article className="mobile-card" key={drive.id}>
                      <div className="mobile-top">
                        <DriveIdentity drive={drive} />
                        <button
                          className="row-action"
                          onClick={() => openEdit(drive)}
                          aria-label={`Edit ${drive.driveNumber}`}
                        >
                          →
                        </button>
                      </div>
                      <div className="mobile-meta">
                        <div>
                          <span className="mobile-meta-label">Status</span>
                          <StatusPill status={drive.status} />
                        </div>
                        <div>
                          <span className="mobile-meta-label">Can delete?</span>
                          <DeletePill permission={drive.deletePermission} />
                        </div>
                        <div>
                          <span className="mobile-meta-label">Updated</span>
                          <span className="cell-subtle">
                            {formatDate(drive.date)}
                          </span>
                        </div>
                      </div>
                      <div className="mobile-content">
                        <span className="mobile-meta-label">Contents</span>
                        <div className="content-list">
                          {contentTags(drive.contents).map((tag) => (
                            <span className="content-tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mobile-content">
                        <span className="mobile-meta-label">Capacity</span>
                        <Capacity drive={drive} />
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <aside
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drive-form-title"
          >
            <div className="modal-head">
              <div>
                <p className="modal-kicker">
                  {editingId ? "Update inventory" : "Register storage"}
                </p>
                <h2 className="modal-title" id="drive-form-title">
                  {editingId ? "Edit hard drive" : "Add hard drive"}
                </h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveDrive}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="drive-number">Hard drive # *</label>
                  <input
                    id="drive-number"
                    required
                    value={form.driveNumber}
                    onChange={(event) =>
                      updateField("driveNumber", event.target.value)
                    }
                    placeholder="e.g. BR-07"
                  />
                </div>
                <div className="field">
                  <label htmlFor="drive-label">Label / name</label>
                  <input
                    id="drive-label"
                    value={form.label}
                    onChange={(event) =>
                      updateField("label", event.target.value)
                    }
                    placeholder="e.g. SHUTTLE B"
                  />
                </div>
                <div className="field">
                  <label htmlFor="date">Last checked</label>
                  <input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(event) => updateField("date", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    value={form.status}
                    onChange={(event) =>
                      updateField("status", event.target.value as DriveStatus)
                    }
                  >
                    <option value="ready">Ready for new files</option>
                    <option value="in-use">In use</option>
                    <option value="full">Full</option>
                    <option value="archive">Archive</option>
                    <option value="needs-review">Needs review</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="total-space">Total storage (GB)</label>
                  <input
                    id="total-space"
                    type="number"
                    min="1"
                    required
                    value={form.totalGb}
                    onChange={(event) =>
                      updateField("totalGb", Number(event.target.value))
                    }
                  />
                  <p className="field-hint">1 TB = 1,000 GB</p>
                </div>
                <div className="field">
                  <label htmlFor="space-left">Space left (GB)</label>
                  <input
                    id="space-left"
                    type="number"
                    min="0"
                    max={form.totalGb}
                    required
                    value={form.spaceLeftGb}
                    onChange={(event) =>
                      updateField("spaceLeftGb", Number(event.target.value))
                    }
                  />
                </div>
                <div className="field field-full">
                  <label htmlFor="contents">Contents / 里面有什么</label>
                  <textarea
                    id="contents"
                    value={form.contents}
                    onChange={(event) =>
                      updateField("contents", event.target.value)
                    }
                    placeholder="Separate projects or folders with commas"
                  />
                </div>
                <div className="field">
                  <label htmlFor="delete-permission">Can delete?</label>
                  <select
                    id="delete-permission"
                    value={form.deletePermission}
                    onChange={(event) =>
                      updateField(
                        "deletePermission",
                        event.target.value as DeletePermission,
                      )
                    }
                  >
                    <option value="clear">Clear — safe to delete</option>
                    <option value="ask">Ask first</option>
                    <option value="protected">Protected — do not delete</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="location">Physical location</label>
                  <input
                    id="location"
                    value={form.location}
                    onChange={(event) =>
                      updateField("location", event.target.value)
                    }
                    placeholder="Shelf A · Edit bay"
                  />
                </div>
                <div className="field field-full">
                  <label htmlFor="note">Note</label>
                  <textarea
                    id="note"
                    value={form.note}
                    onChange={(event) => updateField("note", event.target.value)}
                    placeholder="Backup status, owner, handoff details…"
                  />
                </div>
              </div>

              <div className="modal-footer">
                {editingId ? (
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={deleteDrive}
                    disabled={saving}
                  >
                    Remove record
                  </button>
                ) : null}
                <div className="footer-actions">
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save drive"}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
