# pdf-page-management Specification

## Purpose
Permet de faire évoluer la composition d’un PDF — dupliquer, insérer et extraire des pages — sans quitter la bibliothèque ni perdre les annotations en cours.

## Requirements

### Requirement: Duplication de page

L’utilisateur DOIT pouvoir dupliquer la page courante ; la copie est insérée juste après la page d’origine.

#### Scenario: Duplication d’une page

- **WHEN** l’utilisateur duplique la page courante
- **THEN** une copie identique apparaît juste après elle et le nombre de pages augmente de un

#### Scenario: Annulation d’une duplication

- **WHEN** l’utilisateur annule une duplication
- **THEN** la copie disparaît et le nombre de pages revient à sa valeur précédente

### Requirement: Insertion de pages depuis un PDF

L’utilisateur DOIT pouvoir insérer les pages d’un autre PDF après la page courante.

#### Scenario: Insertion réussie

- **WHEN** l’utilisateur choisit un PDF valide à insérer
- **THEN** ses pages sont ajoutées dans l’ordre après la page courante et le document reste modifiable

#### Scenario: Fichier invalide ou protégé

- **WHEN** le fichier choisi ne peut pas être lu comme un PDF
- **THEN** une erreur explicite est affichée et le document courant reste inchangé

#### Scenario: Annulation d’une insertion

- **WHEN** l’utilisateur annule une insertion de pages
- **THEN** les pages insérées sont retirées et l’ordre précédent est restauré

### Requirement: Extraction de pages

L’utilisateur DOIT pouvoir extraire une sélection de pages vers un nouveau fichier PDF.

#### Scenario: Extraction d’une sélection

- **WHEN** l’utilisateur choisit des pages et confirme l’extraction
- **THEN** un nouveau PDF contenant uniquement ces pages, dans leur ordre d’affichage, est enregistré à l’emplacement choisi

#### Scenario: Extraction avec annotations

- **WHEN** les pages extraites contiennent des annotations
- **THEN** les annotations sont aplaties dans le PDF extrait

#### Scenario: Aucune page sélectionnée

- **WHEN** l’utilisateur lance une extraction sans avoir sélectionné de page
- **THEN** l’action est refusée avec un message et aucun fichier n’est créé

#### Scenario: Annulation de la boîte d’enregistrement

- **WHEN** l’utilisateur annule la boîte de dialogue d’enregistrement
- **THEN** aucun fichier n’est écrit et le document courant reste inchangé
