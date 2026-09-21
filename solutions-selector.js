/* ============================================================
   HIVE — ВЫБОР НЕСКОЛЬКИХ РЕШЕНИЙ («Ваш комплект»)
   + ИНТЕРАКТИВНЫЙ КОНФИГУРАТОР СКИДОК
   ------------------------------------------------------------
   Архитектура:

     selectedModules  — единый массив выбранных модулей.
                        Каждый элемент: { id, name, price }

     product_catalog.json — источник цен и скидок.
                        Сайт НЕ хранит собственную тарифную сетку.
                        Каталог публикуется из HIVE Product Contract Matrix.

     toggleModuleSelection(cell) — клик по карточке:
                        добавляет модуль в массив, если его там нет,
                        и удаляет, если он уже выбран.

     getTierForCount(n) — возвращает тариф скидки,
                        загруженный из product_catalog.json.

     renderKitPanel() — синхронизирует нижнюю панель "Ваш комплект"
                        с selectedModules.

     updateCardPricing() — обновляет цену/бейдж на каждой карточке
                        с учётом текущего уровня скидки.

     handleGetOfferClick() — обработчик кнопки "Получить
                        индивидуальную конфигурацию" в панели
                        комплекта.

   Ничего из существующего функционала сайта
   (hiveOpenForm, hiveSubmitForm, hiveTrackView, cookies.js и т.д.)
   не изменяется.
   ============================================================ */


/* ============================================================
   СОСТОЯНИЕ
   ============================================================ */

/* Единый источник правды о выбранных решениях.
   Хранится только в оперативной памяти страницы. */
let selectedModules = [];


/* ============================================================
   PRODUCT CONTRACT MATRIX
   ============================================================ */

/*
   Цены и скидки НЕ задаются здесь вручную.

   Источник:
     ./product_catalog.json

   Файл является опубликованной копией канонического каталога HIVE.
   Канонический источник находится в HIVE backend.
*/

let DISCOUNT_TIERS = [];


/**
 * Загружает Product Contract Matrix с сайта
 * и переносит актуальные цены/названия в карточки.
 */
async function loadProductCatalog() {
  const response = await fetch('./product_catalog.json', {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(
      'Не удалось загрузить product_catalog.json. HTTP ' + response.status
    );
  }

  const catalog = await response.json();

  if (!Array.isArray(catalog.products)) {
    throw new Error(
      'Некорректный формат product_catalog.json: products'
    );
  }

  if (!Array.isArray(catalog.discounts)) {
    throw new Error(
      'Некорректный формат product_catalog.json: discounts'
    );
  }


  /* ----------------------------------------------------------
     Обновляем карточки продуктов
     ---------------------------------------------------------- */

  catalog.products.forEach(function (product) {
    const cell = document.querySelector(
      '.hive-grid .cell[data-solution-id="' + product.id + '"]'
    );

    if (!cell) {
      console.warn(
        'Product Contract Matrix: карточка не найдена:',
        product.id
      );
      return;
    }

    cell.dataset.name = product.name;
    cell.dataset.price = product.base_price;

    const priceEl = cell.querySelector('.cell-price');

    if (priceEl) {
      priceEl.textContent = formatPrice(product.base_price);
    }
  });


  /* ----------------------------------------------------------
     Формируем таблицу скидок из каталога
     ---------------------------------------------------------- */

  DISCOUNT_TIERS = [
    {
      min: 1,
      max: 1,
      pct: 0,
      label: '1 модуль'
    },

    ...catalog.discounts.map(function (discount) {
      return {
        min: discount.min_modules,

        max: discount.max_modules === null
          ? Infinity
          : discount.max_modules,

        pct: discount.individual
          ? null
          : discount.percent,

        label: discount.label,

        individual: Boolean(discount.individual)
      };
    })
  ];


  console.log(
    'Product Contract Matrix загружен:',
    catalog.version,
    '| продуктов:',
    catalog.products.length,
    '| уровней скидки:',
    catalog.discounts.length
  );
}


/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

/**
 * После загрузки DOM:
 *
 * 1. загружаем Product Contract Matrix;
 * 2. только после этого подключаем выбор карточек;
 * 3. пересчитываем отображение цен.
 *
 * Это важно: калькулятор никогда не должен работать
 * до загрузки актуального каталога.
 */
document.addEventListener('DOMContentLoaded', async function () {
  try {
    await loadProductCatalog();

    initSolutionSelectors();
    updateCardPricing();

  } catch (error) {
    console.error(
      'Ошибка загрузки Product Contract Matrix:',
      error
    );
  }
});


/**
 * Находит все карточки решений на странице и вешает на них
 * обработчики выбора:
 *
 * - клик мышью;
 * - Enter;
 * - Space.
 */
function initSolutionSelectors() {
  const cells = document.querySelectorAll(
    '.hive-grid .cell[data-solution-id]'
  );

  cells.forEach(function (cell) {

    /* Клик по карточке */
    cell.addEventListener('click', function () {
      toggleModuleSelection(cell);
    });


    /* Доступность с клавиатуры */
    cell.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleModuleSelection(cell);
      }
    });

  });
}


