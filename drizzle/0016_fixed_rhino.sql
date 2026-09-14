CREATE TABLE `session_presences` (
	`sessionKey` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','admin') NOT NULL,
	`lastSeen` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_presences_sessionKey` PRIMARY KEY(`sessionKey`)
);
--> statement-breakpoint
ALTER TABLE `session_presences` ADD CONSTRAINT `session_presences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `session_presences_last_seen_idx` ON `session_presences` (`lastSeen`);--> statement-breakpoint
CREATE INDEX `session_presences_role_last_seen_idx` ON `session_presences` (`role`,`lastSeen`);