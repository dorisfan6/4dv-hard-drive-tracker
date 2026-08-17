/**
 * 4DV Studio — Hard Drive Tracking System
 * Google Apps Script backend.
 *
 * Data lives in a Google Spreadsheet. Drive photos live in a Google Drive
 * folder. Run setupTracker() once from the Apps Script editor before deploying.
 */

var APP = Object.freeze({
  title: "4DV Studio — Hard Drive Tracking System",
  drivesSheet: "Drives",
  historySheet: "History",
  accessSheet: "Access",
  spreadsheetProperty: "SPREADSHEET_ID",
  photoFolderProperty: "PHOTO_FOLDER_ID",
  allowedDomainProperty: "ALLOWED_DOMAIN",
  ownerEmailProperty: "OWNER_EMAIL",
  maxPhotoBytes: 8 * 1024 * 1024,
  photoTypes: ["image/jpeg", "image/png", "image/webp"],
  statuses: ["waiting", "processing", "processed"],
  permissions: ["clear", "ask", "protected"],
  brands: ["samsung", "sandisk", "other"],
  locations: ["4dv-studio", "data-center", "other"],
  driveHeaders: [
    "drive_id",
    "drive_number",
    "label",
    "last_checked",
    "status",
    "total_gb",
    "space_left_gb",
    "contents",
    "delete_permission",
    "brand",
    "custom_brand",
    "location_type",
    "location",
    "note",
    "photo_key",
    "photo_name",
    "photo_type",
    "updated_at"
  ],
  historyHeaders: [
    "history_id",
    "drive_id",
    "drive_number",
    "drive_label",
    "action",
    "summary",
    "field",
    "field_label",
    "previous_value",
    "new_value",
    "created_at",
    "before_snapshot",
    "after_snapshot"
  ],
  accessHeaders: [
    "email",
    "display_name",
    "note",
    "status",
    "requested_at",
    "reviewed_at",
    "reviewed_by"
  ]
});

var DRIVE_FIELDS = Object.freeze([
  { key: "driveNumber", label: "Hard drive #" },
  { key: "label", label: "Label" },
  { key: "date", label: "Last checked" },
  { key: "status", label: "Status" },
  { key: "totalGb", label: "Total storage" },
  { key: "spaceLeftGb", label: "Space left" },
  { key: "contents", label: "Contents" },
  { key: "deletePermission", label: "Can delete?" },
  { key: "brand", label: "Brand" },
  { key: "customBrand", label: "Other brand" },
  { key: "locationType", label: "Location type" },
  { key: "location", label: "Physical location" },
  { key: "note", label: "Note" }
]);

function doGet() {
  assertDomainAuthorized_();
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle(APP.title)
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * One-time project setup.
 *
 * @param {string=} spreadsheetIdOrUrl Google Sheet ID or URL. If the script is
 *     bound to a Sheet, this can be left blank.
 * @param {string=} photoFolderIdOrUrl Existing Drive folder ID or URL. Leave
 *     blank to create "4DV Hard Drive Tracker Photos" in My Drive.
 * @param {string=} allowedDomain Optional Workspace domain, for example
 *     example.com. Deployment access settings remain the primary gate.
 * @return {{spreadsheetId:string, photoFolderId:string, allowedDomain:string}}
 */
function setupTracker(spreadsheetIdOrUrl, photoFolderIdOrUrl, allowedDomain) {
  var spreadsheetId = extractGoogleId_(spreadsheetIdOrUrl);
  if (!spreadsheetId) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) spreadsheetId = active.getId();
  }
  if (!spreadsheetId) {
    throw new Error("Enter a Google Sheet ID or bind this script to a Google Sheet.");
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var folderId = extractGoogleId_(photoFolderIdOrUrl);
  var folder = folderId
    ? DriveApp.getFolderById(folderId)
    : DriveApp.createFolder("4DV Hard Drive Tracker Photos");

  var email = String(Session.getActiveUser().getEmail() || "").toLowerCase();
  var inferredDomain = email.indexOf("@") > -1 ? email.split("@").pop() : "";
  var domain = String(allowedDomain || inferredDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    PHOTO_FOLDER_ID: folder.getId(),
    ALLOWED_DOMAIN: domain,
    OWNER_EMAIL: email || "yinuofan@4dv.ai"
  });

  ensureWorkbook_(spreadsheet);
  return {
    spreadsheetId: spreadsheet.getId(),
    photoFolderId: folder.getId(),
    allowedDomain: domain
  };
}

