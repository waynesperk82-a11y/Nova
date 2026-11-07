import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "EXPO_PUBLIC_");
  return {
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^react-native$/, replacement: "react-native-web" }
      ]
    },
    define: {
      "process.env.EXPO_PUBLIC_NOVA_API_URL": JSON.stringify(
        env.EXPO_PUBLIC_NOVA_API_URL || "https://nova-api-azure.vercel.app"
      )
    },
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});