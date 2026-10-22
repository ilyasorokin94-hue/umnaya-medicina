<?php
// Приёмник заявок с сайта стоматологии «Умная Медицина» (Ilya 22.10.2026).
// Заявка сначала записывается в журнал на сервере в России (ч. 5 ст. 18 152-ФЗ), потом уходит сделкой в amoCRM,
// сообщением в Telegram, строкой в Google Таблицу и, если клинике нужно, письмом на почту. Ключи лежат в config.php вне папки сайта (образец server/config.sample.php),
// в репозитории их нет. Что не дошло (amoCRM, Telegram или таблица не ответили), повторяется кроном и при следующих заявках.
//   POST /lead.php                 заявка; fetch с Accept: application/json получает JSON, форма без скриптов уходит на /spasibo/
//   GET  /lead.php?file=…&k=…      снимок из формы «Пришлите снимок» по ссылке из примечания в amoCRM
//   GET  /lead.php?cron=…          повтор недошедшего и чистка старых заявок (крон хостинга раз в 5 минут)

declare(strict_types=1);
mb_internal_encoding('UTF-8');
date_default_timezone_set('Europe/Moscow');

const FORMS = [
  'book' => 'Запись на консультацию',
  'call' => 'Перезвонить',
  'xray' => 'Снимок на второе мнение',
  'allon' => 'Консультация All-on-4',
  'offer' => 'Окно «Три врача»',
  'final' => 'Номер в подвале',
  'zapis' => 'Страница записи',
];
// поля формы, которые принимаем: [подпись, сведения о здоровье — только в amoCRM, а в Telegram и таблицу при full]
const FIELDS = [
  'reason' => ['Что беспокоит', true],
  'service' => ['Услуга', true],
  'doctor' => ['Врач', false],
  'when' => ['Удобное время', false],
  'promo' => ['Акция', false],
  'jaws' => ['Челюсти', true],
  'denture' => ['Съёмный протез', true],
  'comment' => ['Комментарий', true],
];
const SRC = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid', 'ym_uid', 'roistat', 'ref', 'landing'];
const FILE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf', 'zip', 'dcm'];

$json = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
// настройки: путь из UMED_LEADS_CONFIG (SetEnv в .htaccess или окружение), иначе папка umed-leads рядом с корнем сайта
// или уровнем выше (у Джино корень …/domains/<домен>, папка настроек ~/umed-leads)
$C = null;
foreach ([getenv('UMED_LEADS_CONFIG') ?: ($_SERVER['UMED_LEADS_CONFIG'] ?? ''), dirname(__DIR__) . '/umed-leads/config.php', dirname(__DIR__, 2) . '/umed-leads/config.php'] as $cfgPath)
  if ($cfgPath !== '' && is_file($cfgPath)) { $C = require $cfgPath; break; }

if (!$C) fail(503, 'Приём заявок не настроен. Позвоните нам, пожалуйста.');
$C['data_dir'] = rtrim($C['data_dir'], '/');
foreach (['leads', 'files', 'rate'] as $d) if (!is_dir("{$C['data_dir']}/$d")) mkdir("{$C['data_dir']}/$d", 0700, true);
// на случай, если папку данных всё же положили внутрь сайта
if (!is_file("{$C['data_dir']}/.htaccess")) file_put_contents("{$C['data_dir']}/.htaccess", "Require all denied\n");

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['file'])) serveFile((string)$_GET['file'], (string)($_GET['k'] ?? ''));
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['cron'])) {
  if (!hash_equals((string)$C['cron_key'], (string)$_GET['cron'])) fail(403, 'Нет доступа');
  header('Content-Type: text/plain; charset=utf-8');
  echo 'retried ' . retryPending(50) . ', removed ' . cleanup() . "\n";
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST'); fail(405, 'Только POST'); }

// ---------- приём ----------
// заявка только со своего сайта: браузеры присылают Origin при POST
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array(rtrim($origin, '/'), originList(), true)) fail(403, 'Заявка не с сайта клиники');
// файл больше post_max_size: PHP отдаёт пустой $_POST
if (!$_POST && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) fail(413, 'Файл слишком большой. Пришлите снимок в Telegram или MAX.');

