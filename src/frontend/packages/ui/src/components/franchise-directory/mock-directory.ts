// Mock del directorio: 5 franquicias de un mismo dueno, cada una con su menu.
// dishId/restaurantId simulan las FKs reales (Dish → Category → Menu.RestaurantId).
import type { DirectoryDish, FranchiseSummary } from "./types";

export const MOCK_FRANCHISES: FranchiseSummary[] = [
  { restaurantId: 1, name: "La Parrilla Criolla", cuisine: "Carnes & Criolla", emoji: "🥩", rating: 4.8, prepMinutes: 25, isOpen: true,  tagline: "Cortes premium a la brasa" },
  { restaurantId: 2, name: "Sushi Kai",           cuisine: "Japonesa",         emoji: "🍣", rating: 4.7, prepMinutes: 20, isOpen: true,  tagline: "Rolls y nigiri de autor" },
  { restaurantId: 3, name: "Pizza Nostra",        cuisine: "Italiana",         emoji: "🍕", rating: 4.5, prepMinutes: 18, isOpen: true,  tagline: "Horno de leña napolitano" },
  { restaurantId: 4, name: "Verde Vivo",          cuisine: "Saludable",        emoji: "🥗", rating: 4.6, prepMinutes: 12, isOpen: true,  tagline: "Bowls, jugos y ensaladas" },
  { restaurantId: 5, name: "Dulce Alma",          cuisine: "Postres & Café",   emoji: "🍰", rating: 4.9, prepMinutes: 10, isOpen: false, tagline: "Reposteria artesanal" },
];

export const MOCK_DIRECTORY_DISHES: DirectoryDish[] = [
  // ── La Parrilla Criolla (1) ──
  { dishId: 101, restaurantId: 1, category: "Cortes",     name: "Ribeye Premium 12oz",     description: "Madurado 28 dias, termino a eleccion", price: 985 },
  { dishId: 102, restaurantId: 1, category: "Cortes",     name: "Churrasco 10oz",          description: "Con chimichurri de la casa",           price: 745 },
  { dishId: 103, restaurantId: 1, category: "Criollos",   name: "Pollo Marsala",           description: "Salsa de vino y champinones",          price: 485 },
  { dishId: 104, restaurantId: 1, category: "Bebidas",    name: "Jugo de Chinola",         description: "Natural, sin azucar anadida",          price: 105 },
  // ── Sushi Kai (2) ──
  { dishId: 201, restaurantId: 2, category: "Rolls",      name: "Roll Acevichado",         description: "Langostino, aguacate, salsa acevichada", price: 495 },
  { dishId: 202, restaurantId: 2, category: "Rolls",      name: "Dragon Roll",             description: "Anguila, pepino, tobiko",              price: 545 },
  { dishId: 203, restaurantId: 2, category: "Nigiri",     name: "Combo Nigiri (12 pzas)",  description: "Seleccion del itamae",                 price: 990 },
  { dishId: 204, restaurantId: 2, category: "Entradas",   name: "Gyozas de Cerdo",         description: "5 piezas, salsa ponzu",                price: 250 },
  // ── Pizza Nostra (3) ──
  { dishId: 301, restaurantId: 3, category: "Pizzas",     name: "Margherita Familiar",     description: "San Marzano, fior di latte, albahaca", price: 640 },
  { dishId: 302, restaurantId: 3, category: "Pizzas",     name: "Pepperoni Personal",      description: "Doble pepperoni, oregano",             price: 255 },
  { dishId: 303, restaurantId: 3, category: "Calzones",   name: "Calzone de Jamon",        description: "Ricotta, mozzarella, jamon serrano",   price: 300 },
  // ── Verde Vivo (4) ──
  { dishId: 401, restaurantId: 4, category: "Bowls",      name: "Bowl Mediterraneo",       description: "Quinoa, falafel, hummus, tahini",      price: 425 },
  { dishId: 402, restaurantId: 4, category: "Ensaladas",  name: "Cesar con Pollo",         description: "Aderezo casero, crutones de masa madre", price: 395 },
  { dishId: 403, restaurantId: 4, category: "Jugos",      name: "Green Detox",             description: "Pepino, apio, manzana verde, jengibre", price: 185 },
  // ── Dulce Alma (5) ──
  { dishId: 501, restaurantId: 5, category: "Postres",    name: "Tres Leches de la Casa",  description: "Receta de la abuela",                  price: 225 },
  { dishId: 502, restaurantId: 5, category: "Postres",    name: "Copa de Helado Artesanal", description: "3 bolas, toppings a eleccion",        price: 265 },
  { dishId: 503, restaurantId: 5, category: "Cafe",       name: "Cappuccino Doble",        description: "Grano dominicano de altura",           price: 165 },
];
