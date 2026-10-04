CREATE TABLE `plan_contact_helper_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`contactId` int NOT NULL,
	`helperId` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_contact_helper_changes_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_contact_helper_changes_unique` UNIQUE(`eventId`,`contactId`,`helperId`)
);
--> statement-breakpoint
ALTER TABLE `plan_contact_helper_changes` ADD CONSTRAINT `plan_contact_helper_changes_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plan_contact_helper_changes` ADD CONSTRAINT `plan_contact_helper_changes_contact_event_year_fk` FOREIGN KEY (`contactId`,`eventId`,`year`) REFERENCES `contacts`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plan_contact_helper_changes` ADD CONSTRAINT `plan_contact_helper_changes_helper_event_year_fk` FOREIGN KEY (`helperId`,`eventId`,`year`) REFERENCES `helpers`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `plan_contact_helper_changes_contact_idx` ON `plan_contact_helper_changes` (`eventId`,`contactId`,`changedAt`);