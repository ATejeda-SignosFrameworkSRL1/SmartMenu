import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Input } from "./input";

const meta: Meta<typeof Label> = {
  title: "Primitivos/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "Correo electrónico" },
};
export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const ConInput: Story = {
  render: () => (
    <div className="grid w-72 gap-1.5">
      <Label htmlFor="email">Correo electrónico</Label>
      <Input id="email" type="email" placeholder="tu@email.com" />
    </div>
  ),
};
