CREATE TABLE `backup_restore_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int,
	`eventName` varchar(200) NOT NULL,
	`sourceFilename` varchar(255) NOT NULL,
	`backupExportedAt` varchar(40) NOT NULL,
	`actorUserId` int NOT NULL,
	`actorName` varchar(200) NOT NULL,
	`actorRole` enum('user','admin') NOT NULL,
	`actorLoginMethod` varchar(64),
	`createdCount` int NOT NULL DEFAULT 0,
	`updatedCount` int NOT NULL DEFAULT 0,
	`deletedCount` int NOT NULL DEFAULT 0,
	`beforeDigest` varchar(64) NOT NULL,
	`afterDigest` varchar(64) NOT NULL,
	`workbookDigest` varchar(64) NOT NULL,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backup_restore_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `backup_restore_logs` ADD CONSTRAINT `backup_restore_logs_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE set null ON UPDATE no action;