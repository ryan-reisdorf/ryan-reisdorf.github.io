---
title: 'Erebus Station — Homelab'
summary: 'A self-hosted homelab running containerised services behind a reverse proxy, used as a permanent testbed for infrastructure, monitoring, and security practice.'
tags: ['homelab', 'docker', 'linux', 'infrastructure', 'self-hosted', 'security']
role: 'TODO: e.g. Everything — design, build, and the 2am fixes'
stack: ['Docker', 'TODO: reverse proxy — Traefik / Caddy / nginx?', 'Linux', 'TODO: add the rest']
year: 2025 # TODO: year you started it
featured: true
# repo: https://github.com/TODO/erebus-station   # TODO: uncomment if configs are public
draft: false
---

> **TODO** — This is a scaffold. Every section below is a prompt, not a claim.
> Replace the prompts with the real story and delete this blockquote.

## What it is

TODO: One paragraph. What is Erebus Station, and what does it do for you day to
day? Also — where does the name come from? Worth a sentence; people remember it.

## Hardware

TODO: What it actually runs on. A repurposed desktop, a NUC, a rack, a pile of
Pis? Include specs if they matter, and storage layout if there's anything
interesting going on (ZFS, RAID, NAS).

## Services

TODO: What you self-host. A short table works well here — service, what it's
for, why you run it yourself instead of using the hosted version.

| Service | Purpose | Notes |
| --- | --- | --- |
| TODO | TODO | TODO |

## Networking

TODO: The part most homelab writeups skip and everyone wants to read. Worth
covering:

- Reverse proxy setup — which one, and how routing works.
- TLS: how certificates are issued and renewed.
- What's exposed to the internet vs. LAN/VPN-only, and how you made that call.
- DNS: split-horizon, a local resolver, ad-blocking?

## Monitoring

TODO: You do monitoring for a living — so what monitors Erebus Station? Is it
Nagios, or did you deliberately pick something else at home? Either answer is
interesting; the second one especially.

## Security posture

TODO: Relevant to the master's work. Worth covering:

- Segmentation — VLANs, separate networks for untrusted devices?
- Secrets management for container configs.
- Backups: what, where, how often, and — the real question — when did you last
  test a restore?
- Patch cadence.

## What broke

TODO: The best section in any homelab writeup. A real outage or misconfiguration
and what you changed afterwards. Be specific; this is where the engineering
judgement shows.

## What's next

TODO: What you're planning to add or rebuild.
