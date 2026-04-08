import { db } from "@workspace/db";
import { activityEventsTable } from "@workspace/db";

export type ActivityType =
  | "note_created"
  | "note_edited"
  | "note_archived"
  | "note_deleted"
  | "collection_created"
  | "collection_shared"
  | "member_added"
  | "member_removed";

export async function createActivityEvent(params: {
  type: ActivityType;
  actorId: string;
  entityId?: number;
  entityType?: string;
  entityTitle?: string;
  collectionId?: number;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityEventsTable).values({
    type: params.type,
    actorId: params.actorId,
    entityId: params.entityId ?? null,
    entityType: params.entityType ?? null,
    entityTitle: params.entityTitle ?? null,
    collectionId: params.collectionId ?? null,
    metadata: params.metadata ?? {},
  });
}
