/*
  Deckard : composants de présentation. Voir index.html pour l'usage de chacun.
  API : deck.next(), deck.prev(), deck.go(index), deck.fit(slide?) (réajuste une slide ou toutes après un changement de contenu),
        deck.refresh() (après ajout ou retrait de slides), deck.edit() (ouvre ou ferme l'éditeur, touche « e »)
  Événement : "slidechange" avec detail { index, slide }
*/
// Hors navigateur (tests avec bun), les composants ne sont pas déclarés
const Base = globalThis.HTMLElement ?? class {};
const el = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text ?? '' });

// Source du deck avant rendu, utilisée par l'éditeur (edit.js, chargé à la demande).
// Les modifications faites dans l'éditeur sont gardées dans le navigateur tant que index.html ne change pas.
const SCRIPT_URL = globalThis.document?.currentScript?.src;
const STORE_KEY = `deckard:${globalThis.location?.pathname}`;
const hashText = (t) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7).toString(36);
const deckNode = globalThis.document?.querySelector('s-deck');
if (deckNode) {
  deckNode.fileHash = hashText(document.title + deckNode.outerHTML);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved?.file === deckNode.fileHash) {
      [...deckNode.attributes].forEach((a) => deckNode.removeAttribute(a.name));
      saved.attrs.forEach(([name, value]) => deckNode.setAttribute(name, value));
      deckNode.innerHTML = saved.html;
      if (saved.title) document.title = saved.title;
      deckNode.restored = true;
    }
  } catch { /* stockage indisponible : on garde le fichier */ }
  deckNode.sourceHTML = deckNode.innerHTML;
}

// Composant simple : render(element) appelé une seule fois
const define = (name, render) =>
  globalThis.customElements?.define(name, class extends Base {
    connectedCallback() {
      if (this.rendered) return;
      this.rendered = true;
      render(this);
    }
  });

const heading = (level) => (c) => {
  c.setAttribute('role', 'heading');
  c.setAttribute('aria-level', level);
};
define('s-title', heading('1'));
define('s-heading', heading('2'));

define('s-card', (c) => {
  if (c.hasAttribute('heading')) c.prepend(el('div', 's-card-heading', c.getAttribute('heading')));
});

define('s-stat', (c) => {
  c.append(el('div', 's-stat-value', c.getAttribute('value')), el('div', 's-stat-label', c.getAttribute('label')));
  const delta = c.getAttribute('delta');
  if (!delta) return;
  const badge = el('div', 's-stat-delta', delta);
  badge.dataset.sign = /^[-−]/.test(delta) ? 'neg' : 'pos';
  c.append(badge);
});

define('s-quote', (c) => {
  const figure = el('figure');
  const quote = el('blockquote');
  quote.append(...c.childNodes);
  figure.append(quote);
  if (c.hasAttribute('by')) figure.append(el('figcaption', '', c.getAttribute('by')));
  c.append(figure);
});

