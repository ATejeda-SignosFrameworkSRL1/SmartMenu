import type { Meta, StoryObj } from "@storybook/react";
import { ScrollArea } from "./scroll-area";

const meta: Meta<typeof ScrollArea> = {
  title: "Primitivos/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-48 w-64 rounded-md border p-4 text-sm">
      {Array.from({ length: 30 }, (_, i) => (
        <p key={i} className="py-1">
          Ítem {i + 1}
        </p>
      ))}
    </ScrollArea>
  ),
};
