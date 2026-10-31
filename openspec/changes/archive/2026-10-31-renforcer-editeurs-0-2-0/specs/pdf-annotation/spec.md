# Spec Delta

## Purpose

Permet d’annoter un PDF avec des repères visuels — surlignage, encre libre et formes — puis de les aplatir dans le document enregistré ou exporté.

## ADDED Requirements

### Requirement: Surlignage par zone

L’utilisateur DOIT pouvoir créer un surlignage rectangulaire sur une page, avec une couleur et une opacité réglables.

#### Scenario: Création d’un surlignage

- **WHEN** l’utilisateur active l’outil surligneur et fait glisser sur la page
- **THEN** un rectangle translucide apparaît à l’emplacement tracé et devient sélectionnable

#### Scenario: Surlignage trop petit

- **WHEN** le glissement produit une zone de moins de quelques pixels
- **THEN** aucun surlignage n’est créé et l’outil reste actif

### Requirement: Encre libre

L’utilisateur DOIT pouvoir dessiner des traits libres sur une page, avec une couleur et une épaisseur réglables.

#### Scenario: Tracé à main levée

- **WHEN** l’utilisateur dessine avec l’outil encre
- **THEN** le tracé suit le pointeur et conserve la couleur et l’épaisseur choisies

#### Scenario: Tracé d’un seul point

- **WHEN** l’utilisateur clique sans déplacer le pointeur
- **THEN** un point de la taille du trait est ajouté à la page

### Requirement: Formes simples

L’utilisateur DOIT pouvoir ajouter un rectangle ou une flèche sur une page.

#### Scenario: Ajout d’une forme

- **WHEN** l’utilisateur sélectionne une forme et fait glisser sur la page
- **THEN** la forme est créée avec les dimensions du glissement et devient sélectionnable

### Requirement: Manipulation des annotations

Toute annotation DOIT pouvoir être sélectionnée, déplacée et redimensionnée directement sur la page.

#### Scenario: Déplacement d’une annotation

- **WHEN** l’utilisateur fait glisser une annotation sélectionnée
- **THEN** sa position est mise à jour sans sortir des limites de la page

#### Scenario: Redimensionnement d’une annotation

- **WHEN** l’utilisateur tire une poignée d’une annotation sélectionnée
- **THEN** ses dimensions sont mises à jour en conservant un minimum visible

### Requirement: Historique des annotations

Les ajouts, déplacements, redimensionnements, changements de style et suppressions d’annotations DOIVENT participer à l’historique annuler/rétablir du PDF.

#### Scenario: Annulation d’une annotation

- **WHEN** l’utilisateur ajoute une annotation puis annule
- **THEN** l’annotation disparaît et peut être rétablie

#### Scenario: Annulation d’un déplacement

- **WHEN** l’utilisateur déplace une annotation puis annule
- **THEN** l’annotation retrouve sa position précédente

### Requirement: Aplatissement à l’enregistrement

Les annotations DOIVENT être intégrées au contenu du PDF lors de l’enregistrement ou de l’export, à la position et à la rotation correctes de la page.

#### Scenario: Export d’un PDF annoté

- **WHEN** l’utilisateur enregistre ou exporte un PDF contenant des annotations
- **THEN** le fichier produit affiche les annotations sur les bonnes pages, y compris sur une page pivotée

#### Scenario: Annotations non éditables après export

- **WHEN** le PDF exporté est rouvert dans un autre lecteur
- **THEN** les annotations sont visibles comme contenu du document et ne dépendent pas d’une couche propriétaire
