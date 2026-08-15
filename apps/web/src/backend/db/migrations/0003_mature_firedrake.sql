ALTER TABLE `note` ADD `item_id` text REFERENCES item(id);--> statement-breakpoint
ALTER TABLE `note` ADD `color` text;--> statement-breakpoint
ALTER TABLE `note` ADD `anchor_from` integer;--> statement-breakpoint
ALTER TABLE `note` ADD `anchor_to` integer;--> statement-breakpoint
ALTER TABLE `note` ADD `anchor_quote` text;--> statement-breakpoint
ALTER TABLE `note` ADD `anchor_prefix` text;--> statement-breakpoint
ALTER TABLE `note` ADD `anchor_suffix` text;--> statement-breakpoint
ALTER TABLE `note` ADD `anchor_patch` text;--> statement-breakpoint
CREATE INDEX `note_item` ON `note` (`item_id`);