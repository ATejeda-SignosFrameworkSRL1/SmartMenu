import type { Meta, StoryObj } from "@storybook/react";
import { Stage, Layer, Text } from "react-konva";

import { TableShape } from "./table-shape";
import type { TableShapeKind } from "./types";

const meta: Meta = {
  title: "Floor Plan/Capacidades",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

const CAPS = [2, 4, 6, 8];
const COLS = [210, 380, 550, 720];
const ROWS: { shape: TableShapeKind; y: number; w?: number; h?: number }[] = [
  { shape: "circle", y: 95 },
  { shape: "square", y: 215, w: 54, h: 54 },
  { shape: "rect", y: 335, w: 78, h: 48 },
  { shape: "diamond", y: 455, w: 56, h: 56 },
];

export const PorForma: Story = {
  render: () => (
    <div style={{ padding: 12 }}>
      <Stage width={840} height={540}>
        <Layer>
          {CAPS.map((cap, ci) => (
            <Text
              key={`h-${cap}`}
              text={`Capacidad ${cap}`}
              x={COLS[ci] - 60}
              y={26}
              width={120}
              align="center"
              fontStyle="bold"
              fontSize={13}
              fill="#475569"
            />
          ))}
          {ROWS.map((r) =>
            CAPS.map((cap, ci) => (
              <TableShape
                key={`${r.shape}-${cap}`}
                id={`${r.shape}-${cap}`}
                number={cap}
                x={COLS[ci]}
                y={r.y}
                shape={r.shape}
                status="available"
                capacity={cap}
                width={r.w}
                height={r.h}
                server={ci === 0 ? "FR" : undefined}
              />
            )),
          )}
        </Layer>
      </Stage>
    </div>
  ),
};
