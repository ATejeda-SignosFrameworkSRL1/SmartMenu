import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { DeliveryTrackingPanel } from "./delivery-tracking-panel";
import { MOCK_DELIVERY_INVOICES } from "./mock-invoices";
import type { DeliveryInvoice, DeliveryStatusKey } from "./types";

const meta: Meta<typeof DeliveryTrackingPanel> = {
  title: "Delivery Tracking/Panel",
  component: DeliveryTrackingPanel,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "PROTOTIPO multi-franquicia: el cliente arma un carrito mixto, paga UNA factura " +
          "global y el sistema la parte en una orden por franquicia (cada KDS ve solo lo suyo). " +
          "La verdad fiscal (ITBIS 18% + propina 10%) vive POR ORDEN (RNC propio por franquicia); " +
          "la factura solo suma. Incluye el switch de permiso del admin (como el del plano). " +
          "Implementación de referencia: rama feature/invoice-delivery-tracking.",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof DeliveryTrackingPanel>;

/**
 * Flujo completo interactivo: togglear el switch, filtrar por estado, expandir las
 * órdenes por franquicia y AVANZAR el estado de entrega (muta el mock localmente,
 * simulando el PUT /api/invoices/{id}/delivery-status con ~600ms de red).
 */
export const FlujoCompleto: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(true);
    const [invoices, setInvoices] = useState<DeliveryInvoice[]>(MOCK_DELIVERY_INVOICES);
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const advance = (id: number, next: DeliveryStatusKey) => {
      setUpdatingId(id);
      setTimeout(() => {
        setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, deliveryStatus: next } : i)));
        setUpdatingId(null);
      }, 600);
    };

    return (
      <DeliveryTrackingPanel
        enabled={enabled}
        onToggleEnabled={setEnabled}
        invoices={invoices}
        onAdvanceStatus={advance}
        updatingId={updatingId}
      />
    );
  },
};

/** El admin apagó el switch: la lista se oculta y queda el estado deshabilitado. */
export const Deshabilitado: Story = {
  args: {
    enabled: false,
    invoices: MOCK_DELIVERY_INVOICES,
  },
};

/** Habilitado pero sin entregas en curso (estado vacío). */
export const SinEntregas: Story = {
  args: {
    enabled: true,
    invoices: [],
  },
};

/** Factura de 3 franquicias en camino — el caso estrella del carrito mixto. */
export const CarritoMixtoTresFranquicias: Story = {
  args: {
    enabled: true,
    invoices: MOCK_DELIVERY_INVOICES.filter((i) => i.id === 103),
  },
};
