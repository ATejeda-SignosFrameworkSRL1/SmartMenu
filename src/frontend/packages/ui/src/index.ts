/**
 * @smartmenu/ui — barrel de primitivos compartidos.
 * Importá: import { Button, Card, Dialog, Select, cn } from "@smartmenu/ui";
 */
export { cn } from "./lib/cn";
export { useIsMobile } from "./hooks/use-mobile";

// ── Átomos ───────────────────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/card";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export { Input, type InputProps } from "./components/input";
export { Label } from "./components/label";
export { Spinner } from "./components/spinner";
export { Separator } from "./components/separator";
export { Skeleton } from "./components/skeleton";
export { ScrollArea, ScrollBar } from "./components/scroll-area";

// ── Formulario ───────────────────────────────────────────────────────────
export { Checkbox } from "./components/checkbox";
export { Switch } from "./components/switch";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/select";

// ── Overlays / navegación ─────────────────────────────────────────────────
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./components/tooltip";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog";
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "./components/sheet";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";

// ── Layout: Sidebar ────────────────────────────────────────────────────────
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./components/sidebar";

// ── Floor Plan (react-konva) ────────────────────────────────────────────────
export { TableShape, type TableShapeProps } from "./components/floor-plan/table-shape";
export { getChairLayout, type ChairTransform } from "./components/floor-plan/chair-layout";
export { StructureShape, type StructureShapeProps } from "./components/floor-plan/structure-shape";
export { FloorPlanCanvas, type FloorPlanCanvasProps } from "./components/floor-plan/floor-plan-canvas";
export { FloorPlanViewer, type FloorPlanViewerProps } from "./components/floor-plan/floor-plan-viewer";
export { FloorPlanEditor, type FloorPlanEditorProps } from "./components/floor-plan/floor-plan-editor";
export {
  MultiZoneFloorPlanViewer,
  type MultiZoneFloorPlanViewerProps,
} from "./components/floor-plan/multi-zone-floor-plan-viewer";
export {
  MultiZoneFloorPlanEditor,
  type MultiZoneFloorPlanEditorProps,
} from "./components/floor-plan/multi-zone-floor-plan-editor";
export { MULTI_ZONE_FLOOR_PLAN } from "./components/floor-plan/multi-zone-mock";
export {
  FloorPlanDashboard,
  type FloorPlanDashboardProps,
  type Reservation,
  type ReservationStatus,
} from "./components/floor-plan/floor-plan-dashboard";
export {
  FloorPlanModule,
  type FloorPlanModuleProps,
  type FloorPlanChannel,
} from "./components/floor-plan/floor-plan-module";
export {
  STATUS_COLORS,
  STATUS_LABELS,
  SERVER_COLORS,
  WAITER_BADGE_PALETTE,
  waiterColor,
  resolveStatusColors,
  contrastText,
  type StatusColor,
  type StatusPaletteOverride,
} from "./components/floor-plan/status-colors";
export type {
  TableData,
  TableStatus,
  TableShapeKind,
  FloorPlanData,
  FloorPlanZone,
  StructureData,
  StructureType,
} from "./components/floor-plan/types";
export { BISTRO_TABLES } from "./components/floor-plan/bistro-tables";
