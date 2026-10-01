CREATE TABLE `protected_helper_pdf_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`accessCodeHash` varchar(64) NOT NULL,
	`helperId` int NOT NULL,
	`viewMode` enum('minimal','team') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `protected_helper_pdf_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `protected_helper_pdf_shares_token_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `sharePhoneInHelperPlan` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `protected_helper_pdf_shares` ADD CONSTRAINT `protected_helper_pdf_shares_helper_id_fk` FOREIGN KEY (`helperId`) REFERENCES `helpers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `protected_helper_pdf_shares_expiry_idx` ON `protected_helper_pdf_shares` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `protected_helper_pdf_shares_helper_idx` ON `protected_helper_pdf_shares` (`helperId`,`expiresAt`);