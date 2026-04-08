import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import notesRouter from "./notes";
import collectionsRouter from "./collections";
import searchRouter from "./search";
import activityRouter from "./activity";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import tagsRouter from "./tags";
import { runSeedData } from "../lib/seed";

const router: IRouter = Router();

router.post("/seed", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Seed is disabled in production" });
    return;
  }
  try {
    await runSeedData();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Seed failed" });
  }
});

router.use(healthRouter);
router.use(authRouter);
router.use(notesRouter);
router.use(collectionsRouter);
router.use(searchRouter);
router.use(activityRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(tagsRouter);

export default router;
