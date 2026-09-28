import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";

export const links = sqliteTable("links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  targetUrl: text("target_url").notNull(),
  title: text("title"),
  createdAt: integer("created_at").notNull(),
  archived: integer("archived").notNull().default(0),
  // Public-page controls: pinned links lead the list; unlisted ones never appear
  // on it but still redirect.
  pinned: integer("pinned").notNull().default(0),
  listed: integer("listed").notNull().default(1),
});

export const clicks = sqliteTable(
  "clicks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    linkId: integer("link_id").notNull().references(() => links.id, { onDelete: "cascade" }),
    ts: integer("ts").notNull(),
    country: text("country"),
    city: text("city"),
    referrer: text("referrer"),
    uaDevice: text("ua_device"),
    uaBrowser: text("ua_browser"),
    visitorHash: text("visitor_hash"),
  },
  (table) => ({
    linkTsIdx: index("clicks_link_ts_idx").on(table.linkId, table.ts),
    // Account-wide analytics and the retention cron filter on ts alone, which the
    // (link_id, ts) index can't serve; without this they scan every click row.
    tsIdx: index("clicks_ts_idx").on(table.ts),
  })
);
