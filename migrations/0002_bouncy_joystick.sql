PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link_id` integer NOT NULL,
	`ts` integer NOT NULL,
	`country` text,
	`city` text,
	`referrer` text,
	`ua_device` text,
	`ua_browser` text,
	`visitor_hash` text,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_clicks`("id", "link_id", "ts", "country", "city", "referrer", "ua_device", "ua_browser", "visitor_hash") SELECT "id", "link_id", "ts", "country", "city", "referrer", "ua_device", "ua_browser", "visitor_hash" FROM `clicks`;--> statement-breakpoint
DROP TABLE `clicks`;--> statement-breakpoint
ALTER TABLE `__new_clicks` RENAME TO `clicks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `clicks_link_ts_idx` ON `clicks` (`link_id`,`ts`);