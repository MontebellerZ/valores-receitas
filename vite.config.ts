import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: {
    port: 5174,
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
