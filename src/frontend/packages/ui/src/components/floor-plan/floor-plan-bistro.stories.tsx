import type { Meta, StoryObj } from "@storybook/react";

import { FloorPlanViewer } from "./floor-plan-viewer";
import { FloorPlanEditor } from "./floor-plan-editor";
import { BISTRO_TABLES } from "./bistro-tables";
import { SERVER_COLORS, STATUS_COLORS, STATUS_LABELS } from "./status-colors";
import type { TableStatus } from "./types";

const meta: Meta = {
  title: "Floor Plan/Bistro",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

const STATUSES: TableStatus[] = ["empty", "available", "occupied", "reserved", "cleaning", "billing"];

function Legend() {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#475569" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: STATUS_COLORS[s].fill,
                border: `1px ${STATUS_COLORS[s].dash ? "dashed" : "solid"} ${STATUS_COLORS[s].stroke}`,
              }}
            />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {Object.entries(SERVER_COLORS).map(([code, c]) => (
          <span key={code} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: c,
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {code}
            </span>
            mozo / sección
          </span>
        ))}
      </div>
    </div>
  );
}

export const Vista: Story = {
  render: () => (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <Legend />
      </div>
      <FloorPlanViewer tables={BISTRO_TABLES} width={900} height={720} zoneName="Bistro" />
    </div>
  ),
};

export const Editable: Story = {
  render: () => (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <Legend />
      </div>
      <FloorPlanEditor initialTables={BISTRO_TABLES} width={900} height={720} zoneName="Bistro" />
    </div>
  ),
};