function getAccessState() {
  assertDomainAuthorized_();
  var spreadsheet = getSpreadsheet_();
  var table = readAccessTable_(spreadsheet);
  var email = currentUserEmail_();
  var ownerEmail = getOwnerEmail_();
  var record = accessRecordFromTable_(table, email);
  var isOwner = email === ownerEmail;
  return {
    email: email,
    displayName: record ? record.displayName : email.split("@")[0],
    note: record ? record.note : "",
    status: isOwner ? "approved" : (record ? record.status : "unregistered"),
    isOwner: isOwner,
    requestedAt: record ? record.requestedAt : "",
    requests: isOwner ? table.rows.map(function (row) {
      return accessRecordFromRow_(table.headers, row);
    }).filter(function (request) { return request.email !== ownerEmail; }) : []
  };
}

function getAccessStateJson() {
  return JSON.stringify(getAccessState());
}

function requestAccess(displayName, note) {
  assertDomainAuthorized_();
  var email = currentUserEmail_();
  if (email === getOwnerEmail_()) return getAccessState();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = getSpreadsheet_();
    var sheet = ensureAccessSheet_(spreadsheet);
    var table = readTable_(sheet);
    var cleanName = String(displayName || email.split("@")[0]).trim().slice(0, 120);
    var cleanNote = String(note || "").trim().slice(0, 500);
    var record = {
      email: email,
      display_name: cleanName,
      note: cleanNote,
      status: "pending",
      requested_at: timestamp_(),
      reviewed_at: "",
      reviewed_by: ""
    };
    var index = table.rows.findIndex(function (row) {
      return String(rowValue_(table.headers, row, "email") || "").toLowerCase() === email;
    });
    if (index > -1) writeRecordToRow_(sheet, table.headers, index + 2, record);
    else appendRecord_(sheet, table.headers, record);
    return getAccessState();
  } finally {
    lock.releaseLock();
  }
}

function requestAccessJson(displayName, note) {
  return JSON.stringify(requestAccess(displayName, note));
}

function reviewAccessRequest(email, decision) {
  assertDomainAuthorized_();
  var reviewer = currentUserEmail_();
  if (reviewer !== getOwnerEmail_()) throw new Error("Only the tracker owner can review access.");
  var status = String(decision || "");
  if (["approved", "rejected"].indexOf(status) < 0) throw new Error("Choose approve or reject.");
  var target = String(email || "").trim().toLowerCase();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = ensureAccessSheet_(getSpreadsheet_());
    var table = readTable_(sheet);
    var index = table.rows.findIndex(function (row) {
      return String(rowValue_(table.headers, row, "email") || "").toLowerCase() === target;
    });
    if (index < 0) throw new Error("Access request not found.");
    writeRecordToRow_(sheet, table.headers, index + 2, {
      status: status,
      reviewed_at: timestamp_(),
      reviewed_by: reviewer
    });
    return getAccessState();
  } finally {
    lock.releaseLock();
  }
}

function reviewAccessRequestJson(email, decision) {
  return JSON.stringify(reviewAccessRequest(email, decision));
}

function getBootstrap() {
  assertAuthorized_();
  var spreadsheet = getSpreadsheet_();
  ensureWorkbook_(spreadsheet);
  return {
    drives: readDrives_(spreadsheet),
    user: {
      email: String(Session.getActiveUser().getEmail() || ""),
      domain: getProperties_().getProperty(APP.allowedDomainProperty) || ""
    }
  };
}

function getBootstrapJson() {
  return JSON.stringify(getBootstrap());
}

