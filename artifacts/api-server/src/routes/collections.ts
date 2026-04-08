import { Router, type IRouter } from "express";
import { eq, and, inArray, or, desc, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  collectionsTable,
  collectionMembersTable,
  notesTable,
  noteTagsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateCollectionBody,
  GetCollectionParams,
  UpdateCollectionParams,
  UpdateCollectionBody,
  DeleteCollectionParams,
  ListCollectionMembersParams,
  AddCollectionMemberParams,
  AddCollectionMemberBody,
  RemoveCollectionMemberParams,
  ListCollectionNotesParams,
} from "@workspace/api-zod";
import { getUserAccessibleCollectionIds, canAccessCollection, isCollectionOwner } from "../lib/access";
import { createActivityEvent } from "../lib/activity";

const router: IRouter = Router();

router.get("/collections", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);

  if (collectionIds.length === 0) {
    res.json([]);
    return;
  }

  const collections = await db
    .select({
      id: collectionsTable.id,
      name: collectionsTable.name,
      description: collectionsTable.description,
      ownerId: collectionsTable.ownerId,
      ownerName: usersTable.firstName,
      visibility: collectionsTable.visibility,
      createdAt: collectionsTable.createdAt,
      updatedAt: collectionsTable.updatedAt,
    })
    .from(collectionsTable)
    .leftJoin(usersTable, eq(collectionsTable.ownerId, usersTable.id))
    .where(inArray(collectionsTable.id, collectionIds))
    .orderBy(desc(collectionsTable.updatedAt));

  const noteCounts = await db
    .select({
      collectionId: notesTable.collectionId,
      count: count(),
    })
    .from(notesTable)
    .where(inArray(notesTable.collectionId, collectionIds))
    .groupBy(notesTable.collectionId);

  const memberCounts = await db
    .select({
      collectionId: collectionMembersTable.collectionId,
      count: count(),
    })
    .from(collectionMembersTable)
    .where(inArray(collectionMembersTable.collectionId, collectionIds))
    .groupBy(collectionMembersTable.collectionId);

  const noteCountMap: Record<number, number> = {};
  noteCounts.forEach((nc) => { noteCountMap[nc.collectionId] = nc.count; });

  const memberCountMap: Record<number, number> = {};
  memberCounts.forEach((mc) => { memberCountMap[mc.collectionId] = mc.count; });

  const result = collections.map((c) => ({
    ...c,
    noteCount: noteCountMap[c.id] || 0,
    memberCount: (memberCountMap[c.id] || 0) + 1,
  }));

  res.json(result);
});

router.post("/collections", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [collection] = await db
    .insert(collectionsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description || "",
      ownerId: req.user.id,
      visibility: parsed.data.visibility || "private",
    })
    .returning();

  createActivityEvent({
    type: "collection_created",
    actorId: req.user.id,
    entityId: collection.id,
    entityType: "collection",
    entityTitle: collection.name,
    collectionId: collection.id,
  });

  res.status(201).json({
    ...collection,
    ownerName: req.user.firstName,
    noteCount: 0,
    memberCount: 1,
  });
});

