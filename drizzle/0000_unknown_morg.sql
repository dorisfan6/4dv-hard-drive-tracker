CREATE TABLE `app_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`drive_number` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`total_gb` integer NOT NULL,
	`space_left_gb` integer NOT NULL,
	`contents` text DEFAULT '' NOT NULL,
	`delete_permission` text DEFAULT 'ask' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drives_drive_number_unique` ON `drives` (`drive_number`);