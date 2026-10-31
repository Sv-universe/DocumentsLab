# library-management Specification

## Purpose
Rend la bibliothèque plus efficace au quotidien en permettant de travailler sur plusieurs documents à la fois et en conservant les préférences d’affichage de l’utilisateur.

## Requirements

### Requirement: Sélection multiple

L’utilisateur DOIT pouvoir sélectionner plusieurs documents dans la bibliothèque.

#### Scenario: Sélection avec Ctrl/Cmd

- **WHEN** l’utilisateur clique sur un document en maintenant Ctrl/Cmd
- **THEN** ce document s’ajoute ou se retire de la sélection sans ouvrir l’éditeur

#### Scenario: Sélection avec Maj

- **WHEN** l’utilisateur clique sur un document en maintenant Maj après une première sélection
- **THEN** tous les documents visibles entre les deux sont sélectionnés

#### Scenario: Sélection visible

- **WHEN** des documents sont sélectionnés
- **THEN** leur état sélectionné est visible et le nombre de documents sélectionnés est annoncé

### Requirement: Actions groupées sur les favoris

L’utilisateur DOIT pouvoir ajouter ou retirer plusieurs documents des favoris en une seule action.

#### Scenario: Ajout groupé aux favoris

- **WHEN** plusieurs documents non favoris sont sélectionnés et que l’utilisateur les marque comme favoris
- **THEN** tous les documents sélectionnés deviennent favoris et les compteurs sont mis à jour

#### Scenario: Retrait groupé des favoris

- **WHEN** plusieurs favoris sont sélectionnés et que l’utilisateur les retire des favoris
- **THEN** tous les documents sélectionnés ne sont plus favoris

### Requirement: Suppression groupée

L’utilisateur DOIT pouvoir supprimer plusieurs documents après une confirmation unique et explicite.

#### Scenario: Confirmation groupée

- **WHEN** l’utilisateur lance la suppression de plusieurs documents
- **THEN** une confirmation indique le nombre exact de documents concernés

#### Scenario: Suppression effective

- **WHEN** l’utilisateur confirme la suppression groupée
- **THEN** tous les documents sélectionnés et leurs vignettes sont retirés de la bibliothèque

#### Scenario: Annulation de la suppression

- **WHEN** l’utilisateur annule la confirmation
- **THEN** aucun document n’est supprimé et la sélection est conservée

### Requirement: Nettoyage de la sélection

La sélection DOIT être vidée lorsqu’elle ne correspond plus à la liste affichée.

#### Scenario: Changement de filtre

- **WHEN** l’utilisateur change de filtre ou de recherche
- **THEN** la sélection précédente est vidée

#### Scenario: Échap

- **WHEN** une sélection est active et que l’utilisateur presse Échap
- **THEN** la sélection est vidée sans fermer l’éditeur

### Requirement: Persistance des préférences d’affichage

Le tri et le mode grille/liste DOIVENT être conservés entre deux lancements de l’application.

#### Scenario: Réouverture de l’application

- **WHEN** l’utilisateur relance l’application après avoir choisi un tri et une vue
- **THEN** la bibliothèque s’ouvre avec le même tri et le même mode d’affichage

#### Scenario: Préférence invalide

- **WHEN** la préférence enregistrée est absente ou illisible
- **THEN** la bibliothèque revient au tri par modification récente et à la vue grille
