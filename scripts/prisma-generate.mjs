import { spawnSync } from "node:child_process";

// The client engine uses the generated WASM query compiler. Point the legacy
// engine variables at a harmless placeholder so `prisma generate` never tries
// to download a native query engine during an offline install.
const placeholder = process.platform === "win32" ? process.execPath : "/bin/true";
const command = process.platform === "win32" ? "prisma.cmd" : "prisma";
const result = spawnSync(command, ["generate"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PRISMA_SCHEMA_ENGINE_BINARY: placeholder,
    PRISMA_QUERY_ENGINE_LIBRARY: placeholder,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1",
  },
});

process.exit(result.status ?? 1);
