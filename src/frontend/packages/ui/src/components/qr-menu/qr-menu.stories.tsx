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

const MIXED_CART = [
  { dish: MOCK_QR_MENU.find((d) => d.dishId === 4)!, quantity: 1, takeaway: false, courseTiming: "PlatoFuerte" as const, garnish: "Puré de papa" },
  { dish: MOCK_QR_MENU.find((d) => d.dishId === 12)!, quantity: 2, takeaway: false, courseTiming: "PlatoFuerte" as const },
  { dish: MOCK_QR_MENU.find((d) => d.dishId === 14)!, quantity: 1, takeaway: true, courseTiming: "Postre" as const, notes: "Para llevar al salir" },
  { dish: MOCK_QR_MENU.find((d) => d.dishId === 1)!, quantity: 1, takeaway: true, allergies: "alérgico a nueces" },
];

// ═══ VARIANTE A — 'inline' (recomendada): marcar mientras navega ═══

/**
 * A · Flujo completo: buscar/filtrar → "Agregar" (mesa, 1 tap) o 🥡 (para llevar) desde
 * la card → o abrir el plato y usar el switch "Para llevar" junto a la cantidad →
 * revisar el carrito, alternar señales por línea o marcar "¿Todo para llevar?".
 */
export const InlineFlujoCompleto: Story = {
  args: { takeawayUx: "inline" },
};

/**
 * A · Carrito abierto con señales mixtas: cada línea alterna su señal con un clic;
 * el switch de arriba empaca (o des-empaca) todo el pedido de una vez.
 */
export const InlineCarritoMixto: Story = {
  args: { takeawayUx: "inline", initialCartOpen: true, initialCart: MIXED_CART },
};

// ═══ VARIANTE B — 'review': selección al final (botón junto a Confirmar) ═══

/**
 * B · Flujo completo: se arma el pedido normal (card y modal SIN señal de llevar) y en
 * el carrito, junto a "Confirmar Pedido", el botón "🥡 Para llevar" abre la pantalla de
 * selección para marcar cuáles platos van empacados.
 */
export const ReviewFlujoCompleto: Story = {
  args: { takeawayUx: "review" },
};

/** B · El carrito con el botón "🥡 Para llevar" junto a "Confirmar Pedido". */
export const ReviewCarrito: Story = {
  args: { takeawayUx: "review", initialCartOpen: true, initialCart: MIXED_CART },
};

/**
 * B · La pantalla de SELECCIÓN abierta: la lista de platos pedidos con un check por
 * cada uno + "Todos"/"Ninguno". Aquí el cliente decide cuáles llevar y cuáles no.
 */
export const ReviewPantallaSeleccion: Story = {
  args: { takeawayUx: "review", initialSelectOpen: true, initialCart: MIXED_CART },
};
