import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "./select";

const meta: Meta<typeof Select> = {
  title: "Primitivos/Select",
  component: Select,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Elegí una zona" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Zonas</SelectLabel>
          <SelectItem value="terraza">Terraza</SelectItem>
          <SelectItem value="salon">Salón Principal</SelectItem>
          <SelectItem value="vip">VIP</SelectItem>
          <SelectItem value="terraza-norte">Terraza Norte</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
