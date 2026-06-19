import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "Primitivos/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="cocina" className="w-80">
      <TabsList>
        <TabsTrigger value="cocina">Cocina</TabsTrigger>
        <TabsTrigger value="bar">Bar</TabsTrigger>
      </TabsList>
      <TabsContent value="cocina" className="text-sm">
        Comandas de cocina…
      </TabsContent>
      <TabsContent value="bar" className="text-sm">
        Comandas de bar…
      </TabsContent>
    </Tabs>
  ),
};
