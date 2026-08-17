import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const code = fs.readFileSync(path.join(root, "Code.gs"), "utf8");
const html = fs.readFileSync(path.join(root, "Index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "appsscript.json"), "utf8"));

new Function(code);
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error("Index.html does not contain an inline client script.");
new Function(scriptMatch[1]);

const requiredFunctions = [
  "doGet",
  "setupTracker",
  "allowAnyGoogleAccount",
  "getAccessState",
  "getAccessStateJson",
  "requestAccess",
  "requestAccessJson",
  "reviewAccessRequest",
  "reviewAccessRequestJson",
  "getBootstrap",
  "getBootstrapJson",
  "getDriveHistory",
  "getDriveHistoryJson",
  "getGlobalHistory",
  "getGlobalHistoryJson",
  "saveDrive",
  "bulkUpdateDrives",
  "removeDrive",
  "uploadDrivePhoto",
  "getDrivePhoto"
];
for (const name of requiredFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(code)) {
    throw new Error(`Missing server function: ${name}`);
  }
}

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) throw new Error(`Duplicate HTML ids: ${duplicates.join(", ")}`);

for (const scope of [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email"
]) {
  if (!manifest.oauthScopes.includes(scope)) throw new Error(`Missing OAuth scope: ${scope}`);
}

for (const forbidden of ["cloudflare", "D1Database", "next/server", "ReactDOM"]) {
  if (code.includes(forbidden) || html.includes(forbidden)) {
    throw new Error(`Apps Script source still contains unsupported dependency: ${forbidden}`);
  }
}

const serverFactory = new Function(
  "Utilities",
  "Session",
  `${code}; return { cleanDrive_, buildDriveChanges_, driveSnapshot_ };`
);
const serverHelpers = serverFactory(
  { formatDate: () => "2026-08-10", base64Encode: () => "" },
  { getScriptTimeZone: () => "America/Los_Angeles", getActiveUser: () => ({ getEmail: () => "tester@example.com" }) }
);
const sample = serverHelpers.cleanDrive_({
  driveNumber: " gm_1 ",
  label: "SSD",
  date: "2026-08-10",
  status: "processing",
  totalGb: 2000,
  spaceLeftGb: 300,
  contents: "Project A",
  deletePermission: "ask",
  brand: "other",
  customBrand: "",
  locationType: "other",
  location: "Shelf 2",
  note: ""
});
if (sample.driveNumber !== "GM_1" || sample.spaceLeftGb !== 300) {
  throw new Error("Drive normalization failed.");
}
const changes = serverHelpers.buildDriveChanges_(
  { ...sample, status: "waiting", location: "Shelf 1" },
  sample
);
if (!changes.some(change => change.field === "status") || !changes.some(change => change.field === "location")) {
  throw new Error("History change tracking does not include status and location.");
}
let invalidCapacityRejected = false;
try {
  serverHelpers.cleanDrive_({ ...sample, totalGb: 100, spaceLeftGb: 101 });
} catch {
  invalidCapacityRejected = true;
}
if (!invalidCapacityRejected) throw new Error("Invalid capacity was not rejected.");

if (!html.includes('server("getGlobalHistoryJson")')) {
  throw new Error("Global history does not use the JSON transport.");
}
if (!html.includes('server("getBootstrapJson")')) {
  throw new Error("Inventory bootstrap does not use the JSON transport.");
}
if (!html.includes('server("getDriveHistoryJson", id)')) {
  throw new Error("Drive history does not use the JSON transport.");
}
if (!html.includes('serverJson("getAccessStateJson")')) {
  throw new Error("Access state does not use the JSON transport.");
}
if (!html.includes('serverJson("requestAccessJson"')) {
  throw new Error("Access registration is not connected to Apps Script.");
}
if (!html.includes('serverJson("reviewAccessRequestJson"')) {
  throw new Error("Owner approval is not connected to Apps Script.");
}
if (!html.includes('id="access-shell"') || !html.includes('id="access-modal"')) {
  throw new Error("The login or owner approval interface is missing.");
}
if (!html.includes('id="open-signup"') || !html.includes('accessView:')) {
  throw new Error("The separate signup view is missing.");
}
if (!html.includes("Array.isArray(state.globalHistory)")) {
  throw new Error("Global history rendering is not protected against null responses.");
}

console.log(JSON.stringify({
  files: ["Code.gs", "Index.html", "appsscript.json"],
  serverFunctions: requiredFunctions.length,
  htmlIds: ids.length,
  historyChangeFields: changes.map(change => change.field),
  status: "ok"
}, null, 2));
