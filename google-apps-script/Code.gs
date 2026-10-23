/**
 * Google Apps Script web app for the static business website template.
 *
 * Setup:
 * 1. Open the target Google Sheet and Extensions -> Apps Script.
 * 2. Paste this file into Code.gs.
 * 3. Project Settings -> Script Properties: add ADMIN_TOKEN with a long random value.
 * 4. Deploy -> New deployment -> Web app. Execute as: Me. Access: Anyone.
 * 5. Copy the deployment URL ending in /exec into admin.html.
 *
 * The token is checked server-side and must never be committed to the repository.
 * The sheet is public-read for the website; only token holders can write through this endpoint.
 */
const SPREADSHEET_ID = "11X-a1AUTlxjV5ZgwIR5PXFiyhsXRgELHqZUlDaSzQc4";
const HEADERS = ["type", "key", "value", "id", "name", "description", "price", "duration", "image", "imageAlt"];

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: "business-template-sheets-writer" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty("ADMIN_TOKEN");
    if (!expectedToken) return json_({ ok: false, error: "ADMIN_TOKEN is not configured" });
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) return json_({ ok: false, error: "Missing payload" });

    const payload = JSON.parse(raw);
    if (!payload || typeof payload.token !== "string" || payload.token !== expectedToken) {
      return json_({ ok: false, error: "Unauthorized" });
    }
    if (!Array.isArray(payload.rows) || payload.rows.length < 1) {
      return json_({ ok: false, error: "Rows are missing" });
    }
    const rows = payload.rows.map(row => {
      if (!Array.isArray(row) || row.length !== HEADERS.length) throw new Error("Invalid row format");
      return row.map(value => String(value == null ? "" : value));
    });
    if (HEADERS.some((header, i) => rows[0][i] !== header)) {
      return json_({ ok: false, error: "Unexpected columns" });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheets()[0];
    if (!sheet) return json_({ ok: false, error: "Spreadsheet has no sheets" });
    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, HEADERS.length).setNumberFormat("@");
    sheet.getRange(1, 1, rows.length, HEADERS.length).setValues(rows);
    return json_({ ok: true, rowsWritten: rows.length, sheetName: sheet.getName() });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message || error) });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
