/*
 * Phenix – Module Tickets – Lot 1
 * Données de démonstration 100 % fictives (partenaires, agents, montants).
 * Génération déterministe : mêmes tickets à chaque ouverture, dates
 * recalées sur le jour courant pour que la démo reste « fraîche ».
 */
(function () {
  'use strict';
  var PHX = window.PHX;
  var JOUR = 86400000;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  PHX.hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  PHX.rng = mulberry32;

  var PARTENAIRES = [
    ['SO0107', 'Arpège Télécom SAS'], ['SO0118', 'Hexacom Services'], ['SO0124', 'Bureau Connect Ouest'],
    ['SO0131', 'Alto Réseaux'], ['SO0146', 'Médiane Télécom'], ['SO0152', 'Lumen Pro Solutions'],
    ['SO0163', 'Sirius Intégration'], ['SO0177', 'Cap Horizon Télécom'], ['SO0185', 'Quadrant IT'],
    ['SO0192', 'Opale Communication'], ['SO0204', 'Veritel Distribution'], ['SO0219', 'Nordelia Connect'],
    ['SO0226', 'Atlantis Télécom Pro'], ['SO0238', 'Céleste Networks'], ['SO0241', 'Pégase Informatique'],
    ['SO0257', 'Rivage Télécom'], ['SO0263', 'Solano Business'], ['SO0270', 'Trident Réseaux'],
    ['SO0284', 'Vega Communication'], ['SO0291', 'Azur Pro Télécom'], ['SO0305', 'Kerguelen IT'],
    ['SO0312', 'Boréal Services'], ['SO0328', 'Mistral Connect'], ['SO0336', 'Prisme Solutions'],
    ['SO0347', 'Équinoxe Réseaux'], ['SO0359', 'Ardoise Télécom'], ['SO0361', 'Belvédère Com'],
    ['SO0374', 'Calanque Réseaux']
  ];
  PHX.PARTENAIRES = PARTENAIRES.map(function (p) { return { code: p[0], rs: p[1] }; });

  var OBJETS = {
    'REC/FAC': [
      'Double facturation du forfait GSM – facture {mois}', 'Écart tarifaire sur les lignes SDA – facture {mois}',
      'Facturation d\u2019un service résilié – facture {mois}', 'Options DATA facturées hors contrat',
      'Frais de mise en service contestés', 'Prorata de résiliation non appliqué',
      'Remise contractuelle absente de la facture {mois}', 'Hors forfait GSM contesté – facture {mois}'
    ],
    'REC/SAV': [
      'Coupures DATA répétées sur le site principal', 'Perte totale de service VoIP',
      'Lenteurs fibre depuis la migration', 'Appels entrants non acheminés', 'Carte SIM inactive après activation'
    ],
    'REC/DEP': [
      'Retard de mise en service du lien fibre', 'Portabilité non réalisée à la date convenue',
      'Rendez-vous technicien non honoré', 'Paramétrage initial du standard incomplet'
    ],
    'REC/AUT': [
      'Contestation des conditions de résiliation du contrat cadre', 'Délai de réponse du support jugé excessif',
      'Demande d\u2019explication sur l\u2019évolution tarifaire'
    ],
    'DEP/DATA': [
      'Suspension temporaire du lien DATA', 'Résiliation manuelle d\u2019un accès SDSL',
      'Communication des identifiants suite déploiement', 'Changement de débit du lien fibre'
    ],
    'DEP/VOIP': [
      'Création d\u2019un trunk SIP', 'Ajout de {n} SDA', 'Paramétrage des renvois d\u2019appels', 'Mise à jour de l\u2019annuaire du standard'
    ],
    'DEP/GSM': [
      'Activation de {n} lignes GSM', 'Commande de cartes SIM de remplacement',
      'Changement de forfait sur {n} lignes', 'Portabilité entrante de {n} numéros mobiles'
    ],
    'FAC/EDI': [
      'Réédition de la facture {mois}', 'Duplicata de facture demandé par le partenaire',
      'Édition du relevé de compte annuel', 'Facture à rééditer avec la nouvelle adresse de facturation'
    ],
    'FAC/AVO': [
      'Émission d\u2019un avoir suite à réclamation', 'Avoir sur frais de mise en service', 'Avoir commercial sur la facture {mois}'
    ],
    'RCV/IMP': [
      'Facture {mois} échue non réglée', 'Relance impayé – 2e niveau', 'Plusieurs factures échues non réglées'
    ],
    'RCV/REJ': [
      'Rejet de prélèvement – facture {mois}', 'Prélèvement rejeté, nouveau mandat à signer'
    ],
    'ADV/CMD': ['Commande de {n} lignes GSM', 'Nouvelle commande de lien fibre', 'Commande d’un trunk SIP pour un nouveau site'],
    'ADV/ELM': ['Dossier de commande incomplet : mandat SEPA manquant', 'Contrat non signé pour la commande en cours', 'Kbis manquant pour l’ouverture du compte'],
    'ADV/POR': ['Portabilité entrante de {n} numéros', 'Date de portage à confirmer', 'RIO incorrect pour la portabilité mobile'],
    'ADV/RES': ['Résiliation de {n} lignes GSM', 'Résiliation du lien DATA du site secondaire', 'Résiliation à échéance du contrat'],
    'ADV/SUS': ['Suspension temporaire de {n} lignes', 'Réactivation des lignes suspendues'],
    'ADV/RED': ['Augmentation du débit du lien fibre', 'Ajout de {n} canaux sur le trunk SIP', 'Réduction du nombre de licences']
  };

  var AGENTS = {
    REC: ['a.martin', 's.benali', 'c.durand'],
    'DEP/DATA': ['k.haddad', 'l.moreau'], 'DEP/VOIP': ['k.haddad', 'l.moreau'], 'DEP/GSM': ['n.petit', 'r.fontaine'],
    FAC: ['c.durand', 'e.girard'],
    RCV: ['y.bernard', 'f.roux'],
    ADV: ['h.mercier', 'o.dupuis']
  };

  var COMMENTAIRES = {
    NA: ['Ticket créé, en attente de prise en charge.'],
    OUV: ['Prise en charge du ticket, analyse en cours.', 'Vérification des éléments transmis par le partenaire.', 'Contrôle en cours avec le service concerné.'],
    ARP: ['Relance envoyée au partenaire : pièces justificatives attendues.', 'En attente du retour du partenaire sur la proposition faite.', 'Demande de précisions envoyée au partenaire (lignes concernées).'],
    'AAR/REC': ['Arbitrage demandé au manager : montant de l\u2019avoir à valider.', 'Arbitrage demandé sur la prise en charge des frais contestés.'],
    'AAR/RCV': ['Arbitrage demandé : le partenaire propose un échéancier.', 'Arbitrage demandé sur un abandon partiel de créance.'],
    RES: ['Traitement terminé, le partenaire a été informé.', 'Correction effectuée et confirmée au partenaire.'],
    REJ: ['Demande non fondée : facturation conforme au contrat.', 'Demande rejetée, justificatifs non fournis.'],
    FER: ['Ticket fermé après confirmation du partenaire.', 'Ticket fermé.']
  };

  var POIDS_TYPO = [['REC', 0.40], ['DEP', 0.25], ['FAC', 0.15], ['RCV', 0.20]];
  var POIDS_SOUS = {
    REC: [['FAC', 0.5], ['SAV', 0.25], ['DEP', 0.15], ['AUT', 0.10]],
    DEP: [['DATA', 0.4], ['VOIP', 0.3], ['GSM', 0.3]],
    FAC: [['EDI', 0.6], ['AVO', 0.4]],
    RCV: [['IMP', 0.65], ['REJ', 0.35]],
    ADV: [['CMD', 0.25], ['ELM', 0.2], ['POR', 0.15], ['RES', 0.2], ['SUS', 0.1], ['RED', 0.1]]
  };

  function moisLib(ts) {
    var d = new Date(ts); d.setMonth(d.getMonth() - 1);
    return ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function numFacture(ts, r) {
    var d = new Date(ts); d.setMonth(d.getMonth() - 1);
    return 'FP' + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + String(10000 + Math.floor(r() * 89999));
  }
  function arrondi2(x) { return Math.round(x * 100) / 100; }

  // Ramène un horodatage dans les heures de bureau (8h-19h, jours ouvrés), sans sortir de [min, max]
  function heureBureau(ts, r, min, max) {
    var d = new Date(ts);
    if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getHours() < 8 || d.getHours() >= 19) d.setHours(8 + Math.floor(r() * 10), Math.floor(r() * 60), 0, 0);
    var x = d.getTime();
    if (x > max) x = max;
    if (x < min) x = min + (5 + Math.floor(r() * 120)) * 60000;
    return x;
  }

  // Recale une date sur un jour ouvré, entre 8h et 18h
  function ouvrable(ts, r) {
    var d = new Date(ts);
    var j = d.getDay();
    if (j === 6) d.setDate(d.getDate() - 1);
    if (j === 0) d.setDate(d.getDate() + 1);
    d.setHours(8 + Math.floor(r() * 10), Math.floor(r() * 60), 0, 0);
    return d.getTime();
  }

  /**
   * Génère les tickets fictifs.
   * @param {number} ref horodatage de référence (début de journée courante)
   */
  PHX.genererTickets = function (ref, n) {
    n = n || 180;
    var r = mulberry32(20261002);
    function pick(a) { return a[Math.floor(r() * a.length)]; }
    function wpick(pairs) {
      var u = r(), s = 0;
      for (var i = 0; i < pairs.length; i++) { s += pairs[i][1]; if (u <= s) return pairs[i][0]; }
      return pairs[pairs.length - 1][0];
    }
    function etatSelonAge(age, typo) {
      var p;
      if (age < 3) p = { OUV: .72, ARP: .16, AAR: .04, RES: .06, REJ: .02, FER: 0 };
      else if (age < 20) p = { OUV: .26, ARP: .20, AAR: .14, RES: .20, REJ: .08, FER: .12 };
      else if (age < 60) p = { OUV: .07, ARP: .08, AAR: .08, RES: .16, REJ: .07, FER: .54 };
      else p = { OUV: .02, ARP: .02, AAR: .01, RES: .08, REJ: .05, FER: .82 };
      if (typo === 'DEP' || typo === 'FAC' || typo === 'ADV') { p.OUV += p.AAR; p.AAR = 0; }
      return wpick(Object.keys(p).map(function (k) { return [k, p[k]]; }));
    }

    var brut = [];
    function fabriquer(forceTypo) {
      var u = r(), age;
      if (u < 0.22) age = 1 + r() * 6;
      else if (u < 0.52) age = 7 + r() * 38;
      else age = 45 + r() * 225;
      var cre = ouvrable(ref - age * JOUR, r);
      if (cre >= ref) cre = ref - JOUR + 9 * 3600000;
      age = (ref - cre) / JOUR;

      var typo = forceTypo || wpick(POIDS_TYPO);
      var sous = wpick(POIDS_SOUS[typo]);
      var cle = typo + '/' + sous;
      var etat = etatSelonAge(age, typo);
      var part = pick(PHX.PARTENAIRES);
      var poolAgents = AGENTS[cle] || AGENTS[typo];

      var t = {
        typo: typo, sous: sous, etat: etat,
        partenaireCode: part.code, partenaireRS: part.rs,
        dateCreation: cre, dateMaj: cre, dateResolution: null, dateFermeture: null,
        agent: null, decision: null, nbDM: 0, champs: {}
      };
      t.boite = PHX.sousTypo(typo, sous).boite;
      t.objet = pick(OBJETS[cle]).replace('{mois}', moisLib(cre)).replace('{n}', String(2 + Math.floor(r() * 18)));

      // Affectation : seuls des tickets « Ouvert » peuvent être sans agent
      var pNA = age < 3 ? 0.55 : age < 20 ? 0.15 : 0.05;
      if (!(etat === 'OUV' && r() < pNA)) t.agent = pick(poolAgents);

      // Créateur
      t.createur = r() < 0.7 ? pick(poolAgents) : pick(['j.lambert', 'p.henry', 'm.garnier', 'a.martin']);

      // Dates de résolution / fermeture
      var delai = 0.3 + Math.pow(r(), 2) * 20;
      if (etat === 'RES' || etat === 'REJ' || etat === 'FER') {
        delai = Math.min(delai, Math.max(0.2, age - 0.5));
        t.dateResolution = cre + delai * JOUR;
        t.decision = etat === 'FER' ? (r() < 0.8 ? 'RES' : 'REJ') : etat;
        if (etat === 'FER') {
          var df = t.dateResolution + (2 + r() * 10) * JOUR;
          if (df >= ref) { t.etat = etat = 'RES'; t.decision = 'RES'; }
          else t.dateFermeture = df;
        }
      }

      // Heures de bureau pour les dates de résolution et de fermeture
      var finVeille = ref - 6 * 3600000; // veille, 18h
      if (t.dateResolution) t.dateResolution = heureBureau(t.dateResolution, r, cre, finVeille);
      if (t.dateFermeture) t.dateFermeture = heureBureau(t.dateFermeture, r, t.dateResolution, finVeille);

      // Date du dernier commentaire
      if (etat === 'FER') t.dateMaj = t.dateFermeture;
      else if (etat === 'RES' || etat === 'REJ') t.dateMaj = heureBureau(t.dateResolution + r() * 0.2 * JOUR, r, t.dateResolution, finVeille);
      else if (t.agent) t.dateMaj = heureBureau(cre + (1 - Math.pow(r(), 2)) * (ref - cre) * 0.95, r, cre, finVeille);
      else t.dateMaj = cre;
      if (t.dateMaj < cre) t.dateMaj = cre;

      // Commentaire le plus récent (aperçu)
      if (!t.agent) t.dernierCommentaire = COMMENTAIRES.NA[0];
      else if (etat === 'AAR') t.dernierCommentaire = pick(COMMENTAIRES['AAR/' + typo] || COMMENTAIRES['AAR/REC']);
      else t.dernierCommentaire = pick(COMMENTAIRES[etat]);

      // Demandes de modification rattachées
      if ((typo === 'REC' || typo === 'DEP') && (t.decision === 'RES')) {
        var x = r(); t.nbDM = x < 0.3 ? 1 : x < 0.38 ? 2 : 0;
      } else if (etat === 'OUV' && t.agent && r() < 0.35) t.nbDM = 1;

      // Champs spécifiques
      var c = t.champs;
      if (cle === 'REC/FAC') {
        c.numFacture = numFacture(cre, r) + (r() < 0.2 ? ', ' + numFacture(cre - 30 * JOUR, r) : '');
        c.avoirDemande = r() < 0.7;
        if (c.avoirDemande || r() < 0.4) c.montantReclame = Math.round(40 + Math.pow(r(), 2) * 4200);
        if (t.decision) {
          if (t.decision === 'REJ') { c.avoirAccorde = false; }
          else if (c.avoirDemande) {
            c.avoirAccorde = r() < 0.78;
            if (c.avoirAccorde) {
              c.montantAvoirHT = r() < 0.6 ? c.montantReclame : arrondi2(c.montantReclame * (0.3 + r() * 0.6));
            }
          } else {
            c.avoirAccorde = r() < 0.12;
            if (c.avoirAccorde) c.montantAvoirHT = arrondi2(30 + r() * 180);
          }
        }
      }
      if (typo === 'RCV') {
        c.numFactureImpayee = numFacture(cre, r);
        c.montantHTReclame = arrondi2(80 + Math.pow(r(), 2) * 9400);
        if (t.decision === 'RES') c.montantRecouvreHT = r() < 0.75 ? c.montantHTReclame : arrondi2(c.montantHTReclame * (0.3 + r() * 0.6));
        else if (t.decision === 'REJ') c.montantRecouvreHT = r() < 0.6 ? 0 : arrondi2(c.montantHTReclame * (0.1 + r() * 0.3));
        else if (r() < 0.35) c.montantRecouvreHT = arrondi2(c.montantHTReclame * (0.2 + r() * 0.5));
        if (sous === 'IMP') {
          c.dateEcheance = cre - (5 + Math.floor(r() * 35)) * JOUR;
        } else {
          c.motifRejet = pick(PHX.MOTIFS_REJET);
          c.dateRejet = cre - (1 + Math.floor(r() * 5)) * JOUR;
          if (r() < 0.7) c.rum = 'RUM-PHX-' + String(100000 + Math.floor(r() * 899999));
        }
      }
      return t;
    }
    for (var i = 0; i < n; i++) brut.push(fabriquer());

    // Numérotation croissante avec la date de création
    brut.sort(function (a, b) { return a.dateCreation - b.dateCreation; });
    var id = 61240;
    brut.forEach(function (t) { id += 1 + Math.floor(r() * 3); t.id = id; });

    // Typologie ADV : tickets produits par un générateur distinct, pour ne pas
    // modifier les autres données de la démo. Chacun prend un numéro libre entre
    // le ticket précédent et le suivant (numérotation chronologique).
    r = mulberry32(20261003);
    var adv = [];
    for (var k = 0; k < 40; k++) { var ta = fabriquer('ADV'); ta.nbDM = 0; adv.push(ta); }
    adv.sort(function (a, b) { return a.dateCreation - b.dateCreation; });
    var pris = {};
    brut.forEach(function (t) { pris[t.id] = true; });
    adv.forEach(function (ta) {
      var avant = null, apres = null;
      for (var j = 0; j < brut.length; j++) {
        if (brut[j].dateCreation <= ta.dateCreation) avant = brut[j]; else { apres = brut[j]; break; }
      }
      var min = avant ? avant.id + 1 : 61241, max = apres ? apres.id - 1 : min + 2;
      for (var c = min; c <= max; c++) if (!pris[c]) { ta.id = c; pris[c] = true; break; }
    });
    brut = brut.concat(adv.filter(function (t) { return t.id; }));
    brut.sort(function (a, b) { return a.dateCreation - b.dateCreation; });
    brut.forEach(function (t) { construireHistorique(t, ref); });
    return brut;
  };

  /* ---------- Historique des échanges (journal CRM) ----------
   * Un événement = une ouverture ou une mise à jour :
   * { type, date, auteur, etatAvant, etatApres, changements: [{code, avant, apres}], commentaire, notifies: [] }
   */
  function fDate(ts) {
    var d = new Date(ts);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function minuscule(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function slug(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(sas|sarl)\b/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function description(t) {
    var c = t.champs, o = minuscule(t.objet);
    switch (t.typo + '/' + t.sous) {
      case 'REC/FAC': return 'Le partenaire conteste la facture ' + c.numFacture + (c.avoirDemande ? ' et demande un avoir.' : '.');
      case 'REC/SAV': return 'Le partenaire signale : ' + o + '.';
      case 'REC/DEP': return 'Réclamation sur une opération de déploiement : ' + o + '.';
      case 'REC/AUT': return 'Réclamation du partenaire : ' + o + '. Détails transmis par e-mail.';
      case 'FAC/EDI': return 'Demande d\u2019édition : ' + o + '.';
      case 'FAC/AVO': return 'Demande d\u2019émission d\u2019avoir : ' + o + '.';
      case 'RCV/IMP': return 'Facture ' + c.numFactureImpayee + ' échue le ' + fDate(c.dateEcheance) + ', non réglée à ce jour.';
      case 'RCV/REJ': return 'Prélèvement rejeté le ' + fDate(c.dateRejet) + ' (' + minuscule(c.motifRejet) + ').';
      default: return 'Demande du partenaire : ' + o + '.';
    }
  }
  function commentaireDecision(t) {
    var c = t.champs;
    if (t.decision === 'REJ' && !(t.typo === 'REC' && c.gesteAccorde)) {
      if (t.typo === 'REC' && t.sous === 'FAC') return 'Réclamation non fondée : facturation conforme au contrat.';
      if (t.typo === 'RCV') return 'Dossier transmis au contentieux.';
      return 'Demande rejetée, justificatifs non fournis.';
    }
    var geste = t.typo === 'REC' && c.gesteAccorde ? ' Geste commercial accordé.' : '';
    if (t.decision === 'REJ' && geste) return 'Réclamation non fondée, mais geste commercial accordé.';
    if (t.typo === 'REC' && t.sous === 'FAC') return (c.avoirAccorde ? 'Avoir accordé et transmis au service Facturation pour émission.' : 'Facturation vérifiée, régularisation effectuée sans avoir.') + geste;
    if (t.typo === 'REC' && t.sous === 'SAV') return 'Service rétabli, le partenaire a confirmé.' + geste;
    if (t.typo === 'REC') return 'Traitement terminé, le partenaire a été informé.' + geste;
    if (t.typo === 'RCV') return (c.montantRecouvreHT || 0) >= c.montantHTReclame ? 'Règlement reçu, dossier soldé.' : 'Règlement partiel reçu, échéancier accepté.';
    if (t.typo === 'DEP') return 'Opération réalisée, partenaire informé.';
    if (t.typo === 'FAC') return 'Document édité et envoyé au partenaire.';
    if (t.typo === 'ADV') return 'Dossier traité par l’ADV, le partenaire a été informé.';
    return 'Traitement terminé, le partenaire a été informé.';
  }

  function construireHistorique(t, ref) {
    // Geste commercial sur les réclamations tranchées (y compris rejetées : geste de bonne volonté)
    if (t.typo === 'REC' && t.decision) {
      var rg = mulberry32(PHX.hash('geste#' + t.id));
      var p = t.decision === 'REJ' ? 0.1 : ({ FAC: 0.1, SAV: 0.35, DEP: 0.3, AUT: 0.15 })[t.sous];
      t.champs.gesteAccorde = rg() < p;
      if (t.champs.gesteAccorde) t.champs.montantGesteHT = Math.max(20, Math.round((20 + Math.pow(rg(), 2) * 480) / 5) * 5);
    }
    // Services impactés des réclamations SAV et Déploiement, déduits de l'objet
    if (t.typo === 'REC' && (t.sous === 'SAV' || t.sous === 'DEP')) {
      var rs = mulberry32(PHX.hash('svc#' + t.id));
      var o = t.objet.toLowerCase(), svc = [];
      var OPTIONS_SVC = ['Fixe', 'DATA', 'GSM', 'Autre'];
      if (/data|fibre|sdsl|lien/.test(o)) svc.push('DATA');
      if (/voip|appels|standard|sda|trunk/.test(o)) svc.push('Fixe');
      if (/sim|gsm|mobile/.test(o)) svc.push('GSM');
      if (/portabilit/.test(o)) svc.push(rs() < 0.5 ? 'Fixe' : 'GSM');
      if (!svc.length) svc.push(OPTIONS_SVC[Math.floor(rs() * 4)]);
      else if (rs() < 0.2) svc.push(OPTIONS_SVC[Math.floor(rs() * 3)]);
      t.champs.servicesImpactes = OPTIONS_SVC.filter(function (x) { return svc.indexOf(x) >= 0; });
    }
    var r = mulberry32(PHX.hash('histo#' + t.id));
    var H = 3600000, fin = ref - 6 * H;
    var ev = [];
    t.destinataires = [];
    if (r() < 0.2 && t.agent !== 'm.garnier') t.destinataires.push('m.garnier');
    if (r() < 0.15) t.destinataires.push('comptabilite@' + slug(t.partenaireRS) + '.example');
    var notifies = function () { return [t.agent].concat(t.destinataires).filter(function (x, i, a) { return x && a.indexOf(x) === i; }); };

    ev.push({ type: 'ouverture', date: t.dateCreation, auteur: t.createur, etatApres: 'OUV', typo: t.typo, sous: t.sous,
      servicesImpactes: t.champs.servicesImpactes ? t.champs.servicesImpactes.slice() : undefined,
      changements: [], commentaire: description(t), notifies: [t.boite] });
    if (t.agent) {
      var fin1 = t.dateResolution || t.dateMaj;
      var pec = heureBureau(t.dateCreation + Math.max(10 * 60000, (fin1 - t.dateCreation) * (0.05 + r() * 0.25)), r, t.dateCreation, Math.min(fin1, fin));
      ev.push({ type: 'maj', date: pec, auteur: t.agent, etatAvant: 'OUV', etatApres: 'OUV', changements: [{ code: 'agent', avant: null, apres: t.agent }], commentaire: 'Prise en charge du ticket.', notifies: [t.agent] });
      if (t.etat === 'OUV') {
        if (t.dateMaj - pec > H) ev.push({ type: 'maj', date: t.dateMaj, auteur: t.agent, etatAvant: 'OUV', etatApres: 'OUV', changements: [], commentaire: t.dernierCommentaire, notifies: notifies() });
      } else if (t.etat === 'ARP' || t.etat === 'AAR') {
        ev.push({ type: 'maj', date: Math.max(t.dateMaj, pec + 30 * 60000), auteur: t.agent, etatAvant: 'OUV', etatApres: t.etat, changements: [], commentaire: t.dernierCommentaire, notifies: notifies() });
      } else {
        var dr = t.dateResolution;
        if (dr - pec > 2 * JOUR && r() < 0.35) {
          ev.push({ type: 'maj', date: heureBureau(pec + (dr - pec) * 0.3, r, pec, dr), auteur: t.agent, etatAvant: 'OUV', etatApres: 'ARP', changements: [], commentaire: 'Demande de précisions envoyée au partenaire.', notifies: notifies() });
          ev.push({ type: 'maj', date: heureBureau(pec + (dr - pec) * 0.7, r, pec, dr), auteur: t.agent, etatAvant: 'ARP', etatApres: 'OUV', changements: [], commentaire: 'Retour du partenaire reçu, reprise du traitement.', notifies: notifies() });
        }
        var ch = [], c = t.champs;
        if (t.typo === 'REC' && t.sous === 'FAC') {
          ch.push({ code: 'avoirAccorde', avant: null, apres: c.avoirAccorde });
          if (c.montantAvoirHT) ch.push({ code: 'montantAvoirHT', avant: null, apres: c.montantAvoirHT });
        }
        if (t.typo === 'REC') {
          ch.push({ code: 'gesteAccorde', avant: null, apres: c.gesteAccorde });
          if (c.montantGesteHT) ch.push({ code: 'montantGesteHT', avant: null, apres: c.montantGesteHT });
        }
        if (t.typo === 'RCV' && c.montantRecouvreHT) ch.push({ code: 'montantRecouvreHT', avant: 0, apres: c.montantRecouvreHT });
        ev.push({ type: 'maj', date: dr, auteur: t.agent, etatAvant: 'OUV', etatApres: t.decision, changements: ch, commentaire: commentaireDecision(t), notifies: notifies() });
        if (t.etat === 'FER') ev.push({ type: 'maj', date: t.dateFermeture, auteur: t.agent, etatAvant: t.decision, etatApres: 'FER', changements: [], commentaire: 'Ticket fermé après confirmation du partenaire.', notifies: notifies() });
      }
    }
    ev.sort(function (a, b) { return a.date - b.date; });
    var dernier = ev[ev.length - 1];
    t.dateMaj = dernier.date;
    t.dernierCommentaire = dernier.commentaire;
    t.historique = ev;
  }

  /* =====================================================================
   * Demandes de modification fictives, rattachées aux tickets qui en ont
   * (t.nbDM). La création de chaque demande est inscrite dans l'historique
   * de son ticket parent.
   * ===================================================================== */
  var COMMENTAIRES_DM = {
    VAL: 'Demande validée, transmise pour réalisation.',
    REA: 'Modification réalisée dans le système de facturation.',
    REF: 'Demande refusée : hors conditions contractuelles.',
    ANN: 'Demande annulée à la demande du partenaire.'
  };
  var PERIMETRES = ['Contrat cadre', 'Lien fibre du site principal', '3 lignes GSM', 'Trunk SIP principal', 'Toutes les lignes', 'Accès SDSL secondaire'];

  function choisirTypeDM(t, i, r) {
    var c = t.champs;
    if (t.typo === 'REC' && t.sous === 'FAC') {
      if (i === 0 && c.avoirAccorde) return { type: 'AVO', montant: c.montantAvoirHT, factures: c.numFacture };
      if (c.gesteAccorde) return { type: 'AVO', montant: c.montantGesteHT, factures: c.numFacture, geste: true };
      return { type: i === 0 ? 'DIV' : 'REM' };
    }
    if (t.typo === 'REC' && c.gesteAccorde && i === 0) return { type: 'AVO', montant: c.montantGesteHT, geste: true };
    var choix = { 'DEP/VOIP': ['DIV', 'TAR'], 'DEP/GSM': ['DIV', 'TAR'], 'DEP/DATA': ['DIV'] }[t.typo + '/' + t.sous] || ['DIV', 'DIV', 'REM'];
    return { type: choix[Math.floor(r() * choix.length)] };
  }

  PHX.genererDemandes = function (tickets, ref) {
    var H = 3600000, fin = ref - 6 * H;
    var demandes = [];
    // Demandes supplémentaires sur les tickets récents, pour alimenter le menu des demandes (statut « En attente »)
    tickets.forEach(function (t) {
      if (t.nbDM || !t.agent || t.typo === 'ADV') return;
      var rp = mulberry32(PHX.hash('dm+#' + t.id));
      var c = t.champs;
      if (t.etat === 'RES' && t.typo === 'REC' && (c.avoirAccorde || c.gesteAccorde)) t.nbDM = 1;
      else if (PHX.etat(t.etat).actif && rp() < 0.25) t.nbDM = 1;
    });
    tickets.forEach(function (t) {
      if (!t.nbDM) return;
      var r = mulberry32(PHX.hash('dm#' + t.id));
      for (var i = 0; i < t.nbDM; i++) {
        var ch = choisirTypeDM(t, i, r);
        var serviceDM = t.typo === 'DEP' ? t.sous : ['DATA', 'VOIP', 'GSM'][Math.floor(r() * 3)];
        // Date de création : après la résolution (ou pendant le traitement si le ticket est ouvert)
        var debut = t.dateResolution || t.historique[Math.min(1, t.historique.length - 1)].date;
        var limite = t.dateFermeture ? Math.min(t.dateFermeture - H, fin) : fin;
        var cre = heureBureau(debut + (0.5 + r() * 30) * H, r, debut, Math.max(debut + 10 * 60000, limite));
        var champs = { service: serviceDM };
        var commentaire;
        switch (ch.type) {
          case 'AVO':
            champs.montant = ch.montant; champs.factures = ch.factures || 'Dernière facture émise';
            champs.geste = !!ch.geste; champs.urgent = r() < 0.25;
            commentaire = ch.geste ? 'Émettre l’avoir correspondant au geste commercial accordé sur le ticket.' : 'Émettre l’avoir accordé suite à la réclamation du partenaire.';
            break;
          case 'REM':
            champs.duree = [3, 6, 12][Math.floor(r() * 3)]; champs.pourcentage = [5, 10, 15, 20][Math.floor(r() * 4)];
            commentaire = 'Appliquer une remise temporaire de ' + champs.pourcentage + ' % pendant ' + champs.duree + ' mois.';
            break;
          case 'TAR':
            champs.service = ['VOIP', 'GSM'][Math.floor(r() * 2)]; champs.destination = PHX.DESTINATIONS[Math.floor(r() * PHX.DESTINATIONS.length)];
            champs.montant = arrondi2(0.02 + r() * 0.13);
            commentaire = 'Appliquer le tarif négocié vers la destination indiquée.';
            break;
          default:
            champs = { nature: ['Statut', 'Divers', 'Divers'][Math.floor(r() * 3)] };
            commentaire = champs.nature === 'Statut' ? 'Mettre à jour le statut du partenaire suite au traitement du ticket.'
              : ['Corriger le paramétrage du service ' + serviceDM + ' sur le périmètre indiqué.', 'Mettre à jour l’option souscrite sur le périmètre indiqué.', 'Voir le ticket pour le contexte.'][Math.floor(r() * 3)];
        }
        var d = new Date(cre); d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0);
        var dm = {
          ticketId: t.id, partenaireCode: t.partenaireCode, partenaireRS: t.partenaireRS,
          type: ch.type, objet: PHX.objetDM(ch.type, t.id), perimetre: PERIMETRES[Math.floor(r() * PERIMETRES.length)],
          dateEffet: (ch.type === 'REM' || r() < 0.4) ? d.getTime() : null,
          demandeur: t.agent || t.createur, creePar: t.agent || t.createur, commentaire: commentaire,
          champs: champs, statut: 'ATT', dateCreation: cre, dateMaj: cre, dateCloture: null, cloturePar: null,
          journal: [{ date: cre, auteur: t.agent || t.createur, statutApres: 'ATT', commentaire: 'Création de la demande.', notifies: [t.agent || t.createur] }]
        };
        // Statut selon l'avancement du ticket
        var u = r(), cible;
        if (t.etat === 'FER') cible = u < 0.8 ? 'REA' : u < 0.9 ? 'REF' : 'ANN';
        else if (t.decision) cible = u < 0.5 ? 'ATT' : u < 0.75 ? 'VAL' : 'REA';
        else cible = u < 0.75 ? 'ATT' : 'VAL';
        var tVal = heureBureau(Math.min(cre + (2 + r() * 40) * H, fin), r, cre, fin);
        if ((cible === 'VAL' || cible === 'REA') && tVal > cre) {
          dm.journal.push({ date: tVal, auteur: 'm.garnier', statutAvant: 'ATT', statutApres: 'VAL', commentaire: COMMENTAIRES_DM.VAL, notifies: [dm.demandeur] });
          dm.statut = 'VAL'; dm.dateMaj = tVal;
        }
        if (cible === 'REA' || cible === 'REF' || cible === 'ANN') {
          var base = dm.dateMaj, tClo = heureBureau(Math.min(base + (4 + r() * 120) * H, fin), r, base, fin);
          if (tClo > base) {
            var com = COMMENTAIRES_DM[cible];
            var auteur = cible === 'REA' ? 'e.girard' : 'm.garnier';
            dm.journal.push({ date: tClo, auteur: auteur, statutAvant: dm.statut, statutApres: cible, commentaire: com, notifies: [dm.demandeur] });
            dm.statut = cible; dm.dateMaj = tClo; dm.dateCloture = tClo; dm.cloturePar = auteur;
          }
        }
        demandes.push(dm);
      }
    });
    demandes.sort(function (a, b) { return a.dateCreation - b.dateCreation; });
    var id = 12040;
    var parId = {};
    tickets.forEach(function (t) { parId[t.id] = t; });
    demandes.forEach(function (dm) {
      dm.id = ++id;
      // Trace de la création dans l'historique du ticket parent
      var t = parId[dm.ticketId];
      var avant = t.historique.filter(function (e) { return e.date <= dm.dateCreation; });
      var etat = avant.length ? avant[avant.length - 1].etatApres : 'OUV';
      t.historique.push({ type: 'maj', date: dm.dateCreation, auteur: dm.creePar, etatAvant: etat, etatApres: etat,
        changements: [{ code: 'demande', id: dm.id, typeDM: dm.type, objet: dm.objet }],
        commentaire: 'Demande de modification n° ' + dm.id + ' créée.', notifies: [t.agent].filter(Boolean) });
    });
    tickets.forEach(function (t) {
      if (!t.nbDM) return;
      t.historique.sort(function (a, b) { return a.date - b.date; });
      var dernier = t.historique[t.historique.length - 1];
      t.dateMaj = dernier.date;
      t.dernierCommentaire = dernier.commentaire;
    });
    return demandes;
  };

  /**
   * Valeur fictive pour un champ ajouté au référentiel pendant la démo.
   * Déterministe (même valeur à chaque rechargement).
   */
  PHX.valeurDemo = function (champ, t) {
    var r = mulberry32(PHX.hash(champ.code + '#' + t.id));
    if (r() > 0.65) return null; // le champ n'est pas renseigné sur tous les tickets
    switch (champ.type) {
      case 'montant': return arrondi2(50 + Math.pow(r(), 2) * 3000);
      case 'nombre': return 1 + Math.floor(r() * 20);
      case 'booleen': return r() < 0.5;
      case 'date': return t.dateCreation + Math.floor(r() * 20) * JOUR;
      default: return 'REF-' + String(1000 + Math.floor(r() * 8999));
    }
  };
})();
