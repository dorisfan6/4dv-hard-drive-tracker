CREATE TABLE `drive_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`drive_id` integer NOT NULL,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`changes_json` text DEFAULT '[]' NOT NULL,
	`before_snapshot` text DEFAULT '' NOT NULL,
	`after_snapshot` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `drive_history_drive_id_idx` ON `drive_history` (`drive_id`);
--> statement-breakpoint
ALTER TABLE `drives` ADD `brand` text DEFAULT 'other' NOT NULL;
--> statement-breakpoint
ALTER TABLE `drives` ADD `custom_brand` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `drives` ADD `location_type` text DEFAULT 'other' NOT NULL;
--> statement-breakpoint
ALTER TABLE `drives` ADD `photo_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `drives` ADD `photo_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `drives` ADD `photo_type` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `drives`
SET `status` = CASE `status`
	WHEN 'in-use' THEN 'processing'
	WHEN 'ready' THEN 'waiting'
	WHEN 'full' THEN 'processed'
	WHEN 'archive' THEN 'processed'
	WHEN 'needs-review' THEN 'waiting'
	ELSE `status`
END
WHERE `status` IN ('in-use', 'ready', 'full', 'archive', 'needs-review');
