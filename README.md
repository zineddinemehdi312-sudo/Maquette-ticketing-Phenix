# Phenix – Module Tickets – Lot 1 : maquette exécutable

Maquette HTML cliquable accompagnant le cahier des charges **CDC-PHENIX-TICK-2026-01**.
Elle reprend l'habillage du CRM Netcom (page *Consulter tickets*) pour que l'équipe SI
visualise le comportement attendu dans Phenix avant développement.

Les données sont **100 % fictives** : partenaires, agents, factures et montants sont générés.

## Ouvrir la maquette

- **En local** : double-cliquer sur `index.html`. Aucun serveur, aucune installation.
- **Version autonome** : `dist/phenix-tickets-lot1.html` contient tout dans un seul fichier, à envoyer par e-mail si besoin. Pour la régénérer après une modification : `python3 build.py`.
- **GitHub Pages** : possible, mais un site Pages est accessible publiquement même depuis un dépôt privé (sauf GitHub Enterprise Cloud). Le CDC étant confidentiel, préférer un dépôt privé et une ouverture en local après clonage.

## Lot 1, étape 1 : écrans couverts

| Écran | Accès | Contenu |
|---|---|---|
| Menu Tickets | Menu rapide › Tickets | Trois entrées : *Demandes de modification*, *Afficher les tickets*, *Statistiques* |
| Demandes de modification (menu) | Tuile *Demandes de modification* du menu Tickets (`#/demandes`) | Toutes les demandes : filtres, liste générale, une section par type |
| Afficher les tickets | `#/tickets` | Filtres, liste, colonnes personnalisées, export .csv |
| Statistiques | `#/stats` | Tableau de bord des traitements |
| Fiche ticket | Bouton **Ouvrir** ou n° de ticket (`#/ticket/<n°>`) | Historique des échanges, demandes rattachées, saisie des paramètres Phenix, commentaire, notifications, enregistrement |
| Demandes de modification | Lien *Nouvelle demande de modification* de la fiche ticket (`#/demandes/nouvelle?ticket=<n°>`) | Création d'une demande rattachée au ticket, liste filtrable des demandes, fiche de la demande |
| Fiche partenaire | *Afficher partenaire* sur la fiche ticket, ou code partenaire dans les listes (`#/partenaire/<code>`) | Nouvel onglet **Gestion** avec deux boutons : Tickets et Demandes de modification |
| Tickets du partenaire | Bouton *Tickets* de l'onglet Gestion (`#/partenaire/<code>/tickets`) | Tickets du partenaire, un bloc par typologie |
| Demandes de modification du partenaire | Bouton *Demandes de modification* de l'onglet Gestion (`#/partenaire/<code>/demandes`) | Demandes du partenaire, détail de chaque demande |

L'étape suivante viendra compléter cette maquette : création de ticket. Le lot 2 (ouverture par les
partenaires depuis l'extranet) est hors périmètre.

## Comportements attendus

### Typologies

Les typologies et sous-typologies sont lues dans le référentiel (`PHX.TYPOLOGIES` dans `js/referentiel.js`). Tous les écrans s'appuient dessus : filtres, statistiques, fiche ticket, notifications, pages partenaire. Ajouter une typologie ne demande donc pas de développement d'écran.

| Typologie | Sous-typologies | Boîte notifiée à l'ouverture | Champs spécifiques |
|---|---|---|---|
| Réclamation | Facturation, SAV, Déploiement, Autre | reclamations@phenix-partner.fr | Oui |
| Déploiement | DATA, VOIP, GSM | delivery@ (DATA, VOIP), mobility@ (GSM) | Non |
| Facturation | Édition factures divers, Avoir | facturation@phenix-partner.fr | Non |
| Recouvrement | Impayés, Rejet de prélèvement | recouvrement@phenix-partner.fr | Oui |
| **ADV** (ajout) | Commande, Éléments manquants, Portabilité, Résiliation, Suspension, Redimensionnement | adv@phenix-partner.fr (à créer) | Non à ce stade |

Les sous-typologies ADV sont une proposition, inspirée des files ADV de Netcom, à valider.

### Liste des tickets

**Colonnes par défaut**, toujours affichées et dans cet ordre : N° ticket, Date création,
Date mise à jour (date du dernier commentaire), Date résolution, État, Agent,
Code partenaire, Partenaire (raison sociale).

