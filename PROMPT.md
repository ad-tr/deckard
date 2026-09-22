# Prompt : créer une présentation avec Deckard

Copie tout ce qui suit dans une conversation avec une IA, puis ajoute ta demande à la fin (sujet, données, nombre de slides).

---

Tu vas écrire une présentation avec **Deckard**, une petite librairie de composants HTML. Les slides défilent verticalement, une slide par écran. Tout tourne dans le navigateur sans serveur ni build : on ouvre `index.html` en double-cliquant.

## Fichiers

- `index.html` : **le seul fichier que tu écris.** Il contient les slides.
- `tokens.css` : couleurs, polices, tailles. Ne pas modifier sauf demande explicite.
- `deck.css` / `deck.js` : la librairie. Ne jamais modifier.

## Règles

1. N'utilise que les composants listés ci-dessous. Pas de `<div>`, pas de `style=""`, pas de classe CSS inventée, pas de couleur en dur.
2. Une slide = une idée. Un seul graphique ou tableau par slide.
3. Textes courts : titres de 1 à 4 mots, phrases de 15 mots maximum.
4. Choisis le composant selon ce que la donnée doit montrer (voir « Quel composant choisir »).
5. Les données tabulaires s'écrivent en **syntaxe pipe** (voir plus bas), jamais en `<table>`.
6. Si une donnée n'est pas fournie, n'invente rien : laisse un libellé explicite comme `À compléter`.
7. Pas de tiret cadratin (tiret long) dans les textes. Utilise virgule, deux-points ou parenthèses.
8. Rends le fichier `index.html` complet, avec l'en-tête ci-dessous.

## Squelette de `index.html`

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Titre de la présentation</title>
  <link rel="stylesheet" href="tokens.css" />
  <link rel="stylesheet" href="deck.css" />
  <script src="deck.js" defer></script>
</head>
<body>
<s-deck fine="©2026 Ta marque. Tous droits réservés.">

  <!-- slides ici -->

</s-deck>
</body>
</html>
```

## Nomenclature

- Tous les composants commencent par `s-` et se ferment toujours explicitement : `<s-stat ...></s-stat>`.
- Les **attributs** configurent le composant (`highlight="GCP"`, `unit="ms"`).
- La **syntaxe pipe** sert aux données : une ligne = une rangée, colonnes séparées par `|`. Les espaces autour des `|` sont ignorés. Les lignes du type `---|---` aussi.
  ```
  Cloud Run  | 320 | 2 vCPU
  Cloud SQL  | 540 | HA
  ```
- Le contenu en syntaxe pipe est lu comme du **texte brut** : une balise HTML dedans s'affiche telle quelle.
- **Nombres** : écris `1 240` ou `1240`, virgule décimale `0,076`. Pas de point comme séparateur de milliers (`1.200` est lu 1,2). Dans `<s-trend>` et `<s-scatter>`, les suffixes `k`, `M`, `B` sont compris (`2k €`, `5M`).

## Structure d'une slide

```html
<s-slide tag="Nom de section">
  <!-- contenu : centré verticalement -->
  <s-foot>
    <!-- optionnel : bas de slide -->
  </s-foot>
