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
          "PROTOTIPO (solo maquetación, sin BD/APIs): recreación del menú digital que ve el " +
          "cliente al escanear el QR de su mesa, con la señal 'PARA LLEVAR' por plato. UX " +
          "elegida (Variante B refinada — 'la señal silenciosa'): la opción frecuente (mesa) " +
          "cuesta 1 tap; la excepción (llevar) es visible pero silenciosa y siempre corregible. " +
          "(1) Card: 'Agregar' + botón compacto 🥡 al lado. (2) Modal del plato: switch " +
          "'🥡 Para llevar' junto a la cantidad. (3) Carrito: cada línea alterna su señal " +
          "🍽️/🥡 con un clic. (4) Switch '¿Todo para llevar?' para empacar el pedido completo. " +
          "El flag viaja como etiqueta 'PARA LLEVAR' a cocina (comanda/KDS). Se descartó el " +
          "pop-up por fatiga y errores de tapeo. Mapeo futuro: OrderItem.IsTakeaway (por ítem; " +
          "distinto de Order.IsPickup que marca la orden entera).",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof QrMenu>;

/**
 * Flujo completo: buscar/filtrar → "Agregar" (mesa, 1 tap) o 🥡 (para llevar) desde
 * la card → o abrir el plato y usar el switch "Para llevar" junto a la cantidad →
 * revisar el carrito, alternar señales por línea o marcar "¿Todo para llevar?".
 */
export const FlujoCompleto: Story = {
  args: {},
};

/**
 * Carrito abierto con señales mixtas: platos en mesa y platos 🥡 para llevar en el
 * mismo pedido. Cada línea alterna su señal con un clic; el switch de arriba empaca
 * (o des-empaca) todo el pedido de una vez.
 */
export const CarritoMixto: Story = {
  args: {
    initialCartOpen: true,
    initialCart: [
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 4)!, quantity: 1, takeaway: false, courseTiming: "PlatoFuerte", garnish: "Puré de papa" },
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 12)!, quantity: 2, takeaway: false, courseTiming: "PlatoFuerte" },
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 14)!, quantity: 1, takeaway: true, courseTiming: "Postre", notes: "Para llevar al salir" },
      { dish: MOCK_QR_MENU.find((d) => d.dishId === 1)!, quantity: 1, takeaway: true, allergies: "alérgico a nueces" },
    ],
  },
};
