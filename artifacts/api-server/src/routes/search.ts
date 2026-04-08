import { Router, type IRouter } from "express";
import { eq, and, inArray, ilike, or, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  notesTable,
  noteTagsTable,
  collectionsTable,
  usersTable,
} from "@workspace/db";
import { SearchNotesQueryParams } from "@workspace/api-zod";
import { getUserAccessibleCollectionIds } from "../lib/access";

const router: IRouter = Router();

function generateSnippet(body: string, query: string): string {
  const lowerBody = body.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerBody.indexOf(lowerQuery);

  if (index === -1) {
    return body.substring(0, 150) + (body.length > 150 ? "..." : "");
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(body.length, index + query.length + 60);
  let snippet = "";
  if (start > 0) snippet += "...";
  snippet += body.substring(start, end);
  if (end < body.length) snippet += "...";
  return snippet;
}

function calculateRelevanceScore(note: { title: string; body: string }, query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  if (note.title.toLowerCase().includes(lowerQuery)) {
    score += 10;
    if (note.title.toLowerCase().startsWith(lowerQuery)) {
      score += 5;
    }
  }

  const bodyLower = note.body.toLowerCase();
  let pos = 0;
  let bodyMatches = 0;
  while ((pos = bodyLower.indexOf(lowerQuery, pos)) !== -1) {
    bodyMatches++;
    pos += lowerQuery.length;
  }
  score += bodyMatches;

  return score;
}

router.get("/search", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = SearchNotesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = params.data.q;
  if (!query || query.trim().length === 0) {
    res.json({ results: [], total: 0 });
    return;
  }

  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);
  if (collectionIds.length === 0) {
    res.json({ results: [], total: 0 });
    return;
  }

  let conditions = and(
    inArray(notesTable.collectionId, collectionIds),
    eq(notesTable.archived, false),
    or(
      ilike(notesTable.title, `%${query}%`),
      ilike(notesTable.body, `%${query}%`)
    )
  );

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
    .where(conditions)
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

  let results = notes.map((n) => ({
    note: { ...n, tags: tagMap[n.id] || [] },
    snippet: generateSnippet(n.body, query),
    score: calculateRelevanceScore(n, query),
  }));

  if (params.data.collectionId) {
    results = results.filter((r) => r.note.collectionId === params.data.collectionId);
  }

  if (params.data.tag) {
    results = results.filter((r) => r.note.tags.includes(params.data.tag!));
  }

  if (params.data.sort === "relevant") {
    results.sort((a, b) => b.score - a.score);
  }

  res.json({ results, total: results.length });
});

export default router;
