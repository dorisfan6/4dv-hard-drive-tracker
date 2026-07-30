# 4DV Studio Hard Drive Tracking System

A shared production-drive inventory for tracking processing status, stored
contents, capacity, deletion permission, physical location, photos, and change
history.

[Open the hosted tracker](https://drive-ledger-burberry-rain.doris6100.chatgpt.site)

## Features

- Drive inventory with search and status filters
- Multi-drive selection and bulk editing
- File-fit capacity checker
- Samsung, SanDisk, and custom brand options
- 4DV Studio, Data Center, and custom physical locations
- Drive photo uploads backed by object storage
- Per-drive and global change history

## Local development

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm run dev
pnpm test
```

## Hosting

The tracker is deployed with OpenAI Sites because it uses Cloudflare D1 for the
shared database and R2 for photos. GitHub stores the source code; GitHub Pages
is not used because it cannot run the application's server-side database and
photo-storage features.
