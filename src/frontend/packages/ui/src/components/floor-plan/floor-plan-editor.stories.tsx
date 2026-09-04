import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { FloorPlanEditor } from "./floor-plan-editor";
import { MOCK_TABLES } from "./mock-tables";
import type { TableData } from "./types";

const meta: Meta<typeof FloorPlanEditor> = {
  title: "Floor Plan/FloorPlanEditor",
  component: FloorPlanEditor,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof FloorPlanEditor>;

export const Default: Story = {
  render: () => {
    const Demo = () => {
      const [coords, setCoords] = useState<TableData[]>(MOCK_TABLES);
      return (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: 12, flexWrap: "wrap" }}>
          <FloorPlanEditor initialTables={MOCK_TABLES} width={560} height={400} onChange={setCoords} />
          <pre
            style={{
              fontSize: 12,
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 12,
              borderRadius: 8,
              maxHeight: 400,
              overflow: "auto",
              margin: 0,
            }}
          >
            {JSON.stringify(
              coords.map(({ id, x, y }) => ({ id, x: Math.round(x), y: Math.round(y) })),
              null,
              2,
            )}
          </pre>
        </div>
      );
    };
    return <Demo />;
  },
};
