# wristworks Roadmap

> NTP-calibrated multi-timezone clock fetcher — Rust + TypeScript hybrid

## v0.2.0 — WebSocket Real-Time Push

Push clock updates to connected clients over WebSocket.

**Goal:** A `wristworks serve` command that starts a WS server, syncs on the configured interval, and broadcasts `WristworksOutput` JSON to all connected clients.

- `src/ws.ts` — `WristworksServer` class wrapping a `Wristworks` instance
- Accepts connections, sends current output on connect
- Broadcasts on each sync tick
- Config via YAML (`server.ws.port`, `server.ws.host`)
- Graceful shutdown on SIGTERM/SIGINT
- Optional: `--no-sync` flag for clients that only want on-demand updates

**Dependencies:** `ws` (lightweight, no native deps)

---

## v0.3.0 — Daemon Mode (wristworksd)

Background daemon that runs the WS server and optionally writes to a shared file / socket.

**Goal:** A `wristworksd` binary (same package, different entry) for long-running deployments.

- `src/daemon.ts` — Daemon class with:
  - WS server (from v0.2.0)
  - Optional file output (`--output /tmp/wristworks.json`) — writes latest output on each tick
  - UNIX socket output (`--socket /tmp/wristworks.sock`)
  - PID file (`/var/run/wristworksd.pid`)
  - Logging to stdout + optional file
  - Signal handling: SIGHUP re-reads config, SIGTERM/SIGINT graceful shutdown
- CLI: `wristworks daemon [--output ...] [--socket ...] [--pidfile ...]`
- Config section `daemon:` in `wristworks.yaml`

---

## v0.4.0 — Docker + systemd

Containerized and service-managed deployment.

**Goal:** One command to production.

- `Dockerfile` — multi-stage: Rust build stage + distroless runtime
- `docker-compose.yml` — port mapping, volumes for config, restart policy
- `deploy/wristworks.service` — systemd unit file
- `deploy/install.sh` — install script that:
  - Copies binary to `/usr/local/bin/wristworksd`
  - Installs systemd service
  - Creates `/etc/wristworks/` config directory
  - Enables + starts service
- Health check endpoint on WS server (HTTP GET `/health` → `200 OK`)

---

## v0.5.0 — TUI Dashboard

Terminal user interface showing all timezones in a live-updating grid.

**Goal:** `wristworks tui` opens a full-screen terminal dashboard.

- Framework: `blessed` or `ink` (React for terminal)
- Layout:
  - Header: current calibration status, drift, stratum
  - Grid: one row per timezone, columns for name, local time, offset, DST
  - Footer: legend, connection status, quit key
- Color-coded: DST-active zones in yellow, night time (20:00-06:00) in blue
- Connects to WS server (local or remote)
- `--connect ws://host:port` flag for remote dashboards
- Mouse support for sorting/filtering

---

## Future / Stretch

- **v0.6.0** — Historical drift graph (sparkline per timezone over N hours)
- **v0.7.0** — Alarm / notification on configurable events (e.g. DST change detected)
- **v0.8.0** — Plugin system: webhook on sync, custom formatters
- **v1.0.0** — Stable API, full test suite, published to npm
