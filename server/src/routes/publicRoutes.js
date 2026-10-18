import { Router } from "express";
import {
  showAbout,
  showPrivacy,
  showTerms,
  showHelp,
  showContact,
  showMentorshipInfo,
} from "../controllers/publicPageController.js";

const router = Router();

router.get("/about", showAbout);
router.get("/privacy", showPrivacy);
router.get("/terms", showTerms);
router.get("/help", showHelp);
router.get("/contact", showContact);
router.get("/mentorship", showMentorshipInfo);

export default router;
