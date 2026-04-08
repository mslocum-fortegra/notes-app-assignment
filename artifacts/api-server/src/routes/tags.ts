import { Router, type IRouter } from "express";
import { eq, inArray, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { noteTagsTable, notesTable } from "@workspace/db";
import { getUserAccessibleCollectionIds } from "../lib/access";

const router: IRouter = Router();

router.get("/tags", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);

  if (collectionIds.length === 0) {
    res.json([]);
    return;
  }

  const tags = await db
    .select({
      tag: noteTagsTable.tag,
      count: count(),
    })
    .from(noteTagsTable)
    .innerJoin(notesTable, eq(noteTagsTable.noteId, notesTable.id))
    .where(inArray(notesTable.collectionId, collectionIds))
    .groupBy(noteTagsTable.tag)
    .orderBy(sql`count(*) desc`);

  res.json(tags);
});

export default router;
