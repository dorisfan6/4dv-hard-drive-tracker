"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DriveStatus = "waiting" | "processing" | "processed";
type DeletePermission = "clear" | "ask" | "protected";
type Brand = "samsung" | "sandisk" | "other";
type LocationType = "4dv-studio" | "data-center" | "other";
type Filter = "all" | DriveStatus;
type ModalTab = "details" | "history";
type PageTab = "inventory" | "history";
type HistoryFilter =
  | "all"
  | "status"
  | "location"
  | "contents"
  | "capacity"
  | "permission"
  | "brand"
  | "photo";

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
  brand: Brand;
  customBrand: string;
  locationType: LocationType;
  location: string;
  note: string;
  photoKey: string;
  photoName: string;
  photoType: string;
  photoUrl: string;
  updatedAt: string;
};

type DriveForm = {
  driveNumber: string;
  label: string;
  date: string;
  status: DriveStatus;
  totalGb: number;
  spaceLeftGb: number;
  contents: string;
  deletePermission: DeletePermission;
  brand: Brand;
  customBrand: string;
  locationType: LocationType;
  location: string;
  note: string;
};

type BulkForm = {
  changeStatus: boolean;
  status: DriveStatus;
  changeLocation: boolean;
  locationType: LocationType;
  location: string;
  changePermission: boolean;
  deletePermission: DeletePermission;
  changeBrand: boolean;
  brand: Brand;
  customBrand: string;
};

type HistoryChange = {
  field: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
};

type HistoryEntry = {
  id: number;
  action: string;
  summary: string;
  changes: HistoryChange[];
  beforeSnapshot: string;
  afterSnapshot: string;
  createdAt: string;
};

type GlobalHistoryEntry = HistoryEntry & {
  driveId: number;
  driveNumber: string;
  driveLabel: string;
};

type GlobalHistoryRow = {
  id: string;
  driveId: number;
  driveNumber: string;
  driveLabel: string;
  field: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
  createdAt: string;
};

const blankForm: DriveForm = {
  driveNumber: "",
  label: "",
  date: new Date().toISOString().slice(0, 10),
  status: "waiting",
  totalGb: 4000,
  spaceLeftGb: 4000,
  contents: "",
  deletePermission: "ask",
  brand: "samsung",
  customBrand: "",
  locationType: "4dv-studio",
  location: "4DV Studio",
  note: "",
};

const blankBulkForm: BulkForm = {
  changeStatus: false,
  status: "waiting",
  changeLocation: false,
  locationType: "4dv-studio",
  location: "4DV Studio",
  changePermission: false,
  deletePermission: "ask",
  changeBrand: false,
  brand: "samsung",
  customBrand: "",
};

const statusLabels: Record<DriveStatus, string> = {
  waiting: "Waiting to be processed",
  processing: "Processing",
  processed: "Processed",
};

const deleteLabels: Record<DeletePermission, string> = {
  clear: "Clear",
  ask: "Ask first",
  protected: "Protected",
};

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All drives" },
  { value: "waiting", label: "Waiting" },
  { value: "processing", label: "Processing" },
  { value: "processed", label: "Processed" },
];

const historyFilters: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "status", label: "Status" },
  { value: "location", label: "Location" },
  { value: "contents", label: "Contents" },
  { value: "capacity", label: "Capacity" },
  { value: "permission", label: "Delete permission" },
  { value: "brand", label: "Brand" },
  { value: "photo", label: "Photo" },
];

const historyFieldGroups: Record<string, Exclude<HistoryFilter, "all">> = {
  status: "status",
  location: "location",
  locationType: "location",
  contents: "contents",
  totalGb: "capacity",
  spaceLeftGb: "capacity",
  deletePermission: "permission",
  brand: "brand",
  customBrand: "brand",
  photoName: "photo",
};

function formatStorage(gb: number) {
  if (gb >= 1000) {
    const tb = gb / 1000;
    return `${Number.isInteger(tb) ? tb.toFixed(0) : tb.toFixed(1)} TB`;
  }
  return `${Math.round(gb)} GB`;
}

function toDate(value: string, withTime = false) {
  if (!value) return "—";
  const normalized = value.includes("T")
    ? value
    : withTime
      ? `${value.replace(" ", "T")}Z`
      : `${value.slice(0, 10)}T12:00:00`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(normalized));
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

function brandLabel(drive: Pick<Drive, "brand" | "customBrand">) {
  if (drive.brand === "samsung") return "Samsung";
  if (drive.brand === "sandisk") return "SanDisk";
  return drive.customBrand || "Other";
}

