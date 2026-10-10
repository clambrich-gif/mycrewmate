CREATE TABLE `public_reach_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metric` enum('home_page_view','pilot_page_view','pilot_inquiry_view','club_demo_page_view','club_demo_started','pilot_video_started') NOT NULL,
	`metricDay` date NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_reach_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `public_reach_metrics_metric_day_unique` UNIQUE(`metric`,`metricDay`)
);
--> statement-breakpoint
CREATE INDEX `public_reach_metrics_day_idx` ON `public_reach_metrics` (`metricDay`);