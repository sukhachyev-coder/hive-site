/* ============================================================
   HIVE — ВЫБОР НЕСКОЛЬКИХ РЕШЕНИЙ («Ваш комплект»)
   + ИНТЕРАКТИВНЫЙ КОНФИГУРАТОР СКИДОК (этап 3)
   ------------------------------------------------------------
   Архитектура:

     selectedModules  — единый массив выбранных модулей.
                        Каждый элемент: { id, name, price }

     toggleModuleSelection(cell) — клик по карточке:
                        добавляет модуль в массив, если его там нет,
                        и удаляет, если он уже выбран (повторный клик
                        снимает выбор). Не использует HTML checkbox —
                        состояние хранится только в JS + CSS-классе
                        .is-selected на самой карточке.

     getTierForCount(n) — единственное место, где живёт таблица
                        скидок за объём комплекта:
                          1 модуль    — без скидки
                          2–3 модуля  — 5%
                          4–5 модулей — 10%
                          6–7 модулей — 15%
                          8+ модулей  — индивидуальные условия
                        Меняется тариф — меняется только эта функция,
                        весь остальной код пересчитывается от неё.

     renderKitPanel() — синхронизирует нижнюю панель "Ваш комплект"
                        (счётчик, текущая скидка, сумма, прогресс
                        по уровням) с selectedModules.

     updateCardPricing() — обновляет цену/бейдж на КАЖДОЙ карточке
                        модуля (и выбранной, и невыбранной):
                          - выбранная карточка показывает цену по
                            уже действующей скидке комплекта;
                          - невыбранная карточка показывает
                            "предпросмотр" — сколько будет стоить
                            комплект, если добавить именно её
                            (скидка на один шаг выше текущей),
                            чтобы было видно, что дальше выгоднее.

     handleGetOfferClick() — обработчик кнопки "Получить
                        индивидуальную конфигурацию" в панели
                        комплекта. Переиспользует существующую
                        форму лида (hiveOpenForm/hiveSubmitForm из
                        hive-lead-capture.js), передавая туда состав
                        комплекта, скидку и итоговую сумму.

   Ничего из существующего функционала сайта (hiveOpenForm,
   hiveSubmitForm, hiveTrackView, cookies.js и т.д.) не изменяется —
   этот файл только добавляет новую независимую логику.
   ============================================================ */

/* Единый источник правды о выбранных решениях.
   Хранится в оперативной памяти страницы (без localStorage —
   в артефактах и в некоторых средах он недоступен, а для
   архитектуры "на будущее" это и не требуется). */
let selectedModules = [];

/* Таблица уровней скидки за объём комплекта. Единственное место,
   которое нужно поменять, если тарифная сетка изменится. */
const DISCOUNT_TIERS = [
  { min: 1, max: 1, pct: 0,   label: '1 модуль' },
  { min: 2, max: 3, pct: 5,   label: '2–3 модуля' },
  { min: 4, max: 5, pct: 10,  label: '4–5 модулей' },
  { min: 6, max: 7, pct: 15,  label: '6–7 модулей' },
  { min: 8, max: Infinity, pct: null, label: '8+ модулей', individual: true }
];

document.addEventListener('DOMContentLoaded', function () {
  initSolutionSelectors();
  updateCardPricing(); // начальное состояние — без выбора, без скидок
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
 * визуальное состояние конкретной карточки, панель комплекта и
 * цены/бейджи на всех карточках (скидка зависит от общего числа
 * выбранных модулей, поэтому пересчёт затрагивает всю сетку).
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
  updateCardPricing();
}

/**
 * Возвращает тариф скидки для заданного количества модулей в
 * комплекте. Единственная точка, где меняется тарифная сетка.
 * @param {number} n
 * @returns {{min:number,max:number,pct:(number|null),label:string,individual?:boolean}|null}
 */
function getTierForCount(n) {
  if (n <= 0) return null;
  return DISCOUNT_TIERS.find(function (t) { return n >= t.min && n <= t.max; })
    || DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];
}

/**
 * Считает количество, текущий тариф скидки и итоговую стоимость
 * выбранного комплекта (скидка применяется ко всей сумме комплекта
 * по уровню, соответствующему числу выбранных модулей).
 * @returns {{count:number, rawTotal:number, tier:(object|null), total:number}}
 */
function getKitSummary() {
  const count = selectedModules.length;
  const rawTotal = selectedModules.reduce(function (sum, m) {
    return sum + m.price;
  }, 0);
  const tier = getTierForCount(count);
  const pct = (tier && !tier.individual) ? tier.pct : 0;
  const total = Math.round(rawTotal * (1 - pct / 100));

  return { count: count, rawTotal: rawTotal, tier: tier, total: total };
}

/**
 * Обновляет панель "Ваш комплект": показывает её, если выбран
 * хотя бы один модуль, и скрывает, если массив пуст. Обновляет
 * счётчик, текущую скидку, сумму и прогресс по уровням скидки.
 */
function renderKitPanel() {
  const panel = document.getElementById('hive-kit-panel');
  const countEl = document.getElementById('hive-kit-count');
  const discountEl = document.getElementById('hive-kit-discount');
  const totalEl = document.getElementById('hive-kit-total');
  const tiersEl = document.getElementById('hive-kit-tiers');

  if (!panel || !countEl || !totalEl) return;

  const summary = getKitSummary();

  if (summary.count === 0) {
    panel.classList.remove('is-visible');
    document.body.classList.remove('has-kit-panel');
    return;
  }

  countEl.textContent = formatModulesCount(summary.count);

  if (discountEl) {
    if (summary.tier && summary.tier.individual) {
      discountEl.textContent = 'индивидуальные условия';
    } else if (summary.tier && summary.tier.pct > 0) {
      discountEl.textContent = 'скидка ' + summary.tier.pct + '%';
    } else {
      discountEl.textContent = '';
    }
  }

  totalEl.textContent = formatPrice(summary.total);

  if (tiersEl) {
    renderTierProgress(tiersEl, summary.count);
  }

  panel.classList.add('is-visible');
  document.body.classList.add('has-kit-panel');
}

