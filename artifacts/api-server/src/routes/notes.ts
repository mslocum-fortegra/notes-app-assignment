import { Router, type IRouter } from "express";
import { eq, and, inArray, ilike, or, desc, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  notesTable,
  noteTagsTable,
  noteRevisionMetadataTable,
  collectionsTable,
  collectionMembersTable,
  usersTable,
} from "@workspace/db";
import {
  CreateNoteBody,
  UpdateNoteBody,
  UpdateNoteParams,
  DeleteNoteParams,
  GetNoteParams,
  ArchiveNoteParams,
  ArchiveNoteBody,
  MoveNoteParams,
  MoveNoteBody,
  UpdateNoteTagsParams,
  UpdateNoteTagsBody,
  GetNoteRevisionsParams,
  GetRelatedNotesParams,
  ListNotesQueryParams,
} from "@workspace/api-zod";
import { getUserAccessibleCollectionIds, canAccessCollection } from "../lib/access";
import { createActivityEvent } from "../lib/activity";

const router: IRouter = Router();

async function enrichNoteWithTags(noteId: number) {
  const tags = await db
    .select({ tag: noteTagsTable.tag })
    .from(noteTagsTable)
    .where(eq(noteTagsTable.noteId, noteId));
  return tags.map((t) => t.tag);
}

async function enrichNotesWithTags(noteIds: number[]) {
  if (noteIds.length === 0) return {};
  const allTags = await db
    .select()
    .from(noteTagsTable)
    .where(inArray(noteTagsTable.noteId, noteIds));
  const tagMap: Record<number, string[]> = {};
  for (const t of allTags) {
    if (!tagMap[t.noteId]) tagMap[t.noteId] = [];
    tagMap[t.noteId].push(t.tag);
  }
  return tagMap;
}

router.get("/notes", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListNotesQueryParams.safeParse(req.query);
  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);

  if (collectionIds.length === 0) {
    res.json([]);
    return;
  }

  let query = db
    .select({
      id: notesTable.id,
      title: notesTable.title,
      body: notesTable.body,
      collectionId: notesTable.collectionId,
      collectionName: collectionsTable.name,
      createdById: notesTable.createdById,
      createdByName: usersTable.firstName,
      archived: notesTable.archived,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .leftJoin(collectionsTable, eq(notesTable.collectionId, collectionsTable.id))
    .leftJoin(usersTable, eq(notesTable.createdById, usersTable.id))
    .where(inArray(notesTable.collectionId, collectionIds))
    .orderBy(desc(notesTable.updatedAt))
    .$dynamic();

  const notes = await query;

  const tagMap = await enrichNotesWithTags(notes.map((n) => n.id));

  let result = notes.map((n) => ({
    ...n,
    tags: tagMap[n.id] || [],
  }));

  if (params.success) {
    if (params.data.collectionId) {
      result = result.filter((n) => n.collectionId === params.data.collectionId);
    }
    if (params.data.tag) {
      result = result.filter((n) => n.tags.includes(params.data.tag!));
    }
    if (params.data.archived !== undefined) {
      result = result.filter((n) => n.archived === params.data.archived);
    }
  }

  res.json(result);
});

router.post("/notes", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, parsed.data.collectionId);
  if (!hasAccess) {
    res.status(403).json({ error: "No access to this collection" });
    return;
  }

  const [note] = await db
    .insert(notesTable)
    .values({
      title: parsed.data.title,
      body: parsed.data.body || "",
      collectionId: parsed.data.collectionId,
      createdById: req.user.id,
    })
    .returning();

  if (parsed.data.tags && parsed.data.tags.length > 0) {
    await db.insert(noteTagsTable).values(
      parsed.data.tags.map((tag) => ({ noteId: note.id, tag }))
    );
  }

  await db.insert(noteRevisionMetadataTable).values({
    noteId: note.id,
    editedById: req.user.id,
    editSummary: "Created note",
  });

  createActivityEvent({
    type: "note_created",
    actorId: req.user.id,
    entityId: note.id,
    entityType: "note",
    entityTitle: note.title,
    collectionId: note.collectionId,
  });

  const tags = await enrichNoteWithTags(note.id);
  res.status(201).json({ ...note, tags, collectionName: null, createdByName: req.user.firstName });
});

