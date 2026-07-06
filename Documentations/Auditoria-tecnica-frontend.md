# Auditoria tecnica del frontend SmartMenu

> Generada el 30/jun/2026 con un harness multi-agente: 8 auditores en paralelo (uno por app + barrido cross-app)
> y verificacion ADVERSARIAL independiente de todo hallazgo ALTA y de toda eliminacion propuesta.
> Solo se reportan como confirmados los hallazgos cuyo codigo fue re-leido y cuya evidencia sobrevivio la refutacion.

**Stats:** 77 hallazgos brutos -> 77 tras dedup -> **30 confirmados** / 0 refutados / 47 de menor prioridad sin verificar (listados al final).

Apps auditadas: client-app, admin-panel, kds-app, waiter-app, host-app, cashier-app, reservation-app + duplicacion cross-app.

## 1. Codigo sucio (Clean Code) (3 confirmados)

### 1. [ALTA] KDSPage es un God component de ~490 LOC con 4 niveles de IIFEs anidados en el JSX

**App:** kds-app - **Archivo:** `src/frontend/kds-app/app/page.tsx` (lineas 101-586) - **Verificado:** si

Un solo componente concentra: auth/handoff de URL, fetch + filtrado por rol/zona (loadOrders, 176-247), suscripcion SignalR, tabs de filtro duales (bar/cocina, 338-397), calculo de empty-state (408-441) y la tarjeta de orden completa (~130 lineas, 460-577) con tres IIFEs inline ((() => {...})() en 492-493, 510-537 y 545-575). Mantenibilidad: cualquier cambio re-renderiza y re-testea todo; imposible testear la tarjeta o el filtrado en aislamiento. handlePreparing/handleReady (264-286) son ademas duplicados byte-a-byte salvo el endpoint. Refactor: extraer useKitchenOrders() (fetch+filtro+SignalR), <FilterTabs>, <OrderCard> y un updateSection(orderId, 'preparing'|'ready') unico.

**Antes:**
```tsx
) : (() => {
  // KDS-NAV.1 — empty state claro por tab vacío...
  const matchingItemsTotal = orders.reduce((acc, o) => {...}, 0);
  ...
  return (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {orders.map((order) => { /* ~130 líneas de tarjeta inline con 3 IIFEs */ })}
```
**Despues:**
```tsx
const { orders, visibleOrders } = useKitchenOrders(isBar, courseFilter, drinkTimingFilter);
const updateSection = async (orderId: number, action: 'preparing' | 'ready') => {
  const prefix = isBar ? 'bar' : 'kitchen';
  try {
    await api.put(`/api/order/${orderId}/${prefix}-${action}`);
    toast.success(t(action === 'ready' ? 'toastReady' : 'toastPreparing'));
    loadOrders();
  } catch { toast.error(t('toastUpdateError')); }
};
return visibleOrders.length === 0
  ? <EmptyTabState isBar={isBar} onViewAll={resetFilter} />
  : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {visibleOrders.map(o => <OrderCard key={o.id} order={o} isBar={isBar} onAction={updateSection} />)}
    </div>;
```
> **Nota del verificador:** Verificado en el archivo real: KDSPage ocupa las lineas 101-586 (~486 LOC) y concentra auth/handoff de URL (110-153), loadOrders con filtrado por rol/zona (176-247), SignalR + polling de 5s (156-172), tabs duales bar/cocina (338-397), empty-state en IIFE (408-441) y la tarjeta inline (460-577) con IIFEs en 492-493, 510-537 y 545-575; el snippet 'before' coincide literalmente (") : (() => {", comentario KDS-NAV.1, matchingItemsTotal, grid en 444). Dos imprecisiones menores: handlePreparing/handleReady (264-286) difieren tambien en la clave del toast (toastPreparing vs toastReady), no solo en el endpoint —el 'after' propuesto ya lo maneja correctamente con el ternario— y son "3 IIFEs internas dentro de 2 maps dentro de 1 IIFE externa" mas que 4 niveles estrictos de IIFEs. El fix es correcto como sketch, con una advertencia: useKitchenOrders debe conservar el patron userRef (el rol/zona se lee via ref dentro del setInterval de 5s y del callback SignalR para evitar closures obsoletos) y el polling de respaldo; nada del codigo actual debe eliminarse, solo reestructurarse, por lo que critical_to_keep=false. Prioridad ALTA es razonable dentro de la dimension 'clean' (pantalla operativa central, imposible de testear en aislamiento, duplicacion real).

### 2. [ALTA] God component: HostApp concentra 3 vistas, 8 modales y ~40 useState en 2.756 líneas

**App:** host-app - **Archivo:** `src/frontend/host-app/app/page.tsx` (lineas 116-2872) - **Verificado:** si

