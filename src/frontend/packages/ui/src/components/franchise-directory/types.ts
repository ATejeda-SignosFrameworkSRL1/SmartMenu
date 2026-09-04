
export interface FoodCategory {
  slug: string;
  name: string;
  emoji: string;
}

export interface FranchiseSummary {

  restaurantId: number;
  name: string;
  cuisine: string;
  emoji: string;
  rating: number;
  reviews: number;

  deliveryMin: number;
  deliveryMax: number;
  isOpen: boolean;
  tagline: string;

  foodCategories: string[];
}

export interface DirectoryDish {
  dishId: number;

  restaurantId: number;

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

export interface FranchiseCartGroup {
  franchise: FranchiseSummary;
  lines: CartLine[];
  subtotal: number;

  tax: number;

  tip: number;
  total: number;
}
