# Design

## Context

Voir `proposal.md` pour la motivation. Les contraintes techniques actuelles qui façonnent l’approche :

- `PdfEditState` ne connaît qu’un seul PDF source et indexe les annotations par page d’origine (`pageOrder`, `overlays`). Les coordonnées sont en points d’affichage, avec conversion par `mapDisplayPoint`/`mapSignatureRect` pour les pages pivotées.
- `ImageEditor` modifie un canvas `base` en place ; seuls les traits disposent d’une annulation, et uniquement du dernier trait.
- La bibliothèque garde son état de tri et de vue dans `App.tsx`, sans persistance ; les cartes n’ont aucune sélection multiple.
- `pdf-lib` est déjà utilisé pour l’export et sait copier des pages (`copyPages`), dessiner rectangles, lignes et tracés SVG, avec opacité.
- Aucun nouveau canal IPC n’est nécessaire : insertion via `openFileDialog` + `readExternal`, extraction via `saveFile`.
- Cible : alpha Linux uniquement.

## Goals / Non-Goals

**Goals:**

- Étendre le modèle d’annotation PDF sans casser les documents ni l’export existant.
- Rendre les opérations de pages composables et annulables, avec une source de vérité unique.
- Donner à l’image un historique réactif et borné, sans copier inutilement les gros canvases.
- Garder les actions groupées de la bibliothèque indépendantes de l’IPC existant.

**Non-Goals:**

- Pipeline d’image entièrement non destructif par rejeu d’opérations.
- Rendu des annotations dans une couche PDF interactive propriétaire (elles sont aplaties).
- Migration de `library.json` ou changement du format des fichiers enregistrés.
- Packaging Windows/macOS, OCR, tags, i18n.

## Decisions

### 1. Modèle d’annotation PDF : union discriminée étendue

Ajouter à `PdfOverlay` trois variantes :

```text
HighlightOverlay  { x, y, width, height, color, opacity }
InkOverlay        { points[], color, width, opacity }
ShapeOverlay      { kind: 'rect' | 'arrow', x, y, width, height, color, width, opacity }
```

Les coordonnées restent en points d’affichage, comme le texte et la signature. Les annotations rectangulaires partagent les mêmes poignées de redimensionnement ; l’encre est stockée avec ses points et une boîte englobante, puis mise à l’échelle lors du redimensionnement.

`Tool` devient `select | text | highlight | ink | shape` (avec un `shapeKind` séparé). La création se fait au glissement sur `pdf-page-surface`, avec un aperçu temporaire. Toute création ou modification passe par `commitState`, donc l’historique PDF existant est réutilisé tel quel.

**Alternatives rejetées :** rasteriser la page annotée à chaque modification (perte de netteté, mémoire) ; ajouter une couche PDF interactive (hors périmètre alpha).

### 2. Export PDF : primitives vectorielles natives

L’aplatissement utilise les primitives `pdf-lib` plutôt qu’une image :

- surlignage et rectangle : `drawRectangle` avec `opacity` ;
- encre : segments `drawLine` (ou `drawSvgPath`) avec épaisseur et opacité ;
- flèche : ligne principale + deux segments de tête.

Chaque point passe par `mapDisplayPoint` ; les rectangles passent par une conversion équivalente à `mapSignatureRect`. Cela garantit le bon placement sur les pages `/Rotate`.

**Alternative rejetée :** rendre la couche d’annotations en PNG puis l’insérer (simple, mais flou au zoom et plus lourd).

### 3. Pages PDF : références de pages plutôt que fusion et rechargement

Remplacer `pageOrder: number[]` par une liste de références stables :

```text
PageRef { id, sourceId, index }
PdfEditState {
  pages: PageRef[]
  overlays: Record<pageId, PdfOverlay[]>
  sources: Record<sourceId, { bytes, label }>
}
```

- La source principale garde l’id `main`; chaque PDF inséré reçoit un id et ses octets.
- `overlays` est désormais indexé par `PageRef.id`, ce qui permet de dupliquer une page avec ses annotations sans ambiguïté.
- L’aperçu garde un `Map<sourceId, PDFDocumentProxy>` et charge un document inséré une seule fois.
- L’export charge chaque source avec `pdf-lib` et copie les pages dans l’ordre de `pages`.
- Duplication : copier la `PageRef` avec un nouvel id et cloner ses annotations.
- Insertion : charger le PDF externe, créer les `PageRef` correspondantes et les insérer après la page courante.
- Extraction : construire un PDF neuf à partir des `PageRef` sélectionnées, avec annotations aplaties, puis `saveFile`.

**Alternative rejetée :** fusionner les octets puis recharger tout le document. Plus simple à court terme, mais coûteux à chaque duplication, et l’annulation imposerait de conserver des octets entiers.

