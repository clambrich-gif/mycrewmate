ALTER TABLE `events` ADD `activeDays` json;--> statement-breakpoint
UPDATE `events` SET `activeDays` = JSON_ARRAY('Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag') WHERE `activeDays` IS NULL;--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `activeDays` json NOT NULL;--> statement-breakpoint
ALTER TABLE `helpers` ADD `availMon` enum('ja','nein','vielleicht') DEFAULT 'vielleicht' NOT NULL;--> statement-breakpoint
ALTER TABLE `helpers` ADD `availTue` enum('ja','nein','vielleicht') DEFAULT 'vielleicht' NOT NULL;--> statement-breakpoint
ALTER TABLE `helpers` ADD `availWed` enum('ja','nein','vielleicht') DEFAULT 'vielleicht' NOT NULL;--> statement-breakpoint
ALTER TABLE `helpers` ADD `availThu` enum('ja','nein','vielleicht') DEFAULT 'vielleicht' NOT NULL;
--> statement-breakpoint
UPDATE `helpers` SET `availMon` = 'ja', `availTue` = 'ja', `availWed` = 'ja', `availThu` = 'ja';
