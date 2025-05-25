import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0', // Use '0.0.0.0' for Render compatibility
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080, // Respect PORT env variable
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000, // Size in kB
    outDir: 'dist', // Explicitly specify output directory (already default)
  }
}));
