import { Router, type IRouter } from "express";
import { eq, inArray, desc, count, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  notesTable,
  noteTagsTable,
  collectionsTable,
  collectionMembersTable,
  activityEventsTable,
  usersTable,
} from "@workspace/db";
import { getUserAccessibleCollectionIds } from "../lib/access";

const router: IRouter = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);

  if (collectionIds.length === 0) {
    res.json({ recentNotes: [], recentCollections: [], recentActivity: [] });
    return;
  }

  const recentNotes = await db
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
        inArray(notesTable.collectionId, collectionIds),
        eq(notesTable.archived, false)
      )
    )
    .orderBy(desc(notesTable.updatedAt))
    .limit(8);

  const noteIds = recentNotes.map((n) => n.id);
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

  const enrichedNotes = recentNotes.map((n) => ({
    ...n,
    tags: tagMap[n.id] || [],
  }));

  const recentCollections = await db
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
    .orderBy(desc(collectionsTable.updatedAt))
    .limit(6);

  const noteCounts = await db
    .select({
      collectionId: notesTable.collectionId,
      count: count(),
    })
    .from(notesTable)
    .where(inArray(notesTable.collectionId, collectionIds))
    .groupBy(notesTable.collectionId);

  const noteCountMap: Record<number, number> = {};
  noteCounts.forEach((nc) => { noteCountMap[nc.collectionId] = nc.count; });

  const enrichedCollections = recentCollections.map((c) => ({
    ...c,
    noteCount: noteCountMap[c.id] || 0,
    memberCount: 0,
  }));

  const recentActivity = await db
    .select({
      id: activityEventsTable.id,
      type: activityEventsTable.type,
      actorId: activityEventsTable.actorId,
      actorName: usersTable.firstName,
      actorProfileImageUrl: usersTable.profileImageUrl,
      entityId: activityEventsTable.entityId,
      entityType: activityEventsTable.entityType,
      entityTitle: activityEventsTable.entityTitle,
      metadata: activityEventsTable.metadata,
      createdAt: activityEventsTable.createdAt,
    })
    .from(activityEventsTable)
    .leftJoin(usersTable, eq(activityEventsTable.actorId, usersTable.id))
    .where(inArray(activityEventsTable.collectionId, collectionIds))
    .orderBy(desc(activityEventsTable.createdAt))
    .limit(10);

  res.json({
    recentNotes: enrichedNotes,
    recentCollections: enrichedCollections,
    recentActivity,
  });
});

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);

  if (collectionIds.length === 0) {
    res.json({
      totalNotes: 0,
      totalCollections: 0,
      sharedCollections: 0,
      archivedNotes: 0,
      recentNotesCount: 0,
    });
    return;
  }

  const [totalNotesResult] = await db
    .select({ count: count() })
    .from(notesTable)
    .where(inArray(notesTable.collectionId, collectionIds));

  const [archivedResult] = await db
    .select({ count: count() })
    .from(notesTable)
    .where(
      and(
        inArray(notesTable.collectionId, collectionIds),
        eq(notesTable.archived, true)
      )
    );

  const [sharedResult] = await db
    .select({ count: count() })
    .from(collectionsTable)
    .where(
      and(
        inArray(collectionsTable.id, collectionIds),
        eq(collectionsTable.visibility, "shared")
      )
    );

  res.json({
    totalNotes: totalNotesResult.count,
    totalCollections: collectionIds.length,
    sharedCollections: sharedResult.count,
    archivedNotes: archivedResult.count,
    recentNotesCount: totalNotesResult.count - archivedResult.count,
  });
});

export default router;
