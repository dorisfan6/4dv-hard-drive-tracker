CREATE TABLE `tracker_users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL,
	`reviewed_by` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tracker_users_status_idx` ON `tracker_users` (`status`,`requested_at`);