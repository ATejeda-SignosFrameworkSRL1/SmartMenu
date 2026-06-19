import type { Meta, StoryObj } from "@storybook/react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./sheet";
import { Button } from "./button";

const meta: Meta<typeof Sheet> = {
  title: "Primitivos/Sheet",
  component: Sheet,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Sheet>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Abrir panel</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Panel lateral</SheetTitle>
          <SheetDescription>Contenido deslizable desde el borde.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
