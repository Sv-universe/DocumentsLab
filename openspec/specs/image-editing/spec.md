# image-editing Specification

## Purpose
Donne à l’éditeur d’image un historique fiable et des contrôles d’export précis, afin que les transformations et retouches restent réversibles jusqu’à l’enregistrement.

## Requirements

### Requirement: Historique global

Toutes les opérations d’image — rotation, miroir, recadrage, filtres, traits et réinitialisation — DOIVENT pouvoir être annulées et rétablies.

#### Scenario: Annulation d’une rotation

- **WHEN** l’utilisateur pivote l’image puis annule
- **THEN** l’image retrouve son orientation et ses dimensions précédentes

#### Scenario: Annulation d’un recadrage

- **WHEN** l’utilisateur recadre l’image puis annule
- **THEN** l’image complète et les traits précédents sont restaurés

#### Scenario: Rétablissement

- **WHEN** l’utilisateur rétablit après une annulation
- **THEN** l’opération annulée est réappliquée à l’identique

### Requirement: Profondeur et budget mémoire

L’historique DOIT viser une profondeur de vingt opérations et respecter un budget mémoire de 256 Mo ; lorsque le budget est atteint, les états les plus anciens sont oubliés avant l’ajout d’un nouvel état.

#### Scenario: Longue session d’édition

- **WHEN** l’utilisateur enchaîne plus d’opérations que la profondeur maximale
- **THEN** les opérations les plus récentes restent annulables et l’application ne se bloque pas

#### Scenario: Libération de mémoire

- **WHEN** le budget mémoire de l’historique est dépassé
- **THEN** les états les plus anciens sont libérés avant d’ajouter un nouvel état

### Requirement: Ratios de recadrage

L’outil de recadrage DOIT proposer un mode libre et des ratios prédéfinis, dont 1:1, 4:3 et 16:9.

#### Scenario: Recadrage avec ratio

- **WHEN** l’utilisateur choisit le ratio 1:1 et ajuste la zone
- **THEN** la zone conserve un rapport largeur/hauteur de 1 pendant le redimensionnement

#### Scenario: Retour au mode libre

- **WHEN** l’utilisateur repasse en mode libre
- **THEN** la zone peut être redimensionnée sans contrainte de ratio

### Requirement: Redimensionnement à l’export

L’utilisateur DOIT pouvoir définir les dimensions en pixels de l’image exportée, avec conservation facultative du ratio.

#### Scenario: Export à une largeur donnée

- **WHEN** l’utilisateur saisit une nouvelle largeur avec le ratio verrouillé
- **THEN** la hauteur est recalculée et l’aperçu indique les dimensions finales

#### Scenario: Dimensions invalides

- **WHEN** l’utilisateur saisit une dimension nulle ou négative
- **THEN** l’export est refusé avec un message explicite

### Requirement: Qualité JPEG

L’export JPEG DOIT proposer un réglage de qualité et l’appliquer au fichier produit.

#### Scenario: Export JPEG en qualité réduite

- **WHEN** l’utilisateur choisit une qualité JPEG basse puis exporte
- **THEN** le fichier produit est un JPEG dont la taille est cohérente avec la qualité choisie

### Requirement: Raccourcis d’historique

Les raccourcis Ctrl/Cmd+Z et Ctrl/Cmd+Shift+Z DOIVENT annuler et rétablir les opérations d’image.

#### Scenario: Raccourci d’annulation

- **WHEN** l’éditeur d’image a le focus et que l’utilisateur presse Ctrl/Cmd+Z
- **THEN** la dernière opération d’image est annulée

#### Scenario: Historique vide

- **WHEN** l’utilisateur presse le raccourci d’annulation sans opération disponible
- **THEN** rien ne change et aucune erreur n’est affichée
