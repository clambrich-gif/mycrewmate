CREATE TABLE `plan_contact_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`contactId` int NOT NULL,
	`initialReleasedAt` timestamp NOT NULL,
	`initialEmailSentAt` timestamp,
	`changePendingAt` timestamp,
	`changeEmailSentAt` timestamp,
	`helpersInformedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plan_contact_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_contact_notifications_event_contact_unique` UNIQUE(`eventId`,`contactId`)
);
--> statement-breakpoint
ALTER TABLE `events` ADD `planReleasedAt` timestamp;--> statement-breakpoint
ALTER TABLE `events` ADD `planLastChangedAt` timestamp;--> statement-breakpoint
ALTER TABLE `plan_contact_notifications` ADD CONSTRAINT `plan_contact_notifications_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plan_contact_notifications` ADD CONSTRAINT `plan_contact_notifications_contact_event_year_fk` FOREIGN KEY (`contactId`,`eventId`,`year`) REFERENCES `contacts`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `plan_contact_notifications_pending_idx` ON `plan_contact_notifications` (`eventId`,`changePendingAt`,`helpersInformedAt`);