export function setCurrentPath(req, res, next) {
  res.locals.currentPath = req.path;
  next();
}
