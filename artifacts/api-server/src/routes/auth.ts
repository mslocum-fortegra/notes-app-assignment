import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import {
  GetCurrentAuthUserResponse,
} from "@workspace/api-zod";
import { db, usersTable, verificationTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
  generateVerificationToken,
  type SessionData,
} from "../lib/auth";
import { seedDataForUser } from "../lib/seed";

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const token = generateVerificationToken();

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      emailVerified: false,
    })
    .returning();

  await db.insert(verificationTokensTable).values({
    userId: user.id,
    token,
    type: "email_verification",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  res.status(201).json({
    message: "Account created. Please verify your email.",
    verificationToken: token,
    userId: user.id,
  });
});

router.get("/auth/verify", async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Verification token is required" });
    return;
  }

  const [record] = await db
    .select()
    .from(verificationTokensTable)
    .where(eq(verificationTokensTable.token, token));

  if (!record) {
    res.status(400).json({ error: "Invalid verification token" });
    return;
  }

  if (record.expiresAt < new Date()) {
    await db.delete(verificationTokensTable).where(eq(verificationTokensTable.token, token));
    res.status(400).json({ error: "Verification token has expired" });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true })
    .where(eq(usersTable.id, record.userId));

  await db.delete(verificationTokensTable).where(eq(verificationTokensTable.token, token));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, record.userId));

  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  seedDataForUser(user.id).catch(() => {});

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json({ message: "Email verified successfully", verified: true });
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!user.emailVerified) {
    const token = generateVerificationToken();
    await db.insert(verificationTokensTable).values({
      userId: user.id,
      token,
      type: "email_verification",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    res.status(403).json({
      error: "Please verify your email before logging in",
      needsVerification: true,
      verificationToken: token,
    });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  });
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

export default router;
