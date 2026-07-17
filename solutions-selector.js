/* ============================================================
   HIVE — ВЫБОР НЕСКОЛЬКИХ РЕШЕНИЙ («Ваш комплект»)
   ------------------------------------------------------------
   Архитектура (по ТЗ, этапы 1–3):

     selectedModules  — единый массив выбранных модулей.
                        Каждый элемент: { id, name, price }

     toggleModuleSelection(cell) — клик по карточке:
                        добавляет модуль в массив, если его там нет,
                        и удаляет, если он уже выбран (повторный клик
                        снимает выбор). Не использует HTML checkbox —
                        состояние хранится только в JS + CSS-классе
                        .is-selected на самой карточке.

     renderKitPanel() — синхронизирует нижнюю панель "Ваш комплект"
                        с текущим содержимым selectedModules:
                        показывает/скрывает панель, обновляет
                        счётчик и сумму.

     getKitSummary()  — считает количество и итоговую стоимость.
                        Это единственное место, где считается сумма,
                        поэтому именно сюда в будущем можно будет
                        добавить логику скидок за комплект, не трогая
                        остальной код (см. комментарий внутри функции).

     handleGetOfferClick() — обработчик кнопки "Получить предложение".
                        Пока НЕ отправляет данные самостоятельно —
                        переиспользует уже существующую на сайте форму
                        лида (hiveOpenForm / hiveSubmitForm из
                        hive-lead-capture.js), просто передавая туда
                        сводку по комплекту. Пункт "отправка данных"
                        по ТЗ пока не реализуется отдельно.

   Ничего из существующего функционала сайта (hiveOpenForm,
   hiveSubmitForm, hiveTrackView, cookies.js и т.д.) не изменяется —
   этот файл только добавляет новую независимую логику.
   ============================================================ */

/* Единый источник правды о выбранных решениях.
   Хранится в оперативной памяти страницы (без localStorage —
   в артефактах и в некоторых средах он недоступен, а для
   архитектуры "на будущее" это и не требуется). */
let selectedModules = [];

document.addEventListener('DOMContentLoaded', function () {
  initSolutionSelectors();
});

/**
 * Находит все карточки решений на странице и вешает на них
 * обработчики выбора (клик мышью + клавиатура для доступности,
 * т.к. вместо чекбокса используется role="button").
 */
function initSolutionSelectors() {
  const cells = document.querySelectorAll('.hive-grid .cell[data-solution-id]');

  cells.forEach(function (cell) {
    // Клик по любой части карточки — выбор / снятие выбора
    cell.addEventListener('click', function () {
      toggleModuleSelection(cell);
    });

    // Доступность: Enter и Space работают как клик,
    // т.к. карточка ведёт себя как переключатель (role="button")
    cell.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleModuleSelection(cell);
      }
    });
  });
}

/**
 * Добавляет или убирает модуль из selectedModules и обновляет
 * визуальное состояние конкретной карточки.
 * @param {HTMLElement} cell — карточка решения (.cell[data-solution-id])
 */
function toggleModuleSelection(cell) {
  const id = cell.dataset.solutionId;
  const name = cell.dataset.name;
  const price = parseFloat(cell.dataset.price) || 0;

  const existingIndex = selectedModules.findIndex(function (m) {
    return m.id === id;
  });

  if (existingIndex > -1) {
    // модуль уже был выбран — повторный клик снимает выбор
    selectedModules.splice(existingIndex, 1);
    cell.classList.remove('is-selected');
    cell.setAttribute('aria-pressed', 'false');
  } else {
    // модуль ещё не выбран — добавляем в комплект
    selectedModules.push({ id: id, name: name, price: price });
    cell.classList.add('is-selected');
    cell.setAttribute('aria-pressed', 'true');
  }

  renderKitPanel();
}

/**
 * Считает количество выбранных модулей и итоговую стоимость.
 *
 * ТОЧКА РАСШИРЕНИЯ НА БУДУЩЕЕ: сюда позже можно добавить, например,
 * скидку за комплект (если count >= 2, применить коэффициент) или
 * логику рекомендаций — не меняя остальной код, т.к. вся сумма
 * панели берётся именно отсюда.
 *
 * @returns {{count: number, total: number}}
 */
function getKitSummary() {
  const count = selectedModules.length;
  const total = selectedModules.reduce(function (sum, m) {
    return sum + m.price;
  }, 0);

  // TODO (будущий этап): применить скидку за комплект, например:
  // const total = applyBundleDiscount(rawTotal, count);

  return { count: count, total: total };
}

/**
 * Обновляет панель "Ваш комплект": показывает её, если выбран
 * хотя бы один модуль, и скрывает, если массив пуст. Также
 * обновляет счётчик и сумму внутри панели.
 */
function renderKitPanel() {
  const panel = document.getElementById('hive-kit-panel');
  const countEl = document.getElementById('hive-kit-count');
  const totalEl = document.getElementById('hive-kit-total');

  if (!panel || !countEl || !totalEl) return;

  const summary = getKitSummary();

  if (summary.count === 0) {
    panel.classList.remove('is-visible');
    document.body.classList.remove('has-kit-panel');
    return;
  }

  countEl.textContent = formatModulesCount(summary.count);
  totalEl.textContent = formatPrice(summary.total);

  panel.classList.add('is-visible');
  document.body.classList.add('has-kit-panel');
}

/**
 * Форматирует число в рубли с разделителями разрядов: 138000 → "138 000 ₽"
 */
function formatPrice(value) {
  return value.toLocaleString('ru-RU') + ' ₽';
}

/**
 * Склоняет слово "решение" по правилам русского языка в зависимости
 * от количества: 1 решение / 2 решения / 5 решений и т.д.
 */
function formatModulesCount(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = 'решений';

  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = 'решение';
    else if (mod10 >= 2 && mod10 <= 4) word = 'решения';
  }

  return count + ' ' + word;
}

/**
 * Обработчик кнопки "Получить предложение" в панели комплекта.
 *
 * ВАЖНО: по ТЗ отправка данных пока не реализуется отдельно.
 * Здесь мы переиспользуем УЖЕ СУЩЕСТВУЮЩУЮ на сайте форму лида
 * (модальное окно + hiveOpenForm/hiveSubmitForm из
 * hive-lead-capture.js) — просто передаём в неё сводку по
 * выбранным модулям, чтобы кнопка не была "заглушкой", но и не
 * добавляем новую логику отправки.
 */
function handleGetOfferClick() {
  const summary = getKitSummary();
  const namesList = selectedModules.map(function (m) {
    return m.name;
  }).join(', ');

  const composedTitle = 'Комплект (' + summary.count + '): ' + namesList;

  // hiveOpenForm уже существует в hive-lead-capture.js —
  // используем его как есть, не меняя эту функцию
  if (typeof hiveOpenForm === 'function') {
    hiveOpenForm(composedTitle, 'kit');

    const modalTitle = document.getElementById('hive-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Получить предложение по комплекту';
    }

    const commentField = document.getElementById('hive-comment');
    if (commentField && !commentField.value) {
      commentField.value =
        'Интересует комплект: ' + namesList +
        '. Ориентировочная сумма: ' + formatPrice(summary.total);
    }
  }
}
