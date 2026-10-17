import { Router } from "express";
import { env } from "../config/env.js";

const router = Router();

router.get("/styleguide", (req, res, next) => {
  if (env.isProd) {
    return res.status(404).type("text/plain").send("Not found");
  }
  res.render("styleguide", { title: "Styleguide — HOSA" });
});

export default router;
