CREATE TABLE `deletion_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`entityType` enum('helper','cake') NOT NULL,
	`entityId` int NOT NULL,
	`entityLabel` varchar(300) NOT NULL,
	`action` enum('single_delete','area_reset','year_reset') NOT NULL,
	`actorUserId` int NOT NULL,
	`actorName` varchar(200) NOT NULL,
	`actorRole` enum('user','admin') NOT NULL,
	`actorLoginMethod` varchar(64),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deletion_audit_logs_id` PRIMARY KEY(`id`)
);
