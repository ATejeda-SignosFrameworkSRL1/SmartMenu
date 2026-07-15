import type { Meta, StoryObj } from "@storybook/react";

import { QrMenu } from "./qr-menu";
import { MOCK_QR_MENU } from "./mock-menu";

const meta: Meta<typeof QrMenu> = {
  title: "QR Menu/Para Llevar",
  component: QrMenu,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "PROTOTIPO (solo maquetación, sin BD/APIs): menú del QR del cliente con el 'Para " +
          "llevar' como PROCESO APARTE. En el carrito, junto a 'Confirmar Orden', hay un botón " +
          "'🥡 Para llevar'; al pulsarlo NO se abre una lista de selección, sino que el menú " +
          "entra en MODO PARA LLEVAR y el cliente vuelve al catálogo general a armar un pedido " +
          "para llevar SEPARADO (con su propia confirmación). Dos procesos independientes, un " +
          "pedido cada uno: el de la mesa y el para llevar. Mapeo futuro: cada proceso = una " +
          "Order (Order.IsPickup=true para la de llevar).",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof QrMenu>;

const MESA_CART = [
  { dish: MOCK_QR_MENU.find((d) => d.dishId === 4)!, quantity: 1, takeaway: false, courseTiming: "PlatoFuerte" as const, garnish: "Puré de papa" },
  { dish: MOCK_QR_MENU.find((d) => d.dishId === 12)!, quantity: 2, takeaway: false, courseTiming: "PlatoFuerte" as const },
  { dish: MOCK_QR_MENU.find((d) => d.dishId === 3)!, quantity: 1, takeaway: false, courseTiming: "Entrada" as const },
];

/**
 * Flujo completo: se arma el pedido de la mesa, se abre el carrito y ahí conviven
 * "Confirmar Orden" y "🥡 Para llevar". El botón "Para llevar" cambia el menú a modo
 * llevar y regresa al catálogo para un pedido aparte.
 */
export const FlujoCompleto: Story = {
  args: {},
};

/**
 * El carrito de MESA abierto con platos: se ve el botón "🥡 Para llevar" al lado de
 * "Confirmar Orden" (el punto de entrada al proceso para llevar).
 */
export const CarritoDeMesa: Story = {
  args: { initialCartOpen: true, initialCart: MESA_CART },
};

/**
 * MODO PARA LLEVAR activo: el banner "Estás armando un pedido PARA LLEVAR" sobre el
 * catálogo general; cada "Agregar" va al pedido para llevar (separado del de mesa).
 * Se puede volver al pedido de mesa desde el banner.
 */
export const ModoParaLlevar: Story = {
  args: {
    initialMode: "takeaway",
    initialCart: MESA_CART, // el pedido de mesa sigue existiendo aparte
  },
};

/**
 * El carrito del pedido PARA LLEVAR abierto: su propia confirmación ("Confirmar para
 * llevar") y el botón para volver al pedido de mesa. Proceso independiente.
 */
export const CarritoParaLlevar: Story = {
  args: {
    initialMode: "takeaway",
    initialCartOpen: true,
    initialCart: MESA_CART,
    initialTakeawayCart: [
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 14)!, quantity: 2, takeaway: true, courseTiming: "Postre" as const },
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 11)!, quantity: 1, takeaway: true },
    ],
  },
};
