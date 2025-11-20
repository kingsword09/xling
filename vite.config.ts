import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const cdn = "https://esm.sh";
const externalAliases: Record<string, string> = {
  mermaid: `${cdn}/mermaid@10.9.1?bundle&target=es2022`,
  katex: `${cdn}/katex@0.16.11?target=es2022`,
  "katex/dist/katex.min.css": `${cdn}/katex@0.16.11/dist/katex.min.css`,
  shiki: `${cdn}/shiki@1.22.0?bundle&target=es2022`,
  "@shikijs/core": `${cdn}/@shikijs/core@1.22.0?bundle&target=es2022`,
  "@shikijs/engine-javascript": `${cdn}/@shikijs/engine-javascript@1.22.0?bundle&target=es2022`,
};

export default defineConfig({
  plugins: [react()],
  root: "src/ui",
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-ui": [
            "@radix-ui/react-avatar",
            "@radix-ui/react-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-tooltip",
            "lucide-react",
            "clsx",
            "tailwind-merge",
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...externalAliases,
    },
  },
  optimizeDeps: {
    exclude: ["streamdown", ...Object.keys(externalAliases)],
  },
});
