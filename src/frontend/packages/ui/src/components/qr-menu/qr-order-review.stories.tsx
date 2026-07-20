import type { Meta, StoryObj } from "@storybook/react";

import { QrOrderReview } from "./qr-order-review";
import { MOCK_QR_MENU } from "./mock-menu";

const meta: Meta<typeof QrOrderReview> = {
  title: "QR Menu/Agregar a mi Orden",
  component: QrOrderReview,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "PROTOTIPO (solo maquetación, sin BD/APIs): pantalla 'Agregar a mi Orden' del cliente " +
          "(revisión antes de sumar a la orden existente): Tus Platos con steppers y eliminar, " +
          "Instrucciones Especiales, Tu orden detallada y Resumen fiscal (ITBIS 18% + propina " +
          "legal 10%, Ley 13-07). Aquí se colocó el botón VISUAL ' Para llevar' junto al botón " +
          "'Agregar a mi Orden' — placeholder de diseño, sin función.",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof QrOrderReview>;

/** Un plato (como la captura de referencia). */
export const UnPlato: Story = {
  args: {
    initialLines: [{ dish: MOCK_QR_MENU.find((d) => d.dishId === 1)!, quantity: 1, takeaway: false }],
  },
};

/** Varios platos, para ver el resumen con más líneas. */
export const VariosPlatos: Story = {
  args: {
    initialLines: [
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 1)!, quantity: 1, takeaway: false },
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 4)!, quantity: 1, takeaway: false },
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 12)!, quantity: 2, takeaway: false },
    ],
  },
};
