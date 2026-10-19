/**
 * MacroMeter → Google Doc cookbook
 *
 * Setup (5 minutes, see README for screenshots-free steps):
 *  1. Open your cookbook Google Doc → Extensions → Apps Script.
 *  2. Replace everything in Code.gs with this file and click Save.
 *  3. Optional: set SECRET below to any password and paste the same value into
 *     MacroMeter → Settings → Cookbook → "Secret".
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as: Me      Who has access: Anyone
 *     Authorise when asked, then copy the Web app URL (ends in /exec).
 *  5. Paste that URL into MacroMeter → Settings → Cookbook → "Apps Script URL".
 *
 * Each meal you send is appended to the end of the doc as:
 *   <Meal name>        (Heading 2)
 *   Ingredients        (bold)
 *   • ingredient ...   (bullet list)
 *   Method             (bold, left empty for you to write)
 */

var SECRET = ''; // optional shared secret

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (SECRET && data.token !== SECRET) return reply({ ok: false, error: 'Wrong secret' });
    if (!data.title) return reply({ ok: false, error: 'Missing meal name' });

    var doc = DocumentApp.getActiveDocument();
    var body = doc.getBody();

    var title = body.appendParagraph(String(data.title));
    title.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    if (data.servings) {
      style(body.appendParagraph('Serves ' + data.servings), false, true);
    }
    style(body.appendParagraph('Ingredients'), true, false);
    (data.ingredients || []).forEach(function (item) {
      style(body.appendListItem(String(item)).setGlyphType(DocumentApp.GlyphType.BULLET), false, false);
    });
    style(body.appendParagraph('Method'), true, false);
    body.appendParagraph('');

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function style(el, bold, italic) {
  if (el.getHeading && el.getType() === DocumentApp.ElementType.PARAGRAPH) el.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  var attrs = {};
  attrs[DocumentApp.Attribute.BOLD] = bold;
  attrs[DocumentApp.Attribute.ITALIC] = italic;
  el.setAttributes(attrs);
  return el;
}

function doGet() {
  return reply({ ok: true, message: 'MacroMeter cookbook endpoint is live.' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
