ALTER TABLE `note` ADD `embed_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `note` ADD `embedded_at` integer;--> statement-breakpoint
ALTER TABLE `item` ADD `embed_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `item` ADD `embedded_at` integer;