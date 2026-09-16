ALTER TABLE `helpers` ADD `pdfShareCode` varchar(12);--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_pdf_share_code_unique` UNIQUE(`pdfShareCode`);