function getDriveHistory(driveId) {
  assertAuthorized_();
  var id = positiveInteger_(driveId, "A valid drive id is required.");
  return readHistory_(getSpreadsheet_(), id, 500);
}

function getDriveHistoryJson(driveId) {
  return JSON.stringify(getDriveHistory(driveId));
}

function getGlobalHistory() {
  assertAuthorized_();
  return readHistory_(getSpreadsheet_(), null, 500);
}

function getGlobalHistoryJson() {
  return JSON.stringify(getGlobalHistory());
}

function saveDrive(payload) {
  assertAuthorized_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = getSpreadsheet_();
    var sheet = ensureSheet_(spreadsheet, APP.drivesSheet, APP.driveHeaders);
    var table = readTable_(sheet);
    var cleaned = cleanDrive_(payload || {});
    var requestedId = Number(payload && payload.id);
    var existingIndex = requestedId
      ? findRowIndexById_(table, "drive_id", requestedId)
      : -1;

    var duplicate = table.rows.some(function (row, index) {
      if (index === existingIndex) return false;
      return String(rowValue_(table.headers, row, "drive_number") || "").toUpperCase() === cleaned.driveNumber;
    });
    if (duplicate) throw new Error("That hard drive # already exists. Use a unique number.");

    var before = existingIndex >= 0
      ? driveFromRow_(table.headers, table.rows[existingIndex])
      : null;
    var id = before ? before.id : nextIdFromRows_(table, "drive_id");
    var now = timestamp_();
    var after = Object.assign({}, cleaned, {
      id: id,
      photoKey: before ? before.photoKey : "",
      photoName: before ? before.photoName : "",
      photoType: before ? before.photoType : "",
      updatedAt: now
    });

    var record = driveToRecord_(after);
    if (existingIndex >= 0) {
      writeRecordToRow_(sheet, table.headers, existingIndex + 2, record);
      var changes = buildDriveChanges_(before, after);
      if (changes.length) {
        appendHistoryEvent_(
          spreadsheet,
          nextHistoryId_(spreadsheet),
          after,
          "updated",
          summarizeChanges_(changes),
          before,
          after,
          changes
        );
      }
    } else {
      appendRecord_(sheet, table.headers, record);
      appendHistoryEvent_(
        spreadsheet,
        nextHistoryId_(spreadsheet),
        after,
        "created",
        "Drive registered",
        null,
        after,
        []
      );
    }

    SpreadsheetApp.flush();
    return { drive: after, created: !before };
  } finally {
    lock.releaseLock();
  }
}

function bulkUpdateDrives(ids, updates) {
  assertAuthorized_();
  var normalizedIds = Array.isArray(ids)
    ? ids.map(Number).filter(function (id) { return Number.isInteger(id) && id > 0; })
    : [];
  if (!normalizedIds.length) throw new Error("Select at least one hard drive.");

  var allowed = ["status", "deletePermission", "brand", "customBrand", "locationType", "location"];
  var requested = {};
  Object.keys(updates || {}).forEach(function (key) {
    if (allowed.indexOf(key) > -1) requested[key] = updates[key];
  });
  if (!Object.keys(requested).length) throw new Error("Choose at least one field to update.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = getSpreadsheet_();
    var sheet = ensureSheet_(spreadsheet, APP.drivesSheet, APP.driveHeaders);
    var table = readTable_(sheet);
    var idSet = {};
    normalizedIds.forEach(function (id) { idSet[id] = true; });
    var nextHistoryId = nextHistoryId_(spreadsheet);
    var changedCount = 0;

    table.rows.forEach(function (row, index) {
      var before = driveFromRow_(table.headers, row);
      if (!idSet[before.id]) return;
      var merged = Object.assign({}, before, requested);
      var cleaned = cleanDrive_(merged);
      var after = Object.assign({}, cleaned, {
        id: before.id,
        photoKey: before.photoKey,
        photoName: before.photoName,
        photoType: before.photoType,
        updatedAt: timestamp_()
      });
      var changes = buildDriveChanges_(before, after);
      if (!changes.length) return;

      writeRecordToRow_(sheet, table.headers, index + 2, driveToRecord_(after));
      appendHistoryEvent_(
        spreadsheet,
        nextHistoryId++,
        after,
        "updated",
        summarizeChanges_(changes),
        before,
        after,
        changes
      );
      changedCount += 1;
    });

    SpreadsheetApp.flush();
    return { changedCount: changedCount };
  } finally {
    lock.releaseLock();
  }
}

