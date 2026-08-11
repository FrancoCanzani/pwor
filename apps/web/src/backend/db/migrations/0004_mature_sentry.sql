DROP TABLE `event`;--> statement-breakpoint
DROP TABLE `inbox_item`;--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
DROP TABLE `work_log`;--> statement-breakpoint
DROP TABLE `workspace_inbox`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_vault_item` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`category_id` text,
	`kind` text DEFAULT 'file' NOT NULL,
	`title` text,
	`summary` text,
	`tags` text,
	`language` text,
	`r2_key` text,
	`mime_type` text,
	`url` text,
	`site_name` text,
	`content` text,
	`extracted_markdown` text,
	`parse_status` text,
	`parse_error` text,
	`parsed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `vault_category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_vault_item`("id", "user_id", "project_id", "category_id", "kind", "title", "summary", "tags", "language", "r2_key", "mime_type", "url", "site_name", "content", "extracted_markdown", "parse_status", "parse_error", "parsed_at", "created_at", "updated_at") SELECT "id", "user_id", "project_id", "category_id", "kind", "title", "summary", "tags", "language", "r2_key", "mime_type", "url", "site_name", "content", "extracted_markdown", "parse_status", "parse_error", "parsed_at", "created_at", "updated_at" FROM `vault_item`;--> statement-breakpoint
DROP TABLE `vault_item`;--> statement-breakpoint
ALTER TABLE `__new_vault_item` RENAME TO `vault_item`;--> statement-breakpoint
PRAGMA foreign_keys=ON;