</s-slide>
```

Une slide a trois zones : **en-tête** en haut, **contenu** au milieu, **pied** (`<s-foot>`) en bas.

### Attributs de `<s-deck>`

| Attribut | Effet |
|---|---|
| `fine="..."` | Petite mention (copyright) à droite de chaque en-tête automatique |
| `counter` | Affiche le compteur « 03 / 12 » en bas à droite |
| `no-chrome` | Retire la barre de progression en haut |

### Attributs de `<s-slide>`

| Attribut | Effet |
|---|---|
| `tag="..."` | Crée l'en-tête automatique : flèche ronde + pilule avec ce texte + mention `fine` |
| `tone="dark"` | Slide sur fond sombre |
| `layout="center"` | Contenu centré horizontalement |
| `layout="bottom"` | Contenu calé en bas |
| `reveal="up\|fade\|scale\|none"` | Animation d'apparition de tous les blocs (défaut : `up`) |
| `once` | L'animation ne rejoue pas quand on revient sur la slide |

Chaque bloc peut aussi avoir son propre `reveal="..."`. Les blocs apparaissent en cascade, automatiquement.

## Composants

### En-tête et pied

| Composant | Usage |
|---|---|
| `<s-top>` | En-tête manuel, à la place de `tag` (surtout pour la couverture) |
| `<s-foot>` | Pied de slide. Les éléments sont répartis de gauche à droite |
| `<s-logo>Nom</s-logo>` | Astérisque + nom de marque |
| `<s-pill>Texte</s-pill>` | Pilule contour. `filled` pour la version pleine |
| `<s-arrow></s-arrow>` | Flèche dans un cercle (↘). `to="right\|up\|down"` |
| `<s-fine>Texte</s-fine>` | Petite mention en capitales |
| `<s-info label="Date">Mars 2026</s-info>` | Libellé + valeur (infos de couverture) |

L'attribut `push` sur n'importe quel élément de `<s-top>` le pousse à droite, ainsi que tout ce qui suit.

### Texte

| Composant | Usage |
|---|---|
| `<s-title>` | Très grand titre (couverture, fin) |
| `<s-heading>` | Grand titre de section, souvent dans `<s-foot>` |
| `<s-label>` | Petit sur-titre en capitales |
| `<s-text>` | Paragraphe. Options : `muted` (atténué), `small` (petit, étroit), `right` (aligné à droite) |
| `<s-quote by="Auteur">` | Citation |
| `<s-tag>` | Étiquette inline (région, version, statut) |
| `<s-callout>` | Remarque avec pilule « NOTE ». `type="warn"` pour « ATTENTION », `label="..."` pour changer le mot |
| `<s-divider>` | Ligne de séparation |
| `<s-code file="main.tf">` | Bloc de code. L'indentation commune est retirée. Échapper `<` en `&lt;` et `>` en `&gt;` |

### Mise en page

| Composant | Usage |
|---|---|
| `<s-columns>` | Deux colonnes (une seule sur mobile) |
| `<s-grid>` | Grille qui s'adapte (cartes, chiffres) |
| `<s-list>` + `<s-item>` | Liste. `numbered` pour la numéroter |
| `<s-card heading="Titre">texte</s-card>` | Carte avec titre |
| `<s-image src="" alt="" caption="">` | Image avec légende |

### Chiffres et données

| Composant | Syntaxe pipe | Attributs |
|---|---|---|
| `<s-stat>` | non | `value`, `label`, `delta` (`+12%` ou `−8%`, le signe décide la couleur) |
| `<s-trend>` | `libellé \| valeur \| description` | aucun. Courbe + une colonne par point |
| `<s-bars>` | `libellé \| valeur` | `unit`, `highlight` |
| `<s-vbars>` | `libellé \| valeur` | `unit`, `highlight` |
| `<s-share>` | `libellé \| valeur` | `unit`. 5 parts max, le reste passe dans « Autres » |
| `<s-scatter>` | `libellé \| x \| y` (+ `\| left` optionnel) | `x`, `y` (noms des axes), `x-max`, `y-max`, `highlight`, `quadrants`, `x-split`, `y-split` |
| `<s-price>` | `libellé \| montant \| note` | `currency` (défaut €), `period`, `total-label`. Total calculé |
| `<s-table>` | 1re ligne = en-têtes | `highlight="Nom de colonne"`. Chiffres alignés à droite automatiquement |
| `<s-matrix>` | 1re ligne = en-têtes | `highlight="Nom de colonne"`. `oui`/`non`/`partiel` (ou `yes`/`no`/`partial`) deviennent ✓ ✕ ◐ |
| `<s-flow>` + `<s-node sub="détail">Nom</s-node>` | non | Schéma en ligne, flèches ajoutées automatiquement |
| `<s-roadmap>` + `<s-phase label="Phase 1">texte</s-phase>` | non | Phases reliées en pointillés |

`highlight` met un élément en avant (noir) et passe les autres en gris.
`quadrants="a | b | c | d"` : ordre haut-gauche, haut-droite, bas-gauche, bas-droite. La coupure est au milieu des axes, sauf si `x-split` / `y-split` la déplacent.
`| left` en 4e colonne de `<s-scatter>` place le nom à gauche du point (pour éviter un chevauchement).

## Quel composant choisir

| Ce que la donnée doit montrer | Composant |
|---|---|
| 2 à 4 chiffres clés | `<s-grid>` + `<s-stat>` |
| Une évolution dans le temps | `<s-trend>` |
| Comparer des montants entre options | `<s-bars>` (libellés longs) ou `<s-vbars>` (libellés courts, 3 à 6 valeurs) |
| Les parts d'un total | `<s-share>` |
| Positionner des options sur deux critères (difficulté / prix, effort / impact) | `<s-scatter>` avec `quadrants` |
| Le détail d'un coût | `<s-price>` |
| Comparer des fonctionnalités | `<s-matrix>` |
| Des specs chiffrées | `<s-table>` |
| Un parcours de données ou une architecture | `<s-flow>` |
| Un planning | `<s-roadmap>` |
| Une mise en garde | `<s-callout type="warn">` |

## Modèles de slides

**Couverture**
```html
<s-slide>
  <s-top>
    <s-logo>Marque</s-logo>
    <s-pill>Présentation</s-pill>
    <s-pill push>Notre projet</s-pill>
    <s-arrow></s-arrow>
  </s-top>
  <s-title>Titre</s-title>
  <s-text small>Présenté par <b>Nom</b></s-text>
  <s-foot>
    <s-info label="Contact">email@exemple.fr</s-info>
    <s-info label="Date">Septembre 2026</s-info>
    <s-info label="Site">www.exemple.fr</s-info>
  </s-foot>
