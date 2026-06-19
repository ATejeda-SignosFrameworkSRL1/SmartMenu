# @smartmenu/ui

Design system compartido de SmartMenu: **primitivos** (shadcn/Radix) + **tokens** de Tailwind.
Modelo: _primitivos compartidos + skin por app_ — la estructura de tokens es común, pero cada
app define los valores de las CSS-variables (su "piel") en su `globals.css`.

## Consumir desde una app

1. **Depender del paquete** (vía npm workspaces, ya enlazado): `"@smartmenu/ui": "*"`.

2. **next.config.mjs** — transpilá el paquete (se distribuye como TS/TSX, sin build step):
   ```js
   const nextConfig = { transpilePackages: ["@smartmenu/ui"], /* ... */ };
   ```

3. **tailwind.config.ts** — usá el preset y agregá el paquete al `content`:
   ```ts
   import preset from "@smartmenu/ui/preset";
   export default {
     presets: [preset],
     content: [
       "./app/**/*.{ts,tsx}",
       "./components/**/*.{ts,tsx}",
       "../packages/ui/src/**/*.{ts,tsx}", // para que Tailwind escanee los primitivos
     ],
   };
   ```

4. **globals.css** — importá el skin base y (opcional) pisá variables para tu skin:
   ```css
   @import "@smartmenu/ui/tokens.css";
   /* Skin propio: redefiní lo que quieras DESPUÉS del import */
   :root { --primary: 41 88% 38%; /* dorado */ }
   ```

5. **Usar** los primitivos:
   ```tsx
   import { Button, Card, Badge, cn } from "@smartmenu/ui";
   ```

## Primitivos disponibles
`Button` · `Card` (+ Header/Title/Description/Content/Footer) · `Badge` · `Input` · `Label` · `cn()`

> Se irán agregando más (Dialog, Tooltip, Select…) a medida que se centralizan desde las apps.
