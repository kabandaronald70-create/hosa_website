import { Router } from "express";
import {
  getDirectory,
  getDirectoryMember,
  getEvents,
  getEvent,
  getStories,
  getOpportunities,
} from "../controllers/apiPublicController.js";

const router = Router();

router.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "hosa-api",
    timestamp: new Date().toISOString(),
  });
});

router.get("/api/directory", getDirectory);
router.get("/api/directory/:id", getDirectoryMember);

router.get("/api/events", getEvents);
router.get("/api/events/:slug", getEvent);

router.get("/api/stories", getStories);

router.get("/api/opportunities", getOpportunities);

export default router;
