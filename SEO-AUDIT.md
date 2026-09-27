# Audit technique SEO — GO Delivery (go-delivery.fr)

**Date du rapport :** 27/09/2026
**Périmètre :** `index.html`, `contact.html`, `cgv.html`, `assets/css/style.css`, `robots.txt`, `sitemap.xml`, `seo-check.js`
**Auteur :** Agent IA (GitHub Copilot), travail réalisé directement dans le repository local, aucun accès production ni Google Search Console.

> Ce rapport documente uniquement ce qui a été réellement fait et réellement vérifié. Chaque affirmation est classée : **Vérifié**, **Implémenté non vérifié**, ou **Recommandé non implémenté**. Aucune mesure de performance (Lighthouse, CrUX, PageSpeed Insights) n'a été exécutée dans cet environnement — il n'y a pas d'accès réseau à un outil de mesure, ni de navigateur outillé pour Lighthouse. Toute amélioration de performance décrite est une **déduction architecturale** (ex. : suppression d'un blocage JS avant le chargement d'une image), pas une mesure chiffrée avant/après.

---

## 1. État initial du projet

### 1.1 Architecture avant optimisation

- Site 100 % statique : HTML/CSS/JS, sans framework, sans build (pas de `package.json`, pas de bundler), sans dépôt Git initialisé, sans CI/CD.
- Fichiers HTML mirrorés via **HTTrack** depuis un thème démo (`code.themepitcher.com/nogor`) — commentaires `<!-- Mirrored from ... -->` présents en tête/pied de fichier avant intervention.
- Domaine de production confirmé par récupération directe de la page : **https://go-delivery.fr** (le contenu servi en production correspondait au contenu du repository au moment de l'audit).
- Aucun fichier de configuration serveur (`.htaccess`, `nginx.conf`, `vercel.json`, etc.) présent dans le repository → impossible de vérifier depuis le repo la configuration des redirections (www/non-www, http/https).

### 1.2 Pages existantes

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil (hero, à propos, services, FAQ, avis clients, compteurs, formulaire de contact en footer) |
| `contact.html` | Page de demande de devis (formulaire multi-étapes déménagement/transport) |
| `cgv.html` | Conditions Générales de Vente |

Aucune autre page HTML indexable identifiée. Deux fichiers `assets/fonts/remixicon0c93.html` et `remixicon0c93-2.html` existent mais **ne sont pas de vraies pages** (voir §1.4).

### 1.3 Problèmes SEO identifiés lors de l'audit initial

