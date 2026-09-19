ALTER TABLE `cakes` ADD `donationCategory` enum('kuchen','salat','snack','sonstiges') DEFAULT 'kuchen' NOT NULL;--> statement-breakpoint
ALTER TABLE `cakes` ADD `meat` boolean DEFAULT false NOT NULL;