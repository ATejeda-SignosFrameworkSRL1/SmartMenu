// FRANCHISE-DIRECTORY (PROTOTIPO) — maquetacion del marketplace multi-franquicia
// del lado CLIENTE: el usuario se registra (en la pagina de reservation), navega un
// directorio de franquicias de un mismo dueno, arma un carrito MIXTO y al pagar el
// sistema genera UNA orden independiente por franquicia (Orders.RestaurantId FK),
// para que cada cocina procese y cobre lo suyo.
// SOLO STORYBOOK: no toca BD ni APIs. Modelo de referencia: rama feature/invoice-delivery-tracking.

export interface FranchiseSummary {
  /** = Restaurants.Id (cada franquicia es un Restaurant con su propio RNC). */
  restaurantId: number;
  name: string;
  cuisine: string;
  emoji: string;
  rating: number;
  prepMinutes: number;
  isOpen: boolean;
  tagline: string;
}

/** Plato del menu de UNA franquicia — la cadena real es Dish → Category → Menu.RestaurantId. */
export interface DirectoryDish {
  dishId: number;
  /** Franquicia duena (derivada de Menu.RestaurantId; el server NUNCA confia en el cliente). */
  restaurantId: number;
  category: string;
  name: string;
  description: string;
  price: number;
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
