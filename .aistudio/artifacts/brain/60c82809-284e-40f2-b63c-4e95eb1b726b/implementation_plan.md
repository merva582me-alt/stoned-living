# Zero-Cost Stream Resolver: Oracle Cloud Always Free VPS + Cloudflare

Host the unmodified `Lunatic16/streamed-pk-resolver` container 24/7/365 with **$0.00/month hosting fees** using **Oracle Cloud Always Free VPS** paired with **Cloudflare**, providing 10 TB/month of free outbound streaming bandwidth, dedicated cloud uptime, and free global SSL.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Why Oracle Cloud Always Free is the Best Solution for the Resolver:**
> 1. **100% Free Forever ($0.00/month)**: Oracle's Always Free tier does not expire after 30 days and has no credit consumption limits like Railway.
> 2. **Massive Free Bandwidth (10 TB/month)**: Relaying live sports HLS video streams requires significant egress bandwidth. Oracle provides 10 Terabytes of free outbound data transfer every month (enough for over 5,000+ hours of continuous 1080p live sports).
> 3. **True 24/7 Cloud Uptime**: Unlike a home PC, the cloud VPS never sleeps, reboots for updates, or goes offline when your computer turns off.
> 4. **Runs Unmodified Docker Container**: Standard Ubuntu Linux VM running the exact `lunatic16/streamed-pk-resolver` image with native Chrome TLS fingerprinting (`Impit`) and `lock.wasm`.
> 5. **Cloudflare Zero Trust / Free Tunnel**: Secures the VM with free HTTPS, DDoS protection, and hides the VPS IP address without needing open ingress firewall ports.

---

## 1. Architecture Overview

```
                        [ STONED.LIVING STREAM CLIENT ]
                                       │
                                       ▼ (HTTPS / WSS)
                        ┌──────────────────────────────┐
                        │    Cloudflare Edge / DNS     │
                        │ (https://resolver.domain.com)│
                        └──────────────┬───────────────┘
                                       │ Encrypted Tunnel
                                       ▼
                        ┌──────────────────────────────┐
                        │   Oracle Cloud Always Free   │
                        │   Ubuntu 24.04 LTS (A1 / AMD)│
                        ├──────────────────────────────┤
                        │ • cloudflared daemon         │
                        │ • Docker Container:          │
                        │   lunatic16/streamed-pk-     │
                        │   resolver (:3000)           │
                        │ • 10 TB / mo Free Egress     │
                        │ • 24/7 Continuous Uptime     │
                        └──────────────────────────────┘
```

---

## 2. Step-by-Step Oracle Cloud Always Free Deployment

### Step 1: Provision the Free Instance in Oracle Cloud
1. Sign up or log into [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).
2. Navigate to **Compute** ➔ **Instances** ➔ **Create Instance**.
3. Choose the **Always Free-eligible** configuration:
   - **Image**: Ubuntu 22.04 or 24.04 Minimal
   - **Shape**:
     - *Option A (Recommended)*: **Ampere ARM (VM.Standard.A1.Flex)** with 2–4 OCPUs and 12–24 GB RAM (Always Free).
     - *Option B*: **AMD (VM.Standard.E2.1.Micro)** with 1 OCPU and 1 GB RAM (Always Free).
4. Save the private SSH key (`ssh-key.key`) and click **Create**.

---

### Step 2: Connect & Install Docker (One-Liner)
Connect to your instance via SSH:
```bash
ssh -i /path/to/ssh-key.key ubuntu@<YOUR_ORACLE_PUBLIC_IP>
```

Install Docker and start the container:
```bash
# Update and install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# Launch the resolver container with auto-restart
sudo docker run -d \
  --name streamed-pk-resolver \
  --restart unless-stopped \
  -p 3000:3000 \
  lunatic16/streamed-pk-resolver
```

Verify it is running:
```bash
curl http://localhost:3000/api/sports
```

---

### Step 3: Connect via Free Cloudflare Tunnel (Zero Open Ports)
Cloudflare Tunnel exposes your Oracle resolver securely over HTTPS without configuring firewall rules or open ports in Oracle Cloud Security Lists.

On the Oracle VPS:
```bash
# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Option A: Quick Instant Tunnel (Free, no domain needed)
cloudflared tunnel --url http://localhost:3000
```
This gives you a free HTTPS URL like: `https://xxxx-xxxx-xxxx.trycloudflare.com`.

**Option B: Permanent Named Tunnel (With your own free Cloudflare domain)**:
```bash
# 1. Login to Cloudflare
cloudflared tunnel login

# 2. Create the tunnel
cloudflared tunnel create sports-resolver

# 3. Route to your subdomain
cloudflared tunnel route dns sports-resolver resolver.yourdomain.com

# 4. Run as a permanent system service (runs 24/7 on boot)
sudo cloudflared service install <TUNNEL_TOKEN>
```

---

## 3. Application Integration in Stoned.living

1. **Configurable Resolver Endpoint**:
   - Allow entering the Oracle/Cloudflare URL in `SettingsView.tsx` under a dedicated **"Live Sports Resolver"** section.
   - Support `VITE_STREAMED_RESOLVER_URL` in `.env.example`.
2. **Built-in Connectivity Diagnostic**:
   - Provide a real-time "Test Connection" button in Settings that sends a quick `GET /api/sports` or `POST /api/resolve` request to verify healthy handshake and display response latency in ms.
3. **Resilient Failover**:
   - If the resolver is momentarily restarting or undergoing maintenance, automatically fail over to the ad-stripped embed player with zero black screens or error blocks.
