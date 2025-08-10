import { nextJsConfig } from "@repo/eslint-config/next-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("eslint").Linter.Config[]} */
export default [
    ...nextJsConfig,
    {
        settings: {
            turbo: {
                // Ensure eslint-plugin-turbo resolves monorepo root correctly
                rootDir: path.resolve(__dirname, "../.."),
            },
        },
    },
    {
        rules: {
            // Explicitly allow this env var to avoid false positives
            "turbo/no-undeclared-env-vars": [
                "warn",
                {
                    allowList: ["BACKEND_INTERNAL_URL"],
                },
            ],
        },
    },
];
