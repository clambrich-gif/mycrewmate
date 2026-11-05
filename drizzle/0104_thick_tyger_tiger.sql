CREATE TABLE `financeReceipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`eventId` int NOT NULL,
	`category` varchar(160) NOT NULL,
	`title` varchar(160) NOT NULL,
	`paidBy` varchar(160) NOT NULL,
	`fileName` varchar(200) NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financeReceipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `financeReceipts` ADD CONSTRAINT `financeReceipts_event_year_fk` FOREIGN KEY (`eventId`,`year`) REFERENCES `events`(`id`,`year`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `financeReceipts_event_category_idx` ON `financeReceipts` (`eventId`,`year`,`category`);