- *Date résolution* : date de passage en Résolu ou Rejeté. Vide tant que le ticket est en cours ; conservée quand il passe en Fermé.
- *Agent* vide : affiché « Non affecté ».

**Filtres** : N° ticket, Partenaire (code ou raison sociale), Typologie puis Sous-typologie
(liste filtrée selon la typologie), État, Agent (dont « Non affecté »), Créé par,
période de création.

**Par défaut** : tickets en cours de traitement (Ouvert, Attente retour partenaire,
Attente arbitrage), triés par date de création décroissante, 10 lignes par page
(choix 10 / 100 / Tout). Toutes les colonnes sont triables.

### Accès au ticket : bouton « Ouvrir »

- Chaque ligne commence par un bouton **Ouvrir**. Cette première colonne reste figée quand on fait défiler la liste horizontalement, pour que le bouton reste visible même avec beaucoup de colonnes ajoutées.
- Le **n° de ticket** est aussi un lien vers la fiche. Les deux sont de vrais liens : Ctrl+clic ou clic molette ouvre le ticket dans un nouvel onglet.
- La colonne *Ouvrir* n'apparaît ni dans le sélecteur de colonnes ni dans l'export .csv.
- Sur la fiche :
  - **Retour à la liste** retrouve les filtres, le tri et la page d'origine ;
  - **Précédent / Suivant** parcourt les tickets dans l'ordre de la liste filtrée, avec la position (« Ticket 13 sur 71 de la liste »), pour traiter une file sans revenir à la liste à chaque fois.
- Le contenu de la fiche est décrit dans la section suivante.

### Fiche ticket (modèle « Tickets Répondre » de Netcom)

La fiche reprend l'organisation de la page Netcom, de haut en bas :

1. **En-tête** : n° de ticket, agent qui suit le ticket, partenaire, état.
2. **Liens** : *Afficher partenaire* et *Nouvelle demande de modification* (écrans des prochaines étapes).
3. **Historique des échanges**, du plus ancien au plus récent. Le premier bloc présente l'ouverture : typologie, objet, description et boîte fonctionnelle notifiée. Chaque bloc suivant présente une mise à jour : changement d'état, champs modifiés avec ancienne et nouvelle valeur, commentaire, destinataires notifiés. Cet historique constitue le journal CRM demandé par le CDC (§ 4.4, § 4.5.2, RG-14).
4. **Bloc « Ticket N° »**, au-dessus du commentaire. C'est ici que les paramètres Phenix remplacent les champs Netcom (État, Statut traitement, Facturé, Montant…) :
   - État (workflow à 6 états) et Agent responsable, avec un bouton *Prendre en charge* quand le ticket n'est pas affecté ;
   - Typologie et Sous-typologie, modifiables par un manager ;
   - informations du ticket en lecture (partenaire, créateur, dates, boîte notifiée, demandes de modification) ;
   - **champs spécifiques de la typologie, générés depuis le référentiel des champs**. Un champ ajouté au référentiel apparaît ici comme dans la liste, sans développement d'écran.
5. **Commentaire.**
6. **Notification par email** :
   - l'agent responsable est toujours notifié (RG-09) ;
   - des agents peuvent être ajoutés, regroupés par équipe comme dans Netcom, ainsi que des adresses e-mail libres (RG-10) ;
   - cette liste est propre au ticket et conservée d'une mise à jour à l'autre.
7. **ENREGISTRER** : contrôle les règles, inscrit une entrée dans l'historique et simule l'envoi de l'e-mail. Les champs modifiés sont surlignés, et la liste des modifications non enregistrées s'affiche au-dessus du bouton.

Correspondance avec la page Netcom :

| Netcom | Phenix |
|---|---|
| Statut traitement « Prise en charge » | Bouton *Prendre en charge*, champ Agent responsable |
| Statut traitement « Relance » | État *Attente retour partenaire* |
| Statut traitement « Fin de traitement » | États *Résolu* / *Rejeté*, puis *Fermé* |
| Facturé / Montant € HT | Avoir accordé / Montant avoir HT (Réclamation › Facturation) ; Geste co accordé / Montant geste co HT (toutes les réclamations) |
| Suivi par | Agent responsable (réaffectation tracée, RG-11) |
| Service / Motif | Typologie / Sous-typologie (RG-14) |
| Notification par email | Agent responsable + destinataires additionnels du ticket |

**Contrôles à l'enregistrement** (bouton *Règles du workflow* sur la fiche) :