$in = fn(string $k, int $max = 300) => trim(mb_substr(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)($_POST[$k] ?? '')), 0, $max));

// ловушка для ботов: поле website скрыто от людей. Боту отвечаем «принято», чтобы не подбирал обход
if ($in('website') !== '') done(['ok' => true, 'id' => 'ok']);
// заполнили за пару секунд после открытия страницы: скорее всего бот (t присылает скрипт сайта, без скриптов его нет)
$t = (int)($_POST['t'] ?? 0);
if ($t > 0 && $t < 1500) done(['ok' => true, 'id' => 'ok']);

$phone = normPhone($in('phone', 40));
if (!$phone) fail(422, 'Проверьте номер телефона: после +7 нужно 10 цифр.');
if (!empty($C['require_consent']) && empty($_POST['consent'])) fail(422, 'Отметьте согласие на обработку персональных данных.');
$form = $in('form', 20);
if (!isset(FORMS[$form])) $form = 'call';

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
if (!rateOk($ip)) fail(429, 'Слишком много заявок подряд. Позвоните нам, пожалуйста.');

// двойное нажатие или повтор той же заявки за 2 минуты: вторую сделку не создаём
$dupe = "{$C['data_dir']}/rate/d-" . sha1($phone . '|' . $form);
if (is_file($dupe) && time() - filemtime($dupe) < 120) done(['ok' => true, 'id' => (string)file_get_contents($dupe)]);

$id = date('ymd-His') . '-' . bin2hex(random_bytes(2));
$lead = [
  'id' => $id,
  'at' => date('c'),
  'form' => $form,
  'name' => $in('name', 80),
  'phone' => $phone,
  'fields' => [],
  'page' => $in('page', 300),
  'title' => $in('title', 200),
  'src' => [],
  'consent' => !empty($_POST['consent']) ? ['at' => date('c'), 'docs' => (string)($C['consent_version'] ?? '')] : null,
  'ip' => $ip,
  'ua' => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
  'file' => null,
  'amo' => null,       // id сделки
  // почта только для заявок, пришедших после её включения: иначе повтор разослал бы письма по старым заявкам журнала
  'done' => ['amo' => false, 'tg' => false, 'sheet' => false, 'mail' => empty($C['mail']['to']) ? null : false],
  'tg_wait_amo' => false,
  'tries' => 0,
  'err' => [],
];
foreach (FIELDS as $k => $_) if (($v = $in($k, $k === 'comment' ? 1000 : 200)) !== '') $lead['fields'][$k] = $v;
foreach (SRC as $k) if (($v = $in($k, 500)) !== '') $lead['src'][$k] = $v;
if (!empty($_FILES['file']) && ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) $lead['file'] = saveFile($_FILES['file'], $id);

saveLead($lead);
file_put_contents($dupe, $id);

// ответ человеку сразу после записи в журнал, отправка дальше идёт без него (на PHP-FPM)
done(['ok' => true, 'id' => $id], false);
process($lead);
retryPending(3);
exit;

// ---------- отправка ----------
function process(array &$lead): void {
  global $C;
  $lead['tries']++;
  if (!$lead['done']['amo'] && !empty($C['amo']['token'])) {
    try { $lead['amo'] = amoSend($lead); $lead['done']['amo'] = true; unset($lead['err']['amo']); }
    catch (Throwable $e) { $lead['err']['amo'] = $e->getMessage(); }
  }
  if (!empty($C['telegram']['token'])) {
    try {
      if (!$lead['done']['tg']) {
        tgSend(tgText($lead), $lead['amo']);
        $lead['done']['tg'] = true;
        $lead['tg_wait_amo'] = !$lead['done']['amo'] && !empty($C['amo']['token']);
      } elseif ($lead['tg_wait_amo'] && $lead['done']['amo']) {
        tgSend('✅ Заявка №' . $lead['id'] . ' попала в amoCRM после повтора.', $lead['amo']);
        $lead['tg_wait_amo'] = false;
      }
      unset($lead['err']['tg']);
    } catch (Throwable $e) { $lead['err']['tg'] = $e->getMessage(); }
  }
  // строку в таблице обновляем, когда появилась сделка: по номеру заявки она перезапишется, а не задвоится
  $sheetAgain = $lead['done']['sheet'] && $lead['done']['amo'] && empty($lead['sheet_amo']);
  if (!empty($C['sheets']['url']) && (!$lead['done']['sheet'] || $sheetAgain)) {
    try { sheetSend($lead); $lead['done']['sheet'] = true; $lead['sheet_amo'] = $lead['done']['amo']; unset($lead['err']['sheet']); }
    catch (Throwable $e) { $lead['err']['sheet'] = $e->getMessage(); }
  }
  if (!empty($C['mail']['to']) && ($lead['done']['mail'] ?? null) === false) {
    try { mailSend($lead); $lead['done']['mail'] = true; unset($lead['err']['mail']); }
    catch (Throwable $e) { $lead['err']['mail'] = $e->getMessage(); }
  }
  saveLead($lead);
}