/* ============================================================
   ВЫБОР МОДУЛЯ
   ============================================================ */

/**
 * Добавляет или убирает модуль из selectedModules.
 *
 * @param {HTMLElement} cell
 */
function toggleModuleSelection(cell) {

  const id = cell.dataset.solutionId;
  const name = cell.dataset.name;
  const price = parseFloat(cell.dataset.price) || 0;


  const existingIndex = selectedModules.findIndex(function (m) {
    return m.id === id;
  });


  if (existingIndex > -1) {

    /* Модуль уже выбран — снимаем выбор */

    selectedModules.splice(existingIndex, 1);

    cell.classList.remove('is-selected');
    cell.setAttribute('aria-pressed', 'false');

  } else {

    /* Модуль ещё не выбран — добавляем */

    selectedModules.push({
      id: id,
      name: name,
      price: price
    });

    cell.classList.add('is-selected');
    cell.setAttribute('aria-pressed', 'true');
  }


  /* После изменения комплекта пересчитываем всё */

  renderKitPanel();
  updateCardPricing();
}


/* ============================================================
   ТАРИФ СКИДКИ
   ============================================================ */

/**
 * Возвращает тариф скидки для заданного количества модулей.
 *
 * Таблица DISCOUNT_TIERS формируется из product_catalog.json.
 *
 * @param {number} n
 * @returns {{
 *   min:number,
 *   max:number,
 *   pct:(number|null),
 *   label:string,
 *   individual?:boolean
 * }|null}
 */
function getTierForCount(n) {

  if (n <= 0) {
    return null;
  }


  return DISCOUNT_TIERS.find(function (t) {
    return n >= t.min && n <= t.max;
  }) || DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];
}


/* ============================================================
   РАСЧЁТ КОМПЛЕКТА
   ============================================================ */

/**
 * Считает:
 *
 * - количество модулей;
 * - сумму без скидки;
 * - действующий тариф;
 * - итоговую стоимость.
 *
 * @returns {{
 *   count:number,
 *   rawTotal:number,
 *   tier:(object|null),
 *   total:number
 * }}
 */
function getKitSummary() {

  const count = selectedModules.length;


  const rawTotal = selectedModules.reduce(function (sum, m) {
    return sum + m.price;
  }, 0);


  const tier = getTierForCount(count);


  const pct = (
    tier &&
    !tier.individual
  )
    ? tier.pct
    : 0;


  const total = Math.round(
    rawTotal * (1 - pct / 100)
  );


  return {
    count: count,
    rawTotal: rawTotal,
    tier: tier,
    total: total
  };
}


/* ============================================================
   ПАНЕЛЬ «ВАШ КОМПЛЕКТ»
   ============================================================ */

/**
 * Обновляет нижнюю панель "Ваш комплект".
 */
