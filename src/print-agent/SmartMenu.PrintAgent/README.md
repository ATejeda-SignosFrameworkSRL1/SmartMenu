# SmartMenu Print Agent (comandas Cocina / Bar)

Agente de impresion para comandas. Corre en la **PC donde esta conectada la impresora
termica USB** (la `2C-POS80-01-V6`), escucha el hub `/hubs/kitchen` del backend y, cada vez
que un mesero **confirma** una orden, imprime la comanda. El KDS (pantalla) sigue funcionando
igual, en paralelo: la pantalla es el estado en vivo; el papel es la comanda fisica.

## Por que un agente (y no impresion directa desde el backend)

El backend corre en Docker y **no puede ver una impresora USB**. El agente vive en la PC del
punto de venta, se conecta *hacia* el backend (igual que un navegador) y manda los bytes
ESC/POS a la impresora por el spooler de Windows. No requiere abrir puertos ni IP en la impresora.

## Reparto Cocina / Bar

Por cada orden se imprimen **dos tickets** (configurable): uno **COCINA** (comida) y uno **BAR**
(bebidas), con un corte entre ambos para repartirlos. El criterio de "es bebida" usa **la misma
lista de palabras clave que el backend** (`OrderService.DrinkKeywords`) — ver `Comanda.cs`. Si
cambias esa lista en el backend, actualizala tambien aqui.

> Con `SplitTickets: false` se imprime **un solo ticket** con secciones `--- COCINA ---` y `--- BAR ---`.

## Requisito IMPORTANTE del driver

El agente manda **ESC/POS en crudo (RAW)**. Eso funciona solo si la impresora esta instalada en
Windows con un driver que **deja pasar los bytes tal cual**:

- El **driver ESC/POS del fabricante** (POS80 / "Generic ESC/POS"), **o**
- El driver **"Generic / Text Only"** de Windows.

Si esta instalada con un driver **grafico** (rasteriza), el RAW no se vera bien o no imprimira.
En ese caso, reinstala la impresora como *Generic / Text Only* apuntando al mismo puerto USB.

## Configuracion (`appsettings.json`)

| Clave | Default | Que es |
|---|---|---|
| `BackendUrl` | `https://172.31.98.60:8443` | Base del backend (Caddy LAN). Debe exponer `/api` y `/hubs`. |
| `Auth.Email` / `Auth.Password` | `admin@smartmenu.com` / `Admin123!` | Cuenta de staff para el hub (rol Admin/Manager/Chef/KitchenStaff/Bartender). |
| `PrinterName` | `2C-POS80-01-V6` | Nombre **exacto** de la impresora en Windows. |
| `SplitTickets` | `true` | `true` = 2 tickets (Cocina + Bar). `false` = 1 ticket con dos secciones. |
| `IgnoreTlsErrors` | `true` | Acepta el certificado autofirmado de Caddy en la LAN. |
| `CodePage` | `858` | Tabla de caracteres (tildes/enie). Alternativas: `850`, `437`. |
| `DedupSeconds` | `10` | Ignora reimpresiones de la misma orden dentro de N seg (evita duplicados por reconexion). |
| `PaperWidthChars` | `48` | Ancho del papel (80mm Fuente A = 48; 58mm = 32). |

Cualquier clave se puede sobreescribir por variable de entorno con prefijo `PRINTAGENT__`
(doble guion bajo), p. ej. `PRINTAGENT__PRINTERNAME`, `PRINTAGENT__AUTH__PASSWORD`.

## Comandos

```powershell
# Vista previa del formato a consola (sin impresora ni backend)
dotnet run -- preview

# Imprime un ticket de PRUEBA en la impresora configurada
dotnet run -- test

# Reimprime una orden existente por id
dotnet run -- order 123

# Sin argumentos: modo normal (escucha el hub e imprime cada comanda)
dotnet run
```

## Publicar y dejarlo corriendo en la PC del POS

```powershell
# Genera un unico .exe autocontenido (no requiere instalar .NET en la PC del POS)
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true

# Copia la carpeta publish\ a la PC de la impresora y prueba:
SmartMenu.PrintAgent.exe test
```

Para que arranque solo: crear una tarea en el **Programador de tareas** ("Al iniciar sesion",
reiniciar si falla) o un acceso directo al `.exe` en la carpeta `shell:startup`.
(Convertirlo en **Servicio de Windows** queda para Fase 2.)

## Como funciona (flujo)

1. Mesero confirma la orden -> el backend emite `NewKitchenOrder` al grupo `kitchen` (igual que hoy al KDS).
2. El agente recibe el evento con el `orderId`.
3. Hace `GET /api/order/{id}` (endpoint anonimo) para traer la orden completa.
4. Reparte los items en Cocina / Bar y arma los tickets ESC/POS.
5. Envia cada ticket a la impresora por el spooler (cada uno en su propio try/catch: si una
   impresion falla, no tumba la otra ni el agente).

## Limitaciones de la Fase 1 (futuras mejoras)

- Imprime la **orden completa** en cada evento (no solo los items nuevos al agregar). El anti-duplicado
  evita reimpresiones por reconexion, pero "agregar items" reimprime todo. Delta de items = Fase 2.
- Una sola impresora compartida: los dos tickets salen en el mismo equipo. Una impresora por
  estacion = cambiar a dos perfiles de impresora (Fase 2).
- Sin cola persistente: si la impresora esta apagada al llegar la comanda, se pierde esa impresion
  (queda el KDS). Cola con reintentos = Fase 2.
