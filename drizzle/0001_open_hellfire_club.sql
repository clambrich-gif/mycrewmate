CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request` varchar(300) NOT NULL,
	`contactId` int,
	`status` enum('offen','beantragt','genehmigt','abgelehnt') NOT NULL DEFAULT 'offen',
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shiftId` int NOT NULL,
	`helperId` int NOT NULL,
	`slot` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cakes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donor` varchar(200) NOT NULL,
	`cake` varchar(200) NOT NULL DEFAULT '',
	`dropoffTime` varchar(60) NOT NULL DEFAULT '',
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `cakes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(160) NOT NULL,
	`incomeCents` int NOT NULL DEFAULT 0,
	`expenseCents` int NOT NULL DEFAULT 0,
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `finances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `helpers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int,
	`name` varchar(200) NOT NULL,
	`email` varchar(320),
	`phone` varchar(64),
	`willHelp` enum('ja','nein') NOT NULL DEFAULT 'ja',
	`availFri` enum('ja','nein','vielleicht') NOT NULL DEFAULT 'vielleicht',
	`availSat` enum('ja','nein','vielleicht') NOT NULL DEFAULT 'vielleicht',
	`availSun` enum('ja','nein','vielleicht') NOT NULL DEFAULT 'vielleicht',
	`confirmed` enum('ja','nein') NOT NULL DEFAULT 'nein',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `helpers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`measure` varchar(300) NOT NULL,
	`channel` varchar(160) NOT NULL DEFAULT '',
	`contactId` int,
	`status` enum('offen','inArbeit','erledigt') NOT NULL DEFAULT 'offen',
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `marketing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`article` varchar(300) NOT NULL,
	`category` varchar(120) NOT NULL DEFAULT '',
	`quantity` varchar(40) NOT NULL DEFAULT '',
	`unit` varchar(40) NOT NULL DEFAULT '',
	`contactId` int,
	`ordered` enum('ja','nein') NOT NULL DEFAULT 'nein',
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task` varchar(300) NOT NULL,
	`contactId` int,
	`status` enum('offen','inArbeit','erledigt') NOT NULL DEFAULT 'offen',
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `post_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prep_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task` varchar(300) NOT NULL,
	`contactId` int,
	`status` enum('offen','inArbeit','erledigt') NOT NULL DEFAULT 'offen',
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `prep_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` enum('Freitag','Samstag','Sonntag') NOT NULL,
	`area` varchar(200) NOT NULL,
	`task` varchar(300) NOT NULL,
	`startTime` varchar(16) NOT NULL DEFAULT '',
	`endTime` varchar(16) NOT NULL DEFAULT '',
	`needed` int NOT NULL DEFAULT 1,
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shifts_id` PRIMARY KEY(`id`)
);
