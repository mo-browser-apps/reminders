import fs from "fs"
import path from "path"
import { mobrowserReactAnnotation } from "@mobrowser/api/internal/vite/react"
import react from "@vitejs/plugin-react"
import { defineConfig, type UserConfig } from "vite"

export default defineConfig(({ command, mode }) => {
  if (mode === "main") {
    return defineMainConfig()
  }
  if (mode === "renderer") {
    return defineRendererConfig(command)
  }
  throw new Error(`Unsupported Vite config mode: ${mode}`)
})

function defineMainConfig(): UserConfig {
  return {
    root: path.resolve(import.meta.dirname, "./src/main"),
    define: {
      // The update server isn't exposed by the runtime API; bake it in from mobrowser.conf.json so
      // the main process knows whether updates are configured (src/main/updates.ts).
      __UPDATE_SERVER_URL__: JSON.stringify(readUpdateServerUrl()),
    },
    build: {
      target: "esnext",
      outDir: path.resolve(import.meta.dirname, "./out/main"),
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: path.resolve(import.meta.dirname, "./src/main/index.ts"),
        formats: ["es"],
        fileName: () => "index.js",
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src/main"),
      },
    },
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error'],
      },
    },
  }
}


function readUpdateServerUrl(): string {
  const conf = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "mobrowser.conf.json"), "utf8"))
  return typeof conf.app?.updateServerUrl === "string" ? conf.app.updateServerUrl : ""
}

function defineRendererConfig(command: "build" | "serve"): UserConfig {
  return {
    root: path.resolve(import.meta.dirname, "./src/renderer"),
    plugins: [react(mobrowserReactAnnotation(command))],
    build: {
      outDir: path.resolve(import.meta.dirname, "./out/renderer"),
      emptyOutDir: true,
      sourcemap: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src/renderer"),
      },
    },
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error'],
      },
    },
  }
}
