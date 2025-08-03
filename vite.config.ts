import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0', // Use '0.0.0.0' for Render compatibility
<<<<<<< HEAD
    port: process.env.PORT ? parseInt(process.env.PORT) : 5001, // Respect PORT env variable
=======
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 3000, // Default to 3000 to avoid backend conflict
    proxy: {
      '/api': {
        target: 'http://localhost:5001', // Backend server
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5001', // Backend server
        changeOrigin: true,
        secure: false,
      },
    },
>>>>>>> c3d83d0 (Push full project files)
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
<<<<<<< HEAD
    outDir: './server/dist', // Explicitly specify output directory (already default)
  }
}));
=======
    outDir: './server/dist', // Output to backend's dist folder
  },
}));
>>>>>>> c3d83d0 (Push full project files)
