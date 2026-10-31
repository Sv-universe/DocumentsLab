# Changelog

## v0.2.0 — 31 octobre 2026

Deuxième version alpha : les outils existants gagnent en profondeur, sans changer le format des fichiers.

### PDF

- Surlignage par zone, encre libre, rectangles et flèches.
- Couleur, opacité et épaisseur des annotations.
- Sélection, déplacement et redimensionnement des annotations.
- Aplatissement vectoriel des annotations à l’enregistrement et à l’export.
- Duplication de pages avec leurs annotations.
- Insertion des pages d’un autre PDF après la page courante.
- Extraction d’une sélection de pages vers un nouveau fichier PDF.
- Gestion des fichiers invalides ou protégés lors de l’insertion.

### Images

- Historique annuler/rétablir pour toutes les transformations, retouches et traits.
- Profondeur de 20 opérations avec budget mémoire de 256 Mo.
- Ratios de recadrage libre, 1:1, 4:3 et 16:9.
- Dimensions d’export en pixels avec verrouillage du ratio.
- Qualité JPEG réglable.

### Bibliothèque

- Sélection multiple avec Ctrl/Cmd et Maj.
- Ajout ou retrait groupé des favoris.
- Suppression groupée avec confirmation.
- Tri et mode grille/liste conservés entre deux lancements.

### Qualité

- Tests automatisés de la sélection, des préférences, de l’historique, des ratios, de la géométrie PDF et de l’export multi-pages.
- Délai de garde sur la génération de vignette pour éviter un enregistrement bloqué.

## v0.1.0 — 31 octobre 2026

Première version publique de DocumentsLab.

### Bibliothèque

- Import de fichiers PDF et d’images (PNG, JPG/JPEG, WebP, GIF, BMP, AVIF).
- Import par glisser-déposer, sélection de fichiers ou dossier complet.
- Vignettes, recherche, tri, favoris, renommage, suppression et affichage dans le dossier.
- Vues grille et liste.

### PDF

- Lecture avec zoom, navigation et ajustement à la largeur.
- Signature dessinée ou importée depuis une image, déplaçable et redimensionnable.
- Ajout de texte avec taille, couleur et gras.
- Réorganisation et suppression de pages.
- Annuler/rétablir.
- Enregistrement dans la bibliothèque ou export d’une copie.
- Gestion des PDF dont les pages sont déjà pivotées.

### Images

- Visualisation avec zoom et déplacement.
- Rotation et miroirs horizontal/vertical.
- Recadrage interactif.
- Luminosité, contraste, saturation et noir & blanc.
- Marqueur avec annulation du dernier trait.
- Export PNG, JPG ou WebP.

### Application

- Interface locale, sans cloud ni télémétrie.
- Thème clair, fenêtre personnalisée et raccourcis clavier.
- Protection contre la fermeture avec des modifications non enregistrées.
- Crédits et identité visuelle Sv Universe.
