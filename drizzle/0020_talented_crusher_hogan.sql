CREATE TABLE `revoked_sessions` (
	`sessionKey` varchar(64) NOT NULL,
	`reason` enum('logout','security_reset') NOT NULL,
	`revokedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revoked_sessions_sessionKey` PRIMARY KEY(`sessionKey`)
);
--> statement-breakpoint
CREATE TABLE `team_note_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int,
	`eventName` varchar(200) NOT NULL,
	`action` enum('clear') NOT NULL,
	`deletedCount` int NOT NULL DEFAULT 0,
	`actorUserId` int NOT NULL,
	`actorName` varchar(200) NOT NULL,
	`actorRole` enum('admin') NOT NULL,
	`actorLoginMethod` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_note_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `security_settings` ADD `planningTeamSessionVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminSessionVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `team_note_audit_logs` ADD CONSTRAINT `team_note_audit_logs_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `revoked_sessions_revoked_at_idx` ON `revoked_sessions` (`revokedAt`);--> statement-breakpoint
CREATE INDEX `team_note_audit_logs_event_created_idx` ON `team_note_audit_logs` (`eventId`,`createdAt`);