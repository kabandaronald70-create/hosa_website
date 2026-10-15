# Phase 3C — Frontend switch checklist

## Dev mode (two windows)

1. `server/`: `npm run dev` → INFO lines appear
2. Repo root: `npm run dev` → Vite ready on :5173
3. Visit http://localhost:5173/ — SPA loads
4. Visit http://localhost:5173/#/directory — 16 members render
5. Open DevTools Network — `/api/directory` request goes to :5173 and returns 200
6. Compare with old behavior: same card layout, same filters, same sort
7. Visit http://localhost:5173/#/events — events render
8. Visit http://localhost:5173/#/jobs — opportunities render
9. Visit http://localhost:5173/#/stories — stories render

## Production-like mode (one window)

1. Repo root: `npm run build` → "built in ...ms" and files land in `server/public/dist/`
2. `server/`: `npm run dev`
3. Visit http://localhost:3000/ — SPA loads (not the EJS home)
4. Visit http://localhost:3000/#/directory — members render, no CORS errors
5. Visit http://localhost:3000/login — EJS login page still works
6. Log in → `/dashboard` renders, session cookie set
7. Log out → back to `/`
8. Visit http://localhost:3000/#/directory again while logged out — still works (public)
9. Visit a made-up URL like http://localhost:3000/#/xyz — SPA fallback serves index.html, client router shows 404 view

## Regression checks

- /health still returns JSON
- /api/directory still returns JSON
- A non-existent /api/foo returns JSON `{"error":"API endpoint not found."}`
- A non-existent /login-ish route like /login/abc still goes through Express (redirect or 404, not SPA)
