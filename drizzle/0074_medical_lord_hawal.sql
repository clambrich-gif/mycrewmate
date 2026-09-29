CREATE TABLE `public_demo_source_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('cycling_event','club_event','recommendation','online','other') NOT NULL,
	`eventLabel` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `public_demo_source_selections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `public_demo_source_created_idx` ON `public_demo_source_selections` (`source`,`createdAt`);