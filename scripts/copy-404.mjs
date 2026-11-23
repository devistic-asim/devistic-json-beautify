import { copyFileSync, existsSync } from "node:fs";

if (!existsSync("dist/index.html")) {
  console.error("dist/index.html is missing. Run vite build first.");
  process.exit(1);
}

copyFileSync("dist/index.html", "dist/404.html");
