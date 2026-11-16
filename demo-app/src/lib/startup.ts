import { existsSync } from "node:fs";
import { crashLoopFlag } from "./chaos";
import { log } from "./log";

/** Startup check, Node.js runtime only. A present crash-loop flag makes every start fail. */
export function startup() {
  if (existsSync(crashLoopFlag())) {
    log("fatal", "startup_failed", {
      message:
        "Startup aborted: crash-loop flag is present (simulated bad deploy — the app cannot start until the flag is removed).",
      flag: crashLoopFlag(),
      fix: "Delete the flag file or run demo/reset.sh, then start the container.",
    });
    process.exit(1);
  }
  log("info", "startup", { message: "demo-app started", pid: process.pid });
}
