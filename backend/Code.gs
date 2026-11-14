/* ระบบทดสอบมาตรวัด IPC (Levenson, 1981) — แยกจากงานวิจัย ไม่ใช้ข้อมูลร่วมกัน
   Bound to its own Google Sheet (Extensions → Apps Script). Two web-app deployments of this one project:
     1) หน้าแบบทดสอบ  — Execute as: Me · Who has access: Anyone            (respondents, no sign-in)
     2) หน้าหลังบ้าน   — Execute as: Me · Who has access: Anyone with Google account   (open with ?page=admin)
   The back office opens only for the Google account that owns this script (the sheet owner). Google does the sign-in;
   for anyone else Apps Script cannot see their email, so they are refused. Nothing in this file names an account.
   Scoring: 24 items, each −3…+3 with no 0. Subscale = sum of its 8 items + 24 → 0–48; 24 is the neutral midpoint. */

var SHEET = "คำตอบ";
var KEY = { I: [1, 4, 5, 9, 18, 19, 21, 23], P: [3, 8, 11, 13, 15, 17, 20, 22], C: [2, 6, 7, 10, 12, 14, 16, 24] };
var HEADER = ["id", "received", "label", "started", "finished", "seconds"]
  .concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map(function (k) { return "L" + k; }))
  .concat(["I", "P", "C", "lean", "answered"]);

/* The respondent page now lives on GitHub Pages. This deployment only takes answers (doPost); opening the old link
   shows a button to the new page. Leave SITE_URL empty to serve the old Index page instead. */
var SITE_URL = "https://buriram-locus-lab.github.io/ipc-test/";

function doGet(e) {
  var admin = e && e.parameter && e.parameter.page === "admin";
  if (!admin && SITE_URL) {
    var u = SITE_URL.replace(/"/g, "");
    return HtmlService.createHtmlOutput('<div style="font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;text-align:center;line-height:1.6">' +
      '<h2>แบบทดสอบ IPC ย้ายที่อยู่แล้ว</h2><p>กดปุ่มด้านล่างเพื่อเปิดหน้าใหม่</p>' +
      '<p><a href="' + u + '" target="_top" style="display:inline-block;background:#1d2321;color:#fff;padding:14px 28px;border-radius:14px;text-decoration:none;font-weight:600">เปิดแบบทดสอบ</a></p></div>')
      .setTitle("แบบทดสอบ IPC").addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  return HtmlService.createHtmlOutputFromFile(admin ? "Admin" : "Index")
    .setTitle(admin ? "หลังบ้าน · แบบทดสอบ IPC" : "แบบทดสอบ IPC")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/* ---------- respondents ---------- */
/* From the GitHub page: POST text/plain {"action":"submit","rec":{...}} → JSON */
function doPost(e) {
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (b.action === "submit") out = submit(b.rec);
    else if (b.action === "feedback") out = feedback(b.fb);
    else throw new Error("ไม่รู้จักคำสั่ง");
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function submit(rec) {
  rec = rec || {};
  var id = String(rec.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
  if (id.length < 8) throw new Error("รหัสชุดคำตอบไม่ถูกต้อง");
  var a = {}, raw = rec.answers || {};
  for (var k = 1; k <= 24; k++) { var v = +raw[k]; a[k] = [-3, -2, -1, 1, 2, 3].indexOf(v) >= 0 ? v : ""; }
  for (k = 1; k <= 24; k++) if (a[k] === "") throw new Error("ต้องตอบครบ 24 ข้อ (ข้อ " + k + " ยังไม่ได้ตอบ)");   // all items required
  var sc = score_(a);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = sheet_(), last = sh.getLastRow();
    if (last > 1) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return { ok: true, dup: true, scores: sc };
    }
    var st = iso_(rec.started), fi = iso_(rec.finished);
    var secs = st && fi ? Math.max(0, Math.round((new Date(fi) - new Date(st)) / 1000)) : "";
    var row = [id, new Date(), String(rec.label || "").replace(/^[=+\-@\s]+/, "").slice(0, 40), st, fi, secs];
    for (k = 1; k <= 24; k++) row.push(a[k]);
    sh.appendRow(row.concat([sc.I, sc.P, sc.C, sc.lean, sc.answered]));
  } finally { lock.releaseLock(); }
  return { ok: true, scores: sc };
}

/* Wording feedback after the result: one row per item ticked or commented on (item 0 = general comment). */
var FB_SHEET = "ความเห็นรายข้อ";
var FB_HEADER = ["id", "received", "label", "item", "ambiguous", "reread", "note"];
function feedback(fb) {
  fb = fb || {};
  var id = String(fb.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
  if (id.length < 8) throw new Error("รหัสชุดคำตอบไม่ถูกต้อง");
  var clean = function (t, n) { return String(t || "").replace(/^[=+\-@\s]+/, "").slice(0, n); };
  var rows = [], now = new Date(), label = clean(fb.label, 40);
  (fb.items || []).slice(0, 24).forEach(function (x) {
    var k = +x.k; if (!(k >= 1 && k <= 24)) return;
    rows.push([id, now, label, k, x.amb ? 1 : 0, x.reread ? 1 : 0, clean(x.note, 500)]);
  });
  if (fb.overall) rows.push([id, now, label, 0, "", "", clean(fb.overall, 1000)]);
  if (!rows.length) throw new Error("ไม่มีความเห็น");
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(FB_SHEET);
    if (!sh) { sh = ss.insertSheet(FB_SHEET); sh.appendRow(FB_HEADER); sh.setFrozenRows(1); sh.getRange(1, 1, 1, FB_HEADER.length).setFontWeight("bold"); }
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, FB_HEADER.length).setValues(rows);
  } finally { lock.releaseLock(); }
  return { ok: true, saved: rows.length };
}

function score_(a) {
  var out = {}, n = 0;
  ["I", "P", "C"].forEach(function (d) {
    var sum = 0, got = 0;
    KEY[d].forEach(function (k) { if (a[k] !== "" && a[k] != null) { sum += a[k]; got++; } });
    out[d] = got === 8 ? sum + 24 : null; n += got;
  });
  var have = ["I", "P", "C"].filter(function (d) { return out[d] !== null; }).sort(function (x, y) { return out[y] - out[x]; });
  out.lean = have.length === 3 ? (out[have[0]] - out[have[1]] <= 3 ? "none" : have[0]) : "";
  out.answered = n;
  return out;
}

/* ---------- back office (owner's Google account only) ---------- */
function whoAmI() {
  var me = Session.getActiveUser().getEmail(), owner = Session.getEffectiveUser().getEmail();
  return { ok: !!me && me === owner, email: me ? me.replace(/^(.).*(@.*)$/, "$1•••$2") : "" };
}
function adminData() {
  if (!whoAmI().ok) throw new Error("ไม่มีสิทธิ์ เปิดผ่านลิงก์หลังบ้าน และเข้าสู่ระบบด้วยบัญชี Google เจ้าของชีต");
  var sh = sheet_(), v = sh.getDataRange().getValues();
  var head = v.shift();
  var rows = v.map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o;
  });
  return { ok: true, header: head, rows: rows.reverse(), sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
}

/* ---------- helpers ---------- */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEADER); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEADER.length).setFontWeight("bold"); }
  return sh;
}
function iso_(s) { var d = new Date(String(s || "")); return isNaN(d) ? "" : d.toISOString(); }

/* Run once from the editor (▶ setup) to create the sheet and grant permissions. */
function setup() { sheet_(); return "พร้อมใช้งาน: ชีต “" + SHEET + "”"; }
