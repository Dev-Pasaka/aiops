# Demo Bank (demo-app)

A small fictional bank: the app the AIOps stack monitors, breaks and heals. One Next.js project holds the
front end and the API, and it ships as one container. All data is fake, lives in memory and resets on restart.

## Run it

```bash
cp .env.example .env.local   # set CHAOS_TOKEN and SESSION_SECRET
npm install
npm run dev                  # http://localhost:3000
```

Or as a container:

```bash
docker build -t demo-bank .
docker run -p 3000:3000 -e CHAOS_TOKEN=... -e SESSION_SECRET=... -v demo-bank-data:/data demo-bank
```

Sign in with `amina@demobank.test`, `brian@demobank.test` or `chloe@demobank.test`; the password for all is `demo1234`.

## Pages

| Path | What it is |
| --- | --- |
| `/login` | Sign-in page. Wrong passwords return 401 and are logged, which feeds threat detection. |
| `/dashboard` | Balances and recent activity. Refreshes every 5 seconds, so an outage shows up live. |
| `/transfer` | Send money to another customer or a biller. |
| `/chaos` | Control panel for breaking the app. Needs the chaos token. |

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness check. Never affected by chaos. |
| `GET /api/metrics` | Prometheus metrics. Keep this off the public internet (block it in Nginx). |
| `POST /api/login`, `POST /api/logout`, `GET /api/me` | Session (signed cookie, survives restarts). |
| `GET /api/accounts` | Accounts, recent transactions and payees for the signed-in customer. |
| `POST /api/transfer` | `{ fromAccountId, payeeId, amount, note }` |
| `GET /api/chaos`, `POST /api/chaos` | Chaos status and actions. Header `x-chaos-token` required. |

## Chaos actions

```bash
curl -X POST http://localhost:3000/api/chaos \
  -H "x-chaos-token: $CHAOS_TOKEN" -H "content-type: application/json" \
  -d '{"action":"latency","ms":2000}'
```

| Body | Effect |
| --- | --- |
| `{"action":"crash"}` | Process exits once with code 1. |
| `{"action":"crash-loop"}` | Writes `$DATA_DIR/crash-loop` and exits; every later start fails until the file is removed. |
| `{"action":"latency","ms":500}` | Adds a delay to every banking request. `0` turns it off. |
| `{"action":"errors","rate":0.2}` | That share of banking requests returns HTTP 500. `0` turns it off. |
| `{"action":"transfer-failures","rate":0.5}` | That share of transfers fails with HTTP 502 (payment gateway timeout). |
| `{"action":"leak","mbPerSecond":20}` | Memory grows until the container is killed. `0` stops and frees it. |
| `{"action":"reset"}` | Turns everything off and removes the crash-loop flag. |

Chaos is disabled unless `CHAOS_TOKEN` is set. Health, metrics and chaos endpoints are never slowed or failed by chaos.

## Metrics

- `http_requests_total{method,route,status}` and `http_request_duration_seconds{method,route}` for the API routes.
- `bank_logins_total{result}`: `success` or `failed`.
- `bank_transfers_total{result}`: `success`, `rejected` (customer error) or `failed` (gateway failure).
- `bank_transfer_amount_cents_total`
- `bank_chaos_setting{mode}`: the current chaos settings, useful for Grafana annotations.
- Default Node.js process metrics (`process_*`, `nodejs_*`).

Logs are one JSON object per line on stdout (`event`, `level`, `route`, `status`, `ip`, …).

## Environment

| Variable | Purpose |
| --- | --- |
| `CHAOS_TOKEN` | Token for the chaos endpoints. |
| `SESSION_SECRET` | Signs the session cookie. |
| `DATA_DIR` | Folder for the crash-loop flag. `/data` in the container; mount a volume there. |
