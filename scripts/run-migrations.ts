import "dotenv/config";
import { execFileSync } from "node:child_process";

function run(command: string, args: string[]) {
  execFileSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "generate"]);
run("npx", ["tsx", "scripts/import-ordering-data.ts"]);
