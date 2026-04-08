import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const activityEventsTable = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  actorId: text("actor_id").notNull().references(() => usersTable.id),
  entityId: integer("entity_id"),
  entityType: text("entity_type"),
  entityTitle: text("entity_title"),
  collectionId: integer("collection_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActivityEvent = typeof activityEventsTable.$inferSelect;
