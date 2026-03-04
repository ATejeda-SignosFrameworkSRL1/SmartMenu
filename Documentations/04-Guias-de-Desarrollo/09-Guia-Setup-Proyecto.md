# 09 - Guía de Setup del Proyecto

**Proyecto:** SmartMenu  
**Última Actualización:** 7 de Febrero de 2026

---

## 📋 REQUISITOS PREVIOS

### Software Requerido

#### Backend (.NET)
- **.NET 9 SDK** - [Descargar](https://dotnet.microsoft.com/download/dotnet/9.0)
- **SQL Server 2022** o **Azure SQL** - [Descargar](https://www.microsoft.com/sql-server/sql-server-downloads)
- **Visual Studio 2022** o **VS Code** - [Descargar](https://visualstudio.microsoft.com/)

#### Frontend (React/Next.js)
- **Node.js 20.x** o superior - [Descargar](https://nodejs.org/)
- **npm** 10.x o superior (incluido con Node.js)
- **VS Code** - [Descargar](https://code.visualstudio.com/)

#### Herramientas Opcionales
- **Git** - [Descargar](https://git-scm.com/)
- **Postman** - [Descargar](https://www.postman.com/downloads/)
- **Docker Desktop** (opcional) - [Descargar](https://www.docker.com/products/docker-desktop)

---

## 🚀 INSTALACIÓN PASO A PASO

### 1. Clonar el Repositorio

```bash
# HTTPS
git clone https://github.com/your-repo/SmartMenu.git

# SSH
git clone git@github.com:your-repo/SmartMenu.git

cd SmartMenu
```

---

### 2. Configurar Base de Datos

#### Opción A: SQL Server Local

1. **Instalar SQL Server 2022**
   ```bash
   # Windows
   # Descargar e instalar desde Microsoft
   
   # macOS/Linux (usando Docker)
   docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" \
      -p 1433:1433 --name sqlserver \
      -d mcr.microsoft.com/mssql/server:2022-latest
   ```

2. **Crear Base de Datos**
   ```sql
   CREATE DATABASE DbNewMenu;
   GO
   ```

#### Opción B: SQL Server Remoto (Usado en este proyecto)

```
Servidor: sqldev.signos.com.do
Puerto: 1599
Usuario: sa
Password: 12345678
Database: DbNewMenu
```

---

### 3. Configurar Backend

#### 3.1 Navegar al Proyecto Backend
```bash
cd src/backend/SmartMenu.API
```

#### 3.2 Configurar Connection String

Editar `appsettings.json`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=sqldev.signos.com.do,1599;Database=DbNewMenu;User Id=sa;Password=12345678;TrustServerCertificate=True;Encrypt=False;"
  },
  "Jwt": {
    "Key": "tu-clave-secreta-super-segura-de-al-menos-32-caracteres",
    "Issuer": "SmartMenuAPI",
    "Audience": "SmartMenuClient",
    "ExpiryMinutes": 1440
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

#### 3.3 Instalar Paquetes NuGet
```bash
dotnet restore
```

#### 3.4 Aplicar Migraciones
```bash
dotnet ef database update --project ../SmartMenu.Infrastructure --startup-project .
```

#### 3.5 Verificar Instalación
```bash
dotnet build
```

Si todo está correcto, verás: `Build succeeded.`

---

### 4. Configurar Frontend

El proyecto tiene 4 aplicaciones frontend:

#### 4.1 Client App (Puerto 3000)
```bash
cd src/frontend/client-app
npm install
```

Crear `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5041
```

#### 4.2 Admin Panel (Puerto 3001)
```bash
cd ../admin-panel
npm install
```

Crear `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5041
```

#### 4.3 KDS App (Puerto 3002)
```bash
cd ../kds-app
npm install
```

Crear `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5041
```

#### 4.4 Waiter App (Puerto 3003)
```bash
cd ../waiter-app
npm install
```

Crear `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5041
```

---

## ▶️ EJECUTAR EL PROYECTO

### Opción 1: Manualmente (Desarrollo)

#### Terminal 1 - Backend
```bash
cd src/backend/SmartMenu.API
dotnet run
```

Verás:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5041
```

#### Terminal 2 - Client App
```bash
cd src/frontend/client-app
npm run dev
```

#### Terminal 3 - Admin Panel
```bash
cd src/frontend/admin-panel
npm run dev
```

#### Terminal 4 - KDS App
```bash
cd src/frontend/kds-app
npm run dev
```

#### Terminal 5 - Waiter App
```bash
cd src/frontend/waiter-app
npm run dev
```

### Opción 2: PowerShell Script (Windows)

Crear `start-all.ps1`:
```powershell
# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd src\backend\SmartMenu.API; dotnet run"

# Frontend Apps
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd src\frontend\client-app; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd src\frontend\admin-panel; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd src\frontend\kds-app; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd src\frontend\waiter-app; npm run dev"

Write-Host "Todos los servicios iniciados"
```

Ejecutar:
```powershell
.\start-all.ps1
```

---

## ✅ VERIFICAR INSTALACIÓN

### 1. Backend
```bash
# Health Check
curl http://localhost:5041/health

# Respuesta esperada:
# {"status":"OK","timestamp":"..."}
```

### 2. Swagger UI
Abrir navegador: `http://localhost:5041/swagger`

### 3. Frontend Apps
- Client/Login: `http://localhost:3000`
- Admin Panel: `http://localhost:3001`
- KDS App: `http://localhost:3002`
- Waiter App: `http://localhost:3003`

### 4. Probar Login
```bash
curl -X POST http://localhost:5041/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@smartmenu.com",
    "password": "Admin123!"
  }'
```

Respuesta esperada: Token JWT

---

## 🗃️ SEED DATA

El sistema automáticamente carga datos de prueba en el primer arranque:

- **1 Restaurant**
- **5 Users** (Admin, Chef, Waiter, Cashier, Bartender)
- **3 Zones** (Terraza, Salón Principal, Privado)
- **20 Tables**
- **4 Categories**
- **20 Dishes**

### Usuarios de Prueba
```
Admin:   admin@smartmenu.com    / Admin123!
Chef:    chef@smartmenu.com     / Chef123!
Waiter:  waiter@smartmenu.com   / Waiter123!
Cashier: cashier@smartmenu.com  / Cash123!
```

---

## 🐛 TROUBLESHOOTING

### Problema: Puerto 5041 en uso
```bash
# Windows
netstat -ano | findstr :5041
taskkill /PID [PID] /F

# macOS/Linux
lsof -i :5041
kill -9 [PID]
```

### Problema: Puerto 3000-3003 en uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID [PID] /F

# macOS/Linux
lsof -i :3000
kill -9 [PID]
```

### Problema: Error de Connection String
```
Error: Cannot connect to SQL Server
```

**Solución:**
1. Verificar SQL Server está corriendo
2. Verificar credenciales en `appsettings.json`
3. Verificar firewall permite conexión
4. Probar conexión con SSMS

### Problema: Migrations Error
```bash
# Resetear database
dotnet ef database drop --force --project ../SmartMenu.Infrastructure --startup-project .

# Recrear
dotnet ef database update --project ../SmartMenu.Infrastructure --startup-project .
```

### Problema: npm install falla
```bash
# Limpiar cache
npm cache clean --force

# Eliminar node_modules
rm -rf node_modules package-lock.json

# Reinstalar
npm install
```

---

## 🔧 CONFIGURACIÓN ADICIONAL

### VS Code Extensions Recomendadas

#### Para .NET
- C# (Microsoft)
- C# Dev Kit (Microsoft)
- NuGet Gallery (pcislo)

#### Para React/TypeScript
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- Tailwind CSS IntelliSense

### Configuración de VS Code

Crear `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": ".NET Core Launch (web)",
      "type": "coreclr",
      "request": "launch",
      "preLaunchTask": "build",
      "program": "${workspaceFolder}/src/backend/SmartMenu.API/bin/Debug/net9.0/SmartMenu.API.dll",
      "args": [],
      "cwd": "${workspaceFolder}/src/backend/SmartMenu.API",
      "stopAtEntry": false,
      "serverReadyAction": {
        "action": "openExternally",
        "pattern": "\\bNow listening on:\\s+(https?://\\S+)"
      },
      "env": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  ]
}
```

---

## 📦 ESTRUCTURA DE PUERTOS

```
Backend API:       5041
Client App:        3000
Admin Panel:       3001
KDS App:           3002
Waiter App:        3003

SignalR Hubs:
- /hubs/orders     (Port 5041)
- /hubs/kitchen    (Port 5041)
- /hubs/tables     (Port 5041)
```

---

## 🔒 CONFIGURACIÓN DE SEGURIDAD

### Cambiar JWT Secret (Producción)

Generar clave segura:
```bash
openssl rand -base64 64
```

Actualizar `appsettings.Production.json`:
```json
{
  "Jwt": {
    "Key": "[clave-generada-aquí]"
  }
}
```

### Variables de Entorno (Recomendado)
```bash
# Windows
$env:JWT_KEY="tu-clave-super-segura"

# Linux/macOS
export JWT_KEY="tu-clave-super-segura"
```

---

## 📝 PRÓXIMOS PASOS

1. ✅ Verificar que todos los servicios corren
2. ✅ Login con usuarios de prueba
3. ✅ Probar flujo de QR (Cliente)
4. ✅ Probar crear orden
5. ✅ Probar KDS (Chef)
6. ✅ Probar Waiter App
7. ✅ Explorar Admin Panel
8. 📖 Leer [Estándares de Código](./10-Estandares-Codigo.md)
9. 🧪 Ejecutar [Tests](./11-Testing.md)

---

**Estado:** ✅ Guía Completa y Verificada  
**Última Actualización:** 7 de Febrero de 2026
