// One JSON object per line on stdout, so Promtail/Loki can parse fields.
type Level = "info" | "warn" | "error" | "fatal";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "demo-app",
    event,
    ...fields,
  });
  if (level === "error" || level === "fatal") console.error(line);
  else console.log(line);
}
