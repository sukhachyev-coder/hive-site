/* ===== HIVE LEAD CAPTURE — общий блок для всех страниц модулей =====
   Вставляется на каждую страницу модуля.
   Требует переменную MODULE_NAME, заданную перед подключением.
*/

// !!! ЗАМЕНИ НА СВОЙ URL ПОСЛЕ РАЗВЁРТЫВАНИЯ APPS SCRIPT !!!
const HIVE_SCRIPT_URL = 'https://script.google.com/macros/s/ВАШ_ID_СКРИПТА/exec';

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
  document.getElementById('hive-modal-title').textContent = intent === 'question'
    ? 'Вопрос по модулю «' + moduleName + '»'
    : 'Запустить модуль «' + moduleName + '»';
  document.getElementById('hive-modal-intent').value = intent;
  document.getElementById('hive-modal-module').value = moduleName;
  document.getElementById('hive-modal-overlay').style.display = 'flex';
  document.getElementById('hive-name').focus();
}

function hiveCloseForm() {
  document.getElementById('hive-modal-overlay').style.display = 'none';
  document.getElementById('hive-form-success').style.display = 'none';
  document.getElementById('hive-form-fields').style.display = 'block';
  document.getElementById('hive-name').value = '';
  document.getElementById('hive-contact').value = '';
  document.getElementById('hive-comment').value = '';
}

function hiveSubmitForm(ev) {
  ev.preventDefault();
  const name = document.getElementById('hive-name').value.trim();
  const contact = document.getElementById('hive-contact').value.trim();
  if (!contact) return;
  const comment = document.getElementById('hive-comment').value.trim();
  const moduleName = document.getElementById('hive-modal-module').value;
  const intent = document.getElementById('hive-modal-intent').value;

  hiveSend({
    type: 'lead',
    module: moduleName + (intent === 'question' ? ' (вопрос)' : ' (запуск)'),
    name: name,
    contact: contact,
    comment: comment,
    referrer: document.referrer || 'прямой заход'
  });

  document.getElementById('hive-form-fields').style.display = 'none';
  document.getElementById('hive-form-success').style.display = 'block';
}