Un solo componente contiene: vista Mesas (con plano Konva, filtros de zona/estado/capacidad/tiempo y slots), vista Reservas (filtros status/fecha/búsqueda, agrupado por fecha), CalendarView, y 8 modales inline (asignación walk-in, wizard, ocupación por mesa con mini-calendario, reasignación con selector de zona, reschedule, calendar-day, cancelación, zona exclusiva, contacto). Cualquier setState (cada tecla en searchQuery, cada tick de polling de 30s) re-renderiza el árbol completo, incluidos los IIFE inline por tarjeta de mesa que filtran/ordenan reservations en cada render (líneas 1762-1775). Mantenibilidad crítica: es imposible razonar sobre un cambio local sin riesgo de romper otra vista. Al extraer, CONSERVAR tal cual el guard de hidratación `mounted` (evita React #418) y los setInterval de 30s de loadData/loadReservations (respaldo intencional de SignalR).

**Antes:**
```tsx
export default function HostApp() {
  const t = useTranslations();
  const dl = dateLocale(useLocale());
  const [user, setUser] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  // ... ~40 useState más + 8 modales y 3 vistas inline hasta la línea 2872
```
**Despues:**
```tsx
// app/page.tsx — orquestador delgado: auth + SignalR + polling de respaldo + tabs
export default function HostApp() {
  const [activeView, setActiveView] = useState<'tables' | 'reservations' | 'calendar'>('tables');
  // mounted guard + loadData/loadReservations + intervalos 30s SIN CAMBIOS (fail-safes intencionales)
  return (
    <>
      <HostHeader user={user} stats={stats} activeView={activeView} onViewChange={setActiveView} />
      {activeView === 'tables' && <TablesView tables={tables} reservations={reservations} onRefresh={loadData} />}
      {activeView === 'reservations' && <ReservationsView reservations={reservations} onRefresh={loadReservations} />}
      {activeView === 'calendar' && <CalendarView reservations={reservations} onDayClick={setCalendarDaySelected} />}
      {/* modales extraídos: components/modals/AssignTableModal.tsx, TableOccupancyModal.tsx, RescheduleModal.tsx, ... */}
    </>
  );
}
```
> **Nota del verificador:** Confirmado con lectura directa: HostApp abarca exactamente las lineas 116-2872 (cierre verificado por grep de limites de funcion), el snippet 'before' coincide literalmente con las lineas 116-122, hay 54 useState (mas que los ~40 reportados), 3 vistas via activeView (linea 138), 9-10 bloques modales inline (1926, 1966, 2116, 2169, 2182, ~2245, 2325, 2374, 2478, 2722) y el IIFE que filtra/ordena reservations por tarjeta en 1761-1775 tal cual. Los fail-safes que el fix exige conservar existen y son necesarios: guard mounted (124-128, comentado como fix del #418) y los dos setInterval de 30s (555-556) que respaldan el hub SignalR /hubs/reservations (461-515); el 'after' propuesto los preserva explicitamente, asi que es correcto. Unica imprecision menor: el wizard ya esta extraido como componente (@/components/HostReservationWizard, import linea 8), solo su estado de apertura vive inline — no refuta el hallazgo. Prioridad ALTA justificada para dimension clean; critical_to_keep=false porque es refactor, no eliminacion de codigo.

### 3. [MEDIA] DishFormModal es un God component: 3 handlers async de ~15-40 líneas incrustados en el JSX con lógica de auth duplicada 4 veces

**App:** admin-panel - **Archivo:** `src/frontend/admin-panel/app/menu/page.tsx` (lineas 335-710) - **Verificado:** si

El archivo mide 710 líneas y DishFormModal ~375. Dentro del JSX viven inline: set-main-image (L561-570), delete-image (L573-582) y el handler de upload multi-archivo de 40 líneas (L597-637). Cada uno repite el mismo ritual: localStorage.getItem('admin_token') + construir headers + fetch crudo (mezclando fetch y axios en el mismo archivo) + catch con toast. El upload además usa NEXT_PUBLIC_WS_URL como base (L606) mientras el resto usa el proxy same-origin — inconsistencia de origen que complica CORS y las URLs resultantes. Mantenibilidad: cualquier cambio al manejo de imágenes exige tocar 3 bloques JSX distintos. Extraer un hook useDishImages(dishId) con uploadImages/setMain/removeImage y un subcomponente DishImageManager.

**Antes:**
```tsx
<button type="button" onClick={async () => {
  try {
    const token = localStorage.getItem('admin_token');
    await fetch(`/api/dish/${dish.id}/images/${img.id}/set-main`, {
      method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    ...
  } catch { toast.error(t('errorGeneric')); }
}} ...>⭐</button>
```
**Despues:**
```tsx
// lib/useDishImages.ts
export function useDishImages(dishId: number | null, initial: DishImage[], onMainChange?: (url: string) => void) {
  const [images, setImages] = useState(initial);
  const setMain = async (imgId: number) => {
    await api.put(`/api/dish/${dishId}/images/${imgId}/set-main`);
    setImages(p => p.map(i => ({ ...i, isMain: i.id === imgId })));
    const img = images.find(i => i.id === imgId);
    if (img) onMainChange?.(img.imageUrl); // CRITICO: el codigo actual tambien sincroniza formData.imageUrl (L568); omitirlo rompe el guardado de la imagen principal
  };
  const remove = async (imgId: number) => { await api.delete(`/api/dish/${dishId}/images/${imgId}`); setImages(p => p.filter(i => i.id !== imgId)); };
  const upload = async (files: FileList) => { /* logica de L597-637, pero via proxy same-origin `/api/upload/dish-image` (sin NEXT_PUBLIC_WS_URL) y usando `api` para que Authorization viaje siempre */ };
  return { images, setMain, remove, upload };
}
// En el JSX: <DishImageManager {...useDishImages(dish?.id ?? null, (dish as any)?.images ?? [], (url) => setFormData(p => ({ ...p, imageUrl: url })))} />
// Nota: los fetch actuales NO comprueban res.ok en set-main/delete (actualizan estado aunque el backend devuelva 401/500); migrar a axios corrige eso gratis.
```
> **Nota del verificador:** Confirmado con lectura directa: el archivo mide exactamente 710 lineas, DishFormModal ocupa L335-710, y los 3 handlers inline existen tal cual (set-main L561-570 coincide verbatim con el snippet 'before', delete L573-582, upload L597-637) con localStorage.getItem('admin_token') repetido 4 veces dentro del modal (L386, 563, 575, 601) mezclando axios y fetch crudo. La afirmacion sobre NEXT_PUBLIC_WS_URL en L606 es cierta, pero en admin-panel esa variable por defecto es '' (next.config.mjs L22 y README: vacio = mismo origen), asi que el riesgo CORS solo se materializa si se configura una URL absoluta — por eso, siendo un hallazgo de dimension 'clean' sin bug activo en la config por defecto, rebajo la prioridad a MEDIA. El fix propuesto es direccionalmente correcto pero su setMain omite la sincronizacion de formData.imageUrl (L568 del codigo actual), que se envia al guardar el plato; la version corregida agrega el callback onMainChange para preservar ese comportamiento.

## 2. Codigo muerto o no utilizado (13 confirmados)

### 4. [ALTA] Todo el flujo de cierre de turno con handover (~260 lineas) es inalcanzable

**App:** waiter-app - **Archivo:** `src/frontend/waiter-app/app/page.tsx` (lineas 1508-1575, 1781-1973) - **Verificado:** si

Grep 'openEndShiftModal' en toda la waiter-app: 1 sola aparicion = su declaracion (linea 1533). 'setShowEndShiftModal(true)' solo existe DENTRO de esa funcion (linea 1540), asi que showEndShiftModal jamas puede ser true y el modal completo de 3 pasos (1781-1973, ~190 lineas de JSX) nunca se renderiza. Arrastra consigo: loadShift (Grep: 1 = declaracion), startShift (Grep: declaracion; el otro hit es la clave i18n 'shift.startShift'), endShift, closeShiftModal y los estados shiftStep/shiftSummary/shiftResult/shiftLoadingModal/endShiftTransferTo. El comentario en 1755-1756 lo confirma: 'turno auto-gestionado por login/logout. Sin boton de cerrar' — se quito el boton y quedo huerfano todo el mecanismo. Nota: NO borrar activeShift ni el cierre de turno en handleLogout (1577-1588), esos si se usan. Impacto: ~260 lineas de ruido en el archivo mas caliente de la app y bundle innecesario.

**Antes:**
```tsx
const openEndShiftModal = async () => {
  const uid = getUserId(user);
  if (!uid) return;
  setShiftStep(1);
  ...
  setShowEndShiftModal(true);   // <- unico setter a true, dentro de una funcion que nadie llama
```
> **Nota del verificador:** Confirmado con Read+Grep: openEndShiftModal (1533) tiene 1 sola aparicion en todo src/frontend (su declaracion) y setShowEndShiftModal(true) solo existe dentro de ella (1540), por lo que el modal 1781-1973 es inalcanzable; loadShift y startShift tampoco tienen llamadas (los otros hits de startShift son claves i18n en messages/*.json), y endShift/closeShiftModal/shiftStep/shiftSummary/shiftResult/shiftLoadingModal/endShiftTransferTo solo se referencian dentro del JSX muerto. No es critico conservarlo: el efecto de carga inicial (lineas 813-818) consulta /api/waitershift/active inline sin usar loadShift, y handleLogout (1577-1588) cierra el turno con su propio api.put sin usar endShift, asi que activeShift y el badge 'on shift' (1757) siguen vivos tal como el hallazgo advierte. El comentario en 1755-1756 confirma el diseno intencional (turno auto-gestionado por login/logout). Las exclusiones propuestas (mantener activeShift, handleLogout y loadWaiters — este ultimo tiene llamada viva en 1201) son correctas; prioridad ALTA razonable para dimension dead (~260 lineas + JSX en el archivo mas grande de la app).

### 5. [MEDIA] Componente QrScanner completo (171 líneas + cámara) sin ningún consumidor

**App:** client-app - **Archivo:** `src/frontend/client-app/components/QrScanner.tsx` (lineas 1-171) - **Verificado:** si

Grep de 'QrScanner|parseQrContent' en toda la app: 5 apariciones, TODAS dentro de components/QrScanner.tsx (declaración, interface y usos internos); ningún import desde app/ ni components/. El flujo real de escaneo usa la cámara nativa del teléfono que abre la URL /table/{qrCode} directamente, así que este scanner in-app (con manejo de html5-qrcode, secure context y permisos de cámara) quedó huérfano. Impacto: 171 líneas de código sensible (streams de cámara) que hay que mantener sin que nadie lo ejecute, y la dependencia 'html5-qrcode' (^2.3.8) en package.json queda instalada solo para él (mismo caso: '@microsoft/signalr' está en package.json y Grep de 'signalr|HubConnection' en el código = 0 usos). Si hay plan de escaneo in-app, documentarlo; si no, borrar componente + ambas dependencias.

**Antes:**
```tsx
export function QrScanner({ onScan, onError, onClose }: QrScannerProps) {
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2)}`).current;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
```
> **Nota del verificador:** Confirmado: el snippet aparece exacto en líneas 48-50 y el archivo tiene 171 líneas. Grep de QrScanner|parseQrContent en todo src/frontend solo da usos internos del propio archivo en client-app; los usos de waiter-app apuntan a su copia propia (waiter-app/app/components/QrScanner.tsx vía import relativo), no a este archivo, y no hay re-exports, imports por string ni tests. También verificado el claim secundario: html5-qrcode solo se usa dentro del componente huérfano y @microsoft/signalr tiene 0 usos en el código de client-app (solo package.json/lock; tampoco hay hubs/WebSocket, la app usa polling). Borrar componente + ambas deps de client-app es seguro porque cada app tiene su package.json independiente; prioridad MEDIA razonable.

### 6. [MEDIA] createAuthApi (167 líneas de auth con refresh JWT) nunca se usa — el README dice lo contrario

**App:** client-app - **Archivo:** `src/frontend/client-app/lib/auth-client.ts` (lineas 1-167) - **Verificado:** si

Grep de 'createAuthApi|auth-client' en client-app: 3 coincidencias — la declaración en lib/auth-client.ts:56, su propio docstring, y README.md:27 que afirma "lib/auth-client.ts → createAuthApi('client-app') provee axios + interceptor JWT". Falso: lib/api.ts crea su propio axios sin refresh y ningún archivo importa auth-client. El client-app es anónimo por diseño (comentario en lib/api.ts:31-35), así que toda la maquinaria de refresh-token/singleton-lock/logout-redirect es peso muerto copiado de las staff apps. Impacto: mantenibilidad (dos capas de axios que parecen competir) y documentación engañosa para el próximo dev. Borrar el archivo y corregir la línea del README.

**Antes:**
```tsx
export function createAuthApi(appKey: string, options: AuthApiOptions = {}): AuthApi {
  const {
    baseURL = '',
    refreshPath = '/api/auth/refresh',
    loginPath = '/login',
```
> **Nota del verificador:** Confirmado: el snippet 'before' aparece literal en client-app/lib/auth-client.ts:56-60 y el grep en TODO src/frontend muestra que dentro de client-app solo hay 3 coincidencias (declaración, docstring propio y README.md:27) — ningún import real. Los demás usos de createAuthApi son copias standalone por app (cashier/host/kds/waiter/reservation/admin-panel, incluido el test de admin-panel que importa su copia local ../auth-client), así que borrar la copia de client-app no rompe nada. lib/api.ts:31-35 confirma que el client-app es anónimo por diseño y maneja los 401 sin refresh; no hay dependencia de SignalR/SSR/concurrencia sobre este archivo. El fix propuesto (borrar el archivo + corregir README.md:27 para describir lib/api.ts) es correcto y la prioridad MEDIA es adecuada.

### 7. [MEDIA] Módulo lib/utils.ts entero (13 funciones, 127 líneas) sin un solo import

**App:** client-app - **Archivo:** `src/frontend/client-app/lib/utils.ts` (lineas 1-127) - **Verificado:** si

Grep de `from '@/lib/utils'` en toda la app = 0 resultados; Grep de cada símbolo (cn, formatPrice, formatDate, formatDuration, truncate, validateRNC, calculateITBIS, calculateLegalTip, generateTableQR, getInitials, validateEmail, generateOrderNumber, debounce) = 1 sola aparición cada uno: su declaración. Ironías costosas: (a) validateRNC está muerto mientras app/payment/[id]/page.tsx:87-88 reimplementa la validación de longitud inline; (b) las páginas formatean precios a mano con `RD$ {x.toFixed(2)}` en ~20 sitios en vez de formatPrice/Intl; (c) calculateITBIS/calculateLegalTip duplican los 0.18/0.10 hardcodeados del cartStore. Decisión recomendada: o se adoptan los helpers (mejor), o se borra el módulo — el estado actual es el peor de ambos mundos.

**Antes:**
```tsx
export function validateRNC(rnc: string): boolean {
  // RNC debe tener 9 o 11 dígitos
  const cleaned = rnc.replace(/[^0-9]/g, '');
  return cleaned.length === 9 || cleaned.length === 11;
}
```
> **Nota del verificador:** Confirmado: lib/utils.ts existe con 127 líneas y el snippet 'before' coincide verbatim (líneas 60-64). Grep de `lib/utils`, de `from '...utils'` y de los 13 símbolos con word-boundary en todo client-app = 0 usos; cada símbolo aparece solo en su declaración, sin re-exports ni referencias en configs/tests (src/frontend/packages no existe en este checkout). Las ironías también se verifican: payment/[id]/page.tsx:87-88 reimplementa la validación de longitud inline (con semántica distinta: `length < 9` vs `9 || 11`, o sea duplicación con drift), `RD$ ...toFixed(2)` aparece 37 veces en 6 archivos (más que los ~20 declarados), y cartStore.ts:102/107 hardcodea 0.18/0.10. Nada lo importa, así que borrarlo no rompe nada — no es crítico conservarlo; prioridad MEDIA es correcta.

### 8. [MEDIA] Export 'apiClient' (76 líneas, ~25 métodos) nunca importado en toda la app

**App:** admin-panel - **Archivo:** `src/frontend/admin-panel/lib/api.ts` (lineas 96-171) - **Verificado:** si

Grep 'apiClient' en app/, components/, lib/, hooks/: 1 sola aparición = su declaración (lib/api.ts:96). Grep de imports de '@/lib/api': solo 3 archivos y los 3 importan únicamente ensureFreshToken (app/reservations/page.tsx:7, lib/useAdminNotifications.ts:5, lib/useFloorPlanLive.ts:7). Los 25 wrappers (login, getDishes, updateTableStatus, getUsers, etc.) son API muerta que además desincroniza contratos: updateTableStatus aquí manda el body como string plano mientras app/tables/page.tsx manda { newStatus } — un futuro consumidor heredaría el contrato roto. Eliminar el objeto (conservando api, ensureFreshToken e interceptores).

**Antes:**
```tsx
// API Client
export const apiClient = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  ...
  updateTableStatus: (id: number, newStatus: string) =>
    api.put(`/table/${id}/status`, newStatus),
  ...
};
```
**Despues:**
```tsx
// Eliminar apiClient completo; conservar `api` (con interceptores) y `ensureFreshToken`.
```
> **Nota del verificador:** Confirmado: apiClient (lib/api.ts:96-171) aparece 1 sola vez en todo admin-panel (su declaración); los 3 únicos imports de '@/lib/api' (app/reservations/page.tsx:7, lib/useAdminNotifications.ts:5, lib/useFloorPlanLive.ts:7) importan solo ensureFreshToken, y no hay re-exports ni referencias dinámicas ni uso en src/frontend/packages/ui. Los demás hits de 'apiClient' son del client-app, que tiene su propio lib/api.ts independiente (apps standalone sin código compartido). El desync de contrato también es real: el backend TableController.UpdateTableStatus espera [FromBody] UpdateTableStatusDto { NewStatus } y app/tables/page.tsx:243 manda { newStatus } con su propio axios local, mientras el wrapper muerto manda string plano que rompería el model binding. El fix propuesto es correcto y seguro (nada importa apiClient; api/interceptores/ensureFreshToken quedan intactos); prioridad MEDIA adecuada.

### 9. [MEDIA] Capa mock completa muerta: mockApi.ts (351 líneas) + mock-data/index.ts (536) + types/index.ts (233) = ~1.120 líneas sin un solo consumidor

**App:** admin-panel - **Archivo:** `src/frontend/admin-panel/lib/services/mockApi.ts` (lineas 1-351) - **Verificado:** si

Grep 'mock-data|mockApi|dashboardApi' en app/, components/, lib/, hooks/, i18n/ excluyendo los propios archivos: 0 apariciones. Grep de imports de '../types' / '@/lib/types': solo lib/mock-data/index.ts:12 y lib/services/mockApi.ts:11 se importan entre sí — un grafo de 3 archivos aislado del resto de la app (las páginas definen sus interfaces inline y llaman al API real). No entra al bundle por tree-shaking de entradas, pero contamina búsquedas (dos definiciones de Table/Order/User con shapes distintos a los reales confunden a cualquier dev/LLM navegando el código) y aparenta un modo demo que no existe. Borrar lib/services/mockApi.ts, lib/mock-data/ y lib/types/.

**Antes:**
```tsx
// Mock API Service - Simula llamadas al backend
import { MenuItem, MenuCategory, Table, Order, User, DashboardStats, OrderStatus, TableStatus } from '../types';
import { mockMenuItems, mockCategories, mockTables, mockOrders, mockUsers, generateMockOrder } from '../mock-data';
```
**Despues:**
```tsx
Eliminar lib/services/mockApi.ts (y el directorio lib/services/ completo, pues mockApi.ts es su único archivo), lib/mock-data/ y lib/types/ — ningún import externo, dinámico ni de tests.
```
> **Nota del verificador:** Confirmado: mockApi.ts tiene exactamente 351 líneas (351+536+233=1.120) y el snippet 'before' coincide salvo formato (imports multilínea en el archivo real vs. una línea en el hallazgo). Grep de mockApi|mock-data y de los 7 sub-APIs exportados en TODO src/frontend (incluido packages/): 0 usos fuera del propio archivo; '../types' solo lo importan mock-data/index.ts:12 y mockApi.ts:11, y no hay referencias dinámicas, de tests (lib/__tests__ solo tiene auth-client.test.ts) ni por alias @/types. No cumple ninguna función de runtime (mock puro con delays simulados), así que no es crítico conservarlo. El fix es correcto; única mejora: borrar también el directorio lib/services/ completo porque mockApi.ts es su único contenido.

### 10. [MEDIA] Modal 'Identificar mesa por QR' inalcanzable: setShowQrModal(true) no existe en toda la app

**App:** waiter-app - **Archivo:** `src/frontend/waiter-app/app/page.tsx` (lineas 3310-3423) - **Verificado:** si

Grep 'setShowQrModal(true)' en toda la waiter-app: 0 apariciones (solo hay setShowQrModal(false) en las lineas 575, 995, 1000, 3343 y 3410). El comentario en 2076-2077 lo documenta: el boton se elimino en QR-MESA-DIRECT.1 (la identificacion ahora es tap directo en la card + confirmIdentifyTable). Codigo muerto arrastrado: el modal completo (3310-3423, ~115 lineas), identifyTableByQr (988-1007, solo llamado desde el modal muerto), handleQrScanIdentify (543-578, solo usado en la linea 3368 dentro del modal), qrTableInput, y el unico setShowQrCamera(true) esta en la linea 3324 dentro del bloque muerto — por lo que showQrCamera tambien es siempre false y su rama en el efecto de pausa de polling (linea 722) y handleQrClose quedan sin efecto. El escaneo QR REAL que si funciona es el de qrVerifyContext (3268-3307) y el de mesa virtual: no tocar esos.

**Antes:**
```tsx
{showQrModal && (
  <div 
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    ...
    {!showQrCamera ? ( ... ) : (
      <QrScanner singleMode onScan={handleQrScanIdentify} ... />
```
**Despues:**
```tsx
Eliminar: modal JSX 3309-3423, identifyTableByQr (988-1007), handleQrScanIdentify (543-578), handleQrClose (658-660), estados showQrModal (209), qrTableInput (216), showQrCamera (217). ADEMAS limpiar referencias que el hallazgo no lista: quitar showQrModal de las expresiones y arrays de dependencias en lineas 727/736 (hasModal) y 740/749 (isModalOpen), y en la linea 722 dejar shouldPollRef.current = !showVirtualTableCamera (conservando la dependencia showVirtualTableCamera en 723). CONSERVAR: handleQrError (654, usado vivo en 3450 por el scanner de mesa virtual), handleQrVerifyTable/qrVerifyContext (3268-3307) y todo el flujo de mesa virtual.
```
> **Nota del verificador:** Confirmado con lectura directa: el snippet 'before' existe tal cual en 3310-3423 y grep en todo src/frontend muestra 0 'setShowQrModal(true)' (useState(false) en 209 y solo setters a false en 575/995/1000/3343/3410), por lo que el modal es inalcanzable; el comentario QR-MESA-DIRECT.1 en 2076-2077 documenta la eliminacion del boton. Verifique cada simbolo: identifyTableByQr, handleQrScanIdentify, handleQrClose y qrTableInput solo se usan dentro del bloque muerto, y el unico setShowQrCamera(true) esta en 3324 (dentro del modal muerto), asi que showQrCamera es siempre false y su rama en 722 no tiene efecto. Matiz que el fix debe cubrir: showQrModal tambien se lee en los efectos de lineas 727/736 y 740/749 (siempre aporta false); hay que limpiarlas al borrar el estado o no compila. handleQrError NO es muerto (uso vivo en 3450, scanner de mesa virtual) y el hallazgo correctamente no lo incluye; los flujos qrVerifyContext y mesa virtual quedan intactos.

### 11. [BAJA] Import de axios nunca usado en page.tsx

**App:** kds-app - **Archivo:** `src/frontend/kds-app/app/page.tsx` (lineas 6) - **Verificado:** si

Grep 'axios' en app/page.tsx: 1 sola aparicion = el propio import (linea 6). Todo el HTTP del componente pasa por `api` del factory createAuthApi (linea 13). En el resto de la app (Grep global excluyendo node_modules/out) axios solo se usa legitimamente dentro de lib/auth-client.ts. Es el residuo del refactor F3 que centralizo el interceptor JWT (comentario en linea 12). Sin costo runtime real (axios ya esta en el bundle via auth-client) pero ensucia el modulo y confunde sobre cual cliente HTTP usar.

**Antes:**
```tsx
import axios from 'axios';
```
> **Nota del verificador:** Confirmado: linea 6 de src/frontend/kds-app/app/page.tsx es exactamente `import axios from 'axios';` y un grep case-insensitive de todo el archivo devuelve solo esa linea (no hay axios.get/post ni AxiosError). Todo el HTTP del componente pasa por `api` de createAuthApi('kds') (linea 13, comentario F3 en linea 12). El import es module-scoped y page.tsx no lo re-exporta, asi que ningun otro archivo puede depender de el; en kds-app axios solo se usa legitimamente en lib/auth-client.ts. Eliminar la linea es seguro, sin impacto en SignalR/hidratacion/polling; prioridad BAJA es correcta.

### 12. [BAJA] Campo OrderItem.status declarado y nunca leido

**App:** kds-app - **Archivo:** `src/frontend/kds-app/app/page.tsx` (lineas 77) - **Verificado:** si

Grep 'status' en app/page.tsx: las unicas lecturas son order.status (lineas 189-190, sobre la interfaz Order, que si lo declara en la 85); `item.status` no se lee en ningun punto del archivo ni en ningun otro archivo de la app (Grep global en kds-app excluyendo node_modules/out: solo la declaracion). El campo sugiere un estado por-item (p.ej. item listo individualmente) que nunca se implemento en esta vista; mantenerlo en la interfaz da la falsa impresion de que el KDS lo respeta. Eliminar la linea, o implementarlo si el backend lo envia y se quiere marcar items individuales.

**Antes:**
```tsx
interface OrderItem {
  id: number;
  dishName: string;
  quantity: number;
  notes?: string;
  ...
  status?: string;
}
```
> **Nota del verificador:** Confirmado: 'status?: string;' existe en la linea 77 de kds-app/app/page.tsx dentro de interface OrderItem (no exportada, uso local solo via Order.items). Grep de 'status' en toda kds-app: unicas lecturas son order.status (lineas 189-190, interfaz Order linea 85) y error.response?.status en lib/auth-client.ts (HTTP axios, no relacionado); item.status nunca se lee, ni dinamicamente. El render itera los items como 'any' (linea 489), asi que eliminar el campo no rompe ni el type-check ni el runtime (campo puramente compile-time; el backend puede seguir enviandolo en JSON sin problema). Fix propuesto correcto y prioridad BAJA adecuada.

### 13. [BAJA] Imports de iconos nunca usados y bloques residuales vacios de logs eliminados

**App:** waiter-app - **Archivo:** `src/frontend/waiter-app/app/page.tsx` (lineas 5, 532-536) - **Verificado:** si

Iconos importados de lucide-react y nunca renderizados — Grep de cada simbolo en app/, components/ y lib/: CheckCircle 1 aparicion (el import), ChefHat 1, Play 1, Square 1 (el hit extra de 'Square' en PinPad.tsx:30 es prosa de un comentario, no codigo). Ademas quedaron cascarones vacios de console.log borrados que ya no hacen nada: el useEffect 532-536 ('Log cuando virtualTablesList cambie' con cuerpo if vacio), los if vacios en 978-979 y 2363-2365, el bloque vacio en 2463-2465 y la linea suelta 962. Tambien getTableStatus (1502-1506, Grep: 1 aparicion = su declaracion). Cero impacto funcional al borrarlos; reducen ruido y evitan que un lector piense que falta implementar algo ahi.

**Antes:**
```tsx
import { Utensils, Clock, DollarSign, CheckCircle, AlertCircle, XCircle, LogOut, Wine, Check, RefreshCw, QrCode, Users, ArrowRightLeft, Share2, Pin, PinOff, Bell, X, ChefHat, Play, Square, ... } from 'lucide-react';
...
// Log cuando virtualTablesList cambie
useEffect(() => {
  if (virtualTablesList.length > 0) {
  }
}, [virtualTablesList]);
```
> **Nota del verificador:** Confirmado con lectura directa: linea 5 importa CheckCircle, ChefHat, Play y Square y el Grep en todo waiter-app da exactamente 1 hit por simbolo (el import); el hit extra de 'Square' en PinPad.tsx:30 es prosa de un comentario JSDoc sobre POS ('Toast/Square lo hacen'). Los cascarones vacios existen tal cual: useEffect 532-536 sin cuerpo efectivo, ifs vacios en 978-979, 2363-2365 y 2463-2465, linea en blanco residual 961-962, y getTableStatus (1502-1506) con 1 sola aparicion = su declaracion. Ninguno tiene efecto funcional (el useEffect vacio no ejecuta nada y los ifs vacios no alteran los filtros que siguen); no hay dependencia de SignalR, hidratacion ni polling. Unica precaucion al aplicar el fix: en 2359-2367 y 2460-2466 borrar solo el shell 'if (...) {}' y conservar las variables inVirtualTable/isInVirtual porque si se usan en el return; el hallazgo lo describe correctamente. Prioridad BAJA adecuada.

### 14. [BAJA] audioRef nunca usado y connectionRef solo se escribe, nunca se lee

**App:** host-app - **Archivo:** `src/frontend/host-app/app/page.tsx` (lineas 175-176) - **Verificado:** si

Grep de 'audioRef' en toda la app (src/frontend/host-app, excluyendo node_modules/.next/out): 1 sola aparición = su declaración. No hay <audio>, new Audio() ni play() en el archivo — sugiere una alerta sonora de reservas planificada y nunca implementada. Grep de 'connectionRef': 3 apariciones = declaración + connectionRef.current = connection (línea 479) + connectionRef.current = null (línea 525); nunca se lee .current fuera del propio efecto, donde la variable local `connection` ya cubre el cleanup. Ambas refs son peso muerto que confunde (parecen implicar audio y acceso externo al hub que no existen). OJO: la conexión SignalR y su cleanup en sí son intencionales — solo sobran las refs.

**Antes:**
```tsx
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
...
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
...
    connectionRef.current = connection;
...
    return () => {
      connection.stop().catch(() => {});
      connectionRef.current = null;
    };
```
**Despues:**
```tsx
import { useEffect, useState, useMemo, useCallback } from 'react';
...
    return () => {
      connection.stop().catch(() => {});
    };
```
> **Nota del verificador:** Confirmado: lineas 175-176 existen tal cual. audioRef aparece 1 sola vez en todo host-app (su declaracion) y no hay <audio>, new Audio() ni .play() en host-app/app. connectionRef tiene 3 apariciones (declaracion, escritura L479, null L525) y .current nunca se lee; el cleanup del efecto usa la variable local `connection` (L524), asi que borrar la ref no afecta SignalR ni la reconexion. El fix debe ampliarse: ademas de L175-176 hay que borrar L479 y L525 (si no, no compila) y quitar useRef del import de L3 (es el unico uso). Prioridad corregida a BAJA: es peso muerto sin impacto funcional.

### 15. [BAJA] occupiedSeats nunca usado (y totalCapacity solo existe para calcularlo)

**App:** host-app - **Archivo:** `src/frontend/host-app/app/page.tsx` (lineas 766-768) - **Verificado:** si

Grep de 'occupiedSeats' en toda la app: 1 sola aparición = su declaración. Grep de 'totalCapacity': 2 apariciones = su declaración + el cálculo de occupiedSeats muerto. availableSeats sí se usa (línea 991, panel de stats). Son dos reduce sobre tables ejecutados en CADA render del God component para producir valores que nadie consume. Eliminar ambas líneas y dejar solo availableSeats.

**Antes:**
```tsx
const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
const availableSeats = tables.filter(t => t.status === 'Available').reduce((sum, t) => sum + t.capacity, 0);
const occupiedSeats = totalCapacity - availableSeats;
```
**Despues:**
```tsx
const availableSeats = tables.filter(t => t.status === 'Available').reduce((sum, t) => sum + t.capacity, 0);
```
> **Nota del verificador:** Confirmado: el snippet existe tal cual en host-app/app/page.tsx:766-768. Grep recursivo en todo src/frontend: occupiedSeats aparece solo en su declaración (768) y totalCapacity solo en su declaración (766) más el cálculo muerto (768); availableSeats sí se consume en la línea 991 (panel de stats). Son derivados puros sin efectos secundarios ni relación con SignalR/SSR/polling, por lo que el fix propuesto (dejar solo availableSeats) es correcto y seguro. Prioridad BAJA adecuada.

### 16. [BAJA] totalConfirmed calculado en cada render y nunca renderizado

**App:** host-app - **Archivo:** `src/frontend/host-app/app/page.tsx` (lineas 846-847) - **Verificado:** si

Grep de 'totalConfirmed' en toda la app: 1 sola aparición = su declaración (línea 847). Su gemelo totalPending sí se usa (badge del tab Reservas, línea 941). Es un filter completo de activeReservations por render sin consumidor. Eliminar la línea.

**Antes:**
```tsx
const totalPending = activeReservations.filter(r => !r.isConfirmed).length;
const totalConfirmed = activeReservations.filter(r => r.isConfirmed).length;
```
**Despues:**
```tsx
const totalPending = activeReservations.filter(r => !r.isConfirmed).length;
```
> **Nota del verificador:** Confirmado leyendo host-app/app/page.tsx lineas 846-847: el snippet 'before' aparece tal cual. Grep de 'totalConfirmed' en todo src/frontend (incluye subcarpetas/packages) arroja 1 sola coincidencia: la declaracion en la linea 847; no hay imports, JSX, re-exports ni referencias por string. totalPending si se usa (badge del tab Reservas, lineas 941-943), por lo que el 'after' que lo conserva es correcto. Es un filter puro sin efectos secundarios, sin impacto en SignalR/SSR/polling; eliminar la linea es seguro y la prioridad BAJA es adecuada.

## 3. Logs, bugs y errores potenciales (11 confirmados)

### 17. [ALTA] El chequeo de orden activa llama a un endpoint inexistente (/api/orders/) y borra current_order_id

**App:** client-app - **Archivo:** `src/frontend/client-app/app/menu/page.tsx` (lineas 92-118) - **Verificado:** si

El useEffect verifica la orden activa con fetch(`/api/orders/${candidateId}`) — plural. El backend expone la ruta en singular: OrderController tiene [Route("api/[controller]")] = api/order (verificado: Grep de 'api/orders' en src/backend = 0 coincidencias, y no existe app/api/ en client-app; el rewrite de next.config.mjs pasa /api/:path* tal cual). Resultado: SIEMPRE 404 → r.ok=false → null → se ejecuta localStorage.removeItem('current_order_id'). Impacto UX doble: (1) el botón 'Ver mi pedido' del header nunca aparece, y (2) se DESTRUYE la referencia del comensal a su pedido activo, rompiendo el flujo de volver a la orden compartida de la mesa. Además usa fetch crudo en vez de apiClient (inconsistente) y hace setState sin flag de cancelación → posible setState tras unmount y respuestas fuera de orden. El fix usa apiClient.getOrder (ruta correcta /api/order/{id}) + flag de cleanup, y solo borra el id ante 404 real, no ante errores de red.

**Antes:**
```tsx
fetch(`/api/orders/${candidateId}`)
  .then(r => r.ok ? r.json() : null)
  .then((order: any) => {
    if (!order) { localStorage.removeItem('current_order_id'); return; }
```
**Despues:**
```tsx
// Requiere agregar al tope del archivo: import { apiClient } from '@/lib/api';
let cancelled = false;
apiClient.getOrder(Number(candidateId)) // GET /api/order/{id} — ruta real (OrderController [Route("api/[controller]")] + [HttpGet("{id}")], AllowAnonymous)
  .then(({ data: order }) => {
    if (cancelled || !order) return;
    const status = (order.status ?? order.Status ?? '').toLowerCase();
    const isActive = !['completed', 'cancelled', 'paid'].includes(status);
    if (isActive) {
      setActiveOrderId(String(candidateId));
      setActiveOrderNumber(order.orderNumber ?? order.OrderNumber ?? null);
      localStorage.setItem('current_order_id', String(candidateId));
    } else {
      setActiveOrderId(null);
      setActiveOrderNumber(null);
      localStorage.removeItem('current_order_id');
    }
  })
  .catch((err) => {
    if (cancelled) return;
    if (err?.response?.status === 404) localStorage.removeItem('current_order_id');
    setActiveOrderId(null);
    setActiveOrderNumber(null);
  });
return () => { cancelled = true; };
```
> **Nota del verificador:** Confirmado con lectura directa: el snippet 'before' existe tal cual en menu/page.tsx lineas 97-100 (useEffect 92-118) y el backend solo expone la ruta singular — OrderController.cs linea 16 [Route("api/[controller]")] = api/order con [HttpGet("{id}")] + [AllowAnonymous] en linea 252; Grep de 'api/orders' en src/backend = 0 coincidencias, no existe app/api/ en client-app y next.config.mjs reescribe /api/:path* sin transformar, por lo que /api/orders/{id} siempre devuelve 404 y ejecuta localStorage.removeItem('current_order_id'). El fix propuesto es correcto en ruta y semantica (apiClient.getOrder en lib/api.ts linea 99 → api.get('/order/${id}') con baseURL '/api'), pero le falta un detalle: menu/page.tsx NO importa apiClient actualmente, asi que hay que agregar import { apiClient } from '@/lib/api'; ademas conviene limpiar tambien activeOrderNumber en el catch (agregado en corrected_after). Prioridad ALTA se sostiene: reproduce el 100% de las veces y destruye la referencia del comensal a la orden compartida de la mesa, flujo central del client-app.

### 18. [ALTA] Fallback silencioso `tableId: tableId || 1` envía pedidos a la Mesa 1

**App:** client-app - **Archivo:** `src/frontend/client-app/app/cart/page.tsx` (lineas 102-109) - **Verificado:** si

Si el comensal llega a /menu sin pasar por /table/{qrCode} (URL directa, storage limpio, o expiró el persist de zustand), tableId es null y el checkout manda el pedido con tableId=1 sin avisar. Impacto operativo real: la cocina prepara y el mesero entrega a la Mesa 1 física un pedido de otra mesa, y el cobro (por mesa) queda cruzado. Un pedido a mesa equivocada en producción es de los errores más caros del flujo QR→menú→pedido. El fix bloquea el checkout sin mesa y redirige a seleccionar/escanear mesa.

**Antes:**
```tsx
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
createOrderMutation.mutate({
  tableId: tableId || 1,
  sessionId,
```
**Despues:**
```tsx
if (!tableId) {
  toast.error(tt('noTableSelected')); // nueva clave i18n: "Escanea el QR de tu mesa para ordenar"
  router.push('/table');
  return;
}
const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
createOrderMutation.mutate({
  tableId,
  sessionId,
```
> **Nota del verificador:** Confirmado: el snippet 'before' existe textual en cart/page.tsx:102-109, tableId es `number | null` (default null, persist 'smartmenu-cart') y el UNICO setTableId está en /table/[qrCode]/page.tsx:50 tras escanear QR, así que entrar directo a /menu o con storage limpio manda tableId=1. El backend agrava el impacto: OrderService.cs:57-61 valida que la mesa exista (la 1 existe en el seed → orden silenciosa a Mesa 1 con mesero auto-asignado en :136-140), y además CreateOrderDto.TableId es nullable con `IsPickup = !dto.TableId.HasValue` (:109-110), o sea que el `|| 1` NO es necesario para compatibilidad con la API — critical_to_keep=false. El fix es correcto: /table existe como página de selección de mesas, `.slice(2,11)` es equivalente a `.substr(2,9)`, y es la única ocurrencia del patrón en client-app; único requisito: agregar la clave `toast.noTableSelected` a los 10 archivos messages/*.json (hoy no existe en ninguno) o next-intl renderizará la clave cruda. Prioridad ALTA justificada: pedido/cobro cruzado de mesa en el flujo QR de producción.

### 19. [ALTA] addItem fusiona líneas solo por dishId y descarta las personalizaciones del segundo ítem

**App:** client-app - **Archivo:** `src/frontend/client-app/lib/stores/cartStore.ts` (lineas 64-91) - **Verificado:** si

addItem busca `state.items.find(i => i.dishId === newItem.dishId)` y si existe solo suma quantity: las preferencias del nuevo ítem (meatCooking, allergies, liga, notes, courseTiming, etc., que DishModal captura con cuidado) se DESCARTAN silenciosamente. Caso real en mesa compartida: comensal A pide 'Filete término medio', comensal B pide 'Filete bien cocido, alergia a maní' → el carrito muestra '2x Filete término medio' y la alergia de B nunca llega a cocina (riesgo de seguridad alimentaria, no solo UX). removeItem y updateQuantity (líneas 81-91) tienen el mismo keying por dishId, así que borrar/ajustar afecta la línea equivocada. Fix mínimo: fusionar solo si TODA la personalización coincide; requiere después migrar keys de UI de item.dishId a un lineId (cart/page.tsx usa key={item.dishId}).

**Antes:**
```tsx
addItem: (newItem) =>
  set((state) => {
    const existingItem = state.items.find(i => i.dishId === newItem.dishId);
    
    if (existingItem) {
      return {
        items: state.items.map(i =>
          i.dishId === newItem.dishId
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        ),
      };
    }
    
    return { items: [...state.items, newItem] };
  }),

removeItem: (id) =>
  set((state) => ({
    items: state.items.filter(i => i.dishId !== id),
  })),

updateQuantity: (id, qty) =>
  set((state) => ({
    items: state.items.map(i =>
      i.dishId === id ? { ...i, quantity: qty } : i
    ),
  })),
```
**Despues:**
```tsx
// CartItem gana: lineId: string (generado por el store; DishModal no lo pasa).
// Firmas: removeItem(_lineId: string) y updateQuantity(_lineId: string, _quantity: number).

const sameLine = (a: CartItem, b: CartItem) =>
  a.dishId === b.dishId && a.notes === b.notes &&
  a.specialInstructions === b.specialInstructions &&
  a.customizations === b.customizations && a.allergies === b.allergies &&
  a.meatCooking === b.meatCooking && a.sideDish === b.sideDish &&
  a.drinkTiming === b.drinkTiming && a.withAlcohol === b.withAlcohol &&
  a.liga === b.liga && a.courseTiming === b.courseTiming;

addItem: (newItem) =>
  set((state) => {
    const existing = state.items.find(i => sameLine(i, newItem));
    if (existing) {
      return {
        items: state.items.map(i =>
          i === existing ? { ...i, quantity: i.quantity + newItem.quantity } : i
        ),
      };
    }
    return {
      items: [...state.items, { ...newItem, lineId: crypto.randomUUID() }],
    };
  }),

removeItem: (lineId) =>
  set((state) => ({
    items: state.items.filter(i => i.lineId !== lineId),
  })),

updateQuantity: (lineId, qty) =>
  set((state) => ({
    items: state.items.map(i =>
      i.lineId === lineId ? { ...i, quantity: qty } : i
    ),
  })),

// EN EL MISMO COMMIT: cart/page.tsx debe usar key={item.lineId} y pasar
// item.lineId a updateQuantity/removeItem (líneas 183, 202, 209, 225, 258);
// si no, con dos líneas del mismo plato el +/- y el borrar afectan ambas.
// Además, persist 'smartmenu-cart' guarda carritos viejos sin lineId:
// añadir version+migrate (o backfill en onRehydrateStorage) que genere lineId.
```
> **Nota del verificador:** Confirmado leyendo cartStore.ts:64-91 (snippet 'before' textual) y DishModal.tsx:100-127, que sí captura meatCooking/allergies/liga/courseTiming/notes y los pasa a addItem, donde el merge por dishId los descarta; el escenario de alergia perdida es real y justifica ALTA (seguridad alimentaria). removeItem/updateQuantity keyean por dishId y cart/page.tsx usa key={item.dishId} y pasa item.dishId a esos handlers (líneas 183, 202, 209, 225, 258). El fix propuesto es direccionalmente correcto pero incompleto: aplicado solo, permite dos líneas con el mismo dishId y entonces removeItem borra ambas, updateQuantity muta ambas y React recibe keys duplicadas; además sameLine omite specialInstructions. La versión corregida introduce lineId en el store, re-keyea removeItem/updateQuantity y exige actualizar cart/page.tsx en el mismo commit, con migración del carrito persistido (zustand persist 'smartmenu-cart').

### 20. [ALTA] Redirect de login: guarda el usuario en la clave equivocada ('user' vs 'admin_user') y el return temprano deja el dashboard sin cargar datos

**App:** admin-panel - **Archivo:** `src/frontend/admin-panel/app/page.tsx` (lineas 36-59) - **Verificado:** si

Dos problemas en el mismo efecto: (1) L42 guarda localStorage.setItem('user', ...) pero TODOS los lectores usan 'admin_user' (Header.tsx:56, AppSidebar.tsx:93, lib/api.ts:32/88) — grep de setItem('user' = 1 sola aparición, esta; el perfil llegado por URL se pierde. (2) Cuando llega ?token=..., el efecto hace router.replace('/') y return ANTES de llamar loadData()/setInterval; como las deps son [] y router.replace no remonta el componente, el dashboard queda con loading=true y stats en cero hasta un F5 manual. Además esta lógica ya existe centralizada y correcta en MainLayout.useAuthFromUrl (components/layout/MainLayout.tsx:15-27) y está triplicada también en app/menu/page.tsx:62-73. Nota de seguridad: pasar el JWT por query string (?token=) queda en historial del navegador y logs de proxy — patrón ya observado en la auditoría QA; migrarlo es deuda aparte.

**Antes:**
```tsx
if (urlToken) {
  localStorage.setItem('admin_token', urlToken);
  if (urlUser) localStorage.setItem('user', decodeURIComponent(urlUser));
  // Limpiar la URL sin recargar
  router.replace('/');
  return;
}
```
**Despues:**
```tsx
if (urlToken) {
  localStorage.setItem('admin_token', urlToken);
  // useSearchParams().get() ya devuelve el valor decodificado: guardar tal cual
  // (igual que MainLayout.tsx:23 y menu/page.tsx:70; decodeURIComponent doble-decodifica y puede lanzar URIError)
  if (urlUser) localStorage.setItem('admin_user', urlUser);
  router.replace('/');
  // sin return: continuar a loadData() + interval con el token recien guardado
}
```
> **Nota del verificador:** Confirmado: el snippet 'before' existe tal cual en page.tsx:40-46 y el grep valida que setItem('user') es la unica aparicion mientras todos los lectores usan 'admin_user' (Header.tsx:56, AppSidebar.tsx:93, lib/api.ts:32/88); la triplicacion en MainLayout.tsx:15-27 y menu/page.tsx:62-73 tambien es real. Matiz al punto (1): el efecto de MainLayout (hijo) corre ANTES que el de la pagina y ya guarda 'admin_user' correctamente cuando llegan token+user, asi que el perfil no se pierde en el flujo estandar — L42 es una escritura muerta a clave equivocada, no perdida de datos. El punto (2) es peor de lo descrito: el return temprano tambien salta la linea 54 que fija el header Authorization del axios local, por lo que incluso el boton 'Actualizar' (L291) dispara requests sin auth hasta un F5; deps=[] y router.replace no remontan, asi que loading queda en true. Fix 'after' correcto en esencia pero debe quitar decodeURIComponent (useSearchParams ya decodifica; doble decode es inconsistente con MainLayout/menu y puede lanzar URIError). Prioridad ALTA se sostiene: todo aterrizaje post-login via ?token= deja el dashboard congelado.

### 21. [ALTA] Al CREAR un plato nuevo, las imágenes de galería subidas nunca se asocian al plato (solo sobrevive imageUrl principal)

**App:** admin-panel - **Archivo:** `src/frontend/admin-panel/app/menu/page.tsx` (lineas 382-412, 615-629) - **Verificado:** si

En el flujo de plato existente, cada upload hace POST /api/dish/{id}/images (L618). Pero en el flujo de plato NUEVO (rama else, L627-629) las imágenes solo se meten al estado local dishImages con ids falsos (Date.now() + i) y el submit (L388-394) envía únicamente payload = { ...formData } — que solo lleva imageUrl. Resultado: el usuario sube 5 fotos, ve la galería en el modal, guarda, y 4 se pierden silenciosamente; los archivos quedan huérfanos en wwwroot del backend. Pérdida de datos percibida por el usuario sin ningún error.

**Antes:**
```tsx
} else {
  await api.post('/api/dish', payload);
  toast.success(t('dishCreated'));
}
```
**Despues:**
```tsx
} else {
  const created = await api.post('/api/dish', payload);
  const newId = created.data?.id ?? created.data?.Id;
  if (newId) {
    for (const [idx, img] of dishImages.entries()) {
      await api.post(`/api/dish/${newId}/images`, { imageUrl: img.imageUrl, displayOrder: idx, isMain: img.isMain }).catch(() => {});
    }
  }
  toast.success(t('dishCreated'));
}
```
> **Nota del verificador:** Confirmado: el snippet 'before' existe verbatim en L393-396 de menu/page.tsx, el upload para plato nuevo (else L627-629) solo agrega a estado local dishImages con id falso Date.now()+i, y el submit (L388) envía payload={...formData, tagIds} que no incluye dishImages. El backend lo corrobora: CreateDishDto (MenuDTOs.cs L52-74) solo acepta ImageUrl string, sin colección de imágenes, y la única vía de asociación es POST /api/dish/{id}/images (DishController L195-219), nunca invocada en el flujo de creación — las imágenes extra se pierden y quedan huérfanas en wwwroot. El fix propuesto es correcto y compatible: CreateDish devuelve DishDto con Id (serializado camelCase como id, por lo que created.data?.id funciona) y AddDishImageDto espera exactamente { imageUrl, displayOrder, isMain }; único matiz menor es que el .catch(() => {}) silencia fallos de asociación (sería mejor un toast), pero no rompe nada. Prioridad ALTA justificada: pérdida de datos silenciosa percibida por el usuario en el flujo principal del admin.

### 22. [ALTA] isDrinkItem clasifica por substring y desruta platos de cocina al bar

**App:** kds-app - **Archivo:** `src/frontend/kds-app/app/page.tsx` (lineas 15-19) - **Verificado:** si

El ruteo Chef vs Bartender depende de name.includes(keyword) sin frontera de palabra: 'agua' matchea 'aguacate' ('Ensalada de aguacate'), 'ron' matchea 'macarrones', 'coca' matchea 'cocada'. Consecuencia operativa grave: el plato desaparece del KDS del chef (filtro linea 216/220 excluye bebidas) y aparece en la pantalla del bartender, que no lo prepara; la orden se queda sin cocinar. Fix minimo: match por palabra completa (manteniendo includes solo para keywords multi-palabra como 'piña colada'). Fix ideal a mediano plazo: flag isDrink/categoria desde el backend en el item, no heuristica sobre dishName.

**Antes:**
```tsx
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  return DRINK_KEYWORDS.some((k) => name.includes(k));
}
```
**Despues:**
```tsx
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  const words = new Set(name.split(/[^a-záéíóúüñ]+/).filter(Boolean));
  return DRINK_KEYWORDS.some((k) =>
    k.includes(' ')
      ? name.includes(k)
      : words.has(k) || words.has(k + 's') || words.has(k + 'es')
  );
}
```
> **Nota del verificador:** Confirmado leyendo kds-app/app/page.tsx: lineas 15-19 contienen DRINK_KEYWORDS (con 'agua', 'ron', 'coca') y isDrinkItem con name.includes(k) sin frontera de palabra; lineas 211 (bar incluye bebidas) y 216/220 (chef excluye bebidas) confirman que un falso positivo ('macarrones'→'ron', 'aguacate'→'agua', 'cocada'→'coca') desaparece del KDS del chef y aparece en el del bartender. El fix propuesto corrige los falsos positivos pero regresa en plurales ('cervezas', 'jugos', 'mojitos', 'cócteles' dejarian de detectarse); corrected_after agrega sufijos plurales. Caveat que ningun matcher resuelve: 'copa' seguiria ruteando 'Copa de helado' (postre) al bar, lo que refuerza el fix ideal de flag desde backend. Prioridad ALTA correcta: perdida silenciosa de platos en operacion.

### 23. [ALTA] Un fallo transitorio de red vacia el tablero de cocina (setOrders([]) en el catch)

**App:** kds-app - **Archivo:** `src/frontend/kds-app/app/page.tsx` (lineas 243-246) - **Verificado:** si

loadOrders corre cada 5s; si UN poll falla (blip de red, timeout de 15s del axios, backend reiniciando), el catch hace setOrders([]) y el KDS renderiza el empty state verde '¡Todo listo! No hay órdenes pendientes' (linea 403-407). En una cocina eso significa que el equipo cree que no hay comandas pendientes durante el fallo — riesgo real de ordenes olvidadas. El console.error esta bien (no lo cuento como debug); el problema es borrar estado valido. Fix: conservar las ordenes previas ante error transitorio y dejar que el siguiente poll reconcilie; opcionalmente marcar 'desconectado' en UI.

**Antes:**
```tsx
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    }
```
**Despues:**
```tsx
    } catch (error) {
      console.error('Error loading orders:', error);
      // Fallo transitorio (red/timeout): conservar el tablero actual.
      // El proximo poll (5s) reconcilia; opcional: setStale(true) para banner offline.
    }
```
> **Nota del verificador:** Confirmado con lectura directa: el snippet 'before' existe tal cual en page.tsx lineas 243-246; el poll de 5s existe (linea 168, setInterval(loadOrders, 5000)); el timeout axios de 15s existe (lib/auth-client.ts linea 113); y el empty state 'allDone' se renderiza cuando orders.length===0 (lineas 403-407), con texto exacto '¡Todo listo! No hay órdenes pendientes' en messages/es.json:8. El setOrders([]) del catch NO es necesario para el funcionamiento actual: orders inicia en [], el guard de respuesta no-array (linea 185) permanece intacto, y ni SignalR ni el poll dependen de vaciar el tablero ante error. El fix propuesto es correcto y no rompe nada; prioridad ALTA se sostiene porque durante un reinicio del backend o corte de red el KDS muestra falso 'todo listo' de forma continua.

### 24. [ALTA] La propina cobrada se calcula sobre el TOTAL de la orden pero la UI la muestra sobre la porcion del split

**App:** waiter-app - **Archivo:** `src/frontend/waiter-app/app/page.tsx` (lineas 1384-1389) - **Verificado:** si

collectPayment (linea 1384) calcula tipAmt = orderTotal * (pmTipPct/100), mientras el modal (linea 2910) muestra tipAmt = myPortion * (pmTipPct/100). Con cualquier split activo (ByComensal, ByTime, Proportional, ByCategory) el mesero ve una propina en pantalla y el backend recibe otra mayor: p.ej. orden de RD$3.000 dividida entre 3, propina 10% — la UI muestra RD$100 pero se envia tipAmount=300 en /api/payment/collect. Impacto directo en dinero, en el 10% de propina legal (Ley 13-07) y en la retencion ISR. La causa raiz es que el bloque de calculo de split (~30 lineas) esta DUPLICADO entre collectPayment (1392-1421) y el render del modal (2888-2914) y ya divergieron. Extraer un helper puro computePaymentBreakdown(order, pmState) usado por ambos.

**Antes:**
```tsx
const tipAmt = pmTipPct > 0
  ? orderTotal * (pmTipPct / 100)
  : (pmCustomTip ? parseFloat(pmCustomTip) || 0 : 0);
```
**Despues:**
```tsx
// Mover DESPUES del bloque de split (linea 1421) y usar myPortion como base, igual que el modal (linea 2910).
// Mover tambien tipPct para que el % del custom tip se calcule sobre la misma base:
const tipAmt = pmTipPct > 0
  ? myPortion * (pmTipPct / 100)
  : (pmCustomTip ? parseFloat(pmCustomTip) || 0 : 0);
const tipPct = pmTipPct > 0
  ? pmTipPct
  : (pmCustomTip && myPortion > 0 ? (parseFloat(pmCustomTip) / myPortion) * 100 : 0);
// Mejor aun: extraer un helper puro computePaymentBreakdown(order, pmState) => { myPortion, tipAmt, tipPct } y usarlo en collectPayment y en el render del modal.
```
> **Nota del verificador:** CONFIRMADO con evidencia leida: page.tsx:1384-1386 calcula tipAmt sobre orderTotal ANTES del bloque de split (1392-1421) y lo envia como tipAmount (linea 1446), mientras el modal (2910-2912) lo muestra sobre myPortion; PaymentController.cs:507 usa dto.TipAmount verbatim cuando >0 y persiste TotalAmount = Amount + TipAmount (517), sin recomputo defensivo. El escenario es alcanzable: selector de split (3005) y de propina (3124) coexisten en el mismo modal. Agravante no citado: en ByComensal cada parte envia la propina sobre el total COMPLETO, asi que una orden de RD$3.000 en 3 partes al 10% registra RD$900 de propina total (la UI muestra RD$100 por parte). Matiz: TipAmount es la propina extra voluntaria, no la propina legal 10% (esa ya viene dentro de order.Total segun comentario en PaymentController.cs:456), asi que la mencion a Ley 13-07 es imprecisa aunque el impacto monetario y en reportes de tips/ISR es real; el fix propuesto es correcto y seguro (el branch Mixed consume tipAmt despues de la linea 1425), solo falta rebasar tambien tipPct (1387-1389) a myPortion.

### 25. [ALTA] Fuga del stream de camara si el modal se cierra mientras scanner.start() esta pendiente

**App:** waiter-app - **Archivo:** `src/frontend/waiter-app/app/components/QrScanner.tsx` (lineas 65-167) - **Verificado:** si

run() es async: si el usuario cierra el modal (unmount) mientras await scanner.start() sigue pendiente (pedir permiso + abrir camara tarda 1-3s), el cleanup del useEffect corre ANTES de que la camara arranque — su scannerRef.current.stop() rechaza con 'scanner is not running' (tragado por el catch). Luego start() resuelve con el componente ya desmontado y en la linea 131 'if (started && mountedRef.current)' simplemente NO actualiza estado, pero nadie detiene el scanner: el stream getUserMedia queda vivo (LED de camara encendido, bateria, y la proxima apertura puede fallar con NotReadableError en Android porque la camara sigue tomada). Es el leak clasico de camara en flujos abrir/cerrar rapido, muy probable en tablets de meseros.

**Antes:**
```tsx
if (started && mountedRef.current) {
  setStatus('ready');
  setErrorMessage('');
}
```
**Despues:**
```tsx
if (started && scannerRef.current !== scanner) {
  // El cleanup ya corrio (unmount o re-run del efecto) mientras start() estaba
  // pendiente: su stop() fallo porque la camara aun no arrancaba, y ademas
  // mountedRef es compartido entre corridas del efecto (la siguiente lo vuelve
  // a poner en true), asi que comparamos identidad del scanner, no el ref de montaje.
  try { await scanner.stop(); } catch {}
  try { scanner.clear(); } catch {}
  return;
}
if (started && mountedRef.current) {
  setStatus('ready');
  setErrorMessage('');
}
```
> **Nota del verificador:** Confirmado con lectura directa: QrScanner.tsx:131-134 coincide con el 'before' y el cleanup (158-165) traga el rechazo de stop(); html5-qrcode@2.3.8 (package.json:19) lanza 'Cannot stop, scanner is not running or paused' si stop() llega antes de que start() complete su transicion de estado, dejando vivo el stream getUserMedia — el componente se monta/desmonta en modales (page.tsx:3298/3366/3447), asi que la carrera abrir/cerrar es real, y con reactStrictMode:true (next.config.mjs:7) el leak es deterministico en dev por el doble-mount. El fix propuesto es correcto para el unmount puro pero incompleto: mountedRef es un ref compartido que la siguiente corrida del efecto resetea a true (linea 66), por lo que en StrictMode/re-runs el scanner huerfano pasaria el check '!mountedRef.current' y seguiria filtrando; la version corregida compara identidad (scannerRef.current !== scanner), que cubre unmount (cleanup lo pone en null) y re-run (lo reemplaza). Prioridad ALTA se sostiene: la camara queda grabando con la UI cerrada (privacidad + bateria) y en Android puede bloquear el siguiente escaneo con NotReadableError, aunque existe input manual como mitigacion parcial.

### 26. [ALTA] Pre-orden se adjunta a la 'última' reserva del sistema: condición de carrera con reservas concurrentes

**App:** host-app - **Archivo:** `src/frontend/host-app/components/HostReservationWizard.tsx` (lineas 133-158) - **Verificado:** si

Tras crear la reserva, el wizard NO usa el id de la respuesta del POST: hace GET /api/tablereservation (lista completa) y toma .slice(-1)[0].id asumiendo que la última reserva del array es la recién creada. Si entre el POST y el GET entra otra reserva (portal público, otro host, otra pestaña), la pre-orden de platos se adjunta a la reserva de OTRO cliente. Impacto directo en operación: cocina prepara platos para la mesa equivocada. Además dispara una carga completa de reservas innecesaria.

**Antes:**
```tsx
if (preOrderItems.length > 0) {
  try {
    const last = (await api.get('/api/tablereservation')).data?.slice?.(-1)?.[0]?.id;
    if (last) {
      await api.post(`/api/tablereservation/${last}/preorder`, {
        notes: notes.trim() || null,
        items: preOrderItems.map((i) => ({ dishId: i.dishId, quantity: i.quantity })),
      });
    }
  } catch { /* opcional */ }
}
```
**Despues:**
```tsx
const res = await api.post('/api/tablereservation', { /* ...mismo payload... */ });
const newId = res.data?.reservationId; // el POST devuelve ReservationActionResult: { success, reservationId, ... } — NO tiene 'id'
if (preOrderItems.length > 0 && newId) {
  try {
    await api.post(`/api/tablereservation/${newId}/preorder`, {
      notes: notes.trim() || null,
      items: preOrderItems.map((i) => ({ dishId: i.dishId, quantity: i.quantity })),
    });
  } catch { toast.error(t('wizard.preorderError')); /* la reserva SÍ se creó; no usar createError */ }
}
```
> **Nota del verificador:** Confirmado: el snippet 'before' existe verbatim en HostReservationWizard.tsx:148-158 y el POST (línea 135) descarta la respuesta. El bug es incluso peor que lo descrito: GET /api/tablereservation ordena por ReservationDateTime (TableReservationController.cs:64-65), así que .slice(-1)[0] devuelve la reserva con fecha/hora MÁS TARDÍA del sistema, no la recién creada — la pre-orden se adjunta mal de forma determinista si existe cualquier reserva futura posterior, sin necesidad de concurrencia. Sin embargo el fix propuesto está roto: el POST exitoso devuelve Ok(ReservationActionResult) que serializa { success, reservationId, confirmationCode, ... } sin campo 'id'/'Id' (ReservationDTOs.cs:168-183, Map en línea 506), por lo que res.data?.id sería siempre undefined y la pre-orden nunca se crearía; debe leerse res.data?.reservationId. Además usar t('wizard.createError') en el catch es engañoso porque la reserva ya fue creada.

### 27. [MEDIA] El polling de 10s hace setLoading(true) en cada tick: el grid de mesas/QRs se reemplaza por el spinner cada 10 segundos

**App:** admin-panel - **Archivo:** `src/frontend/admin-panel/app/tables/page.tsx` (lineas 118-119, 172-183, 495-499) - **Verificado:** si

loadData() arranca con setLoading(true) (L119) y el render usa {loading ? spinner : grid} (L495). Como loadData se ejecuta por setInterval cada 10s (L180), la página de QRs físicos parpadea a spinner constantemente: se pierde el scroll visual y cualquier mesa que el admin estaba por clicar desaparece un instante. Además hay carrera: el interval, el botón Refrescar y los loadData() post-mutación (updateTableStatus/createTable/deleteTable) pueden solaparse sin AbortController ni guard de orden, así que una respuesta vieja puede pisar brevemente un estado más fresco; y las respuestas en vuelo al desmontar hacen setTables tras unmount. Fix mínimo: spinner solo en la carga inicial + polling silencioso.

**Antes:**
```tsx
const loadData = async () => {
  setLoading(true);
  try {
...
loadData();
const interval = setInterval(loadData, 10000);
...
<Button onClick={loadData} variant="outline">
```
**Despues:**
```tsx
const loadData = async (opts?: { silent?: boolean }) => {
  if (!opts?.silent) setLoading(true);
  try {
...
loadData();
const interval = setInterval(() => loadData({ silent: true }), 10000);
...
<Button onClick={() => loadData()} variant="outline">
```
> **Nota del verificador:** Verificado por lectura directa: setLoading(true) en L119, setInterval(loadData, 10000) en L180, y {loading ? spinner : grid} en L495-499 existen tal cual; no hay AbortController ni guard de orden, y loadData() también se llama post-mutación (L248/260/276/288) y desde el botón Refrescar (L329), así que el flicker cada 10s y las carreras son reales. El fix 'after' es correcto en esencia pero rompe el type-check en L329: con la nueva firma, onClick={loadData} pasa el MouseEvent como opts (no asignable a { silent?: boolean }); debe envolverse como onClick={() => loadData()}. Prioridad rebajada a MEDIA: es degradación UX visible y recurrente, pero sin pérdida de datos ni crash, el estado stale se auto-corrige en el siguiente tick y el setState tras unmount es benigno en React 18.

## 4. CODIGO CRITICO A DOCUMENTAR (Regla de Oro) (3)

Codigo que PARECE sospechoso pero es necesario para el funcionamiento actual. NO eliminar; documentar en sitio.

### 28. [CONSERVAR] Estado 'currentTime' nunca leído fuerza re-render del dashboard completo cada segundo

**App:** admin-panel - **Archivo:** `src/frontend/admin-panel/app/page.tsx` (lineas 23, 31-34)

Grep 'currentTime' en app/page.tsx: 2 apariciones = su declaración (L23) y su setter dentro del setInterval (L32); NUNCA se lee en el JSX. El reloj visible vive en components/layout/Header.tsx (L40 y L381-384), que tiene su propio timer. Resultado: el árbol entero de AdminDashboardInner (stats, bottomStats, lista de órdenes activas, barras de tiempos por plato) se reconstruye 60 veces por minuto sin cambio visual alguno. Impacto: CPU/batería desperdiciados en tablets de piso y recomputación de los arrays stats/bottomStats en cada tick. El interval sí tiene cleanup, así que no es fuga: es puro peso muerto.

**Por que debe quedarse:** Confirmado con Read de page.tsx: el snippet 'before' existe tal cual (L23, L31-34) y grep en todo src/frontend muestra que 'currentTime' de page.tsx solo aparece en su declaración y setter (los matches de Header.tsx L40/L158/L381-384 son un estado independiente con su propio timer, y los de packages/ui/storybook-static son artefactos de build sobre HTMLMediaElement.currentTime). Sin embargo, la premisa "sin cambio visual alguno" es falsa: el re-render por segundo es lo que actualiza en vivo los contadores de minutos transcurridos (getElapsedMinutes en L312/L180-184, renderizado en L334-337 con getAlertColor), así que el 'after' propuesto (eliminar todo) degradaría esos timers a refrescos cada 30s vía loadData. El fix correcto es bajar el intervalo a 30-60s (granularidad de minutos mostrada) o memoizar, y la prioridad ALTA está inflada: es un costo de re-render modesto en una sola página, no un bug funcional ni una fuga.

### 29. [CONSERVAR] WaiterPage es un God component de ~4.200 lineas con ~60 useState y 8 modales inline

**App:** waiter-app - **Archivo:** `src/frontend/waiter-app/app/page.tsx` (lineas 155-4365)

Un solo componente concentra: grilla de mesas, plano (Konva), cobro con 5 tipos de split, mesas virtuales, transferencias multi-seleccion, claims, reservas, turnos, notificaciones, 2 hubs SignalR y 3 pollings de respaldo. Hay ~60 useState (lineas 158-360), 12+ useEffect y todos los modales renderizados inline (2762-4362). Impacto: cada tick del reloj o del polling re-renderiza TODO (grilla + plano + modales); cualquier cambio toca un archivo de 5.147 lineas con alto riesgo de regresion; el estado del modal de cobro (14 useState pm*) vive al nivel de la pagina y sobrevive entre aperturas (ver hallazgo del cobro). Descomposicion realista y incremental: (1) extraer PaymentModal con su estado pm* interno, (2) VirtualTablesSection + VirtualTableDetailsModal, (3) TransferBar/modo transferencia, (4) hooks useWaiterData(waiterId) (loadData + polling 30s), useTableClaims(waiterId) (claims + polling 8s + sessionStorage) y useReservationsDay(selectedDay) (set reservado + hub reservations). ManualOrderForm (4447+) ya esta separado: seguir ese patron.

**Por que debe quedarse:** Al descomponer se deben PRESERVAR intactos: el guard de hidratacion mounted (lineas 164-167, evita React #418), los pollings de respaldo (30s loadData, 8s claims, 60s floor plan) que coexisten con SignalR a proposito, los withAutomaticReconnect y la dualidad reservedTableIdsInRange/resVersion (vista por dia) vs TableStatusChanged (estado operativo) que es deuda documentada, no redundancia.

### 30. [CONSERVAR] El modal de cobro se abre sin resetear su estado: openPaymentModal existe pero nadie lo llama

**App:** waiter-app - **Archivo:** `src/frontend/waiter-app/app/page.tsx` (lineas 1336-1372)

openPaymentModal (1336-1372) resetea los 14 estados pm* (split, propina, mixto), precarga las preferencias del cliente y llama loadPaidParts(). Grep 'openPaymentModal' en toda la app: 1 sola aparicion = su declaracion. Los dos botones reales de 'Cobrar' (linea 3752 y 4106) hacen setSelectedOrder(order); setShowPaymentModal(true) directamente, y al cerrar solo se limpia selectedOrder — nunca los pm*. Consecuencia real: tras cobrar la mesa A con split ByComensal, abrir el cobro de la mesa B hereda pmSplitType='ByComensal', pmPaidParts y pmPaidAmount de A → myPortion se calcula con partes pagadas de OTRA orden y ademas se pierden las preferencias de pago del cliente (clientRequestedPaymentMethod/propina) que solo se leen en el inicializador muerto. Riesgo de cobro incorrecto.

**Por que debe quedarse:** Confirmado con lectura directa: openPaymentModal (1336-1372) tiene exactamente 1 aparicion en todo src/frontend (su declaracion) y ambos snippets 'before' existen verbatim en 3752 y 4106; las unicas rutas de cierre (1464, 2933, 3197) limpian solo showPaymentModal/selectedOrder y ningun useEffect ni otro camino resetea los pm* (setPmSplitType solo se resetea en el codigo muerto; pmPaidParts/pmPaidAmount solo se cargan via loadPaidParts desde el codigo muerto o desde el refresh de pago parcial en 1460). El escenario de arrastre de estado entre mesas (split ByComensal + partes pagadas de otra orden afectando myPortion en 1394-1398) es real y justifica ALTA por riesgo de cobro incorrecto. Unica imprecision menor: las preferencias del cliente SI se muestran como banner informativo en el render del modal (2918-2964); lo que se pierde es el pre-llenado del formulario (pmMethod/pmTipPct/pmCustomTip/Mixed). El fix propuesto es correcto tal cual: openPaymentModal ya hace setSelectedOrder + setShowPaymentModal(true) internamente.

## 5. Hallazgos de menor prioridad (sin verificacion adversarial) (47)

Detectados por los auditores pero NO re-verificados adversarialmente. OJO: por el cap de verificacion (30), **14 de estos son ALTA o eliminaciones propuestas sin verificar** — tratarlos como hipotesis a confirmar antes de aplicar; el resto son MEDIA/BAJA no destructivos.

| # | Prio | Dim | App | Archivo | Hallazgo |
|---|------|-----|-----|---------|----------|
| 1 | ALTA | bugs | cashier-app | `src/frontend/cashier-app/app/page.tsx`:422-425 | Totales fiscales (ITBIS 18% + propina 10%) calculados en cliente con floats sin redondear y enviados como monto autoritativo |
| 2 | ALTA | bugs | cashier-app | `src/frontend/cashier-app/app/page.tsx`:467-469 | Pago mixto: sin validacion de que los subpagos cuadren con el total, y la propina extra se cobra pero nunca se registra |
| 3 | ALTA | clean | cashier-app | `src/frontend/cashier-app/app/page.tsx`:372-373, 427-430 | tipAmount es estado derivado congelado: si el carrito cambia despues de elegir %, se cobra una propina desactualizada |
| 4 | ALTA | clean | reservation-app | `src/frontend/reservation-app/app/book/page.tsx`:18-197 | ~200 lineas (~48%) de app/book/page.tsx duplican verbatim BookingEngineWarm.tsx |
| 5 | ALTA | dead | reservation-app | `src/frontend/reservation-app/app/book/page.tsx`:1-418 | Ruta /book huerfana: ningun link interno apunta a ella y es una version degradada del wizard |
| 6 | ALTA | clean | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/kds-app/lib/auth-client.ts`:1-198 | auth-client.ts copiado en las 7 apps con 3 versiones divergentes y muerto en 3 de ellas |
| 7 | ALTA | bugs | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/admin-panel/app/page.tsx`:180-184 | Deriva de getElapsedMinutes: el dashboard de admin omite la normalizacion UTC 'Z' que tienen las otras 6 copias |
| 8 | ALTA | clean | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/waiter-app/lib/useWaiterFloorPlan.ts`:1-157 | useWaiterFloorPlan y useHostFloorPlan son ~90% identicos y ambas apps ya estan en el workspace |
| 9 | MEDIA | clean | client-app | `src/frontend/client-app/app/cart/page.tsx`:102 | sessionId efímero: se genera uno nuevo en cada checkout y nunca se persiste (rompe la sesión de mesa) |
| 10 | MEDIA | bugs | client-app | `src/frontend/client-app/app/order-served/[id]/page.tsx`:66 | timeElapsed sin normalización UTC: muestra tiempos inflados ~+240 min (duplicación divergente con order-status) |
| 11 | MEDIA | bugs | client-app | `src/frontend/client-app/app/table/[qrCode]/page.tsx`:66-73 | setTimeout de redirección sin clearTimeout en el cleanup del useEffect |
| 12 | MEDIA | clean | client-app | `src/frontend/client-app/app/order-status/[id]/page.tsx`:9-13 | DRINK_KEYWORDS duplicado y divergente entre order-status y DishModal: la misma bebida se clasifica distinto |
| 13 | MEDIA | clean | admin-panel | `src/frontend/admin-panel/app/tables/page.tsx`:23-25, 115-116 | 14 instancias axios 'bare' duplicadas que ignoran el interceptor de refresh 401 de lib/api.ts; helper nv/getVal duplicado |
| 14 | MEDIA | bugs | kds-app | `src/frontend/kds-app/app/page.tsx`:168-247 | loadOrders concurrente sin guard de secuencia: respuestas fuera de orden y setState tras unmount |
| 15 | MEDIA | bugs | kds-app | `src/frontend/kds-app/app/page.tsx`:110-119 | JWT completo viaja en query string (?token=...) y el handoff nunca guarda refresh token |
| 16 | MEDIA | bugs | kds-app | `src/frontend/kds-app/app/page.tsx`:152-153 | setLoading(false) sin esperar el primer loadOrders: falso '¡Todo listo!' al montar |
| 17 | MEDIA | clean | kds-app | `src/frontend/kds-app/app/page.tsx`:346-349, 410-416, 450-452 | La logica de filtrado por tab esta duplicada 3 veces en el render |
| 18 | MEDIA | clean | kds-app | `src/frontend/kds-app/app/page.tsx`:322-325 | Logout con localStorage.clear() y LoginScreen re-implementa setSession: bypass del auth-client |
| 19 | MEDIA | bugs | waiter-app | `src/frontend/waiter-app/app/page.tsx`:757-865 | El setInterval de polling se crea tras varios await: si el componente se desmonta antes, el intervalo queda huerfano |
| 20 | MEDIA | clean | waiter-app | `src/frontend/waiter-app/app/page.tsx`:726-749 | Dos useEffect duplicados de bloqueo de scroll que se pisan entre si y rompen el lock para showMyOrderModal |
| 21 | MEDIA | bugs | host-app | `src/frontend/host-app/app/page.tsx`:267-315 | Respuestas fuera de orden al cambiar de zona en el modal de asignación (sin AbortController ni guard de secuencia) |
| 22 | MEDIA | clean | host-app | `src/frontend/host-app/app/page.tsx`:284-308 | Duplicación interna: fetch + normalización + filtro kitchen/bar de zonas repetido, y allZonesForAssign es estado derivable |
| 23 | MEDIA | clean | host-app | `src/frontend/host-app/app/page.tsx`:2016-2043 | occupancyForTableOnDate se ejecuta ~31 veces (filter+sort sobre todas las reservas) en cada render del modal de ocupación |
| 24 | MEDIA | bugs | cashier-app | `src/frontend/cashier-app/app/page.tsx`:76-92 | Condicion de carrera en loadPayments: respuestas fuera de orden pintan la caja del dia equivocado |
| 25 | MEDIA | bugs | cashier-app | `src/frontend/cashier-app/app/page.tsx`:391-395 | Carga del menu POS con error tragado en silencio: catch(() => {}) sin feedback ni retry |
| 26 | MEDIA | clean | cashier-app | `src/frontend/cashier-app/app/page.tsx`:69-74 y 148-157 vs 375-379 y 432-441 | Bloque fiscal RNC duplicado byte-a-byte entre CajaTab y NuevaVentaTab (6 estados + validateRnc identicos) |
| 27 | MEDIA | clean | cashier-app | `src/frontend/cashier-app/app/page.tsx`:755-779 | CashierApp reimplementa a mano la sesion que ya provee auth-client: JSON.parse sin try/catch, header default redundante y logout duplicado |
| 28 | MEDIA | bugs | reservation-app | `src/frontend/reservation-app/components/BookingEngineWarm.tsx`:117-131 | El intervalo del countdown del hold sigue vivo tras volver al paso 2: re-render por segundo indefinido y hold zombi |
| 29 | MEDIA | bugs | reservation-app | `src/frontend/reservation-app/components/BookingEngineWarm.tsx`:96-114 | fetchSlots sin guard de respuestas fuera de orden: el polling de 15s puede pisar datos frescos con datos viejos |
| 30 | MEDIA | bugs | reservation-app | `src/frontend/reservation-app/app/seguimiento/[code]/page.tsx`:44-54 | Un fallo de red transitorio en el polling de seguimiento muestra 'reserva no encontrada' y borra la vista cargada |
| 31 | MEDIA | bugs | reservation-app | `src/frontend/reservation-app/app/book/page.tsx`:203 | Toaster duplicado en /book: cada toast se renderiza dos veces |
| 32 | MEDIA | clean | reservation-app | `src/frontend/reservation-app/components/BookingEngineWarm.tsx`:55-580 | God component: 610 lineas, 21 useState y un calendario mensual construido en una IIFE dentro del JSX |
| 33 | MEDIA | clean | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/host-app/lib/useHostFloorPlan.ts`:112-119 | Bootstrap de SignalR repetido 10 veces en 5 apps, con kds-app como copia desviada |
| 34 | MEDIA | clean | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/client-app/lib/utils.ts`:14-20 | Formato de moneda RD$ inline 103 veces en las 7 apps con 3 comportamientos distintos (y el unico helper existente esta muerto) |
| 35 | MEDIA | clean | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/reservation-app/components/BookingEngineWarm.tsx`:34-42, 574-576 | Funnel de reserva implementado 3 veces (2 en reservation-app + 1 en host-app): to12h x5, estilos .inp/.warm-inp y flujo slots/hold/confirm duplicados |
| 36 | BAJA | bugs | admin-panel | `src/frontend/admin-panel/lib/useFloorPlanLive.ts`:249-266 | Timers de debounce (saveTimer/paletteTimer) sin cleanup al desmontar: el último PUT del editor puede perderse o dispararse tras unmount |
| 37 | BAJA | clean | admin-panel | `src/frontend/admin-panel/lib/useFloorPlanLive.ts`:180-196 | Polling de respaldo (60s) coexistiendo con SignalR — patrón INTENCIONAL, no eliminar |
| 38 | BAJA | bugs | waiter-app | `src/frontend/waiter-app/app/components/QrScanner.tsx`:170 | console.log de desarrollo en cada escaneo de QR |
| 39 | BAJA | bugs | host-app | `src/frontend/host-app/app/page.tsx`:634-642 | Carga del menú para el wizard con catch vacío: la pre-orden queda sin platos y sin ningún aviso |
| 40 | BAJA | dead | host-app | `src/frontend/host-app/app/page.tsx`:79-81 | Campos createdByHostId/createdByHostName declarados con comentario que promete UI inexistente |
| 41 | BAJA | dead | cashier-app | `src/frontend/cashier-app/app/page.tsx`:55 | Prop 'user' de CajaTab declarada y nunca usada |
| 42 | BAJA | dead | cashier-app | `src/frontend/cashier-app/lib/sentry.ts`:29-36, 44-52 | initSentry, captureMessage y setUserContext exportados sin ningun call-site; ademas nadie llama initSentry, rompiendo el plan de activacion documentado |
| 43 | BAJA | dead | cashier-app | `src/frontend/cashier-app/lib/auth-client.ts`:166-197 | Helpers del AuthApi (clear, logout, setSession, getUser, getToken) sin uso en cashier-app: la app escribe/lee localStorage a mano en paralelo |
| 44 | BAJA | dead | reservation-app | `src/frontend/reservation-app/lib/booking-api.ts`:8-36 | Campos de tipos nunca leidos: Slot.isPast, BookingResult.success y BookingResult.reservationDateTime |
| 45 | BAJA | dead | reservation-app | `src/frontend/reservation-app/lib/sentry.ts`:29-52 | initSentry, captureMessage y setUserContext exportados y nunca importados |
| 46 | BAJA | clean | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/waiter-app/app/page.tsx`:57-58 | shortOrder (ultimo segmento del orderNumber) reimplementado en 6 apps: 2 helpers nombrados + 12 usos inline |
| 47 | BAJA | clean | cross-app | `C:/Users/Signos admin/Documents/GitHub/SmartMenu/src/frontend/reservation-app/components/PhonePrefixSelect.tsx`:1-169 | countryCodes + PhonePrefixSelect viven solo en reservation-app: no moverlos a packages/ui todavia, pero anotar la inconsistencia de telefonos con host-app |

## 6. Hallazgos refutados por la verificacion (0)

_Ninguno: los 30 hallazgos verificados sobrevivieron la refutacion._
