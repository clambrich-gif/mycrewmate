CREATE TABLE `team_note_typings` (
	`sessionKey` varchar(64) NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`userId` int,
	`senderName` varchar(200) NOT NULL,
	`senderRole` enum('user','admin') NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_note_typings_sessionKey` PRIMARY KEY(`sessionKey`)
);
--> statement-breakpoint
ALTER TABLE `team_notes` ADD `important` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `team_note_typings` ADD CONSTRAINT `team_note_typings_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_note_typings` ADD CONSTRAINT `team_note_typings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `team_note_typings_event_updated_idx` ON `team_note_typings` (`eventId`,`updatedAt`);