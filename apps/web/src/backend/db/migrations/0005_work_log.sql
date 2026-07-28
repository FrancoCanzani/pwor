CREATE TABLE `work_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`drafted_at` integer,
	`source_task_count` integer DEFAULT 0 NOT NULL,
	`source_note_count` integer DEFAULT 0 NOT NULL,
	`sources` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_log_user_week_uidx` ON `work_log` (`user_id`,`week_start`);