function DriveIdentity({ drive }: { drive: Drive }) {
  return (
    <div className="drive-id">
      {drive.photoUrl ? (
        <img
          className="drive-thumbnail"
          src={drive.photoUrl}
          alt={`${drive.driveNumber} hard drive`}
        />
      ) : (
        <span className="drive-glyph" aria-hidden="true" />
      )}
      <div>
        <div className="drive-number">{drive.driveNumber}</div>
        <div className="drive-label">{drive.label || "Unlabeled drive"}</div>
        <div className="drive-brand">{brandLabel(drive)}</div>
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

function DeletePill({ permission }: { permission: DeletePermission }) {
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

function historyValue(field: string, value: string | number | null) {
  if (value === null || value === "") return "Empty";
  if (field === "status") {
    return statusLabels[value as DriveStatus] || String(value);
  }
  if (field === "brand") {
    return value === "samsung"
      ? "Samsung"
      : value === "sandisk"
        ? "SanDisk"
        : "Other";
  }
  if (field === "locationType") {
    return value === "4dv-studio"
      ? "4DV Studio"
      : value === "data-center"
        ? "Data Center"
        : "Other";
  }
  if (field === "totalGb" || field === "spaceLeftGb") {
    return formatStorage(Number(value));
  }
  if (field === "deletePermission") {
    return deleteLabels[value as DeletePermission] || String(value);
  }
  return String(value);
}

function baselineContents(entry: HistoryEntry) {
  try {
    const snapshot = JSON.parse(entry.afterSnapshot || "{}") as {
      contents?: string;
    };
    return snapshot.contents || "No contents recorded";
  } catch {
    return "Starting record saved";
  }
}

export function DriveDashboard() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePageTab, setActivePageTab] = useState<PageTab>("inventory");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [fitSize, setFitSize] = useState(500);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("details");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DriveForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [globalHistory, setGlobalHistory] = useState<GlobalHistoryEntry[]>([]);
  const [globalHistoryLoading, setGlobalHistoryLoading] = useState(false);
  const [globalHistoryLoaded, setGlobalHistoryLoaded] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [selectedDriveIds, setSelectedDriveIds] = useState<number[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkForm>(blankBulkForm);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");

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

  async function loadHistory(driveId: number) {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/drives?historyFor=${driveId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        history?: HistoryEntry[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not load history.");
      setHistory(payload.history || []);
    } catch (historyError) {
      setFormError(
        historyError instanceof Error
          ? historyError.message
          : "Could not load history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadGlobalHistory() {
    setGlobalHistoryLoading(true);
    try {
      setError("");
      const response = await fetch("/api/drives?history=all", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        history?: GlobalHistoryEntry[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not load activity history.");
      }
      setGlobalHistory(payload.history || []);
      setGlobalHistoryLoaded(true);
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Could not load activity history.",
      );
    } finally {
      setGlobalHistoryLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDrives(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activePageTab !== "history" || globalHistoryLoaded) return;
    const timer = window.setTimeout(() => void loadGlobalHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [activePageTab, globalHistoryLoaded]);

  useEffect(() => {
    if (!modalOpen && !bulkModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (bulkModalOpen) setBulkModalOpen(false);
      else setModalOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [bulkModalOpen, modalOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  const stats = useMemo(() => {
    const totalCapacity = drives.reduce((sum, drive) => sum + drive.totalGb, 0);
    const totalFree = drives.reduce((sum, drive) => sum + drive.spaceLeftGb, 0);
    return {
      total: drives.length,
      free: totalFree,
      waiting: drives.filter((drive) => drive.status === "waiting").length,
      processing: drives.filter((drive) => drive.status === "processing").length,
      processed: drives.filter((drive) => drive.status === "processed").length,
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
            drive.status !== "processing" &&
            drive.deletePermission !== "protected" &&
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
          brandLabel(drive),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesFilter = filter === "all" || drive.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [drives, filter, search]);

  const allVisibleSelected =
    filteredDrives.length > 0 &&
    filteredDrives.every((drive) => selectedDriveIds.includes(drive.id));

  const globalHistoryRows = useMemo<GlobalHistoryRow[]>(() => {
    const rows = globalHistory.flatMap((entry) => {
      if (entry.changes.length) {
        return entry.changes.map((change) => ({
          id: `${entry.id}-${change.field}`,
          driveId: entry.driveId,
          driveNumber: entry.driveNumber,
          driveLabel: entry.driveLabel,
          field: change.field,
          label: `${change.label} changed`,
          before: change.before,
          after: change.after,
          createdAt: entry.createdAt,
        }));
      }
      return [
        {
          id: `${entry.id}-${entry.action}`,
          driveId: entry.driveId,
          driveNumber: entry.driveNumber,
          driveLabel: entry.driveLabel,
          field: "record",
          label: entry.summary,
          before: null,
          after: baselineContents(entry),
          createdAt: entry.createdAt,
        },
      ];
    });
    const query = historySearch.trim().toLowerCase();
    return rows.filter((row) => {
      const group = historyFieldGroups[row.field];
      const matchesFilter =
        historyFilter === "all" || group === historyFilter;
      const matchesSearch =
        !query ||
        [
          row.driveNumber,
          row.driveLabel,
          row.label,
          historyValue(row.field, row.before),
          historyValue(row.field, row.after),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [globalHistory, historyFilter, historySearch]);

  function clearPhotoPreview() {
    if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoPreview("");
    setPhotoFile(null);
  }

  function closeModal() {
    clearPhotoPreview();
    setModalOpen(false);
  }

  function openNew() {
    clearPhotoPreview();
    setEditingId(null);
    setModalTab("details");
    setHistory([]);
    setFormError("");
    setForm({ ...blankForm, date: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  }

  function openEdit(drive: Drive) {
    clearPhotoPreview();
    setEditingId(drive.id);
    setModalTab("details");
    setHistory([]);
    setFormError("");
    setPhotoPreview(drive.photoUrl);
    setForm({
      driveNumber: drive.driveNumber,
      label: drive.label,
      date: drive.date.slice(0, 10),
      status: drive.status,
      totalGb: drive.totalGb,
      spaceLeftGb: drive.spaceLeftGb,
      contents: drive.contents,
      deletePermission: drive.deletePermission,
      brand: drive.brand,
      customBrand: drive.customBrand,
      locationType: drive.locationType,
      location: drive.location,
      note: drive.note,
    });
    setModalOpen(true);
    void loadHistory(drive.id);
  }

  function updateField<K extends keyof DriveForm>(
    key: K,
    value: DriveForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateBulkField<K extends keyof BulkForm>(
    key: K,
    value: BulkForm[K],
  ) {
    setBulkForm((current) => ({ ...current, [key]: value }));
  }

  function toggleDriveSelection(driveId: number) {
    setSelectedDriveIds((current) =>
      current.includes(driveId)
        ? current.filter((id) => id !== driveId)
        : [...current, driveId],
    );
  }

  function toggleAllVisible() {
    const visibleIds = filteredDrives.map((drive) => drive.id);
    setSelectedDriveIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return [...new Set([...current, ...visibleIds])];
    });
  }

  function openBulkEdit() {
    if (!selectedDriveIds.length) return;
    setBulkError("");
    setBulkForm({ ...blankBulkForm });
    setBulkModalOpen(true);
  }

  async function saveBulkChanges(event: FormEvent) {
    event.preventDefault();
    setBulkError("");
    const updates: Record<string, string> = {};
    if (bulkForm.changeStatus) updates.status = bulkForm.status;
    if (bulkForm.changeLocation) {
      if (bulkForm.locationType === "other" && !bulkForm.location.trim()) {
        setBulkError("Enter the custom physical location.");
        return;
      }
      updates.locationType = bulkForm.locationType;
      updates.location =
        bulkForm.locationType === "4dv-studio"
          ? "4DV Studio"
          : bulkForm.locationType === "data-center"
            ? "Data Center"
            : bulkForm.location.trim();
    }
    if (bulkForm.changePermission) {
      updates.deletePermission = bulkForm.deletePermission;
    }
    if (bulkForm.changeBrand) {
      if (bulkForm.brand === "other" && !bulkForm.customBrand.trim()) {
        setBulkError("Enter the custom drive brand.");
        return;
      }
      updates.brand = bulkForm.brand;
      updates.customBrand =
        bulkForm.brand === "other" ? bulkForm.customBrand.trim() : "";
    }
    if (!Object.keys(updates).length) {
      setBulkError("Choose at least one field to change.");
      return;
    }

    setBulkSaving(true);
    try {
      const response = await fetch("/api/drives", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedDriveIds, updates }),
      });
      const payload = (await response.json()) as {
        changedCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not update the selected drives.");
      }
      await loadDrives();
      if (globalHistoryLoaded) await loadGlobalHistory();
      setBulkModalOpen(false);
      setSelectedDriveIds([]);
      const count = payload.changedCount ?? 0;
      setToast(`${count} drive${count === 1 ? "" : "s"} updated · history saved`);
    } catch (bulkSaveError) {
      setBulkError(
        bulkSaveError instanceof Error
          ? bulkSaveError.message
          : "Could not update the selected drives.",
      );
    } finally {
      setBulkSaving(false);
    }
  }

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    setFormError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFormError("Please choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setFormError("Photo must be 8 MB or smaller.");
      return;
    }
    if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveDrive(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/drives", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const payload = (await response.json()) as {
        id?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not save drive.");
      const savedId = editingId || payload.id;
      if (!savedId) throw new Error("Drive saved, but its id is unavailable.");

      if (photoFile) {
        const photoData = new FormData();
        photoData.set("driveId", String(savedId));
        photoData.set("photo", photoFile);
        const photoResponse = await fetch("/api/drives/photo", {
          method: "POST",
          body: photoData,
        });
        const photoPayload = (await photoResponse.json()) as { error?: string };
        if (!photoResponse.ok) {
          throw new Error(
            `Drive details were saved, but the photo failed: ${photoPayload.error || "upload error"}`,
          );
        }
      }

      await loadDrives();
      if (globalHistoryLoaded) await loadGlobalHistory();
      setSelectedDriveIds((current) =>
        current.filter((id) => id !== editingId),
      );
      closeModal();
      setToast(editingId ? "Drive updated · history saved" : "Drive added");
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : "Could not save drive.",
      );
      await loadDrives();
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
      if (globalHistoryLoaded) await loadGlobalHistory();
      setSelectedDriveIds((current) =>
        current.filter((id) => id !== editingId),
      );
      closeModal();
      setToast("Drive removed from inventory");
    } catch (deleteError) {
      setFormError(
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
          <span className="brand-name">4DV Studio</span>
        </div>
        <div className="topbar-actions">
          <div className="sync-status">
            <span className="sync-dot" aria-hidden="true" />
            <span>History tracking on</span>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="page-heading">
          <div>
            <h1>Hard Drive Tracking System</h1>
            <p>Drive inventory, storage availability, and change history.</p>
          </div>
          <button className="button button-primary" onClick={openNew}>
            <span aria-hidden="true">＋</span> Add hard drive
          </button>
        </section>

        <nav className="page-tabs" aria-label="Hard drive tracking views">
          <button
            className="page-tab"
            aria-current={activePageTab === "inventory" ? "page" : undefined}
            onClick={() => setActivePageTab("inventory")}
          >
            Inventory <span>{drives.length}</span>
          </button>
          <button
            className="page-tab"
            aria-current={activePageTab === "history" ? "page" : undefined}
            onClick={() => setActivePageTab("history")}
          >
            History
          </button>
        </nav>

        {activePageTab === "inventory" ? (
          <div className="page-panel">

        <section className="stats-grid" aria-label="Storage overview">
          <article className="stat-card">
            <div className="stat-label">
              Total drives <span className="stat-index">01</span>
            </div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-caption">registered with full history</div>
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
              Processing <span className="stat-index">03</span>
            </div>
            <div className="stat-value">{stats.processing}</div>
            <div className="stat-caption">{stats.waiting} waiting in queue</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">
              Processed <span className="stat-index">04</span>
            </div>
            <div className="stat-value">{stats.processed}</div>
            <div className="stat-caption">finished processing</div>
          </article>
        </section>

        <section className="fit-panel" id="fit-checker">
          <div>
            <h2 className="fit-title">Will the new file fit?</h2>
            <p className="fit-copy">
              Enter its size and see non-processing drives with enough room.
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
              <span className="fit-empty">No available drive has enough room.</span>
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
                placeholder="Search drive #, contents, brand, location or note…"
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

          <div className={`bulk-bar ${selectedDriveIds.length ? "bulk-bar-active" : ""}`}>
            <label className="bulk-select-all">
              <input
                className="selection-checkbox"
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                disabled={!filteredDrives.length}
              />
              <span>
                {selectedDriveIds.length
                  ? `${selectedDriveIds.length} drive${selectedDriveIds.length === 1 ? "" : "s"} selected`
                  : "Select multiple drives"}
              </span>
            </label>
            <div className="bulk-actions">
              {selectedDriveIds.length ? (
                <button
                  className="bulk-clear"
                  onClick={() => setSelectedDriveIds([])}
                >
                  Clear selection
                </button>
              ) : null}
              <button
                className="button button-primary button-small"
                onClick={openBulkEdit}
                disabled={!selectedDriveIds.length}
              >
                Edit selected
              </button>
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
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "4%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th aria-label="Select all visible drives">
                        <input
                          className="selection-checkbox"
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                        />
                      </th>
                      <th>Hard drive # / brand</th>
                      <th>Status</th>
                      <th>Contents / 里面有什么</th>
                      <th>Space left</th>
                      <th>Can delete?</th>
                      <th>Location</th>
                      <th>Updated</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrives.map((drive) => (
                      <tr
                        className={selectedDriveIds.includes(drive.id) ? "row-selected" : ""}
                        key={drive.id}
                      >
                        <td>
                          <input
                            className="selection-checkbox"
                            type="checkbox"
                            checked={selectedDriveIds.includes(drive.id)}
                            onChange={() => toggleDriveSelection(drive.id)}
                            aria-label={`Select ${drive.driveNumber}`}
                          />
                        </td>
                        <td><DriveIdentity drive={drive} /></td>
                        <td><StatusPill status={drive.status} /></td>
                        <td>
                          <div className="content-list">
                            {contentTags(drive.contents).map((tag) => (
                              <span className="content-tag" key={tag}>{tag}</span>
                            ))}
                          </div>
                          {drive.note ? <div className="cell-subtle">{drive.note}</div> : null}
                        </td>
                        <td><Capacity drive={drive} /></td>
                        <td><DeletePill permission={drive.deletePermission} /></td>
                        <td><span className="cell-subtle">{drive.location || "—"}</span></td>
                        <td><span className="cell-subtle">{toDate(drive.updatedAt, true)}</span></td>
                        <td>
                          <button
                            className="row-action"
                            onClick={() => openEdit(drive)}
                            aria-label={`View ${drive.driveNumber} details and history`}
                          >→</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mobile-cards">
                  {filteredDrives.map((drive) => (
                    <article
                      className={`mobile-card ${selectedDriveIds.includes(drive.id) ? "mobile-card-selected" : ""}`}
                      key={drive.id}
                    >
                      <div className="mobile-top">
                        <div className="mobile-select-identity">
                          <input
                            className="selection-checkbox"
                            type="checkbox"
                            checked={selectedDriveIds.includes(drive.id)}
                            onChange={() => toggleDriveSelection(drive.id)}
                            aria-label={`Select ${drive.driveNumber}`}
                          />
                          <DriveIdentity drive={drive} />
                        </div>
                        <button
                          className="row-action"
                          onClick={() => openEdit(drive)}
                          aria-label={`View ${drive.driveNumber} details and history`}
                        >→</button>
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
                          <span className="mobile-meta-label">Location</span>
                          <span className="cell-subtle">{drive.location || "—"}</span>
                        </div>
                      </div>
                      <div className="mobile-content">
                        <span className="mobile-meta-label">Contents</span>
                        <div className="content-list">
                          {contentTags(drive.contents).map((tag) => (
                            <span className="content-tag" key={tag}>{tag}</span>
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
          </div>
        ) : (
          <section className="global-history">
            <div className="section-head history-section-head">
              <div>
                <h2 className="section-title">Drive history</h2>
                <p className="section-kicker">
                  Important changes across every hard drive · {globalHistoryRows.length} events shown
                </p>
              </div>
              <button
                className="button button-ghost"
                onClick={() => void loadGlobalHistory()}
                disabled={globalHistoryLoading}
              >
                {globalHistoryLoading ? "Refreshing…" : "Refresh history"}
              </button>
            </div>

            <div className="history-toolbar">
              <label className="search-box">
                <input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Search drive number, event or value…"
                  aria-label="Search drive history"
                />
              </label>
              <label className="history-filter-wrap">
                <span>Event</span>
                <select
                  value={historyFilter}
                  onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)}
                  aria-label="Filter history by event"
                >
                  {historyFilters.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button className="button button-small" onClick={() => void loadGlobalHistory()}>
                  Try again
                </button>
              </div>
            ) : null}

            <div className="table-wrap history-table-wrap">
              {globalHistoryLoading && !globalHistoryLoaded ? (
                <div className="loading-state">Loading drive history…</div>
              ) : globalHistoryRows.length === 0 ? (
                <div className="empty-state">No important changes match this view.</div>
              ) : (
                <table className="global-history-table">
                  <thead>
                    <tr>
                      <th>Date &amp; time</th>
                      <th>Hard drive</th>
                      <th>Event</th>
                      <th>Previous</th>
                      <th>New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalHistoryRows.map((row) => {
                      const drive = drives.find((item) => item.id === row.driveId);
                      return (
                        <tr key={row.id}>
                          <td><time>{toDate(row.createdAt, true)}</time></td>
                          <td>
                            <button
                              className="history-drive-link"
                              onClick={() => drive && openEdit(drive)}
                              disabled={!drive}
                            >
                              <strong>{row.driveNumber}</strong>
                              <span>{row.driveLabel || "Unlabeled drive"}</span>
                            </button>
                          </td>
                          <td>
                            <span className={`event-chip event-${historyFieldGroups[row.field] || "record"}`}>
                              {row.label}
                            </span>
                          </td>
                          <td className="history-old-value">
                            {row.before === null ? "—" : historyValue(row.field, row.before)}
                          </td>
                          <td className="history-new-value">{historyValue(row.field, row.after)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="history-note">
              This view keeps the signal clear by showing status, location, contents,
              capacity, brand, and photo changes. Full details remain available inside each drive record.
            </p>
          </section>
        )}
      </main>

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <aside className="modal" role="dialog" aria-modal="true" aria-labelledby="drive-form-title">
            <div className="modal-head">
              <div>
                <p className="modal-kicker">
                  {editingId ? form.driveNumber : "Register storage"}
                </p>
                <h2 className="modal-title" id="drive-form-title">
                  {editingId ? "Drive record" : "Add hard drive"}
                </h2>
              </div>
              <button className="modal-close" onClick={closeModal} aria-label="Close form">×</button>
            </div>

            {editingId ? (
              <div className="modal-tabs" role="tablist" aria-label="Drive record views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={modalTab === "details"}
                  onClick={() => setModalTab("details")}
                >Drive details</button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={modalTab === "history"}
                  onClick={() => setModalTab("history")}
                >History <span>{history.length}</span></button>
              </div>
            ) : null}

            {formError ? <div className="modal-error" role="alert">{formError}</div> : null}

            {modalTab === "details" ? (
              <form onSubmit={saveDrive}>
                <div className="photo-field field-full">
                  <div className="photo-preview">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Selected hard drive" />
                    ) : (
                      <span className="photo-placeholder" aria-hidden="true">PHOTO</span>
                    )}
                  </div>
                  <div>
                    <p className="photo-title">Drive photo</p>
                    <p className="photo-copy">JPG, PNG or WebP · maximum 8 MB</p>
                    <label className="button button-small button-ghost photo-button">
                      {photoPreview ? "Replace photo" : "Upload photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => choosePhoto(event.target.files?.[0])}
                      />
                    </label>
                    {photoFile ? <p className="photo-name">{photoFile.name}</p> : null}
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="drive-number">Hard drive # *</label>
                    <input
                      id="drive-number"
                      required
                      value={form.driveNumber}
                      onChange={(event) => updateField("driveNumber", event.target.value)}
                      placeholder="e.g. BR-07"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="drive-label">Label / name</label>
                    <input
                      id="drive-label"
                      value={form.label}
                      onChange={(event) => updateField("label", event.target.value)}
                      placeholder="e.g. SHUTTLE B"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="status">Processing status</label>
                    <select
                      id="status"
                      value={form.status}
                      onChange={(event) => updateField("status", event.target.value as DriveStatus)}
                    >
                      <option value="waiting">Waiting to be processed</option>
                      <option value="processing">Processing</option>
                      <option value="processed">Processed</option>
                    </select>
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
                    <label htmlFor="brand">Brand / model</label>
                    <select
                      id="brand"
                      value={form.brand}
                      onChange={(event) => updateField("brand", event.target.value as Brand)}
                    >
                      <option value="samsung">Samsung</option>
                      <option value="sandisk">SanDisk</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {form.brand === "other" ? (
                    <div className="field">
                      <label htmlFor="custom-brand">Other brand / model</label>
                      <input
                        id="custom-brand"
                        value={form.customBrand}
                        onChange={(event) => updateField("customBrand", event.target.value)}
                        placeholder="e.g. LaCie, G-Drive"
                      />
                    </div>
                  ) : (
                    <div className="field">
                      <label htmlFor="delete-permission">Can delete?</label>
                      <select
                        id="delete-permission"
                        value={form.deletePermission}
                        onChange={(event) => updateField("deletePermission", event.target.value as DeletePermission)}
                      >
                        <option value="clear">Clear — safe to delete</option>
                        <option value="ask">Ask first</option>
                        <option value="protected">Protected — do not delete</option>
                      </select>
                    </div>
                  )}
                  {form.brand === "other" ? (
                    <div className="field field-full compact-field">
                      <label htmlFor="delete-permission-other">Can delete?</label>
                      <select
                        id="delete-permission-other"
                        value={form.deletePermission}
                        onChange={(event) => updateField("deletePermission", event.target.value as DeletePermission)}
                      >
                        <option value="clear">Clear — safe to delete</option>
                        <option value="ask">Ask first</option>
                        <option value="protected">Protected — do not delete</option>
                      </select>
                    </div>
                  ) : null}
                  <div className="field">
                    <label htmlFor="total-space">Total storage (GB)</label>
                    <input
                      id="total-space"
                      type="number"
                      min="1"
                      required
                      value={form.totalGb}
                      onChange={(event) => updateField("totalGb", Number(event.target.value))}
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
                      onChange={(event) => updateField("spaceLeftGb", Number(event.target.value))}
                    />
                  </div>
                  <div className="field field-full">
                    <label htmlFor="contents">Contents / 里面有什么</label>
                    <textarea
                      id="contents"
                      value={form.contents}
                      onChange={(event) => updateField("contents", event.target.value)}
                      placeholder="Separate projects or folders with commas"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="location-type">Physical location</label>
                    <select
                      id="location-type"
                      value={form.locationType}
                      onChange={(event) => updateField("locationType", event.target.value as LocationType)}
                    >
                      <option value="4dv-studio">4DV Studio</option>
                      <option value="data-center">Data Center</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {form.locationType === "other" ? (
                    <div className="field">
                      <label htmlFor="custom-location">Other location</label>
                      <input
                        id="custom-location"
                        value={form.location}
                        onChange={(event) => updateField("location", event.target.value)}
                        placeholder="Enter physical location"
                      />
                    </div>
                  ) : (
                    <div className="field field-readout">
                      <label>Selected location</label>
                      <div>{form.locationType === "4dv-studio" ? "4DV Studio" : "Data Center"}</div>
                    </div>
                  )}
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
                    <button type="button" className="button button-danger" onClick={deleteDrive} disabled={saving}>
                      Remove record
                    </button>
                  ) : null}
                  <div className="footer-actions">
                    <button type="button" className="button button-ghost" onClick={closeModal}>Cancel</button>
                    <button type="submit" className="button button-primary" disabled={saving}>
                      {saving ? "Saving…" : "Save drive"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <section className="history-panel" aria-label="Drive update history">
                <div className="history-intro">
                  <p>Automatic timeline</p>
                  <span>Every saved change keeps the previous value for reference.</span>
                </div>
                {historyLoading ? (
                  <div className="history-empty">Loading history…</div>
                ) : history.length ? (
                  <ol className="history-list">
                    {history.map((entry) => (
                      <li className="history-entry" key={entry.id}>
                        <div className="history-marker" aria-hidden="true" />
                        <article>
                          <div className="history-meta">
                            <strong>{entry.summary}</strong>
                            <time>{toDate(entry.createdAt, true)}</time>
                          </div>
                          {entry.changes.length ? (
                            <div className="history-changes">
                              {entry.changes.map((change) => (
                                <div className="history-change" key={`${entry.id}-${change.field}`}>
                                  <span className="history-field">{change.label}</span>
                                  <div className="history-values">
                                    <span>{historyValue(change.field, change.before)}</span>
                                    <b aria-hidden="true">→</b>
                                    <span>{historyValue(change.field, change.after)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="history-baseline">
                              <span>Stored contents at this point</span>
                              <strong>{baselineContents(entry)}</strong>
                            </div>
                          )}
                        </article>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="history-empty">No history has been recorded yet.</div>
                )}
              </section>
            )}
          </aside>
        </div>
      ) : null}

      {bulkModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !bulkSaving) {
              setBulkModalOpen(false);
            }
          }}
        >
          <aside
            className="modal bulk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-edit-title"
          >
            <div className="modal-head">
              <div>
                <p className="modal-kicker">{selectedDriveIds.length} selected drives</p>
                <h2 className="modal-title" id="bulk-edit-title">Edit selected drives</h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setBulkModalOpen(false)}
                aria-label="Close bulk editor"
                disabled={bulkSaving}
              >×</button>
            </div>

            <div className="bulk-drive-summary">
              {drives
                .filter((drive) => selectedDriveIds.includes(drive.id))
                .map((drive) => (
                  <span key={drive.id}>{drive.driveNumber}</span>
                ))}
            </div>

            <p className="bulk-help">
              Check only the fields you want to apply. Unchecked fields will stay unchanged.
            </p>

            {bulkError ? <div className="modal-error" role="alert">{bulkError}</div> : null}

            <form className="bulk-form" onSubmit={saveBulkChanges}>
              <section className={`bulk-option ${bulkForm.changeStatus ? "bulk-option-enabled" : ""}`}>
                <label className="bulk-option-toggle">
                  <input
                    className="selection-checkbox"
                    type="checkbox"
                    checked={bulkForm.changeStatus}
                    onChange={(event) => updateBulkField("changeStatus", event.target.checked)}
                  />
                  <span>Status</span>
                </label>
                <select
                  value={bulkForm.status}
                  onChange={(event) => updateBulkField("status", event.target.value as DriveStatus)}
                  disabled={!bulkForm.changeStatus}
                  aria-label="New status for selected drives"
                >
                  <option value="waiting">Waiting to be processed</option>
                  <option value="processing">Processing</option>
                  <option value="processed">Processed</option>
                </select>
              </section>

              <section className={`bulk-option ${bulkForm.changeLocation ? "bulk-option-enabled" : ""}`}>
                <label className="bulk-option-toggle">
                  <input
                    className="selection-checkbox"
                    type="checkbox"
                    checked={bulkForm.changeLocation}
                    onChange={(event) => updateBulkField("changeLocation", event.target.checked)}
                  />
                  <span>Physical location</span>
                </label>
                <div className="bulk-option-controls">
                  <select
                    value={bulkForm.locationType}
                    onChange={(event) => updateBulkField("locationType", event.target.value as LocationType)}
                    disabled={!bulkForm.changeLocation}
                    aria-label="New location for selected drives"
                  >
                    <option value="4dv-studio">4DV Studio</option>
                    <option value="data-center">Data Center</option>
                    <option value="other">Other</option>
                  </select>
                  {bulkForm.locationType === "other" ? (
                    <input
                      value={bulkForm.location}
                      onChange={(event) => updateBulkField("location", event.target.value)}
                      disabled={!bulkForm.changeLocation}
                      placeholder="Enter physical location"
                      aria-label="Custom location for selected drives"
                    />
                  ) : null}
                </div>
              </section>

              <section className={`bulk-option ${bulkForm.changePermission ? "bulk-option-enabled" : ""}`}>
                <label className="bulk-option-toggle">
                  <input
                    className="selection-checkbox"
                    type="checkbox"
                    checked={bulkForm.changePermission}
                    onChange={(event) => updateBulkField("changePermission", event.target.checked)}
                  />
                  <span>Can delete?</span>
                </label>
                <select
                  value={bulkForm.deletePermission}
                  onChange={(event) => updateBulkField("deletePermission", event.target.value as DeletePermission)}
                  disabled={!bulkForm.changePermission}
                  aria-label="New delete permission for selected drives"
                >
                  <option value="clear">Clear — safe to delete</option>
                  <option value="ask">Ask first</option>
                  <option value="protected">Protected — do not delete</option>
                </select>
              </section>

              <section className={`bulk-option ${bulkForm.changeBrand ? "bulk-option-enabled" : ""}`}>
                <label className="bulk-option-toggle">
                  <input
                    className="selection-checkbox"
                    type="checkbox"
                    checked={bulkForm.changeBrand}
                    onChange={(event) => updateBulkField("changeBrand", event.target.checked)}
                  />
                  <span>Brand</span>
                </label>
                <div className="bulk-option-controls">
                  <select
                    value={bulkForm.brand}
                    onChange={(event) => updateBulkField("brand", event.target.value as Brand)}
                    disabled={!bulkForm.changeBrand}
                    aria-label="New brand for selected drives"
                  >
                    <option value="samsung">Samsung</option>
                    <option value="sandisk">SanDisk</option>
                    <option value="other">Other</option>
                  </select>
                  {bulkForm.brand === "other" ? (
                    <input
                      value={bulkForm.customBrand}
                      onChange={(event) => updateBulkField("customBrand", event.target.value)}
                      disabled={!bulkForm.changeBrand}
                      placeholder="Enter drive brand"
                      aria-label="Custom brand for selected drives"
                    />
                  ) : null}
                </div>
              </section>

              <div className="modal-footer bulk-footer">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={bulkSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={bulkSaving}>
                  {bulkSaving
                    ? "Updating…"
                    : `Update ${selectedDriveIds.length} drive${selectedDriveIds.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
