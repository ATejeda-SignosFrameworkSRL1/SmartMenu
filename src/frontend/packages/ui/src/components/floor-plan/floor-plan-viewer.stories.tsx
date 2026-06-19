import type { Meta, StoryObj } from "@storybook/react";

import { FloorPlanViewer } from "./floor-plan-viewer";
import { MOCK_TABLES } from "./mock-tables";

const meta: Meta<typeof FloorPlanViewer> = {
  title: "Floor Plan/FloorPlanViewer",
  component: FloorPlanViewer,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof FloorPlanViewer>;

/** Solo lectura: mesas coloreadas por estado, NO arrastrables. */
export const Default: Story = {
  args: { tables: MOCK_TABLES, width: 640, height: 420 },
};
