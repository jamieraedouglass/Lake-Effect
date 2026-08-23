/**
 * Google Apps Script that receives an inquiry from api/contact.ts and appends
 * it as a row.
 *
 * Setup, once:
 *   1. Make a Google Sheet. Name the first tab "Inquiries".
 *   2. Extensions -> Apps Script. Replace everything with this file. Save.
 *   3. Deploy -> New deployment -> type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      "Anyone" means anyone with the URL, which is why the URL is a secret
 *      and lives only in the Vercel environment. It is not on the website.
 *   4. Copy the web app URL. Put it in Vercel as LE_SHEET_WEBHOOK_URL, ticked
 *      for Production and Preview. Redeploy.
 *
 * The header row is written the first time a submission arrives.
 */

var HEADERS = [
  'Received', 'First name', 'Last name', 'Email', 'Phone',
  'Project type', 'Location', 'Budget', 'Message',
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Inquiries')
      || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Inquiries');

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.receivedAt || new Date().toISOString(),
      data.first || '',
      data.last || '',
      data.email || '',
      data.phone || '',
      data.projectType || '',
      data.location || '',
      data.budget || '',
      data.message || '',
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // A non-200 tells the endpoint the sheet failed, which it logs. The email
    // has already been attempted separately, so the inquiry is not lost.
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
