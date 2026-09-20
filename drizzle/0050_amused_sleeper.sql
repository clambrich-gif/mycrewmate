CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int,
	`eventName` varchar(200) NOT NULL,
	`module` varchar(80) NOT NULL,
	`action` enum('created','updated','deleted','reset','imported','copied') NOT NULL,
	`subject` varchar(500) NOT NULL,
	`actorUserId` int,
	`actorName` varchar(200) NOT NULL,
	`actorRole` enum('user','admin') NOT NULL,
	`actorLoginMethod` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `session_presences` ADD `sessionName` varchar(200) DEFAULT 'Unbekannt' NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_logs_event_created_idx` ON `activity_logs` (`eventId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `activity_logs_year_created_idx` ON `activity_logs` (`year`,`createdAt`);