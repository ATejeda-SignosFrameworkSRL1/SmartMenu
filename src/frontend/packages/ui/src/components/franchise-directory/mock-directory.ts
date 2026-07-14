// Mock del marketplace: categorias de comida + 5 franquicias de un mismo dueno con sus
// menus. dishId/restaurantId simulan las FKs reales (Dish → Category → Menu.RestaurantId).
import type { DirectoryDish, FoodCategory, FranchiseSummary } from "./types";

/** Grilla completa del modal "Ver todas"; el carrusel muestra las primeras ~10. */
export const MOCK_FOOD_CATEGORIES: FoodCategory[] = [
  { slug: "pollo",      name: "Pollo",                 emoji: "🍗" },
  { slug: "carnes",     name: "Carnes",                emoji: "🥩" },
  { slug: "pizzas",     name: "Pizzas",                emoji: "🍕" },
  { slug: "japonesa",   name: "Comida Japonesa",       emoji: "🍣" },
  { slug: "criolla",    name: "Comida Dominicana",     emoji: "🍛" },
  { slug: "italiana",   name: "Comida Italiana",       emoji: "🍝" },
  { slug: "saludable",  name: "Saludable",             emoji: "🥗" },
  { slug: "ensaladas",  name: "Ensaladas",             emoji: "🥬" },
  { slug: "jugos",      name: "Jugos y Smoothies",     emoji: "🧃" },
  { slug: "postres",    name: "Postres",               emoji: "🍰" },
  { slug: "cafe",       name: "Café",                  emoji: "☕" },
  { slug: "mariscos",   name: "Pescados y Mariscos",   emoji: "🦐" },
  { slug: "desayunos",  name: "Desayunos",             emoji: "🥞" },
  { slug: "bebidas",    name: "Bebidas",               emoji: "🥤" },
  { slug: "panaderia",  name: "Panadería y Repostería", emoji: "🥐" },
];

export const MOCK_FRANCHISES: FranchiseSummary[] = [
  { restaurantId: 1, name: "La Parrilla Criolla", cuisine: "Carnes & Criolla", emoji: "🥩", rating: 4.8, reviews: 312, deliveryMin: 20, deliveryMax: 35, isOpen: true,  tagline: "Cortes premium a la brasa",  foodCategories: ["carnes", "criolla", "pollo", "bebidas"] },
  { restaurantId: 2, name: "Sushi Kai",           cuisine: "Japonesa",         emoji: "🍣", rating: 4.7, reviews: 168, deliveryMin: 15, deliveryMax: 30, isOpen: true,  tagline: "Rolls y nigiri de autor",    foodCategories: ["japonesa", "mariscos"] },
  { restaurantId: 3, name: "Pizza Nostra",        cuisine: "Italiana",         emoji: "🍕", rating: 4.5, reviews: 421, deliveryMin: 10, deliveryMax: 25, isOpen: true,  tagline: "Horno de leña napolitano",   foodCategories: ["pizzas", "italiana"] },
  { restaurantId: 4, name: "Verde Vivo",          cuisine: "Saludable",        emoji: "🥗", rating: 4.6, reviews: 97,  deliveryMin: 10, deliveryMax: 20, isOpen: true,  tagline: "Bowls, jugos y ensaladas",   foodCategories: ["saludable", "ensaladas", "jugos", "desayunos"] },
  { restaurantId: 5, name: "Dulce Alma",          cuisine: "Postres & Café",   emoji: "🍰", rating: 4.9, reviews: 254, deliveryMin: 5,  deliveryMax: 15, isOpen: false, tagline: "Reposteria artesanal",       foodCategories: ["postres", "cafe", "panaderia"] },
];

export const MOCK_DIRECTORY_DISHES: DirectoryDish[] = [
  // ── La Parrilla Criolla (1) ──
  { dishId: 101, restaurantId: 1, category: "Cortes",    name: "Ribeye Premium 12oz",      description: "Madurado 28 dias, termino a eleccion",     price: 985, bestSeller: true },
  { dishId: 102, restaurantId: 1, category: "Cortes",    name: "Churrasco 10oz",           description: "Con chimichurri de la casa",               price: 745 },
  { dishId: 103, restaurantId: 1, category: "Criollos",  name: "Pollo Marsala",            description: "Salsa de vino y champinones",              price: 485, bestSeller: true },
  { dishId: 105, restaurantId: 1, category: "Criollos",  name: "Mofongo con Chicharron",   description: "Platano majado, ajo, chicharron crujiente", price: 395 },
  { dishId: 104, restaurantId: 1, category: "Bebidas",   name: "Jugo de Chinola",          description: "Natural, sin azucar anadida",              price: 105 },
  // ── Sushi Kai (2) ──
  { dishId: 201, restaurantId: 2, category: "Rolls",     name: "Roll Acevichado",          description: "Langostino, aguacate, salsa acevichada",   price: 495, bestSeller: true },
  { dishId: 202, restaurantId: 2, category: "Rolls",     name: "Dragon Roll",              description: "Anguila, pepino, tobiko",                  price: 545 },
  { dishId: 203, restaurantId: 2, category: "Nigiri",    name: "Combo Nigiri (12 pzas)",   description: "Seleccion del itamae",                     price: 990 },
  { dishId: 204, restaurantId: 2, category: "Entradas",  name: "Gyozas de Cerdo",          description: "5 piezas, salsa ponzu",                    price: 250 },
  // ── Pizza Nostra (3) ──
  { dishId: 301, restaurantId: 3, category: "Pizzas",    name: "Margherita Familiar",      description: "San Marzano, fior di latte, albahaca",     price: 640, bestSeller: true },
  { dishId: 302, restaurantId: 3, category: "Pizzas",    name: "Pepperoni Personal",       description: "Doble pepperoni, oregano",                 price: 255 },
  { dishId: 303, restaurantId: 3, category: "Calzones",  name: "Calzone de Jamon",         description: "Ricotta, mozzarella, jamon serrano",       price: 300 },
  // ── Verde Vivo (4) ──
  { dishId: 401, restaurantId: 4, category: "Bowls",     name: "Bowl Mediterraneo",        description: "Quinoa, falafel, hummus, tahini",          price: 425, bestSeller: true },
  { dishId: 402, restaurantId: 4, category: "Ensaladas", name: "Cesar con Pollo",          description: "Aderezo casero, crutones de masa madre",   price: 395 },
  { dishId: 403, restaurantId: 4, category: "Jugos",     name: "Green Detox",              description: "Pepino, apio, manzana verde, jengibre",    price: 185 },
  // ── Dulce Alma (5) ──
  { dishId: 501, restaurantId: 5, category: "Postres",   name: "Tres Leches de la Casa",   description: "Receta de la abuela",                      price: 225, bestSeller: true },
  { dishId: 502, restaurantId: 5, category: "Postres",   name: "Copa de Helado Artesanal", description: "3 bolas, toppings a eleccion",             price: 265 },
  { dishId: 503, restaurantId: 5, category: "Cafe",      name: "Cappuccino Doble",         description: "Grano dominicano de altura",               price: 165 },
];
