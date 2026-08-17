import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const drives = sqliteTable("drives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  driveNumber: text("drive_number").notNull().unique(),
  label: text("label").notNull().default(""),
  date: text("date").notNull(),
  status: text("status").notNull().default("waiting"),
  totalGb: integer("total_gb").notNull(),
  spaceLeftGb: integer("space_left_gb").notNull(),
  contents: text("contents").notNull().default(""),
  deletePermission: text("delete_permission").notNull().default("ask"),
  brand: text("brand").notNull().default("other"),
  customBrand: text("custom_brand").notNull().default(""),
  locationType: text("location_type").notNull().default("other"),
  location: text("location").notNull().default(""),
  note: text("note").notNull().default(""),
  photoKey: text("photo_key").notNull().default(""),
  photoName: text("photo_name").notNull().default(""),
  photoType: text("photo_type").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const driveHistory = sqliteTable(
  "drive_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    driveId: integer("drive_id").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    changesJson: text("changes_json").notNull().default("[]"),
    beforeSnapshot: text("before_snapshot").notNull().default(""),
    afterSnapshot: text("after_snapshot").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("drive_history_drive_id_idx").on(table.driveId)],
);

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const trackerUsers = sqliteTable(
  "tracker_users",
  {
    email: text("email").primaryKey(),
    displayName: text("display_name").notNull().default(""),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("pending"),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull().default(""),
  },
  (table) => [index("tracker_users_status_idx").on(table.status, table.requestedAt)],
);
