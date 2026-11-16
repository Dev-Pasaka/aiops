# AIOps: Systems That Fix Themselves

A live demo of three AIOps capabilities on one server, built from open-source tools:

1. **Self-healing:** an alert fires, an AI agent investigates, restarts the failing container and escalates after three failed attempts.
2. **Smart alerts:** every alert is enriched with what failed, the impact, evidence, a suspected cause and next steps.
3. **AI-assisted threat detection:** known attacks are blocked deterministically, and a scheduled AI audit writes a security briefing.

The thing being monitored is **Demo Bank**, a small fictional bank you can sign in to, move money in, and break on purpose.

## Status

| Part | State |
| --- | --- |
| Demo Bank app (login, accounts, transfers, chaos panel, metrics, logs) | Done |
| Monitoring stack (Prometheus, Alertmanager, Grafana, Loki, Alloy, cAdvisor, node-exporter) | Done, deployed |
| Alert rules, including 3-sigma anomaly bands | Done |
| Grafana "AIOps Overview" dashboard | Done |
| CI: lint, build, publish image | Done |
| HolmesGPT (the AI investigator, using the Claude API) | Not started |
| Act 1: restart toolset with allowlist and restart limit | Not started |
| Act 2: enriched alerts to Teams and email | Not started |
| Act 3: CrowdSec, fail2ban log shipping, scheduled security audit | Not started |
| Demo scripts (`crash.sh`, `crash-loop.sh`, `latency.sh`, `errors.sh`, `attack.sh`, `reset.sh`) | Not started |
| Deploy workflow (CD) | Not started; deployment is currently by hand |
| `SAFETY.md` | Not started |

Until HolmesGPT is added, alerts fire in Prometheus and Alertmanager but are not sent anywhere, and a crashed Demo Bank stays down until someone starts it.

## How it fits together

```
Browser
   │  HTTPS 443
Cloudflare (proxied)
   │  HTTPS 443, Cloudflare addresses only
Existing Nginx on the host (another project's; owns port 443)
   │  forwards aiops.circaso.com over a shared Docker network
┌──┴──────────────────────── compose project "aiops" ────────────────────────┐
│ nginx ──► demo-app (Demo Bank)            /            ► the bank            │
│   │  └──► grafana                         /grafana/    ► dashboards          │
│   │                                       /api/metrics ► blocked (404)       │
│   │                                                                          │
│ prometheus ◄── demo-app, nginx-exporter, cadvisor, node-exporter             │
│   └──► alertmanager ──► (HolmesGPT, next step)                               │
│ alloy ──► loki        container logs, read through docker-socket-proxy       │
│ loadgen               steady background traffic for a baseline               │
└──────────────────────────────────────────────────────────────────────────────┘
```

The stack publishes **no host ports**. The server is shared with another project whose Nginx already owns port 443, so that Nginx forwards one hostname to this stack. Prometheus, Loki, Alertmanager and the socket proxy are reachable only inside the Docker network.

## Repository layout

| Path | What it is |
| --- | --- |
| `demo-app/` | Demo Bank: one Next.js project with the front end and the API. See [`demo-app/README.md`](demo-app/README.md). |
| `docker-compose.yml` | The whole stack. |
| `.env.example` | The settings the stack needs. Copy to `.env`. |
| `config/nginx/` | The stack's own Nginx config and the "Demo Bank is unavailable" page. |
| `config/prometheus/` | Scrape config and alert rules (`rules/demo-app.yml`). |
| `config/alertmanager/` | Alert routing. |
| `config/grafana/` | Datasources and dashboards, provisioned as code. |
| `config/loki/`, `config/alloy/` | Log storage and the log shipper. |
| `config/loadgen/` | The background traffic script. |
| `server/circaso-nginx-aiops.conf` | The site block installed in the host's existing Nginx. |
| `.github/workflows/demo-app.yml` | CI for Demo Bank. |

## URLs

| URL | What |
| --- | --- |
| `https://aiops.circaso.com` | Demo Bank |
| `https://aiops.circaso.com/chaos` | Chaos control panel (needs `CHAOS_TOKEN`) |
| `https://aiops.circaso.com/grafana/` | Grafana (user and password from `.env`) |

Demo customers: `amina@demobank.test`, `brian@demobank.test`, `chloe@demobank.test`. The password for all is `demo1234`. All data is fake and resets when the app restarts.

## Settings

All secrets come from `.env`, which is git-ignored. Nothing sensitive is committed.

| Variable | Purpose |
| --- | --- |
| `DOMAIN` | Public hostname, used for Grafana's links. |
| `CHAOS_TOKEN` | Required by the chaos endpoints and the chaos panel. |
| `SESSION_SECRET` | Signs Demo Bank's session cookie. |
| `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | Grafana login. |

## Run Demo Bank on its own

```bash
cd demo-app
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

## Deploy the stack

