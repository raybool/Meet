import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        call: "0 24px 80px rgba(9, 18, 30, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
