import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { UpdateUserSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(usersTable);

  res.json(users);
});

router.get("/users/me/settings", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    userId: user.id,
    displayName: user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || null,
    email: user.email,
    role: user.role,
    notificationsEnabled: user.notificationsEnabled,
    defaultCollectionId: user.defaultCollectionId ? parseInt(user.defaultCollectionId) : null,
    createdAt: user.createdAt,
  });
});

router.patch("/users/me/settings", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateUserSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName;
  if (parsed.data.notificationsEnabled !== undefined) updateData.notificationsEnabled = parsed.data.notificationsEnabled;
  if (parsed.data.defaultCollectionId !== undefined) {
    updateData.defaultCollectionId = parsed.data.defaultCollectionId?.toString() ?? null;
  }

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, req.user.id))
    .returning();

  res.json({
    userId: user.id,
    displayName: user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || null,
    email: user.email,
    role: user.role,
    notificationsEnabled: user.notificationsEnabled,
    defaultCollectionId: user.defaultCollectionId ? parseInt(user.defaultCollectionId) : null,
    createdAt: user.createdAt,
  });
});

export default router;