function removeDrive(driveId) {
  assertAuthorized_();
  var id = positiveInteger_(driveId, "A valid drive id is required.");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = getSpreadsheet_();
    var sheet = ensureSheet_(spreadsheet, APP.drivesSheet, APP.driveHeaders);
    var table = readTable_(sheet);
    var index = findRowIndexById_(table, "drive_id", id);
    if (index < 0) throw new Error("Drive not found.");
    var drive = driveFromRow_(table.headers, table.rows[index]);

    appendHistoryEvent_(
      spreadsheet,
      nextHistoryId_(spreadsheet),
      drive,
      "removed",
      "Drive removed from inventory",
      drive,
      null,
      [{ field: "record", label: "Drive record", before: drive.driveNumber, after: "Removed" }]
    );
    sheet.deleteRow(index + 2);
    SpreadsheetApp.flush();
    return { removed: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Receives a form element through google.script.run. The file input is supplied
 * by Apps Script as a Blob.
 */
function uploadDrivePhoto(formObject) {
  assertAuthorized_();
  var id = positiveInteger_(formObject && formObject.driveId, "A valid drive id is required.");
  var photo = formObject && formObject.photo;
  if (!photo || typeof photo.getBytes !== "function") throw new Error("Choose a photo to upload.");

  var mimeType = String(photo.getContentType() || "").toLowerCase();
  if (APP.photoTypes.indexOf(mimeType) < 0) throw new Error("Use a JPG, PNG, or WebP photo.");
  if (photo.getBytes().length > APP.maxPhotoBytes) throw new Error("Photo must be 8 MB or smaller.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = getSpreadsheet_();
    var sheet = ensureSheet_(spreadsheet, APP.drivesSheet, APP.driveHeaders);
    var table = readTable_(sheet);
    var index = findRowIndexById_(table, "drive_id", id);
    if (index < 0) throw new Error("Drive not found.");
    var before = driveFromRow_(table.headers, table.rows[index]);

    var safeOriginalName = safeFileName_(photo.getName() || "drive-photo");
    var fileName = before.driveNumber + "-" + Date.now() + "-" + safeOriginalName;
    photo.setName(fileName);
    var file = getPhotoFolder_().createFile(photo);
    var after = Object.assign({}, before, {
      photoKey: file.getId(),
      photoName: safeOriginalName,
      photoType: mimeType,
      updatedAt: timestamp_()
    });

    writeRecordToRow_(sheet, table.headers, index + 2, driveToRecord_(after));
    var changes = [{
      field: "photoName",
      label: "Photo",
      before: before.photoName || null,
      after: after.photoName
    }];
    appendHistoryEvent_(
      spreadsheet,
      nextHistoryId_(spreadsheet),
      after,
      "photo",
      before.photoName ? "Drive photo replaced" : "Drive photo uploaded",
      before,
      after,
      changes
    );

    SpreadsheetApp.flush();
    return {
      drive: after,
      photo: blobDataUrl_(photo)
    };
  } finally {
    lock.releaseLock();
  }
}

function getDrivePhoto(driveId) {
  assertAuthorized_();
  var id = positiveInteger_(driveId, "A valid drive id is required.");
  var drives = readDrives_(getSpreadsheet_());
  var drive = drives.find(function (item) { return item.id === id; });
  if (!drive || !drive.photoKey) return { photo: "", name: "" };
  try {
    var blob = DriveApp.getFileById(drive.photoKey).getBlob();
    return { photo: blobDataUrl_(blob), name: drive.photoName || blob.getName() };
  } catch (error) {
    return { photo: "", name: drive.photoName || "", unavailable: true };
  }
}

function readDrives_(spreadsheet) {
  var sheet = ensureSheet_(spreadsheet, APP.drivesSheet, APP.driveHeaders);
  var table = readTable_(sheet);
  return table.rows
    .filter(function (row) { return String(rowValue_(table.headers, row, "drive_number") || "").trim(); })
    .map(function (row) { return driveFromRow_(table.headers, row); });
}

function readHistory_(spreadsheet, driveId, limit) {
  var sheet = ensureSheet_(spreadsheet, APP.historySheet, APP.historyHeaders);
  var table = readTable_(sheet);
  var groups = {};
  var order = [];

  table.rows.forEach(function (row, index) {
    var rowDriveId = Number(rowValue_(table.headers, row, "drive_id"));
    if (driveId && rowDriveId !== driveId) return;
    var historyId = Number(rowValue_(table.headers, row, "history_id")) || index + 1;
    var createdAt = formatTimestamp_(rowValue_(table.headers, row, "created_at"));
    var groupKey = rowDriveId + "|" + historyId + "|" + createdAt;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        id: historyId,
        driveId: rowDriveId,
        driveNumber: String(rowValue_(table.headers, row, "drive_number") || ""),
        driveLabel: String(rowValue_(table.headers, row, "drive_label") || ""),
        action: String(rowValue_(table.headers, row, "action") || "updated"),
        summary: String(rowValue_(table.headers, row, "summary") || "Drive updated"),
        changes: [],
        beforeSnapshot: String(rowValue_(table.headers, row, "before_snapshot") || ""),
        afterSnapshot: String(rowValue_(table.headers, row, "after_snapshot") || ""),
        createdAt: createdAt
      };
      order.push(groupKey);
    }
    var field = String(rowValue_(table.headers, row, "field") || "");
    var action = groups[groupKey].action;
    if (field && field !== "record" && action !== "created" && action !== "baseline") {
      groups[groupKey].changes.push({
        field: field,
        label: String(rowValue_(table.headers, row, "field_label") || field),
        before: nullableValue_(rowValue_(table.headers, row, "previous_value")),
        after: nullableValue_(rowValue_(table.headers, row, "new_value"))
      });
    }
  });

  return order
    .map(function (key) { return groups[key]; })
    .sort(function (a, b) {
      var dateOrder = String(b.createdAt).localeCompare(String(a.createdAt));
      return dateOrder || b.id - a.id;
    })
    .slice(0, limit || 500);
}

