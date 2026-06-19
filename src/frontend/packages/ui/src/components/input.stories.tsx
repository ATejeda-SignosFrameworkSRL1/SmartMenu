import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "Primitivos/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Tu nombre" },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const ConLabel: Story = {
  render: () => (
    <div className="grid w-72 gap-1.5">
      <Label htmlFor="nombre">Nombre completo</Label>
      <Input id="nombre" placeholder="Tu nombre" />
    </div>
  ),
};

export const Deshabilitado: Story = {
  args: { disabled: true, value: "No editable" },
};
