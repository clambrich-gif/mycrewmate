CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_year_name_unique` UNIQUE(`year`,`name`)
);
--> statement-breakpoint
INSERT IGNORE INTO `events` (`year`, `name`, `sortOrder`)
SELECT `year`, 'MyEifelRide', 0 FROM `event_years`;
--> statement-breakpoint
ALTER TABLE `contacts` DROP INDEX `contacts_year_name_unique`;
--> statement-breakpoint
ALTER TABLE `helpers` DROP INDEX `helpers_year_name_unique`;
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` DROP INDEX `shift_area_contacts_year_area_unique`;
--> statement-breakpoint
ALTER TABLE `app_settings` ADD `logoKey` varchar(500);
--> statement-breakpoint
ALTER TABLE `app_settings` ADD `logoUrl` varchar(700);
--> statement-breakpoint
UPDATE `app_settings`
SET `logoKey` = 'rsc-eifelland-logo_ee4e2325.png',
    `logoUrl` = '/manus-storage/rsc-eifelland-logo_ee4e2325.png'
WHERE `id` = 1;
--> statement-breakpoint
ALTER TABLE `approvals` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `cakes` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `contacts` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `eventName` varchar(200);
--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `restoredAt` timestamp;
--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `restoredByUserId` int;
--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `restoredByName` varchar(200);
--> statement-breakpoint
ALTER TABLE `finances` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `helpers` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `marketing` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `materials` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `post_tasks` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` ADD `eventId` int;
--> statement-breakpoint
ALTER TABLE `shifts` ADD `eventId` int;
--> statement-breakpoint
UPDATE `approvals` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `cakes` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `contacts` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `deletion_audit_logs` t JOIN `events` e ON e.`year` = t.`year`
SET t.`eventId` = e.`id`, t.`eventName` = e.`name`;
--> statement-breakpoint
UPDATE `finances` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `helpers` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `marketing` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `materials` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `post_tasks` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `prep_tasks` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `shift_area_contacts` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
UPDATE `shifts` t JOIN `events` e ON e.`year` = t.`year` SET t.`eventId` = e.`id`;
--> statement-breakpoint
ALTER TABLE `approvals` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `cakes` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `contacts` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `finances` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `helpers` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `marketing` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `post_tasks` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `prep_tasks` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `shifts` MODIFY COLUMN `eventId` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_event_name_unique` UNIQUE(`eventId`,`name`);
--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_event_name_unique` UNIQUE(`eventId`,`name`);
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` ADD CONSTRAINT `shift_area_contacts_event_area_unique` UNIQUE(`eventId`,`area`);
--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `cakes` ADD CONSTRAINT `cakes_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD CONSTRAINT `deletion_audit_logs_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `finances` ADD CONSTRAINT `finances_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `marketing` ADD CONSTRAINT `marketing_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `post_tasks` ADD CONSTRAINT `post_tasks_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD CONSTRAINT `prep_tasks_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` ADD CONSTRAINT `shift_area_contacts_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;
