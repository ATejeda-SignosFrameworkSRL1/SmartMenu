import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import "./tailwind.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    layout: "padded",
  },
  decorators: [
    // Selector de "skin" en la toolbar: mismas variables, distintos valores por app.
    withThemeByClassName({
      themes: {
        "Base (Smart Menu)": "",
        "Dorado (reservation)": "skin-gold",
        "Oscuro": "dark",
      },
      defaultTheme: "Base (Smart Menu)",
    }),
  ],
};

export default preview;
