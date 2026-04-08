import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Collection = typeof collectionsTable.$inferSelect;

export const collectionMembersTable = pgTable("collection_members", {
  id: serial("id").primaryKey(),
  collectionId: serial("collection_id").notNull().references(() => collectionsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull().default("viewer"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_collection_member").on(table.collectionId, table.userId),
]);

export type CollectionMember = typeof collectionMembersTable.$inferSelect;
