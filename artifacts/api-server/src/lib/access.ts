import { db } from "@workspace/db";
import { collectionsTable, collectionMembersTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";

export async function getUserAccessibleCollectionIds(userId: string): Promise<number[]> {
  const owned = await db
    .select({ id: collectionsTable.id })
    .from(collectionsTable)
    .where(eq(collectionsTable.ownerId, userId));

  const memberOf = await db
    .select({ id: collectionMembersTable.collectionId })
    .from(collectionMembersTable)
    .where(eq(collectionMembersTable.userId, userId));

  const ids = new Set<number>();
  owned.forEach((c) => ids.add(c.id));
  memberOf.forEach((m) => ids.add(m.id));
  return Array.from(ids);
}

export async function canAccessCollection(userId: string, collectionId: number): Promise<boolean> {
  const [collection] = await db
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.id, collectionId));

  if (!collection) return false;
  if (collection.ownerId === userId) return true;

  const [membership] = await db
    .select()
    .from(collectionMembersTable)
    .where(
      and(
        eq(collectionMembersTable.collectionId, collectionId),
        eq(collectionMembersTable.userId, userId)
      )
    );

  return !!membership;
}

export async function isCollectionOwner(userId: string, collectionId: number): Promise<boolean> {
  const [collection] = await db
    .select()
    .from(collectionsTable)
    .where(
      and(
        eq(collectionsTable.id, collectionId),
        eq(collectionsTable.ownerId, userId)
      )
    );
  return !!collection;
}
