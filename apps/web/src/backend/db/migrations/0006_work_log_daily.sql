DROP INDEX `work_log_user_week_uidx`;
--> statement-breakpoint
ALTER TABLE `work_log` RENAME COLUMN `week_start` TO `day`;
