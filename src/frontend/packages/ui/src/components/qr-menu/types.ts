// QR-MENU (PROTOTIPO) — recreacion del menu digital del cliente (client-app al
// escanear el QR de la mesa) con la nueva senal "PARA LLEVAR" por plato mientras
// arma el pedido. SOLO STORYBOOK: no toca BD ni APIs.
//
// Mapeo futuro del flag (cuando se apruebe): un campo por item, p. ej.
// OrderItem.IsTakeaway (bit) — distinto de Order.IsPickup, que hoy marca la ORDEN
// completa de mostrador; aqui el cliente esta EN la mesa y aparta platos sueltos.

export type MenuTag = "muyPicante" | "picante" | "vegetariano" | "vegano" | "sinGluten" | "popular";

export type MenuCategory = "Entradas" | "Platos Fuertes" | "Pastas" | "Bebidas" | "Postres";

export interface QrMenuDish {
  dishId: number;
  category: MenuCategory;
  name: string;
  description: string;
  price: number;
  prepMinutes: number;
  emoji: string;
  tags: MenuTag[];
  /** Guarniciones disponibles en el modal (select "Guarnición"). */
  garnishes?: string[];
}

/** Momento de servicio (chips "¿Cuándo lo quieres servir?" del modal). */
export type CourseTiming = "Entrada" | "PlatoFuerte" | "Postre";

export interface QrMenuCartLine {
  dish: QrMenuDish;
  quantity: number;
  /** LA SENAL NUEVA: true = el cliente aparta este plato para llevar. */
  takeaway: boolean;
  courseTiming?: CourseTiming;
  garnish?: string;
  customizations?: string;
  allergies?: string;
  notes?: string;
}

export const MENU_TAG_META: Record<MenuTag, { label: string; emoji: string }> = {
  muyPicante:  { label: "Muy picante", emoji: "🌶️🌶️🌶️" },
  picante:     { label: "Picante",     emoji: "🌶️" },
  vegetariano: { label: "Vegetariano", emoji: "🥬" },
  vegano:      { label: "Vegano",      emoji: "🌱" },
  sinGluten:   { label: "Sin gluten",  emoji: "🚫🌾" },
  popular:     { label: "Popular",     emoji: "⭐" },
};

export const MENU_CATEGORIES: { key: MenuCategory; subtitle: string }[] = [
  { key: "Entradas",       subtitle: "Para comenzar" },
  { key: "Platos Fuertes", subtitle: "Especialidades de la casa" },
  { key: "Pastas",         subtitle: "Hechas al momento" },
  { key: "Bebidas",        subtitle: "Frías y calientes" },
  { key: "Postres",        subtitle: "El final perfecto" },
];
