import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the finished Drive Ledger application", async () => {
  const [dashboard, layout, hosting] = await Promise.all([
    readFile(new URL("../app/DriveDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dist/.openai/hosting.json", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(dashboard, /Know what’s on/);
  assert.match(dashboard, /Drive inventory/);
  assert.match(dashboard, /\/api\/drives/);
  assert.match(layout, /Drive Ledger — Hard Drive Tracking/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(`${dashboard}\n${layout}`, /codex-preview|SkeletonPreview/);

  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(
    hostingConfig.project_id,
    "appgprj_6a6a91425c5081919c981556de242884",
  );
});
