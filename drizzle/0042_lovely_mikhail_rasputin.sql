CREATE INDEX `assignments_helper_event_idx` ON `assignments` (`helperId`,`eventId`);--> statement-breakpoint
CREATE INDEX `materials_event_deleted_idx` ON `materials` (`eventId`,`year`,`deleted`);--> statement-breakpoint
CREATE INDEX `materials_event_location_idx` ON `materials` (`eventId`,`locationId`);--> statement-breakpoint
CREATE INDEX `post_tasks_event_deleted_idx` ON `post_tasks` (`eventId`,`year`,`deleted`);--> statement-breakpoint
CREATE INDEX `post_tasks_event_location_idx` ON `post_tasks` (`eventId`,`locationId`);--> statement-breakpoint
CREATE INDEX `prep_tasks_event_deleted_idx` ON `prep_tasks` (`eventId`,`year`,`deleted`);--> statement-breakpoint
CREATE INDEX `prep_tasks_event_location_idx` ON `prep_tasks` (`eventId`,`locationId`);--> statement-breakpoint
CREATE INDEX `shifts_event_year_day_idx` ON `shifts` (`eventId`,`year`,`day`);--> statement-breakpoint
CREATE INDEX `shifts_event_location_idx` ON `shifts` (`eventId`,`locationId`);