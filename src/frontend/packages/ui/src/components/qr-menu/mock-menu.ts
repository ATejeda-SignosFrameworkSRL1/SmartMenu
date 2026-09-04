
import type { QrMenuDish } from "./types";

const GARNISHES_MAIN = ["Sin preferencia", "Vegetales asados", "Puré de papa", "Arroz jazmín", "Tostones"];

export const MOCK_QR_MENU: QrMenuDish[] = [

  { dishId: 1, category: "Entradas", name: "Bruschetta Italiana", description: "Pan tostado con tomates frescos, albahaca y aceite de oliva extra virgen", price: 245, prepMinutes: 10, emoji: "🍅", tags: ["vegetariano"] },
  { dishId: 2, category: "Entradas", name: "Carpaccio de Res", description: "Finas láminas de res con rúcula, parmesano y vinagreta de limón", price: 385, prepMinutes: 12, emoji: "🥩", tags: [] },
  { dishId: 3, category: "Entradas", name: "Ensalada César", description: "Lechuga romana, crutones, parmesano y aderezo césar casero", price: 295, prepMinutes: 8, emoji: "🥗", tags: ["vegetariano"] },

  { dishId: 4, category: "Platos Fuertes", name: "Ribeye Premium 12oz", description: "Ribeye de 12oz con guarnición de vegetales asados y papas al romero", price: 985, prepMinutes: 25, emoji: "🥩", tags: ["popular"], garnishes: GARNISHES_MAIN },
  { dishId: 5, category: "Platos Fuertes", name: "Salmón a la Parrilla", description: "Filete de salmón fresco con vegetales y arroz jazmín", price: 685, prepMinutes: 20, emoji: "🐟", tags: ["sinGluten"], garnishes: GARNISHES_MAIN },
  { dishId: 6, category: "Platos Fuertes", name: "Pollo Marsala", description: "Pechuga de pollo en salsa marsala con champiñones", price: 485, prepMinutes: 22, emoji: "🍗", tags: ["popular"], garnishes: GARNISHES_MAIN },
  { dishId: 7, category: "Platos Fuertes", name: "Camarones al Ajillo", description: "Camarones salteados en aceite de oliva, ajo y ají picante", price: 745, prepMinutes: 18, emoji: "🦐", tags: ["picante", "sinGluten"], garnishes: GARNISHES_MAIN },

  { dishId: 8, category: "Pastas", name: "Fettuccine Alfredo", description: "Pasta fresca en salsa cremosa de parmesano", price: 425, prepMinutes: 15, emoji: "🍝", tags: ["vegetariano"] },
  { dishId: 9, category: "Pastas", name: "Espagueti a la Boloñesa", description: "Salsa de carne cocida a fuego lento con tomates San Marzano", price: 465, prepMinutes: 17, emoji: "🍝", tags: ["popular"] },
  { dishId: 10, category: "Pastas", name: "Penne Arrabbiata", description: "Salsa de tomate con ajo y peperoncino — bien picante", price: 395, prepMinutes: 14, emoji: "🌶️", tags: ["muyPicante", "vegano"] },

  { dishId: 11, category: "Bebidas", name: "Jugo de Chinola", description: "Natural, sin azúcar añadida", price: 105, prepMinutes: 5, emoji: "🧃", tags: ["vegano", "sinGluten"] },
  { dishId: 12, category: "Bebidas", name: "Mojito Clásico", description: "Ron, hierbabuena, limón y soda", price: 285, prepMinutes: 6, emoji: "🍹", tags: ["popular"] },
  { dishId: 13, category: "Bebidas", name: "Cappuccino", description: "Grano dominicano de altura", price: 145, prepMinutes: 5, emoji: "☕", tags: ["vegetariano"] },

  { dishId: 14, category: "Postres", name: "Tres Leches de la Casa", description: "Receta de la abuela con canela", price: 225, prepMinutes: 5, emoji: "🍰", tags: ["popular", "vegetariano"] },
  { dishId: 15, category: "Postres", name: "Copa de Helado Artesanal", description: "3 bolas, toppings a elección", price: 265, prepMinutes: 4, emoji: "🍨", tags: ["vegetariano"] },
];
