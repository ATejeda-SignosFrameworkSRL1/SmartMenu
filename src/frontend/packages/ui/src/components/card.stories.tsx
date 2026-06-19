import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";

const meta: Meta<typeof Card> = {
  title: "Primitivos/Card",
  component: Card,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Mesa 12</CardTitle>
        <CardDescription>Salón Principal · 4 personas</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-sm">
        <Badge>Ocupada</Badge>
        <span className="text-muted-foreground">Orden #7CFDFA</span>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Ver orden</Button>
        <Button size="sm" variant="outline">Cobrar</Button>
      </CardFooter>
    </Card>
  ),
};