// Image : src, alt, caption. ratio="16/9" recadre (fit="contain" pour ne rien couper).
// Sans src ou si le fichier est introuvable, un cadre « À compléter » prend sa place.
define('s-image', (c) => {
  const figure = el('figure');
  const frame = el('div', 's-image-frame');
  const alt = c.getAttribute('alt') ?? '';
  const ratio = c.getAttribute('ratio');
  if (ratio) frame.style.setProperty('--ratio', ratio.replace(':', '/'));
  const missing = () => {
    c.setAttribute('missing', '');
    frame.replaceChildren(el('span', 's-image-missing', alt ? `À compléter : ${alt}` : 'Image à compléter'));
  };
  const src = c.getAttribute('src');
  if (src) {
    const img = Object.assign(document.createElement('img'), { src, alt, loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', missing, { once: true });
    frame.append(img);
  } else missing();
  figure.append(frame);
  if (c.hasAttribute('caption')) figure.append(el('figcaption', '', c.getAttribute('caption')));
  c.replaceChildren(figure);
});

// Syntaxe "a | b | c" : une ligne = une rangée, les lignes "---|---" sont ignorées
const rows = (c) =>
  c.textContent.split('\n').map((l) => l.trim())
    .filter((l) => l && !/^[|\s:-]+$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
const minus = (t) => String(t).replace(/−/g, '-');
const toNumber = (t) => parseFloat(minus(t).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
const format = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const isNumeric = (t) => /^[-+−]?[€$£]?\s?\d[\d\s.,]*\s?[%€$£a-zA-Z/]{0,6}$/.test(t);

// Tableau et matrice : même syntaxe, la matrice remplace oui / non / partiel par des symboles
// et, avec max="5", affiche les chiffres comme des scores (valeur + jauge)
const MARKS = { yes: '✓', oui: '✓', no: '✕', non: '✕', partial: '◐', partiel: '◐' };
const MARK_TEXT = { '✓': 'oui', '✕': 'non', '◐': 'partiel' };
const markOf = (text) => (Object.hasOwn(MARKS, text.toLowerCase()) ? MARKS[text.toLowerCase()] : null);
// Part du score entre 0 et 1 ("4" sur 5 -> 0,8), null si la cellule n'est pas un nombre
const scoreOf = (text, max) => {
  if (!(max > 0) || !isNumeric(text)) return null;
  return Math.min(1, Math.max(0, toNumber(text) / max));
};
const renderTable = (c, matrix) => {
  const [head = [], ...body] = rows(c);
  const highlight = head.indexOf(c.getAttribute('highlight'));
  const max = toNumber(c.getAttribute('max') ?? '');
  const numeric = head.map((_, i) => !matrix && body.length > 0 && body.every((r) => isNumeric(r[i] ?? '')));
  const row = (cells, tag) => {
    const tr = document.createElement('tr');
    cells.forEach((text, i) => {
      const mark = matrix && i > 0 && tag === 'td' && markOf(text);
      const score = matrix && i > 0 && tag === 'td' && !mark ? scoreOf(text, max) : null;
      const cell = el(tag, '', mark || score !== null ? '' : text);
      if (mark) {
        cell.className = 'mark';
        cell.title = text;
        cell.append(Object.assign(el('span', '', mark), { ariaHidden: 'true' }), el('span', 's-sr', MARK_TEXT[mark]));
      } else if (score !== null) {
        cell.className = 'score';
        cell.title = `${text} / ${format(max)}`;
        const gauge = Object.assign(el('span', 's-score-gauge'), { ariaHidden: 'true' });
        gauge.style.setProperty('--v', score);
        cell.append(el('span', 's-score-value', text), el('span', 's-sr', ` sur ${format(max)}`), gauge);
      } else if (numeric[i] || (matrix && i > 0 && tag === 'td' && isNumeric(text))) cell.className = 'num';
      if (i === highlight) cell.classList.add('hl');
      tr.append(cell);
    });
    return tr;
  };
  const table = document.createElement('table');
  table.createTHead().append(row(head, 'th'));
  table.createTBody().append(...body.map((r) => row(r, 'td')));
  c.replaceChildren(table);
};
define('s-table', (c) => renderTable(c, false));
define('s-matrix', (c) => renderTable(c, true));

// Détail de prix : "libellé | montant | note", total calculé
define('s-price', (c) => {
  const currency = c.getAttribute('currency') ?? '€';
  const period = c.getAttribute('period') ?? '';
  const lines = rows(c);
  const total = lines.reduce((sum, [, value]) => sum + toNumber(value), 0);
  const line = (label, value, note = '', cls = '') => {
    const r = el('div', `s-price-row ${cls}`);
    r.append(el('span', '', label), el('span', 's-price-note', note), el('span', 'num', `${format(value)} ${currency}`));
    return r;
  };
  c.replaceChildren(
    ...lines.map(([label, value, note]) => line(label, toNumber(value), note)),
    line(c.getAttribute('total-label') ?? 'Total', total, period, 's-price-total'),
  );
});

// Barres horizontales : "libellé | valeur", highlight="libellé" met une barre en avant
define('s-bars', (c) => {
  const unit = c.getAttribute('unit') ?? '';
  const highlight = c.getAttribute('highlight');
  const data = rows(c).map(([label, value]) => [label, toNumber(value)]);
  const max = Math.max(...data.map(([, v]) => v), 0) || 1;
  c.replaceChildren(...data.map(([label, value]) => {
    const bar = el('div', 's-bar');
    if (highlight && label !== highlight) bar.classList.add('dim');
    const track = el('div', 's-bar-track');
    const fill = el('div', 's-bar-fill');
    fill.style.setProperty('--w', value / max);
    track.append(fill);
    bar.title = `${label} : ${format(value)} ${unit}`.trim();
    bar.append(el('span', 's-bar-label', label), track, el('span', 'num', `${format(value)} ${unit}`.trim()));
    return bar;
  }));
});

// Schéma d'architecture : <s-flow> contient des <s-node sub="...">, flèches ajoutées entre eux
define('s-node', (c) => {
  if (c.hasAttribute('sub')) c.append(el('span', 's-node-sub', c.getAttribute('sub')));
});
define('s-flow', (c) => {
  [...c.children].slice(1).forEach((node) => {
    node.before(Object.assign(el('span', 's-flow-arrow', '→'), { ariaHidden: 'true' }));
  });
});

// Roadmap : <s-roadmap> contient des <s-phase label="Phase 1">texte</s-phase>, reliées en pointillés
define('s-phase', (c) => {
  const head = el('div', 's-phase-head');
  head.append(el('span', 's-pill', c.getAttribute('label')), Object.assign(el('span', 's-phase-line'), { ariaHidden: 'true' }));
  const text = el('div', 's-phase-text');
  text.append(...c.childNodes);
  c.append(head, text);
});

// Info de couverture : <s-info label="Date">Mars 2026</s-info>
define('s-info', (c) => c.prepend(el('span', 's-info-label', c.getAttribute('label'))));

// Tendance : "libellé | valeur | description", courbe tracée depuis les valeurs (k, M, B acceptés)
const toAmount = (t) => {
  const m = minus(t).replace(/\s/g, '').replace(',', '.').match(/(-?\d+(?:\.\d+)?)([kmb])?/i);
  return m ? parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]?.toLowerCase()] ?? 1) : 0;
};
define('s-trend', (c) => {
  const data = rows(c);
  const values = data.map(([, value]) => toAmount(value));
  const max = Math.max(...values, 0) || 1;
  const x = (i) => ((i + 0.1) / data.length) * 100;
  const y = (v) => 100 - (v / max) * 88;
  const chart = el('div', 's-trend-chart');
  chart.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    ${[12, 34, 56, 78].map((g) => `<line class="s-trend-grid" x1="0" x2="100" y1="${g}" y2="${g}"/>`).join('')}
    <line class="s-trend-base" x1="0" x2="100" y1="100" y2="100"/>
    <polyline class="s-trend-line" points="${values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>
  </svg>`;
  values.forEach((v, i) => {
    const dot = el('span', 's-trend-dot');
    Object.assign(dot.style, { left: `${x(i)}%`, top: `${y(v)}%` });
    dot.title = `${data[i][0]} : ${data[i][1]}`;
    chart.append(dot);
  });
  const cols = el('div', 's-trend-cols');
  cols.style.setProperty('--n', data.length);
  data.forEach(([label, value, desc]) => {
    const col = el('div', 's-trend-col');
    col.append(el('span', 's-trend-label', label), el('span', 's-stat-value', value), el('span', 's-trend-desc', desc));
    cols.append(col);
  });
  c.replaceChildren(chart, cols);
});

// Arrondi "propre" pour les axes : 0,8 -> 1 ; 37 -> 50 ; 1200 -> 2000
const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
};
const pct = (v, max) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;

// Nuage de points : "libellé | x | y | left?"
// Attributs : x, y (noms des axes), x-max, y-max, highlight, quadrants="haut-gauche | haut-droite | bas-gauche | bas-droite"
define('s-scatter', (c) => {
  const data = rows(c).map(([label, x, y, side]) => ({ label, x: toAmount(x), y: toAmount(y), side }));
  const xMax = toAmount(c.getAttribute('x-max')) || niceMax(Math.max(...data.map((d) => d.x)));
  const yMax = toAmount(c.getAttribute('y-max')) || niceMax(Math.max(...data.map((d) => d.y)));
  const highlight = c.getAttribute('highlight');
  const plot = el('div', 's-scatter-plot');
  const place = (node, styles) => (Object.assign(node.style, styles), plot.append(node));

  [0.25, 0.5, 0.75, 1].forEach((f) => {
    place(el('span', 's-scatter-grid'), { bottom: `${f * 100}%` });
    place(el('span', 's-scatter-tick y', format(yMax * f)), { bottom: `${f * 100}%` });
    place(el('span', 's-scatter-tick x', format(xMax * f)), { left: `${f * 100}%` });
  });

  const quadrants = c.getAttribute('quadrants')?.split('|').map((q) => q.trim());
  if (quadrants) {
    const xSplit = toAmount(c.getAttribute('x-split')) || xMax / 2;
    const ySplit = toAmount(c.getAttribute('y-split')) || yMax / 2;
    place(el('span', 's-scatter-split x'), { left: pct(xSplit, xMax) });
    place(el('span', 's-scatter-split y'), { bottom: pct(ySplit, yMax) });
    quadrants.forEach((q, i) => place(el('span', `s-quadrant q${i}`, q), {}));
  }

  data.forEach(({ label, x, y, side }, i) => {
    const point = el('div', 's-point');
    if (highlight) point.classList.add(label === highlight ? 'hl' : 'dim');
    // Près du bord droit, le nom passe à gauche du point pour ne pas sortir du graphique
    if (side === 'left' || (side !== 'right' && x / xMax > 0.72)) point.classList.add('left');
    point.style.setProperty('--j', i);
    const dot = el('span', 's-point-dot');
    dot.title = `${label} : ${c.getAttribute('x') ?? 'x'} ${format(x)}, ${c.getAttribute('y') ?? 'y'} ${format(y)}`;
    point.append(dot, el('span', 's-point-label', label));
    place(point, { left: pct(x, xMax), bottom: pct(y, yMax) });
  });

  c.replaceChildren(el('span', 's-scatter-axis', c.getAttribute('y')), plot, el('span', 's-scatter-axis x', c.getAttribute('x')));
});

// Colonnes verticales : "libellé | valeur", attributs unit et highlight
define('s-vbars', (c) => {
  const unit = c.getAttribute('unit') ?? '';
  const highlight = c.getAttribute('highlight');
  const data = rows(c).map(([label, value]) => [label, toNumber(value)]);
  const max = Math.max(...data.map(([, v]) => v), 0) || 1;
  c.style.setProperty('--n', data.length);
  c.replaceChildren(...data.map(([label, value]) => {
    const col = el('div', 's-vbar');
    if (highlight && label !== highlight) col.classList.add('dim');
    col.title = `${label} : ${format(value)} ${unit}`.trim();
    const track = el('div', 's-vbar-track');
    const fill = el('div', 's-vbar-fill');
    fill.style.setProperty('--h', value / max);
    track.append(el('span', 's-vbar-value', `${format(value)} ${unit}`.trim()), fill);
    col.append(track, el('span', 's-vbar-label', label));
    return col;
  }));
});

// Répartition (100 %) : "libellé | valeur", 5 parts max, le reste passe dans "Autres"
define('s-share', (c) => {
  const unit = c.getAttribute('unit') ?? '';
  let data = rows(c).map(([label, value]) => [label, toNumber(value)]);
  if (data.length > 5) data = [...data.slice(0, 4), ['Autres', data.slice(4).reduce((s, [, v]) => s + v, 0)]];
  const total = data.reduce((s, [, v]) => s + v, 0) || 1;
  const bar = el('div', 's-share-bar');
  const legend = el('div', 's-share-legend');
  data.forEach(([label, value]) => {
    const seg = el('span', 's-share-seg');
    seg.style.flexGrow = value / total;
    seg.title = `${label} : ${format(value)} ${unit}`.trim();
    bar.append(seg);
    const item = el('div', 's-share-item');
    item.append(el('span', 's-share-swatch'), el('span', '', label), el('span', 's-share-value', `${format(value)} ${unit}`.trim()));
    legend.append(item);
  });
  c.replaceChildren(bar, legend);
});

// Encadré : type="note" ou "warn", label modifiable
define('s-callout', (c) => {
  const label = c.getAttribute('label') ?? (c.getAttribute('type') === 'warn' ? 'Attention' : 'Note');
  c.prepend(el('span', 's-pill', label));
});

// Code : indentation retirée automatiquement, file="main.tf" ajoute un en-tête
define('s-code', (c) => {
  const lines = c.textContent.replace(/^\s*\n|\n\s*$/g, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
  const pre = el('pre', '', lines.map((l) => l.slice(indent)).join('\n'));
  c.replaceChildren(...(c.hasAttribute('file') ? [el('div', 's-code-file', c.getAttribute('file'))] : []), pre);
});

// Slide : en-tête auto si tag="...", contenu regroupé dans <s-body>, apparition en cascade
const CONTAINERS = new Set(['s-top', 's-body', 's-foot', 's-columns', 's-grid', 's-list', 's-flow', 's-roadmap']);
define('s-slide', (slide) => {
  const body = document.createElement('s-body');
  body.append(...[...slide.childNodes].filter((n) => !['s-top', 's-foot'].includes(n.localName)));
  slide.querySelector(':scope > s-foot') ? slide.querySelector(':scope > s-foot').before(body) : slide.append(body);

  if (slide.hasAttribute('tag') && !slide.querySelector(':scope > s-top')) {
    const top = document.createElement('s-top');
    const pill = document.createElement('s-pill');
    pill.textContent = slide.getAttribute('tag');
    top.append(document.createElement('s-arrow'), pill);
    const fine = (slide.closest('s-deck') ?? document.querySelector('s-deck'))?.getAttribute('fine');
    if (fine) top.append(Object.assign(document.createElement('s-fine'), { textContent: fine }));
    top.lastChild.toggleAttribute('push', !!fine);
    slide.prepend(top);
  }

  const blocks = [];
  const walk = (parent) => {
    for (const child of parent.children) CONTAINERS.has(child.localName) ? walk(child) : blocks.push(child);
  };
  walk(slide);
  blocks.forEach((block, i) => {
    if (!block.hasAttribute('reveal')) block.setAttribute('reveal', slide.getAttribute('reveal') ?? 'up');
    block.style.setProperty('--i', i);
  });
});

// Une slide fait toujours un écran : si le contenu dépasse, il est réduit (zoom) jusqu'à tenir
const fit = (slide) => {
  const body = slide.querySelector(':scope > s-body');
  if (!body) return;
  slide.setAttribute('data-measuring', '');
  let zoom = 1;
  body.style.setProperty('--fit', zoom);
  // Le contenu se réorganise quand il rétrécit, d'où quelques passes
  for (let pass = 0; pass < 4 && body.clientHeight > 0; pass++) {
    const overflow = body.scrollHeight / body.clientHeight;
    if (overflow <= 1.002) break;
    zoom = Math.max(0.5, zoom / overflow);
    body.style.setProperty('--fit', zoom);
  }
  if (zoom === 1) body.style.removeProperty('--fit');
  slide.removeAttribute('data-measuring');
};

class SDeck extends Base {
  index = -1;

  connectedCallback() {
    this.slides = [...this.querySelectorAll(':scope > s-slide')];
    this.tabIndex = -1;

    this.progress = el('div', 's-progress');
    this.counter = el('div', 's-counter');
    this.after(this.progress, this.counter);
    if (!this.hasAttribute('no-edit')) this.#editButton();

    this.observer = new IntersectionObserver(this.#onIntersect, { root: this, rootMargin: '-45% 0px -45% 0px' });
    this.refresh();

    this.resizer = new ResizeObserver(() => this.fit());
    this.resizer.observe(this);
    document.fonts?.ready.then(() => this.fit());
    // Une image chargée (ou introuvable) change la hauteur de sa slide
    const refit = (e) => e.target.localName === 'img' && e.target.closest('s-slide') && fit(e.target.closest('s-slide'));
    this.addEventListener('load', refit, true);
    this.addEventListener('error', refit, true);

    this.addEventListener('scroll', this.#onScroll, { passive: true });
    document.addEventListener('keydown', this.#onKey);

    const start = parseInt(location.hash.slice(1), 10) - 1;
    if (start > 0) this.go(start, false);
    this.focus({ preventScroll: true });
  }

  disconnectedCallback() {
    this.observer.disconnect();
    this.resizer.disconnect();
    document.removeEventListener('keydown', this.#onKey);
    this.progress.remove();
    this.counter.remove();
    this.editButton?.remove();
  }

  // À appeler quand des slides sont ajoutées, retirées ou remplacées
  refresh() {
    this.slides = [...this.querySelectorAll(':scope > s-slide')];
    this.observer.disconnect();
    this.slides.forEach((s) => this.observer.observe(s));
    this.progress.hidden = this.hasAttribute('no-chrome');
    this.counter.hidden = !this.hasAttribute('counter');
    this.#updateCounter();
    this.fit();
  }

  go(i, smooth = true) {
    const target = this.slides[Math.max(0, Math.min(i, this.slides.length - 1))];
    target?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' });
  }
  fit(slide) { (slide ? [slide] : this.slides).forEach(fit); }
  next() { this.go(this.index + 1); }
  prev() { this.go(this.index - 1); }

  // Éditeur visuel : edit.js et edit.css sont chargés à la première ouverture
  edit() {
    if (globalThis.DeckardEditor) return globalThis.DeckardEditor.toggle(this);
    if (this.loadingEditor) return;
    this.loadingEditor = true;
    const base = SCRIPT_URL ?? location.href;
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('edit.css', base).href });
    const js = Object.assign(document.createElement('script'), { src: new URL('edit.js', base).href });
    css.dataset.deckardEditor = js.dataset.deckardEditor = '';
    js.onload = () => css.sheet ? globalThis.DeckardEditor.toggle(this) : (css.onload = () => globalThis.DeckardEditor.toggle(this));
    js.onerror = () => { this.loadingEditor = false; alert('Éditeur introuvable : edit.js doit être à côté de deck.js.'); };
    document.head.append(css, js);
  }

  // Bouton discret en bas à gauche, visible quand la souris bouge
  #editButton() {
    const button = el('button', 's-edit-button', 'Éditer');
    button.type = 'button';
    button.title = 'Éditer la présentation (touche E)';
    button.addEventListener('click', () => this.edit());
    let timer;
    document.addEventListener('pointermove', () => {
      button.classList.add('visible');
      clearTimeout(timer);
      timer = setTimeout(() => button.classList.remove('visible'), 2200);
    });
    this.editButton = button;
    this.after(button);
  }

  #updateCounter() {
    const pad = (n) => String(n).padStart(2, '0');
    this.counter.textContent = `${pad(Math.max(this.index, 0) + 1)} / ${pad(this.slides.length)}`;
  }

  #onIntersect = (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) {
        if (!e.target.hasAttribute('once')) e.target.removeAttribute('data-active');
        continue;
      }
      e.target.setAttribute('data-active', '');
      const i = this.slides.indexOf(e.target);
      const changed = i !== this.index || e.target !== this.current;
      this.index = i;
      this.current = e.target;
      this.#updateCounter();
      if (!changed) continue;
      history.replaceState(null, '', `#${i + 1}`);
      this.dispatchEvent(new CustomEvent('slidechange', { detail: { index: i, slide: e.target } }));
    }
  };

  #onScroll = () => {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      const max = this.scrollHeight - this.clientHeight;
      this.progress.style.setProperty('--p', max > 0 ? this.scrollTop / max : 0);
      this.raf = null;
    });
  };

  #onKey = (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const actions = {
      ArrowDown: () => this.next(), PageDown: () => this.next(), j: () => this.next(),
      ArrowUp: () => this.prev(), PageUp: () => this.prev(), k: () => this.prev(),
      ' ': () => (e.shiftKey ? this.prev() : this.next()),
      Home: () => this.go(0), End: () => this.go(this.slides.length - 1),
      e: () => !this.hasAttribute('no-edit') && this.edit(),
      f: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  };
}

globalThis.customElements?.define('s-deck', SDeck);

if (typeof module === 'object') module.exports = { rows, toNumber, toAmount, isNumeric, niceMax, markOf, scoreOf };