function pending(array $l): bool {
  global $C;
  return (!$l['done']['amo'] && !empty($C['amo']['token'])) || (!$l['done']['tg'] && !empty($C['telegram']['token']))
    || ($l['tg_wait_amo'] ?? false) || (!$l['done']['sheet'] && !empty($C['sheets']['url']))
    || (!empty($C['sheets']['url']) && $l['done']['amo'] && empty($l['sheet_amo']))
    || (!empty($C['mail']['to']) && ($l['done']['mail'] ?? null) === false);
}

// недошедшие заявки за последние 3 дня, не больше 30 попыток на каждую (крон раз в 5 минут — это 2,5 часа)
function retryPending(int $limit): int {
  global $C;
  $n = 0;
  foreach (glob("{$C['data_dir']}/leads/*/*.json") ?: [] as $f) {
    if ($n >= $limit) break;
    if (time() - filemtime($f) > 3 * 86400) continue;
    $l = json_decode((string)file_get_contents($f), true);
    // свежую заявку отправляет её собственный запрос
    if (!$l || $l['tries'] >= 30 || time() - strtotime($l['at']) < 60 || !pending($l)) continue;
    // крон и запрос с заявкой могут прийти одновременно: замок, чтобы сделка не создалась дважды
    $h = fopen("$f.lock", 'c');
    if (!$h || !flock($h, LOCK_EX | LOCK_NB)) { if ($h) fclose($h); continue; }
    $l = json_decode((string)file_get_contents($f), true);
    if (pending($l)) { process($l); $n++; }
    flock($h, LOCK_UN); fclose($h); @unlink("$f.lock");
  }
  return $n;
}

// журнал и снимки хранятся keep_days дней (по умолчанию 90): дальше заявка живёт в amoCRM
function cleanup(): int {
  global $C;
  $keep = (int)($C['keep_days'] ?? 90) * 86400;
  $n = 0;
  foreach (array_merge(glob("{$C['data_dir']}/leads/*/*.json") ?: [], glob("{$C['data_dir']}/files/*") ?: [], glob("{$C['data_dir']}/rate/*") ?: []) as $f) {
    $age = time() - filemtime($f);
    if ($age > $keep || (str_contains($f, '/rate/') && $age > 86400)) { unlink($f); $n++; }
  }
  foreach (glob("{$C['data_dir']}/leads/*", GLOB_ONLYDIR) ?: [] as $d) if (!(glob("$d/*") ?: [])) rmdir($d);
  return $n;
}

// ---------- amoCRM ----------
function amo(string $method, string $path, ?array $body = null): array {
  global $C;
  [$code, $res] = http($method, ($C['amo']['base'] ?? "https://{$C['amo']['subdomain']}.amocrm.ru") . $path, $body, ['Authorization: Bearer ' . $C['amo']['token']]);
  if ($code === 204) return [];
  $j = json_decode($res, true);
  if ($code >= 300 || !is_array($j)) throw new AmoError("amoCRM $code: " . mb_substr($res, 0, 500), $code);
  return $j;
}
class AmoError extends RuntimeException {}

