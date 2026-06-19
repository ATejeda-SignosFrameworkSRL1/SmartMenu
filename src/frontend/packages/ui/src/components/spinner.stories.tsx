import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "./spinner";

const meta: Meta<typeof Spinner> = {
  title: "Primitivos/Spinner",
  component: Spinner,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};

export const Tamaños: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-primary">
      <Spinner className="h-4 w-4" />
      <Spinner className="h-6 w-6" />
      <Spinner className="h-10 w-10" />
    </div>
  ),
};
