import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the finished 4DV Studio hard drive tracker", async () => {
  const [dashboard, layout, hosting] = await Promise.all([
    readFile(new URL("../app/DriveDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dist/.openai/hosting.json", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);

  assert.match(dashboard, /4DV Studio/);
  assert.match(dashboard, /Hard Drive Tracking System/);
  assert.match(dashboard, /Drive inventory/);
  assert.match(dashboard, /\/api\/drives/);
  assert.match(dashboard, /Waiting to be processed/);
  assert.match(dashboard, /Drive history/);
  assert.match(dashboard, /\?history=all/);
  assert.match(layout, /4DV Studio — Hard Drive Tracking System/);
  assert.doesNotMatch(dashboard, /Drive Ledger|Production storage register|Burberry Rain|Know what’s on/);
  assert.doesNotMatch(layout, /Drive Ledger|og\.png/);
  assert.doesNotMatch(`${dashboard}\n${layout}`, /codex-preview|SkeletonPreview/);

  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "PHOTOS");
  assert.equal(
    hostingConfig.project_id,
    "appgprj_6a6a91425c5081919c981556de242884",
  );
});
