ALTER TABLE `materials` ADD `status` enum('offen','bestellt','geliefert') DEFAULT 'offen' NOT NULL;--> statement-breakpoint
UPDATE `materials` SET `status` = CASE WHEN `ordered` = 'ja' THEN 'geliefert' ELSE 'offen' END;--> statement-breakpoint
ALTER TABLE `materials` DROP COLUMN `ordered`;
