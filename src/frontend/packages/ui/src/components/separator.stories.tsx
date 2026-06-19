import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "Primitivos/Separator",
  component: Separator,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-72 text-sm">
      <p>Sección A</p>
      <Separator className="my-3" />
      <p>Sección B</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-3 text-sm">
      <span>Inicio</span>
      <Separator orientation="vertical" />
      <span>Menú</span>
      <Separator orientation="vertical" />
      <span>Cuenta</span>
    </div>
  ),
};
