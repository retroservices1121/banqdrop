import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d0f1a",
        paper: "#f7f7fb",
      },
    },
  },
  plugins: [],
} satisfies Config;