function amoSend(array $l): int {
  global $C;
  $a = $C['amo'];
  $label = FORMS[$l['form']];
  $name = $l['name'] !== '' ? $l['name'] : 'Без имени';
  $phoneField = [['field_code' => 'PHONE', 'values' => [['value' => '+' . $l['phone'], 'enum_code' => 'WORK']]]];
  $tags = array_map(fn($t) => ['name' => $t], array_values(array_unique(array_merge($a['tags'] ?? ['Сайт'], [$label]))));
  $leadBody = ['name' => ($a['lead_prefix'] ?? 'Сайт: ') . $label, 'pipeline_id' => (int)$a['pipeline_id'], '_embedded' => ['tags' => $tags]];
  if (!empty($a['status_id'])) $leadBody['status_id'] = (int)$a['status_id'];
  if (!empty($a['responsible_user_id'])) $leadBody['responsible_user_id'] = (int)$a['responsible_user_id'];
  $cf = amoFields($l);

  // UTM в поля «Статистика» по их кодам; если аккаунт их не принял, отправляем без них (UTM всё равно есть в примечании)
  $send = function (array $cf) use ($a, $l, $leadBody, $name, $phoneField, $label): int {
    if ($cf) $leadBody['custom_fields_values'] = $cf;
    if (($a['mode'] ?? 'complex') === 'unsorted') {
      $r = amo('POST', '/api/v4/leads/unsorted/forms', [[
        'source_name' => $a['source_name'] ?? 'Сайт стоматологии',
        'source_uid' => $l['id'],
        'pipeline_id' => (int)$a['pipeline_id'],
        'created_at' => strtotime($l['at']),
        'metadata' => ['form_id' => $l['form'], 'form_name' => $label, 'form_page' => siteUrl($l['page']), 'ip' => $l['ip'], 'form_sent_at' => strtotime($l['at']), 'referer' => $l['src']['ref'] ?? ''],
        '_embedded' => ['leads' => [$leadBody], 'contacts' => [['name' => $name, 'custom_fields_values' => $phoneField]]],
      ]]);
      return (int)($r['_embedded']['unsorted'][0]['_embedded']['leads'][0]['id'] ?? 0);
    }
    // контакт с этим номером уже есть: новая сделка встаёт к нему, а не к дублю
    $cid = amoFindContact($l['phone']);
    $leadBody['_embedded']['contacts'] = [$cid ? ['id' => $cid] : ['name' => $name, 'custom_fields_values' => $phoneField]];
    $r = amo('POST', '/api/v4/leads/complex', [$leadBody]);
    return (int)($r[0]['id'] ?? 0);
  };
  try { $leadId = $send($cf); }
  catch (AmoError $e) { if ($e->getCode() !== 400 || !$cf) throw $e; $leadId = $send([]); }
  if (!$leadId) throw new RuntimeException('amoCRM не вернул номер сделки');
  // примечание: всё, что человек указал, и откуда пришёл. Ошибка примечания не повод создавать сделку ещё раз
  try { amo('POST', "/api/v4/leads/$leadId/notes", [['note_type' => 'common', 'params' => ['text' => amoNote($l)]]]); } catch (Throwable $e) {}
  return $leadId;
}

function amoFindContact(string $phone): int {
  $r = amo('GET', '/api/v4/contacts?limit=10&query=' . substr($phone, 1));
  foreach ($r['_embedded']['contacts'] ?? [] as $c)
    foreach ($c['custom_fields_values'] ?? [] as $f)
      if (($f['field_code'] ?? '') === 'PHONE')
        foreach ($f['values'] as $v) if (substr(preg_replace('/\D/', '', (string)$v['value']), -10) === substr($phone, 1)) return (int)$c['id'];
  return 0;
}

function amoFields(array $l): array {
  global $C;
  $out = [];
  // системные поля «Статистика» в amoCRM
  if ($C['amo']['utm_fields'] ?? true) {
    $codes = ['utm_source' => 'UTM_SOURCE', 'utm_medium' => 'UTM_MEDIUM', 'utm_campaign' => 'UTM_CAMPAIGN', 'utm_content' => 'UTM_CONTENT',
      'utm_term' => 'UTM_TERM', 'yclid' => 'YCLID', 'gclid' => 'GCLID', 'ym_uid' => '_YM_UID', 'roistat' => 'ROISTAT', 'ref' => 'REFERRER'];
    foreach ($codes as $k => $code) if (!empty($l['src'][$k])) $out[] = ['field_code' => $code, 'values' => [['value' => $l['src'][$k]]]];
  }
  // свои поля сделки по id из config.php: 'fields' => ['form' => 123, 'page' => 456, 'reason' => 789 …]
  $vals = ['form' => FORMS[$l['form']], 'page' => siteUrl($l['page'])] + $l['fields'];
  foreach ($C['amo']['fields'] ?? [] as $k => $fid) if ($fid && !empty($vals[$k])) $out[] = ['field_id' => (int)$fid, 'values' => [['value' => $vals[$k]]]];
  return $out;
}

