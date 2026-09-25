/*
  Deckard : éditeur visuel, chargé à la demande par deck.js (touche « e » ou bouton « Éditer »).

  Principe : deck.js garde la source HTML du deck telle qu'écrite (avant rendu). L'éditeur modifie
  cette source, puis refait le rendu des slides touchées. Chaque composant de la source porte un
  data-eid qui le relie à son rendu à l'écran. Les modifications sont gardées dans le navigateur,
  « Exporter » télécharge le nouvel index.html.
*/
(() => {
  // ---------- Sérialisation : source -> HTML propre (partie testée avec bun) ----------
  const PIPE = new Set(['s-trend', 's-bars', 's-vbars', 's-share', 's-scatter', 's-price', 's-table', 's-matrix']);
  const CONTAINERS = new Set(['s-deck', 's-slide', 's-top', 's-foot', 's-columns', 's-grid', 's-list', 's-flow', 's-roadmap']);
  const BOOLEAN = new Set(['once', 'counter', 'no-chrome', 'no-edit', 'muted', 'small', 'right', 'filled', 'numbered', 'push']);

  const parseRows = (text) =>
    text.split('\n').map((l) => l.trim())
      .filter((l) => l && !/^[|\s:-]+$/.test(l))
      .map((l) => l.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));

  // Aligne les colonnes pour que le HTML exporté reste lisible
  const alignRows = (rows) => {
    const widths = [];
    rows.forEach((r) => r.forEach((cell, i) => { if (i < r.length - 1) widths[i] = Math.max(widths[i] ?? 0, cell.length); }));
    return rows.map((r) => r.map((cell, i) => (i < r.length - 1 ? cell.padEnd(widths[i]) : cell)).join(' | '));
  };

  const escAttr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const escText = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const stripIds = (html) => html.replace(/\sdata-eid="[^"]*"/g, '');
  const attrText = (node) => [...node.attributes]
    .filter((a) => a.name !== 'data-eid')
    .map((a) => (a.value === '' && BOOLEAN.has(a.name) ? ` ${a.name}` : ` ${a.name}="${escAttr(a.value)}"`))
    .join('');

  const serialize = (node, depth = 0) => {
    const pad = '  '.repeat(depth);
    const tag = node.localName;
    const open = `${pad}<${tag}${attrText(node)}>`;
    const onlyElements = [...node.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim());
    if (CONTAINERS.has(tag) && onlyElements) {
      const kids = [...node.children].map((c) => serialize(c, depth + 1));
      if (!kids.length) return `${open}</${tag}>`;
      return `${open}\n${kids.join(tag === 's-deck' ? '\n\n' : '\n')}\n${pad}</${tag}>`;
    }
    if (PIPE.has(tag)) {
      const lines = alignRows(parseRows(node.textContent)).map((l) => `${pad}  ${escText(l)}`);
      return lines.length ? `${open}\n${lines.join('\n')}\n${pad}</${tag}>` : `${open}</${tag}>`;
    }
    if (tag === 's-code') {
      const lines = node.textContent.replace(/^\s*\n|\n\s*$/g, '').split('\n');
      const filled = lines.filter((l) => l.trim());
      const indent = filled.length ? Math.min(...filled.map((l) => l.match(/^\s*/)[0].length)) : 0;
      return `${open}\n${lines.map((l) => (l.trim() ? `${pad}  ${escText(l.slice(indent))}` : '')).join('\n')}\n${pad}</${tag}>`;
    }
    return `${open}${stripIds(node.innerHTML).replace(/\s+/g, ' ').trim()}</${tag}>`;
  };

  if (typeof module === 'object') module.exports = { parseRows, alignRows, serialize };
  if (!globalThis.document || globalThis.DeckardEditor) return;

  // ---------- Catalogue des composants ----------
  const text = (name, label, extra) => ({ name, label, type: 'text', ...extra });
  const toggle = (name, label, extra) => ({ name, label, type: 'toggle', ...extra });
  const select = (name, label, options) => ({ name, label, type: 'select', options });
  const range = (name, label, min, max) => ({ name, label, type: 'range', min, max });
  const PUSH = toggle('push', 'Poussé à droite');
  const REVEAL = select('reveal', 'Animation', [['', 'Par défaut'], ['up', 'Montée'], ['fade', 'Fondu'], ['scale', 'Zoom'], ['none', 'Aucune']]);

  const SPECS = {
    's-title': { label: 'Titre', group: 'Texte', icon: 'T', content: 'inline', html: '<s-title>Titre</s-title>' },
    's-heading': { label: 'Grand titre', group: 'Texte', icon: 'H', content: 'inline', html: '<s-heading>Grand titre</s-heading>' },
    's-label': { label: 'Sur-titre', group: 'Texte', icon: 'Aa', content: 'inline', html: '<s-label>Sur-titre</s-label>' },
    's-text': {
      label: 'Paragraphe', group: 'Texte', icon: '¶', content: 'inline',
      html: '<s-text>Une phrase courte qui porte une seule idée.</s-text>',
      attrs: [toggle('muted', 'Atténué'), toggle('small', 'Petit'), toggle('right', 'Aligné à droite')],
    },
    's-quote': { label: 'Citation', group: 'Texte', icon: '“', content: 'rich', html: '<s-quote by="Auteur">Une citation marquante.</s-quote>', attrs: [text('by', 'Auteur')] },
    's-callout': {
      label: 'Encadré', group: 'Texte', icon: '!', content: 'rich', html: '<s-callout>Une remarque importante.</s-callout>',
      attrs: [select('type', 'Type', [['', 'Note'], ['warn', 'Attention']]), text('label', 'Mot de la pilule')],
    },
    's-list': {
      label: 'Liste', group: 'Texte', icon: '≡', content: 'children', attrs: [toggle('numbered', 'Numérotée')],
      html: '<s-list><s-item>Premier point</s-item><s-item>Deuxième point</s-item><s-item>Troisième point</s-item></s-list>',
    },
    's-item': { label: 'Puce', group: 'Texte', icon: '–', content: 'inline', html: '<s-item>Nouveau point</s-item>' },
    's-code': { label: 'Code', group: 'Texte', icon: '{ }', content: 'code', html: '<s-code file="main.tf">\nresource "exemple" "a" {\n  name = "a"\n}\n</s-code>', attrs: [text('file', 'Fichier')] },
    's-tag': { label: 'Étiquette', group: 'Texte', icon: '#', content: 'inline', html: '<s-tag>v1.0</s-tag>' },
    's-divider': { label: 'Séparateur', group: 'Texte', icon: '—', content: 'none', html: '<s-divider></s-divider>' },

    's-stat': {
      label: 'Chiffre clé', group: 'Données', icon: '42', content: 'none', html: '<s-stat value="42 %" label="Libellé" delta="+5%"></s-stat>',
      attrs: [text('value', 'Valeur'), text('label', 'Libellé'), text('delta', 'Évolution', { placeholder: '+12% ou −8%' })],
    },
    's-bars': {
      label: 'Barres', group: 'Données', icon: '☰', content: 'pipe', hint: 'libellé | valeur',
      html: '<s-bars unit="€">\nOption A | 120\nOption B | 80\nOption C | 60\n</s-bars>',
      attrs: [text('unit', 'Unité'), select('highlight', 'Mise en avant', 'rows')],
    },
    's-vbars': {
      label: 'Colonnes', group: 'Données', icon: '▥', content: 'pipe', hint: 'libellé | valeur',
      html: '<s-vbars unit="ms">\nA | 120\nB | 80\nC | 60\n</s-vbars>',
      attrs: [text('unit', 'Unité'), select('highlight', 'Mise en avant', 'rows')],
    },
    's-share': {
      label: 'Répartition', group: 'Données', icon: '▭', content: 'pipe', hint: 'libellé | valeur (5 parts max)',
      html: '<s-share unit="€">\nPoste A | 540\nPoste B | 320\nPoste C | 180\n</s-share>', attrs: [text('unit', 'Unité')],
    },
    's-trend': {
      label: 'Tendance', group: 'Données', icon: '↗', content: 'pipe', hint: 'libellé | valeur | description',
      html: '<s-trend>\nMois 1 | 800 € | Démarrage.\nMois 3 | 2k € | Montée en charge.\nMois 6 | 5k € | Régime de croisière.\n</s-trend>',
    },
    's-scatter': {
      label: 'Nuage', group: 'Données', icon: '⁘', content: 'pipe', hint: 'libellé | x | y (| left)',
      html: '<s-scatter x="Difficulté" y="Prix" quadrants="Simple mais cher | Complexe et cher | Simple et abordable | Complexe mais abordable">\nOption A | 2 | 320\nOption B | 6 | 780\nOption C | 7 | 290\n</s-scatter>',
      attrs: [text('x', 'Axe horizontal'), text('y', 'Axe vertical'), text('x-max', 'Max horizontal'), text('y-max', 'Max vertical'),
        select('highlight', 'Mise en avant', 'rows'), text('quadrants', 'Quadrants', { placeholder: 'a | b | c | d' })],
    },
    's-price': {
      label: 'Prix', group: 'Données', icon: '€', content: 'pipe', hint: 'libellé | montant | note',
      html: '<s-price period="/ mois">\nService A | 320 | détail\nService B | 540 | détail\n</s-price>',
      attrs: [text('currency', 'Devise', { placeholder: '€' }), text('period', 'Période'), text('total-label', 'Libellé du total', { placeholder: 'Total' })],
    },
    's-table': {
      label: 'Tableau', group: 'Données', icon: '▦', content: 'pipe', hint: '1re ligne = en-têtes',
      html: '<s-table>\nNom | Valeur | Note\nA | 2 | ok\nB | 4 | ok\n</s-table>', attrs: [select('highlight', 'Colonne en avant', 'head')],
    },
    's-matrix': {
      label: 'Matrice', group: 'Données', icon: '✓', content: 'pipe', hint: 'oui / non / partiel, ou des chiffres',
      html: '<s-matrix>\nCritère | A | B\nPremier | oui | non\nSecond | partiel | oui\n</s-matrix>',
      attrs: [select('highlight', 'Colonne en avant', 'head'), range('max', 'Score sur', 0, 10)],
    },

    's-columns': { label: '2 colonnes', group: 'Mise en page', icon: '◫', content: 'children', html: '<s-columns><s-text>Colonne de gauche.</s-text><s-text>Colonne de droite.</s-text></s-columns>' },
    's-grid': {
      label: 'Grille', group: 'Mise en page', icon: '⊞', content: 'children',
      html: '<s-grid><s-stat value="12" label="Premier"></s-stat><s-stat value="34" label="Deuxième"></s-stat><s-stat value="56" label="Troisième"></s-stat></s-grid>',
    },
    's-card': { label: 'Carte', group: 'Mise en page', icon: '▢', content: 'rich', html: '<s-card heading="Titre">Texte de la carte.</s-card>', attrs: [text('heading', 'Titre')] },
    's-flow': {
      label: 'Schéma', group: 'Mise en page', icon: '→', content: 'children',
      html: '<s-flow><s-node sub="Détail">Étape 1</s-node><s-node sub="Détail">Étape 2</s-node><s-node sub="Détail">Étape 3</s-node></s-flow>',
    },
    's-node': { label: 'Étape', group: 'Mise en page', icon: '□', content: 'rich', html: '<s-node sub="Détail">Étape</s-node>', attrs: [text('sub', 'Détail')] },
    's-roadmap': {
      label: 'Roadmap', group: 'Mise en page', icon: '⋯', content: 'children',
      html: '<s-roadmap><s-phase label="Phase 1">Texte court.</s-phase><s-phase label="Phase 2">Texte court.</s-phase><s-phase label="Phase 3">Texte court.</s-phase></s-roadmap>',
    },
    's-phase': { label: 'Phase', group: 'Mise en page', icon: '◌', content: 'rich', html: '<s-phase label="Phase">Texte court.</s-phase>', attrs: [text('label', 'Nom')] },

    's-image': {
      label: 'Image', group: 'Média', icon: '◩', content: 'none', html: '<s-image alt="Image" ratio="16/9"></s-image>',
      attrs: [{ name: 'src', label: 'Fichier', type: 'image' }, text('alt', 'Description'), text('caption', 'Légende'),
        select('ratio', 'Format', [['', 'Libre'], ['16/9', '16/9'], ['4/3', '4/3'], ['1/1', 'Carré'], ['21/9', '21/9']]),
        select('fit', 'Cadrage', [['', 'Recadrer'], ['contain', 'Image entière']])],
    },

    's-foot': { label: 'Pied', group: 'En-tête et pied', icon: '▁', content: 'children', html: '<s-foot><s-heading>Titre</s-heading></s-foot>' },
    's-top': {
      label: 'En-tête', group: 'En-tête et pied', icon: '▔', content: 'children',
      html: '<s-top><s-logo>Marque</s-logo><s-pill>Présentation</s-pill><s-arrow push></s-arrow></s-top>',
    },
    's-info': { label: 'Info', group: 'En-tête et pied', icon: 'i', content: 'rich', html: '<s-info label="Date">Septembre 2026</s-info>', attrs: [text('label', 'Libellé')] },
    's-pill': { label: 'Pilule', group: 'En-tête et pied', icon: '⬭', content: 'inline', html: '<s-pill>Texte</s-pill>', attrs: [toggle('filled', 'Pleine'), PUSH] },
    's-logo': { label: 'Logo', group: 'En-tête et pied', icon: '✱', content: 'inline', html: '<s-logo>Marque</s-logo>', attrs: [PUSH] },
    's-arrow': {
      label: 'Flèche', group: 'En-tête et pied', icon: '↘', content: 'none', html: '<s-arrow></s-arrow>',
      attrs: [select('to', 'Direction', [['', '↘'], ['right', '→'], ['up', '↗'], ['down', '↓']]), PUSH],
    },
    's-fine': { label: 'Mention', group: 'En-tête et pied', icon: '©', content: 'inline', html: '<s-fine>©2026 Marque</s-fine>', attrs: [PUSH] },
  };
  // Composants interchangeables : le contenu passe de l'un à l'autre
  const FAMILIES = [
    ['s-title', 's-heading', 's-label', 's-text', 's-quote', 's-callout', 's-item', 's-card'],
    ['s-bars', 's-vbars', 's-share', 's-trend', 's-price', 's-table', 's-matrix', 's-scatter'],
    ['s-columns', 's-grid', 's-flow', 's-roadmap', 's-list'],
  ];
  const familyOf = (tag) => FAMILIES.find((f) => f.includes(tag));
  const specOf = (tag) => SPECS[tag] ?? { label: tag, content: 'rich' };
  const HORIZONTAL = new Set(['s-columns', 's-grid', 's-flow', 's-roadmap', 's-top', 's-foot']);

  const SLIDE_ATTRS = [
    text('tag', 'Étiquette'),
    toggle('tone', 'Fond sombre', { value: 'dark' }),
    select('layout', 'Contenu', [['', 'Centré en hauteur'], ['center', 'Centré'], ['bottom', 'En bas']]),
    REVEAL,
    toggle('once', 'Animer une seule fois'),
  ];
  const DECK_ATTRS = [text('fine', 'Mention'), toggle('counter', 'Compteur'), toggle('no-chrome', 'Barre de progression', { invert: true })];

  const SLIDES = [
    ['Vide', '<s-slide tag="Section"></s-slide>'],
    ['Titre et texte', '<s-slide tag="Section"><s-heading>Titre</s-heading><s-text>Une phrase courte qui explique l’idée.</s-text></s-slide>'],
    ['Couverture', '<s-slide><s-top><s-logo>Marque</s-logo><s-pill>Présentation</s-pill><s-arrow push></s-arrow></s-top><s-title>Titre</s-title><s-text small>Présenté par <b>Nom</b></s-text><s-foot><s-info label="Date">Septembre 2026</s-info><s-info label="Contact">email@exemple.fr</s-info></s-foot></s-slide>'],
    ['Chiffres clés', `<s-slide tag="Indicateurs">${SPECS['s-grid'].html}</s-slide>`],
    ['Graphique et titre', `<s-slide tag="Données">${SPECS['s-vbars'].html}<s-foot><s-heading>Titre</s-heading><s-text small right>Source ou précision.</s-text></s-foot></s-slide>`],
    ['Image et texte', '<s-slide tag="Illustration"><s-columns><s-image alt="Image" ratio="16/9"></s-image><s-text>Ce que montre l’image, en une phrase.</s-text></s-columns></s-slide>'],
    ['Citation', `<s-slide tag="Citation">${SPECS['s-quote'].html}</s-slide>`],
    ['Fin', '<s-slide tag="Fin" layout="bottom" once><s-title>Questions ?</s-title></s-slide>'],
  ];

  // ---------- Outils ----------
  const h = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else if (k === 'value' || k === 'checked') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
    return n;
  };
  const debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
  const isTyping = (t) => t?.closest?.('input, textarea, select, [contenteditable]');
  const STORE_KEY = `deckard:${location.pathname}`;

  // ---------- État ----------
  let deck; // <s-deck> affiché
  let src; // <s-deck> source (inerte, jamais rendu)
  let uid = 0;
  let selected = null; // data-eid sélectionné (composant ou slide)
  let ui; // éléments de l'interface
  let active = false;
  const past = [];
  const future = [];
  let lastKey = null;
  let lastTime = 0;

  const byId = (id) => (id ? src.querySelector(`[data-eid="${id}"]`) : null);
  const live = (id) => (id ? deck.querySelector(`[data-eid="${id}"]`) : null);
  const slideOf = (node) => (node?.localName === 's-slide' ? node : node?.closest('s-slide'));
  const stamp = (root) => {
    [root, ...root.querySelectorAll('*')].forEach((n) => { if (n.localName.startsWith('s-') && n.localName !== 's-deck') n.dataset.eid = String(++uid); });
    return root;
  };
  const parse = (html) => {
    const tpl = src.ownerDocument.createElement('template');
    tpl.innerHTML = html.trim();
    return stamp(tpl.content.firstElementChild);
  };
  const currentSlide = () => byId(deck.slides[Math.max(deck.index, 0)]?.dataset.eid) ?? src.querySelector('s-slide');

  // ---------- Rendu ----------
  const importSlide = (s) => document.importNode(s, true);
  const syncDeckAttrs = () => {
    const keep = new Set(['tabindex', 'style', 'class']);
    [...deck.attributes].forEach((a) => !keep.has(a.name) && !src.hasAttribute(a.name) && deck.removeAttribute(a.name));
    [...src.attributes].forEach((a) => deck.setAttribute(a.name, a.value));
  };
  const renderSlides = (ids) => {
    for (const id of ids) {
      const s = byId(id);
      const old = live(id);
      if (!s || !old) continue;
      const fresh = importSlide(s);
      if (old.hasAttribute('data-active')) fresh.setAttribute('data-active', '');
      old.replaceWith(fresh);
    }
    deck.refresh();
  };
  const renderAll = () => {
    const index = Math.max(deck.index, 0);
    syncDeckAttrs();
    deck.replaceChildren(...[...src.children].map(importSlide));
    deck.refresh();
    deck.go(Math.min(index, deck.slides.length - 1), false);
    deck.slides[Math.min(index, deck.slides.length - 1)]?.setAttribute('data-active', '');
  };

  // ---------- Historique et sauvegarde ----------
  const snapshot = () => JSON.stringify({ html: src.innerHTML, attrs: [...src.attributes].map((a) => [a.name, a.value]), title: document.title });
  const restore = (state) => {
    const { html, attrs, title } = JSON.parse(state);
    src.innerHTML = html;
    [...src.attributes].forEach((a) => src.removeAttribute(a.name));
    attrs.forEach(([n, v]) => src.setAttribute(n, v));
    document.title = title;
  };
  // À appeler avant une modification. Une même clé dans la seconde regroupe la frappe en une étape.
  const remember = (key) => {
    const now = Date.now();
    if (key && key === lastKey && now - lastTime < 1000) { lastTime = now; return; }
    past.push(snapshot());
    if (past.length > 200) past.shift();
    future.length = 0;
    lastKey = key;
    lastTime = now;
  };
  const save = debounce(() => {
    const html = stripIds(src.innerHTML);
    deck.sourceHTML = html;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ file: deck.fileHash, attrs: [...src.attributes].map((a) => [a.name, a.value]), title: document.title, html }));
      status('Enregistré dans ce navigateur');
    } catch {
      status('Trop lourd pour la sauvegarde automatique : exporte le fichier', true);
    }
    refreshToolbar();
  }, 250);
  const undo = (from, to) => {
    if (!from.length) return;
    to.push(snapshot());
    restore(from.pop());
    lastKey = null;
    renderAll();
    if (!byId(selected)) selected = null;
    save();
    refreshPanels();
  };

  // Modifie la source puis refait le rendu. fn renvoie les slides touchées ('all' pour tout le deck).
  const change = (fn, key) => {
    remember(key);
    const touched = fn();
    if (touched === 'all') renderAll();
    else renderSlides([...new Set(touched)].filter(Boolean));
    save();
  };
  const renderLater = debounce((id) => renderSlides([id]), 120);

  const setAttr = (node, name, value, { key, rebuild } = {}) => {
    const apply = () => {
      if (value === null || value === false || value === undefined) node.removeAttribute(name);
      else node.setAttribute(name, value === true ? '' : value);
    };
    if (node === src) {
      change(() => (apply(), 'all'), key);
    } else if (key) {
      remember(key);
      apply();
      renderLater(slideOf(node).dataset.eid);
      save();
    } else change(() => (apply(), [slideOf(node).dataset.eid]));
    if (rebuild) refreshPanels();
    else refreshRail();
  };
  const setContent = (node, value, kind) => {
    remember(`content-${node.dataset.eid}`);
    if (kind === 'pipe' || kind === 'code') node.textContent = `\n${value}\n`;
    else node.innerHTML = value;
    node.querySelectorAll('*').forEach((n) => { if (n.localName.startsWith('s-')) n.dataset.eid = String(++uid); });
    renderLater(slideOf(node).dataset.eid);
    save();
  };
  const contentOf = (node, kind) => {
    if (kind === 'pipe') return alignRows(parseRows(node.textContent)).join('\n');
    if (kind === 'code') {
      const lines = node.textContent.replace(/^\s*\n|\n\s*$/g, '').split('\n');
      const filled = lines.filter((l) => l.trim());
      const indent = filled.length ? Math.min(...filled.map((l) => l.match(/^\s*/)[0].length)) : 0;
      return lines.map((l) => l.slice(indent)).join('\n');
    }
    return stripIds(node.innerHTML).replace(/\s+/g, ' ').trim();
  };

  // Transfère contenu et attributs compatibles d'un composant à un autre de la même famille
  const TABULAR = new Set(['s-table', 's-matrix']);
  const carry = (from, to) => {
    if (familyOf(from.localName) !== familyOf(to.localName) || !familyOf(to.localName)) return;
    // Tableau et matrice ont une ligne d'en-têtes, les graphiques non : on l'ajoute ou on la retire
    const headers = TABULAR.has(to.localName) !== TABULAR.has(from.localName);
    const names = new Set(['reveal', ...(specOf(to.localName).attrs ?? []).map((a) => a.name)]);
    if (headers) names.delete('highlight');
    [...from.attributes].forEach((a) => names.has(a.name) && to.setAttribute(a.name, a.value));
    const kind = specOf(to.localName).content;
    if ((kind === 'children') !== (specOf(from.localName).content === 'children')) return;
    if (kind === 'pipe' && headers) {
      const rows = parseRows(from.textContent);
      if (TABULAR.has(to.localName)) {
        const width = Math.max(2, ...rows.map((r) => r.length));
        rows.unshift(['Libellé', 'Valeur', 'Note', ...Array(Math.max(0, width - 3)).fill('')].slice(0, width));
      } else rows.shift();
      to.textContent = `\n${alignRows(rows).join('\n')}\n`;
      return;
    }
    to.replaceChildren(...from.childNodes);
  };
  const swapTag = (node, tag) => {
    const next = src.ownerDocument.createElement(tag);
    carry(node, next);
    next.dataset.eid = node.dataset.eid;
    change(() => (node.replaceWith(next), [slideOf(next).dataset.eid]));
    refreshPanels();
  };

  // ---------- Actions sur la sélection ----------
  const selectId = (id) => {
    selected = id;
    refreshPanels();
  };
  const removeSelected = () => {
    const node = byId(selected);
    if (!node) return;
    if (node.localName === 's-slide') return removeSlide(node);
    const slide = slideOf(node);
    change(() => (node.remove(), [slide.dataset.eid]));
    selectId(slide.dataset.eid);
  };
  const duplicateSelected = () => {
    const node = byId(selected);
    if (!node) return;
    const copy = stamp(node.cloneNode(true));
    if (node.localName === 's-slide') {
      change(() => (node.after(copy), 'all'));
      deck.go(deck.index + 1);
    } else change(() => (node.after(copy), [slideOf(node).dataset.eid]));
    selectId(copy.dataset.eid);
  };
  const moveSelected = (dir) => {
    const node = byId(selected);
    if (!node || node.localName === 's-slide') return;
    const sibling = dir < 0 ? node.previousElementSibling : node.nextElementSibling;
    if (!sibling || sibling.localName === 's-top') return;
    change(() => (dir < 0 ? sibling.before(node) : sibling.after(node), [slideOf(node).dataset.eid]));
  };
  const addSlide = (html) => {
    const slide = parse(html);
    const after = currentSlide();
    change(() => (after ? after.after(slide) : src.append(slide), 'all'));
    deck.go(deck.slides.findIndex((s) => s.dataset.eid === slide.dataset.eid));
    selectId(slide.dataset.eid);
  };
  const removeSlide = (slide) => {
    if (src.children.length <= 1) return status('Il faut garder au moins une slide', true);
    const next = slide.nextElementSibling ?? slide.previousElementSibling;
    change(() => (slide.remove(), 'all'));
    selectId(next.dataset.eid);
  };

  // ---------- Glisser-déposer ----------
  // drag = { kind: 'new' | 'move', id, proto, label, before, state, op, touched, ghost }
  let drag = null;

  const startDrag = (kind, { tag, html, id, label, x, y, file }) => {
    const proto = kind === 'new' ? parse(html ?? specOf(tag).html) : null;
    drag = {
      kind, id: proto?.dataset.eid ?? id, proto, file, label,
      before: src.innerHTML, state: snapshot(), op: null, touched: new Set(), previewing: false, changedAt: 0, x, y,
      ghost: h('div', { class: 'ed-ghost' }, label),
    };
    document.body.append(drag.ghost);
    document.body.classList.add('ed-dragging');
    if (kind === 'move') live(drag.id)?.classList.add('ed-moving');
    moveDrag(x, y);
    dragLoop();
  };

  // Où déposer, selon ce qui est sous le pointeur
  const opAt = (x, y) => {
    const hits = document.elementsFromPoint(x, y);
    const railItem = hits.find((n) => n.closest?.('.ed-slide'))?.closest('.ed-slide');
    if (railItem) return { type: 'append', target: railItem.dataset.eid };
    const hit = hits.find((n) => deck.contains(n) && n !== deck);
    const target = hit?.closest('[data-eid]');
    if (!target || !deck.contains(target)) return null;
    // Sur l'aperçu d'un remplacement : on garde l'opération en cours ; sur l'élément déplacé : rien
    const onSelf = drag.id && (target.dataset.eid === drag.id || target.closest(`[data-eid="${drag.id}"]`));
    if (onSelf) return drag.previewing ? 'keep' : null;
    const id = target.dataset.eid;
    const tag = target.localName;
    if (tag === 's-slide') return { type: 'append', target: id };
    const node = byId(id);
    if (!node) return null;
    const rect = target.getBoundingClientRect();
    const horizontal = HORIZONTAL.has(node.parentElement?.localName);
    const f = horizontal ? (x - rect.left) / rect.width : (y - rect.top) / rect.height;
    if (CONTAINERS.has(tag)) return { type: f < 0.2 ? 'before' : f > 0.8 ? 'after' : 'append', target: id };
    if (drag.kind === 'new' && f > 0.3 && f < 0.7) return { type: 'replace', target: id };
    return { type: f < 0.5 ? 'before' : 'after', target: id };
  };

  const applyOp = (op, d = drag) => {
    const target = byId(op.target);
    const node = d.kind === 'move' ? byId(d.id) : d.proto.cloneNode(true);
    const touched = new Set();
    if (!target || !node) return touched;
    if (d.kind === 'move') touched.add(slideOf(node)?.dataset.eid);
    if (op.type === 'before') target.before(node);
    else if (op.type === 'after') target.after(node);
    else if (op.type === 'replace') { carry(target, node); target.replaceWith(node); }
    else if (target.localName === 's-slide') {
      const foot = target.querySelector(':scope > s-foot');
      foot ? foot.before(node) : target.append(node);
    } else target.append(node);
    touched.add(slideOf(node)?.dataset.eid);
    return touched;
  };

  // Remplacement : aperçu en direct (la source repart de l'état initial, le composant prend la place de l'autre).
  // Insertion : une simple ligne, pour ne pas décaler le contenu sous le pointeur.
  const preview = (op) => {
    src.innerHTML = drag.before;
    const touched = op ? applyOp(op) : new Set();
    renderSlides([...new Set([...drag.touched, ...touched])].filter(Boolean));
    drag.touched = touched;
    drag.previewing = !!op;
    live(drag.id)?.classList.add('ed-preview', 'ed-replacing');
  };

  const showMarker = (op) => {
    const marker = ui.marker;
    marker.hidden = true;
    if (!op || op.type === 'replace') return;
    const target = live(op.target);
    if (!target) return;
    const node = byId(op.target);
    let r = (target.localName === 's-slide' ? target.querySelector(':scope > s-body') ?? target : target).getBoundingClientRect();
    marker.className = 'ed-marker';
    if (op.type === 'append') {
      marker.classList.add('box');
      marker.dataset.label = 'Ajouter ici';
    } else {
      const horizontal = HORIZONTAL.has(node?.parentElement?.localName);
      const at = op.type === 'before' ? (horizontal ? r.left - 6 : r.top - 6) : (horizontal ? r.right + 4 : r.bottom + 4);
      r = horizontal ? { left: at, top: r.top, width: 2, height: r.height } : { left: r.left, top: at, width: r.width, height: 2 };
      marker.classList.add('line');
    }
    place(marker, r);
    marker.hidden = false;
  };

  const sameOp = (a, b) => a?.type === b?.type && a?.target === b?.target;
  const moveDrag = (x, y) => {
    drag.x = x;
    drag.y = y;
    drag.ghost.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
  };
  const dragLoop = () => {
    if (!drag) return;
    const now = performance.now();
    const op = opAt(drag.x, drag.y);
    if (op === 'keep') {
      // l'aperçu reste en place
    } else if (drag.previewing && !sameOp(op, drag.op)) {
      // On quitte un aperçu : retour à l'état initial, la cible sera recalculée sur la mise en page d'origine
      preview(null);
      drag.op = null;
    } else if (!sameOp(op, drag.op) && now - drag.changedAt > 90) {
      drag.changedAt = now;
      drag.op = op;
      if (op?.type === 'replace') preview(op);
      drag.ghost.dataset.op = op ? { before: 'Insérer', after: 'Insérer', append: 'Ajouter', replace: 'Remplacer' }[op.type] : '';
    }
    showMarker(drag.op);
    // Près du haut ou du bas de la scène : slide précédente ou suivante
    const r = deck.getBoundingClientRect();
    const edge = drag.y < r.top + 36 ? -1 : drag.y > r.bottom - 36 ? 1 : 0;
    if (edge && drag.x > r.left && drag.x < r.right) {
      drag.edgeSince ??= now;
      if (now - drag.edgeSince > 650) { drag.edgeSince = now; edge < 0 ? deck.prev() : deck.next(); }
    } else drag.edgeSince = null;
    requestAnimationFrame(dragLoop);
  };

  const endDrag = (drop) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.ghost.remove();
    ui.marker.hidden = true;
    document.body.classList.remove('ed-dragging');
    deck.querySelectorAll('.ed-preview, .ed-moving').forEach((n) => n.classList.remove('ed-preview', 'ed-replacing', 'ed-moving'));
    if (drop && d.op && !d.previewing) {
      src.innerHTML = d.before;
      renderSlides([...applyOp(d.op, d)].filter(Boolean));
    }
    if (drop && d.op) {
      past.push(d.state);
      future.length = 0;
      lastKey = null;
      selected = d.id;
      if (d.file) readImage(d.file, (url) => {
        const node = byId(d.id);
        if (!node) return;
        node.setAttribute('src', url);
        node.setAttribute('alt', d.file.name.replace(/\.[^.]+$/, ''));
        node.removeAttribute('ratio');
        renderSlides([slideOf(node).dataset.eid]);
        save();
        refreshPanels();
      });
      save();
      refreshPanels();
    } else if (d.previewing) {
      drag = d;
      preview(null);
      drag = null;
    }
  };

  const readImage = (file, done) => {
    if (file.size > 3e6) status('Image lourde : la sauvegarde automatique risque de ne pas suivre', true);
    const reader = new FileReader();
    reader.onload = () => done(reader.result);
    reader.readAsDataURL(file);
  };

  // Pointeur sur la scène : clic = sélection, glisser = déplacer, double-clic = éditer le texte
  let press = null;
  const onPointerDown = (e) => {
    if (!active || e.button !== 0 || e.target.closest('[contenteditable]')) return;
    const target = e.target.closest('[data-eid]');
    if (!target) return;
    e.preventDefault();
    deck.focus({ preventScroll: true });
    if (document.activeElement !== deck) document.activeElement?.blur?.();
    press = { id: target.dataset.eid, x: e.clientX, y: e.clientY, slide: target.localName === 's-slide' };
  };
  const onPointerMove = (e) => {
    if (drag) return moveDrag(e.clientX, e.clientY);
    if (press && !press.slide && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
      const node = byId(press.id);
      const id = press.id;
      press = null;
      if (node) startDrag('move', { id, label: specOf(node.localName).label, x: e.clientX, y: e.clientY });
      return;
    }
    if (active) hover(e);
  };
  const onPointerUp = () => {
    if (drag) return endDrag(true);
    if (press) selectId(press.id);
    press = null;
  };

  // Fichiers image glissés depuis le bureau
  const onFileDrag = (e) => {
    if (!active || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    if (!drag) startDrag('new', { tag: 's-image', html: '<s-image alt="Image"></s-image>', label: 'Image', x: e.clientX, y: e.clientY, file: true });
    moveDrag(e.clientX, e.clientY);
  };
  const onFileDrop = (e) => {
    if (!drag?.file) return;
    e.preventDefault();
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (!file) return endDrag(false);
    drag.file = file;
    endDrag(true);
  };
  const onFileLeave = (e) => { if (drag?.file && !e.relatedTarget) endDrag(false); };

  // ---------- Édition du texte directement sur la slide ----------
  const inlineEdit = (target) => {
    const node = byId(target.dataset.eid);
    if (!node || specOf(node.localName).content !== 'inline') return false;
    target.setAttribute('contenteditable', 'true');
    target.classList.add('ed-editing');
    target.focus();
    document.getSelection().selectAllChildren(target);
    const id = node.dataset.eid;
    const onInput = () => {
      remember(`inline-${id}`);
      byId(id).innerHTML = target.innerHTML.replace(/<br>$/, '');
      save();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); target.blur(); }
    };
    const onPaste = (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    };
    target.addEventListener('input', onInput);
    target.addEventListener('keydown', onKey);
    target.addEventListener('paste', onPaste);
    target.addEventListener('blur', () => {
      target.removeEventListener('input', onInput);
      target.removeEventListener('keydown', onKey);
      target.removeEventListener('paste', onPaste);
      target.removeAttribute('contenteditable');
      target.classList.remove('ed-editing');
      const slide = slideOf(byId(id));
      if (slide) renderSlides([slide.dataset.eid]);
      refreshPanels();
    }, { once: true });
    return true;
  };
  const onDoubleClick = (e) => {
    if (!active) return;
    const target = e.target.closest('[data-eid]');
    if (target && target.localName !== 's-slide') inlineEdit(target);
  };

  // ---------- Contrôles de l'inspecteur (lignes arrondies façon panneau de propriétés) ----------
  const chevron = () => h('span', { class: 'ed-chevron', 'aria-hidden': 'true' });
  const rowOf = (label, control, cls = '') => h('label', { class: `ed-row ${cls}` }, h('span', { class: 'ed-row-label' }, label), control);

  const control = (node, attr) => {
    const value = node.getAttribute(attr.name);
    const key = `${node.dataset.eid ?? 'deck'}-${attr.name}`;
    if (attr.type === 'toggle') {
      const on = attr.value ? value === attr.value : node.hasAttribute(attr.name) !== !!attr.invert;
      const input = h('input', {
        type: 'checkbox', class: 'ed-switch', role: 'switch', checked: on,
        onchange: (e) => {
          const checked = e.target.checked !== !!attr.invert;
          setAttr(node, attr.name, checked ? (attr.value ?? true) : null);
        },
      });
      return rowOf(attr.label, input, 'ed-row-toggle');
    }
    if (attr.type === 'select') {
      // 'rows' ou 'head' : les choix viennent des données (libellés ou en-têtes), recalculés à l'ouverture
      const optionsNow = () => {
        if (typeof attr.options !== 'string') return attr.options;
        const rows = parseRows(node.textContent);
        const names = attr.options === 'head' ? (rows[0] ?? []).slice(1) : rows.map((r) => r[0]);
        const current = node.getAttribute(attr.name);
        return [['', 'Aucune'], ...names.map((n) => [n, n]), ...(current && !names.includes(current) ? [[current, current]] : [])];
      };
      const current = attr.current ?? value ?? '';
      const fill = () => input.replaceChildren(...optionsNow().map(([v, l]) => h('option', { value: v, selected: v === (attr.current ?? node.getAttribute(attr.name) ?? '') }, l)));
      const shown = h('span', { class: 'ed-select-value' }, (optionsNow().find(([v]) => v === current) ?? optionsNow()[0])[1]);
      const input = h('select', {
        onchange: (e) => {
          shown.textContent = e.target.selectedOptions[0].textContent;
          attr.onChange ? attr.onChange(e.target.value) : setAttr(node, attr.name, e.target.value || null);
        },
      });
      fill();
      if (typeof attr.options === 'string') input.addEventListener('pointerdown', fill);
      return rowOf(attr.label, h('span', { class: 'ed-select' }, shown, chevron(), input), 'ed-row-select');
    }
    if (attr.type === 'range') return rangeRow(node, attr, key);
    if (attr.type === 'image') return imageRow(node, attr);
    const input = h('input', {
      class: 'ed-input', value: value ?? '', placeholder: attr.placeholder ?? '', spellcheck: 'false',
      oninput: (e) => setAttr(node, attr.name, e.target.value === '' ? null : e.target.value, { key }),
      onchange: () => refreshRail(),
    });
    return rowOf(attr.label, input, 'ed-row-text');
  };

  // Curseur : on fait glisser la ligne entière, comme dans le panneau de référence
  const rangeRow = (node, attr, key) => {
    const { min, max } = attr;
    let value = Math.round(parseFloat(String(node.getAttribute(attr.name) ?? min).replace(',', '.'))) || min;
    const output = h('span', { class: 'ed-range-value' });
    const row = h('div', {
      class: 'ed-row ed-range', tabindex: '0', role: 'slider',
      'aria-label': attr.label, 'aria-valuemin': min, 'aria-valuemax': max,
    },
    h('span', { class: 'ed-range-fill' }),
    h('span', { class: 'ed-row-label' }, attr.label),
    h('span', { class: 'ed-range-ticks', style: `--steps: ${max - min}` }),
    output);
    const show = () => {
      row.style.setProperty('--p', (value - min) / (max - min));
      row.setAttribute('aria-valuenow', value);
      output.textContent = value === min ? '—' : value;
    };
    const set = (v) => {
      const next = Math.min(max, Math.max(min, Math.round(v)));
      if (next === value) return;
      value = next;
      show();
      setAttr(node, attr.name, value === min ? null : String(value), { key });
    };
    const fromPointer = (e) => {
      const r = row.getBoundingClientRect();
      set(min + ((e.clientX - r.left) / r.width) * (max - min));
    };
    row.addEventListener('pointerdown', (e) => {
      row.setPointerCapture(e.pointerId);
      fromPointer(e);
      row.onpointermove = fromPointer;
    });
    row.addEventListener('pointerup', () => { row.onpointermove = null; });
    row.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (step) { e.preventDefault(); e.stopPropagation(); set(value + step); }
    });
    show();
    return row;
  };

  const imageRow = (node, attr) => {
    const value = node.getAttribute(attr.name) ?? '';
    const embedded = value.startsWith('data:');
    const file = h('input', {
      type: 'file', accept: 'image/*', hidden: true,
      onchange: (e) => {
        const f = e.target.files[0];
        if (!f) return;
        readImage(f, (url) => {
          change(() => {
            node.setAttribute('src', url);
            if (!node.getAttribute('alt') || node.getAttribute('alt') === 'Image') node.setAttribute('alt', f.name.replace(/\.[^.]+$/, ''));
            return [slideOf(node).dataset.eid];
          });
          refreshPanels();
        });
      },
    });
    const input = h('input', {
      class: 'ed-input', value: embedded ? `Image intégrée (${Math.round(value.length / 1365)} Ko)` : value,
      placeholder: 'images/photo.png', spellcheck: 'false', readonly: embedded,
      oninput: (e) => setAttr(node, 'src', e.target.value || null, { key: `${node.dataset.eid}-src` }),
    });
    return h('div', { class: 'ed-row ed-row-image' },
      h('span', { class: 'ed-row-label' }, attr.label), input,
      h('button', { type: 'button', class: 'ed-mini', onclick: () => file.click() }, 'Choisir…'), file);
  };

  const contentRow = (node, kind, hint) => {
    const value = contentOf(node, kind);
    const area = h('textarea', {
      class: `ed-textarea ${kind === 'pipe' || kind === 'code' ? 'mono' : ''}`, spellcheck: kind === 'rich' || kind === 'inline' ? 'true' : 'false',
      rows: String(Math.min(12, Math.max(2, value.split('\n').length + 1))), value,
      oninput: (e) => setContent(node, e.target.value, kind),
      onchange: () => refreshRail(),
    });
    area.addEventListener('keydown', (e) => e.stopPropagation());
    const label = { pipe: 'Données', code: 'Code', rich: 'Texte', inline: 'Texte' }[kind];
    return h('div', { class: 'ed-row ed-col' },
      h('span', { class: 'ed-row-label' }, label, hint ? h('small', {}, ` · ${hint}`) : null), area);
  };

  const section = (title, ...rows) => h('section', { class: 'ed-section' }, h('h3', { class: 'ed-section-title' }, title), rows);
  const buttons = (...list) => h('div', { class: 'ed-buttons' }, list.map(([label, fn, danger]) => h('button', { type: 'button', class: `ed-button ${danger ? 'danger' : ''}`, onclick: fn }, label)));

  // ---------- Panneaux ----------
  const refreshInspector = () => {
    const node = byId(selected);
    const slide = slideOf(node) ?? currentSlide();
    const parts = [];
    if (node && node !== slide) {
      const spec = specOf(node.localName);
      const family = familyOf(node.localName);
      // Changer de composant garde le contenu (ex. barres -> colonnes -> tableau)
      const typeRow = family
        ? control(node, {
          name: 'type', label: 'Composant', type: 'select', current: node.localName,
          options: family.map((t) => [t, specOf(t).label]), onChange: (tag) => swapTag(node, tag),
        })
        : rowOf('Composant', h('span', { class: 'ed-static' }, spec.label));
      parts.push(section('Composant',
        typeRow,
        (spec.attrs ?? []).map((a) => control(node, a)),
        spec.content !== 'none' && spec.content !== 'children' ? contentRow(node, spec.content, spec.hint) : null,
        spec.content === 'children' ? h('p', { class: 'ed-hint' }, 'Glisse des composants dedans depuis la liste de gauche.') : null,
        control(node, REVEAL),
        buttons(['Dupliquer', duplicateSelected], ['Supprimer', removeSelected, true])));
    }
    if (slide) {
      parts.push(section(`Slide ${[...src.children].indexOf(slide) + 1}`,
        SLIDE_ATTRS.map((a) => control(slide, a)),
        buttons(['Dupliquer', () => { selected = slide.dataset.eid; duplicateSelected(); }], ['Supprimer', () => removeSlide(slide), true])));
    }
    const title = h('input', {
      class: 'ed-input', value: document.title, spellcheck: 'false',
      oninput: (e) => { remember('title'); document.title = e.target.value; save(); },
    });
    parts.push(section('Présentation',
      rowOf('Titre de l’onglet', title, 'ed-row-text'),
      DECK_ATTRS.map((a) => control(src, a))));
    ui.inspector.replaceChildren(...parts);
  };

  const labelOf = (slide) => slide.getAttribute('tag') || slide.querySelector('s-title, s-heading')?.textContent.trim() || 'Sans titre';
  const refreshRail = () => {
    const current = deck.slides[deck.index]?.dataset.eid;
    const selectedSlide = slideOf(byId(selected))?.dataset.eid;
    ui.rail.replaceChildren(...[...src.children].map((slide, i) => {
      const id = slide.dataset.eid;
      const item = h('div', {
        class: `ed-slide ${id === current ? 'current' : ''} ${id === selectedSlide ? 'selected' : ''}`,
        draggable: 'true', 'data-eid': id, title: 'Glisser pour réordonner',
        onclick: () => { deck.go(i); selectId(id); },
      },
      h('span', { class: 'ed-slide-num' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'ed-slide-label' }, labelOf(slide)),
      slide.getAttribute('tone') === 'dark' ? h('span', { class: 'ed-slide-dark', title: 'Fond sombre' }) : null);
      item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-deckard-slide', id); e.dataTransfer.effectAllowed = 'move'; item.classList.add('dragging'); });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('text/x-deckard-slide')) return;
        e.preventDefault();
        const r = item.getBoundingClientRect();
        item.dataset.drop = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
      });
      item.addEventListener('dragleave', () => delete item.dataset.drop);
      item.addEventListener('drop', (e) => {
        const moved = byId(e.dataTransfer.getData('text/x-deckard-slide'));
        const where = item.dataset.drop;
        delete item.dataset.drop;
        if (!moved || moved === slide) return;
        e.preventDefault();
        change(() => (where === 'before' ? slide.before(moved) : slide.after(moved), 'all'));
        deck.go([...src.children].indexOf(moved), false);
        selectId(moved.dataset.eid);
      });
      return item;
    }));
  };

  const refreshToolbar = () => {
    ui.undo.disabled = !past.length;
    ui.redo.disabled = !future.length;
  };
  const refreshPanels = () => {
    refreshRail();
    refreshInspector();
    refreshToolbar();
  };

  let statusTimer;
  const status = (message, warn = false) => {
    if (!ui) return;
    ui.status.textContent = message;
    ui.status.classList.toggle('warn', warn);
    clearTimeout(statusTimer);
    if (!warn) statusTimer = setTimeout(() => { ui.status.textContent = deck.restored || past.length ? 'Modifications gardées dans ce navigateur' : ''; }, 2500);
  };

  // ---------- Fichier ----------
  const exportHTML = () => {
    const head = [...document.head.children]
      .filter((n) => !n.hasAttribute('data-deckard-editor'))
      .map((n) => `  ${n.outerHTML.replace(/=""/g, '')}`).join('\n');
    return `<!doctype html>\n<html lang="${document.documentElement.lang || 'fr'}">\n<head>\n${head}\n</head>\n<body>\n${serialize(src)}\n</body>\n</html>\n`;
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportHTML()], { type: 'text/html' }));
    h('a', { href: url, download: 'index.html' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('index.html téléchargé : remplace l’ancien fichier par celui-ci');
  };
  const copy = async () => {
    const html = exportHTML();
    try {
      await navigator.clipboard.writeText(html);
    } catch {
      const area = h('textarea', { value: html });
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    status('HTML copié');
  };
  const resetToFile = () => {
    if (!confirm('Oublier les modifications faites ici et revenir au fichier index.html ?')) return;
    localStorage.removeItem(STORE_KEY);
    location.reload();
  };
  const newDeck = () => {
    if (!confirm('Repartir d’une présentation vide ? (Annuler reste possible)')) return;
    change(() => {
      src.replaceChildren(parse(SLIDES[2][1]), parse(SLIDES[1][1]), parse(SLIDES[7][1]));
      return 'all';
    });
    deck.go(0, false);
    selectId(src.firstElementChild.dataset.eid);
  };

  // ---------- Survol et sélection sur la scène ----------
  let hovered = null;
  const hover = (e) => {
    const target = e.target.closest?.('[data-eid]');
    hovered = target && deck.contains(target) && target.localName !== 's-slide' ? target : null;
  };
  const place = (box, r) => Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const overlayLoop = () => {
    if (!active) return;
    const target = live(selected);
    const stage = deck.getBoundingClientRect();
    const show = target && target.localName !== 's-slide' && !drag;
    ui.selection.hidden = ui.bar.hidden = !show;
    if (show) {
      const r = target.getBoundingClientRect();
      const visible = r.bottom > stage.top && r.top < stage.bottom;
      ui.selection.hidden = ui.bar.hidden = !visible;
      place(ui.selection, r);
      const barTop = r.top - 38 < stage.top + 4 ? r.bottom + 6 : r.top - 38;
      ui.bar.style.transform = `translate(${Math.max(stage.left + 4, r.left)}px, ${barTop}px)`;
      ui.barLabel.textContent = specOf(target.localName).label;
    }
    const showHover = hovered?.isConnected && !drag && hovered.dataset.eid !== selected;
    ui.hover.hidden = !showHover;
    if (showHover) {
      place(ui.hover, hovered.getBoundingClientRect());
      ui.hover.dataset.label = specOf(hovered.localName).label;
    }
    requestAnimationFrame(overlayLoop);
  };

  // ---------- Clavier ----------
  const onKey = (e) => {
    if (!active) return;
    const mod = e.metaKey || e.ctrlKey;
    if (isTyping(e.target)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const key = e.key.toLowerCase();
    const onStage = e.target === document.body || e.target === deck;
    if (!onStage && !mod && e.key !== 'Escape') return;
    if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? undo(future, past) : undo(past, future); } else if (mod && key === 'y') { e.preventDefault(); undo(future, past); } else if (mod && key === 'd') { e.preventDefault(); duplicateSelected(); } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeSelected(); } else if (e.key === 'Escape') {
      if (drag) endDrag(false);
      else selectId(slideOf(byId(selected))?.dataset.eid ?? null);
    } else if (e.key === 'Enter' && selected) {
      const target = live(selected);
      if (target && inlineEdit(target)) e.preventDefault();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveSelected(e.key === 'ArrowUp' ? -1 : 1);
    }
  };

  // ---------- Construction de l'interface ----------
  const icon = (name) => h('span', { class: `ed-icon ed-icon-${name}`, 'aria-hidden': 'true' });
  const build = () => {
    const undoBtn = h('button', { type: 'button', class: 'ed-tool', title: 'Annuler (Cmd/Ctrl + Z)', onclick: () => undo(past, future) }, icon('undo'));
    const redoBtn = h('button', { type: 'button', class: 'ed-tool', title: 'Rétablir (Maj + Cmd/Ctrl + Z)', onclick: () => undo(future, past) }, icon('redo'));
    const menu = h('div', { class: 'ed-menu', hidden: true },
      SLIDES.map(([label, html]) => h('button', { type: 'button', onclick: () => { menu.hidden = true; addSlide(html); } }, label)));
    const addBtn = h('button', { type: 'button', class: 'ed-tool ed-add', title: 'Ajouter une slide', onclick: (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; } }, '+');
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.hidden = true; });

    const groups = {};
    Object.entries(SPECS).forEach(([tag, spec]) => (groups[spec.group] ??= []).push([tag, spec]));
    const palette = Object.entries(groups).map(([group, items]) => h('div', { class: 'ed-group' },
      h('h4', {}, group),
      h('div', { class: 'ed-chips' }, items.map(([tag, spec]) => {
        const chip = h('button', { type: 'button', class: 'ed-chip', title: `${spec.label} : glisser sur une slide, ou cliquer pour l’ajouter à la slide courante` },
          h('span', { class: 'ed-chip-icon' }, spec.icon), h('span', { class: 'ed-chip-label' }, spec.label));
        chip.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const start = { x: e.clientX, y: e.clientY };
          const move = (m) => {
            if (Math.hypot(m.clientX - start.x, m.clientY - start.y) < 5) return;
            cleanup();
            startDrag('new', { tag, label: spec.label, x: m.clientX, y: m.clientY });
          };
          const up = () => {
            cleanup();
            const slide = currentSlide();
            if (!slide) return;
            const node = parse(spec.html);
            change(() => {
              const foot = slide.querySelector(':scope > s-foot');
              foot ? foot.before(node) : slide.append(node);
              return [slide.dataset.eid];
            });
            selectId(node.dataset.eid);
          };
          const cleanup = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
          addEventListener('pointermove', move);
          addEventListener('pointerup', up);
        });
        return chip;
      }))));

    const left = h('aside', { class: 'ed-panel ed-left' },
      h('header', { class: 'ed-head' },
        h('span', { class: 'ed-brand' }, '✱ Deckard'),
        h('span', { class: 'ed-tools' }, undoBtn, redoBtn)),
      h('div', { class: 'ed-section-title ed-rail-title' }, 'Slides', h('span', { class: 'ed-rel' }, addBtn, menu)),
      h('div', { class: 'ed-rail' }),
      h('div', { class: 'ed-palette' },
        h('div', { class: 'ed-section-title' }, 'Composants'),
        h('p', { class: 'ed-hint' }, 'Glisse sur une slide. Au centre d’un composant, il le remplace.'),
        palette));

    const right = h('aside', { class: 'ed-panel ed-right' },
      h('header', { class: 'ed-head' },
        h('button', { type: 'button', class: 'ed-button primary', onclick: () => DeckardEditor.toggle(deck) }, 'Présenter'),
        h('button', { type: 'button', class: 'ed-button', onclick: download, title: 'Télécharger le nouvel index.html' }, 'Exporter')),
      h('div', { class: 'ed-inspector' }),
      h('section', { class: 'ed-section ed-file' },
        h('h3', { class: 'ed-section-title' }, 'Fichier'),
        buttons(['Copier le HTML', copy], ['Nouvelle présentation', newDeck]),
        buttons(['Revenir au fichier d’origine', resetToFile, true]),
        h('p', { class: 'ed-status', 'aria-live': 'polite' })));

    const barLabel = h('span', { class: 'ed-bar-label' });
    const handle = h('button', { type: 'button', class: 'ed-bar-handle', title: 'Glisser pour déplacer' }, '⠿');
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const node = byId(selected);
      if (node) startDrag('move', { id: selected, label: specOf(node.localName).label, x: e.clientX, y: e.clientY });
    });
    const bar = h('div', { class: 'ed-bar' }, handle, barLabel,
      h('button', { type: 'button', title: 'Monter (Alt + ↑)', onclick: () => moveSelected(-1) }, '↑'),
      h('button', { type: 'button', title: 'Descendre (Alt + ↓)', onclick: () => moveSelected(1) }, '↓'),
      h('button', { type: 'button', title: 'Dupliquer (Cmd/Ctrl + D)', onclick: duplicateSelected }, '⧉'),
      h('button', { type: 'button', title: 'Supprimer (Suppr)', onclick: removeSelected }, '✕'));

    ui = {
      root: h('div', { class: 'ed-root' }, left, right, h('div', { class: 'ed-hover', hidden: true }), h('div', { class: 'ed-selection', hidden: true }), h('div', { class: 'ed-marker', hidden: true }), bar),
      rail: left.querySelector('.ed-rail'), inspector: right.querySelector('.ed-inspector'), status: right.querySelector('.ed-status'),
      undo: undoBtn, redo: redoBtn, bar, barLabel,
    };
    ui.hover = ui.root.querySelector('.ed-hover');
    ui.selection = ui.root.querySelector('.ed-selection');
    ui.marker = ui.root.querySelector('.ed-marker');
  };

  const init = (d) => {
    deck = d;
    const tpl = document.createElement('template');
    tpl.innerHTML = `<s-deck>${deck.sourceHTML ?? deck.innerHTML}</s-deck>`;
    src = tpl.content.firstElementChild;
    [...deck.attributes].forEach((a) => !['tabindex', 'style', 'class'].includes(a.name) && src.setAttribute(a.name, a.value));
    [...src.querySelectorAll('*')].forEach((n) => { if (n.localName.startsWith('s-')) n.dataset.eid = String(++uid); });
    build();
    deck.addEventListener('pointerdown', onPointerDown);
    deck.addEventListener('dblclick', onDoubleClick);
    deck.addEventListener('slidechange', () => active && refreshRail());
    addEventListener('pointermove', onPointerMove);
    addEventListener('pointerup', onPointerUp);
    addEventListener('keydown', onKey);
    addEventListener('dragover', onFileDrag);
    addEventListener('drop', onFileDrop);
    addEventListener('dragleave', onFileLeave);
    // Premier rendu : les slides affichées reçoivent leur data-eid
    renderAll();
  };

  globalThis.DeckardEditor = {
    toggle(d) {
      if (!src) init(d);
      active = !active;
      document.body.classList.toggle('ed-on', active);
      if (active) {
        document.body.append(ui.root);
        selected ??= currentSlide()?.dataset.eid;
        refreshPanels();
        status(deck.restored ? 'Modifications gardées dans ce navigateur' : 'Tout est enregistré automatiquement');
        overlayLoop();
      } else {
        document.activeElement?.blur();
        ui.root.remove();
        deck.focus({ preventScroll: true });
      }
      requestAnimationFrame(() => deck.go(Math.max(deck.index, 0), false));
    },
  };
})();
