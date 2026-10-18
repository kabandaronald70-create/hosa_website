import { Router } from "express";
import {
  showDirectory,
  showMemberDetail,
  showEvents,
  showEventDetail,
  showStories,
  showStoryDetail,
  showJobs,
} from "../controllers/publicEjsController.js";

const router = Router();

router.get("/directory", showDirectory);
router.get("/directory/:id", showMemberDetail);
router.get("/events", showEvents);
router.get("/events/:slug", showEventDetail);
router.get("/stories", showStories);
router.get("/stories/:slug", showStoryDetail);
router.get("/jobs", showJobs);

export default router;
