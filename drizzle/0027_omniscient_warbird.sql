ALTER TABLE `prep_tasks` MODIFY COLUMN `status` enum('offen','inArbeit','erledigt','abgelehnt') NOT NULL DEFAULT 'offen';--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD `category` varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD `statusWording` enum('aufgabe','genehmigung') DEFAULT 'aufgabe' NOT NULL;