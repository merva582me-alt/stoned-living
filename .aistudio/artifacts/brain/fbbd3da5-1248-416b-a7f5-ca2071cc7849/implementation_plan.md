# Implementation Plan: Lunatic16/streamed-pk-resolver Cloud Container & Buffer-Tuned HLS Player

This plan aligns the frontend sports player with the exact API and streaming specifications of **`Lunatic16/streamed-pk-resolver`**, incorporates the official **`hls.js` buffer tuning** (`maxBufferSize: 0`, `maxBufferLength: 10`, `liveSyncDurationCount: 7`), and provides cloud container deployment instructions with **Cloudflare** for SSL/CDN edge acceleration.

---

## 1. Protocol Alignment with `Lunatic16/streamed-pk-resolver`

### Why the Local/Container Relay is Essential
As detailed in the project README:
1. **Chrome TLS Fingerprinting (`Impit`)**: Upstream CDNs check the browser's TLS signature (`chrome151`). Generic HTTP fetch receives an instant `403`. The resolver runs `Impit` to pass CDN checks.
2. **GOAT Handshake & `lock.wasm`**: The resolver posts a protobuf body to `embed.st/fetch`, reads the `goat` header, and unlocks the stream key using `lock.wasm` in worker threads.
3. **WEBP → MPEG-TS Bitstream Unwrapping**: Upstream CDNs package MPEG-TS video within RIFF/WEBP EXIF wrappers. The resolver's `/api/hls` endpoint unwraps the WEBP container on the fly and streams raw MPEG-TS to `hls.js`.

### Exact API Integration
* **Resolve Request**:
  `POST ${resolverUrl}/api/resolve`
  ```json
  {
    "source": "admin",
    "id": "ppv-monterrey-vs-pachuca",
    "stream": 1,
    "matchId": "monterrey-vs-pachuca-2487559"
  }
  ```
* **Resolve Response**:
  ```json
  {
    "ok": true,
    "m3u8": "https://lb....strmd.st/.../high/mono.m3u8",
    "referer": "https://embed.st/",
    "relay": "https://your-resolver.domain.com/api/hls?url=...&referer=https%3A%2F%2Fembed.st%2F"
  }
  ```
* **Slot Mode Stream**:
  `${resolverUrl}/api/hls?source=${source}&id=${id}&stream=${streamNo}`
  The player can also tune into streams directly via slot mode so that expired stream tokens heal automatically upon re-tuning.

---

## 2. Official `hls.js` Buffer Tuning

To match the official embed player and prevent buffering stalls:
* `maxBufferSize: 0` (prevents buffering whole segments, streams immediately)
* `maxBufferLength: 10` (keeps the buffer lean and synced with live action)
* `liveSyncDurationCount: 7` (maintains optimal 7-segment distance from live edge for zero stutter)
* `lowLatencyMode: true`
* `enableWorker: true`

---

## 3. Cloud Container Deployment with Cloudflare

Deploying `streamed-pk-resolver` as a cloud container with Cloudflare:

### Option A: Railway / Render / Koyeb (Easiest Cloud Container)
1. Fork or point directly to `https://github.com/Lunatic16/streamed-pk-resolver`.
2. Deploy with Dockerfile (auto-detected).
3. Set environment variable: `PORT=3000`.
4. In Cloudflare DNS, add a `CNAME` (e.g., `sports.yourdomain.com`) pointing to the Railway/Render service with Cloudflare Proxy enabled (**Orange Cloud** for free SSL & DDoS protection).

### Option B: Cloudflare Tunnel + Docker (Zero Open Ports)
```bash
# Run the resolver container
docker run -d --name streamed-pk-resolver -p 3000:3000 lunatic16/streamed-pk-resolver

# Connect via free Cloudflare Tunnel
cloudflared tunnel run --url http://localhost:3000
```

---

## 4. Frontend Implementation Steps

1. **Update `src/services/sportsStreamResolver.ts`**:
   * Send the exact `POST /api/resolve` payload (`source`, `id`, `stream`, `matchId`).
   * Support both the `relay` URL returned by `POST /api/resolve` and the slot-based `/api/hls?source=...&id=...&stream=...` fallback.
   * Provide a clean connectivity tester for `GET /api/sports` or `POST /api/resolve`.
2. **Update `src/components/HlsSportsVideoPlayer.tsx`**:
   * Apply official embed buffer tuning (`maxBufferSize: 0`, `maxBufferLength: 10`, `liveSyncDurationCount: 7`).
   * Add retry recovery on segment stall.
3. **Update `src/components/ResolverConfigModal.tsx`**:
   * Add a dedicated **Cloud Container Guide** with Railway, Docker, and Cloudflare setup instructions.
   * Add test connection tool to verify `POST /api/resolve` against the user's host.
4. **Verification**:
   * Run `npm run lint` and `compile_applet`.
