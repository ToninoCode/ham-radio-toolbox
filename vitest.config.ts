import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.spec.ts", "tests/integration/**/*.spec.ts"],
      exclude: [...configDefaults.exclude, "tests/e2e/**"],
      restoreMocks: true,
    },
  }),
);
