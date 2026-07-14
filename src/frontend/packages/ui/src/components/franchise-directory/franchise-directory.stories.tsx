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
          "PROTOTIPO (solo maquetación, sin BD): el cliente se registra en la página de " +
          "reservation, navega un DIRECTORIO de franquicias de un mismo dueño, arma un " +
          "carrito MIXTO y paga UNA factura global. El carrito visualiza la regla del " +
          "modelo de datos: cada franquicia genera su Order independiente " +
          "(Orders.RestaurantId FK, derivado de Menus.RestaurantId) con su ITBIS/propina " +
          "propios, para que cada cocina procese y cobre lo suyo. " +
          "Implementación backend de referencia: rama feature/invoice-delivery-tracking.",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof FranchiseDirectory>;

/**
 * Flujo completo del cliente: registro → directorio → entrar a una franquicia y
 * agregar platos (repite con otra franquicia) → carrito con el split por franquicia
 * y la factura global que suma.
 */
export const FlujoCompleto: Story = {
  args: { initialView: "register" },
};

/** El directorio directo (usuario ya registrado): buscar, ver abiertos/cerrados, entrar. */
export const Directorio: Story = {
  args: { initialView: "directory" },
};

/**
 * Carrito mixto precargado con platos de 3 franquicias — muestra el split en
 * 3 órdenes independientes (cada una con su Orders.RestaurantId y su fiscal propio)
 * y la factura global de un solo pago.
 */
export const CarritoMixtoTresOrdenes: Story = {
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

/** Carrito vacío (estado inicial tras registrarse sin agregar nada). */
export const CarritoVacio: Story = {
  args: { initialView: "cart", initialCart: [] },
};
