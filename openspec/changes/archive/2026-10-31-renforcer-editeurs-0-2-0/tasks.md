# Tasks

## 1. Outillage et préférences

- [x] 1.1 Ajouter `vitest` et un script `npm test`, puis un test de fumée ; vérifier que `npm test` s’exécute sans échec.
- [x] 1.2 Créer `src/renderer/src/lib/preferences.ts` (lecture/écriture validée du tri et de la vue) et ses tests ; vérifier que les valeurs absentes ou invalides retombent sur `modified` + `grid`.
- [x] 1.3 Brancher les préférences dans `App.tsx` ; vérifier par test que la valeur écrite est relue, puis manuellement après relance de l’application.

## 2. Bibliothèque multi-sélection

- [x] 2.1 Extraire les helpers purs de sélection (bascule, plage, nettoyage) et les tester ; vérifier les cas Ctrl/Cmd, Maj et liste vide.
- [x] 2.2 Ajouter la sélection multiple dans `LibraryView`/`DocumentCard` (Ctrl/Cmd, Maj, Échap, compteur visible) ; vérifier manuellement qu’un clic simple ouvre toujours le document.
- [x] 2.3 Ajouter les actions groupées favori et suppression dans `App.tsx`, avec confirmation indiquant le nombre exact ; vérifier manuellement l’ajout/retrait groupé et l’annulation de suppression.
- [x] 2.4 Documenter la sélection multiple et les actions groupées dans le README ; vérifier que la section décrit le comportement réellement livré.

## 3. Historique et export d’image

- [x] 3.1 Créer le module d’historique image (snapshots à partage structurel, profondeur 20, budget 256 Mo) et ses tests d’éviction ; vérifier que le canvas le plus ancien est libéré en premier.
- [x] 3.2 Intégrer l’historique dans `ImageEditor` pour toutes les opérations, avec boutons et raccourcis Ctrl/Cmd+Z et Ctrl/Cmd+Shift+Z ; vérifier manuellement rotation, recadrage, filtres et traits annulés puis rétablis.
- [x] 3.3 Coalescer les curseurs de réglages en une seule entrée d’historique par interaction ; vérifier qu’un glissement complet s’annule en une seule fois.
- [x] 3.4 Ajouter les ratios de recadrage (libre, 1:1, 4:3, 16:9) avec helper testé ; vérifier qu’une poignée conserve le ratio et que le mode libre le relâche.
- [x] 3.5 Ajouter les dimensions d’export, le verrouillage du ratio et la qualité JPEG ; vérifier par tests les dimensions invalides et manuellement le poids d’un JPEG basse qualité.
- [x] 3.6 Documenter l’historique, les ratios et les options d’export dans le README ; vérifier que les raccourcis et limites annoncés correspondent au comportement livré.

## 4. Modèle de pages PDF

- [x] 4.1 Remplacer `pageOrder` par des `PageRef` et indexer `overlays` par identifiant de page ; vérifier par typecheck et par ouverture d’un PDF existant que l’affichage et les annotations texte/signature restent corrects.
- [x] 4.2 Adapter l’aperçu à un registre de documents PDF par source ; vérifier la navigation, le zoom et le rendu d’une page de la source principale.
- [x] 4.3 Adapter `buildEditedPdf` aux sources multiples et au nouvel index d’annotations ; vérifier par test l’ordre des pages et par export réel qu’un texte et une signature restent au bon endroit.
- [x] 4.4 Ajouter des tests sur l’ordre, la duplication et l’extraction des `PageRef` ; vérifier qu’une page dupliquée possède un identifiant distinct.

## 5. Opérations de pages PDF

- [x] 5.1 Ajouter la duplication de page avec copie de ses annotations ; vérifier manuellement le nombre de pages et l’annulation/rétablissement.
- [x] 5.2 Ajouter l’insertion d’un PDF externe après la page courante, avec gestion des fichiers invalides/protégés ; vérifier l’insertion, l’annulation et le message d’erreur.
- [x] 5.3 Ajouter l’extraction d’une sélection de pages vers un fichier, annotations aplaties ; vérifier le contenu du PDF produit et l’annulation de la boîte d’enregistrement.
- [x] 5.4 Documenter la duplication, l’insertion et l’extraction dans le README ; vérifier que les limites (mot de passe, annulation) y sont explicites.

## 6. Annotations PDF

- [x] 6.1 Étendre `PdfOverlay` avec surlignage, encre et formes, puis ajouter leur création avec aperçu au glissement ; vérifier manuellement chaque outil et l’absence de création pour une zone trop petite.
- [x] 6.2 Rendre les nouvelles annotations sélectionnables, déplaçables et redimensionnables ; vérifier qu’elles restent dans la page et que l’encre se met à l’échelle.
- [x] 6.3 Ajouter les contrôles de style (couleur, opacité, épaisseur, type de forme) ; vérifier que la modification s’applique à l’annotation sélectionnée et entre dans l’historique.
- [x] 6.4 Aplatir les annotations à l’export avec les primitives `pdf-lib` ; vérifier par tests les quatre rotations et manuellement un PDF pivoté exporté.
- [x] 6.5 Documenter les outils d’annotation dans le README ; vérifier que la description correspond aux outils et styles disponibles.

## 7. Intégration

- [x] 7.1 Exécuter `npm test`, `npm run typecheck` et `npm run build` ; vérifier que les trois commandes réussissent.
- [x] 7.2 Faire un parcours manuel complet sur Linux : import, annotation, opérations de pages, enregistrement, historique d’image, export, sélection groupée ; vérifier qu’aucun document n’est perdu.
- [x] 7.3 Vérifier que `library.json` et les fichiers importés restent compatibles avec la 0.1.0, et qu’un PDF ou une image volumineuse ne bloque pas l’interface.

## Workflow follow-up

- Passer la version à 0.2.0 et mettre à jour le CHANGELOG au moment de la release.
- Reconstruire l’AppImage Linux et vérifier le parcours sur l’artefact final.
- Archiver le changement après revue.