- **Workflow**
  - Transitions : Ouvert ↔ Attente retour partenaire ↔ Attente arbitrage, puis Résolu ou Rejeté, puis Fermé. Une réouverture vers Ouvert est possible depuis Résolu ou Rejeté.
  - Un agent responsable est nécessaire pour changer d'état (RG-07).
  - Tout changement d'état demande un commentaire.
  - Seul un manager fait sortir un ticket de *Attente arbitrage*.
  - *Fermé* passe le ticket en lecture seule.
- **Réclamation › Facturation**
  - N° de facture et Avoir demandé sont obligatoires.
  - Le montant réclamé est obligatoire et supérieur à 0 si un avoir est demandé (RG-05).
  - *Avoir accordé* est obligatoire pour passer en Résolu ou Rejeté. *Rejeté* impose « Non ».
  - Le montant d'avoir est obligatoire si l'avoir est accordé. Une confirmation est demandée s'il dépasse le montant réclamé.
- **Toutes les réclamations (Facturation, SAV, Déploiement, Autre)**
  - *Geste co accordé* est obligatoire pour passer en Résolu ou Rejeté.
  - Le montant du geste co est obligatoire et supérieur à 0 si le geste est accordé.
  - Un geste co reste possible sur une réclamation rejetée (geste de bonne volonté) et s'ajoute à un éventuel avoir.
- **Recouvrement**
  - N° de facture impayée et Montant HT réclamé sont obligatoires.
  - Impayés : la date d'échéance est obligatoire. Rejet de prélèvement : le motif et la date du rejet sont obligatoires.
  - Une confirmation est demandée si le montant recouvré dépasse le montant réclamé.
- **RG-15** : un profil non habilité ne voit pas les montants, ni dans les champs ni dans l'historique. S'il doit saisir un montant obligatoire, l'enregistrement est bloqué avec un message explicite.
- **Dates** : *Résolu* ou *Rejeté* renseigne la date de résolution ; une réouverture l'efface. *Fermé* renseigne la date de fermeture.

Ces règles sont des **propositions à valider** ; les transitions sont paramétrées dans `js/referentiel.js` (`PHX.TRANSITIONS`).

### Colonnes personnalisées (principe Redmine)

Le bouton **Colonnes…** ouvre deux listes : colonnes disponibles et colonnes affichées.
L'utilisateur ajoute, retire et ordonne les colonnes qui s'ajoutent aux 8 colonnes par défaut.

1. **Les colonnes disponibles sont lues dans le référentiel des champs**, pas codées dans l'écran (voir `js/referentiel.js`, `PHX.CHAMPS_BASE`). Un nouveau champ ajouté au référentiel devient une colonne sélectionnable et exportable sans modification de la table ni intervention du support.
2. Chaque champ porte une **portée** (typologie, sous-typologie). Elle sert à regrouper les colonnes dans le sélecteur. Elle sert aussi à l'affichage : cellule vide si le champ ne s'applique pas au ticket, « — » s'il s'applique mais n'est pas renseigné.
3. **La sélection est enregistrée par utilisateur** et reprise à chaque connexion. Dans la maquette, elle est conservée dans le navigateur ; en cible, elle sera stockée en base.
4. **RG-15** : les champs marqués confidentiels (montants) ne sont proposés qu'aux profils habilités. Pour les autres profils, ils apparaissent grisés et ne peuvent pas être ajoutés, à l'écran comme à l'export.

Exemples de colonnes disponibles :

