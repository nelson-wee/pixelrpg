// Copies the pixelfx source (and its licence) into docs/pixelfx so the web viewer can play live gear effects.
// Run before serving docs/ locally; the Pages workflow runs it before upload. docs/pixelfx is git-ignored.
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), SRC = `${ROOT}/vendor/pixelfx`, DST = `${ROOT}/docs/pixelfx`;
if (!existsSync(`${SRC}/src/core/index.js`)) { console.error("vendor/pixelfx is empty: run git submodule update --init"); process.exit(1); }
rmSync(DST, { recursive: true, force: true });
cpSync(`${SRC}/src`, DST, { recursive: true });
for (const f of ["LICENSE", "NOTICE.md"]) cpSync(`${SRC}/${f}`, `${DST}/${f}`);
console.log("copied pixelfx into docs/pixelfx");
