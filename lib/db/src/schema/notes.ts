import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { collectionsTable } from "./collections";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  collectionId: serial("collection_id").notNull().references(() => collectionsTable.id),
  createdById: text("created_by_id").notNull().references(() => usersTable.id),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Note = typeof notesTable.$inferSelect;

export const noteTagsTable = pgTable("note_tags", {
  id: serial("id").primaryKey(),
  noteId: serial("note_id").notNull().references(() => notesTable.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});

export type NoteTag = typeof noteTagsTable.$inferSelect;

export const noteRevisionMetadataTable = pgTable("note_revision_metadata", {
  id: serial("id").primaryKey(),
  noteId: serial("note_id").notNull().references(() => notesTable.id, { onDelete: "cascade" }),
  editedById: text("edited_by_id").notNull().references(() => usersTable.id),
  editSummary: text("edit_summary").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NoteRevisionMetadata = typeof noteRevisionMetadataTable.$inferSelect;
