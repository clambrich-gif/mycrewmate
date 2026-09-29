ALTER TABLE `events` ADD `status` enum('active','closed') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `closedAt` timestamp;