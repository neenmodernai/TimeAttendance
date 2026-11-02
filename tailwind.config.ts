// tailwind.config.ts
import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { fontFamily: { sans: ["'Noto Sans Thai'", "system-ui", "sans-serif"] } } },
  plugins: [],
} satisfies Config;
