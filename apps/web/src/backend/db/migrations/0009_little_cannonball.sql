PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `workspace` RENAME TO `space`;--> statement-breakpoint
ALTER TABLE `item` RENAME COLUMN `workspace_id` TO `space_id`;--> statement-breakpoint
ALTER TABLE `note` RENAME COLUMN `workspace_id` TO `space_id`;--> statement-breakpoint
ALTER TABLE `space` DROP COLUMN `shader`;--> statement-breakpoint
ALTER TABLE `space` DROP COLUMN `status`;--> statement-breakpoint
DROP INDEX `item_workspace`;--> statement-breakpoint
CREATE INDEX `item_space` ON `item` (`space_id`);--> statement-breakpoint
DROP INDEX `note_workspace`;--> statement-breakpoint
CREATE INDEX `note_space` ON `note` (`space_id`);