router.get("/notes/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [note] = await db
    .select({
      id: notesTable.id,
      title: notesTable.title,
      body: notesTable.body,
      collectionId: notesTable.collectionId,
      collectionName: collectionsTable.name,
      createdById: notesTable.createdById,
      createdByName: usersTable.firstName,
      archived: notesTable.archived,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .leftJoin(collectionsTable, eq(notesTable.collectionId, collectionsTable.id))
    .leftJoin(usersTable, eq(notesTable.createdById, usersTable.id))
    .where(eq(notesTable.id, params.data.id));

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, note.collectionId);
  if (!hasAccess) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const tags = await enrichNoteWithTags(note.id);

  const revisions = await db
    .select({
      id: noteRevisionMetadataTable.id,
      noteId: noteRevisionMetadataTable.noteId,
      editedById: noteRevisionMetadataTable.editedById,
      editedByName: usersTable.firstName,
      editSummary: noteRevisionMetadataTable.editSummary,
      createdAt: noteRevisionMetadataTable.createdAt,
    })
    .from(noteRevisionMetadataTable)
    .leftJoin(usersTable, eq(noteRevisionMetadataTable.editedById, usersTable.id))
    .where(eq(noteRevisionMetadataTable.noteId, note.id))
    .orderBy(desc(noteRevisionMetadataTable.createdAt));

  const [collection] = await db
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.id, note.collectionId));

  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);
  const relatedNotes = await db
    .select({
      id: notesTable.id,
      title: notesTable.title,
      body: notesTable.body,
      collectionId: notesTable.collectionId,
      collectionName: collectionsTable.name,
      createdById: notesTable.createdById,
      createdByName: usersTable.firstName,
      archived: notesTable.archived,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .leftJoin(collectionsTable, eq(notesTable.collectionId, collectionsTable.id))
    .leftJoin(usersTable, eq(notesTable.createdById, usersTable.id))
    .where(
      and(
        eq(notesTable.collectionId, note.collectionId),
        eq(notesTable.archived, false)
      )
    )
    .orderBy(desc(notesTable.updatedAt))
    .limit(5);

  const relatedTagMap = await enrichNotesWithTags(relatedNotes.map((n) => n.id));
  const enrichedRelated = relatedNotes
    .filter((n) => n.id !== note.id)
    .map((n) => ({ ...n, tags: relatedTagMap[n.id] || [] }));

  let collectionForResponse = null;
  if (collection) {
    const [owner] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.id, collection.ownerId));
    const [noteCountResult] = await db
      .select({ count: count() })
      .from(notesTable)
      .where(eq(notesTable.collectionId, collection.id));
    const [memberCountResult] = await db
      .select({ count: count() })
      .from(collectionMembersTable)
      .where(eq(collectionMembersTable.collectionId, collection.id));
    collectionForResponse = {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      ownerId: collection.ownerId,
      ownerName: owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || null : null,
      visibility: collection.visibility,
      noteCount: noteCountResult?.count ?? 0,
      memberCount: memberCountResult?.count ?? 0,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  res.json({
    ...note,
    tags,
    collection: collectionForResponse,
    revisions,
    relatedNotes: enrichedRelated,
  });
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, existing.collectionId);
  if (!hasAccess) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.body !== undefined) updateData.body = parsed.data.body;

  const [note] = await db
    .update(notesTable)
    .set(updateData)
    .where(eq(notesTable.id, params.data.id))
    .returning();

  const changes: string[] = [];
  if (parsed.data.title !== undefined) changes.push("title");
  if (parsed.data.body !== undefined) changes.push("body");

  await db.insert(noteRevisionMetadataTable).values({
    noteId: note.id,
    editedById: req.user.id,
    editSummary: `Updated ${changes.join(", ")}`,
  });

  createActivityEvent({
    type: "note_edited",
    actorId: req.user.id,
    entityId: note.id,
    entityType: "note",
    entityTitle: note.title,
    collectionId: note.collectionId,
  });

  const tags = await enrichNoteWithTags(note.id);
  res.json({ ...note, tags, collectionName: null, createdByName: null });
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, existing.collectionId);
  if (!hasAccess) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  createActivityEvent({
    type: "note_deleted",
    actorId: req.user.id,
    entityId: existing.id,
    entityType: "note",
    entityTitle: existing.title,
    collectionId: existing.collectionId,
  });

  await db.delete(notesTable).where(eq(notesTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/notes/:id/archive", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ArchiveNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ArchiveNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, existing.collectionId);
  if (!hasAccess) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const [note] = await db
    .update(notesTable)
    .set({ archived: parsed.data.archived })
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  createActivityEvent({
    type: "note_archived",
    actorId: req.user.id,
    entityId: note.id,
    entityType: "note",
    entityTitle: note.title,
    collectionId: note.collectionId,
  });

  const tags = await enrichNoteWithTags(note.id);
  res.json({ ...note, tags, collectionName: null, createdByName: null });
});