function ensureWorkbook_(spreadsheet) {
  var drives = ensureSheet_(spreadsheet, APP.drivesSheet, APP.driveHeaders);
  var history = ensureSheet_(spreadsheet, APP.historySheet, APP.historyHeaders);
  var access = ensureAccessSheet_(spreadsheet);
  styleSheet_(drives, APP.driveHeaders.length);
  styleSheet_(history, APP.historyHeaders.length);
  styleSheet_(access, APP.accessHeaders.length);
  applyDriveValidations_(drives);
}

function ensureAccessSheet_(spreadsheet) {
  var sheet = ensureSheet_(spreadsheet, APP.accessSheet, APP.accessHeaders);
  var table = readTable_(sheet);
  var ownerEmail = getOwnerEmail_();
  var ownerIndex = table.rows.findIndex(function (row) {
    return String(rowValue_(table.headers, row, "email") || "").toLowerCase() === ownerEmail;
  });
  var ownerRecord = {
    email: ownerEmail,
    display_name: "Tracker owner",
    note: "Owner account",
    status: "approved",
    reviewed_at: timestamp_(),
    reviewed_by: ownerEmail
  };
  if (ownerIndex < 0) {
    ownerRecord.requested_at = timestamp_();
    appendRecord_(sheet, table.headers, ownerRecord);
  } else if (String(rowValue_(table.headers, table.rows[ownerIndex], "status")) !== "approved") {
    writeRecordToRow_(sheet, table.headers, ownerIndex + 2, ownerRecord);
  }
  return sheet;
}

