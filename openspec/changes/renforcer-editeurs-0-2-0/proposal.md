# Proposal

## Why

DocumentsLab 0.1.0 alpha pose déjà les bons gestes — signature PDF, édition de texte, retouche d’image, bibliothèque locale — mais ces outils restent superficiels : les annotations PDF se limitent au texte et à la signature, les transformations d’image sont irréversibles, et la bibliothèque ne travaille qu’un document à la fois. La 0.2.0 doit approfondir l’existant plutôt qu’ouvrir de nouveaux fronts, en restant une alpha Linux.

## What Changes

- **Annotations PDF** : ajouter un surligneur (zone rectangulaire), l’encre libre et des formes simples, avec couleur, épaisseur et opacité. Les annotations sont déplaçables, redimensionnables, annulables et aplaties à l’export.
- **Gestion des pages PDF** : dupliquer une page, insérer les pages d’un autre PDF et extraire une sélection de pages vers un nouveau PDF.
- **Historique d’image** : annuler/rétablir l’ensemble des opérations (rotation, miroir, recadrage, filtres, traits), avec une profondeur et un budget mémoire bornés.
- **Retouche d’image** : ratios de recadrage, redimensionnement en pixels et qualité JPEG à l’export.
- **Bibliothèque** : sélection multiple avec actions groupées (favori, suppression) et persistance du tri et du mode d’affichage entre deux lancements.
- **Qualité** : tests ciblés sur la logique de bibliothèque, de traits et d’historique, plus vérification manuelle des parcours import/enregistrement/export.
- Pas de changement cassant pour les documents existants.
- Hors périmètre : Windows/macOS, auto-update, OCR, tags/collections, internationalisation.

## Capabilities

### New Capabilities

- `pdf-annotation` : outils d’annotation du PDF (surligneur, encre, formes), styles et export aplati.
- `pdf-page-management` : duplication, insertion et extraction de pages PDF.
- `image-editing` : historique annuler/rétablir, recadrage avec ratios, redimensionnement et export.
- `library-management` : sélection multiple, actions groupées et préférences d’affichage persistantes.

### Modified Capabilities

Aucune : le projet n’a pas encore de specs durables.

## Impact

- **Renderer** : `PdfEditor.tsx`, `pdf-types.ts`, `pdf-export.ts`, `ImageEditor.tsx`, `image-edit.ts`, `image.ts`, `LibraryView.tsx`, `DocumentCard.tsx`, `App.tsx`, `lib/library.ts`, `styles.css`.
- **Partagé** : éventuellement `shared/types.ts` pour les préférences persistées.
- **Processus principal** : aucun nouveau canal IPC ; l’insertion d’un PDF réutilise `openFileDialog`/`readExternal`, l’extraction réutilise `saveFile`.
- **Dépendances** : `pdf-lib` est déjà présent ; ajout d’un outil de test léger (`vitest`) pour la logique pure.
- **Stockage** : préférences d’affichage en `localStorage` ; aucun changement du format `library.json`.
