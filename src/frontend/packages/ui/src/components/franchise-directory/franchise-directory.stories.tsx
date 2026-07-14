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

/**
 * Flujo completo del cliente: registro → home (tiles + logos de franquicias) →
 * "Restaurantes" → filtrar por categoría de comida / Ver todas → entrar a un
 * restaurante, agregar platos (repite con otra franquicia) → pedido con el split
 * por franquicia y la factura global.
 */
export const FlujoCompleto: Story = {
  args: { initialView: "register" },
};

/** El home tras registrarse: tiles de negocio, logos de franquicias, banners informativos. */
export const Home: Story = {
  args: { initialView: "home" },
};

/** Listado "Restaurantes": carrusel de categorías de comida + todos los locales. */
export const ListadoRestaurantes: Story = {
  args: { initialView: "restaurants" },
};

/** Catálogo de un restaurante: chips de categorías, "Más vendido" y sidebar Mi pedido. */
export const CatalogoDeRestaurante: Story = {
  args: { initialView: "menu", initialRestaurantId: 1 },
};

/**
 * Pedido mixto precargado con platos de 3 franquicias — el split en 3 órdenes
 * independientes (cada una con su Orders.RestaurantId y su fiscal propio) y la
 * factura global de un solo pago.
 */
export const PedidoMixtoTresOrdenes: Story = {
  args: {
    initialView: "cart",
    initialCart: [
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 101)!, quantity: 1 }, // Parrilla
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 104)!, quantity: 2 }, // Parrilla
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 201)!, quantity: 1 }, // Sushi
      { dish: MOCK_DIRECTORY_DISHES.find((d) => d.dishId === 302)!, quantity: 2 }, // Pizza
    ],
  },
};