function renderKitPanel() {

  const panel = document.getElementById('hive-kit-panel');
  const countEl = document.getElementById('hive-kit-count');
  const discountEl = document.getElementById('hive-kit-discount');
  const totalEl = document.getElementById('hive-kit-total');
  const tiersEl = document.getElementById('hive-kit-tiers');


  if (!panel || !countEl || !totalEl) {
    return;
  }


  const summary = getKitSummary();


  /* Ничего не выбрано */

  if (summary.count === 0) {

    panel.classList.remove('is-visible');
    document.body.classList.remove('has-kit-panel');

    return;
  }


  /* Количество */

  countEl.textContent = formatModulesCount(
    summary.count
  );


  /* Скидка */

  if (discountEl) {

    if (
      summary.tier &&
      summary.tier.individual
    ) {

      discountEl.textContent =
        'индивидуальные условия';

    } else if (
      summary.tier &&
      summary.tier.pct > 0
    ) {

      discountEl.textContent =
        'скидка ' + summary.tier.pct + '%';

    } else {

      discountEl.textContent = '';
    }
  }


  /* Итоговая сумма */

  totalEl.textContent = formatPrice(
    summary.total
  );


  /* Прогресс по тарифам */

  if (tiersEl) {
    renderTierProgress(
      tiersEl,
      summary.count
    );
  }


  /* Показываем панель */

  panel.classList.add('is-visible');
  document.body.classList.add('has-kit-panel');
}


/* ============================================================
   ПРОГРЕСС СКИДКИ
   ============================================================ */

/**
 * Рисует компактный прогресс-индикатор уровней скидки.
 *
 * @param {HTMLElement} el
 * @param {number} count
 */
function renderTierProgress(el, count) {

  const activeTier = getTierForCount(count);


  el.innerHTML = DISCOUNT_TIERS.map(function (t) {

    const isActive =
      activeTier === t;


    const cls =
      'tier-dot' +
      (isActive ? ' is-active' : '') +
      (t.individual ? ' is-individual' : '');


    return (
      '<span class="' +
      cls +
      '" title="' +
      t.label +
      (
        t.individual
          ? ''
          : (': -' + t.pct + '%')
      ) +
      '"></span>'
    );

  }).join('');
}


/* ============================================================
   ЦЕНЫ НА КАРТОЧКАХ
   ============================================================ */

/**
 * Обновляет цену и бейдж на каждой карточке.
 *
 * Состояния:
 *
 * 1. Ничего не выбрано:
 *    обычная цена.
 *
 * 2. Карточка выбрана:
 *    цена с текущей скидкой комплекта.
 *
 * 3. Карточка не выбрана:
 *    preview — цена, если добавить её
 *    в комплект прямо сейчас.
 */
