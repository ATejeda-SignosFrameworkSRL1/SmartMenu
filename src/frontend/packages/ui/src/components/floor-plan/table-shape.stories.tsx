import type { Meta, StoryObj } from "@storybook/react";
import { Stage, Layer } from "react-konva";

import { TableShape } from "./table-shape";

const meta: Meta<typeof TableShape> = {
  title: "Floor Plan/TableShape",
  component: TableShape,
  tags: ["autodocs"],
  // Los componentes Konva deben vivir dentro de un Stage>Layer.
  decorators: [
    (Story) => (
      <Stage width={540} height={180}>
        <Layer>
          <Story />
        </Layer>
      </Stage>
    ),
  ],
  args: { id: 1, number: 1, x: 100, y: 90, radius: 30, status: "available", shape: "circle", capacity: 4 },
  argTypes: {
    status: {
      control: "select",
      options: ["empty", "available", "occupied", "reserved", "cleaning", "billing"],
    },
    shape: { control: "select", options: ["circle", "square", "rect", "diamond", "banquette"] },
    capacity: { control: { type: "number", min: 0, max: 12 } },
    isDraggable: { control: "boolean" },
    waiter: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof TableShape>;

export const Available: Story = { args: { status: "available", number: 1, capacity: 4 } };
export const Occupied: Story = { args: { status: "occupied", number: 2, capacity: 2 } };
export const Reserved: Story = { args: { status: "reserved", number: 3, capacity: 6 } };
export const Libre: Story = { args: { status: "empty", number: "D-9", shape: "square", width: 54, height: 54, capacity: 4 } };
export const ConMozo: Story = { args: { status: "occupied", number: "D-3", waiter: "RO", capacity: 4 } };
export const Arrastrable: Story = { args: { status: "available", number: 4, isDraggable: true, capacity: 4 } };

/** Todas las formas con sus sillas (capacity) y un badge de mozo. */
export const Formas: Story = {
  render: () => (
    <>
      <TableShape id="c" number="C" x={70} y={90} status="available" shape="circle" capacity={4} waiter="FR" />
      <TableShape id="s" number="S" x={175} y={90} status="occupied" shape="square" width={54} height={54} capacity={4} />
      <TableShape id="r" number="R" x={300} y={90} status="reserved" shape="rect" width={76} height={48} capacity={6} />
      <TableShape id="d" number="D" x={420} y={90} status="cleaning" shape="diamond" width={56} height={56} capacity={4} />
    </>
  ),
};
