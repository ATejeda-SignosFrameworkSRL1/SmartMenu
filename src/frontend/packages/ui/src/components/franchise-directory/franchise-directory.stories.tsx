import type { Meta, StoryObj } from "@storybook/react";

import { FranchiseDirectory } from "./franchise-directory";
import { MOCK_DIRECTORY_DISHES } from "./mock-directory";

const meta: Meta<typeof FranchiseDirectory> = {
  title: "Franchise Directory/Marketplace",
  component: FranchiseDirectory,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "PROTOTIPO estilo marketplace de delivery (sin barra de envío gratis ni descuentos, " +
          "por decisión de producto). Flujo: el cliente se registra en la página de reservation → " +
          "HOME con la opción Restaurantes + logos de las franquicias → LISTADO con las categorías " +
          "de comida de las distintas franquicias ('Ver todas' abre la grilla completa) y todos los " +
          "restaurantes → cada restaurante conecta a su CATÁLOGO de menú (chips por categoría, " +
          "'Más vendido', sidebar Mi pedido). El carrito mixto visualiza la regla del modelo de " +
          "datos: cada franquicia genera su Order independiente (Orders.RestaurantId FK, derivado " +
          "de Menus.RestaurantId) con su ITBIS/propina propios; la factura global solo suma. " +
          "SOLO Storybook — sin BD ni APIs. Backend de referencia: rama feature/invoice-delivery-tracking.",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof FranchiseDirectory>;

export const FlujoCompleto: Story = {
  args: { initialView: "register" },
};

export const Home: Story = {
  args: { initialView: "home" },
};

export const ListadoRestaurantes: Story = {
  args: { initialView: "restaurants" },
};

export const CatalogoDeRestaurante: Story = {
  args: { initialView: "menu", initialRestaurantId: 1 },
};

export const PedidoMixtoTresOrdenes: Story = {
  args: {
    initialView: "cart",
    initialCart: [
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 101)!, quantity: 1 },
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 104)!, quantity: 2 },
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 201)!, quantity: 1 },
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 302)!, quantity: 2 },
    ],
  },
};
