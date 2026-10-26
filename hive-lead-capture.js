/* ===== HIVE LEAD CAPTURE — общий блок для всех страниц модулей =====
   Вставляется на каждую страницу модуля.
   Требует переменную MODULE_NAME, заданную перед подключением.
*/

// !!! ЗАМЕНИ НА СВОЙ URL ПОСЛЕ РАЗВЁРТЫВАНИЯ APPS SCRIPT !!!
const HIVE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyUzaUY1_ubysZg3-pzLWnenvrSYITD2nFG4N3DbSKhbIJqnLmLCxBTOdTPg2AZwy6Z9g/exec';

// !!! ЗАМЕНИТЕ НА РЕАЛЬНЫЙ НОМЕР ТЕЛЕФОНА В ФОРМАТЕ +7XXXXXXXXXX !!!
// Пока номер не настроен — мобильная ссылка tel: не используется (см. hiveIsConfiguredPhone).
const HIVE_PHONE_NUMBER = '+79117184551';

function hiveSend(payload) {
  fetch(HIVE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors', // Apps Script Web App не отдаёт CORS-заголовки, no-cors позволяет отправить без ошибки
    headers: {'Content-Type': 'text/plain;charset=utf-8'},
    body: JSON.stringify(payload)
  }).catch(()=>{}); // тихо игнорируем сетевые ошибки, чтобы не мешать UX
}

function hiveTrackView(moduleName) {
  hiveSend({
    type: 'view',
    module: moduleName,
    referrer: document.referrer || 'прямой заход',
    userAgent: navigator.userAgent
  });
}

function hiveOpenForm(moduleName, intent) {
  const titles = {
    question: 'Обсудить задачи бизнеса: «' + moduleName + '»',
    consult: 'Записаться на бесплатную консультацию',
    callback: 'Связаться со мной'
  };
  document.getElementById('hive-modal-title').textContent =
    titles[intent] || ('Получить решение «' + moduleName + '» для своей компании');
  document.getElementById('hive-modal-intent').value = intent;
  document.getElementById('hive-modal-module').value = moduleName;
  document.getElementById('hive-modal-overlay').classList.add('is-open');
  document.getElementById('hive-name').focus();
}

function hiveCloseForm() {
  document.getElementById('hive-modal-overlay').classList.remove('is-open');
  document.getElementById('hive-form-success').style.display = 'none';
  document.getElementById('hive-form-fields').style.display = 'block';
  document.getElementById('hive-name').value = '';
  document.getElementById('hive-contact').value = '';
  document.getElementById('hive-comment').value = '';
  const consent = document.getElementById('hive-consent');
  if (consent) consent.checked = false;
}

function hiveSubmitForm(ev) {
  ev.preventDefault();
  const name = document.getElementById('hive-name').value.trim();
  const contact = document.getElementById('hive-contact').value.trim();
  if (!contact) return;
  const comment = document.getElementById('hive-comment').value.trim();
  const moduleName = document.getElementById('hive-modal-module').value;
  const intent = document.getElementById('hive-modal-intent').value;

  const intentLabels = { question: ' (вопрос)', consult: ' (консультация)', kit: ' (комплект)', callback: ' (заявка на обратную связь)' };
  const payload = {
    type: 'lead',
    module: moduleName + (intentLabels[intent] || ' (запуск)'),
    name: name,
    contact: contact,
    comment: comment,
    referrer: document.referrer || 'прямой заход'
  };
  if (intent === 'callback') {
    payload.intent = 'callback';
    payload.lead_type = 'Заявка на обратную связь';
  }
  hiveSend(payload);

  document.getElementById('hive-form-fields').style.display = 'none';
  document.getElementById('hive-form-success').style.display = 'block';
}

/* ===== КНОПКА «ПОЗВОНИТЬ» (шапка) ===== */

function hiveIsMobileDevice() {
  return window.matchMedia('(max-width: 768px)').matches ||
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function hiveIsConfiguredPhone() {
  return /^\+?[0-9][0-9\s\-()]{9,}$/.test(HIVE_PHONE_NUMBER) &&
    !/[Xx]/.test(HIVE_PHONE_NUMBER) &&
    !/REPLACE/i.test(HIVE_PHONE_NUMBER);
}

function hiveNormalizePhone() {
  return String(HIVE_PHONE_NUMBER).replace(/[^\d+]/g, '');
}

function hiveSetPhoneOpen(open) {
  const popover = document.getElementById('hive-phone-popover');
  const btn = document.getElementById('hive-phone-btn');
  if (!popover) return;
  if (open) {
    popover.hidden = false;
    popover.classList.add('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    popover.hidden = true;
    popover.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

function hiveTogglePhone() {
  const popover = document.getElementById('hive-phone-popover');
  const willOpen = !popover || popover.hidden;

  // Учёт нажатия: одно событие на одно нажатие кнопки.
  hiveSend({
    type: 'contact_click',
    channel: 'phone',
    action: 'call_click',
    module: 'Главная страница',
    referrer: document.referrer || 'прямой заход'
  });

  const mobile = hiveIsMobileDevice();

  // На мобильных с настроенным номером — сразу открываем номеронабиратель.
  if (mobile && hiveIsConfiguredPhone() && willOpen) {
    window.location.href = 'tel:' + hiveNormalizePhone();
    return;
  }

  // Иначе (десктоп или номер не настроен) — раскрываем номер рядом с кнопкой.
  const numEl = document.getElementById('hive-phone-number');
  if (numEl) numEl.textContent = HIVE_PHONE_NUMBER;
  if (popover) {
    if (willOpen) hiveSetPhoneOpen(true);
    else hiveSetPhoneOpen(false);
  }
}

function hiveCopyPhone() {
  const text = HIVE_PHONE_NUMBER;
  const btn = document.getElementById('hive-phone-copy');
  const done = function () {
    if (btn) {
      const old = btn.textContent;
      btn.textContent = 'Скопировано';
      setTimeout(function () { btn.textContent = old; }, 1500);
    }
  };
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).then(done).catch(function () { hiveCopyPhoneFallback(text, done); });
  } else {
    hiveCopyPhoneFallback(text, done);
  }
}

function hiveCopyPhoneFallback(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch (e) {}
}

// Закрытие раскрытого номера кликом вне блока или по Esc.
document.addEventListener('click', function (e) {
  const wrap = document.getElementById('hive-phone-wrap');
  const popover = document.getElementById('hive-phone-popover');
  if (!wrap || !popover || popover.hidden) return;
  if (!wrap.contains(e.target)) hiveSetPhoneOpen(false);
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const popover = document.getElementById('hive-phone-popover');
    if (popover && !popover.hidden) hiveSetPhoneOpen(false);
  }
});