function updateCardPricing() {

  const cells = document.querySelectorAll(
    '.hive-grid .cell[data-solution-id]'
  );


  if (!cells.length) {
    return;
  }


  const count = selectedModules.length;

  const currentTier =
    getTierForCount(count);

  const previewTier =
    getTierForCount(count + 1);


  cells.forEach(function (cell) {

    const id =
      cell.dataset.solutionId;

    const price =
      parseFloat(cell.dataset.price) || 0;


    const isSelected =
      selectedModules.some(function (m) {
        return m.id === id;
      });


    const priceEl =
      cell.querySelector('.cell-price');

    const oldEl =
      cell.querySelector('.cell-price-old');

    const badgeEl =
      cell.querySelector('.cell-badge');


    if (!priceEl || !oldEl || !badgeEl) {
      return;
    }


    /* --------------------------------------------------------
       Ничего не выбрано
       -------------------------------------------------------- */

    if (count === 0) {

      priceEl.textContent =
        formatPrice(price);

      priceEl.classList.remove(
        'is-preview'
      );

      oldEl.classList.remove(
        'is-shown'
      );

      badgeEl.classList.remove(
        'is-shown',
        'is-individual'
      );

      return;
    }


    /* --------------------------------------------------------
       Определяем тариф карточки
       -------------------------------------------------------- */

    const tier =
      isSelected
        ? currentTier
        : previewTier;


    /* --------------------------------------------------------
       8+ модулей — индивидуальные условия
       -------------------------------------------------------- */

    if (
      tier &&
      tier.individual
    ) {

      priceEl.textContent =
        formatPrice(price);

      priceEl.classList.toggle(
        'is-preview',
        !isSelected
      );

      oldEl.classList.remove(
        'is-shown'
      );

      badgeEl.textContent =
        'Индивидуально';

      badgeEl.classList.add(
        'is-shown',
        'is-individual'
      );

      return;
    }


    /* --------------------------------------------------------
       Обычная скидка
       -------------------------------------------------------- */

    const pct =
      tier
        ? tier.pct
        : 0;


    if (pct > 0) {

      const discounted =
        Math.round(
          price * (1 - pct / 100)
        );


      oldEl.textContent =
        formatPrice(price);

      oldEl.classList.add(
        'is-shown'
      );


      priceEl.textContent =
        formatPrice(discounted);

      priceEl.classList.toggle(
        'is-preview',
        !isSelected
      );


      badgeEl.textContent =
        '−' + pct + '%';

      badgeEl.classList.add(
        'is-shown'
      );

      badgeEl.classList.remove(
        'is-individual'
      );

    } else {

      /* ------------------------------------------------------
         Без скидки
         ------------------------------------------------------ */

      priceEl.textContent =
        formatPrice(price);

      priceEl.classList.remove(
        'is-preview'
      );

      oldEl.classList.remove(
        'is-shown'
      );

      badgeEl.classList.remove(
        'is-shown',
        'is-individual'
      );
    }

  });
}


/* ============================================================
   ФОРМАТИРОВАНИЕ ЦЕНЫ
   ============================================================ */

/**
 * 138000 → "138 000 ₽"
 */
function formatPrice(value) {

  return value.toLocaleString('ru-RU') + ' ₽';
}


/* ============================================================
   СКЛОНЕНИЕ
   ============================================================ */

/**
 * 1 решение
 * 2 решения
 * 5 решений
 */
function formatModulesCount(count) {

  const mod10 =
    count % 10;

  const mod100 =
    count % 100;


  let word =
    'решений';


  if (
    mod100 < 11 ||
    mod100 > 14
  ) {

    if (mod10 === 1) {

      word = 'решение';

    } else if (
      mod10 >= 2 &&
      mod10 <= 4
    ) {

      word = 'решения';
    }
  }


  return count + ' ' + word;
}


/* ============================================================
   ПОЛУЧИТЬ ИНДИВИДУАЛЬНУЮ КОНФИГУРАЦИЮ
   ============================================================ */

/**
 * Обработчик кнопки "Получить индивидуальную конфигурацию".
 *
 * Использует существующую форму лида:
 * hiveOpenForm / hiveSubmitForm.
 *
 * Ничего напрямую отсюда не отправляется.
 */
function handleGetOfferClick() {

  const summary =
    getKitSummary();


  const namesList =
    selectedModules
      .map(function (m) {
        return m.name;
      })
      .join(', ');


  const composedTitle =
    'Комплект (' +
    summary.count +
    '): ' +
    namesList;


  const discountNote =
    (
      summary.tier &&
      summary.tier.individual
    )
      ? 'индивидуальные условия'
      : (
          summary.tier &&
          summary.tier.pct > 0
        )
          ? 'скидка ' +
            summary.tier.pct +
            '%'
          : 'без скидки';


  /* Используем существующую форму */

  if (
    typeof hiveOpenForm === 'function'
  ) {

    hiveOpenForm(
      composedTitle,
      'kit'
    );


    const modalTitle =
      document.getElementById(
        'hive-modal-title'
      );


    if (modalTitle) {

      modalTitle.textContent =
        'Получить индивидуальную конфигурацию';
    }


    const commentField =
      document.getElementById(
        'hive-comment'
      );


    if (
      commentField &&
      !commentField.value
    ) {

      commentField.value =
        'Интересует комплект: ' +
        namesList +
        ' (' +
        discountNote +
        ')' +
        '. Ориентировочная сумма: ' +
        formatPrice(summary.total);
    }
  }
}