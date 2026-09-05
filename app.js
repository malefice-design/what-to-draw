(() => {
  const FAV_KEY = 'wtd_favorites';
  const HEART_OUTLINE = 'assets/icons/heart-outline.svg';
  const HEART_FILLED = 'assets/icons/heart-filled.svg';

  const state = {
    categories: new Set(),
    slots: new Set(),
  };

  const history = []; // { text, categoryIds }
  let historyIndex = -1;

  let screenHistory = [];
  let currentScreen = 'screen-categories';

  const HEADER_TITLES = {
    'screen-categories': '¿Qué quieres dibujar?',
    'screen-slots': '¿Qué tiene que tener?',
    'screen-result': '¡A dibujar!',
    'screen-favorites': 'Favoritos',
  };

  // ---------- utils ----------
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildPool(categoryIds, slotId) {
    let pool = [];
    categoryIds.forEach((catId) => {
      const cat = WTD_CATEGORIES.find((c) => c.id === catId);
      if (cat && cat.banks[slotId]) pool = pool.concat(cat.banks[slotId]);
    });
    return pool;
  }

  function loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveFavorites(favs) {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  }

  // ---------- phrase generation ----------
  // Orden fijo de las cláusulas (todo lo que no es "sujeto"). Ver spec-generador-de-frases.md.
  const CLAUSE_ORDER = [
    'atributo', 'ropa', 'accesorio', 'arma', 'habilidad',
    'material', 'lugar', 'clima', 'accion', 'planta', 'comida',
  ];

  function generatePhrase(categoryIds, slotIds) {
    if (categoryIds.length === 0 || slotIds.length === 0) return null;

    // Todos los slots "sujeto" que el usuario activó y que tienen contenido
    // disponible en las categorías elegidas, en orden de prioridad.
    const chosenSubjects = WTD_SUBJECT_PRIORITY.filter(
      (sid) => slotIds.includes(sid) && buildPool(categoryIds, sid).length > 0
    );
    const mainSubjectId = chosenSubjects[0] || null;

    const parts = [];

    // 1. Sujeto principal (o el sujeto genérico de respaldo si no se eligió ninguno).
    if (mainSubjectId) {
      parts.push(pickRandom(buildPool(categoryIds, mainSubjectId)));
    } else {
      parts.push(pickRandom(WTD_FALLBACK_SUBJECTS).toLowerCase());
    }

    // 2. Sujetos secundarios, con su conector fijo, en el mismo orden de prioridad.
    for (const sid of chosenSubjects.slice(1)) {
      const slot = WTD_SLOTS.find((s) => s.id === sid);
      const fragment = pickRandom(buildPool(categoryIds, sid));
      parts.push(`${slot.connector} ${fragment}`);
    }

    // 3. Cláusulas en el orden fijo. "material" usa su conector especial.
    for (const slotId of CLAUSE_ORDER) {
      if (!slotIds.includes(slotId)) continue;
      const pool = buildPool(categoryIds, slotId);
      if (!pool.length) continue;
      let fragment = pickRandom(pool);
      if (slotId === 'material') {
        fragment = `con detalles hechos de ${fragment.replace(/^hecho de /, '')}`;
      }
      parts.push(fragment);
    }

    const joined = parts.join(', ');
    const text = joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
    return { text, categoryIds: [...categoryIds] };
  }

  // ---------- navigation ----------
  function switchScreen(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    currentScreen = id;
    document.getElementById('header-title').textContent = HEADER_TITLES[id] || '';
    document.getElementById('btn-back').classList.toggle('hidden', screenHistory.length === 0);
  }
  function goToScreen(id) {
    screenHistory.push(currentScreen);
    switchScreen(id);
  }
  function goBack() {
    const prev = screenHistory.pop();
    if (prev) switchScreen(prev);
  }

  // El ":active" de CSS se apaga apenas se levanta el dedo (touchend), antes
  // de que cualquier setTimeout en el click handler alcance a hacer algo.
  // Por eso el estado "pressed" se controla acá con una clase: se aplica al
  // tocar, se mantiene un rato después de soltar, y recién ahí se navega.
  const SCREEN_CHANGE_DELAY = 150;

  function pressThenGo(el, action) {
    el.classList.add('is-pressed');
    setTimeout(() => {
      el.classList.remove('is-pressed');
      action();
    }, SCREEN_CHANGE_DELAY);
  }

  // ---------- renderers ----------
  function makePill(iconSrc, label, selected) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'px-pill' + (selected ? ' is-selected' : '');
    btn.innerHTML = `
      <img class="px-pill-icon" src="${iconSrc}" alt="">
      <span class="px-pill-label">${label}</span>
    `;
    return btn;
  }

  // La selección de categoría es única (no se pueden combinar varias a mano);
  // "Todos los temas" es, en sí misma, una de las opciones exclusivas de la lista.
  function renderCategoryGrid(container, selectedSet, onToggle) {
    container.innerHTML = '';

    const allSelected = WTD_CATEGORIES.every((c) => selectedSet.has(c.id));
    const allPill = makePill('assets/icons/cat-todos.svg', 'Todos los temas', allSelected);
    allPill.addEventListener('click', () => {
      selectedSet.clear();
      WTD_CATEGORIES.forEach((c) => selectedSet.add(c.id));
      renderCategoryGrid(container, selectedSet, onToggle);
      onToggle();
    });
    container.appendChild(allPill);

    WTD_CATEGORIES.forEach((cat) => {
      const isSelected = selectedSet.size === 1 && selectedSet.has(cat.id);
      const pill = makePill(cat.icon, cat.name, isSelected);
      pill.addEventListener('click', () => {
        selectedSet.clear();
        selectedSet.add(cat.id);
        renderCategoryGrid(container, selectedSet, onToggle);
        onToggle();
      });
      container.appendChild(pill);
    });
  }

  function navyIcon(path) {
    return path.replace('.svg', '-navy.svg');
  }

  function renderCategoryBanner(categoryIds) {
    const banner = document.getElementById('category-banner');
    const allSelected = WTD_CATEGORIES.every((c) => categoryIds.includes(c.id));
    if (allSelected) {
      banner.innerHTML = `
        <img class="px-category-banner-icon" src="${navyIcon('assets/icons/cat-todos.svg')}" alt="">
        <span class="px-category-banner-label">Todos los temas</span>
        <span class="px-deco-btn"><img src="assets/icons/pin.svg" alt=""></span>
      `;
      return;
    }
    const cat = WTD_CATEGORIES.find((c) => categoryIds.includes(c.id));
    if (!cat) return;
    banner.innerHTML = `
      <img class="px-category-banner-icon" src="${navyIcon(cat.icon)}" alt="">
      <span class="px-category-banner-label">${cat.name}</span>
      <span class="px-deco-btn"><img src="assets/icons/pin.svg" alt=""></span>
    `;
  }

  function renderSlotGrid(container, selectedSet, onToggle) {
    container.innerHTML = '';
    WTD_SLOTS.forEach((slot) => {
      const pill = makePill(slot.icon, slot.label, selectedSet.has(slot.id));
      pill.addEventListener('click', () => {
        if (selectedSet.has(slot.id)) selectedSet.delete(slot.id);
        else selectedSet.add(slot.id);
        renderSlotGrid(container, selectedSet, onToggle);
        onToggle();
      });
      container.appendChild(pill);
    });
  }

  // ---------- result screen ----------
  function renderResult(entry) {
    document.getElementById('result-phrase').textContent = entry.text;
    document.getElementById('btn-undo').disabled = historyIndex <= 0;
    updateFavToggle(entry);
  }

  function updateFavToggle(entry) {
    const favs = loadFavorites();
    const isFav = favs.some((f) => f.text === entry.text);
    const icon = document.getElementById('result-fav-icon');
    icon.src = isFav ? HEART_FILLED : HEART_OUTLINE;
    document.getElementById('btn-fav-toggle').classList.toggle('is-active', isFav);
  }

  function generateAndShow() {
    const entry = generatePhrase([...state.categories], [...state.slots]);
    if (!entry) return;
    history.splice(historyIndex + 1); // drop redo branch
    history.push(entry);
    historyIndex = history.length - 1;
    renderResult(entry);
  }

  // ---------- favorites screen ----------
  function renderFavoritesScreen() {
    const favs = loadFavorites();
    const list = document.getElementById('favorites-list');
    const empty = document.getElementById('favorites-empty');
    list.innerHTML = '';
    empty.classList.toggle('hidden', favs.length > 0);
    favs.slice().reverse().forEach((fav) => {
      const cats = fav.categoryIds.map((id) => WTD_CATEGORIES.find((c) => c.id === id)).filter(Boolean);
      const card = document.createElement('div');
      card.className = 'favorite-card';
      card.innerHTML = `
        <div class="fav-content">
          <div class="fav-category">${cats.map((c) => c.name).join(' · ')}</div>
          <p class="fav-phrase">${fav.text}</p>
        </div>
        <button class="fav-delete" aria-label="Eliminar"><img src="assets/icons/trash.svg" alt=""></button>
      `;
      const deleteBtn = card.querySelector('.fav-delete');
      deleteBtn.addEventListener('click', function () {
        pressThenGo(this, () => {
          const updated = loadFavorites().filter((f) => f.text !== fav.text);
          saveFavorites(updated);
          renderFavoritesScreen();
          if (history[historyIndex] && history[historyIndex].text === fav.text) {
            updateFavToggle(history[historyIndex]);
          }
        });
      });
      list.appendChild(card);
    });
  }

  // ---------- init ----------
  function init() {
    renderCategoryGrid(document.getElementById('category-grid'), state.categories, () => {
      document.getElementById('btn-to-slots').disabled = state.categories.size === 0;
    });

    renderSlotGrid(document.getElementById('slot-grid'), state.slots, () => {
      document.getElementById('btn-generate').disabled = state.slots.size === 0;
    });
    document.getElementById('btn-generate').disabled = state.slots.size === 0;

    document.getElementById('btn-to-slots').addEventListener('click', function () {
      pressThenGo(this, () => {
        renderCategoryBanner([...state.categories]);
        goToScreen('screen-slots');
      });
    });

    document.getElementById('btn-generate').addEventListener('click', function () {
      pressThenGo(this, () => {
        generateAndShow();
        goToScreen('screen-result');
      });
    });

    document.getElementById('btn-regenerate').addEventListener('click', function () {
      pressThenGo(this, generateAndShow);
    });

    document.getElementById('btn-undo').addEventListener('click', function () {
      pressThenGo(this, () => {
        if (historyIndex > 0) {
          historyIndex -= 1;
          renderResult(history[historyIndex]);
        }
      });
    });

    document.getElementById('btn-fav-toggle').addEventListener('click', function () {
      pressThenGo(this, () => {
        const entry = history[historyIndex];
        if (!entry) return;
        let favs = loadFavorites();
        const isFav = favs.some((f) => f.text === entry.text);
        if (isFav) {
          favs = favs.filter((f) => f.text !== entry.text);
        } else {
          favs.push(entry);
        }
        saveFavorites(favs);
        updateFavToggle(entry);
      });
    });

    document.getElementById('btn-back').addEventListener('click', function () {
      pressThenGo(this, goBack);
    });
    document.getElementById('btn-favs').addEventListener('click', function () {
      pressThenGo(this, () => {
        renderFavoritesScreen();
        goToScreen('screen-favorites');
      });
    });

    switchScreen('screen-categories');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
