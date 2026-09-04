
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

  garnishes?: string[];
}

export type CourseTiming = "Entrada" | "PlatoFuerte" | "Postre";

export interface QrMenuCartLine {
  dish: QrMenuDish;
  quantity: number;

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
