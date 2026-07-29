import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const drives = sqliteTable("drives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  driveNumber: text("drive_number").notNull().unique(),
  label: text("label").notNull().default(""),
  date: text("date").notNull(),
  status: text("status").notNull().default("ready"),
  totalGb: integer("total_gb").notNull(),
  spaceLeftGb: integer("space_left_gb").notNull(),
  contents: text("contents").notNull().default(""),
  deletePermission: text("delete_permission").notNull().default("ask"),
  location: text("location").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
