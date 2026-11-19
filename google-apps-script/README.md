# 4DV Studio Hard Drive Tracker — Google Apps Script

This folder is a Google Apps Script version of the existing tracker. It does not depend on Next.js, Cloudflare D1, or Cloudflare R2.

## Storage model

- `Drives` sheet: current hard drive inventory
- `History` sheet: append-only activity history
- Google Drive folder: uploaded JPG, PNG, and WebP drive photos
- Script Properties: Spreadsheet ID, photo folder ID, owner email, and an optional domain restriction

The migration workbook already uses the expected `Drives` and `History` headers. Importing that workbook preserves the existing 19 drive records and 84 exported History rows.

## Files to add to Apps Script

- `Code.gs`
- `Index.html`
- `appsscript.json` (enable **Show "appsscript.json" manifest file in editor** in Project Settings)

## One-time setup

1. Upload `4DV_Hard_Drive_Migration_2026-07-30.xlsx` to Google Drive and open it as a Google Sheet.
2. Copy the spreadsheet ID from its URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`.
3. Create a folder in the company Google Drive for hard drive photos, or let the setup function create one.
4. In the Apps Script editor, run:

   ```javascript
   setupTracker('SPREADSHEET_ID', '', 'COMPANY_DOMAIN.com');
   ```

   The second argument can be a Drive folder ID or URL. When it is blank, the script creates a folder named `4DV Hard Drive Tracker Photos`.
5. Accept the requested Google Sheets, Google Drive, and account-email permissions.

If the Apps Script project is created from **Extensions → Apps Script** inside the imported spreadsheet, the first argument can be blank:

```javascript
setupTracker('', '', 'COMPANY_DOMAIN.com');
```

## Deploy as an internal web app

1. Select **Deploy → New deployment → Web app**.
2. Use **Execute as: Me**.
3. Choose **Anyone with Google account** so any verified email can request access.
4. Deploy and share the `/exec` URL. The `/dev` URL is only for editors testing the latest saved code.

Run `allowAnyGoogleAccount()` once as the owner when migrating a project that previously used an `ALLOWED_DOMAIN` restriction. Google verifies the account email; the app owner must still approve every new registration before tracker data is available.

## Updating the app

After changing `Code.gs` or `Index.html`, save the project and create a new web-app deployment version. Existing Sheet data and Drive photos remain unchanged.

## Notes

- Photos are limited to 8 MB each.
- Replacing a photo keeps the previous file in the photo folder for recovery.
- Removing a drive record does not erase files from the physical hard drive and retains an audit event in `History`.
- The spreadsheet and photo folder should remain owned by the company account or a company Shared Drive.
