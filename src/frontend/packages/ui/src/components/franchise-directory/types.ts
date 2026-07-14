// FRANCHISE-DIRECTORY (PROTOTIPO) — maquetacion estilo marketplace de delivery
// (PedidosYa-like) del lado CLIENTE: el usuario se registra (en la pagina de
// reservation), ve el HOME con la opcion Restaurantes + logos de franquicias,
// entra al LISTADO con categorias de comida + todos los restaurantes, y cada
// restaurante conecta a su CATALOGO de menu. El carrito es MIXTO y al pagar el
// sistema genera UNA orden independiente por franquicia (Orders.RestaurantId FK),
// para que cada cocina procese y cobre lo suyo.
// SOLO STORYBOOK: no toca BD ni APIs. Backend de referencia: rama feature/invoice-delivery-tracking.

/** Categoria de comida (carrusel "Comidas" + modal "Ver todas"); filtra restaurantes. */
export interface FoodCategory {
  slug: string;
  name: string;
  emoji: string;
}

export interface FranchiseSummary {
  /** = Restaurants.Id (cada franquicia es un Restaurant con su propio RNC). */
  restaurantId: number;
  name: string;
  cuisine: string;
  emoji: string;
  rating: number;
  reviews: number;
  /** Rango de entrega "Recibes en X-Y min". */
  deliveryMin: number;
  deliveryMax: number;
  isOpen: boolean;
  tagline: string;
  /** Slugs de FoodCategory que ofrece (para el filtro del listado). */
  foodCategories: string[];
}

/** Plato del menu de UNA franquicia — la cadena real es Dish → Category → Menu.RestaurantId. */
export interface DirectoryDish {
  dishId: number;
  /** Franquicia duena (derivada de Menu.RestaurantId; el server NUNCA confia en el cliente). */
  restaurantId: number;
  /** Seccion del menu del restaurante (chips del catalogo). */
  category: string;
  name: string;
  description: string;
  price: number;
  bestSeller?: boolean;
}

export interface CartLine {
  dish: DirectoryDish;
  quantity: number;
}

/** Grupo del carrito = la futura Order independiente de esa franquicia. */
export interface FranchiseCartGroup {
  franchise: FranchiseSummary;
  lines: CartLine[];
  subtotal: number;
  /** ITBIS 18% — en la implementacion real viene de BillingSettings, no hardcodeado. */
  tax: number;
  /** Propina legal 10% (Ley 13-07) — idem, BillingSettings. */
  tip: number;
  total: number;
}
