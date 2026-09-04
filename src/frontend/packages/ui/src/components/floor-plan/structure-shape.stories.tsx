import type { Meta, StoryObj } from "@storybook/react";
import { Stage, Layer, Text } from "react-konva";

import { StructureShape } from "./structure-shape";

const meta: Meta = {
  title: "Floor Plan/StructureShape",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

export const Tipos: Story = {
  render: () => (
    <div style={{ padding: 12 }}>
      <Stage width={620} height={300}>
        <Layer>
          <Text text="wall (pared / divisoria)" x={30} y={24} fill="#64748b" fontSize={12} />
          <StructureShape id="w" type="wall" x={30} y={48} width={240} height={8} />

          <Text text="bar" x={30} y={96} fill="#64748b" fontSize={12} />
          <StructureShape id="b" type="bar" x={30} y={120} width={240} height={56} label="BISTRO BAR" />

          <Text text="column (columna)" x={360} y={24} fill="#64748b" fontSize={12} />
          <StructureShape id="c" type="column" x={360} y={48} width={22} height={22} />

          <Text text="entrance (entrada)" x={360} y={120} fill="#64748b" fontSize={12} />
          <StructureShape id="e" type="entrance" x={360} y={146} width={150} height={6} label="ENTRADA" />
        </Layer>
      </Stage>
    </div>
  ),
};