The stack expects a Docker network named `circaso-backend` to exist, because that is how the host's Nginx reaches it. On a server without one, create it first (`docker network create circaso-backend`) or change the `edge` network in `docker-compose.yml`.

```bash
# on the server, in the project folder (currently /opt/aiops)
cp .env.example .env          # then set real values
docker compose build demo-app
docker compose up -d
docker compose ps
```

To route a hostname to it from the host's existing Nginx, install `server/circaso-nginx-aiops.conf` in that Nginx's config folder, test the config and reload:

```bash
docker exec <nginx-container> nginx -t && docker exec <nginx-container> nginx -s reload
```

The DNS record must be **proxied through Cloudflare** (orange cloud): the host's firewall and Nginx accept port 443 from Cloudflare only.

Updating a running deployment is currently manual: copy the changed files to the server and run `docker compose up -d` (add `--build` if `demo-app/` changed).

## Breaking things

Use the chaos panel, or call the API directly:

```bash
curl -X POST https://aiops.circaso.com/api/chaos \
  -H "x-chaos-token: $CHAOS_TOKEN" -H "content-type: application/json" \
  -d '{"action":"crash"}'
```

| Action | Effect | Alert it should raise |
| --- | --- | --- |
| `crash` | The app exits once. | `ServiceDown` |
| `crash-loop` | The app exits and fails on every start until the flag is cleared. | `ServiceDown` |
| `latency` (`ms`) | Adds a delay to every banking request. | `HighLatency`, `LatencyAnomaly` |
| `errors` (`rate`) | A share of banking requests returns HTTP 500. | `HighErrorRate` |
| `transfer-failures` (`rate`) | Transfers fail while the rest of the app works. | `TransfersFailing` |
| `leak` (`mbPerSecond`) | Memory grows until the container is killed at its 512 MB limit. | `MemoryNearLimit`, then `ServiceDown` |
| `reset` | Turns everything off and clears the crash-loop flag. | |

Demo Bank has `restart: "no"` on purpose: in Act 1 the AI agent is what brings it back. For now, start it by hand:

```bash
docker compose start demo-app
```

A crash loop cannot be reset through the API, because the app is not running. Clear the flag first:

```bash
docker run --rm -v aiops_demo-app-data:/data alpine rm -f /data/crash-loop
docker compose start demo-app
```

## Alerts

Defined in `config/prometheus/rules/demo-app.yml`. Every alert carries `service`, `container` and `severity` labels and a short summary.

| Alert | Fires when |
| --- | --- |
| `ServiceDown` | Prometheus cannot reach Demo Bank for 30 seconds. |
| `HighErrorRate` | More than 5% of banking requests fail with a 5xx, for 1 minute. |
| `HighLatency` | 95th-percentile latency is above 1 second, for 1 minute. |
| `TransfersFailing` | More than 10% of transfers fail, for 1 minute. |
| `MemoryNearLimit` | Demo Bank uses more than 85% of its memory limit. |
| `RequestRateAnomaly` | Request rate leaves the last hour's average ± 3 standard deviations, for 2 minutes. |
| `LatencyAnomaly` | Latency rises above the last hour's average + 3 standard deviations, for 2 minutes. |

"Banking requests" excludes the health, metrics and chaos endpoints, which chaos never slows or fails. The anomaly bands are also stored as recording rules (`demo:request_rate:upper`, `:lower`, and the same for latency) so Grafana can draw them. They need about ten minutes of traffic before they can fire.

## Dashboard

Grafana opens on **AIOps Overview**: Demo Bank status, request rate and latency with their normal-range bands, responses by result, transfers, sign-ins, memory against the limit, uptime, firing alerts and live logs. Alerts appear as annotations on the graphs. Datasources (Prometheus, Loki, Alertmanager) and the dashboard are provisioned from `config/grafana/`.

## Logs

Alloy ships the logs of this stack's containers to Loki, labelled `service` and `container`. Containers of other projects on the same host are not read. Demo Bank logs one JSON object per line, for example `login_failed`, `transfer_failed`, `request`. Nginx writes the standard combined access-log format, with the visitor's real IP.

## Safety notes

- `docker-socket-proxy` is the only service that mounts the Docker socket, read-only, with every write refused. Alloy reads container logs through it.
- cAdvisor mounts the containerd socket read-only, because Docker on the host needs it to report container names. It only produces metrics.
- Chaos endpoints are disabled unless `CHAOS_TOKEN` is set, and every call must carry the token.
- `/api/metrics` is blocked at Nginx; only Prometheus, inside the Docker network, can read it.
- The restart path for the AI agent (allowlisted containers, three restarts per 15 minutes, then escalation) is not built yet and will be described in `SAFETY.md`.

## CI

`.github/workflows/demo-app.yml` runs when `demo-app/` changes:

- **Pull requests:** lint, build, and a Docker build.
- **Push to `main`:** the same, then the image is published to `ghcr.io/<owner>/<repo>/demo-app` (`latest` and the short commit SHA).

The server currently builds the image itself from the copied source; it does not pull the published image yet.
