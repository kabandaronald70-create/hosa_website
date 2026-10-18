export function notFound(req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.status(404).render("public/404", {
    title: "Page Not Found",
    layout: "layouts/public",
  });
}
