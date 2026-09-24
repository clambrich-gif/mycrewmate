ALTER TABLE `activity_logs` ADD `tenantId` varchar(96);--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD `tenantId` varchar(96);--> statement-breakpoint
UPDATE `activity_logs` AS `log`
INNER JOIN `events` AS `event` ON `event`.`id` = `log`.`eventId`
SET `log`.`tenantId` = `event`.`tenantId`;--> statement-breakpoint
UPDATE `deletion_audit_logs` AS `log`
INNER JOIN `events` AS `event` ON `event`.`id` = `log`.`eventId`
SET `log`.`tenantId` = `event`.`tenantId`;--> statement-breakpoint
-- Plattformweite Altvorgänge blieben früher technisch an der Standardveranstaltung
-- hängen. Sie gehören bewusst in kein Vereinslogbuch.
UPDATE `activity_logs`
SET `tenantId` = NULL
WHERE `module` = 'Zugangsschutz'
  AND (
    `subject` LIKE 'Testzugang % entfernt'
    OR `subject` LIKE 'Interner Testverein %'
    OR `subject` LIKE 'Globaler Notfall-Stopp %'
    OR `subject` LIKE 'Administratorpasswort %'
    OR `subject` = 'Administrator-Anmeldung erfolgreich'
  );--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deletion_audit_logs` ADD CONSTRAINT `deletion_audit_logs_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_logs_tenant_created_idx` ON `activity_logs` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `activity_logs_tenant_event_created_idx` ON `activity_logs` (`tenantId`,`eventId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `deletion_audit_logs_tenant_created_idx` ON `deletion_audit_logs` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `deletion_audit_logs_tenant_event_created_idx` ON `deletion_audit_logs` (`tenantId`,`eventId`,`createdAt`);
