# Deployment (Render)

Two Render services from one repo:

1. **Static Site** — repo root, build `npm install && npm run build`, publish `dist/`.
2. **Web Service** — Root Directory `server`, build `npm install`, start `npm start`.

## Env vars on Web Service

- `NODE_ENV=production`
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `SESSION_SECRET`
- `APP_ORIGIN=https://<static-site-domain>`

For production DB use Supabase Free with SSL (the app enables SSL when
`NODE_ENV=production`).

## Migrations in production

The Web Service start command (`npm start`) applies pending database migrations
before starting the server. To apply migrations manually from the Render Shell
(with `server` as the working directory), run:

```sh
npm run migrate
```
