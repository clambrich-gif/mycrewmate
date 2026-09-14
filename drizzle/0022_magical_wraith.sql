ALTER TABLE `approvals` DROP FOREIGN KEY `approvals_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `cakes` DROP FOREIGN KEY `cakes_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `contacts` DROP FOREIGN KEY `contacts_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `finances` DROP FOREIGN KEY `finances_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `helpers` DROP FOREIGN KEY `helpers_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `helpers` DROP FOREIGN KEY `helpers_contactId_contacts_id_fk`;
--> statement-breakpoint
ALTER TABLE `marketing` DROP FOREIGN KEY `marketing_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `materials` DROP FOREIGN KEY `materials_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `post_tasks` DROP FOREIGN KEY `post_tasks_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `prep_tasks` DROP FOREIGN KEY `prep_tasks_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` DROP FOREIGN KEY `shift_area_contacts_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `shift_area_contacts` DROP FOREIGN KEY `shift_area_contacts_contactId_contacts_id_fk`;
--> statement-breakpoint
ALTER TABLE `shifts` DROP FOREIGN KEY `shifts_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `team_note_typings` DROP FOREIGN KEY `team_note_typings_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `team_notes` DROP FOREIGN KEY `team_notes_eventId_events_id_fk`;
--> statement-breakpoint
ALTER TABLE `assignments` ADD `year` int NULL;--> statement-breakpoint
ALTER TABLE `assignments` ADD `eventId` int NULL;--> statement-breakpoint
UPDATE `assignments` AS `a`
INNER JOIN `shifts` AS `s` ON `s`.`id` = `a`.`shiftId`
SET `a`.`year` = `s`.`year`, `a`.`eventId` = `s`.`eventId`;--> statement-breakpoint
ALTER TABLE `assignments` MODIFY `year` int NOT NULL;--> statement-breakpoint
ALTER TABLE `assignments` MODIFY `eventId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_id_event_year_unique` UNIQUE(`id`,`eventId`,`year`);--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_id_year_unique` UNIQUE(`id`,`year`);--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_id_event_year_unique` UNIQUE(`id`,`eventId`,`year`);--> statement-breakpoint
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_id_event_year_unique` UNIQUE(`id`,`eventId`,`year`);--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_shift_event_year_fk` FOREIGN KEY (`shiftId`,`eventId`,`year`) REFERENCES `shifts`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_helper_event_year_fk` FOREIGN KEY (`helperId`,`eventId`,`year`) REFERENCES `helpers`(`id`,`eventId`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cakes` ADD CONSTRAINT `cakes_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_year_fk` FOREIGN KEY (`year`) REFERENCES `event_years`(`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finances` ADD CONSTRAINT `finances_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_contact_event_year_fk` FOREIGN KEY (`contactId`,`eventId`,`year`) REFERENCES `contacts`(`id`,`eventId`,`year`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing` ADD CONSTRAINT `marketing_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD CONSTRAINT `post_tasks_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD CONSTRAINT `prep_tasks_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_area_contacts` ADD CONSTRAINT `shift_area_contacts_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_area_contacts` ADD CONSTRAINT `shift_area_contacts_contact_event_year_fk` FOREIGN KEY (`contactId`,`eventId`,`year`) REFERENCES `contacts`(`id`,`eventId`,`year`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_note_typings` ADD CONSTRAINT `team_note_typings_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_notes` ADD CONSTRAINT `team_notes_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;
