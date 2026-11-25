import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: process.env.BUDDY_BASE_PATH || "/",
  envDir: mode === "pages-demo" ? false : undefined,
  define:
    mode === "pages-demo"
      ? {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
          "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
          "import.meta.env.VITE_API_URL": JSON.stringify(""),
          "import.meta.env.VITE_DEMO_ONLY": "true",
        }
      : { "import.meta.env.VITE_DEMO_ONLY": "false" },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          ...(mode === "pages-demo" ? {} : { supabase: ["@supabase/supabase-js"] }),
        },
      },
    },
  },
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
}));
