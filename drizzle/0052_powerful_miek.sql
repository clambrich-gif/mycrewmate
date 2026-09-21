CREATE TABLE `team_note_read_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`identityKey` varchar(260) NOT NULL,
	`userId` int,
	`sessionName` varchar(200) NOT NULL,
	`role` enum('user','admin') NOT NULL,
	`lastReadAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_note_read_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_note_read_states_event_identity_unique` UNIQUE(`eventId`,`identityKey`)
);
--> statement-breakpoint
ALTER TABLE `team_note_read_states` ADD CONSTRAINT `team_note_read_states_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_note_read_states` ADD CONSTRAINT `team_note_read_states_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `team_note_read_states_event_read_idx` ON `team_note_read_states` (`eventId`,`lastReadAt`);