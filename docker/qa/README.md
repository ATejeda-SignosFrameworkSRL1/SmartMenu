# SmartMenu — Ambiente QA en Docker

Stack completo con HTTPS via Caddy `tls internal` (CA local generada por Caddy).

## Servicios

| Servicio | Container | Puerto interno | URL pública |
|---|---|---|---|
| SQL Server | `smartmenu-qa-sqlserver` | 1433 | — (red interna) |
| Redis | `smartmenu-qa-redis` | 6379 | — (red interna) |
| Backend API | `smartmenu-qa-backend` | 8080 | https://api.qa.smartmenu.local |
| client-app | `smartmenu-qa-client` | 3000 | https://qa.smartmenu.local |
| admin-panel | `smartmenu-qa-admin` | 3001 | https://admin.qa.smartmenu.local |
| kds-app | `smartmenu-qa-kds` | 3002 | https://kds.qa.smartmenu.local |
| waiter-app | `smartmenu-qa-waiter` | 3003 | https://waiter.qa.smartmenu.local |
| host-app | `smartmenu-qa-host` | 3004 | https://host.qa.smartmenu.local |
| cashier-app | `smartmenu-qa-cashier` | 3005 | https://cashier.qa.smartmenu.local |
| reservation-app | `smartmenu-qa-reservation` | 3007 | https://reservation.qa.smartmenu.local |
| Caddy (proxy HTTPS) | `smartmenu-qa-caddy` | 80/443 | host:8080 / host:**8443** |

> Caddy expone HTTPS en **`localhost:8443`** del host (no `:443`, para no chocar con servicios del sistema).

## Setup en Windows (one-time)

### 1. Hosts file
Como Administrador, agrega a `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 qa.smartmenu.local api.qa.smartmenu.local admin.qa.smartmenu.local kds.qa.smartmenu.local waiter.qa.smartmenu.local host.qa.smartmenu.local cashier.qa.smartmenu.local reservation.qa.smartmenu.local
```

### 2. Variables de entorno
```powershell
cd docker\qa
copy .env.qa.example .env
# Edita .env si necesitas cambiar passwords o claves
```

### 3. Build + run
```powershell
docker compose -f docker-compose.qa.yml up -d --build
```

Primer arranque tarda ~5-10 min (image pulls + .NET publish + 7 builds de Next.js + EF migrations).

### 4. Confiar en el CA local de Caddy

Caddy generó su CA root en el volumen `caddy-data`. Sácalo y agrégalo al store de Windows:

```powershell
docker exec smartmenu-qa-caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root.crt
certutil -addstore -f Root caddy-root.crt   # como Administrador
```

Después de esto Chrome/Edge muestran candado verde en las URLs `*.qa.smartmenu.local`.

## Smoke test

```powershell
# Backend
curl.exe -k https://api.qa.smartmenu.local:8443/health/ready

# Cliente público (sin login)
curl.exe -k https://api.qa.smartmenu.local:8443/api/menu

# Login admin
curl.exe -k -X POST https://api.qa.smartmenu.local:8443/api/auth/login `
    -H "Content-Type: application/json" `
    -d '{\"email\":\"admin@smartmenu.com\",\"password\":\"Admin123!\"}'
```

## Operación

```powershell
# Logs en vivo de un servicio
docker compose -f docker-compose.qa.yml logs -f backend

# Bajar todo (mantiene volúmenes)
docker compose -f docker-compose.qa.yml down

# Bajar + borrar volúmenes (reset completo)
docker compose -f docker-compose.qa.yml down -v

# Rebuild solo backend
docker compose -f docker-compose.qa.yml build backend
docker compose -f docker-compose.qa.yml up -d backend
```

## Conexiones DB para debug

```
Server:   localhost,1433     (si añades el puerto al compose; por defecto está cerrado)
User:     sa
Password: el de .env (SQL_SA_PASSWORD)
DBs:      DbNewMenu, DbNewMenuAudit
```

Por seguridad QA no expone el puerto 1433 al host. Si lo necesitas, agrega
`ports: ["1433:1433"]` al servicio `sqlserver`.

## Estructura

```
docker/qa/
├── docker-compose.qa.yml      ← orquestación
├── Dockerfile.backend         ← .NET 10 multi-stage
├── Dockerfile.frontend        ← Next.js genérico (ARG APP_PORT)
├── .env.qa.example            ← copiar a .env
├── README.md                  ← este archivo
├── caddy/
│   └── Caddyfile              ← reverse proxy + tls internal
└── sqlserver/
    ├── init.sql               ← crea DbNewMenu + DbNewMenuAudit
    └── entrypoint.sh          ← arranca SQL + aplica init.sql
```
