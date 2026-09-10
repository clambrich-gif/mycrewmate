CREATE TABLE `app_settings` (
	`id` int NOT NULL DEFAULT 1,
	`eventName` varchar(200) NOT NULL DEFAULT 'MyEifelRide',
	`eventYear` varchar(16) NOT NULL DEFAULT '2026',
	`helperPdfTitle` varchar(200) NOT NULL DEFAULT 'Aufgabenübersicht',
	`blankPlanTitle` varchar(200) NOT NULL DEFAULT 'Einsatzplan – Blanko',
	`contactLabel` varchar(120) NOT NULL DEFAULT 'Ansprechpartner',
	`footerText` varchar(300) NOT NULL DEFAULT '',
	`extraColumns` text NOT NULL,
	`blankRowsPerShift` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_settings` (
	`id` int NOT NULL DEFAULT 1,
	`passwordHash` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `phone` varchar(64);--> statement-breakpoint
ALTER TABLE `helpers` ADD `note` text;