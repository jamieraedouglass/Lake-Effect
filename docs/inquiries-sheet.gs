/**
 * Google Apps Script that receives an inquiry from api/contact.ts, or a
 * question and answer from api/ask.ts, and appends it as a row. Inquiries go
 * on the "Inquiries" tab and Ask panel exchanges on the "Ask" tab; which one
 * is decided by the "kind" field of the post, and a post without one is an
 * inquiry, so the endpoint that predates the field still lands where it did.
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
 * The header row of each tab is written the first time something arrives for it.
 *
 * After changing this file: Deploy -> Manage deployments -> edit the existing
 * deployment -> Version: New version -> Deploy. A new deployment would mean a
 * new URL and another trip to Vercel; a new version keeps the one that is set.
 */

var TABS = {
  inquiry: {
    name: 'Inquiries',
    headers: ['Received', 'First name', 'Last name', 'Email', 'Phone',
              'Project type', 'Location', 'Budget', 'Message'],
    row: function (d) {
      return [d.receivedAt || new Date().toISOString(), d.first || '', d.last || '',
              d.email || '', d.phone || '', d.projectType || '', d.location || '',
              d.budget || '', d.message || ''];
    },
  },
  ask: {
    name: 'Ask',
    headers: ['Asked', 'Page', 'Turn', 'Question', 'Answer', 'Covered', 'Links'],
    row: function (d) {
      return [d.askedAt || new Date().toISOString(), d.page || '', d.turn || '',
              d.question || '', d.answer || '', d.covered ? 'yes' : 'no',
              (d.links || []).join(' ')];
    },
  },
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var tab = TABS[data.kind] || TABS.inquiry;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab.name)
      || SpreadsheetApp.getActiveSpreadsheet().insertSheet(tab.name);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(tab.headers);
      sheet.getRange(1, 1, 1, tab.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow(tab.row(data));

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