function readAccessTable_(spreadsheet) {
  return readTable_(ensureAccessSheet_(spreadsheet));
}

function accessRecordFromTable_(table, email) {
  for (var index = 0; index < table.rows.length; index += 1) {
    if (String(rowValue_(table.headers, table.rows[index], "email") || "").toLowerCase() === email) {
      return accessRecordFromRow_(table.headers, table.rows[index]);
    }
  }
  return null;
}

function accessRecordFromRow_(headers, row) {
  return {
    email: String(rowValue_(headers, row, "email") || "").toLowerCase(),
    displayName: String(rowValue_(headers, row, "display_name") || ""),
    note: String(rowValue_(headers, row, "note") || ""),
    status: String(rowValue_(headers, row, "status") || "pending"),
    requestedAt: formatTimestamp_(rowValue_(headers, row, "requested_at")),
    reviewedAt: formatTimestamp_(rowValue_(headers, row, "reviewed_at")),
    reviewedBy: String(rowValue_(headers, row, "reviewed_by") || "")
  };
}

function ensureSheet_(spreadsheet, name, requiredHeaders) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var current = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function (value) { return String(value || "").trim(); });
  var hasHeaders = current.some(Boolean);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return sheet;
  }
  var missing = requiredHeaders.filter(function (header) { return current.indexOf(header) < 0; });
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function styleSheet_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground("#315bd6")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 30);
}

function applyDriveValidations_(sheet) {
  var rows = Math.max(sheet.getMaxRows() - 1, 1);
  var validationMap = {
    status: APP.statuses,
    delete_permission: APP.permissions,
    brand: APP.brands,
    location_type: APP.locations
  };
  var headers = readHeaders_(sheet);
  Object.keys(validationMap).forEach(function (header) {
    var column = headers.indexOf(header) + 1;
    if (!column) return;
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(validationMap[header], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, column, rows, 1).setDataValidation(rule);
  });
}

function readTable_(sheet) {
  var headers = readHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  var rows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    : [];
  return { headers: headers, rows: rows };
}

function readHeaders_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function (value) { return String(value || "").trim(); });
}

function rowValue_(headers, row, header) {
  var index = headers.indexOf(header);
  return index < 0 ? "" : row[index];
}

function findRowIndexById_(table, idHeader, id) {
  for (var index = 0; index < table.rows.length; index += 1) {
    if (Number(rowValue_(table.headers, table.rows[index], idHeader)) === Number(id)) return index;
  }
  return -1;
}

function nextIdFromRows_(table, idHeader) {
  var max = table.rows.reduce(function (highest, row) {
    return Math.max(highest, Number(rowValue_(table.headers, row, idHeader)) || 0);
  }, 0);
  return max + 1;
}

function nextHistoryId_(spreadsheet) {
  var sheet = ensureSheet_(spreadsheet, APP.historySheet, APP.historyHeaders);
  return nextIdFromRows_(readTable_(sheet), "history_id");
}

function writeRecordToRow_(sheet, headers, rowNumber, record) {
  var existing = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var values = headers.map(function (header, index) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : existing[index];
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
}

function appendRecord_(sheet, headers, record) {
  var values = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
  });
  sheet.appendRow(values);
}

