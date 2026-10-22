// Строка в Google Таблицу на каждую заявку с сайта. Ставится в таблицу: Расширения → Apps Script, вставить этот код,
// вписать SECRET (та же строка, что sheets.secret в config.php), Начать развёртывание → Новое развёртывание → Веб-приложение,
// «Запуск от имени»: я, «У кого есть доступ»: все. Адрес …/exec вписать в sheets.url в config.php.
// Повтор той же заявки (после сбоя amoCRM) не добавляет строку, а обновляет её по номеру заявки.
const SECRET = 'вставьте-сюда-секрет-из-config.php';

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'json' }); }
  if (!SECRET || body.secret !== SECRET) return out({ ok: false, error: 'secret' });
  const book = SpreadsheetApp.getActive();
  const sh = book.getSheetByName(body.sheet || 'Заявки') || book.insertSheet(body.sheet || 'Заявки');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (sh.getLastRow() === 0) {
      sh.appendRow(body.header);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, body.header.length).setFontWeight('bold');
    }
    // текст, начинающийся с = + - @, таблица приняла бы за формулу
    const row = body.row.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v));
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().map((r) => String(r[0])) : [];
    const at = ids.indexOf(String(body.row[1]));
    if (at >= 0) sh.getRange(at + 2, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return out({ ok: true });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
