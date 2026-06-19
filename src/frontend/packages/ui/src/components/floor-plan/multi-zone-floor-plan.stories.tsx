import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { MultiZoneFloorPlanViewer } from "./multi-zone-floor-plan-viewer";
import { MultiZoneFloorPlanEditor } from "./multi-zone-floor-plan-editor";
import { MULTI_ZONE_FLOOR_PLAN } from "./multi-zone-mock";
import type { FloorPlanData } from "./types";

const meta: Meta = {
  title: "Floor Plan/Multi-Zona",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

/** Host/Waiter: cambiá de zona con las pestañas; el lienzo muestra solo esa zona (read-only). */
export const Viewer: Story = {
  render: () => (
    <div style={{ padding: 12 }}>
      <MultiZoneFloorPlanViewer data={MULTI_ZONE_FLOOR_PLAN} width={820} height={460} />
    </div>
  ),
};

/** Admin: editá cada zona por separado. Arrastrá una mesa → se actualizan sus coords
 *  en la zona activa (el panel muestra el estado; los cambios persisten al cambiar de zona). */
export const Editor: Story = {
  render: () => {
    const Demo = () => {
      const [data, setData] = useState<FloorPlanData>(MULTI_ZONE_FLOOR_PLAN);
      return (
        <div style={{ padding: 12, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <MultiZoneFloorPlanEditor data={MULTI_ZONE_FLOOR_PLAN} width={640} height={460} onChange={setData} />
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 12,
              borderRadius: 8,
              maxHeight: 460,
              overflow: "auto",
              minWidth: 260,
            }}
          >
            {data.zones.map((z) => (
              <div key={z.zoneId} style={{ marginBottom: 8 }}>
                <strong style={{ color: "#7dd3fc" }}>
                  {z.zoneName} ({z.tables.length})
                </strong>
                {z.tables.map((t) => (
                  <div key={t.id}>
                    {t.id}: ({Math.round(t.x)}, {Math.round(t.y)})
                  </div>
                ))}
                {z.structures?.map((s) => (
                  <div key={s.id} style={{ color: "#fbbf24" }}>
                    ⛬ {s.id} [{s.type}]: ({Math.round(s.x)}, {Math.round(s.y)})
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    };
    return <Demo />;
  },
};
