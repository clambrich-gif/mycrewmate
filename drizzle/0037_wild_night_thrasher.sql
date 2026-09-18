ALTER TABLE `deletion_audit_logs` MODIFY COLUMN `entityType` enum('helper','cake','prep') NOT NULL;--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD `deleted` boolean DEFAULT false NOT NULL;