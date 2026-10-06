/*
 * Phenix – Module Tickets – Lot 1
 * Référentiel métier utilisé par la maquette.
 *
 * Point clé pour l'équipe SI : les colonnes proposées dans « Colonnes… »
 * ne sont PAS codées en dur dans la table. Elles sont lues dans le
 * catalogue des champs ci-dessous (PHX.CHAMPS_BASE). Ajouter un champ au
 * catalogue suffit pour qu'il devienne une colonne sélectionnable,
 * exportable en .csv, sans toucher à l'écran.
 */
(function () {
  'use strict';
  var PHX = (window.PHX = window.PHX || {});

  /* ---------- Typologies et sous-typologies (CDC § 4.2 et § 4.4) ---------- */
  PHX.TYPOLOGIES = [
    {
      code: 'REC', libelle: 'Réclamation',
      sous: [
        { code: 'FAC', libelle: 'Facturation', boite: 'reclamations@phenix-partner.fr' },
        { code: 'SAV', libelle: 'SAV', boite: 'reclamations@phenix-partner.fr' },
        { code: 'DEP', libelle: 'Déploiement', boite: 'reclamations@phenix-partner.fr' },
        { code: 'AUT', libelle: 'Autre', boite: 'reclamations@phenix-partner.fr' }
      ]
    },
    {
      code: 'DEP', libelle: 'Déploiement',
      sous: [
        { code: 'DATA', libelle: 'DATA', boite: 'delivery@phenix-partner.fr' },
        { code: 'VOIP', libelle: 'VOIP', boite: 'delivery@phenix-partner.fr' },
        { code: 'GSM', libelle: 'GSM', boite: 'mobility@phenix-partner.fr' }
      ]
    },
    {
      code: 'FAC', libelle: 'Facturation',
      sous: [
        { code: 'EDI', libelle: 'Édition factures divers', boite: 'facturation@phenix-partner.fr' },
        { code: 'AVO', libelle: 'Avoir', boite: 'facturation@phenix-partner.fr' }
      ]
    },
    {
      code: 'RCV', libelle: 'Recouvrement',
      sous: [
        { code: 'IMP', libelle: 'Impayés', boite: 'recouvrement@phenix-partner.fr' },
        { code: 'REJ', libelle: 'Rejet de prélèvement', boite: 'recouvrement@phenix-partner.fr' }
      ]
    },
    {
      // Ajout : administration des ventes. Sous-typologies proposées, à valider.
      code: 'ADV', libelle: 'ADV',
      sous: [
        { code: 'CMD', libelle: 'Commande', boite: 'adv@phenix-partner.fr' },
        { code: 'ELM', libelle: 'Éléments manquants', boite: 'adv@phenix-partner.fr' },
        { code: 'POR', libelle: 'Portabilité', boite: 'adv@phenix-partner.fr' },
        { code: 'RES', libelle: 'Résiliation', boite: 'adv@phenix-partner.fr' },
        { code: 'SUS', libelle: 'Suspension', boite: 'adv@phenix-partner.fr' },
        { code: 'RED', libelle: 'Redimensionnement', boite: 'adv@phenix-partner.fr' }
      ]
    }
  ];

  /* ---------- Workflow : 6 états ---------- */
  // actif : le ticket est en cours de traitement (filtre par défaut de la liste)
  // tranche : une décision a été rendue (date de résolution renseignée)
  PHX.ETATS = [
    { code: 'OUV', libelle: 'Ouvert', actif: true },
    { code: 'ARP', libelle: 'Attente retour partenaire', actif: true },
    { code: 'AAR', libelle: 'Attente arbitrage', actif: true },
    { code: 'STB', libelle: 'Stand-by', actif: true },
    { code: 'RES', libelle: 'Résolu', tranche: true },
    { code: 'REJ', libelle: 'Rejeté', tranche: true },
    { code: 'FER', libelle: 'Fermé', tranche: true, clos: true }
  ];

  /* ---------- Transitions autorisées (proposition à valider) ----------
   * Règles complémentaires appliquées par l'écran :
   *  - un ticket doit avoir un agent responsable pour changer d'état ;
   *  - tout changement d'état exige un commentaire ;
   *  - seul un manager fait sortir un ticket de « Attente arbitrage » ;
   *  - « Fermé » est définitif (lecture seule) ;
   *  - « Stand-by » exige un motif (toutes typologies et sous-typologies).
   */
  PHX.MOTIFS_STANDBY = ['Réclamation en cours', 'Panne en cours'];
  PHX.TRANSITIONS = {
    OUV: ['ARP', 'AAR', 'STB', 'RES', 'REJ'],
    ARP: ['OUV', 'AAR', 'STB', 'RES', 'REJ'],
    AAR: ['OUV', 'ARP', 'STB', 'RES', 'REJ'],
    STB: ['OUV', 'ARP', 'AAR', 'RES', 'REJ'],
    RES: ['FER', 'OUV'],
    REJ: ['FER', 'OUV'],
    FER: []
  };

  /* ---------- Profils simulés (RG-15 : accès aux montants) ---------- */
  PHX.PROFILS = {
    agent: { login: 'a.martin', nom: 'A.MARTIN', groupe: 'SERVICE CLIENT R&F', libelle: 'Agent Réclamation & Facturation', montants: true },
    manager: { login: 'm.garnier', nom: 'M.GARNIER', groupe: 'MANAGER R&F', libelle: 'Manager Réclamation & Facturation', montants: true },
    autre: { login: 'j.lambert', nom: 'J.LAMBERT', groupe: 'COMMERCIAL', libelle: 'Autre équipe (commercial)', montants: false }
  };

  /* ---------- Agents fictifs, par équipe ---------- */
  PHX.EQUIPES = {
    'a.martin': 'Service Client R&F', 's.benali': 'Service Client R&F', 'c.durand': 'Service Client R&F',
    'k.haddad': 'Delivery', 'l.moreau': 'Delivery', 'n.petit': 'Mobility', 'r.fontaine': 'Mobility',
    'e.girard': 'Facturation', 'y.bernard': 'Recouvrement', 'f.roux': 'Recouvrement',
    'h.mercier': 'ADV', 'o.dupuis': 'ADV',
    'm.garnier': 'Manager R&F', 'j.lambert': 'Commercial', 'p.henry': 'Exploitation'
  };

  // Recouvrement : cause d'une créance non recouvrable (le reste dû est alors compté irrécouvrable)
  PHX.CAUSES_IRRECOUVRABLES = ['Compte clos', 'Facture indue', 'Liquidation judiciaire'];

  PHX.MOTIFS_REJET = [
    'Provision insuffisante', 'Compte clôturé', 'Opposition du débiteur',
    'Mandat inexistant ou révoqué', 'Coordonnées bancaires erronées'
  ];

  /* ---------- Catalogue des champs = source des colonnes ----------
   * code     : identifiant technique du champ
   * libelle  : libellé affiché en en-tête de colonne et dans l'export
   * type     : id | datetime | date | etat | agent | texte | nombre | montant | booleen
   * defaut   : true = colonne affichée par défaut, toujours présente
   * portee   : typologie (et sous-typologies) pour lesquelles le champ existe
   * sensible : true = montant soumis à RG-15 (profils habilités uniquement)
   * siVide   : valeur affichée quand le champ est applicable mais vide
   * options  : liste de valeurs proposées à la saisie (type multi : choix multiple)
   * modifManager : après la création du ticket, seul un manager peut modifier le champ
   * creation : false = champ renseigné pendant le traitement, absent du formulaire de création
   * aide     : info-bulle sur l'en-tête
   */
  PHX.CHAMPS_BASE = [
    // Colonnes par défaut (ordre fixe)
    { code: 'id', libelle: 'N° ticket', type: 'id', defaut: true },
    { code: 'dateCreation', libelle: 'Date création', type: 'datetime', defaut: true },
    { code: 'dateMaj', libelle: 'Date mise à jour', type: 'datetime', defaut: true, aide: 'Date du dernier commentaire' },
    { code: 'dateResolution', libelle: 'Date résolution', type: 'date', defaut: true, aide: 'Date de passage en Résolu ou Rejeté' },
    { code: 'etat', libelle: 'État', type: 'etat', defaut: true },
    { code: 'agent', libelle: 'Agent', type: 'agent', defaut: true },
    { code: 'partenaireCode', libelle: 'Code partenaire', type: 'texte', defaut: true },
    { code: 'partenaireRS', libelle: 'Partenaire', type: 'texte', defaut: true, aide: 'Raison sociale' },

    // Informations générales
    { code: 'typologie', libelle: 'Typologie', type: 'texte' },
    { code: 'sousTypologie', libelle: 'Sous-typologie', type: 'texte' },
    { code: 'objet', libelle: 'Objet', type: 'texte' },
    { code: 'createur', libelle: 'Créé par', type: 'agent' },
    { code: 'boite', libelle: 'Boîte notifiée', type: 'texte' },
    { code: 'nbDM', libelle: 'Demandes de modification', type: 'nombre', aide: 'Nombre de demandes de modification rattachées' },
    { code: 'motifStandby', creation: false, libelle: 'Motif du stand-by', type: 'texte', options: PHX.MOTIFS_STANDBY, aide: 'Renseigné quand le ticket est en Stand-by' },

    // Réclamation › Facturation (CDC § 4.3.1 + avoir accordé)
    { code: 'numFacture', libelle: 'N° de facture', type: 'texte', portee: { typo: 'REC', sous: ['FAC'] } },
    { code: 'avoirDemande', libelle: 'Avoir demandé', type: 'booleen', portee: { typo: 'REC', sous: ['FAC'] } },
    { code: 'montantReclame', libelle: 'Montant réclamé HT', type: 'montant', sensible: true, portee: { typo: 'REC', sous: ['FAC'] } },
    { code: 'avoirAccorde', creation: false, libelle: 'Avoir accordé', type: 'booleen', portee: { typo: 'REC', sous: ['FAC'] }, aide: 'Renseigné au passage en Résolu ou Rejeté' },
    { code: 'montantAvoirHT', creation: false, libelle: 'Montant avoir HT', type: 'montant', sensible: true, portee: { typo: 'REC', sous: ['FAC'] } },

    // Réclamation › SAV et Déploiement : services impactés (choix multiple).
    // modifManager : saisi librement à la création, modifiable ensuite par un manager uniquement.
    { code: 'servicesImpactes', libelle: 'Services impactés', type: 'multi', options: ['Fixe', 'DATA', 'GSM', 'Autre'],
      portee: { typo: 'REC', sous: ['SAV', 'DEP'] }, modifManager: true, aide: 'Choix multiple, modifiable par un manager une fois le ticket créé' },

    // Réclamation, toutes sous-typologies : geste commercial (cumulable avec un avoir)
    { code: 'gesteAccorde', creation: false, libelle: 'Geste co accordé', type: 'booleen', portee: { typo: 'REC' }, aide: 'Geste commercial, renseigné au passage en Résolu ou Rejeté' },
    { code: 'montantGesteHT', creation: false, libelle: 'Montant geste co HT', type: 'montant', sensible: true, portee: { typo: 'REC' } },

    // Recouvrement (CDC § 4.3.2 + montant recouvré)
    { code: 'numFactureImpayee', libelle: 'N° facture impayée', type: 'texte', portee: { typo: 'RCV' } },
    { code: 'montantHTReclame', libelle: 'Montant HT réclamé', type: 'montant', sensible: true, portee: { typo: 'RCV' } },
    { code: 'montantRecouvreHT', creation: false, libelle: 'Montant recouvré HT', type: 'montant', sensible: true, siVide: 0, portee: { typo: 'RCV' }, aide: '0 € si rien n\u2019a été recouvré' },
    { code: 'causeIrrecouvrable', creation: false, libelle: 'Cause irrécouvrable', type: 'texte', options: PHX.CAUSES_IRRECOUVRABLES, portee: { typo: 'RCV' }, aide: 'Le reste dû est alors compté irrécouvrable' },
    { code: 'dateEcheance', libelle: 'Date d\u2019échéance', type: 'date', portee: { typo: 'RCV', sous: ['IMP'] } },
    { code: 'motifRejet', libelle: 'Motif du rejet', type: 'texte', options: PHX.MOTIFS_REJET, portee: { typo: 'RCV', sous: ['REJ'] } },
    { code: 'dateRejet', libelle: 'Date du rejet', type: 'date', portee: { typo: 'RCV', sous: ['REJ'] } },
    { code: 'rum', libelle: 'Référence mandat (RUM)', type: 'texte', portee: { typo: 'RCV', sous: ['REJ'] } }
  ];

  /* =====================================================================
   * Demandes de modification (CDC § 4.6), sur le modèle de la page
   * « Demandes Clients » de Netcom : un type de demande = un formulaire.
   * Comme pour les tickets, les formulaires sont générés depuis ce
   * référentiel : ajouter un type ou un champ ne demande pas de développement d'écran.
   * ===================================================================== */
  PHX.STATUTS_DM = [
    { code: 'ATT', libelle: 'En attente' },
    { code: 'VAL', libelle: 'Validée' },
    { code: 'REA', libelle: 'Réalisée', clos: true },
    { code: 'REF', libelle: 'Refusée', clos: true },
    { code: 'ANN', libelle: 'Annulée', clos: true }
  ];
  // Proposition à valider : une demande close (Réalisée, Refusée, Annulée) est définitive.
  PHX.TRANSITIONS_DM = { ATT: ['VAL', 'REF', 'ANN'], VAL: ['REA', 'ANN'], REA: [], REF: [], ANN: [] };

  var SERVICES = ['DATA', 'VOIP', 'GSM'];
  PHX.DESTINATIONS = ['France – fixe', 'France – mobile', 'Europe (zone 1)', 'Europe (zone 2)', 'Maghreb', 'Afrique', 'Amérique du Nord', 'Asie', 'Reste du monde'];
  var service = { code: 'service', libelle: 'Service', type: 'liste', options: SERVICES, obligatoire: true };

  // montants : le type comporte des montants (RG-15 : réservé aux profils habilités)
  // libelleDate / dateObligatoire : libellé et caractère obligatoire de la date d'effet pour ce type
  // regle : contrôle particulier appliqué à l'ajout
  PHX.TYPES_DM = [
    { code: 'REM', libelle: 'Remises', court: 'Remise', montants: true, libelleDate: 'À partir du', dateObligatoire: true, regle: 'montantOuPourcentage',
      champs: [service,
        { code: 'duree', libelle: 'Durée', type: 'nombre', unite: 'mois', obligatoire: true },
        { code: 'montant', libelle: 'Montant', type: 'montant', sensible: true },
        { code: 'pourcentage', libelle: 'Pourcentage', type: 'pourcentage' }] },
    { code: 'AVO', libelle: 'Avoirs', court: 'Avoir', montants: true,
      champs: [service,
        { code: 'montant', libelle: 'Montant', type: 'montant', sensible: true, obligatoire: true },
        { code: 'factures', libelle: 'Facture(s) concernée(s)', type: 'texte', obligatoire: true },
        { code: 'urgent', libelle: 'Urgent – partenaire en impayé', type: 'case' },
        { code: 'geste', libelle: 'Geste commercial accordé', type: 'case' }] },
    { code: 'DIV', libelle: 'Divers', court: 'Divers',
      champs: [{ code: 'nature', libelle: 'Type', type: 'liste', options: ['Divers', 'Statut', 'Créance perdue'], obligatoire: true }] },
    { code: 'TAR', libelle: 'Tarifs', court: 'Tarif', montants: true,
      champs: [{ code: 'service', libelle: 'Service', type: 'liste', options: ['VOIP', 'GSM'], obligatoire: true },
        { code: 'destination', libelle: 'Destination', type: 'liste', options: PHX.DESTINATIONS, obligatoire: true },
        { code: 'montant', libelle: 'Montant', type: 'montant', sensible: true, obligatoire: true, aide: 'Tarif à la minute' }] }
  ];

  // Champs communs à toutes les demandes (CDC § 4.6.1, adapté) :
  // objet et demandeur sont figés, un seul champ de commentaire.
  PHX.CHAMPS_COMMUNS_DM = [
    { code: 'objet', libelle: 'Objet', type: 'fige', aide: 'Généré : type de demande et n° de ticket' },
    { code: 'demandeur', libelle: 'Demandeur', type: 'fige', aide: 'Agent qui crée la demande' },
    { code: 'perimetre', libelle: 'Périmètre concerné', type: 'texte', aide: 'Lignes, services ou contrats concernés' },
    { code: 'dateEffet', libelle: 'Date souhaitée de prise d’effet', type: 'date' },
    { code: 'commentaire', libelle: 'Commentaire', type: 'zone', obligatoire: true }
  ];
  PHX.objetDM = function (typeCode, ticketId) {
    var T = PHX.typeDM(typeCode);
    return (T ? T.court : typeCode) + ' – ticket n° ' + ticketId;
  };

  PHX.typeDM = function (code) {
    for (var i = 0; i < PHX.TYPES_DM.length; i++) if (PHX.TYPES_DM[i].code === code) return PHX.TYPES_DM[i];
    return null;
  };
  PHX.statutDM = function (code) {
    for (var i = 0; i < PHX.STATUTS_DM.length; i++) if (PHX.STATUTS_DM[i].code === code) return PHX.STATUTS_DM[i];
    return null;
  };

  /* ---------- Utilitaires de lecture du référentiel ---------- */
  PHX.typo = function (code) {
    for (var i = 0; i < PHX.TYPOLOGIES.length; i++) if (PHX.TYPOLOGIES[i].code === code) return PHX.TYPOLOGIES[i];
    return null;
  };
  PHX.sousTypo = function (typoCode, sousCode) {
    var t = PHX.typo(typoCode);
    if (!t) return null;
    for (var i = 0; i < t.sous.length; i++) if (t.sous[i].code === sousCode) return t.sous[i];
    return null;
  };
  PHX.etat = function (code) {
    for (var i = 0; i < PHX.ETATS.length; i++) if (PHX.ETATS[i].code === code) return PHX.ETATS[i];
    return null;
  };
  // Groupe d'affichage d'un champ dans le sélecteur de colonnes, déduit de sa portée
  PHX.groupeChamp = function (c) {
    if (!c.portee || !c.portee.typo) return 'Informations générales';
    var t = PHX.typo(c.portee.typo);
    var lib = t ? t.libelle : c.portee.typo;
    if (c.portee.sous && c.portee.sous.length) {
      lib += ' › ' + c.portee.sous.map(function (s) {
        var st = PHX.sousTypo(c.portee.typo, s);
        return st ? st.libelle : s;
      }).join(' / ');
    }
    return lib;
  };
})();