### 4. Historique image : snapshots à partage structurel et budget mémoire

Un snapshot contient des références immuables :

```text
ImageSnapshot { base, strokes, filters }
```

- `base` n’est jamais muté : rotation, miroir et recadrage créent un nouveau canvas ; les filtres et traits ne changent que leurs propres objets.
- Les snapshots qui ne changent pas `base` partagent donc le même canvas.
- Profondeur cible : 20 opérations. Budget dur : 256 Mo, estimé à `largeur × hauteur × 4` par canvas référencé ; les plus anciens sont évincés en premier.
- Les curseurs de réglages sont coalescés : un snapshot est pris au début de l’interaction et l’entrée n’est ajoutée qu’au relâchement, pour éviter une entrée par pixel de glissement.
- `Ctrl/Cmd+Z` et `Ctrl/Cmd+Shift+Z` réutilisent le gestionnaire clavier de l’éditeur. La réinitialisation est elle-même une opération annulable.

**Alternative rejetée :** journal d’opérations rejoué depuis l’original. Plus économe en théorie, mais impose de reconstruire tout le pipeline de transformation et de traits.

### 5. Recadrage et export image

- Ratio de recadrage stocké en ratio normalisé : `ratio × hauteurImage / largeurImage`, car la zone est en coordonnées normalisées.
- Les poignées appliquent ce ratio ; le changement de ratio recentre et borne la zone.
- Dimensions d’export : largeur/hauteur en pixels, ratio verrouillable. La composition est redimensionnée après filtres et traits.
- Qualité JPEG passée à `canvas.toDataURL('image/jpeg', qualité)` via une extension de `canvasToBytes`.
- Les dimensions non entières, nulles ou négatives sont refusées ; un plafond raisonnable évite les canvas démesurés.

### 6. Bibliothèque : sélection locale et préférences validées

- La sélection vit dans `LibraryView` (`Set<string>`), car elle dépend de la liste filtrée.
- `Ctrl/Cmd+clic` bascule un document ; `Maj+clic` sélectionne une plage ; un clic simple ouvre le document et vide la sélection ; `Échap` vide la sélection.
- Les actions groupées appellent les handlers existants en boucle côté `App` (`Promise.all`), sans nouvel IPC. La suppression groupée réutilise la boîte de confirmation.
- Les préférences de tri et de vue sont lues/écrites dans `localStorage` via un petit module validant les valeurs ; toute valeur absente ou inconnue retombe sur `modified` + `grid`.

### 7. Tests

Ajouter `vitest` et tester la logique pure :

- filtres/tri de bibliothèque et validation des préférences ;
- transformations de traits (rotation, miroir, recadrage) ;
- calcul de ratio de recadrage et dimensions d’export ;
- éviction de l’historique selon profondeur et budget ;
- ordre, duplication et extraction des `PageRef` ;
- conversion des points d’annotation pour les quatre rotations.

Les parcours visuels (placement, export réel, aperçu) restent vérifiés manuellement.

## Risks / Trade-offs

- **Refonte de `PdfEditState`** → migrer par étapes : d’abord le modèle et l’export, puis l’aperçu, en gardant les tests de conversion de coordonnées. Aucun fichier utilisateur n’est modifié.
- **Mémoire de l’historique image** → partage structurel, budget dur, éviction testée. Une image exceptionnellement grande peut réduire la profondeur réelle ; c’est assumé et signalé dans le design.
- **Traits d’encre redimensionnés** → tester les mises à l’échelle et les bornes ; limiter le minimum pour éviter les tracés invisibles.
- **Conflit sélection/ouverture des cartes** → modifier les clics explicitement et couvrir `Ctrl`, `Maj`, `Échap` par des scénarios.
- **Flèches sur pages pivotées** → tester les quatre rotations et vérifier visuellement l’orientation de la tête.
- **Coalescence des réglages** → si mal implémentée, une annulation peut sauter plusieurs valeurs ; tester une interaction complète.

## Migration Plan

- Aucune migration de données : `library.json` et les fichiers importés restent inchangés.
- Les préférences d’affichage sont de nouvelles clés `localStorage`, sans effet sur les versions précédentes.
- Les PDF enregistrés restent des PDF standards ; les annotations sont aplaties.
- En cas de problème, un retour au code 0.1.0 suffit : aucun format persistant n’a changé.

## Open Questions

- Palette exacte des annotations et dimensions maximales d’export : décision de finition, sans impact sur l’architecture.
- Faut-il exposer l’extraction aussi comme « nouveau document dans la bibliothèque » ? Le design retient l’export fichier pour cette version ; l’ajout ultérieur ne change pas le modèle.
