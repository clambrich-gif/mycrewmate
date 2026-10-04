CREATE TABLE `wbt_training_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`trackId` enum('helper','admin') NOT NULL,
	`createdByOpenId` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wbt_training_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `wbt_training_links_token_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `wbt_training_links_expiry_idx` ON `wbt_training_links` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `wbt_training_links_creator_idx` ON `wbt_training_links` (`createdByOpenId`,`createdAt`);