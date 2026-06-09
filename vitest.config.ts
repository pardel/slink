import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        singleWorker: true,
        miniflare: {
          compatibilityDate: "2025-09-23",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "slink-test" },
          // Mirror the production assets config (run_worker_first → the Worker
          // handles every request and calls env.ASSETS.fetch itself). Served from a
          // committed fixture dir so the suite doesn't depend on a built dashboard.
          assets: {
            directory: path.join(__dirname, "test/fixtures/assets"),
            binding: "ASSETS",
            routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
            assetConfig: { not_found_handling: "single-page-application" },
          },
          bindings: {
            TEST_MIGRATIONS: migrations,
            HASH_SALT: "test-salt",
            ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com",
            ACCESS_AUD: "test-aud",
            // In tests, the public redirect host is example.test; any other host
            // (slink.test) is treated as the admin host (dashboard + API).
            PUBLIC_HOST: "example.test",
            SHORT_BASE_URL: "https://example.test",
            TEST_AUTH_KEY: "ok",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
    },
  };
});
