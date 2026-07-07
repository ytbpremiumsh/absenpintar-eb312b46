import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react-vendor";
          if (id.includes("react-router")) return "router";
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) return "ui-vendor";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("jspdf") || id.includes("pptxgenjs") || id.includes("xlsx") || id.includes("jszip")) return "docs";
          if (id.includes("html5-qrcode") || id.includes("jsqr") || id.includes("qr-code-styling")) return "qr";
          if (id.includes("react-quill") || id.includes("quill")) return "editor";
          if (id.includes("date-fns")) return "date";
          if (id.includes("lucide-react")) return "icons";
        },
      },
    },
  },
}));
