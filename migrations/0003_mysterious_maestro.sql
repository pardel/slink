ALTER TABLE `links` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `links` ADD `listed` integer DEFAULT 1 NOT NULL;