router.get("/collections/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetCollectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, params.data.id);
  if (!hasAccess) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const [collection] = await db
    .select({
      id: collectionsTable.id,
      name: collectionsTable.name,
      description: collectionsTable.description,
      ownerId: collectionsTable.ownerId,
      ownerName: usersTable.firstName,
      visibility: collectionsTable.visibility,
      createdAt: collectionsTable.createdAt,
      updatedAt: collectionsTable.updatedAt,
    })
    .from(collectionsTable)
    .leftJoin(usersTable, eq(collectionsTable.ownerId, usersTable.id))
    .where(eq(collectionsTable.id, params.data.id));

  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const members = await db
    .select({
      userId: collectionMembersTable.userId,
      collectionId: collectionMembersTable.collectionId,
      role: collectionMembersTable.role,
      joinedAt: collectionMembersTable.joinedAt,
      userName: usersTable.firstName,
      userEmail: usersTable.email,
      userProfileImageUrl: usersTable.profileImageUrl,
    })
    .from(collectionMembersTable)
    .leftJoin(usersTable, eq(collectionMembersTable.userId, usersTable.id))
    .where(eq(collectionMembersTable.collectionId, params.data.id));

  const notes = await db
    .select({
      id: notesTable.id,
      title: notesTable.title,
      body: notesTable.body,
      collectionId: notesTable.collectionId,
      createdById: notesTable.createdById,
      archived: notesTable.archived,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .where(eq(notesTable.collectionId, params.data.id))
    .orderBy(desc(notesTable.updatedAt));

  const noteIds = notes.map((n) => n.id);
  let tagMap: Record<number, string[]> = {};
  if (noteIds.length > 0) {
    const allTags = await db
      .select()
      .from(noteTagsTable)
      .where(inArray(noteTagsTable.noteId, noteIds));
    for (const t of allTags) {
      if (!tagMap[t.noteId]) tagMap[t.noteId] = [];
      tagMap[t.noteId].push(t.tag);
    }
  }

  const enrichedNotes = notes.map((n) => ({
    ...n,
    tags: tagMap[n.id] || [],
    collectionName: collection.name,
    createdByName: null,
  }));

  const [ownerUser] = await db
    .select({ firstName: usersTable.firstName })
    .from(usersTable)
    .where(eq(usersTable.id, collection.ownerId));

  const ownerMember = {
    userId: collection.ownerId,
    collectionId: collection.id,
    role: "owner" as const,
    joinedAt: collection.createdAt,
    userName: ownerUser?.firstName || null,
    userEmail: null,
    userProfileImageUrl: null,
  };

  res.json({
    ...collection,
    noteCount: notes.length,
    memberCount: members.length + 1,
    members: [ownerMember, ...members],
    notes: enrichedNotes,
  });
});

router.patch("/collections/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateCollectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isOwner = await isCollectionOwner(req.user.id, params.data.id);
  if (!isOwner) {
    res.status(403).json({ error: "Only the owner can update this collection" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.visibility !== undefined) updateData.visibility = parsed.data.visibility;

  const [collection] = await db
    .update(collectionsTable)
    .set(updateData)
    .where(eq(collectionsTable.id, params.data.id))
    .returning();

  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  if (parsed.data.visibility === "shared") {
    createActivityEvent({
      type: "collection_shared",
      actorId: req.user.id,
      entityId: collection.id,
      entityType: "collection",
      entityTitle: collection.name,
      collectionId: collection.id,
    });
  }

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

  res.json({
    ...collection,
    ownerName: owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || null : null,
    noteCount: noteCountResult?.count ?? 0,
    memberCount: memberCountResult?.count ?? 0,
  });
});

router.delete("/collections/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteCollectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const isOwner = await isCollectionOwner(req.user.id, params.data.id);
  if (!isOwner) {
    res.status(403).json({ error: "Only the owner can delete this collection" });
    return;
  }

  await db.delete(notesTable).where(eq(notesTable.collectionId, params.data.id));
  await db.delete(collectionsTable).where(eq(collectionsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/collections/:id/members", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListCollectionMembersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, params.data.id);
  if (!hasAccess) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const members = await db
    .select({
      userId: collectionMembersTable.userId,
      collectionId: collectionMembersTable.collectionId,
      role: collectionMembersTable.role,
      joinedAt: collectionMembersTable.joinedAt,
      userName: usersTable.firstName,
      userEmail: usersTable.email,
      userProfileImageUrl: usersTable.profileImageUrl,
    })
    .from(collectionMembersTable)
    .leftJoin(usersTable, eq(collectionMembersTable.userId, usersTable.id))
    .where(eq(collectionMembersTable.collectionId, params.data.id));

  res.json(members);
});

router.post("/collections/:id/members", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = AddCollectionMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddCollectionMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isOwner = await isCollectionOwner(req.user.id, params.data.id);
  if (!isOwner) {
    res.status(403).json({ error: "Only the owner can add members" });
    return;
  }

  const [member] = await db
    .insert(collectionMembersTable)
    .values({
      collectionId: params.data.id,
      userId: parsed.data.userId,
      role: parsed.data.role,
    })
    .onConflictDoUpdate({
      target: [collectionMembersTable.collectionId, collectionMembersTable.userId],
      set: { role: parsed.data.role },
    })
    .returning();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.userId));

  createActivityEvent({
    type: "member_added",
    actorId: req.user.id,
    entityId: params.data.id,
    entityType: "collection",
    entityTitle: "",
    collectionId: params.data.id,
    metadata: { userId: parsed.data.userId, role: parsed.data.role },
  });

  await db
    .update(collectionsTable)
    .set({ visibility: "shared" })
    .where(eq(collectionsTable.id, params.data.id));

  res.status(201).json({
    userId: member.userId,
    collectionId: member.collectionId,
    role: member.role,
    joinedAt: member.joinedAt,
    userName: user?.firstName || null,
    userEmail: user?.email || null,
    userProfileImageUrl: user?.profileImageUrl || null,
  });
});

router.delete("/collections/:id/members/:userId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = RemoveCollectionMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const isOwner = await isCollectionOwner(req.user.id, params.data.id);
  if (!isOwner) {
    res.status(403).json({ error: "Only the owner can remove members" });
    return;
  }

  const [deleted] = await db
    .delete(collectionMembersTable)
    .where(
      and(
        eq(collectionMembersTable.collectionId, params.data.id),
        eq(collectionMembersTable.userId, params.data.userId)
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  createActivityEvent({
    type: "member_removed",
    actorId: req.user.id,
    entityId: params.data.id,
    entityType: "collection",
    collectionId: params.data.id,
    metadata: { userId: params.data.userId },
  });

  res.sendStatus(204);
});

router.get("/collections/:id/notes", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListCollectionNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const hasAccess = await canAccessCollection(req.user.id, params.data.id);
  if (!hasAccess) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const notes = await db
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
    .where(eq(notesTable.collectionId, params.data.id))
    .orderBy(desc(notesTable.updatedAt));

  const noteIds = notes.map((n) => n.id);
  let tagMap: Record<number, string[]> = {};
  if (noteIds.length > 0) {
    const allTags = await db
      .select()
      .from(noteTagsTable)
      .where(inArray(noteTagsTable.noteId, noteIds));
    for (const t of allTags) {
      if (!tagMap[t.noteId]) tagMap[t.noteId] = [];
      tagMap[t.noteId].push(t.tag);
    }
  }

  res.json(notes.map((n) => ({ ...n, tags: tagMap[n.id] || [] })));
});

export default router;
