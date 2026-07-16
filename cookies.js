(function () {
  var STORAGE_KEY = 'hive_cookie_consent';
  if (localStorage.getItem(STORAGE_KEY) === 'accepted') return;

  var style = document.createElement('style');
  style.textContent = [
    '.hive-cookie-banner{',
    'position:fixed;left:0;right:0;bottom:0;z-index:1100;',
    'display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;',
    'padding:18px 24px;background:#232017;border-top:1px solid rgba(244,201,105,0.32);',
    'font-family:Inter,-apple-system,Segoe UI,sans-serif;',
    '}',
    '.hive-cookie-text{font-size:14px;color:#B8AF9C;line-height:1.5;max-width:720px;}',
    '.hive-cookie-text a{color:#F4C969;text-decoration:none;}',
    '.hive-cookie-text a:hover{text-decoration:underline;}',
    '.hive-cookie-accept{',
    'background:#F4C969;color:#241B05;border:none;padding:12px 24px;border-radius:9px;',
    'font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;',
    'transition:background 0.15s;',
    '}',
    '.hive-cookie-accept:hover{background:#FFD685;}',
    '@media (max-width:680px){.hive-cookie-banner{padding:16px;}.hive-cookie-accept{width:100%;}}'
  ].join('');
  document.head.appendChild(style);

  var banner = document.createElement('div');
  banner.className = 'hive-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Уведомление о cookie');
  banner.innerHTML =
    '<div class="hive-cookie-text">' +
      'Мы используем файлы cookie для корректной работы сайта и улучшения пользовательского опыта.' +
      '<br><a href="privacy.html">Политика обработки персональных данных</a>' +
    '</div>' +
    '<button type="button" class="hive-cookie-accept">Принять</button>';

  document.body.appendChild(banner);

  banner.querySelector('.hive-cookie-accept').addEventListener('click', function () {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    banner.remove();
    style.remove();
  });
})();