| Groupe | Colonnes |
|---|---|
| Informations générales | Typologie, Sous-typologie, Objet, Créé par, Boîte notifiée, Demandes de modification |
| Réclamation › Facturation | N° de facture, Avoir demandé, Montant réclamé HT, **Avoir accordé**, **Montant avoir HT** |
| Réclamation (toutes sous-typologies) | **Geste co accordé**, **Montant geste co HT** |
| Recouvrement | N° facture impayée, Montant HT réclamé, **Montant recouvré HT** (0 € si rien n'est recouvré) |
| Recouvrement › Impayés | Date d'échéance |
| Recouvrement › Rejet de prélèvement | Motif du rejet, Date du rejet, Référence mandat (RUM) |

### Export .csv

- Contient les colonnes affichées (par défaut + ajoutées) pour **tous les tickets filtrés**, pas seulement la page visible, dans l'ordre de tri courant.
- Format pour Excel en français : séparateur `;`, UTF-8 avec BOM, dates `jj/mm/aaaa hh:mm`, montants `1250,00` (sans symbole €).
- Les cellules commençant par `=`, `+`, `-` ou `@` sont préfixées d'une apostrophe, pour neutraliser l'injection de formules. Ce sera indispensable au lot 2, quand des partenaires saisiront du texte.
- Nom du fichier : `tickets_phenix_AAAAMMJJ_HHMM.csv`.

### Statistiques

Filtres : période de création, agent, partenaire. Chaque nombre est un lien vers la liste
des tickets correspondante, avec les mêmes filtres.

| Bloc | Indicateurs |
|---|---|
| Tickets par typologie et par état | Nombre de tickets par état (dont « non affectés » parmi les Ouverts), total, délai moyen de résolution (de la création à la date de résolution). Chaque typologie se déplie en sous-typologies. |
| Avoirs – Réclamation › Facturation | Réclamations facturation, en cours, tranchées (Résolu, Rejeté, Fermé), avoirs accordés et part des tranchées, montant réclamé HT des tranchées, montant d'avoir accordé HT, taux accordé / réclamé, montant réclamé HT en cours. |
| Gestes commerciaux – Réclamation | Par sous-typologie : réclamations tranchées, gestes co accordés, montant HT. Total avec la part des réclamations tranchées ayant reçu un geste. |
| Recouvrement | Dossiers (impayés / rejets), en cours, montant HT réclamé, montant recouvré HT, taux de recouvrement, reste à recouvrer. |
| Charge par agent | Tickets en cours par agent et par état, avec la ligne « Non affectés ». |

Les montants sont masqués pour les profils non habilités (RG-15).

### Workflow : 6 états

| État | Signification |
|---|---|
| Ouvert | Ticket créé, pris en charge ou en attente de prise en charge |
| Attente retour partenaire | En attente d'éléments du partenaire. Au lot 1, l'agent repasse lui-même le ticket en Ouvert à réception |
| Attente arbitrage | Décision à valider par le manager (ex. montant d'avoir, échéancier) |
| Résolu | Décision rendue en faveur du partenaire ou traitement effectué |
| Rejeté | Demande non fondée ou non recevable |
| Fermé | Clôture définitive, lecture seule |

Les transitions autorisées seront décrites avec la fiche ticket (étape suivante).

### Demandes de modification (modèle « Demandes Clients » de Netcom, CDC § 4.6)

**Création depuis un ticket.** Le lien *Nouvelle demande de modification* de la fiche ticket ouvre la page des demandes, sur le modèle de la page Netcom :

1. **En-tête** : code partenaire et n° de ticket, hérités du ticket et non modifiables (CDC § 4.6.1).
2. **Éléments du ticket** :
   - avoir accordé et geste co accordé, avec un bouton qui prépare la demande d'avoir (montant, facture, commentaire) ;
   - demandes déjà rattachées au ticket, pour éviter les doublons.
3. **Un formulaire par type de demande**, en accordéon comme dans Netcom : **Remises, Avoirs, Divers, Tarifs**.
4. Chaque formulaire réunit les champs propres au type, repris de Netcom, et les informations de la demande :

| Champ | Règle |
|---|---|
| Objet | Figé, généré automatiquement : « type de demande – ticket n° … » |
| Demandeur | Figé : agent connecté qui crée la demande |
| Périmètre concerné | Facultatif : lignes, services ou contrats concernés |
| Date souhaitée de prise d'effet | Facultative ; s'appelle « À partir du » et devient obligatoire pour une remise |
| Commentaire | Obligatoire. Champ unique : la description détaillée et le commentaire interne du CDC v1.2 sont fusionnés |

5. **Ajouter** crée la demande au statut *En attente*. La création est inscrite dans l'historique du ticket parent, avec un lien vers la demande, et notifie l'agent responsable du ticket ainsi que ses destinataires additionnels.

Les formulaires sont générés depuis le référentiel des types de demande (`PHX.TYPES_DM` dans `js/referentiel.js`). Ajouter un type ou un champ ne demande donc pas de développement d'écran.

**Champs propres à chaque type**

| Type | Champs |
|---|---|
| Remises | Service, durée (mois), montant € HT, pourcentage |
| Avoirs | Service, montant € HT, facture(s) concernée(s), urgent – partenaire en impayé, geste commercial accordé |
| Divers | Type : Divers, Statut, Créance perdue |
| Tarifs | Service (VOIP, GSM), destination, montant € HT (tarif à la minute) |

**Contrôles à l'ajout**

- **Tous les types** : commentaire obligatoire.
- **Remises** : service, durée et date « À partir du » obligatoires ; montant ou pourcentage, au moins l'un des deux (pourcentage entre 0 et 100).
- **Avoirs** : service, montant supérieur à 0 et facture(s) concernée(s) obligatoires.
- **Divers** : type obligatoire.
- **Tarifs** : service, destination et montant obligatoires.
- **RG-15** : les types comportant des montants (Remises, Avoirs, Tarifs) sont réservés aux profils habilités.
- **Ticket fermé** : aucune nouvelle demande ne peut lui être rattachée.

**Liste des demandes**, sous les formulaires comme dans Netcom :

- **Filtres** : code partenaire (prérempli avec celui du ticket), raison sociale, n° de ticket, demandeur, état (dont « En cours »), type de demande, service, période de création, période de modification.
- **Colonnes** : N°, ticket parent (lien), code partenaire, partenaire, demande, service, objet, montant HT, date de création, dernière modification, demandeur, état, date de clôture, et l'icône *Com.* qui affiche le journal au survol, comme dans Netcom.
- Tri sur chaque colonne et export .csv.

**Fiche de la demande** (bouton *Ouvrir* de la liste, ou n° de demande depuis le ticket) :

- détail de la demande et journal des changements d'état ;
- changement d'état avec commentaire.

Statuts du CDC et transitions proposées (`PHX.TRANSITIONS_DM`, à valider) :

| Depuis | Vers |
|---|---|
| En attente | Validée, Refusée, Annulée |
| Validée | Réalisée, Annulée |
| Réalisée, Refusée, Annulée | aucun : demande close, en lecture seule |

- Tout changement d'état demande un commentaire, inscrit au journal.
- Une demande close est horodatée et signée : date de clôture et utilisateur (CDC § 4.6.2).
- Le demandeur et l'agent responsable du ticket sont notifiés.

**Sur la fiche ticket**, le bloc *Demandes de modification rattachées* liste les demandes du ticket : n°, type, objet, montant, date, demandeur, état, clôture. Le compteur « Demandes de modification » du ticket, disponible aussi en colonne dans la liste des tickets, est calculé à partir de ces demandes (RG-12, RG-13).

### Menu des demandes de modification (modèle « Consulter les Demandes » de Netcom, *demandeconsulter.aspx*)

La tuile **Demandes de modification** est placée en premier dans le menu Tickets, devant *Afficher les tickets* et *Statistiques*. Elle indique le nombre de demandes en cours et en attente.

La page reprend l'organisation Netcom :

1. **Filtres**, identiques à ceux de la liste sous les formulaires de demande :
   - code partenaire, raison sociale, n° de ticket, demandeur, état, type de demande, service, périodes de création et de modification ;
   - à l'ouverture, l'état est positionné sur **En attente**, comme dans Netcom : la page sert de file de traitement ; *Réinitialiser* revient à ce réglage ;
   - boutons *Impression*, *Réinitialiser* et *Rechercher*, export .csv.
2. **Liste générale** de toutes les demandes filtrées, 10 par page, triable, avec le bouton **Details** et l'icône *Com.* (journal au survol).
3. **Une section par type de demande**, avec les colonnes propres au type, comme dans Netcom. Chaque section suit les mêmes filtres et est paginée par 10 :

| Section | Colonnes propres |
|---|---|
| Remises | Service, date de début, durée, montant HT, pourcentage |
| Avoirs partenaires – impayés | Avoirs cochés « Urgent – partenaire en impayé » : service, montant HT, factures, geste co |
| Avoirs | Autres avoirs : service, montant HT, factures, geste co |
| Divers | Type (Divers, Statut, Créance perdue) |
| Tarifs | Service, destination, tarif HT à la minute |

Colonnes communes à toutes les sections : Id, code partenaire, partenaire, numéro de ticket, date de création, dernière modification, créé par, état.

**Fonctionnement**

- **Details** ouvre la fiche de la demande : détail, journal et changement d'état. Une demande validée depuis la page disparaît de la file *En attente*.
- **Ouverture d'un ticket depuis une demande** : *Retour à la liste* revient sur cette page.
- **Libellés des boutons** : dans toutes les listes de demandes, le bouton s'appelle *Details*, comme dans Netcom. *Ouvrir* reste réservé aux tickets.

### Fiche partenaire : onglet « Gestion » (CDC § 4.7)

La fiche partenaire Phenix (*PagesMB/PartnerDetails.aspx*) reçoit un troisième onglet, **Gestion**, placé devant *Détails partenaire* et *Configuration des notifications*. Les deux onglets existants ne changent pas ; la maquette les reproduit à titre indicatif.

L'onglet Gestion ne contient que **deux boutons**, chacun avec un compteur :

- **Tickets** : nombre de tickets du partenaire, dont en cours. Ouvre la page *Tickets du partenaire*.
- **Demandes de modification** : nombre de demandes, dont en cours. Ouvre la page *Demandes de modification du partenaire*.

La fiche s'ouvre comme aujourd'hui sur *Détails partenaire*. Le code partenaire, cliquable dans les listes de tickets et de demandes, ouvre directement l'onglet Gestion.

#### Tickets du partenaire (modèle « Client Tickets » de Netcom, *ClientViewTickets.aspx*)

**Mise en page**

- **En-tête** : « LISTE DES TICKETS PARTENAIRE », code partenaire, raison sociale, liens *Retour à la fiche partenaire* et *Ouvrir un ticket*. Ce dernier lien relève de l'étape « création de ticket ».
- **Un bloc par typologie** (Réclamation, Déploiement, Facturation, Recouvrement, ADV), comme les blocs par service de Netcom. Chaque bloc affiche :
  - les colonnes N°, Sujet (objet du ticket), Sous-typologie et État ;
  - 6 tickets par page, du plus récent au plus ancien, avec des boutons de pagination orange.
- **Lecture des lignes** : les tickets en cours sont en gras. Au survol, une ligne affiche sa date de création et l'agent qui la suit.
- **Ouverture d'un ticket** : un clic sur un n° ouvre la fiche ticket. *Retour à la liste* revient sur cette page, et *Précédent / Suivant* parcourt les tickets du bloc.

**Ajouts par rapport à Netcom** (CDC § 4.7.1)

- Filtres état (tous, en cours, traités), agent et période de création.
- Export .csv avec les colonnes du CDC : n°, typologie, sous-typologie, objet, état, agent, dates de création, de mise à jour et de résolution, créateur, montant réclamé selon RG-15.

#### Demandes de modification du partenaire (modèle « Client Demande de Modification », *ClientViewDemandeModif.aspx*)

**Mise en page**

- **Barre « Détail partenaire »** : raison sociale (lien vers la fiche) et code partenaire.
- **Barre « Demandes de modification »**, avec la grille Netcom : Id, date de création, dernière modification, créé par, état, demande, service, numéro de ticket (lien), et le bouton **Details**. Ce bouton ouvre la fiche de la demande : détail, journal et changement d'état.
- **Tri** sur chaque colonne.
- Les demandes se créent depuis leur ticket.

**Ajouts par rapport à Netcom** (CDC § 4.7.2)

- Colonne *Clôturée le*, qui correspond à la date de réalisation.
- Filtres état, créé par et période de création.
- Export .csv.

## Panneau « Simulation »

Le bouton jaune en bas à droite ouvre un panneau qui **ne fait pas partie de l'écran cible**.
Il sert à la démonstration :

- **Changer de profil** : agent ou manager, qui voient les montants, ou autre équipe, qui ne les voit pas. Chaque profil garde sa propre sélection de colonnes.
- **Ajouter un champ au référentiel** : libellé, type, typologie, sous-typologie. Le champ apparaît aussitôt dans *Colonnes…* avec la mention « nouveau ». C'est la démonstration du point 1 ci-dessus.
- **Réinitialiser la démo** : efface aussi les mises à jour de tickets et les demandes créées. Quand le jeu de données fictives change (constante `VERSION_DONNEES`), les mises à jour enregistrées avec l'ancien jeu sont écartées automatiquement. Ces mises à jour sont conservées dans le navigateur, et la liste comme les statistiques en tiennent compte immédiatement.

## Structure

```
index.html               page d'entrée (habillage CRM)
assets/css/netcom-shell.css  reproduction de l'habillage Netcom
assets/css/tickets.css   styles du module Tickets
assets/img/              images reprises du CRM Netcom
js/referentiel.js        typologies, états, profils, catalogue des champs
js/donnees-demo.js       générateur de données fictives et d'historiques (déterministe)
js/app.js                écrans : tickets, statistiques, fiche ticket, demandes, fiche partenaire
build.py                 génération de dist/phenix-tickets-lot1.html
```
