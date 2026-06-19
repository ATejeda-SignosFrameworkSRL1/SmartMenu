# SmartMenu — Host / Hostess

Next.js 14 app. Parte del stack SmartMenu (full-stack restaurant ordering system).

## Quick start

```bash
npm ci
npm run dev        # http://localhost:3004
npm run build      # production build
npm run start      # production server
npm run lint
npm run type-check
```

## Env vars

| Variable | Default | Descripción |
|---|---|---|
| `BACKEND_HTTP_URL` | `http://localhost:5041` | Server-side proxy target (Next rewrites `/api`, `/uploads`, `/hubs`) |
| `NEXT_PUBLIC_API_URL` | `` | Browser-side API base (vacío = mismo origen) |
| `NEXT_PUBLIC_WS_URL` | `` | SignalR base (vacío = mismo origen) |
| `NEXT_PUBLIC_SENTRY_DSN` | (vacío) | Activa logging Sentry. Sin esto, errores van a console |

## Stack interno

- **Auth**: `lib/auth-client.ts` → `createAuthApi('host-app')` provee axios + interceptor JWT con refresh transparente
- **Errores**: `app/error.tsx` + `app/global-error.tsx` capturan throws + log a `lib/sentry.ts`
- **Login**: `<LoginScreen appKey="host-app" .../>` componente compartido en `components/LoginScreen.tsx`
- **Roles aceptados**: Host, Hostess (+ Admin)

## Docker QA

Forma parte de `docker/qa/docker-compose.qa.yml` — se levanta junto al resto del stack:

```bash
docker compose -f docker/qa/docker-compose.qa.yml up -d --build
```
