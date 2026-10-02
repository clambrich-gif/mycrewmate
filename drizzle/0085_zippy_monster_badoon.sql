ALTER TABLE `events` ADD `retentionHoldReason` enum('tax','contract','insurance','legal','other');--> statement-breakpoint
ALTER TABLE `events` ADD `retentionHoldNote` varchar(500);--> statement-breakpoint
ALTER TABLE `events` ADD `retentionHoldSetAt` timestamp;--> statement-breakpoint
CREATE INDEX `events_retention_cleanup_idx` ON `events` (`status`,`closedAt`,`retentionHoldReason`);