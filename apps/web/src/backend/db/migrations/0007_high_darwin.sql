DROP TABLE `inbox_item`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_vault_item` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`kind` text DEFAULT 'file' NOT NULL,
	`type` text,
	`title` text,
	`r2_key` text,
	`mime_type` text,
	`url` text,
	`site_name` text,
	`ocr_text` text,
	`extracted` text,
	`expires_at` integer,
	`reminded_at` integer,
	`error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_vault_item`("id", "user_id", "status", "kind", "type", "title", "r2_key", "mime_type", "url", "site_name", "ocr_text", "extracted", "expires_at", "reminded_at", "error", "created_at", "updated_at") SELECT "id", "user_id", "status", "kind", "type", "title", "r2_key", "mime_type", "url", "site_name", "ocr_text", "extracted", "expires_at", "reminded_at", "error", "created_at", "updated_at" FROM `vault_item`;--> statement-breakpoint
DROP TABLE `vault_item`;--> statement-breakpoint
ALTER TABLE `__new_vault_item` RENAME TO `vault_item`;--> statement-breakpoint
PRAGMA foreign_keys=ON;