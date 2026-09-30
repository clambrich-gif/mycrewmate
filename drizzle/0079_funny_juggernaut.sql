ALTER TABLE `post_tasks` ADD `helperId` int;--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD `helperId` int;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD CONSTRAINT `post_tasks_helperId_helpers_id_fk` FOREIGN KEY (`helperId`) REFERENCES `helpers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD CONSTRAINT `prep_tasks_helperId_helpers_id_fk` FOREIGN KEY (`helperId`) REFERENCES `helpers`(`id`) ON DELETE set null ON UPDATE no action;