</s-slide>
```

**Donnée + grand titre en bas**
```html
<s-slide tag="Latence p95">
  <s-vbars unit="ms" highlight="Cloud Run">
    Actuel    | 294
    Cloud Run | 182
  </s-vbars>
  <s-foot>
    <s-heading>Performance</s-heading>
    <s-text small right>Test de charge, 500 req/s.</s-text>
  </s-foot>
</s-slide>
```

**Benchmark**
```html
<s-slide tag="Benchmark">
  <s-scatter x="Difficulté (1 à 10)" y="Prix (€ / mois)" x-max="10" highlight="Cloud Run"
             quadrants="Simple mais cher | Complexe et cher | Simple et abordable | Complexe mais abordable">
    Cloud Run      | 2 | 320
    GKE Autopilot  | 6 | 780
    Compute Engine | 7 | 290 | left
  </s-scatter>
</s-slide>
```

**Roadmap sur fond sombre**
```html
<s-slide tag="Plan" tone="dark">
  <s-roadmap>
    <s-phase label="Phase 1">Texte court.</s-phase>
    <s-phase label="Phase 2">Texte court.</s-phase>
    <s-phase label="Phase 3">Texte court.</s-phase>
  </s-roadmap>
  <s-foot>
    <s-heading>Roadmap</s-heading>
  </s-foot>
</s-slide>
```

**Fin**
```html
<s-slide tag="Fin" layout="bottom" once>
  <s-title>Questions ?</s-title>
</s-slide>
```

## Navigation (à rappeler à l'utilisateur si besoin)

Molette ou flèches, espace (Maj + espace pour reculer), `j` / `k`, `Home` / `End`, `f` pour le plein écran. L'URL suit la slide (`#4`). `Cmd + P` imprime une slide par page.

---

**Ma demande :**