function appendHistoryEvent_(spreadsheet, historyId, drive, action, summary, before, after, changes) {
  var sheet = ensureSheet_(spreadsheet, APP.historySheet, APP.historyHeaders);
  var headers = readHeaders_(sheet);
  var createdAt = timestamp_();
  var beforeSnapshot = before ? JSON.stringify(driveSnapshot_(before)) : "";
  var afterSnapshot = after ? JSON.stringify(driveSnapshot_(after)) : "";
  var rows = changes && changes.length ? changes : [{
    field: "record",
    label: action === "created" ? "Drive created" : "Drive record",
    before: action === "created" ? null : drive.driveNumber,
    after: action === "created" ? "Drive registered" : action
  }];
  var records = rows.map(function (change) {
    return {
      history_id: historyId,
      drive_id: drive.id,
      drive_number: drive.driveNumber,
      drive_label: drive.label,
      action: action,
      summary: summary,
      field: change.field,
      field_label: change.label,
      previous_value: change.before === null || typeof change.before === "undefined" ? "" : change.before,
      new_value: change.after === null || typeof change.after === "undefined" ? "" : change.after,
      created_at: createdAt,
      before_snapshot: beforeSnapshot,
      after_snapshot: afterSnapshot
    };
  });
  var values = records.map(function (record) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

function cleanDrive_(payload) {
  var driveNumber = String(payload.driveNumber || "").trim().toUpperCase();
  var label = String(payload.label || "").trim();
  var date = String(payload.date || today_()).trim().slice(0, 10);
  var status = includes_(APP.statuses, payload.status) ? String(payload.status) : "waiting";
  var totalGb = Math.round(Number(payload.totalGb));
  var spaceLeftGb = Math.round(Number(payload.spaceLeftGb));
  var contents = String(payload.contents || "").trim();
  var permission = includes_(APP.permissions, payload.deletePermission)
    ? String(payload.deletePermission)
    : "ask";
  var brand = includes_(APP.brands, payload.brand) ? String(payload.brand) : "other";
  var customBrand = brand === "other" ? String(payload.customBrand || "").trim() : "";
  var locationType = includes_(APP.locations, payload.locationType)
    ? String(payload.locationType)
    : "other";
  var location = locationType === "4dv-studio"
    ? "4DV Studio"
    : locationType === "data-center"
      ? "Data Center"
      : String(payload.location || "").trim();
  var note = String(payload.note || "").trim();

  if (!driveNumber) throw new Error("Hard drive # is required.");
  if (!Number.isFinite(totalGb) || totalGb <= 0) throw new Error("Total storage must be greater than zero.");
  if (!Number.isFinite(spaceLeftGb) || spaceLeftGb < 0 || spaceLeftGb > totalGb) {
    throw new Error("Space left must be between zero and total storage.");
  }
  return {
    driveNumber: driveNumber,
    label: label,
    date: date,
    status: status,
    totalGb: totalGb,
    spaceLeftGb: spaceLeftGb,
    contents: contents,
    deletePermission: permission,
    brand: brand,
    customBrand: customBrand,
    locationType: locationType,
    location: location,
    note: note
  };
}

function driveFromRow_(headers, row) {
  return {
    id: Number(rowValue_(headers, row, "drive_id")) || 0,
    driveNumber: String(rowValue_(headers, row, "drive_number") || ""),
    label: String(rowValue_(headers, row, "label") || ""),
    date: formatDateOnly_(rowValue_(headers, row, "last_checked")),
    status: String(rowValue_(headers, row, "status") || "waiting"),
    totalGb: Number(rowValue_(headers, row, "total_gb")) || 0,
    spaceLeftGb: Number(rowValue_(headers, row, "space_left_gb")) || 0,
    contents: String(rowValue_(headers, row, "contents") || ""),
    deletePermission: String(rowValue_(headers, row, "delete_permission") || "ask"),
    brand: String(rowValue_(headers, row, "brand") || "other"),
    customBrand: String(rowValue_(headers, row, "custom_brand") || ""),
    locationType: String(rowValue_(headers, row, "location_type") || "other"),
    location: String(rowValue_(headers, row, "location") || ""),
    note: String(rowValue_(headers, row, "note") || ""),
    photoKey: String(rowValue_(headers, row, "photo_key") || ""),
    photoName: String(rowValue_(headers, row, "photo_name") || ""),
    photoType: String(rowValue_(headers, row, "photo_type") || ""),
    updatedAt: formatTimestamp_(rowValue_(headers, row, "updated_at"))
  };
}

function driveToRecord_(drive) {
  return {
    drive_id: drive.id,
    drive_number: drive.driveNumber,
    label: drive.label,
    last_checked: drive.date,
    status: drive.status,
    total_gb: drive.totalGb,
    space_left_gb: drive.spaceLeftGb,
    contents: drive.contents,
    delete_permission: drive.deletePermission,
    brand: drive.brand,
    custom_brand: drive.customBrand,
    location_type: drive.locationType,
    location: drive.location,
    note: drive.note,
    photo_key: drive.photoKey || "",
    photo_name: drive.photoName || "",
    photo_type: drive.photoType || "",
    updated_at: drive.updatedAt || timestamp_()
  };
}

function driveSnapshot_(drive) {
  return {
    driveNumber: drive.driveNumber,
    label: drive.label,
    status: drive.status,
    contents: drive.contents,
    totalGb: drive.totalGb,
    spaceLeftGb: drive.spaceLeftGb,
    deletePermission: drive.deletePermission,
    brand: drive.brand,
    customBrand: drive.customBrand,
    locationType: drive.locationType,
    location: drive.location,
    date: drive.date,
    note: drive.note,
    photoName: drive.photoName || ""
  };
}

function buildDriveChanges_(before, after) {
  return DRIVE_FIELDS.reduce(function (changes, field) {
    var previous = before[field.key];
    var next = after[field.key];
    if (String(previous === null || typeof previous === "undefined" ? "" : previous) !==
        String(next === null || typeof next === "undefined" ? "" : next)) {
      changes.push({ field: field.key, label: field.label, before: previous, after: next });
    }
    return changes;
  }, []);
}

function summarizeChanges_(changes) {
  if (!changes.length) return "No changes";
  if (changes.length === 1 && changes[0].field === "status") return "Processing status updated";
  return changes.length + " field" + (changes.length === 1 ? "" : "s") + " updated";
}

function getSpreadsheet_() {
  var id = getProperties_().getProperty(APP.spreadsheetProperty);
  if (!id) throw new Error("Tracker is not configured. Run setupTracker() once from the Apps Script editor.");
  return SpreadsheetApp.openById(id);
}

function getPhotoFolder_() {
  var id = getProperties_().getProperty(APP.photoFolderProperty);
  if (!id) throw new Error("Photo storage is not configured. Run setupTracker() once.");
  return DriveApp.getFolderById(id);
}

function getProperties_() {
  return PropertiesService.getScriptProperties();
}

function assertAuthorized_() {
  assertDomainAuthorized_();
  var email = currentUserEmail_();
  if (email === getOwnerEmail_()) return;
  var record = accessRecordFromTable_(readAccessTable_(getSpreadsheet_()), email);
  if (!record || record.status !== "approved") {
    throw new Error("Your tracker access is awaiting owner approval.");
  }
}

function assertDomainAuthorized_() {
  var domain = String(getProperties_().getProperty(APP.allowedDomainProperty) || "").toLowerCase();
  var email = currentUserEmail_();
  if (domain && email && !email.endsWith("@" + domain)) {
    throw new Error("This tracker is limited to the " + domain + " Google Workspace.");
  }
}

function currentUserEmail_() {
  var email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  if (!email) throw new Error("Sign in with your company Google account to continue.");
  return email;
}

function getOwnerEmail_() {
  return String(getProperties_().getProperty(APP.ownerEmailProperty) || "yinuofan@4dv.ai")
    .trim()
    .toLowerCase();
}

function extractGoogleId_(value) {
  var match = String(value || "").match(/[-\w]{20,}/);
  return match ? match[0] : "";
}

function positiveInteger_(value, message) {
  var number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(message);
  return number;
}

function includes_(values, candidate) {
  return values.indexOf(String(candidate || "")) > -1;
}

function nullableValue_(value) {
  return value === "" || value === null || typeof value === "undefined" ? null : value;
}

function safeFileName_(value) {
  return String(value || "drive-photo")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "drive-photo";
}

function blobDataUrl_(blob) {
  return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function timestamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function formatDateOnly_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function formatTimestamp_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  }
  return String(value).replace("T", " ").replace(/\.000Z$/, "");
}
