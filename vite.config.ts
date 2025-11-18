import { defineConfig, mergeConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  defaultExclude,
  defineConfig as defineVitestConfig,
} from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

const baseConfig = defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    //nitro()
  ],
});

const baseTestConfig = mergeConfig(
  baseConfig,
  defineVitestConfig({
    test: {
      silent: "passed-only",
      execArgv: ["--expose-gc"],
      isolate: false,
      maxWorkers: 1,
      retry: process.env["CI"] ? 2 : 0,
    },
  }),
);

const browserConfig = defineVitestConfig({
  test: {
    css: true,
    includeTaskLocation: true,
    include: ["**/*.browser.test.tsx"],
    name: "browser",
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    globalSetup: "./test/_setup-browser.ts",
  },
});

const nodeConfig = defineVitestConfig({
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [...defaultExclude, "convex/**/*", "**/*.browser.test.tsx"],
    name: "node",
    environment: "node",
    env: {},
    setupFiles: ["./test/_setup-node.ts"],
  },
});

export default mergeConfig(
  baseConfig,
  defineVitestConfig({
    test: {
      projects: [
        mergeConfig(baseTestConfig, browserConfig),
        mergeConfig(baseTestConfig, nodeConfig),
      ],
    },
  }) as any,
);