/**
 * Рисует компактный прогресс-индикатор уровней скидки — по одному
 * сегменту на каждый тариф из DISCOUNT_TIERS, подсвечивая тот,
 * который действует при текущем количестве выбранных модулей.
 * @param {HTMLElement} el
 * @param {number} count
 */
function renderTierProgress(el, count) {
  const activeTier = getTierForCount(count);
  el.innerHTML = DISCOUNT_TIERS.map(function (t) {
    const isActive = activeTier === t;
    const cls = 'tier-dot' + (isActive ? ' is-active' : '') + (t.individual ? ' is-individual' : '');
    return '<span class="' + cls + '" title="' + t.label + (t.individual ? '' : (': -' + t.pct + '%')) + '"></span>';
  }).join('');
}

/**
 * Обновляет цену и бейдж скидки на КАЖДОЙ карточке модуля:
 *   - если ничего не выбрано — обычная цена, без бейджа;
 *   - выбранная карточка — цена по текущему действующему тарифу
 *     (посчитанному от общего числа выбранных модулей);
 *   - невыбранная карточка — "предпросмотр": сколько будет стоить
 *     комплект, если добавить именно этот модуль (тариф на один
 *     модуль выше текущего) — так видно, что дальше выгоднее.
 */
function updateCardPricing() {
  const cells = document.querySelectorAll('.hive-grid .cell[data-solution-id]');
  if (!cells.length) return;

  const count = selectedModules.length;
  const currentTier = getTierForCount(count);
  const previewTier = getTierForCount(count + 1);

  cells.forEach(function (cell) {
    const id = cell.dataset.solutionId;
    const price = parseFloat(cell.dataset.price) || 0;
    const isSelected = selectedModules.some(function (m) { return m.id === id; });

    const priceEl = cell.querySelector('.cell-price');
    const oldEl = cell.querySelector('.cell-price-old');
    const badgeEl = cell.querySelector('.cell-badge');
    if (!priceEl || !oldEl || !badgeEl) return;

    // Ничего не выбрано вовсе — исходное состояние, без скидок
    if (count === 0) {
      priceEl.textContent = formatPrice(price);
      priceEl.classList.remove('is-preview');
      oldEl.classList.remove('is-shown');
      badgeEl.classList.remove('is-shown', 'is-individual');
      return;
    }

    const tier = isSelected ? currentTier : previewTier;

    if (tier && tier.individual) {
      // 8+ модулей — индивидуальные условия, конкретную скидку
      // в процентах не считаем, только помечаем бейджем
      priceEl.textContent = formatPrice(price);
      priceEl.classList.toggle('is-preview', !isSelected);
      oldEl.classList.remove('is-shown');
      badgeEl.textContent = 'Индивидуально';
      badgeEl.classList.add('is-shown', 'is-individual');
      return;
    }

    const pct = tier ? tier.pct : 0;

    if (pct > 0) {
      const discounted = Math.round(price * (1 - pct / 100));
      oldEl.textContent = formatPrice(price);
      oldEl.classList.add('is-shown');
      priceEl.textContent = formatPrice(discounted);
      priceEl.classList.toggle('is-preview', !isSelected);
      badgeEl.textContent = '−' + pct + '%';
      badgeEl.classList.add('is-shown');
      badgeEl.classList.remove('is-individual');
    } else {
      // Тариф без скидки (сейчас выбран только 1 модуль и это он) —
      // обычная цена без зачёркивания и бейджа
      priceEl.textContent = formatPrice(price);
      priceEl.classList.remove('is-preview');
      oldEl.classList.remove('is-shown');
      badgeEl.classList.remove('is-shown', 'is-individual');
    }
  });
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
 * Обработчик кнопки "Получить индивидуальную конфигурацию" в
 * панели комплекта. Переиспользует уже существующую на сайте
 * форму лида (модальное окно + hiveOpenForm/hiveSubmitForm из
 * hive-lead-capture.js) — передаём в неё состав комплекта, тариф
 * скидки и итоговую сумму, ничего не отправляя напрямую отсюда.
 */
function handleGetOfferClick() {
  const summary = getKitSummary();
  const namesList = selectedModules.map(function (m) {
    return m.name;
  }).join(', ');

  const composedTitle = 'Комплект (' + summary.count + '): ' + namesList;
  const discountNote = (summary.tier && summary.tier.individual)
    ? 'индивидуальные условия'
    : (summary.tier && summary.tier.pct > 0 ? 'скидка ' + summary.tier.pct + '%' : 'без скидки');

  // hiveOpenForm уже существует в hive-lead-capture.js —
  // используем его как есть, не меняя эту функцию
  if (typeof hiveOpenForm === 'function') {
    hiveOpenForm(composedTitle, 'kit');

    const modalTitle = document.getElementById('hive-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Получить индивидуальную конфигурацию';
    }

    const commentField = document.getElementById('hive-comment');
    if (commentField && !commentField.value) {
      commentField.value =
        'Интересует комплект: ' + namesList +
        ' (' + discountNote + ')' +
        '. Ориентировочная сумма: ' + formatPrice(summary.total);
    }
  }
}