| Sévérité | Constat |
|---|---|
| CRITIQUE | 7 des 9 images du carrousel « À propos » sur `index.html` pointaient vers des fichiers inexistants (`about-5.png` à `about-10.png`, `about-12.png`) → images cassées (404) |
| CRITIQUE | L'image de fond du hero (candidate LCP) n'était posée qu'en JavaScript (`main.js`, via jQuery, après le chargement de tout le bundle JS) — invisible pour le préchargeur du navigateur |
| HAUTE | Aucun `robots.txt`, aucun `sitemap.xml` |
| HAUTE | Aucune balise `<link rel="canonical">` sur aucune page |
| HAUTE | Aucune `<meta name="description">` sur aucune page |
| HAUTE | `<title>` non descriptif et identique sur `index.html`/`contact.html` (`"GO Delivery"`) |
| HAUTE | `<html lang="en">` sur `index.html` et `contact.html` alors que le contenu est en français (`cgv.html` avait déjà `lang="fr"`) |
| HAUTE | Bootstrap chargé en double : copie locale (`assets/js/bootstrap.min.js`, v5.0.2) **et** copie CDN (`bootstrap@5.3.3`) sur les 3 pages |
| MOYENNE | Aucun `<h1>` réellement porteur du sujet principal de la page (le titre du hero était en `<h2>`, le seul `<h1>` de `index.html` se trouvait dans le footer : « Discutons ensemble ») |
| MOYENNE | Police Google Fonts chargée via `@import` CSS (bloquant, anti-pattern de performance documenté) |
| MOYENNE | Icônes purement décoratives avec `alt="icon"` répété (bruit pour lecteurs d'écran) |
| MOYENNE | Images du carrousel avec `alt="Image 1"` à `alt="Image 9"` (non descriptif) |
| FAIBLE | Deux fichiers `assets/fonts/remixicon0c93.html` et `remixicon0c93-2.html` sont en réalité des pages d'erreur **« 404 Not Found »** générées par le serveur d'origine (LiteSpeed) et sauvegardées par erreur par HTTrack lors du mirroring des formats de police EOT/SVG (obsolètes, jamais utilisés par les navigateurs modernes). Risque : indexation accidentelle de pages « 404 » dupliquées si elles sont exposées publiquement. |
| FAIBLE | Favicon incohérent entre pages (`logo-go-delivery.png` sur 2 pages, `favicon.png` sur `contact.html`) |

### 1.4 Problèmes de performance, d'indexation et de structure HTML

- **LCP potentiellement dégradé** : l'image de fond du hero (`bg-hero-2-neww.jpg`) n'apparaissait dans aucune balise `<img>` ni `style` inline — uniquement un attribut `data-background` lu par `main.js` (`$("[data-background]").css("background-image", ...)`) exécuté après le chargement séquentiel de jQuery, Bootstrap, counterup, easing, magnific-popup, meanmenu, slick, waypoints, wow puis main.js. Le navigateur ne pouvait donc pas découvrir cette image pendant le parsing initial du HTML.
- **Indexation** : sans `robots.txt` ni `sitemap.xml`, aucune garantie de découverte rapide des 3 pages par les moteurs de recherche (le crawl organique reste possible via liens internes, mais rien ne facilite ni ne cadre le crawl).
- **Structure HTML** : hiérarchie de titres incohérente (multiples sauts de niveaux, un `<h1>` non représentatif du sujet de la page).
- **Fichiers fantômes** : les deux fichiers `.html` dans `assets/fonts/` (voir 1.3) sont accessibles publiquement si le dossier `assets/` est servi tel quel, avec un `<title>404 Not Found</title>` identique dans les deux fichiers.

### 1.5 Risques identifiés sur les formulaires et le système d'envoi d'e-mails

- **`index.html` (formulaire de contact, footer)** : bug réel confirmé — le `<span class="error-message">` associé au champ `id="name"` portait par erreur l'`id="error-date-transport"` (copié-collé depuis le template du formulaire de devis), alors que le script de validation cherche `error-${field.id}` soit `error-name`. Conséquence : le message d'erreur du champ « nom » ne s'affichait jamais, même si le champ était vide.
- **`contact.html` (formulaire de devis)** : bug réel confirmé — un script `document.getElementById('btn-text').textContent = 'Envoyer'` (déclenché si `window.innerWidth < 576`) ciblait un `id="btn-text"` qui n'existait sur **aucun élément** du DOM → `TypeError: Cannot set properties of null` sur mobile.
- **Accessibilité des formulaires** : les champs des deux formulaires reposaient uniquement sur l'attribut `placeholder` (aucun `<label>` ni `aria-label`) — non conforme aux bonnes pratiques WCAG sur les labels de formulaire.
- **Script mort** : un bloc `<script>` dans `index.html` attachait des écouteurs d'événements sur `document.getElementById('email-link')` et `document.getElementById('email-choices')`, deux éléments **inexistants** dans le HTML → erreur JavaScript non interceptée au chargement de la page.
- **Intégration EmailJS** : la clé publique EmailJS (`ha7vZaqjpxgvtNRCx`) et les identifiants de service/template sont en clair dans le HTML. C'est **normal et attendu** pour EmailJS (la clé publique est conçue pour être exposée côté client, la sécurité réelle repose sur la configuration des templates/domaines autorisés dans le dashboard EmailJS) — ce n'est pas une fuite de secret, mais cela n'a pas été audité côté dashboard EmailJS (hors périmètre, accès non disponible).

---

## 2. Modifications réellement effectuées

### 2.1 Fichiers créés

| Fichier | Contenu |
|---|---|
| `robots.txt` | `User-agent: *`, `Allow: /`, `Disallow: /assets/fonts/*.html` (bloque les 2 pseudo-pages 404), directive `Sitemap:` pointant vers `https://go-delivery.fr/sitemap.xml` |
| `sitemap.xml` | 3 URLs (`/`, `/contact.html`, `/cgv.html`) avec `lastmod` = date système de l'environnement (2026-09-27) |
| `seo-check.js` | Script Node.js sans dépendance (`node seo-check.js`) : vérifie titres/meta description dupliqués ou manquants, canonical manquant/multiple, nombre de `<h1>`, `alt` manquant sur `<img>`, liens/`src` internes cassés (fichier inexistant sur disque), validité syntaxique des blocs JSON-LD, présence de `robots.txt`/`sitemap.xml` et cohérence avec le sitemap |

### 2.2 Fichiers modifiés

- `index.html`
- `contact.html`
- `cgv.html`
- `assets/css/style.css`

Aucun autre fichier (JS, images, CSS hors `style.css`) n'a été modifié.

### 2.3 Balises SEO ajoutées ou corrigées (les 3 pages)

| Élément | `index.html` | `contact.html` | `cgv.html` |
|---|---|---|---|
| `lang` | `en` → `fr` | `en` → `fr` | déjà `fr` (inchangé) |
| `<title>` | « GO Delivery » → « GO Delivery – Transport et déménagement à Marseille » | « GO Delivery » → « Demander un devis – Transport et déménagement \| GO Delivery » | « CGV - GO Delivery » → « Conditions Générales de Vente \| GO Delivery Marseille » |
| `<meta name="description">` | Ajoutée | Ajoutée | Ajoutée |
| `<link rel="canonical">` | Ajoutée → `https://go-delivery.fr/` | Ajoutée → `https://go-delivery.fr/contact.html` | Ajoutée → `https://go-delivery.fr/cgv.html` |
| Open Graph (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image`, `og:locale`) | Ajoutées | Ajoutées | Ajoutées (sans `og:image`) |
| `twitter:card` | Ajoutée | Ajoutée | Non ajoutée |
| Favicon | Déjà `logo-go-delivery.png` (inchangé) | `favicon.png` → `logo-go-delivery.png` (harmonisation) | Déjà `logo-go-delivery.png` (inchangé) |
| Commentaires HTTrack (`<!-- Mirrored from ... -->`) | Supprimés | Supprimés | Absents à l'origine |

### 2.4 Modifications HTML

- **Carrousel « À propos » (`index.html`)** : remplacement des 7 références d'images cassées (`about-5.png`…`about-10.png`, `about-12.png`) par des fichiers réellement présents sur disque (`about-1.png`, `about-2.png`, `about-3.png`, `about-33.png`), en conservant `about-11.png` et `about-4.png` déjà valides. Le carrousel passe de 9 à 6 slides. `alt` réécrits pour décrire réellement le contenu visuel (vérifié en ouvrant chaque image avant rédaction du texte).
- **Hiérarchie de titres** :
  - `index.html` : titre du hero `<h2>` → `<h1 class="hero-h1">` (sujet principal de la page) ; titre du footer `<h1>Discutons ensemble</h1>` → `<h2 class="footer-h2">` (une seule vraie balise `<h1>` par page désormais).
  - `contact.html` : `<h3>Prêt à déménager ou être livré ?</h3>` → `<h1 class="breadcrumb-h1">` (la page n'avait aucun `<h1>` auparavant).
  - `cgv.html` : `<h2>Conditions Générales de Vente - GO Delivery</h2>` → `<h1 class="hero-h1">Conditions Générales de Vente</h1>` (la page n'avait aucun `<h1>` auparavant).
  - Compteurs (`index.html`) : 4× `<h3 class="counter">200</h3>` et 4× `<h3>+</h3>` (utilisés uniquement pour le style visuel, sans valeur sémantique) → `<p class="counter">` / `<p class="counter-plus">`.
  - Titre de section FAQ (`index.html`) : « Votre partenaire de confiance » (dupliqué avec le titre de la section « À propos ») → reformulé en « Vos questions, nos réponses ».
- **Correction de bug — id d'erreur mal assigné (`index.html`)** : `id="error-date-transport"` sur le `<span>` d'erreur du champ nom → `id="error-name"` (aligné avec la logique JS `error-${field.id}`).
- **Correction de bug — élément manquant (`contact.html`)** : ajout de `id="btn-text"` sur le `<span class="text">Envoyer ma demande</span>` du bouton d'envoi (l'élément ciblé par le script mobile n'existait pas).
- **Suppression de script mort (`index.html`)** : suppression du bloc `<script>` qui manipulait `email-link`/`email-choices`, deux éléments inexistants dans le DOM.
- **Accessibilité des formulaires** : ajout d'`aria-label` sur les champs toujours visibles :
  - `index.html` (formulaire footer) : `name`, `email`, `telephone`, `message`.
  - `contact.html` (formulaire de devis) : `nom`, `prenom`, `email`, `telephone`, `type-devis`.
  - Les champs conditionnels (déménagement/transport, affichés selon le choix du select) n'ont **pas** été traités — limitation assumée, documentée en section 6.
- **Icônes décoratives** : `alt="icon"` (6 icônes de service + 4 icônes de compteur dans `index.html`) → `alt=""` (icônes purement décoratives, le texte visible adjacent porte déjà le sens).
- **Fond d'image posé en JS** : ajout d'un `style="background-image:url('...')"` en complément de `data-background` sur les 8 sections concernées d'`index.html` (hero, services, FAQ, 4× fond de témoignage, footer) et sur la section breadcrumb de `contact.html`, pour que l'image de fond soit visible dès le parsing HTML au lieu d'attendre l'exécution complète du bundle JS.
- **Préchargement de l'image LCP (`index.html`)** : ajout de `<link rel="preload" as="image" href="assets/images/bg-hero-2-neww.jpg" fetchpriority="high">` dans le `<head>`.
- **Suppression du Bootstrap CDN dupliqué** : suppression de `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/...">` et du `<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/...">` sur les 3 pages (vérifié au préalable que la copie locale v5.0.2 couvre les seules fonctionnalités Bootstrap utilisées : `Carousel` et `Modal` — recherche de `data-bs-toggle` dans les 3 fichiers : 0 résultat, donc aucune dépendance à Popper).
- **Polices Google Fonts** : remplacement du chargement `@import` (dans `style.css`) par `<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` et `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">` dans le `<head>` des 3 pages.

### 2.5 Modifications CSS (`assets/css/style.css`)

- Suppression de la ligne `@import url("https://fonts.googleapis.com/css2?...")`.
- Ajout de classes utilitaires **additives** (aucune règle existante supprimée ou modifiée, seulement des ajouts) pour préserver l'apparence visuelle d'origine après les changements de balises de titre :
  - `.hero-h1` (reproduit exactement les métriques de l'ancien `<h2>` : 54px / 48px / 46px selon breakpoints, `font-weight: 600`, `text-transform: capitalize`).
  - `.footer-h2` (reproduit les métriques de l'ancien `<h1>` : 80px / 64px / 54px selon breakpoints, `font-weight: 700`, `text-transform: uppercase`).
  - `.breadcrumb-h1` (reproduit les métriques de l'ancien `<h3>` du breadcrumb : 48px / 42px selon breakpoints).
  - `.counter` / `.counter-plus` (reproduisent les métriques de l'ancien `<h3>` des compteurs : 48px / 42px, `color: #0f1b24`), avec mise à jour des deux règles média-query existantes qui référençaient `.single-counter-2 h3` pour qu'elles continuent de cibler ces éléments après le changement de balise.

### 2.6 Données structurées JSON-LD ajoutées

| Page | Bloc(s) JSON-LD | Contenu |
|---|---|---|
| `index.html` | 1 bloc | `@type: MovingCompany`, `@id: https://go-delivery.fr/#business` — `name`, `url`, `logo`, `image`, `email`, `telephone` (`+33666670167`), `address` (`PostalAddress` : 96 Rue Paradis, 13006 Marseille, FR), `areaServed: "FR"`, `sameAs` (Instagram, LinkedIn, fiche Google Maps) |
| `contact.html` | 2 blocs | (1) `@type: BreadcrumbList` avec 2 `ListItem` (Accueil → Devis) reproduisant le fil d'Ariane visible sur la page. (2) `@type: MovingCompany` minimal (même `@id`, `name`, `url`) référençant la même entité que la page d'accueil |
| `cgv.html` | 1 bloc | `@type: MovingCompany` minimal (même `@id`, `name`, `url`) |

Toutes les données utilisées (nom, adresse, téléphone, email, réseaux sociaux) proviennent du contenu déjà visible sur les pages — **aucune donnée n'a été inventée**. Aucun avis client, note ou horaire d'ouverture n'a été ajouté en structured data car ces informations ne sont pas vérifiables avec une valeur numérique fiable (voir §4.8).

### 2.7 Changements sur `robots.txt` et `sitemap.xml`

- `robots.txt` : fichier inexistant → créé avec `Allow: /` global, `Disallow: /assets/fonts/*.html` (les 2 pseudo-pages 404 identifiées en §1.3/1.4), et déclaration `Sitemap:`.
- `sitemap.xml` : fichier inexistant → créé avec les 3 URLs canoniques du site et une date `lastmod` correspondant à la date système de l'environnement au moment de la modification.

---

## 3. Résultats des tests

### 3.1 Commandes réellement exécutées et résultats obtenus

**Commande :** `node seo-check.js`
**Résultat obtenu (dernière exécution, reproductible) :**
```
SEO/QA check — 3 pages scanned

No issues found.
```
Code de sortie : `0`.

**Commande :** script Node ad hoc pour détecter les identifiants HTML dupliqués (exécuté en ligne de commande, non committé dans le repository) :
```
index.html dup ids: none
contact.html dup ids: none
cgv.html dup ids: none
```

**Commande :** script Node ad hoc pour analyser la séquence de titres (`h1`→`h6`) de chaque page (non committé). Résultat : confirmation d'un seul `<h1>` par page, mais présence de sauts de niveaux (`h1→h3`, `h2→h6`, `h1→h4`, etc.) — voir §5 et §6 pour le détail complet, ce point n'a pas été corrigé.

**Commande :** `grep` sur les 3 fichiers HTML pour rechercher `data-bs-toggle` (fonctionnalités Bootstrap nécessitant Popper). **Résultat : 0 occurrence** → confirme que la suppression du Bootstrap CDN (Popper inclus) est sans risque, puisque seuls `Carousel` et `Modal` sont utilisés et sont disponibles dans la copie locale Bootstrap v5.0.2.

**Commande :** `python -m http.server` (deux instances successives, ports 8090 puis 8091) pour servir le site en local, suivi de navigation via un navigateur automatisé (Playwright intégré) sur `index.html`, `contact.html`, `cgv.html`.
**Résultat :** toutes les ressources (CSS, JS, images, police woff2) répondent en **HTTP 200** — aucune ressource cassée, y compris après le remplacement des images du carrousel. Log serveur consulté directement, pas seulement supposé.

**Commande :** récupération de la page en ligne `https://go-delivery.fr/` via un outil de fetch web (avant modifications).
**Résultat :** le contenu retourné correspondait au contenu du repository (titre « TRANSPORT ET DÉMÉNAGEMENT EN TOUTE CONFIANCE », mêmes avis clients, mêmes coordonnées) — confirme que le domaine de production est bien `go-delivery.fr` et que le repository correspond (ou correspondait) au site réellement déployé.

**Vérification externe :** récupération de la définition du type `https://schema.org/MovingCompany` via fetch web.
**Résultat :** type confirmé existant et à jour (Schema.org v30.1, 2026-09-16), toutes les propriétés utilisées (`name`, `url`, `logo`, `image`, `email`, `telephone`, `address`, `areaServed`, `sameAs`) confirmées valides pour ce type.

### 3.2 Erreurs détectées et corrigées (chronologie réelle)

1. Images de carrousel 404 → corrigées (remplacement par fichiers existants).
2. Fond du hero non visible avant exécution JS → corrigé (style inline ajouté).
3. Bug de validation de formulaire (`error-date-transport` au lieu de `error-name`) → corrigé.
4. Script cassé ciblant `btn-text` inexistant → corrigé (id ajouté).
5. Script mort ciblant `email-link`/`email-choices` inexistants → supprimé.
6. Duplication de la balise `<h1>` (footer) et absence de `<h1>` porteur de sens sur `contact.html`/`cgv.html` → corrigée.
7. Titres `<h3>` utilisés uniquement pour le style sur les compteurs → corrigés (passage en `<p>`, détecté lors de la revue adversariale, **pas** lors du premier passage).
8. Duplication de texte de titre (« Votre partenaire de confiance » utilisé deux fois) → corrigée (détecté lors de la revue adversariale).

### 3.3 Tests SEO automatisés

- `seo-check.js` est le seul test automatisé **committé** dans le repository. Il vérifie, par page : titre présent/unique, meta description présente/unique, canonical présent et unique, présence d'au moins un `<h1>`, `lang` présent et cohérent (`fr`), viewport présent, `alt` présent sur chaque `<img>`, validité de tous les `href`/`src` internes (existence réelle du fichier cible), validité syntaxique JSON de chaque bloc `<script type="application/ld+json">`. Il vérifie aussi la présence de `robots.txt`/`sitemap.xml` et que les 3 pages y sont bien listées.
- **Limites assumées du script** (pour rester honnête sur sa couverture) : il ne valide **pas** les données structurées contre le vocabulaire Schema.org (seulement la syntaxe JSON), ne mesure **pas** les Core Web Vitals, ne détecte **pas** les liens externes cassés, ne vérifie **pas** les contrastes de couleur ni les seuils WCAG précis, ne détecte **pas** les sauts de hiérarchie de titres (ce contrôle a été fait manuellement via un script jetable, non conservé dans le repo).

### 3.4 Vérification des formulaires

- Vérification **statique uniquement** (lecture de code + rendu DOM via navigateur automatisé) : présence des `id`, cohérence des `aria-label`, absence de doublons d'`id`, présence de l'élément `btn-text` après correction.
- **Aucun envoi réel de formulaire testé** (l'intégration EmailJS nécessite une clé de service active et enverrait un vrai e-mail au destinataire réel `contact@go-delivery.fr` — non exécuté volontairement pour ne pas générer de fausses sollicitations).
- **Aucun test de sécurité applicative** (CSRF, rate-limiting, validation serveur) n'a été réalisé — il n'y a d'ailleurs pas de composant serveur dans ce projet statique ; toute la validation est côté client, et l'envoi réel passe entièrement par l'API tierce EmailJS (hors périmètre d'audit).

### 3.5 Tests de performance

**Aucun test de performance chiffré n'a été réalisé.** Aucun accès à Lighthouse CLI, PageSpeed Insights, WebPageTest ou Chrome UX Report n'était disponible dans cet environnement. Les seules vérifications de performance effectuées sont **structurelles** :
- Confirmation par lecture de code que l'image de fond du hero n'était liée à aucune balise `<img>`/`style` avant modification (donc invisible pour le préchargeur du navigateur).
- Confirmation par `grep` que le double chargement de Bootstrap (CDN + local) existait avant correction.
- Confirmation par lecture de `assets/js/main.js` que le mécanisme `data-background` s'exécute via jQuery au `DOMContentLoaded`.

Toute affirmation d'amélioration de performance (LCP, poids de page) est une **déduction technique**, pas une mesure. **Aucun chiffre avant/après n'existe.**

---

## 4. Audit SEO après optimisation

### 4.1 Indexabilité et crawlabilité

- **Vérifié** : `robots.txt` présent, n'interdit aucune page ni ressource nécessaire au rendu (CSS/JS/images). Seul `/assets/fonts/*.html` (les 2 pseudo-pages 404) est bloqué.
- **Vérifié** : `sitemap.xml` présent, contient les 3 URLs canoniques en HTTPS absolu.
- **Implémenté non vérifié** : la découverte effective par Googlebot (soumission Search Console, statut de couverture réel) n'a pas pu être testée — nécessite un accès production + Search Console (voir §6).
- **Recommandé non implémenté** : confirmation serveur de la consolidation `www` vs non-`www` et `http` vs `https` — impossible à vérifier depuis le repository (aucun fichier de configuration serveur présent).

### 4.2 Titles et meta descriptions

- **Vérifié** (via `seo-check.js`) : 3 titres uniques, 3 meta descriptions uniques et non vides, aucune donnée dupliquée entre pages.
- **Implémenté non vérifié** : le rendu réel du titre/snippet dans les résultats Google (Google réécrit parfois les titres/descriptions affichés) n'est pas contrôlable ni vérifiable sans indexation réelle.

### 4.3 Canonical URLs

- **Vérifié** : chaque page possède exactement une balise canonical, cohérente avec son URL de sitemap.
- **Recommandé non implémenté** : aucune vérification possible de la redirection serveur `/index.html` → `/` (le fichier existe physiquement sous les deux chemins sur un serveur statique classique ; la balise canonical atténue le risque de contenu dupliqué mais ne remplace pas une redirection 301 côté serveur, qui n'a pas pu être configurée ni vérifiée ici).

### 4.4 Structure H1/H2/H3

- **Vérifié** : chaque page a désormais exactement un `<h1>` représentatif de son sujet (contrôlé par script + capture d'écran de rendu réel confirmant qu'aucune régression visuelle n'a été introduite).
- **Problème persistant, documenté et non corrigé** : sauts de niveaux de titres toujours présents sur les 3 pages (ex. `index.html` : h1→h3, h3→h5, h2→h6 ; `contact.html` : h1→h4 ; `cgv.html` : h1→h4). Décision assumée de ne pas renuméroter l'ensemble de la hiérarchie car cela toucherait ~15 éléments de contenu visible/design sur les 3 pages, pour un bénéfice SEO faible (Google a publiquement indiqué que les sauts de niveaux de titres en HTML5 ne sont pas un facteur de classement direct) — voir §6.
- **Corrigé lors de la revue adversariale** : les compteurs numériques (« 200+ », « 100+ », etc.) étaient en `<h3>` uniquement pour le style visuel ; remplacés par des `<p>`.
- **Corrigé lors de la revue adversariale** : titre de section FAQ dupliqué à l'identique avec le titre de la section « À propos » (« Votre partenaire de confiance ») ; reformulé.

### 4.5 Maillage interne

- **Vérifié** : tous les liens internes (`href`) référencent des fichiers réellement présents (contrôlé par `seo-check.js`).
- **Problème identifié, non corrigé** : `contact.html` et `cgv.html` n'ont **aucun footer** (contrairement à `index.html`), donc aucun lien vers `cgv.html` depuis `contact.html`, aucune répétition NAP (nom/adresse/téléphone), aucun lien social sur ces deux pages. Un visiteur arrivant directement sur `/contact.html` ne peut atteindre `/cgv.html` sans repasser par l'accueil. Ce n'est pas un problème de crawl (le sitemap et le lien depuis `index.html` suffisent à Googlebot), mais c'est une lacune de maillage interne et d'expérience utilisateur — **non corrigée** par choix (ajouter un footer complet à 2 pages supplémentaires est un changement de mise en page non testé visuellement, jugé risqué à faire sans validation explicite).

### 4.6 Optimisation des images

- **Vérifié** : les 7 images cassées du carrousel ont été remplacées par des fichiers existants, avec des attributs `alt` rédigés après ouverture visuelle réelle de chaque image (pas de texte inventé).
- **Vérifié** : icônes purement décoratives passées à `alt=""` (bonne pratique d'accessibilité — évite le bruit pour lecteurs d'écran quand un texte adjacent porte déjà le sens).
- **Partiellement fait** : `width`/`height` ajoutés uniquement sur 2 images du carrousel (`about-11.png` : 1440×1920, `about-4.png` : 220×538 — dimensions réellement mesurées sur les fichiers). Les autres images du carrousel (`about-1.png`, `about-2.png`, `about-3.png`, `about-33.png`) n'ont **pas** reçu d'attributs `width`/`height` par manque de temps de mesure systématique — **recommandé non implémenté** pour le reste du site.
- **Recommandé non implémenté** : conversion en formats modernes (WebP/AVIF), `srcset`/`sizes` responsive — aucune image n'a été recompressée ou reconvertie.

### 4.7 SEO local Marseille/PACA

- **Vérifié** : les données réelles déjà présentes sur le site (96 Rue Paradis, 13006 Marseille ; téléphone ; email) ont été reprises telles quelles dans le JSON-LD `MovingCompany`, sans invention.
- **Recommandé non implémenté** : aucune page de service locale n'a été créée (ex. pages dédiées « déménagement Marseille », « transport PACA »), aucune stratégie de mots-clés locaux n'a été élaborée, aucune vérification/alignement avec une fiche Google Business Profile n'a été effectuée (accès non disponible). Le site ne mentionne qu'une seule zone (« toute la France » dans la FAQ) sans déclinaison géographique locale plus fine — voir §6.

### 4.8 Structured Data

- **Vérifié (syntaxe)** : les 4 blocs JSON-LD (1 sur `index.html`, 2 sur `contact.html`, 1 sur `cgv.html`) sont syntaxiquement valides (contrôlé par `seo-check.js` via `JSON.parse`).
- **Vérifié (vocabulaire)** : le type `MovingCompany` et toutes les propriétés utilisées existent réellement dans Schema.org (vérifié par récupération de la documentation officielle en ligne).
- **Implémenté non vérifié** : aucun test n'a été passé dans l'outil officiel **Google Rich Results Test** ni dans le **validateur Schema.org** (`validator.schema.org`) — ces outils nécessitent soit une URL de production déployée, soit une soumission interactive de formulaire, non réalisable depuis cet environnement.
- **Choix assumé** : aucun `AggregateRating`/`Review` n'a été ajouté malgré la présence de 4 témoignages clients visibles sur `index.html`, car aucune note chiffrée (étoiles) n'est affichée sur le site — ajouter une note inventée aurait constitué une donnée structurée mensongère.
- **Faiblesse identifiée** : `areaServed: "FR"` est fourni comme simple chaîne de texte (`Text`), ce qui est valide selon Schema.org mais moins explicite qu'un objet `Country`/`Place` structuré — non corrigé, signalé comme amélioration mineure possible.

### 4.9 Core Web Vitals

- **Aucune mesure réalisée** (voir §3.5). Les seules actions sont des corrections structurelles pouvant *raisonnablement* améliorer le LCP et réduire le poids transféré :
  - Fond du hero rendu visible dès le HTML (`style` inline) + `<link rel="preload" as="image" fetchpriority="high">`.
  - Suppression du Bootstrap CDN dupliqué (CSS + JS en double supprimés sur les 3 pages).
  - Remplacement de l'`@import` Google Fonts bloquant par `preconnect` + `<link rel="stylesheet">`.
- **Recommandé non implémenté** : compression/reconversion d'images, minification CSS/JS, mise en cache HTTP (`Cache-Control`), compression Brotli/Gzip côté serveur (hors périmètre d'un projet 100 % statique sans accès serveur).

### 4.10 Sécurité des formulaires

- **Vérifié** : aucune clé secrète serveur n'est exposée (seule une clé **publique** EmailJS est présente, ce qui est le fonctionnement normal prévu par EmailJS).
- **Non vérifié / hors périmètre** : configuration des domaines autorisés et des limites d'envoi dans le dashboard EmailJS (accès non disponible depuis cet environnement).
- **Non implémenté** : aucune protection anti-spam (captcha, honeypot, rate-limiting) n'a été ajoutée aux formulaires — **recommandation, voir §6**.
- **Risque résiduel non traité** : la validation des champs reste 100 % côté client (JavaScript) ; sans backend, il n'existe aucune validation serveur des données avant transmission à EmailJS. Ceci est une contrainte architecturale du projet (site statique sans serveur), pas une régression introduite.

---

## 5. Revue adversariale

Une deuxième passe d'audit indépendante a été réalisée après la première série de corrections, avec pour consigne explicite de chercher les défauts plutôt que de valider le travail. Constats de cette deuxième passe :

### 5.1 Défauts confirmés et corrigés lors de cette deuxième passe

| # | Défaut trouvé | Preuve technique | Correction appliquée |
|---|---|---|---|
| 1 | Compteurs numériques (« 200+ », « 100+ », « 20+ », « 200+ ») en `<h3>` uniquement pour le style visuel | Script d'analyse de séquence de titres | Passage en `<p class="counter">`/`<p class="counter-plus">` + classes CSS ajoutées pour préserver l'apparence (vérifié par capture d'écran avant/après identique) |
| 2 | Titre « Votre partenaire de confiance » dupliqué à l'identique entre la section « À propos » (h3) et la section FAQ (h2) | `grep` : 2 occurrences exactes | Reformulation du titre FAQ en « Vos questions, nos réponses » |
| 3 | Risque de régression visuelle non vérifié après changement de balises de titre (`h1`/`h2`/`h3`) | — | Vérification par rendu réel dans un navigateur (captures d'écran) confirmant qu'aucune taille de police n'a changé visuellement |

### 5.2 Vérifications qui ont confirmé la solidité du travail (pas seulement supposées)

- Absence d'identifiants HTML dupliqués sur les 3 pages (contrôlé par script, pas par relecture visuelle).
- Un seul `<h1>` par page (contrôlé par script).
- Type Schema.org `MovingCompany` réellement existant et à jour (contrôlé par récupération de la documentation officielle, pas supposé).
- Absence de toute dépendance à `data-bs-toggle` (donc à Popper) avant suppression du Bootstrap CDN (contrôlé par `grep`, pas supposé).
- Aucune ressource cassée après remplacement des images du carrousel (contrôlé par logs serveur HTTP réels, pas par simple lecture de code).

### 5.3 Points où une affirmation initiale a dû être nuancée ou corrigée

- L'affirmation implicite que les données structurées étaient « validées » a été précisée : seule la syntaxe JSON et l'existence du vocabulaire Schema.org ont été vérifiées, **pas** un passage réel dans le Rich Results Test de Google.
- L'affirmation qu'une amélioration de performance avait été apportée a été explicitement requalifiée en « déduction architecturale non mesurée », faute d'outil de mesure disponible.
- La consolidation canonique www/non-www/http/https a été reconnue comme **non vérifiable** depuis ce repository (absence de fichier de configuration serveur), et non comme « traitée ».

### 5.4 Problèmes identifiés mais toujours non corrigés à ce jour

- Sauts de hiérarchie de titres (h1→h3, h2→h6, h1→h4, etc.) sur les 3 pages — voir §4.4 et §6.
- Absence de footer (donc de maillage interne et de répétition NAP) sur `contact.html` et `cgv.html` — voir §4.5 et §6.
- Champs de formulaire conditionnels (sections déménagement/transport) sans `aria-label` — voir §2.4 et §6.
- Aucun test de performance chiffré (Lighthouse/PSI/CrUX) — voir §3.5 et §6.

---

## 6. Travaux restant à effectuer

### CRITIQUE

- Aucun. Aucun défaut critique connu ne subsiste au moment de la rédaction de ce rapport (les 404 d'images et le blocage du LCP identifiés en phase d'audit initial ont été corrigés et vérifiés).

### HAUTE

1. **Vérification de la consolidation canonique au niveau serveur** (www vs non-www, http vs https) — nécessite un accès à la configuration d'hébergement de `go-delivery.fr`, indisponible depuis ce repository.
2. **Soumission réelle à Google Search Console** (vérification de propriété, soumission du `sitemap.xml`, contrôle de la couverture d'indexation réelle) — nécessite un accès production + Search Console.
3. **Mesure réelle des Core Web Vitals** (Lighthouse, PageSpeed Insights, ou données CrUX une fois le trafic réel disponible) — nécessite soit un déploiement en production, soit un outil de mesure non disponible dans cet environnement.
4. **Maillage interne manquant** sur `contact.html` et `cgv.html` (pas de footer, pas de lien vers les CGV depuis la page de devis) — nécessite une décision de mise en page avant implémentation (voir §4.5).

### MOYENNE

5. **Correction complète des sauts de hiérarchie de titres** sur les 3 pages — nécessite de revoir le contenu visible de plusieurs sections (FAQ, témoignages, articles CGV), donc une validation éditoriale avant modification.
6. **`aria-label` sur les champs conditionnels** des formulaires (sections déménagement/transport dans `contact.html`) — travail mécanique restant, non fait par manque de temps dans cette itération.
7. **Attributs `width`/`height`** sur les images du carrousel non encore mesurées (`about-1.png`, `about-2.png`, `about-3.png`, `about-33.png`) pour finaliser la prévention de CLS.
8. **Ajout d'un `Country`/`Place` structuré** pour `areaServed` dans le JSON-LD au lieu d'une simple chaîne `"FR"`.
9. **Validation officielle des données structurées** via Google Rich Results Test et `validator.schema.org` une fois le site déployé.

### FAIBLE

10. **Pages de service locales dédiées** (ex. « déménagement Marseille », « transport PACA », pages par ville) — nécessite une stratégie de contenu et des informations business supplémentaires (zones réellement couvertes, tarifs indicatifs, etc.) qui n'ont pas été fournies ; aucune page n'a été créée pour éviter d'inventer du contenu.
11. **Stratégie de mots-clés et cartographie page/intention de recherche** approfondie — non réalisée faute de données de recherche réelles (volumes, positions actuelles) accessibles depuis cet environnement.
12. **Alignement avec la fiche Google Business Profile** — nécessite un accès à cette fiche, non disponible ici.
13. **Protection anti-spam des formulaires** (captcha/honeypot/rate-limiting) — recommandé mais non implémenté.
14. **Conversion des images en WebP/AVIF et `srcset` responsive** — non réalisée, aucune image n'a été recompressée.
15. **Ajout de tests automatisés supplémentaires** dans `seo-check.js` (validation Schema.org réelle, détection de sauts de titres, vérification de contraste) — le script actuel couvre un socle minimal, pas l'ensemble des contrôles possibles.

---

## 7. Recommandations pour la mise en production

Avant de déployer ces modifications sur `https://go-delivery.fr/`, il est recommandé de :

1. **Exécuter `node seo-check.js`** une dernière fois juste avant le déploiement pour confirmer qu'aucune régression n'a été introduite entre-temps (code de sortie `0` attendu).
2. **Vérifier manuellement en local** (`python -m http.server` ou équivalent) le rendu des 3 pages dans un navigateur, en particulier :
   - Le carrousel « À propos » sur `index.html` (6 slides désormais, contre 9 avant — s'assurer visuellement que la boucle automatique reste fluide).
   - Le formulaire de contact du footer (`index.html`) : vérifier que l'erreur du champ « nom » s'affiche bien désormais quand il est vide.
   - Le formulaire de devis (`contact.html`) sur un écran < 576px de large : vérifier que le texte du bouton passe bien à « Envoyer » sans erreur console.
3. **Ne pas déployer sans avoir relu le contenu du JSON-LD** (`index.html`, `contact.html`, `cgv.html`) pour confirmer que les coordonnées (adresse, téléphone, email) sont toujours exactes au moment du déploiement (aucune donnée n'a été inventée, mais une adresse/un numéro peuvent avoir changé depuis la rédaction de ce rapport).
4. **Après déploiement uniquement** :
   - Soumettre `https://go-delivery.fr/sitemap.xml` dans Google Search Console.
   - Tester les 3 pages dans l'outil **Google Rich Results Test**.
   - Lancer un audit **PageSpeed Insights** (mobile et desktop) pour obtenir un premier chiffre réel de LCP/INP/CLS — à ce jour, aucun chiffre de ce type n'existe pour ce site.
   - Vérifier dans Search Console, après quelques jours, que les 3 pages passent bien au statut « Indexée » et qu'aucune erreur de couverture n'apparaît.
5. **Configurer, au niveau de l'hébergeur** (hors du périmètre de ce repository), la redirection définitive entre variantes d'URL (www/non-www, http/https) si ce n'est pas déjà fait — ce point n'a pas pu être vérifié ni corrigé depuis le code source seul.
6. **Ne pas oublier** que `assets/fonts/remixicon0c93.html` et `remixicon0c93-2.html` restent physiquement présents sur le serveur (seulement bloqués pour le crawl via `robots.txt`) — leur suppression reste une option si l'accès disque est possible, mais n'a pas été effectuée dans ce repository par prudence (principe de ne pas supprimer de fichiers existants sans confirmation explicite).

---

*Fin du rapport. Toute section marquée « non vérifié » ou « non implémenté » nécessite une action humaine supplémentaire (accès production, Search Console, décision éditoriale/business) avant de pouvoir être close.*
