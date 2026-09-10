CREATE TABLE `event_years` (
	`year` int NOT NULL,
	`label` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_years_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
ALTER TABLE `approvals` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `cakes` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `finances` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `helpers` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `post_tasks` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `prep_tasks` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `adminPasswordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `shifts` ADD `year` int DEFAULT 2026 NOT NULL;--> statement-breakpoint
INSERT IGNORE INTO `event_years` (`year`, `label`) VALUES (2026, 'MyEifelRide 2026'), (2027, 'MyEifelRide 2027');--> statement-breakpoint
CREATE TEMPORARY TABLE `helper_merge` (`oldId` int NOT NULL, `keepId` int NOT NULL);--> statement-breakpoint
INSERT INTO `helper_merge` (`oldId`, `keepId`)
SELECT h.`id`, grouped.`keepId`
FROM `helpers` h
JOIN (
	SELECT LOWER(TRIM(`name`)) AS `normalizedName`, MIN(`id`) AS `keepId`
	FROM `helpers`
	GROUP BY LOWER(TRIM(`name`))
) grouped ON LOWER(TRIM(h.`name`)) = grouped.`normalizedName`;--> statement-breakpoint
CREATE TEMPORARY TABLE `assignment_merge` (`assignmentId` int NOT NULL, `shiftId` int NOT NULL, `keepId` int NOT NULL);--> statement-breakpoint
INSERT INTO `assignment_merge` (`assignmentId`, `shiftId`, `keepId`)
SELECT a.`id`, a.`shiftId`, hm.`keepId`
FROM `assignments` a
JOIN `helper_merge` hm ON hm.`oldId` = a.`helperId`;--> statement-breakpoint
CREATE TEMPORARY TABLE `assignment_keep` (`assignmentId` int NOT NULL, `shiftId` int NOT NULL, `keepId` int NOT NULL);--> statement-breakpoint
INSERT INTO `assignment_keep` (`assignmentId`, `shiftId`, `keepId`)
SELECT MIN(`assignmentId`), `shiftId`, `keepId`
FROM `assignment_merge`
GROUP BY `shiftId`, `keepId`;--> statement-breakpoint
DELETE a FROM `assignments` a
JOIN `assignment_merge` am ON am.`assignmentId` = a.`id`
LEFT JOIN `assignment_keep` keep_row ON keep_row.`assignmentId` = a.`id`
WHERE keep_row.`assignmentId` IS NULL;--> statement-breakpoint
UPDATE `assignments` a
JOIN `assignment_keep` keep_row ON keep_row.`assignmentId` = a.`id`
SET a.`helperId` = keep_row.`keepId`;--> statement-breakpoint
UPDATE `helpers` keeper
JOIN (
	SELECT LOWER(TRIM(`name`)) AS `normalizedName`, MIN(`id`) AS `keepId`, MAX(`id`) AS `latestId`
	FROM `helpers`
	GROUP BY LOWER(TRIM(`name`))
) grouped ON grouped.`keepId` = keeper.`id`
JOIN `helpers` latest ON latest.`id` = grouped.`latestId`
SET keeper.`contactId` = latest.`contactId`, keeper.`email` = latest.`email`, keeper.`phone` = latest.`phone`, keeper.`note` = latest.`note`, keeper.`willHelp` = latest.`willHelp`, keeper.`availFri` = latest.`availFri`, keeper.`availSat` = latest.`availSat`, keeper.`availSun` = latest.`availSun`, keeper.`confirmed` = latest.`confirmed`;--> statement-breakpoint
DELETE h FROM `helpers` h
JOIN `helper_merge` hm ON hm.`oldId` = h.`id`
WHERE hm.`oldId` <> hm.`keepId`;--> statement-breakpoint
DROP TEMPORARY TABLE `assignment_keep`;--> statement-breakpoint
DROP TEMPORARY TABLE `assignment_merge`;--> statement-breakpoint
DROP TEMPORARY TABLE `helper_merge`;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_year_name_unique` UNIQUE(`year`,`name`);--> statement-breakpoint
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_year_name_unique` UNIQUE(`year`,`name`);
