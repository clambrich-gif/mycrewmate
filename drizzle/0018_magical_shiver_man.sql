CREATE TABLE `team_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`senderUserId` int,
	`senderName` varchar(200) NOT NULL,
	`senderRole` enum('user','admin') NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `team_notes` ADD CONSTRAINT `team_notes_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_notes` ADD CONSTRAINT `team_notes_senderUserId_users_id_fk` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `team_notes_event_created_idx` ON `team_notes` (`eventId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `team_notes_event_id_idx` ON `team_notes` (`eventId`,`id`);