import { fileURLToPath } from "node:url";
import { checkArchitecture } from "./architecture.js";

const violations = checkArchitecture(fileURLToPath(new URL("../", import.meta.url)));
for (const violation of violations)
  console.error(`${violation.file}:${String(violation.line)} ${violation.message}`);
if (violations.length) process.exitCode = 1;
else console.log("Architecture boundaries passed");
