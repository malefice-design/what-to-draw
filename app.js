(() => {
  const FAV_KEY = 'wtd_favorites';
  const HEART_OUTLINE = 'assets/icons/heart-outline.svg';
  const HEART_FILLED = 'assets/icons/heart-filled.svg';

  const state = {
    categories: new Set(),
    slots: new Set(['personaje', 'lugar', 'accion']),
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
  const CLAUSE_ORDER = [
    'atributo', 'personaje', 'criatura', 'animal', 'vehiculo', 'objeto',
    'ropa', 'accesorio', 'arma', 'habilidad', 'material', 'lugar', 'clima', 'accion', 'planta', 'comida',
  ];

  function generatePhrase(categoryIds, slotIds) {
    if (categoryIds.length === 0 || slotIds.length === 0) return null;

    let subject = null;
    for (const sid of WTD_SUBJECT_PRIORITY) {
      if (slotIds.includes(sid)) {
        const pool = buildPool(categoryIds, sid);
        if (pool.length) {
          subject = { id: sid, text: pickRandom(pool) };
          break;
        }
      }
    }

    let subjectText = subject ? subject.text : pickRandom(WTD_FALLBACK_SUBJECTS).toLowerCase();
    const subjectId = subject ? subject.id : null;

    const candidateSlots = WTD_SLOTS.filter((s) => slotIds.includes(s.id) && s.id !== subjectId);
    candidateSlots.sort((a, b) => CLAUSE_ORDER.indexOf(a.id) - CLAUSE_ORDER.indexOf(b.id));

    const clauses = [];
    for (const slot of candidateSlots) {
      const pool = buildPool(categoryIds, slot.id);
      if (!pool.length) continue;
      let text = pickRandom(pool);
      if (slot.kind === 'subject') text = `${slot.connector} ${text}`;
      clauses.push(text);
    }

    const capitalized = subjectText.charAt(0).toUpperCase() + subjectText.slice(1);
    const text = [capitalized, ...clauses].join(', ') + '.';
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

  function renderCategoryBanner(categoryIds) {
    const banner = document.getElementById('category-banner');
    const allSelected = WTD_CATEGORIES.every((c) => categoryIds.includes(c.id));
    if (allSelected) {
      banner.innerHTML = `
        <img class="px-category-banner-icon" src="assets/icons/cat-todos.svg" alt="">
        <span class="px-category-banner-label">Todos los temas</span>
      `;
      return;
    }
    const cat = WTD_CATEGORIES.find((c) => categoryIds.includes(c.id));
    if (!cat) return;
    banner.innerHTML = `
      <img class="px-category-banner-icon" src="${cat.icon}" alt="">
      <span class="px-category-banner-label">${cat.name}</span>
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
        <div class="fav-category">${cats.map((c) => c.name).join(' · ')}</div>
        <p class="fav-phrase">${fav.text}</p>
        <button class="fav-delete" aria-label="Eliminar">🗑</button>
      `;
      card.querySelector('.fav-delete').addEventListener('click', () => {
        const updated = loadFavorites().filter((f) => f.text !== fav.text);
        saveFavorites(updated);
        renderFavoritesScreen();
        if (history[historyIndex] && history[historyIndex].text === fav.text) {
          updateFavToggle(history[historyIndex]);
        }
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

    document.getElementById('btn-to-slots').addEventListener('click', () => {
      renderCategoryBanner([...state.categories]);
      goToScreen('screen-slots');
    });

    document.getElementById('btn-generate').addEventListener('click', () => {
      generateAndShow();
      goToScreen('screen-result');
    });

    document.getElementById('btn-regenerate').addEventListener('click', generateAndShow);

    document.getElementById('btn-undo').addEventListener('click', () => {
      if (historyIndex > 0) {
        historyIndex -= 1;
        renderResult(history[historyIndex]);
      }
    });

    document.getElementById('btn-fav-toggle').addEventListener('click', () => {
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

    document.getElementById('btn-back').addEventListener('click', goBack);
    document.getElementById('btn-favs').addEventListener('click', () => {
      renderFavoritesScreen();
      goToScreen('screen-favorites');
    });

    switchScreen('screen-categories');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