function amoNote(array $l): string {
  $s = ['Заявка с сайта №' . $l['id'], 'Форма: ' . FORMS[$l['form']]];
  if ($l['name'] !== '') $s[] = 'Имя: ' . $l['name'];
  $s[] = 'Телефон: ' . fmtPhone($l['phone']);
  foreach ($l['fields'] as $k => $v) $s[] = FIELDS[$k][0] . ': ' . $v;
  if ($l['file']) $s[] = 'Снимок: ' . fileUrl($l['file']['name']) . ' (' . $l['file']['orig'] . ')';
  $s[] = 'Страница: ' . siteUrl($l['page']);
  $s[] = 'Источник: ' . srcLine($l);
  $utm = array_filter(array_intersect_key($l['src'], array_flip(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid'])));
  if ($utm) $s[] = 'Метки: ' . implode(', ', array_map(fn($k, $v) => "$k=$v", array_keys($utm), $utm));
  if (!empty($l['src']['ref'])) $s[] = 'Откуда пришёл: ' . $l['src']['ref'];
  if (!empty($l['src']['landing'])) $s[] = 'Первая страница визита: ' . siteUrl($l['src']['landing']);
  if ($l['consent']) $s[] = 'Согласие на обработку ПД: отмечено ' . date('d.m.Y H:i', strtotime($l['consent']['at']));
  return implode("\n", $s);
}

// ---------- Telegram ----------
function tgText(array $l): string {
  global $C;
  $full = !empty($C['telegram']['full']) || (!empty($C['telegram']['full_on_crm_fail']) && !$l['done']['amo']);
  $e = fn($s) => htmlspecialchars((string)$s, ENT_NOQUOTES);
  $s = ['🦷 <b>Новая заявка с сайта</b> №' . $e($l['id']), 'Форма: ' . $e(FORMS[$l['form']])];
  if ($l['name'] !== '') $s[] = 'Имя: ' . $e($l['name']);
  $s[] = 'Телефон: ' . ($full ? '<a href="tel:+' . $l['phone'] . '">' . fmtPhone($l['phone']) . '</a>' : maskPhone($l['phone']));
  foreach ($l['fields'] as $k => $v) if ($full || !FIELDS[$k][1]) $s[] = FIELDS[$k][0] . ': ' . $e($v);
  if ($l['file']) $s[] = 'Приложен снимок' . ($full ? '' : ' (в amoCRM)');
  $s[] = 'Страница: ' . $e($l['page'] ?: '/');
  $s[] = 'Источник: ' . $e(srcLine($l));
  if (!empty($C['amo']['token']) && !$l['done']['amo']) $s[] = "\n⚠️ <b>В amoCRM не попала</b>, повторим автоматически. Ошибка: " . $e(mb_substr($l['err']['amo'] ?? '', 0, 200));
  return implode("\n", $s);
}

function tgSend(string $text, ?int $amoId): void {
  global $C;
  $t = $C['telegram'];
  $body = ['chat_id' => $t['chat_id'], 'text' => $text, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
  if (!empty($t['thread_id'])) $body['message_thread_id'] = (int)$t['thread_id'];
  if ($amoId) $body['reply_markup'] = ['inline_keyboard' => [[['text' => 'Открыть сделку в amoCRM', 'url' => amoLink($amoId)]]]];
  [$code, $res] = http('POST', ($t['api'] ?? 'https://api.telegram.org') . '/bot' . $t['token'] . '/sendMessage', $body);
  if ($code !== 200) throw new RuntimeException("Telegram $code: " . mb_substr($res, 0, 300));
}

// ---------- Google Таблица (веб-приложение Apps Script, server/google-sheets.gs) ----------
function sheetSend(array $l): void {
  global $C;
  $full = !empty($C['sheets']['full']);
  $f = $l['fields'];
  $header = ['Дата', 'Номер заявки', 'Форма', 'Имя', 'Телефон', 'Что беспокоит / услуга', 'Врач', 'Акция', 'Страница',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'Откуда пришёл', 'Сделка amoCRM'];
  $row = [date('d.m.Y H:i', strtotime($l['at'])), $l['id'], FORMS[$l['form']], $l['name'],
    $full ? fmtPhone($l['phone']) : maskPhone($l['phone']),
    $full ? implode('; ', array_filter([$f['reason'] ?? '', $f['service'] ?? '', $f['jaws'] ?? '', $f['denture'] ?? ''])) : '',
    $f['doctor'] ?? '', $f['promo'] ?? '', siteUrl($l['page'])];
  foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'ref'] as $k) $row[] = $l['src'][$k] ?? '';
  $row[] = $l['amo'] ? amoLink($l['amo']) : (!empty($C['amo']['token']) ? 'не попала, повторяем' : '');
  [$code, $res] = http('POST', $C['sheets']['url'], ['secret' => $C['sheets']['secret'], 'sheet' => $C['sheets']['sheet'] ?? 'Заявки', 'header' => $header, 'row' => $row]);
  $j = json_decode($res, true);
  if ($code !== 200 || empty($j['ok'])) throw new RuntimeException("Таблица $code: " . mb_substr($res, 0, 300));
}

// ---------- почта (по желанию клиники, выключена, пока в config.php пустой mail.to) ----------
// Письмо уходит через SMTP ящика на домене (mail.smtp, у Джино smtp.jino.ru), без него функцией mail() хостинга.
// Отправитель mail.from должен быть ящиком на домене сайта, иначе письмо попадёт в спам
function mailSend(array $l): void {
  global $C;
  $m = $C['mail'];
  $full = !empty($m['full']);
  $s = ['Заявка с сайта №' . $l['id'], 'Форма: ' . FORMS[$l['form']]];
  if ($l['name'] !== '') $s[] = 'Имя: ' . $l['name'];
  $s[] = 'Телефон: ' . ($full ? fmtPhone($l['phone']) : maskPhone($l['phone']));
  foreach ($l['fields'] as $k => $v) if ($full || !FIELDS[$k][1]) $s[] = FIELDS[$k][0] . ': ' . $v;
  if ($l['file']) $s[] = $full ? 'Снимок: ' . fileUrl($l['file']['name']) : 'Приложен снимок (в amoCRM)';
  $s[] = 'Страница: ' . siteUrl($l['page']);
  $s[] = 'Источник: ' . srcLine($l);
  if ($l['amo']) $s[] = "\nСделка в amoCRM: " . amoLink($l['amo']);
  elseif (!empty($C['amo']['token'])) $s[] = "\nВ amoCRM пока не попала, повторим автоматически.";
  $to = implode(', ', (array)$m['to']);
  $subj = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . FORMS[$l['form']] . ' №' . $l['id']) . '?=';
  $from = (string)($m['from'] ?? '');
  $headers = ['MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'];
  if ($from !== '') $headers[] = 'From: =?UTF-8?B?' . base64_encode((string)($m['from_name'] ?? 'Сайт стоматологии')) . "?= <$from>";
  $body = chunk_split(base64_encode(implode("\n", $s)));
  if (!empty($m['smtp']['host'])) { smtpSend($m['smtp'], $from, (array)$m['to'], array_merge(["To: $to", "Subject: $subj", 'Date: ' . date('r')], $headers), $body); return; }
  $ok = mail($to, $subj, $body, implode("\r\n", $headers), $from !== '' ? '-f' . $from : '');
  if (!$ok) throw new RuntimeException('почта: mail() не отправил письмо');
}

// SMTP с SSL (порт 465) или STARTTLS (587), вход AUTH LOGIN; secure => 'none' только для проверки на своём компьютере
function smtpSend(array $o, string $from, array $to, array $headers, string $body): void {
  $port = (int)($o['port'] ?? 465);
  $sec = $o['secure'] ?? ($port === 465 ? 'ssl' : 'tls');
  $h = @stream_socket_client(($sec === 'ssl' ? 'ssl://' : 'tcp://') . $o['host'] . ":$port", $en, $es, 10);
  if (!$h) throw new RuntimeException("почта: нет связи с {$o['host']}: $es");
  stream_set_timeout($h, 15);
  $read = function (int $want) use ($h): string {
    $r = '';
    while (($line = fgets($h, 515)) !== false) { $r .= $line; if (strlen($line) < 4 || $line[3] === ' ') break; }
    if ((int)substr($r, 0, 3) !== $want) throw new RuntimeException('почта: ' . trim($r));
    return $r;
  };
  $cmd = function (string $c, int $want) use ($h, $read): string { fwrite($h, "$c\r\n"); return $read($want); };
  try {
    $read(220);
    $cmd('EHLO ' . (gethostname() ?: 'localhost'), 250);
    if ($sec === 'tls') {
      $cmd('STARTTLS', 220);
      if (!stream_socket_enable_crypto($h, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('почта: STARTTLS не включился');
      $cmd('EHLO ' . (gethostname() ?: 'localhost'), 250);
    }
    $cmd('AUTH LOGIN', 334); $cmd(base64_encode((string)$o['user']), 334); $cmd(base64_encode((string)$o['pass']), 235);
    $cmd("MAIL FROM:<$from>", 250);
    foreach ($to as $rcpt) $cmd('RCPT TO:<' . trim($rcpt) . '>', 250);
    $cmd('DATA', 354);
    $cmd(implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", rtrim($body)) . "\r\n.", 250);
    fwrite($h, "QUIT\r\n");
  } finally { fclose($h); }
}

// ---------- снимки ----------
function saveFile(array $f, string $id): ?array {
  global $C;
  $max = (int)($C['file_max_mb'] ?? 20);
  if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE || $f['size'] > $max * 1048576)
    fail(413, "Файл больше $max МБ. Пришлите снимок в Telegram или MAX.");
  if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail(400, 'Файл не загрузился. Попробуйте ещё раз или пришлите его в Telegram.');
  $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
  if (!in_array($ext, FILE_EXT, true)) fail(415, 'Подойдёт фото, PDF, ZIP или DICOM.');
  $name = $id . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
  if (!move_uploaded_file($f['tmp_name'], "{$C['data_dir']}/files/$name")) fail(500, 'Файл не сохранился. Пришлите его в Telegram или MAX.');
  return ['name' => $name, 'orig' => mb_substr(basename((string)$f['name']), 0, 120), 'size' => (int)$f['size']];
}

function fileUrl(string $name): string {
  global $C;
  return siteUrl('/lead.php?file=' . rawurlencode($name) . '&k=' . hash_hmac('sha256', $name, (string)$C['file_key']));
}

function serveFile(string $name, string $k): never {
  global $C;
  $path = "{$C['data_dir']}/files/" . basename($name);
  if ($name !== basename($name) || !hash_equals(hash_hmac('sha256', $name, (string)$C['file_key']), $k) || !is_file($path)) fail(404, 'Файл не найден или срок хранения истёк');
  header('Content-Type: application/octet-stream');
  header('Content-Disposition: attachment; filename="' . $name . '"');
  header('Content-Length: ' . filesize($path));
  header('Cache-Control: private, no-store');
  header('X-Robots-Tag: noindex');
  readfile($path);
  exit;
}

// ---------- мелочи ----------
function http(string $method, string $url, ?array $body = null, array $headers = []): array {
  $ch = curl_init($url);
  // POST без CUSTOMREQUEST: Apps Script отвечает переадресацией, и по ней нужно идти GET-запросом
  $opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 12,
    CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers)];
  if ($method === 'POST') $opt[CURLOPT_POST] = true; elseif ($method !== 'GET') $opt[CURLOPT_CUSTOMREQUEST] = $method;
  if ($body !== null) {
    $opt[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $opt[CURLOPT_HTTPHEADER][] = 'Content-Type: application/json';
  }
  curl_setopt_array($ch, $opt);
  $res = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($res === false) throw new RuntimeException('нет связи: ' . $err);
  return [$code, (string)$res];
}

function saveLead(array $l): void {
  global $C;
  $dir = "{$C['data_dir']}/leads/" . substr($l['id'], 0, 4);
  if (!is_dir($dir)) mkdir($dir, 0700, true);
  file_put_contents("$dir/{$l['id']}.json", json_encode($l, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function rateOk(string $ip): bool {
  global $C;
  $f = "{$C['data_dir']}/rate/ip-" . sha1($ip);
  $now = time();
  $hits = array_filter(is_file($f) ? (array)json_decode((string)file_get_contents($f), true) : [], fn($t) => $now - $t < 600);
  if (count($hits) >= (int)($C['rate_per_10min'] ?? 6)) return false;
  $hits[] = $now;
  file_put_contents($f, json_encode(array_values($hits)), LOCK_EX);
  return true;
}

// 8 916 123-45-67, +7 (916) 123-45-67, 9161234567 → 79161234567
function normPhone(string $s): ?string {
  $d = preg_replace('/\D/', '', $s);
  if (strlen($d) === 10) $d = '7' . $d;
  if (strlen($d) === 11 && $d[0] === '8') $d = '7' . substr($d, 1);
  return preg_match('/^7[3-9]\d{9}$/', $d) ? $d : null;
}
function fmtPhone(string $d): string { return '+7 ' . substr($d, 1, 3) . ' ' . substr($d, 4, 3) . '-' . substr($d, 7, 2) . '-' . substr($d, 9, 2); }
function maskPhone(string $d): string { return '+7 ' . $d[1] . '** ***-' . substr($d, 7, 2) . '-' . substr($d, 9, 2); }

function srcLine(array $l): string {
  $s = $l['src'];
  if (!empty($s['utm_source'])) return implode(' / ', array_filter([$s['utm_source'], $s['utm_medium'] ?? '', $s['utm_campaign'] ?? '']));
  if (!empty($s['yclid'])) return 'Яндекс Директ (yclid)';
  if (!empty($s['ref'])) return (string)(parse_url($s['ref'], PHP_URL_HOST) ?: $s['ref']);
  return 'прямой заход';
}

function siteUrl(string $path): string {
  global $C;
  if (preg_match('~^https?://~', $path)) return $path;
  return rtrim((string)$C['site_url'], '/') . '/' . ltrim($path, '/');
}
function amoLink(int $id): string { global $C; return "https://{$C['amo']['subdomain']}.amocrm.ru/leads/detail/$id"; }
function originList(): array {
  global $C;
  $site = parse_url((string)$C['site_url']);
  $list = array_map(fn($o) => rtrim($o, '/'), $C['origins'] ?? []);
  if (!empty($site['host'])) {
    $port = isset($site['port']) ? ':' . $site['port'] : '';
    $bare = preg_replace('/^www\./', '', $site['host']);
    foreach ([$bare, "www.$bare"] as $h) $list[] = ($site['scheme'] ?? 'https') . "://$h$port";
  }
  return $list;
}

// ответ: JSON для скрипта сайта, переход на «Спасибо» для формы без скриптов. $end = false: ответ ушёл, скрипт работает дальше
function done(array $r, bool $end = true): void {
  global $json;
  ignore_user_abort(true);
  header('Cache-Control: no-store');
  if ($json) { header('Content-Type: application/json; charset=utf-8'); echo json_encode($r, JSON_UNESCAPED_UNICODE); }
  else { header('Location: /spasibo/', true, 303); }
  if ($end) exit;
  if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
  else { header('Connection: close'); while (ob_get_level()) ob_end_flush(); flush(); }
}

function fail(int $code, string $msg): never {
  global $json;
  http_response_code($code);
  header('Cache-Control: no-store');
  if ($json ?? false) { header('Content-Type: application/json; charset=utf-8'); echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE); exit; }
  header('Content-Type: text/html; charset=utf-8');
  $m = htmlspecialchars($msg);
  echo "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><meta name=robots content=noindex><title>Заявка не отправлена</title>"
    . "<body style='font:18px/1.5 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 16px'><h1 style='font-size:26px'>Заявка не отправлена</h1><p>$m</p>"
    . "<p>Позвоните нам: <a href='tel:+74951503615'>+7 495 150-36-15</a>, ежедневно с 9:00 до 21:00.</p><p><a href='javascript:history.back()'>Вернуться к форме</a></p>";
  exit;
}
