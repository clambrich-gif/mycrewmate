START TRANSACTION;--> statement-breakpoint

INSERT INTO `prep_tasks` (
  `year`,
  `eventId`,
  `task`,
  `category`,
  `dueText`,
  `locationId`,
  `contactId`,
  `status`,
  `statusWording`,
  `note`,
  `deleted`,
  `sortOrder`
)
SELECT
  `year`,
  `eventId`,
  `measure`,
  'Marketing',
  '',
  NULL,
  `contactId`,
  `status`,
  'aufgabe',
  CASE
    WHEN TRIM(`channel`) <> '' THEN CONCAT(
      'Kanal: ',
      `channel`,
      CASE
        WHEN `note` IS NOT NULL AND `note` <> '' THEN CONCAT('\n', `note`)
        ELSE ''
      END
    )
    ELSE `note`
  END,
  false,
  `sortOrder`
FROM `marketing`;--> statement-breakpoint

INSERT INTO `prep_tasks` (
  `year`,
  `eventId`,
  `task`,
  `category`,
  `dueText`,
  `locationId`,
  `contactId`,
  `status`,
  `statusWording`,
  `note`,
  `deleted`,
  `sortOrder`
)
SELECT
  `year`,
  `eventId`,
  `request`,
  'Genehmigungen',
  '',
  NULL,
  `contactId`,
  CASE
    WHEN `status` = 'beantragt' THEN 'inArbeit'
    WHEN `status` = 'genehmigt' THEN 'erledigt'
    ELSE `status`
  END,
  'genehmigung',
  `note`,
  false,
  `sortOrder`
FROM `approvals`;--> statement-breakpoint

DELETE FROM `marketing`;--> statement-breakpoint
DELETE FROM `approvals`;--> statement-breakpoint

COMMIT;