router.patch("/notes/:id/move", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = MoveNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = MoveNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingNote] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existingNote) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasSourceAccess = await canAccessCollection(req.user.id, existingNote.collectionId);
  if (!hasSourceAccess) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, parsed.data.collectionId);
  if (!hasAccess) {
    res.status(403).json({ error: "No access to target collection" });
    return;
  }

  const [note] = await db
    .update(notesTable)
    .set({ collectionId: parsed.data.collectionId })
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const tags = await enrichNoteWithTags(note.id);
  res.json({ ...note, tags, collectionName: null, createdByName: null });
});

router.put("/notes/:id/tags", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateNoteTagsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNoteTagsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingNote] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existingNote) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, existingNote.collectionId);
  if (!hasAccess) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  await db.delete(noteTagsTable).where(eq(noteTagsTable.noteId, params.data.id));

  if (parsed.data.tags.length > 0) {
    await db.insert(noteTagsTable).values(
      parsed.data.tags.map((tag) => ({ noteId: params.data.id, tag }))
    );
  }

  res.json(parsed.data.tags);
});

router.get("/notes/:id/revisions", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetNoteRevisionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existingNote] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existingNote) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, existingNote.collectionId);
  if (!hasAccess) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const revisions = await db
    .select({
      id: noteRevisionMetadataTable.id,
      noteId: noteRevisionMetadataTable.noteId,
      editedById: noteRevisionMetadataTable.editedById,
      editedByName: usersTable.firstName,
      editSummary: noteRevisionMetadataTable.editSummary,
      createdAt: noteRevisionMetadataTable.createdAt,
    })
    .from(noteRevisionMetadataTable)
    .leftJoin(usersTable, eq(noteRevisionMetadataTable.editedById, usersTable.id))
    .where(eq(noteRevisionMetadataTable.noteId, params.data.id))
    .orderBy(desc(noteRevisionMetadataTable.createdAt));

  res.json(revisions);
});

router.get("/notes/:id/related", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetRelatedNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [note] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!note) {
    res.json([]);
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, note.collectionId);
  if (!hasAccess) {
    res.json([]);
    return;
  }

  const related = await db
    .select({
      id: notesTable.id,
      title: notesTable.title,
      body: notesTable.body,
      collectionId: notesTable.collectionId,
      collectionName: collectionsTable.name,
      createdById: notesTable.createdById,
      createdByName: usersTable.firstName,
      archived: notesTable.archived,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .leftJoin(collectionsTable, eq(notesTable.collectionId, collectionsTable.id))
    .leftJoin(usersTable, eq(notesTable.createdById, usersTable.id))
    .where(
      and(
        eq(notesTable.collectionId, note.collectionId),
        eq(notesTable.archived, false)
      )
    )
    .orderBy(desc(notesTable.updatedAt))
    .limit(6);

  const tagMap = await enrichNotesWithTags(related.map((n) => n.id));
  const result = related
    .filter((n) => n.id !== params.data.id)
    .slice(0, 5)
    .map((n) => ({ ...n, tags: tagMap[n.id] || [] }));

  res.json(result);
});

export default router;
