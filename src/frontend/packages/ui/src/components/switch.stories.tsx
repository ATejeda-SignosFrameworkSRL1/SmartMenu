import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";
import { Label } from "./label";

const meta: Meta<typeof Switch> = {
  title: "Primitivos/Switch",
  component: Switch,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const ConLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="notif" />
      <Label htmlFor="notif">Notificaciones</Label>
    </div>
  ),
};
