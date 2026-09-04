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
          "' Para llevar'; al pulsarlo NO se abre una lista de selección, sino que el menú " +
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

export const FlujoCompleto: Story = {
  args: {},
};

export const CarritoDeMesa: Story = {
  args: { initialCartOpen: true, initialCart: MESA_CART },
};

export const ModoParaLlevar: Story = {
  args: {
    initialMode: "takeaway",
    initialCart: MESA_CART,
  },
};

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
