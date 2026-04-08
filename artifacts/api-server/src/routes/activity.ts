import { Router, type IRouter } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activityEventsTable,
  usersTable,
} from "@workspace/db";
import { GetActivityFeedQueryParams } from "@workspace/api-zod";
import { getUserAccessibleCollectionIds } from "../lib/access";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetActivityFeedQueryParams.safeParse(req.query);

  const limit = params.success && params.data.limit ? params.data.limit : 20;
  const offset = params.success && params.data.offset ? params.data.offset : 0;

  const collectionIds = await getUserAccessibleCollectionIds(req.user.id);

  if (collectionIds.length === 0) {
    res.json([]);
    return;
  }

  const events = await db
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
    .limit(limit)
    .offset(offset);

  res.json(events);
});

export default router;
