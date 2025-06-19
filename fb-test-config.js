import { defineConfig } from "@playwright/test"; export default defineConfig({ projects: [{ name: "chromium", use: { channel: "chrome" } }], testDir: "./tests", use: { headless: false } });
