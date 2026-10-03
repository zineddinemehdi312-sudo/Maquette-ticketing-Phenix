/*
 * Phenix – Module Tickets – Lot 1 – Simulation exécutable
 * Écrans couverts (étape 1) :
 *   #/menu     Menu Tickets (Afficher les tickets / Statistiques)
 *   #/tickets  Liste des tickets : filtres, colonnes personnalisées, export .csv
 *   #/stats    Statistiques : tableau de bord des traitements
 */
(function () {
  'use strict';
  const PHX = window.PHX;
  const JOUR = 86400000;

  /* =====================================================================
   * Utilitaires
   * ===================================================================== */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const fmtNb = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const fmtPct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const fDate = (ts) => { if (ts === null || ts === undefined) return ''; const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const fDateHeure = (ts) => { if (ts === null || ts === undefined) return ''; const d = new Date(ts); return fDate(ts) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const parseIso = (s, fin) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const p = s.split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (fin) d.setHours(23, 59, 59, 999);
    return d.getTime();
  };
  const pluriel = (n, mot) => n + ' ' + mot.split(' ').map((m) => m + (n > 1 ? 's' : '')).join(' ');

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
  }

  /* =====================================================================
   * Préférences (navigateur) : profil simulé, colonnes par utilisateur,
   * champs ajoutés au référentiel pendant la démo.
   * Cible SI : préférences de colonnes stockées par utilisateur en base.
   * ===================================================================== */
  const CLE = 'phenix-tickets-lot1';
  const VERSION_DONNEES = 3; // à incrémenter quand le jeu de données fictives change
  const store = { profil: 'agent', colonnes: {}, champsAjoutes: [], tickets: {}, demandes: {}, nouveaux: {} };
  function champValide(c) { return c && typeof c.code === 'string' && typeof c.libelle === 'string' && typeof c.type === 'string'; }
  function charger() {
    try {
      const s = window.localStorage.getItem(CLE);
      if (!s) return;
      const o = JSON.parse(s);
      if (!o || typeof o !== 'object') return;
      if (PHX.PROFILS[o.profil]) store.profil = o.profil;
      if (o.colonnes && typeof o.colonnes === 'object') store.colonnes = o.colonnes;
      if (Array.isArray(o.champsAjoutes)) store.champsAjoutes = o.champsAjoutes.filter(champValide);
      const memesDonnees = o.versionDonnees === VERSION_DONNEES;
      if (memesDonnees && o.tickets && typeof o.tickets === 'object') store.tickets = o.tickets;
      if (memesDonnees && o.demandes && typeof o.demandes === 'object') store.demandes = o.demandes;
      if (memesDonnees && o.nouveaux && typeof o.nouveaux === 'object') store.nouveaux = o.nouveaux;
    } catch (e) { /* stockage indisponible : la démo fonctionne sans mémoire */ }
  }
  function sauver() {
    try { window.localStorage.setItem(CLE, JSON.stringify(Object.assign({ versionDonnees: VERSION_DONNEES }, store))); } catch (e) { /* ignoré */ }
  }

  /* =====================================================================
   * Données
   * ===================================================================== */
  /* Jeu de données figé : généré pour une date de référence fixe (vendredi 2 octobre 2026),
   * puis décalé par semaines entières jusqu'à la semaine en cours. Les numéros de tickets
   * et de demandes restent ainsi identiques d'un jour à l'autre (les jours de semaine
   * sont conservés) et les mises à jour enregistrées dans le navigateur restent valables. */
  const REF_DEMO = new Date(2026, 9, 2).getTime();
  const AUJOURDHUI = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const SEMAINES = Math.max(0, Math.floor(Math.round((AUJOURDHUI - REF_DEMO) / JOUR) / 7));
  const decaler = (ts) => { if (typeof ts !== 'number') return ts; const d = new Date(ts); d.setDate(d.getDate() + 7 * SEMAINES); return d.getTime(); };
  function decalerDonnees() {
    if (!SEMAINES) return;
    TICKETS.forEach((t) => {
      ['dateCreation', 'dateMaj', 'dateResolution', 'dateFermeture'].forEach((k) => { t[k] = decaler(t[k]); });
      ['dateEcheance', 'dateRejet'].forEach((k) => { if (k in t.champs) t.champs[k] = decaler(t.champs[k]); });
      t.historique.forEach((e) => { e.date = decaler(e.date); });
    });
    DEMANDES.forEach((d) => {
      ['dateCreation', 'dateMaj', 'dateCloture', 'dateEffet'].forEach((k) => { d[k] = decaler(d[k]); });
      d.journal.forEach((j) => { j.date = decaler(j.date); });
    });
  }
  const TICKETS = [];
  const PAR_ID = {};
  const DEMANDES = [];
  function genererDonnees() {
    TICKETS.length = 0;
    DEMANDES.length = 0;
    Object.keys(PAR_ID).forEach((k) => { delete PAR_ID[k]; });
    PHX.genererTickets(REF_DEMO).forEach((t) => { TICKETS.push(t); PAR_ID[t.id] = t; });
    PHX.genererDemandes(TICKETS, REF_DEMO).forEach((d) => DEMANDES.push(d));
    decalerDonnees();
  }
  genererDonnees();

  function appliquerChampsAjoutes() {
    store.champsAjoutes.forEach((c) => {
      TICKETS.forEach((t) => {
        if (!t.cree && applicable(c, t) && !(c.code in t.champs)) t.champs[c.code] = PHX.valeurDemo(c, t);
      });
    });
  }

  /* =====================================================================
   * Catalogue des champs -> colonnes
   * ===================================================================== */
  const GETTERS = {
    typologie: (t) => PHX.typo(t.typo).libelle,
    sousTypologie: (t) => PHX.sousTypo(t.typo, t.sous).libelle
  };
  const catalogue = () => PHX.CHAMPS_BASE.concat(store.champsAjoutes);
  function champ(code) {
    const cat = catalogue();
    for (let i = 0; i < cat.length; i++) if (cat[i].code === code) return cat[i];
    return null;
  }
  const profil = () => PHX.PROFILS[store.profil];
  const autorise = (c) => !c.sensible || profil().montants;
  const estSpecifique = (c) => !!(c.portee || c.ajoute);
  function applicable(c, t) {
    if (!c.portee || !c.portee.typo) return true;
    if (c.portee.typo !== t.typo) return false;
    if (c.portee.sous && c.portee.sous.length && c.portee.sous.indexOf(t.sous) < 0) return false;
    return true;
  }
  function valeur(c, t) {
    if (GETTERS[c.code]) return GETTERS[c.code](t);
    let v = estSpecifique(c) ? t.champs[c.code] : t[c.code];
    if ((v === undefined || v === null || v === '') && c.siVide !== undefined) v = c.siVide;
    return v === undefined ? null : v;
  }
  const colonnesDefaut = () => PHX.CHAMPS_BASE.filter((c) => c.defaut);
  function colonnesPerso() {
    const liste = store.colonnes[profil().login] || [];
    return liste.map(champ).filter((c) => c && !c.defaut && autorise(c));
  }
  const colonnesAffichees = () => colonnesDefaut().concat(colonnesPerso());

  const badgeEtat = (code) => {
    const e = PHX.etat(code);
    return '<span class="etat etat-' + esc(code) + '">' + esc(e ? e.libelle : code) + '</span>';
  };

  function celluleHtml(c, t) {
    if (!applicable(c, t)) return '<td title="Non applicable à cette typologie"></td>';
    const v = valeur(c, t);
    if (c.code === 'agent' && !v) return '<td><span class="nc-non-affecte">Non affecté</span></td>';
    if (Array.isArray(v)) return v.length ? '<td>' + esc(v.join(', ')) + '</td>' : '<td class="vide">—</td>';
    if (v === null || v === '') return c.defaut ? '<td></td>' : '<td class="vide">—</td>';
    if (c.code === 'partenaireCode') return '<td><a href="' + lienPartenaire(v) + '" title="Ouvrir la fiche partenaire (onglet Gestion)">' + esc(v) + '</a></td>';
    switch (c.type) {
      case 'id': return '<td><a href="#/ticket/' + esc(v) + '" class="lien-ticket" title="Ouvrir le ticket">' + esc(v) + '</a></td>';
      case 'datetime': return '<td>' + fDateHeure(v) + '</td>';
      case 'date': return '<td>' + fDate(v) + '</td>';
      case 'etat': return '<td>' + badgeEtat(v) + '</td>';
      case 'montant': return '<td class="num">' + esc(fmtEur.format(v)) + '</td>';
      case 'nombre': return '<td class="num">' + esc(v) + '</td>';
      case 'booleen': return '<td>' + (v ? 'Oui' : 'Non') + '</td>';
      default: return '<td' + (c.code === 'objet' ? ' class="objet"' : '') + '>' + esc(v) + '</td>';
    }
  }

  function valeurCsv(c, t) {
    if (!applicable(c, t)) return '';
    const v = valeur(c, t);
    if (c.code === 'agent' && !v) return 'Non affecté';
    if (v === null || v === undefined || v === '') return '';
    if (Array.isArray(v)) return v.join(', ');
    switch (c.type) {
      case 'datetime': return fDateHeure(v);
      case 'date': return fDate(v);
      case 'etat': return PHX.etat(v).libelle;
      case 'montant': return Number(v).toFixed(2).replace('.', ',');
      case 'booleen': return v ? 'Oui' : 'Non';
      default: return String(v);
    }
  }
  function csvCellule(s) {
    s = String(s);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralise les formules (injection CSV)
    if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /* =====================================================================
   * Navigation
   * ===================================================================== */
  const page = $('#page');
  function lireRoute() {
    const h = location.hash || '#/menu';
    const i = h.indexOf('?');
    const chemin = (i < 0 ? h : h.slice(0, i)).replace(/^#/, '') || '/menu';
    return { chemin, params: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
  }
  function majHash(chemin, params) {
    const qs = params.toString();
    const h = '#' + chemin + (qs ? '?' + qs : '');
    if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) { /* ignoré */ } }
  }
  function naviguer() {
    fermerModal();
    fermerMenuRapide();
    const r = lireRoute();
    afficherRoute(r);
    window.scrollTo(0, 0);
  }
  function afficherRoute(r) {
    const m = r.chemin.match(/^\/ticket\/(\d+)$/);
    const mp = r.chemin.match(/^\/partenaire\/([A-Za-z0-9]+)(?:\/(tickets|demandes))?$/);
    document.body.classList.toggle('fp-page', !!mp);
    if (mp) {
      const code = mp[1].toUpperCase(), p = partenaireParCode(code);
      if (mp[2] && p) (mp[2] === 'tickets' ? pageTicketsPartenaire : pageDemandesPartenaire)(p);
      else pagePartenaire(code, r.params);
    }
    else if (r.chemin === '/ticket/nouveau') pageNouveauTicket(r.params);
    else if (m) pageTicket(+m[1]);
    else if (r.chemin === '/demandes/nouvelle') pageNouvelleDemande(r.params);
    else if (r.chemin === '/demandes') pageGestionDemandes();
    else if (r.chemin === '/tickets') pageTickets(r.params);
    else if (r.chemin === '/stats') pageStats(r.params);
    else pageMenu();
  }
  // Ré-affiche l'écran courant après une mise à jour, sans perdre la position de défilement
  function rerendre() {
    const y = window.scrollY;
    afficherRoute(lireRoute());
    window.scrollTo(0, y);
  }

  function ariane(items) {
    $('#ariane').innerHTML = items.map((it, i) =>
      (i ? '<span class="sep" aria-hidden="true">&gt;</span>' : '') +
      (it.href ? '<a href="' + it.href + '">' + esc(it.lib) + '</a>' : '<span' + (i === items.length - 1 ? ' aria-current="page"' : '') + '>' + esc(it.lib) + '</span>')
    ).join('');
  }
  const ARIANE = [{ lib: 'Accueil' }, { lib: 'Gestion Partenaires' }, { lib: 'Tickets', href: '#/menu' }];
  const lienPartenaire = (code) => '#/partenaire/' + encodeURIComponent(code) + '?onglet=gestion';
  // Fil d'Ariane de la fiche ticket selon la provenance (liste des tickets ou fiche partenaire)
  const arianeListe = () => {
    const h = liste.hashListe || '';
    const m = h.match(/^#\/partenaire\/([A-Za-z0-9]+)\/(tickets|demandes)/);
    if (m) return [{ lib: 'Accueil' }, { lib: 'Gestion Partenaires' }, { lib: 'Partenaires' }, { lib: 'Fiche partenaire ' + m[1], href: lienPartenaire(m[1]) }, { lib: m[2] === 'tickets' ? 'Tickets' : 'Demandes de modification', href: h }];
    if (h.indexOf('#/demandes') === 0) return ARIANE.concat([{ lib: 'Demandes de modification', href: h }]);
    return ARIANE.concat([{ lib: 'Afficher les tickets', href: h || '#/tickets' }]);
  };

  function titre(sousTitre, liens) {
    return '<div class="nc-titre"><img src="assets/img/tickets.png" alt=""><h4>Tickets</h4>' +
      (sousTitre ? '<span class="nc-sous-titre">' + esc(sousTitre) + '</span>' : '') +
      (liens ? '<span class="nc-titre-liens">' + liens + '</span>' : '') + '</div>';
  }

  /* =====================================================================
   * Écran 1 – Menu Tickets
   * ===================================================================== */
  const ICONE_LISTE = '<svg width="66" height="44" viewBox="0 0 66 44" fill="none" stroke="#4a4a4a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="8" y="4" width="40" height="36" rx="2"/><path d="M8 12h40"/>' +
    '<path d="M14 19h5M23 19h19M14 26h5M23 26h19M14 33h5M23 33h11"/>' +
    '<path d="M42 28.5c0-4.1 3.6-7 8-7s8 2.9 8 7-3.6 7-8 7c-1.1 0-2.2-.2-3.1-.5L43 37l.9-3.7c-1.2-1.3-1.9-3-1.9-4.8z" fill="#fff" stroke="#EB6200"/>' +
    '<path d="M46.5 28.5h.01M50 28.5h.01M53.5 28.5h.01" stroke="#EB6200" stroke-width="2.8"/></svg>';
  const ICONE_STATS = '<svg width="66" height="44" viewBox="0 0 66 44" fill="none" stroke="#4a4a4a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10 5v34h46"/><rect x="16" y="25" width="7" height="14"/><rect x="28" y="17" width="7" height="22"/><rect x="40" y="21" width="7" height="18"/>' +
    '<path d="M15 17l11-8 10 5 14-9" stroke="#EB6200"/><path d="M45 5h5v5" stroke="#EB6200"/></svg>';

  function pageMenu() {
    ariane([{ lib: 'Accueil' }, { lib: 'Gestion Partenaires' }, { lib: 'Tickets' }]);
    const actifs = TICKETS.filter((t) => PHX.etat(t.etat).actif).length;
    const na = TICKETS.filter((t) => t.etat === 'OUV' && !t.agent).length;
    const dmAttente = DEMANDES.filter((d) => d.statut === 'ATT').length;
    const dmCours = DEMANDES.filter((d) => !dmClose(d)).length;
    page.innerHTML = titre() +
      '<div class="nc-tuiles">' +
      '<a class="nc-tuile" href="#/demandes">' + ICONE_DEMANDES + '<b>Demandes de modification</b><small>' + dmCours + ' en cours, dont ' + dmAttente + ' en attente</small></a>' +
      '<a class="nc-tuile" href="#/tickets">' + ICONE_LISTE + '<b>Afficher les tickets</b><small>' + actifs + ' en cours, dont ' + na + ' non affectés</small></a>' +
      '<a class="nc-tuile" href="#/stats">' + ICONE_STATS + '<b>Statistiques</b><small>Suivi des traitements</small></a>' +
      '</div>';
  }

  /* =====================================================================
   * Écran 2 – Afficher les tickets
   * ===================================================================== */
  const liste = { f: {}, tri: { col: 'dateCreation', sens: -1 }, page: 1, taille: 10, resultat: [] };
  const FILTRES_DEFAUT = { num: '', part: '', typo: '', sous: '', etat: 'ACTIFS', agent: '', crea: '', du: '', au: '' };

  const optionsTypo = (val) => '<option value="">Indifférent</option>' +
    PHX.TYPOLOGIES.map((t) => '<option value="' + t.code + '"' + (t.code === val ? ' selected' : '') + '>' + esc(t.libelle) + '</option>').join('');
  function optionsSous(typo, val) {
    const t = PHX.typo(typo);
    if (!t) return '<option value="">Choisir une typologie</option>';
    return '<option value="">Indifférent</option>' + t.sous.map((s) => '<option value="' + s.code + '"' + (s.code === val ? ' selected' : '') + '>' + esc(s.libelle) + '</option>').join('');
  }
  const optionsEtat = (val) => '<option value="ACTIFS"' + (val === 'ACTIFS' ? ' selected' : '') + '>En cours de traitement</option>' +
    '<option value="TOUS"' + (val === 'TOUS' ? ' selected' : '') + '>Tous les états</option>' +
    PHX.ETATS.map((e) => '<option value="' + e.code + '"' + (e.code === val ? ' selected' : '') + '>' + esc(e.libelle) + '</option>').join('');
  function listeAgents(cle) {
    const s = {};
    TICKETS.forEach((t) => { if (t[cle]) s[t[cle]] = true; });
    return Object.keys(s).sort();
  }
  const optionsAgent = (val, avecNA) => '<option value="">Indifférent</option>' +
    (avecNA ? '<option value="__NA__"' + (val === '__NA__' ? ' selected' : '') + '>Non affecté</option>' : '') +
    listeAgents('agent').map((a) => '<option value="' + esc(a) + '"' + (a === val ? ' selected' : '') + '>' + esc(a) + '</option>').join('');
  const optionsCrea = (val) => '<option value="">Indifférent</option>' +
    listeAgents('createur').map((a) => '<option value="' + esc(a) + '"' + (a === val ? ' selected' : '') + '>' + esc(a) + '</option>').join('');

  function filtresDepuis(params, defauts) {
    const f = Object.assign({}, defauts || FILTRES_DEFAUT);
    Object.keys(f).forEach((k) => { if (params.has(k)) f[k] = params.get(k); });
    if (!PHX.typo(f.typo)) { f.typo = ''; f.sous = ''; } else if (!PHX.sousTypo(f.typo, f.sous)) f.sous = '';
    if (f.etat !== 'ACTIFS' && f.etat !== 'TOUS' && !PHX.etat(f.etat)) f.etat = 'ACTIFS';
    if (!parseIso(f.du)) f.du = '';
    if (!parseIso(f.au)) f.au = '';
    return f;
  }

  function pageTickets(params) {
    ariane(ARIANE.concat([{ lib: 'Afficher les tickets' }]));
    vueListeTickets(page, params, { chemin: '/tickets', titre: true });
  }

  /* Liste des tickets réutilisable : page « Afficher les tickets » et onglet
   * Gestion de la fiche partenaire (cfg.partenaire : partenaire figé). */
  function vueListeTickets(cible, params, cfg) {
    liste.cfg = cfg;
    liste.defauts = Object.assign({}, FILTRES_DEFAUT, cfg.etatDefaut ? { etat: cfg.etatDefaut } : {});
    const f = liste.f = filtresDepuis(params, liste.defauts);
    f.partFixe = cfg.partenaire || '';
    if (f.partFixe) f.part = '';
    const retour = liste.hashListe && (location.hash || '#/tickets') === liste.hashListe;
    liste.page = retour ? (liste.pageMemo || 1) : 1;
    cible.innerHTML = (cfg.titre ? titre('Afficher les tickets', '<a class="nc-btn" href="#/stats">Statistiques</a>') : '') +
      '<ul class="nc-filtres" aria-label="Filtres">' +
      '<li><label for="fNum"><b>Num Ticket</b></label><input type="text" id="fNum" inputmode="numeric" maxlength="8" value="' + esc(f.num) + '"></li>' +
      (f.partFixe ? '' : '<li><label for="fPart"><b>Partenaire</b></label><input type="text" class="large" id="fPart" placeholder="Code SO… ou raison sociale" value="' + esc(f.part) + '"></li>') +
      '<li><label for="fTypo"><b>Typologie</b></label><select id="fTypo">' + optionsTypo(f.typo) + '</select></li>' +
      '<li><label for="fSous"><b>Sous-typologie</b></label><select id="fSous"' + (f.typo ? '' : ' disabled') + '>' + optionsSous(f.typo, f.sous) + '</select></li>' +
      '<li><label for="fEtat"><b>État</b></label><select id="fEtat" title="« En cours » = Ouvert, Attente retour partenaire, Attente arbitrage">' + optionsEtat(f.etat) + '</select></li>' +
      '<li><label for="fAgent"><b>Agent</b></label><select id="fAgent">' + optionsAgent(f.agent, true) + '</select></li>' +
      '<li><label for="fCrea"><b>Créé par</b></label><select id="fCrea">' + optionsCrea(f.crea) + '</select></li>' +
      '<li><label for="fDu"><b>Créé du</b></label><input type="date" id="fDu" value="' + esc(f.du) + '"><label for="fAu"><b>au</b></label><input type="date" id="fAu" value="' + esc(f.au) + '"></li>' +
      '</ul>' +
      '<div class="nc-actions"><button type="button" class="nc-btn" id="btnChercher">Chercher</button>' +
      '<button type="button" class="nc-btn" id="btnRaz">Réinitialiser les filtres</button></div>' +
      '<div class="nc-outils"><span class="nc-compte" id="compte" aria-live="polite"></span>' +
      '<span class="nc-droite">' +
      '<button type="button" class="nc-btn" id="btnColonnes" aria-haspopup="dialog">Colonnes… <span class="nc-pastille" id="pastilleCol" hidden></span></button>' +
      '<button type="button" class="nc-btn nc-btn-orange" id="btnCsv">Exporter .csv</button>' +
      '<label for="taille">Choix du nombre de lignes:</label><select id="taille">' +
      [10, 100, 0].map((n) => '<option value="' + n + '"' + (n === liste.taille ? ' selected' : '') + '>' + (n || 'Tout') + '</option>').join('') +
      '</select></span></div>' +
      '<div class="nc-grille-wrap" id="grilleWrap"></div>' +
      '<div class="nc-pager" id="pager"></div>' +
      '<p class="nc-legende" id="legende" hidden>Cellule vide : champ non applicable à la typologie du ticket. « — » : champ applicable mais pas encore renseigné.</p>';

    // Événements des filtres
    let minuteur = null;
    const appliquer = () => { lireFiltres(); liste.page = 1; rafraichirListe(); };
    ['#fNum', '#fPart'].filter((s) => $(s)).forEach((s) => {
      $(s).addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(appliquer, 250); });
      $(s).addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(minuteur); appliquer(); } });
    });
    $('#fTypo').addEventListener('change', () => {
      const typo = $('#fTypo').value;
      $('#fSous').innerHTML = optionsSous(typo, '');
      $('#fSous').disabled = !typo;
      appliquer();
    });
    ['#fSous', '#fEtat', '#fAgent', '#fCrea', '#fDu', '#fAu'].forEach((s) => $(s).addEventListener('change', appliquer));
    $('#btnChercher').addEventListener('click', appliquer);
    $('#btnRaz').addEventListener('click', () => {
      liste.hashListe = null;
      const fixes = new URLSearchParams(cfg.fixes || '');
      majHash(cfg.chemin, fixes);
      vueListeTickets(cible, fixes, cfg);
    });
    $('#btnColonnes').addEventListener('click', ouvrirColonnes);
    $('#btnCsv').addEventListener('click', exporterCsv);
    $('#taille').addEventListener('change', () => { liste.taille = +$('#taille').value; liste.page = 1; rafraichirListe(); });

    // Délégation : tri, aperçu, pagination
    $('#grilleWrap').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-col]');
      if (th) { trierPar(th.getAttribute('data-col')); return; }
      if (e.target.closest('a[href^="#/ticket/"]')) { memoriserContexte(); return; }
      if (e.target.closest('[data-raz]')) $('#btnRaz').click();
    });
    $('#grilleWrap').addEventListener('keydown', (e) => {
      const th = e.target.closest('th[data-col]');
      if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); trierPar(th.getAttribute('data-col')); }
    });
    $('#pager').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-page]');
      if (b && !b.disabled) { liste.page = +b.getAttribute('data-page'); rafraichirListe(); $('#grilleWrap').scrollIntoView({ block: 'nearest' }); }
    });
    rafraichirListe();
  }

  // Contexte conservé pour « Retour à la liste » et « Précédent / Suivant »
  function memoriserContexte() {
    liste.hashListe = location.hash || '#/tickets';
    liste.pageMemo = liste.page;
    liste.ordre = liste.resultat.map((t) => t.id);
  }

  function lireFiltres() {
    const f = liste.f;
    f.num = $('#fNum').value.replace(/\D/g, '');
    f.part = $('#fPart') ? $('#fPart').value : '';
    f.typo = $('#fTypo').value;
    f.sous = $('#fSous').value;
    f.etat = $('#fEtat').value;
    f.agent = $('#fAgent').value;
    f.crea = $('#fCrea').value;
    f.du = $('#fDu').value;
    f.au = $('#fAu').value;
    const p = new URLSearchParams(liste.cfg.fixes || '');
    Object.keys(liste.defauts).forEach((k) => { if (f[k] && f[k] !== liste.defauts[k]) p.set(k, f[k]); });
    majHash(liste.cfg.chemin, p);
  }

  function filtrer(tickets, f) {
    const nPart = norm(f.part).trim();
    const du = parseIso(f.du), au = parseIso(f.au, true);
    return tickets.filter((t) => {
      if (f.partFixe && t.partenaireCode !== f.partFixe) return false;
      if (f.num && String(t.id).indexOf(f.num) === -1) return false;
      if (nPart && norm(t.partenaireCode).indexOf(nPart) === -1 && norm(t.partenaireRS).indexOf(nPart) === -1) return false;
      if (f.typo && t.typo !== f.typo) return false;
      if (f.sous && t.sous !== f.sous) return false;
      if (f.etat === 'ACTIFS') { if (!PHX.etat(t.etat).actif) return false; }
      else if (f.etat && f.etat !== 'TOUS' && t.etat !== f.etat) return false;
      if (f.agent === '__NA__') { if (t.agent) return false; }
      else if (f.agent && t.agent !== f.agent) return false;
      if (f.crea && t.createur !== f.crea) return false;
      if (du && t.dateCreation < du) return false;
      if (au && t.dateCreation > au) return false;
      return true;
    });
  }

  function cleTri(c, t) {
    if (!applicable(c, t)) return null;
    const v = valeur(c, t);
    if (v === null || v === undefined || v === '') return null;
    if (c.type === 'etat') return PHX.ETATS.indexOf(PHX.etat(v));
    if (c.type === 'booleen') return v ? 1 : 0;
    if (Array.isArray(v)) return v.length ? norm(v.join(', ')) : null;
    if (typeof v === 'string') return norm(v);
    return v;
  }
  function trier(tickets, tri) {
    const c = champ(tri.col) || champ('dateCreation');
    return tickets.slice().sort((a, b) => {
      const va = cleTri(c, a), vb = cleTri(c, b);
      if (va === null && vb === null) return b.id - a.id;
      if (va === null) return 1;   // valeurs vides toujours en fin de liste
      if (vb === null) return -1;
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return r * tri.sens || (b.id - a.id);
    });
  }
  function trierPar(code) {
    const c = champ(code);
    if (!c) return;
    if (liste.tri.col === code) liste.tri.sens = -liste.tri.sens;
    else liste.tri = { col: code, sens: ['datetime', 'date', 'montant', 'nombre', 'id'].indexOf(c.type) >= 0 ? -1 : 1 };
    liste.page = 1;
    rafraichirListe();
    const th = $('th[data-col="' + code + '"]');
    if (th) th.focus();
  }

  function rafraichirListe() {
    // Fiche partenaire : les colonnes du partenaire sont masquées (elles restent dans l'export .csv)
    const cols = colonnesAffichees().filter((c) => !(liste.f.partFixe && (c.code === 'partenaireCode' || c.code === 'partenaireRS')));
    if (!cols.some((c) => c.code === liste.tri.col)) liste.tri = { col: 'dateCreation', sens: -1 };
    const res = liste.resultat = trier(filtrer(TICKETS, liste.f), liste.tri);

    $('#compte').innerHTML = '<b>' + res.length + '</b> ' + (res.length > 1 ? 'tickets' : 'ticket') + ' sur ' +
      (liste.f.partFixe ? TICKETS.filter((t) => t.partenaireCode === liste.f.partFixe).length + ' du partenaire' : TICKETS.length);
    const np = colonnesPerso().length;
    const pastille = $('#pastilleCol');
    pastille.hidden = !np;
    pastille.textContent = '+' + np;
    pastille.title = np ? pluriel(np, 'colonne ajoutée') : '';

    const taille = liste.taille;
    const nbPages = taille ? Math.max(1, Math.ceil(res.length / taille)) : 1;
    if (liste.page > nbPages) liste.page = nbPages;
    const debut = taille ? (liste.page - 1) * taille : 0;
    const vue = taille ? res.slice(debut, debut + taille) : res;

    const entetes = cols.map((c) => {
      const actif = liste.tri.col === c.code;
      const sens = actif ? (liste.tri.sens > 0 ? 'ascending' : 'descending') : 'none';
      const info = (c.aide ? c.aide + '. ' : '') + (c.defaut ? '' : 'Colonne ajoutée (' + PHX.groupeChamp(c) + '). ') + 'Cliquer pour trier.';
      return '<th scope="col" tabindex="0" data-col="' + esc(c.code) + '" aria-sort="' + sens + '" class="' + (c.defaut ? '' : 'perso') + '" title="' + esc(info) + '">' +
        esc(c.libelle) + (c.aide ? '<span class="info" aria-hidden="true">ⓘ</span>' : '') +
        '<span class="tri" aria-hidden="true">' + (actif ? (liste.tri.sens > 0 ? '▲' : '▼') : '') + '</span></th>';
    }).join('');

    const thOuvrir = '<th scope="col" class="col-ouvrir"><span class="sr-only">Ouvrir le ticket</span></th>';
    const tdOuvrir = (t) => '<td class="col-ouvrir"><a class="nc-btn-ouvrir" href="#/ticket/' + t.id + '" aria-label="Ouvrir le ticket n° ' + t.id + '">Ouvrir</a></td>';
    if (!res.length) {
      $('#grilleWrap').innerHTML = '<table class="nc-grille"><thead><tr>' + thOuvrir + entetes + '</tr></thead></table>' +
        '<div class="nc-vide-grille">Aucun ticket ne correspond à ces filtres.<br><button type="button" class="nc-btn" data-raz>Réinitialiser les filtres</button></div>';
    } else {
      $('#grilleWrap').innerHTML = '<table class="nc-grille"><caption class="sr-only">Liste des tickets</caption><thead><tr>' + thOuvrir + entetes + '</tr></thead><tbody>' +
        vue.map((t) => '<tr>' + tdOuvrir(t) + cols.map((c) => celluleHtml(c, t)).join('') + '</tr>').join('') + '</tbody></table>';
    }

    // Pagination
    let pg = '';
    if (taille && nbPages > 1) {
      const p = liste.page;
      const btn = (n, lib, aria) => '<button type="button" data-page="' + n + '"' + (n === p && !lib ? ' aria-current="page"' : '') +
        ((n < 1 || n > nbPages) ? ' disabled' : '') + (aria ? ' aria-label="' + aria + '"' : '') + '>' + (lib || n) + '</button>';
      pg += btn(p - 1, '‹', 'Page précédente');
      let a = Math.max(1, p - 4), b = Math.min(nbPages, a + 8);
      a = Math.max(1, b - 8);
      if (a > 1) pg += btn(1) + (a > 2 ? '<span>…</span>' : '');
      for (let i = a; i <= b; i++) pg += btn(i);
      if (b < nbPages) pg += (b < nbPages - 1 ? '<span>…</span>' : '') + btn(nbPages);
      pg += btn(p + 1, '›', 'Page suivante');
      pg += '<span class="info">Page ' + p + ' / ' + nbPages + '</span>';
    }
    $('#pager').innerHTML = pg;
    $('#legende').hidden = !cols.some((c) => !c.defaut && estSpecifique(c));
  }

  /* =====================================================================
   * Écran 4 – Fiche ticket (sur le modèle de « Tickets Répondre » Netcom)
   *   En-tête · liens · historique des échanges · bloc « Ticket N° » avec les
   *   paramètres Phenix · commentaire · notification par e-mail · ENREGISTRER
   * ===================================================================== */
  const estManager = () => store.profil === 'manager';
  const moi = () => profil().login;
  const libTypo = (c) => (PHX.typo(c) || {}).libelle || c || '';
  const libSous = (t, s) => (PHX.sousTypo(t, s) || {}).libelle || s || '';
  const unique = (a) => a.filter((x, i) => x && a.indexOf(x) === i);
  const estEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const LIB_CHANGEMENT = { destinataires: 'Destinataires additionnels' };
  const EQUIPES_ORDRE = unique(Object.keys(PHX.EQUIPES).map((a) => PHX.EQUIPES[a]));
  // Chemins écrits en entier : build.py les remplace par les images intégrées
  const ICONES = { maj: 'assets/img/nav_go_orange_16.gif', partenaire: 'assets/img/nav_user_16.gif', demande: 'assets/img/nav_notes_add_16.gif', retour: 'assets/img/nav_copy_prev_16.gif' };
  const img = (cle) => '<img src="' + ICONES[cle] + '" alt="" width="16" height="16">';

  // Valeur lisible d'un changement dans l'historique (montants masqués selon RG-15)
  function valeurHisto(code, v) {
    if (v === null || v === undefined || v === '') return code === 'agent' ? 'Non affecté' : '—';
    if (Array.isArray(v)) return v.length ? esc(v.join(', ')) : '—';
    const c = champ(code);
    if (c && c.sensible && !profil().montants) return '🔒';
    if (!c) return esc(v);
    switch (c.type) {
      case 'montant': return esc(fmtEur.format(v));
      case 'booleen': return v ? 'Oui' : 'Non';
      case 'date': case 'datetime': return fDate(v);
      default: return esc(v);
    }
  }
  function ligneChangement(ch) {
    if (ch.code === 'demande') {
      return '<li>Demande de modification <a href="#" data-dm="' + esc(ch.id) + '">n° ' + esc(ch.id) + '</a> (' + esc(libTypeDM(ch.typeDM)) + ') créée : ' + esc(ch.objet) + '</li>';
    }
    if (ch.code === 'destinataires') {
      return '<li>Destinataires additionnels : ' +
        (ch.ajoutes && ch.ajoutes.length ? 'ajout de ' + esc(ch.ajoutes.join(', ')) : '') +
        (ch.ajoutes && ch.ajoutes.length && ch.retires && ch.retires.length ? ' ; ' : '') +
        (ch.retires && ch.retires.length ? 'retrait de ' + esc(ch.retires.join(', ')) : '') + '</li>';
    }
    const c = champ(ch.code);
    return '<li>' + esc(c ? c.libelle : (LIB_CHANGEMENT[ch.code] || ch.code)) + ' : ' + valeurHisto(ch.code, ch.avant) + ' → <b>' + valeurHisto(ch.code, ch.apres) + '</b></li>';
  }
  function blocEvenement(t, e) {
    const ligne = (lib, html) => '<dt>' + esc(lib) + ' :</dt><dd>' + html + '</dd>';
    const etat = e.etatAvant && e.etatAvant !== e.etatApres ? badgeEtat(e.etatAvant) + ' → ' + badgeEtat(e.etatApres) : badgeEtat(e.etatApres);
    let corps = ligne('État', etat);
    if (e.type === 'ouverture') {
      corps += ligne('Partenaire', esc(t.partenaireCode + ' – ' + t.partenaireRS)) +
        ligne('Typologie', esc(libTypo(e.typo || t.typo) + ' › ' + libSous(e.typo || t.typo, e.sous || t.sous))) +
        ligne('Objet', esc(t.objet)) +
        (e.servicesImpactes && e.servicesImpactes.length ? ligne('Services impactés', esc(e.servicesImpactes.join(', '))) : '') +
        (e.interlocuteur || e.joignable ? ligne('Interlocuteur', esc(e.interlocuteur || '—') + (e.joignable ? ' – joignable au ' + esc(e.joignable) : '')) : '') +
        ligne('Description', esc(e.commentaire)) +
        ligne('Notification', 'envoyée à ' + esc(e.notifies.join(', ')));
    } else {
      if (e.changements && e.changements.length) corps += ligne('Modifications', '<ul class="rp-modifs">' + e.changements.map(ligneChangement).join('') + '</ul>');
      if (e.commentaire) corps += ligne('Commentaire', esc(e.commentaire));
      corps += ligne('Notifiés', e.notifies && e.notifies.length ? esc(e.notifies.join(', ')) : '<i>aucun destinataire</i>');
    }
    const tete = e.type === 'ouverture'
      ? 'Ticket N° : <b>' + t.id + '</b> – ouverture le ' + fDateHeure(e.date) + ' par ' + esc(e.auteur)
      : img('maj') + ' Mise à jour du ' + fDateHeure(e.date) + ' par ' + esc(e.auteur) +
        (e.saisie ? '<span class="rp-ev-saisie">saisie dans la démo</span>' : '');
    return '<article class="rp-ev"><div class="rp-ev-tete">' + tete + '</div><dl>' + corps + '</dl></article>';
  }

  function pageTicket(id) {
    const t = PAR_ID[id];
    const retourHref = liste.hashListe || '#/tickets';
    ariane(arianeListe().concat([{ lib: 'Ticket n° ' + id }]));
    if (!t) {
      page.innerHTML = titre('Ticket n° ' + id) +
        '<div class="nc-vide-grille">Le ticket n° ' + esc(id) + ' n’existe pas ou n’est plus accessible.<br>' +
        '<a class="nc-btn" href="' + retourHref + '">Retour à la liste</a></div>';
      return;
    }
    const ordre = liste.ordre || [];
    const i = ordre.indexOf(id);
    const bouton = (cible, lib) => cible
      ? '<a class="nc-btn" href="#/ticket/' + cible + '">' + lib + '</a>'
      : '<span class="nc-btn" aria-disabled="true">' + lib + '</span>';
    const nav = '<div class="tk-nav"><a class="nc-btn" href="' + retourHref + '">Retour à la liste</a>' +
      (i >= 0 ? '<span class="tk-pos">Ticket ' + (i + 1) + ' sur ' + ordre.length + ' de la liste</span>' +
        bouton(i > 0 ? ordre[i - 1] : null, '‹ Précédent') + bouton(i < ordre.length - 1 ? ordre[i + 1] : null, 'Suivant ›') : '') +
      '</div>';

    page.innerHTML = titre('Ticket n° ' + t.id, nav) +
      '<div class="rp-entete"><span>Ticket N° : <b class="rp-num">' + t.id + '</b></span>' +
      '<span>Suivi par : <b>' + (t.agent ? esc(t.agent) : '<span class="nc-non-affecte">Non affecté</span>') + '</b></span>' +
      '<span>Partenaire : <b>' + esc(t.partenaireCode + ' – ' + t.partenaireRS) + '</b></span>' + badgeEtat(t.etat) + '</div>' +
      '<div class="rp-liens">' +
      '<a href="#/partenaire/' + esc(t.partenaireCode) + '">' + img('partenaire') + 'Afficher partenaire</a>' +
      '<a href="#/demandes/nouvelle?ticket=' + t.id + '">' + img('demande') + 'Nouvelle demande de modification</a>' +
      '</div>' +
      '<section class="rp-histo" aria-label="Historique des échanges">' + t.historique.map((e) => blocEvenement(t, e)).join('') + '</section>' +
      blocDemandesTicket(t) +
      '<div id="rpForm"></div>';
    rendreFormulaire(t);
  }

  /* ---------- Bloc de saisie : paramètres Phenix au-dessus du commentaire ---------- */
  function rendreFormulaire(t) {
    const ferme = t.etat === 'FER';
    const d = { etat: t.etat, agent: t.agent, typo: t.typo, sous: t.sous, champs: Object.assign({}, t.champs), destinataires: (t.destinataires || []).slice(), commentaire: '' };
    const ctx = { t, d, ferme, tente: false, groupesOuverts: {} };
    const peutReaffecter = !ferme && (estManager() || (t.agent && t.agent === moi()));
    const agents = Object.keys(PHX.EQUIPES).sort();
    const optAgents = (!t.agent ? '<option value="">Non affecté</option>' : '') +
      agents.map((a) => '<option value="' + esc(a) + '"' + (a === t.agent ? ' selected' : '') + '>' + esc(a) + ' (' + esc(PHX.EQUIPES[a]) + ')</option>').join('');
    const optTypo = PHX.TYPOLOGIES.map((x) => '<option value="' + x.code + '"' + (x.code === t.typo ? ' selected' : '') + '>' + esc(x.libelle) + '</option>').join('');
    const lib = (txt) => '<span class="rp-lib">' + esc(txt) + ' :</span>';

    $('#rpForm').innerHTML =
      '<section class="rp-panneau" aria-labelledby="rpTitre"><h3 class="rp-panneau-tete" id="rpTitre">Ticket N° : ' + t.id + '</h3><div class="rp-panneau-corps">' +
      (ferme ? '<p class="nc-note nc-note-verrou">Ticket fermé : lecture seule.</p>' : '') +
      '<div class="rp-grille">' +
      '<label for="rpEtat">État <span class="req" aria-hidden="true">*</span></label>' +
      '<div class="rp-champ" data-champ="etat"><select id="rpEtat"></select> <a href="#" id="rpRegles" class="rp-lien-aide">Règles du workflow</a><div class="rp-aide" id="rpEtatAide"></div></div>' +
      '<label for="rpAgent">Agent responsable</label>' +
      '<div class="rp-champ" data-champ="agent"><div class="rp-ligne"><select id="rpAgent"' + (peutReaffecter ? '' : ' disabled') + '>' + optAgents + '</select>' +
      (!t.agent && !ferme ? '<button type="button" class="nc-btn" id="rpPrendre">Prendre en charge</button>' : '') + '</div>' +
      '<div class="rp-aide">' + (ferme ? '' : !t.agent ? 'Le ticket est dans la file de sa typologie : prenez-le en charge pour le traiter.' : peutReaffecter ? 'Réaffecter le ticket : le nouvel agent recevra les notifications à la place de l’ancien.' : 'Réaffectation : agent responsable ou manager.') + '</div></div>' +
      '<label for="rpTypo">Typologie</label>' +
      '<div class="rp-champ" data-champ="typo"><select id="rpTypo"' + (estManager() && !ferme ? '' : ' disabled') + '>' + optTypo + '</select>' +
      '<div class="rp-aide">' + (estManager() ? 'Changement historisé (RG-14).' : 'Modifiable par un manager.') + '</div></div>' +
      '<label for="rpSous">Sous-typologie</label>' +
      '<div class="rp-champ" data-champ="sous"><select id="rpSous"' + (estManager() && !ferme ? '' : ' disabled') + '>' + optionsSousForm(t.typo, t.sous, false) + '</select><div class="tk-err" data-err="sous"></div></div>' +
      lib('Code partenaire') + '<b>' + esc(t.partenaireCode) + '</b>' + lib('Partenaire') + '<b>' + esc(t.partenaireRS) + '</b>' +
      lib('Créé par') + '<b>' + esc(t.createur) + '</b>' + lib('Créé le') + '<b>' + fDateHeure(t.dateCreation) + '</b>' +
      lib('Objet') + '<b class="rp-large">' + esc(t.objet) + '</b>' +
      lib('Date résolution') + '<b>' + (t.dateResolution ? fDate(t.dateResolution) : '—') + '</b>' + lib('Date fermeture') + '<b>' + (t.dateFermeture ? fDate(t.dateFermeture) : '—') + '</b>' +
      lib('Boîte notifiée à l’ouverture') + '<b>' + esc(t.boite) + '</b>' + lib('Demandes de modification') + '<b>' + t.nbDM + '</b>' +
      '</div><div id="rpSpec"></div></div></section>' +

      '<div class="rp-commentaire"><label for="rpCom"><b>Commentaire :</b></label> <span class="tk-err" data-err="commentaire"></span>' +
      '<textarea id="rpCom" rows="6"' + (ferme ? ' disabled' : '') + ' placeholder="' + (ferme ? '' : 'Commentaire visible dans l’historique du ticket et dans l’e-mail de notification') + '"></textarea></div>' +

      '<section class="rp-panneau" aria-labelledby="rpNotifTitre"><h3 class="rp-panneau-tete" id="rpNotifTitre">Notification par email :</h3><div class="rp-panneau-corps" id="rpNotif"></div></section>' +

      '<div class="rp-pied"><div class="rp-resume" id="rpResume" aria-live="polite"></div>' +
      '<button type="button" class="rp-btn-enregistrer" id="rpEnregistrer"' + (ferme ? ' disabled' : '') + '>ENREGISTRER</button></div>';

    rendreSpec(ctx);
    rendreNotif(ctx);
    majEtats(ctx);
    evaluer(ctx);

    const f = $('#rpForm');
    f.addEventListener('input', (e) => { if (!e.target.closest('#rpNotif')) evaluer(ctx); });
    f.addEventListener('change', (e) => {
      if (e.target.id === 'rpTypo') {
        ctx.d.typo = e.target.value;
        $('#rpSous').innerHTML = optionsSousForm(ctx.d.typo, '', ctx.d.typo !== t.typo);
        if (ctx.d.typo === t.typo) $('#rpSous').value = t.sous;
        lireFormulaire(ctx); rendreSpec(ctx);
      } else if (e.target.id === 'rpSous') {
        lireFormulaire(ctx); rendreSpec(ctx);
      } else if (e.target.id === 'rpAgent') {
        lireFormulaire(ctx); majEtats(ctx); rendreNotif(ctx);
      } else if (['rpEtat', 'rpc_avoirAccorde', 'rpc_avoirDemande', 'rpc_gesteAccorde'].indexOf(e.target.id) >= 0) {
        const idFocus = e.target.id;
        lireFormulaire(ctx); rendreSpec(ctx);
        const el = document.getElementById(idFocus); if (el) el.focus();
      }
      if (!e.target.closest('#rpNotif')) evaluer(ctx);
    });
    const prendre = $('#rpPrendre');
    if (prendre) prendre.addEventListener('click', () => {
      $('#rpAgent').value = moi();
      lireFormulaire(ctx); majEtats(ctx); rendreNotif(ctx); evaluer(ctx);
      prendre.disabled = true;
      toast('Prise en charge par ' + moi() + ' : cliquez sur ENREGISTRER pour la valider.');
    });
    $('#rpRegles').addEventListener('click', (e) => { e.preventDefault(); ouvrirRegles(); });
    $('#rpEnregistrer').addEventListener('click', () => enregistrer(ctx));
  }

  function optionsSousForm(typo, val, aChoisir) {
    const T = PHX.typo(typo);
    return (aChoisir ? '<option value="">Choisir une sous-typologie</option>' : '') +
      (T ? T.sous.map((s) => '<option value="' + s.code + '"' + (s.code === val ? ' selected' : '') + '>' + esc(s.libelle) + '</option>').join('') : '');
  }

  // États proposés selon le workflow, l'agent et le profil
  function majEtats(ctx) {
    const { t, d, ferme } = ctx;
    let possibles = [t.etat], aide = '';
    if (ferme) aide = 'Ticket fermé : lecture seule.';
    else if (!d.agent) aide = 'Prenez le ticket en charge pour changer son état.';
    else if (t.etat === 'AAR' && !estManager()) aide = 'Seul un manager peut rendre l’arbitrage.';
    else possibles = possibles.concat(PHX.TRANSITIONS[t.etat]);
    const sel = $('#rpEtat');
    const garde = possibles.indexOf(sel.value) >= 0 ? sel.value : t.etat;
    sel.innerHTML = possibles.map((c) => '<option value="' + c + '"' + (c === garde ? ' selected' : '') + '>' +
      esc(PHX.etat(c).libelle) + (c === t.etat ? ' (état actuel)' : (c === 'OUV' && PHX.etat(t.etat).tranche ? ' (réouverture)' : '')) + '</option>').join('');
    sel.disabled = possibles.length < 2;
    $('#rpEtatAide').textContent = aide || 'Tout changement d’état demande un commentaire.';
    d.etat = sel.value;
  }

  /* ---------- Champs spécifiques, générés depuis le référentiel des champs ---------- */
  const AIDES_CHAMPS = {
    avoirDemande: 'Détermine si une demande d’avoir est associée.',
    montantReclame: 'Obligatoire si un avoir est demandé (RG-05).',
    avoirAccorde: 'Obligatoire pour passer en Résolu ou Rejeté. Rejeté : Non.',
    montantAvoirHT: 'Obligatoire si un avoir est accordé.',
    montantRecouvreHT: '0 € si rien n’a été recouvré.',
    gesteAccorde: 'Obligatoire pour passer en Résolu ou Rejeté. Cumulable avec un avoir.',
    montantGesteHT: 'Obligatoire si un geste co est accordé.',
    servicesImpactes: 'Choix multiple.',
    causeIrrecouvrable: 'Obligatoire pour passer en Rejeté. Le reste dû (réclamé − recouvré) est alors compté irrécouvrable.'
  };
  const isoJour = (ts) => { if (ts === null || ts === undefined) return ''; const x = new Date(ts); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  const champsDuBrouillon = (d) => catalogue().filter((c) => estSpecifique(c) && applicable(c, { typo: d.typo, sous: d.sous }));

  function rendreSpec(ctx) {
    const { d, ferme } = ctx;
    const zone = $('#rpSpec');
    const T = PHX.typo(d.typo);
    if (!d.sous || !PHX.sousTypo(d.typo, d.sous)) {
      zone.innerHTML = '<div class="rp-grille"><div class="rp-sec">Champs spécifiques</div><p class="rp-aide rp-large-tout">Choisissez une sous-typologie pour afficher ses champs.</p></div>';
      return;
    }
    const champs = champsDuBrouillon(d);
    const titreSec = 'Champs spécifiques – ' + T.libelle + ' › ' + libSous(d.typo, d.sous);
    if (!champs.length) {
      zone.innerHTML = '<div class="rp-grille"><div class="rp-sec">' + esc(titreSec) + '</div><p class="rp-aide rp-large-tout">Aucun champ spécifique pour cette sous-typologie.</p></div>';
      return;
    }
    const rejete = d.etat === 'REJ';
    if (rejete) ctx.avoirForce = true;
    else if (ctx.avoirForce) { d.champs.avoirAccorde = ctx.t.champs.avoirAccorde; d.champs.montantAvoirHT = ctx.t.champs.montantAvoirHT; ctx.avoirForce = false; }
    zone.innerHTML = '<div class="rp-grille"><div class="rp-sec">' + esc(titreSec) + '</div>' + champs.map((c) => {
      const id = 'rpc_' + c.code;
      let v = d.champs[c.code];
      if (v === undefined) v = null;
      const lab = (c.type === 'multi' ? '<span class="rp-lib" id="lab_' + id + '">' : '<label for="' + id + '">') + esc(c.libelle) +
        ' <span class="req" data-req="' + esc(c.code) + '" aria-hidden="true" hidden>*</span>' + (c.ajoute ? ' <small class="rp-nouveau">nouveau</small>' : '') +
        (c.type === 'multi' ? '</span>' : '</label>');
      if (!autorise(c)) {
        return '<span class="rp-lib">' + esc(c.libelle) + ' :</span><div class="rp-champ"><i class="rp-verrou">🔒 Réservé aux profils habilités (RG-15)</i><div class="tk-err" data-err="' + esc(c.code) + '"></div></div>';
      }
      let dis = ferme || (c.modifManager && !estManager());
      if (c.code === 'avoirAccorde' && rejete) { dis = true; v = false; d.champs.avoirAccorde = false; }
      if (c.code === 'montantAvoirHT' && (rejete || d.champs.avoirAccorde !== true)) { dis = true; v = null; d.champs.montantAvoirHT = null; }
      if (c.code === 'montantGesteHT' && d.champs.gesteAccorde !== true) { dis = true; v = null; d.champs.montantGesteHT = null; }
      const attr = ' id="' + id + '" data-code="' + esc(c.code) + '"' + (dis ? ' disabled' : '');
      let ctl;
      if (c.type === 'multi') {
        const coches = Array.isArray(v) ? v : [];
        ctl = '<span class="rp-multi" role="group" aria-labelledby="lab_' + id + '" id="' + id + '" data-code="' + esc(c.code) + '"' + (dis ? ' data-disabled' : '') + '>' +
          c.options.map((o) => '<label><input type="checkbox" value="' + esc(o) + '"' + (coches.indexOf(o) >= 0 ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + esc(o) + '</label>').join('') + '</span>';
      } else if (c.type === 'booleen') {
        ctl = '<select' + attr + '><option value="">—</option><option value="oui"' + (v === true ? ' selected' : '') + '>Oui</option><option value="non"' + (v === false ? ' selected' : '') + '>Non</option></select>';
      } else if (c.options) {
        ctl = '<select' + attr + '><option value="">--Sélectionner--</option>' + c.options.map((o) => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
      } else if (c.type === 'montant') {
        ctl = '<span class="rp-montant"><input type="number" step="0.01" min="0" inputmode="decimal"' + attr + ' value="' + (v === null ? '' : esc(v)) + '"' + (c.siVide !== undefined ? ' placeholder="' + c.siVide + '"' : '') + '><span class="rp-unite">€ HT</span></span>';
      } else if (c.type === 'nombre') {
        ctl = '<input type="number" step="1" min="0"' + attr + ' value="' + (v === null ? '' : esc(v)) + '">';
      } else if (c.type === 'date' || c.type === 'datetime') {
        ctl = '<input type="date"' + attr + ' value="' + isoJour(v) + '">';
      } else {
        ctl = '<input type="text" maxlength="120"' + attr + ' value="' + (v === null ? '' : esc(v)) + '">';
      }
      const aide = (AIDES_CHAMPS[c.code] || '') + (c.modifManager ? (estManager() ? ' Modification réservée aux managers.' : ' Modifiable uniquement par un manager.') : '');
      return lab + '<div class="rp-champ" data-champ="' + esc(c.code) + '">' + ctl +
        (aide ? '<div class="rp-aide">' + esc(aide.trim()) + '</div>' : '') +
        '<div class="tk-err" data-err="' + esc(c.code) + '"></div></div>';
    }).join('') + '</div>';
  }

  function lireValeur(c, el) {
    if (c.type === 'multi') return $$('input[type="checkbox"]:checked', el).map((x) => x.value);
    const v = el.value.trim();
    if (v === '') return null;
    switch (c.type) {
      case 'montant': { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }
      case 'nombre': { const n = parseInt(v, 10); return isNaN(n) ? NaN : n; }
      case 'booleen': return v === 'oui';
      case 'date': case 'datetime': return parseIso(v);
      default: return v;
    }
  }
  function lireFormulaire(ctx) {
    const d = ctx.d;
    d.etat = $('#rpEtat').value;
    d.agent = $('#rpAgent').value || null;
    d.typo = $('#rpTypo').value;
    d.sous = $('#rpSous').value;
    d.commentaire = $('#rpCom').value.trim();
    $$('#rpSpec [data-code]').forEach((el) => {
      const c = champ(el.getAttribute('data-code'));
      if (c && !el.disabled && !el.hasAttribute('data-disabled')) d.champs[c.code] = lireValeur(c, el);
    });
  }

  /* ---------- Destinataires de notification (CDC § 4.5.2) ---------- */
  function rendreNotif(ctx) {
    const { t, d, ferme } = ctx;
    const zone = $('#rpNotif');
    const libres = d.destinataires.filter((x) => x.indexOf('@') >= 0);
    zone.innerHTML = '<p class="rp-petit">(un e-mail sera envoyé aux destinataires ci-dessous à l’enregistrement)</p>' +
      (ctx.creation ? '<p><b>Notifiée à la création :</b> ' + (ctx.boite ? esc(ctx.boite) + ' (boîte fonctionnelle de la sous-typologie, RG-03)' : '<i>choisissez une sous-typologie</i>') + '</p>' : '') +
      (ctx.creation ? '' : '<p><b>Toujours notifié :</b> ' + (d.agent ? esc(d.agent) + ' (agent responsable' + (d.agent !== t.agent ? ', après enregistrement' : '') + ')' : '<i>aucun agent responsable</i>') + '</p>') +
      '<p class="rp-petit">Destinataires additionnels de ce ticket : la liste est conservée sur le ticket et modifiable à chaque mise à jour.</p>' +
      EQUIPES_ORDRE.map((eq) => {
        const membres = Object.keys(PHX.EQUIPES).filter((a) => PHX.EQUIPES[a] === eq).sort();
        const nb = membres.filter((a) => d.destinataires.indexOf(a) >= 0).length;
        const ouvert = ctx.groupesOuverts[eq] !== undefined ? ctx.groupesOuverts[eq] : nb > 0;
        return '<div class="rp-groupe"><button type="button" class="rp-groupe-tete" data-groupe="' + esc(eq) + '" aria-expanded="' + ouvert + '">' +
          (ouvert ? '▾ ' : '▸ ') + esc(eq) + (nb ? ' (' + nb + ' sélectionné' + (nb > 1 ? 's' : '') + ')' : '') + '</button>' +
          (ouvert ? '<div class="rp-groupe-corps">' + membres.map((a) => {
            const resp = a === d.agent;
            return '<label><input type="checkbox" data-dest="' + esc(a) + '"' + (resp || d.destinataires.indexOf(a) >= 0 ? ' checked' : '') + (resp || ferme ? ' disabled' : '') + '>' + esc(a) + (resp ? ' <small>(responsable)</small>' : '') + '</label>';
          }).join('') + '</div>' : '') + '</div>';
      }).join('') +
      '<div class="rp-libres"><label for="rpMail"><b>Adresses e-mail libres :</b></label> ' +
      '<input type="email" id="rpMail" placeholder="adresse@domaine.fr"' + (ferme ? ' disabled' : '') + '> <button type="button" class="nc-btn" id="rpMailAjout"' + (ferme ? ' disabled' : '') + '>Ajouter</button>' +
      '<span class="tk-err" data-err="mail"></span>' +
      (libres.length ? '<div class="rp-chips">' + libres.map((m) => '<span class="rp-chip">' + esc(m) + (ferme ? '' : '<button type="button" data-retirer="' + esc(m) + '" aria-label="Retirer ' + esc(m) + '">×</button>') + '</span>').join('') + '</div>' : '') +
      '</div>';

    zone.onclick = (e) => {
      const g = e.target.closest('[data-groupe]');
      if (g) { const k = g.getAttribute('data-groupe'); ctx.groupesOuverts[k] = g.getAttribute('aria-expanded') !== 'true'; rendreNotif(ctx); const b = $('[data-groupe="' + k + '"]', zone); if (b) b.focus(); return; }
      const r = e.target.closest('[data-retirer]');
      if (r) { d.destinataires = d.destinataires.filter((x) => x !== r.getAttribute('data-retirer')); rendreNotif(ctx); (ctx.apres || evaluer)(ctx); return; }
      if (e.target.id === 'rpMailAjout') ajouterMail(ctx);
    };
    zone.onchange = (e) => {
      const cb = e.target.closest('[data-dest]');
      if (!cb) return;
      const a = cb.getAttribute('data-dest');
      d.destinataires = cb.checked ? unique(d.destinataires.concat([a])) : d.destinataires.filter((x) => x !== a);
      rendreNotif(ctx); (ctx.apres || evaluer)(ctx);
      const n = $('[data-dest="' + a + '"]', zone); if (n) n.focus();
    };
    const mail = $('#rpMail', zone);
    if (mail) mail.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterMail(ctx); } };
  }
  function ajouterMail(ctx) {
    const champMail = $('#rpMail');
    const v = champMail.value.trim().toLowerCase();
    const err = $('[data-err="mail"]');
    if (!estEmail(v)) { err.textContent = 'Adresse e-mail invalide.'; champMail.focus(); return; }
    if (ctx.d.destinataires.indexOf(v) >= 0) { err.textContent = 'Adresse déjà présente.'; return; }
    ctx.d.destinataires.push(v);
    rendreNotif(ctx); (ctx.apres || evaluer)(ctx);
    $('#rpMail').focus();
  }

  /* ---------- Contrôles et différences avant enregistrement ---------- */
  const normeValeur = (v) => (Array.isArray(v) ? (v.length ? v.slice().sort().join('|') : null) : (v === undefined ? null : v));
  const egal = (a, b) => normeValeur(a) === normeValeur(b);
  function differences(ctx) {
    const { t, d } = ctx;
    const ch = [];
    if (!egal(t.agent, d.agent)) ch.push({ code: 'agent', avant: t.agent, apres: d.agent });
    if (d.typo !== t.typo) ch.push({ code: 'typologie', avant: libTypo(t.typo), apres: libTypo(d.typo) });
    if (d.typo !== t.typo || d.sous !== t.sous) ch.push({ code: 'sousTypologie', avant: libSous(t.typo, t.sous), apres: libSous(d.typo, d.sous) });
    if (d.sous) champsDuBrouillon(d).forEach((c) => { if (autorise(c) && !egal(t.champs[c.code], d.champs[c.code])) ch.push({ code: c.code, avant: t.champs[c.code], apres: d.champs[c.code] }); });
    const avant = t.destinataires || [];
    const ajoutes = d.destinataires.filter((x) => avant.indexOf(x) < 0), retires = avant.filter((x) => d.destinataires.indexOf(x) < 0);
    if (ajoutes.length || retires.length) ch.push({ code: 'destinataires', ajoutes, retires });
    return ch;
  }
  function valider(ctx) {
    const { t, d } = ctx;
    const err = {}, avert = [];
    if (d.etat !== t.etat && !d.commentaire) err.commentaire = 'Commentaire obligatoire pour un changement d’état.';
    if (!d.sous) err.sous = 'Choisissez une sous-typologie.';
    const c = d.champs;
    const vide = (x) => x === null || x === undefined || x === '';
    const req = {};
    if (d.sous) champsDuBrouillon(d).forEach((f) => {
      const v = c[f.code];
      if (typeof v === 'number' && isNaN(v)) err[f.code] = 'Valeur numérique invalide.';
      else if (f.type === 'montant' && typeof v === 'number' && v < 0) err[f.code] = 'Montant positif attendu.';
    });
    const exiger = (code, cond, msg) => {
      req[code] = req[code] || cond;
      if (cond && vide(c[code]) && !err[code]) {
        const f = champ(code);
        err[code] = f && f.sensible && !profil().montants ? 'Saisie réservée à un profil habilité (RG-15).' : (msg || 'Champ obligatoire');
      }
    };
    const k = d.typo + '/' + d.sous;
    const tranche = PHX.etat(d.etat).tranche;
    if (k === 'REC/FAC') {
      exiger('numFacture', true);
      exiger('avoirDemande', true);
      exiger('montantReclame', c.avoirDemande === true, 'Obligatoire quand un avoir est demandé (RG-05).');
      if (c.avoirDemande === true && c.montantReclame === 0) err.montantReclame = 'Le montant réclamé doit être supérieur à 0 (RG-05).';
      exiger('avoirAccorde', tranche, 'Obligatoire pour passer en ' + PHX.etat(d.etat).libelle + '.');
      exiger('montantAvoirHT', c.avoirAccorde === true, 'Obligatoire quand un avoir est accordé.');
      if (c.avoirAccorde === true && c.montantAvoirHT === 0) err.montantAvoirHT = 'Le montant de l’avoir doit être supérieur à 0.';
      if (c.avoirAccorde === true && c.montantAvoirHT > 0 && c.montantReclame > 0 && c.montantAvoirHT > c.montantReclame) {
        avert.push('Le montant de l’avoir (' + fmtEur.format(c.montantAvoirHT) + ') dépasse le montant réclamé (' + fmtEur.format(c.montantReclame) + ').');
      }
    }
    if (d.typo === 'REC') {
      exiger('gesteAccorde', tranche, 'Obligatoire pour passer en ' + PHX.etat(d.etat).libelle + '.');
      exiger('montantGesteHT', c.gesteAccorde === true, 'Obligatoire quand un geste co est accordé.');
      if (c.gesteAccorde === true && c.montantGesteHT === 0) err.montantGesteHT = 'Le montant du geste co doit être supérieur à 0.';
    }
    if (d.typo === 'RCV') {
      exiger('numFactureImpayee', true);
      exiger('montantHTReclame', true);
      if (d.sous === 'IMP') exiger('dateEcheance', true);
      if (d.sous === 'REJ') { exiger('motifRejet', true); exiger('dateRejet', true); }
      exiger('causeIrrecouvrable', d.etat === 'REJ', 'Obligatoire pour passer en Rejeté.');
      if (c.montantRecouvreHT > 0 && c.montantHTReclame > 0 && c.montantRecouvreHT > c.montantHTReclame) {
        avert.push('Le montant recouvré (' + fmtEur.format(c.montantRecouvreHT) + ') dépasse le montant réclamé (' + fmtEur.format(c.montantHTReclame) + ').');
      }
    }
    return { err, avert, req };
  }

  function evaluer(ctx) {
    lireFormulaire(ctx);
    const { t, d } = ctx;
    const v = valider(ctx);
    $$('#rpForm [data-req]').forEach((s) => { s.hidden = !v.req[s.getAttribute('data-req')]; });
    $$('#rpForm .tk-err[data-err]').forEach((s) => {
      const k = s.getAttribute('data-err');
      if (k === 'mail') return;
      s.textContent = ctx.tente && v.err[k] ? v.err[k] : '';
    });
    // Champs modifiés
    const diff = differences(ctx);
    const modifies = {};
    diff.forEach((x) => { modifies[x.code === 'typologie' ? 'typo' : x.code === 'sousTypologie' ? 'sous' : x.code] = true; });
    if (d.etat !== t.etat) modifies.etat = true;
    $$('#rpForm .rp-champ[data-champ]').forEach((z) => z.classList.toggle('rp-modifie', !!modifies[z.getAttribute('data-champ')]));
    const libs = [];
    if (modifies.etat) libs.push('État');
    diff.forEach((x) => { const c = champ(x.code); libs.push(c ? c.libelle : (LIB_CHANGEMENT[x.code] || x.code)); });
    if (d.commentaire) libs.push('Commentaire');
    const resume = $('#rpResume');
    const nbErr = Object.keys(v.err).length;
    if (ctx.tente && nbErr) { resume.className = 'rp-resume err'; resume.textContent = 'Corrigez ' + (nbErr > 1 ? 'les ' + nbErr + ' champs signalés' : 'le champ signalé') + ' avant d’enregistrer.'; }
    else if (libs.length) { resume.className = 'rp-resume'; resume.textContent = 'Modifications non enregistrées : ' + unique(libs).join(', ') + '.'; }
    else { resume.className = 'rp-resume'; resume.textContent = ''; }
    return { v, diff };
  }

  function enregistrer(ctx) {
    ctx.tente = true;
    const { v, diff } = evaluer(ctx);
    const { t, d } = ctx;
    if (Object.keys(v.err).length) {
      const premier = $('#rpForm .tk-err:not(:empty)');
      if (premier) { const z = premier.closest('.rp-champ, .rp-commentaire'); const ctl = z && $('input, select, textarea', z); (ctl || premier).focus(); premier.scrollIntoView({ block: 'center' }); }
      return;
    }
    if (!diff.length && d.etat === t.etat && !d.commentaire) { toast('Aucune modification à enregistrer.'); return; }
    if (v.avert.length) {
      ouvrirModal({
        titre: 'Confirmer l’enregistrement',
        corps: '<p>' + v.avert.map(esc).join('<br>') + '</p><p>Voulez-vous enregistrer quand même ?</p>',
        pied: '<span class="flex"></span><button type="button" class="nc-btn" data-fermer>Revenir au ticket</button><button type="button" class="nc-btn nc-btn-orange" id="rpConfirmer">Enregistrer</button>',
        petit: true, focus: '#rpConfirmer'
      });
      $('#rpConfirmer').addEventListener('click', () => { fermerModal(); appliquer(ctx, diff); });
      return;
    }
    appliquer(ctx, diff);
  }

  function appliquer(ctx, diff) {
    const { t, d } = ctx;
    const maintenant = Date.now();
    const etatAvant = t.etat;
    t.agent = d.agent; t.typo = d.typo; t.sous = d.sous;
    t.champs = Object.assign({}, t.champs, d.champs);
    t.destinataires = d.destinataires.slice();
    if (d.etat !== etatAvant) {
      t.etat = d.etat;
      if (d.etat === 'RES' || d.etat === 'REJ') { t.dateResolution = maintenant; t.decision = d.etat; t.dateFermeture = null; }
      else if (d.etat === 'FER') t.dateFermeture = maintenant;
      else if (PHX.etat(etatAvant).tranche && d.etat === 'OUV') { t.dateResolution = null; t.decision = null; }
    }
    const notifies = unique([t.agent].concat(t.destinataires));
    t.historique.push({ type: 'maj', saisie: true, date: maintenant, auteur: moi(), etatAvant, etatApres: t.etat, changements: diff, commentaire: d.commentaire, notifies });
    t.dateMaj = maintenant;
    if (d.commentaire) t.dernierCommentaire = d.commentaire;
    store.tickets[t.id] = instantane(t);
    sauver();
    pageTicket(t.id);
    const evs = $$('.rp-ev');
    const dernier = evs[evs.length - 1];
    if (dernier) { dernier.classList.add('rp-ev-flash'); dernier.scrollIntoView({ block: 'center' }); }
    toast('Ticket n° ' + t.id + ' enregistré. ' + (notifies.length ? 'E-mail envoyé à : ' + notifies.join(', ') + ' (simulation).' : 'Aucun destinataire à notifier.'));
  }

  function ouvrirRegles() {
    const lignes = PHX.ETATS.map((e) => '<tr><td>' + badgeEtat(e.code) + '</td><td>' +
      (PHX.TRANSITIONS[e.code].length ? PHX.TRANSITIONS[e.code].map(badgeEtat).join(' ') : '<i>aucun : lecture seule</i>') + '</td></tr>').join('');
    ouvrirModal({
      titre: 'Règles du workflow (proposition à valider)',
      corps: '<div class="st-wrap"><table class="nc-grille rp-regles"><thead><tr><th>Depuis</th><th>Vers</th></tr></thead><tbody>' + lignes + '</tbody></table></div>' +
        '<ul class="rp-regles-liste">' +
        '<li>Un ticket doit avoir un agent responsable pour changer d’état (RG-07).</li>' +
        '<li>Tout changement d’état demande un commentaire.</li>' +
        '<li>Seul un manager fait sortir un ticket de « Attente arbitrage ».</li>' +
        '<li>Résolu ou Rejeté renseigne la date de résolution. Une réouverture (retour à Ouvert) l’efface ; l’historique garde la trace.</li>' +
        '<li>Réclamation › Facturation : « Avoir accordé » est obligatoire pour passer en Résolu ou Rejeté ; Rejeté impose « Non ».</li>' +
        '<li>Recouvrement : « Cause irrécouvrable » (compte clos, facture indue, liquidation judiciaire) est obligatoire pour passer en Rejeté ; le reste dû est alors compté irrécouvrable.</li>' +
        '<li>Réclamation › SAV et Déploiement : les « Services impactés » se saisissent à la création du ticket ; ensuite, seul un manager peut les modifier.</li>' +
        '<li>Toutes les réclamations : « Geste co accordé » est obligatoire pour passer en Résolu ou Rejeté, avec son montant si Oui. Un geste co reste possible sur une réclamation rejetée et s’ajoute à un éventuel avoir.</li>' +
        '<li>Typologie et sous-typologie : modifiables par un manager tant que le ticket n’est pas fermé, avec historique (RG-14).</li>' +
        '<li>Fermé est définitif : le ticket passe en lecture seule.</li>' +
        '<li>Chaque enregistrement notifie l’agent responsable et les destinataires additionnels du ticket (RG-09, RG-10), et s’inscrit dans l’historique.</li>' +
        '</ul>',
      pied: '<span class="flex"></span><button type="button" class="nc-btn" data-fermer>Fermer</button>'
    });
  }

  /* ---------- Conservation des mises à jour faites pendant la démo ---------- */
  function instantane(t) {
    return {
      etat: t.etat, agent: t.agent, typo: t.typo, sous: t.sous, dateMaj: t.dateMaj, dateResolution: t.dateResolution,
      dateFermeture: t.dateFermeture, decision: t.decision, dernierCommentaire: t.dernierCommentaire,
      champs: t.champs, destinataires: t.destinataires, ajouts: t.historique.filter((e) => e.saisie)
    };
  }
  function appliquerMisesAJour() {
    Object.keys(store.tickets).forEach((id) => {
      const t = PAR_ID[id], s = store.tickets[id];
      if (!t || !s || !PHX.etat(s.etat) || !PHX.sousTypo(s.typo, s.sous)) return;
      ['etat', 'agent', 'typo', 'sous', 'dateMaj', 'dateResolution', 'dateFermeture', 'decision', 'dernierCommentaire'].forEach((k) => { if (k in s) t[k] = s[k]; });
      if (s.champs && typeof s.champs === 'object') t.champs = Object.assign({}, t.champs, s.champs);
      if (Array.isArray(s.destinataires)) t.destinataires = s.destinataires.filter((x) => typeof x === 'string');
      if (Array.isArray(s.ajouts)) t.historique = t.historique.concat(s.ajouts.filter((e) => e && e.type === 'maj'));
    });
  }

  /* =====================================================================
   * Écran 5 – Demandes de modification (modèle « Demandes Clients » Netcom)
   *   #/demandes/nouvelle?ticket=<n°> : en-tête partenaire + ticket,
   *   un formulaire par type de demande (accordéon), puis la liste filtrable.
   * ===================================================================== */
  const badgeDM = (code) => { const s = PHX.statutDM(code); return '<span class="etat sdm-' + esc(code) + '">' + esc(s ? s.libelle : code) + '</span>'; };
  const libTypeDM = (code) => (PHX.typeDM(code) || {}).court || code;
  const dmClose = (dm) => !!(PHX.statutDM(dm.statut) || {}).clos;
  const typeAccessible = (T) => !T.montants || profil().montants;
  const ICONE_COM = 'assets/img/nav_doc_vide_16.gif';
  const TOUS_AGENTS = Object.keys(PHX.EQUIPES).sort();

  function valeurDM(f, v) {
    if (v === null || v === undefined || v === '') return '—';
    if (f.sensible && !profil().montants) return '🔒';
    switch (f.type) {
      case 'montant': return esc(fmtEur.format(v)) + ' HT';
      case 'pourcentage': return esc(fmtNb.format(v)) + ' %';
      case 'case': return v ? 'Oui' : 'Non';
      case 'date': return fDate(v);
      case 'nombre': return esc(v) + (f.unite ? ' ' + esc(f.unite) : '');
      default: return esc(v);
    }
  }
  const libDateDM = (T) => T.libelleDate || 'Date souhaitée de prise d’effet';
  const journalTexte = (dm) => dm.journal.map((j) => fDateHeure(j.date) + ' -- ' + j.auteur + ' -- ' +
    (j.statutAvant ? PHX.statutDM(j.statutAvant).libelle + ' → ' : '') + PHX.statutDM(j.statutApres).libelle + ' : ' + j.commentaire).join('\n');

  /* ---------- Page « Nouvelle demande » depuis un ticket ---------- */
  let ctxDM = { cle: null };

  function pageNouvelleDemande(params) {
    const id = +params.get('ticket');
    const t = PAR_ID[id];
    ariane(arianeListe().concat([{ lib: 'Ticket n° ' + id, href: '#/ticket/' + id }, { lib: 'Demandes de modification' }]));
    if (!t) {
      page.innerHTML = titre('Demandes de modification') + '<div class="nc-vide-grille">Le ticket n° ' + esc(id || '?') + ' n’existe pas.<br><a class="nc-btn" href="#/tickets">Retour à la liste des tickets</a></div>';
      return;
    }
    if (ctxDM.cle !== 'ticket:' + id) ctxDM = { cle: 'ticket:' + id, ouvert: null, prerempli: null, liste: { f: Object.assign({}, FILTRES_DM, { part: t.partenaireCode }), tri: { col: 'dateCreation', sens: -1 }, page: 1, surligne: null } };
    const ferme = t.etat === 'FER';
    page.innerHTML = titre('Demandes de modification', '<a class="nc-btn" href="#/ticket/' + t.id + '">Retour au ticket</a>') +
      '<div class="dm-entete">' +
      '<label for="dmCode">Code partenaire :</label><div><input id="dmCode" class="dm-ro" value="' + esc(t.partenaireCode) + '" disabled> <a href="' + lienPartenaire(t.partenaireCode) + '">' + esc(t.partenaireRS) + '</a></div>' +
      '<label for="dmTicket">Numéro de ticket :</label><div><input id="dmTicket" class="dm-ro" value="' + t.id + '" disabled> <a href="#/ticket/' + t.id + '">' + esc(libTypo(t.typo) + ' › ' + libSous(t.typo, t.sous)) + '</a> ' + badgeEtat(t.etat) + '</div>' +
      '</div>' +
      repriseTicket(t) +
      (ferme ? '<p class="nc-note nc-note-verrou">Ticket fermé : aucune nouvelle demande ne peut lui être rattachée.</p>' : '') +
      '<div class="dm-accordeon" id="dmAcc">' + PHX.TYPES_DM.map((T) =>
        '<section class="dm-acc" data-type="' + T.code + '"><h3 class="dm-acc-h"><button type="button" class="dm-acc-tete" id="dmb_' + T.code + '" aria-expanded="false" aria-controls="dmf_' + T.code + '"' + (ferme ? ' disabled' : '') + '>' +
        '<span>' + esc(T.libelle) + (typeAccessible(T) ? '' : ' <small>🔒 profils habilités</small>') + '</span><span class="dm-signe" aria-hidden="true">+</span></button></h3>' +
        '<div class="dm-acc-corps" id="dmf_' + T.code + '" role="region" aria-labelledby="dmb_' + T.code + '" hidden></div></section>').join('') + '</div>' +
      '<h4 class="dm-titre-liste">Demandes de modification</h4><div id="dmListe"></div>';

    $('#dmAcc').addEventListener('click', (e) => {
      const b = e.target.closest('.dm-acc-tete');
      if (b) { const code = b.closest('.dm-acc').getAttribute('data-type'); basculerType(t, ctxDM.ouvert === code ? null : code); return; }
      if (e.target.closest('[data-annuler]')) { basculerType(t, null); return; }
      if (e.target.closest('[data-ajouter]')) ajouterDemande(t, e.target.closest('.dm-acc').getAttribute('data-type'));
    });
    const rep = $('#dmReprise');
    if (rep) rep.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reprise]');
      if (!b) return;
      const c = t.champs, geste = b.getAttribute('data-reprise') === 'geste';
      ctxDM.prerempli = {
        montant: geste ? c.montantGesteHT : c.montantAvoirHT, geste: geste,
        factures: c.numFacture || '',
        commentaire: geste ? 'Émettre l’avoir correspondant au geste commercial accordé sur le ticket n° ' + t.id + '.' : 'Émettre l’avoir accordé sur le ticket n° ' + t.id + (c.numFacture ? ' (facture ' + c.numFacture + ').' : '.')
      };
      basculerType(t, 'AVO');
    });
    if (ctxDM.ouvert && !ferme) basculerType(t, ctxDM.ouvert, true);
    rendreListeDM($('#dmListe'), ctxDM.liste);
  }

  // Encadré : avoir / geste co accordés sur le ticket, et demandes déjà rattachées
  function repriseTicket(t) {
    const c = t.champs, m = profil().montants;
    const items = [];
    if (t.typo === 'REC' && c.avoirAccorde === true) items.push('Avoir accordé : <b>' + (m ? esc(fmtEur.format(c.montantAvoirHT || 0)) + ' HT' : '🔒') + '</b>' + (c.numFacture ? ' (facture ' + esc(c.numFacture) + ')' : '') +
      (m && t.etat !== 'FER' ? ' <button type="button" class="nc-btn" data-reprise="avoir">Préparer la demande d’avoir</button>' : ''));
    if (t.typo === 'REC' && c.gesteAccorde === true) items.push('Geste co accordé : <b>' + (m ? esc(fmtEur.format(c.montantGesteHT || 0)) + ' HT' : '🔒') + '</b>' +
      (m && t.etat !== 'FER' ? ' <button type="button" class="nc-btn" data-reprise="geste">Préparer la demande d’avoir (geste co)</button>' : ''));
    const existantes = DEMANDES.filter((d) => d.ticketId === t.id);
    if (existantes.length) items.push('Déjà rattachées à ce ticket : ' + existantes.map((d) => '<a href="#" data-dm="' + d.id + '">n° ' + d.id + '</a> (' + esc(libTypeDM(d.type)) + ', ' + esc(PHX.statutDM(d.statut).libelle.toLowerCase()) + ')').join(', '));
    if (!items.length) return '';
    return '<div class="nc-note dm-reprise" id="dmReprise"><b>Éléments du ticket</b><ul>' + items.map((x) => '<li>' + x + '</li>').join('') + '</ul></div>';
  }

  function basculerType(t, code, sansFocus) {
    $$('#dmAcc .dm-acc').forEach((s) => {
      const c = s.getAttribute('data-type'), corps = $('.dm-acc-corps', s), b = $('.dm-acc-tete', s);
      const ouvert = c === code;
      b.setAttribute('aria-expanded', String(ouvert));
      $('.dm-signe', b).textContent = ouvert ? '–' : '+';
      corps.hidden = !ouvert;
      corps.innerHTML = ouvert ? formulaireDM(PHX.typeDM(c), t) : '';
    });
    ctxDM.ouvert = code;
    if (code !== 'AVO') ctxDM.prerempli = null;
    if (code && !sansFocus) {
      const premier = $('#dmf_' + code + ' input:not([disabled]), #dmf_' + code + ' select, #dmf_' + code + ' textarea');
      if (premier) premier.focus();
    }
  }

  function controleDM(f, valeur, prefixe) {
    const id = prefixe + f.code;
    const attr = ' id="' + id + '" data-champ-dm="' + esc(f.code) + '"';
    const v = valeur === undefined || valeur === null ? '' : valeur;
    switch (f.type) {
      case 'fige': return '<b class="dm-fige" id="' + id + '">' + esc(v) + '</b>';
      case 'liste': return '<select' + attr + '><option value="">--Sélectionner--</option>' + f.options.map((o) => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
      case 'agent': return '<select' + attr + '>' + TOUS_AGENTS.map((a) => '<option value="' + esc(a) + '"' + (a === v ? ' selected' : '') + '>' + esc(a) + ' (' + esc(PHX.EQUIPES[a]) + ')</option>').join('') + '</select>';
      case 'nombre': return '<span class="rp-montant"><input type="number" min="0" step="1"' + attr + ' value="' + esc(v) + '">' + (f.unite ? '<span class="rp-unite">' + esc(f.unite) + '</span>' : '') + '</span>';
      case 'montant': return '<span class="rp-montant"><input type="number" min="0" step="0.01" inputmode="decimal"' + attr + ' value="' + esc(v) + '"><span class="rp-unite">€ HT</span></span>';
      case 'pourcentage': return '<span class="rp-montant"><input type="number" min="0" max="100" step="0.1"' + attr + ' value="' + esc(v) + '"><span class="rp-unite">%</span></span>';
      case 'case': return '<input type="checkbox" class="dm-case"' + attr + (v ? ' checked' : '') + '>';
      case 'date': return '<input type="date"' + attr + ' value="' + (v ? isoJour(v) : '') + '">';
      case 'zone': return '<textarea rows="3"' + attr + '>' + esc(v) + '</textarea>';
      default: return '<input type="text" maxlength="150"' + attr + ' value="' + esc(v) + '">';
    }
  }

  function formulaireDM(T, t) {
    if (!typeAccessible(T)) return '<p class="nc-note nc-note-verrou">Ce type de demande comporte des montants : il est réservé aux profils habilités (RG-15).</p>';
    const p = (T.code === 'AVO' && ctxDM.prerempli) || {};
    const defauts = {
      service: t.typo === 'DEP' && T.champs.some((f) => f.code === 'service' && f.options.indexOf(t.sous) >= 0) ? t.sous : '',
      factures: t.champs.numFacture || '', objet: PHX.objetDM(T.code, t.id), demandeur: moi()
    };
    const val = (code) => (p[code] !== undefined ? p[code] : defauts[code]);
    const ligne = (f, large) => {
      const req = f.obligatoire || (f.code === 'dateEffet' && T.dateObligatoire);
      const lib = f.code === 'dateEffet' ? libDateDM(T) : f.libelle;
      const id = 'dmc_' + f.code;
      if (f.type === 'fige') return '<span class="rp-lib">' + esc(lib) + ' :</span><div class="rp-champ">' + controleDM(f, val(f.code), 'dmc_') + '<div class="rp-aide">' + esc(f.aide) + '</div></div>';
      return '<label for="' + id + '">' + esc(lib) + (req ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
        '<div class="rp-champ' + (large ? ' dm-large' : '') + '">' + controleDM(f, val(f.code), 'dmc_') +
        (f.aide ? '<div class="rp-aide">' + esc(f.aide) + '</div>' : '') + '<div class="tk-err" data-err-dm="' + esc(f.code) + '"></div></div>';
    };
    const communs = PHX.CHAMPS_COMMUNS_DM;
    return (ctxDM.prerempli && T.code === 'AVO' ? '<p class="rp-aide dm-prerempli">Prérempli à partir du ticket n° ' + t.id + ' : vérifiez avant d’ajouter.</p>' : '') +
      '<div class="dm-grille">' +
      T.champs.map((f) => ligne(f)).join('') +
      '<div class="rp-sec">Informations de la demande</div>' +
      communs.filter((f) => f.type !== 'zone').map((f) => ligne(f)).join('') +
      communs.filter((f) => f.type === 'zone').map((f) => ligne(f, true)).join('') +
      '</div><div class="dm-actions"><span class="tk-err" data-err-dm="_regle"></span>' +
      '<button type="button" class="nc-btn" data-annuler>Annuler</button><button type="button" class="nc-btn nc-btn-orange" data-ajouter>Ajouter</button></div>';
  }

  function lireValeurDM(f, el) {
    if (f.type === 'case') return el.checked;
    const v = el.value.trim();
    if (v === '') return null;
    if (f.type === 'montant' || f.type === 'pourcentage') { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }
    if (f.type === 'nombre') { const n = parseInt(v, 10); return isNaN(n) ? NaN : n; }
    if (f.type === 'date') return parseIso(v);
    return v;
  }

  function ajouterDemande(t, code) {
    const T = PHX.typeDM(code);
    const zone = $('#dmf_' + code);
    const tous = T.champs.concat(PHX.CHAMPS_COMMUNS_DM.filter((f) => f.type !== 'fige'));
    const v = {}, err = {};
    tous.forEach((f) => { const el = $('#dmc_' + f.code, zone); if (el) v[f.code] = lireValeurDM(f, el); });
    tous.forEach((f) => {
      const x = v[f.code];
      const req = f.obligatoire || (f.code === 'dateEffet' && T.dateObligatoire);
      if (typeof x === 'number' && isNaN(x)) err[f.code] = 'Valeur numérique invalide.';
      else if (req && (x === null || x === '' || (f.type === 'montant' && x === 0))) err[f.code] = f.type === 'montant' && x === 0 ? 'Le montant doit être supérieur à 0.' : 'Champ obligatoire';
      else if (f.type === 'pourcentage' && typeof x === 'number' && (x < 0 || x > 100)) err[f.code] = 'Pourcentage entre 0 et 100.';
      else if (f.type === 'montant' && typeof x === 'number' && x < 0) err[f.code] = 'Montant positif attendu.';
    });
    if (T.regle === 'montantOuPourcentage' && !(v.montant > 0) && !(v.pourcentage > 0) && !err.montant && !err.pourcentage) err._regle = 'Renseignez un montant ou un pourcentage.';
    $$('[data-err-dm]', zone).forEach((s) => { s.textContent = err[s.getAttribute('data-err-dm')] || ''; });
    if (Object.keys(err).length) {
      const k = Object.keys(err)[0];
      const el = $('#dmc_' + k, zone) || $('[data-ajouter]', zone);
      el.focus();
      return;
    }
    const maintenant = Date.now();
    const champs = {};
    T.champs.forEach((f) => { champs[f.code] = v[f.code]; });
    const dm = {
      id: DEMANDES.reduce((m, d) => Math.max(m, d.id), 12040) + 1,
      ticketId: t.id, partenaireCode: t.partenaireCode, partenaireRS: t.partenaireRS, type: T.code,
      objet: PHX.objetDM(T.code, t.id), perimetre: v.perimetre || '', dateEffet: v.dateEffet, demandeur: moi(), creePar: moi(),
      commentaire: v.commentaire, champs: champs,
      statut: 'ATT', dateCreation: maintenant, dateMaj: maintenant, dateCloture: null, cloturePar: null, saisie: true,
      journal: [{ date: maintenant, auteur: moi(), statutApres: 'ATT', commentaire: 'Création de la demande.', notifies: [moi()] }]
    };
    DEMANDES.push(dm);
    const notifies = unique([t.agent].concat(t.destinataires || []));
    t.historique.push({ type: 'maj', saisie: true, date: maintenant, auteur: moi(), etatAvant: t.etat, etatApres: t.etat,
      changements: [{ code: 'demande', id: dm.id, typeDM: T.code, objet: dm.objet }], commentaire: 'Demande de modification n° ' + dm.id + ' créée.', notifies });
    t.dateMaj = maintenant;
    t.dernierCommentaire = 'Demande de modification n° ' + dm.id + ' créée.';
    t.nbDM = DEMANDES.filter((d) => d.ticketId === t.id).length;
    store.tickets[t.id] = instantane(t);
    store.demandes[dm.id] = dm;
    sauver();
    ctxDM.ouvert = null; ctxDM.prerempli = null;
    ctxDM.liste.surligne = dm.id; ctxDM.liste.page = 1;
    pageNouvelleDemande(new URLSearchParams('ticket=' + t.id));
    const ligneNouvelle = $('#dmListe tr.dm-surligne');
    if (ligneNouvelle) ligneNouvelle.scrollIntoView({ block: 'center' });
    toast('Demande n° ' + dm.id + ' créée et rattachée au ticket n° ' + t.id + '. ' + (notifies.length ? 'E-mail envoyé à : ' + notifies.join(', ') + ' (simulation).' : ''));
  }

  /* ---------- Liste des demandes (filtres + grille), réutilisable ---------- */
  const FILTRES_DM = { part: '', rs: '', ticket: '', demandeur: '', statut: '', type: '', service: '', creApres: '', creAvant: '', modApres: '', modAvant: '' };
  const COLONNES_DM = [
    { code: 'id', libelle: 'N°', v: (d) => d.id },
    { code: 'ticketId', libelle: 'Ticket', v: (d) => d.ticketId },
    { code: 'partenaireCode', libelle: 'Code partenaire', v: (d) => d.partenaireCode },
    { code: 'partenaireRS', libelle: 'Partenaire', v: (d) => d.partenaireRS },
    { code: 'type', libelle: 'Demande', v: (d) => libTypeDM(d.type) },
    { code: 'service', libelle: 'Service', v: (d) => d.champs.service || '' },
    { code: 'objet', libelle: 'Objet', v: (d) => d.objet },
    { code: 'montant', libelle: 'Montant HT', v: (d) => (typeof d.champs.montant === 'number' ? d.champs.montant : null), sensible: true },
    { code: 'dateCreation', libelle: 'Date de création', v: (d) => d.dateCreation },
    { code: 'dateMaj', libelle: 'Dernière modif', v: (d) => d.dateMaj },
    { code: 'demandeur', libelle: 'Demandeur', v: (d) => d.demandeur },
    { code: 'statut', libelle: 'État', v: (d) => PHX.STATUTS_DM.indexOf(PHX.statutDM(d.statut)) },
    { code: 'dateCloture', libelle: 'Clôturée le', v: (d) => d.dateCloture }
  ];

  function filtrerDM(f, partFixe) {
    const n = (s) => norm(s).trim();
    const ca = parseIso(f.creApres), cb = parseIso(f.creAvant, true), ma = parseIso(f.modApres), mb = parseIso(f.modAvant, true);
    return DEMANDES.filter((d) => {
      if (partFixe && d.partenaireCode !== partFixe) return false;
      if (f.part && n(d.partenaireCode).indexOf(n(f.part)) < 0) return false;
      if (f.rs && n(d.partenaireRS).indexOf(n(f.rs)) < 0) return false;
      if (f.ticket && String(d.ticketId).indexOf(f.ticket.trim()) < 0) return false;
      if (f.demandeur && d.demandeur !== f.demandeur) return false;
      if (f.statut === 'ENCOURS') { if (dmClose(d)) return false; } else if (f.statut && d.statut !== f.statut) return false;
      if (f.type && d.type !== f.type) return false;
      if (f.service && d.champs.service !== f.service) return false;
      if (ca && d.dateCreation < ca) return false;
      if (cb && d.dateCreation > cb) return false;
      if (ma && d.dateMaj < ma) return false;
      if (mb && d.dateMaj > mb) return false;
      return true;
    });
  }

  function rendreListeDM(zone, etat) {
    const f = etat.f;
    const sel = (id, opts, v) => '<select id="' + id + '"><option value="">-- Tous --</option>' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    const services = unique(PHX.TYPES_DM.reduce((a, T) => a.concat((T.champs.find((x) => x.code === 'service') || { options: [] }).options), []));
    zone.innerHTML = '<div class="dm-filtres" role="search" aria-label="Filtres des demandes">' +
      '<span class="dm-filtres-titre">Filtres :</span>' +
      (etat.partFixe ? '' : '<label for="dfPart">Code partenaire :</label><input type="text" id="dfPart" value="' + esc(f.part) + '">' +
      '<label for="dfRs">Raison sociale :</label><input type="text" id="dfRs" value="' + esc(f.rs) + '">') +
      '<label for="dfTicket">N° ticket :</label><input type="text" id="dfTicket" inputmode="numeric" value="' + esc(f.ticket) + '">' +
      '<label for="dfDemandeur">Demandeur :</label>' + sel('dfDemandeur', TOUS_AGENTS.map((a) => [a, a]), f.demandeur) +
      '<label for="dfStatut">État :</label>' + sel('dfStatut', [['ENCOURS', 'En cours (En attente, Validée)']].concat(PHX.STATUTS_DM.map((s) => [s.code, s.libelle])), f.statut) +
      '<label for="dfType">Demande :</label>' + sel('dfType', PHX.TYPES_DM.map((T) => [T.code, T.court]), f.type) +
      '<label for="dfService">Service :</label>' + sel('dfService', services.map((s) => [s, s]), f.service) +
      '<span></span><span></span>' +
      '<span class="dm-filtres-sous">Création</span>' +
      '<label for="dfCreApres">Après le :</label><input type="date" id="dfCreApres" value="' + esc(f.creApres) + '">' +
      '<label for="dfCreAvant">Avant le :</label><input type="date" id="dfCreAvant" value="' + esc(f.creAvant) + '">' +
      '<span class="dm-filtres-sous">Modification</span>' +
      '<label for="dfModApres">Après le :</label><input type="date" id="dfModApres" value="' + esc(f.modApres) + '">' +
      '<label for="dfModAvant">Avant le :</label><input type="date" id="dfModAvant" value="' + esc(f.modAvant) + '">' +
      '<div class="dm-filtres-actions">' + (etat.impression ? '<button type="button" class="nc-btn" id="dfImpression">Impression</button>' : '') +
      '<button type="button" class="nc-btn" id="dfRaz">Réinitialiser</button><button type="button" class="nc-btn" id="dfChercher">Rechercher</button></div>' +
      '</div>' +
      '<div class="nc-outils"><span class="nc-compte" id="dmCompte" aria-live="polite"></span><span class="nc-droite"><button type="button" class="nc-btn nc-btn-orange" id="dmCsv">Exporter .csv</button></span></div>' +
      '<div class="nc-grille-wrap dm-gv-wrap" id="dmGrille"></div><div class="nc-pager" id="dmPager"></div>';

    const lire = () => {
      f.part = $('#dfPart') ? $('#dfPart').value : ''; f.rs = $('#dfRs') ? $('#dfRs').value : ''; f.ticket = $('#dfTicket').value.replace(/\D/g, '');
      f.demandeur = $('#dfDemandeur').value; f.statut = $('#dfStatut').value; f.type = $('#dfType').value; f.service = $('#dfService').value;
      f.creApres = $('#dfCreApres').value; f.creAvant = $('#dfCreAvant').value; f.modApres = $('#dfModApres').value; f.modAvant = $('#dfModAvant').value;
      etat.page = 1; etat.surligne = null;
      grilleDM(etat);
    };
    let minuteur = null;
    $$('.dm-filtres select, .dm-filtres input[type="date"]', zone).forEach((el) => el.addEventListener('change', lire));
    $$('.dm-filtres input[type="text"]', zone).forEach((el) => {
      el.addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(lire, 250); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(minuteur); lire(); } });
    });
    $('#dfChercher').addEventListener('click', lire);
    $('#dfRaz').addEventListener('click', () => { Object.assign(f, etat.defauts || FILTRES_DM); etat.page = 1; rendreListeDM(zone, etat); });
    if (etat.impression) $('#dfImpression').addEventListener('click', () => { try { window.print(); } catch (err) { toast('L’impression n’est pas disponible dans cette vue.'); } });
    $('#dmCsv').addEventListener('click', () => exporterDM(etat));
    $('#dmGrille').addEventListener('click', (e) => {
      // Ticket ouvert depuis une liste de demandes : « Retour à la liste » revient ici
      if (e.target.closest('a[href^="#/ticket/"]')) { liste.hashListe = location.hash; liste.ordre = []; liste.pageMemo = 1; return; }
      const th = e.target.closest('th[data-col]');
      if (th) {
        const c = th.getAttribute('data-col');
        etat.tri = etat.tri.col === c ? { col: c, sens: -etat.tri.sens } : { col: c, sens: ['id', 'ticketId', 'montant', 'dateCreation', 'dateMaj', 'dateCloture'].indexOf(c) >= 0 ? -1 : 1 };
        etat.page = 1; grilleDM(etat);
        const n = $('#dmGrille th[data-col="' + c + '"]'); if (n) n.focus();
      }
    });
    $('#dmGrille').addEventListener('keydown', (e) => {
      const th = e.target.closest('th[data-col]');
      if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); th.click(); }
    });
    $('#dmPager').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-page]');
      if (b && !b.disabled) { etat.page = +b.getAttribute('data-page'); grilleDM(etat); }
    });
    grilleDM(etat);
  }

  function trierDM(liste, tri) {
    const col = COLONNES_DM.find((c) => c.code === tri.col) || COLONNES_DM[8];
    const cle = (d) => { const v = col.v(d); return typeof v === 'string' ? norm(v) : v; };
    return liste.slice().sort((a, b) => {
      const va = cle(a), vb = cle(b);
      if ((va === null || va === '') && (vb === null || vb === '')) return b.id - a.id;
      if (va === null || va === '') return 1;
      if (vb === null || vb === '') return -1;
      return ((va < vb ? -1 : va > vb ? 1 : 0) * tri.sens) || (b.id - a.id);
    });
  }

  function grilleDM(etat) {
    const res = etat.resultat = trierDM(filtrerDM(etat.f, etat.partFixe), etat.tri);
    const taille = etat.taille || 20;
    const nbPages = Math.max(1, Math.ceil(res.length / taille));
    if (etat.page > nbPages) etat.page = nbPages;
    const vue = res.slice((etat.page - 1) * taille, etat.page * taille);
    const total = etat.partFixe ? DEMANDES.filter((d) => d.partenaireCode === etat.partFixe).length + ' du partenaire' : DEMANDES.length;
    $('#dmCompte').innerHTML = '<b>' + res.length + '</b> ' + (res.length > 1 ? 'demandes' : 'demande') + ' sur ' + total;
    const m = profil().montants;
    const cols = COLONNES_DM.filter((c) => !(etat.partFixe && (c.code === 'partenaireCode' || c.code === 'partenaireRS')));
    const cellule = {
      id: (d) => '<td>' + d.id + '</td>',
      ticketId: (d) => '<td><a href="#/ticket/' + d.ticketId + '">' + d.ticketId + '</a></td>',
      partenaireCode: (d) => '<td><a href="' + lienPartenaire(d.partenaireCode) + '" title="Ouvrir la fiche partenaire (onglet Gestion)">' + esc(d.partenaireCode) + '</a></td>',
      partenaireRS: (d) => '<td>' + esc(d.partenaireRS) + '</td>',
      type: (d) => '<td>' + esc(libTypeDM(d.type)) + '</td>',
      service: (d) => '<td>' + esc(d.champs.service || '') + '</td>',
      objet: (d) => '<td class="objet">' + esc(d.objet) + '</td>',
      montant: (d) => '<td class="num">' + (typeof d.champs.montant === 'number' ? (m ? esc(fmtEur.format(d.champs.montant)) : '🔒') : '') + '</td>',
      dateCreation: (d) => '<td>' + fDateHeure(d.dateCreation) + '</td>',
      dateMaj: (d) => '<td>' + fDateHeure(d.dateMaj) + '</td>',
      demandeur: (d) => '<td>' + esc(d.demandeur) + '</td>',
      statut: (d) => '<td>' + badgeDM(d.statut) + '</td>',
      dateCloture: (d) => '<td>' + (d.dateCloture ? fDate(d.dateCloture) : '') + '</td>'
    };
    const entetes = '<th scope="col" class="col-ouvrir"><span class="sr-only">Détails</span></th>' + cols.map((c) => {
      const actif = etat.tri.col === c.code;
      return '<th scope="col" tabindex="0" data-col="' + c.code + '" aria-sort="' + (actif ? (etat.tri.sens > 0 ? 'ascending' : 'descending') : 'none') + '">' + esc(c.libelle) +
        '<span class="tri" aria-hidden="true">' + (actif ? (etat.tri.sens > 0 ? '▲' : '▼') : '') + '</span></th>';
    }).join('') + '<th scope="col">Com.</th>';
    const corps = vue.map((d) => '<tr' + (d.id === etat.surligne ? ' class="dm-surligne"' : '') + '>' +
      '<td class="col-ouvrir"><button type="button" class="pd-details" data-dm="' + d.id + '" aria-label="Détails de la demande n° ' + d.id + '">Details</button></td>' +
      cols.map((c) => cellule[c.code](d)).join('') +
      '<td class="dm-com"><img src="' + ICONE_COM + '" alt="Journal" title="' + esc(journalTexte(d)) + '" width="14" height="16"></td></tr>').join('');
    $('#dmGrille').innerHTML = res.length
      ? '<table class="nc-grille dm-gv"><caption class="sr-only">Demandes de modification</caption><thead><tr>' + entetes + '</tr></thead><tbody>' + corps + '</tbody></table>'
      : '<div class="nc-vide-grille">Aucune demande ne correspond à ces filtres.</div>';
    let pg = '';
    if (nbPages > 1) {
      for (let i = 1; i <= nbPages; i++) pg += '<button type="button" data-page="' + i + '"' + (i === etat.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
      pg += '<span class="info">Page ' + etat.page + ' / ' + nbPages + '</span>';
    }
    $('#dmPager').innerHTML = pg;
    if (etat.apres) etat.apres();
  }

  function exporterDM(etat) {
    const rows = etat.resultat || [];
    if (!rows.length) { toast('Aucune demande à exporter avec ces filtres.'); return; }
    const m = profil().montants;
    const cols = COLONNES_DM.filter((c) => !c.sensible || m);
    const val = (c, d) => {
      if (c.code === 'statut') return PHX.statutDM(d.statut).libelle;
      const v = c.v(d);
      if (v === null || v === undefined) return '';
      if (c.code === 'montant') return Number(v).toFixed(2).replace('.', ',');
      if (c.code === 'dateCreation' || c.code === 'dateMaj') return fDateHeure(v);
      if (c.code === 'dateCloture') return fDate(v);
      return String(v);
    };
    const lignes = [cols.map((c) => csvCellule(c.libelle)).concat(['Clôturée par']).join(';')];
    rows.forEach((d) => lignes.push(cols.map((c) => csvCellule(val(c, d))).concat([csvCellule(d.cloturePar || '')]).join(';')));
    telecharger('demandes_modification_phenix', lignes, 'Export .csv : ' + pluriel(rows.length, 'demande') + '.');
  }

  /* ---------- Fiche d'une demande : détail, journal, changement de statut ---------- */
  function ouvrirDemande(id) {
    const dm = DEMANDES.find((d) => d.id === id);
    if (!dm) { toast('Demande n° ' + id + ' introuvable.'); return; }
    const T = PHX.typeDM(dm.type);
    const ligne = (lib, html) => '<dt>' + esc(lib) + '</dt><dd>' + html + '</dd>';
    const clos = dmClose(dm);
    const possibles = clos ? [] : PHX.TRANSITIONS_DM[dm.statut];
    const corps = '<div class="dm-fiche-tete">' + badgeDM(dm.statut) + '<b>' + esc(T.court) + '</b><a href="#/ticket/' + dm.ticketId + '">Ticket n° ' + dm.ticketId + '</a><span>' + esc(dm.partenaireCode + ' – ' + dm.partenaireRS) + '</span></div>' +
      '<dl class="dm-fiche">' +
      ligne('Objet', '<b>' + esc(dm.objet) + '</b>') +
      T.champs.map((f) => ligne(f.libelle, valeurDM(f, dm.champs[f.code]))).join('') +
      ligne('Périmètre concerné', esc(dm.perimetre || '—')) +
      ligne(libDateDM(T), dm.dateEffet ? fDate(dm.dateEffet) : '—') +
      ligne('Demandeur', esc(dm.demandeur)) +
      ligne('Créée le', fDateHeure(dm.dateCreation) + ' par ' + esc(dm.creePar)) +
      ligne('Dernière modification', fDateHeure(dm.dateMaj)) +
      (dm.dateCloture ? ligne(dm.statut === 'REA' ? 'Réalisée le' : 'Clôturée le', fDateHeure(dm.dateCloture) + ' par ' + esc(dm.cloturePar)) : '') +
      ligne('Commentaire', esc(dm.commentaire || dm.description || '')) +
      '</dl>' +
      '<h3 class="dm-journal-titre">Journal</h3><ol class="dm-journal">' + dm.journal.map((j) =>
        '<li><span class="dm-j-date">' + fDateHeure(j.date) + ' – ' + esc(j.auteur) + '</span> ' +
        (j.statutAvant && j.statutAvant !== j.statutApres ? badgeDM(j.statutAvant) + ' → ' : '') + badgeDM(j.statutApres) +
        '<div>' + esc(j.commentaire) + (j.notifies && j.notifies.length ? ' <small>Notifiés : ' + esc(j.notifies.join(', ')) + '</small>' : '') + '</div></li>').join('') + '</ol>' +
      (clos
        ? '<p class="nc-note nc-note-verrou">Demande clôturée le ' + fDateHeure(dm.dateCloture) + ' par ' + esc(dm.cloturePar) + ' : lecture seule.</p>'
        : '<div class="dm-maj"><label for="dmStatut">Nouvel état</label><select id="dmStatut"><option value="' + dm.statut + '">' + esc(PHX.statutDM(dm.statut).libelle) + ' (état actuel)</option>' +
          possibles.map((c) => '<option value="' + c + '">' + esc(PHX.statutDM(c).libelle) + '</option>').join('') + '</select>' +
          '<label for="dmCom">Commentaire</label><textarea id="dmCom" rows="3" placeholder="Obligatoire pour un changement d’état"></textarea><div class="tk-err" id="dmErr"></div></div>');
    ouvrirModal({
      titre: 'Demande de modification n° ' + dm.id,
      corps,
      pied: '<a class="nc-btn" href="#/ticket/' + dm.ticketId + '">Ouvrir le ticket</a><span class="flex"></span><button type="button" class="nc-btn" data-fermer>Fermer</button>' +
        (clos ? '' : '<button type="button" class="nc-btn nc-btn-orange" id="dmEnregistrer">Enregistrer</button>'),
      focus: clos ? '[data-fermer]' : '#dmStatut'
    });
    if (!clos) $('#dmEnregistrer').addEventListener('click', () => majDemande(dm));
  }

  function majDemande(dm) {
    const statut = $('#dmStatut').value, com = $('#dmCom').value.trim();
    if (statut !== dm.statut && !com) { $('#dmErr').textContent = 'Commentaire obligatoire pour un changement d’état.'; $('#dmCom').focus(); return; }
    if (statut === dm.statut && !com) { toast('Aucune modification à enregistrer.'); return; }
    const maintenant = Date.now();
    const t = PAR_ID[dm.ticketId];
    const notifies = unique([dm.demandeur, t && t.agent]);
    dm.journal.push({ date: maintenant, auteur: moi(), statutAvant: dm.statut, statutApres: statut, commentaire: com, notifies });
    dm.statut = statut; dm.dateMaj = maintenant;
    if (dmClose(dm)) { dm.dateCloture = maintenant; dm.cloturePar = moi(); }
    store.demandes[dm.id] = dm;
    sauver();
    rerendre();
    ouvrirDemande(dm.id);
    toast('Demande n° ' + dm.id + ' : ' + PHX.statutDM(dm.statut).libelle + '. E-mail envoyé à : ' + notifies.join(', ') + ' (simulation).');
  }

  // Bloc de la fiche ticket : demandes rattachées (CDC § 7.4)
  function blocDemandesTicket(t) {
    const dms = DEMANDES.filter((d) => d.ticketId === t.id).sort((a, b) => a.dateCreation - b.dateCreation);
    const m = profil().montants;
    return '<section class="rp-dm" aria-labelledby="rpDmTitre"><h3 id="rpDmTitre">Demandes de modification rattachées (' + dms.length + ')</h3>' +
      (dms.length ? '<div class="st-wrap"><table class="nc-grille dm-gv"><thead><tr><th>N°</th><th>Demande</th><th>Objet</th><th>Montant HT</th><th>Créée le</th><th>Demandeur</th><th>État</th><th>Clôturée le</th></tr></thead><tbody>' +
        dms.map((d) => '<tr><td><a href="#" data-dm="' + d.id + '">' + d.id + '</a></td><td>' + esc(libTypeDM(d.type)) + '</td><td class="objet">' + esc(d.objet) + '</td>' +
          '<td class="num">' + (typeof d.champs.montant === 'number' ? (m ? esc(fmtEur.format(d.champs.montant)) : '🔒') : '') + '</td>' +
          '<td>' + fDateHeure(d.dateCreation) + '</td><td>' + esc(d.demandeur) + '</td><td>' + badgeDM(d.statut) + '</td><td>' + (d.dateCloture ? fDate(d.dateCloture) : '') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p class="rp-petit">Aucune demande de modification rattachée à ce ticket.</p>') + '</section>';
  }

  /* ---------- Conservation des demandes créées ou modifiées pendant la démo ---------- */
  function appliquerDemandes() {
    Object.keys(store.demandes).forEach((k) => {
      const s = store.demandes[k];
      if (!s || !PHX.typeDM(s.type) || !PHX.statutDM(s.statut) || !PAR_ID[s.ticketId] || !Array.isArray(s.journal)) return;
      if (!s.commentaire && s.description) s.commentaire = s.description;
      s.objet = PHX.objetDM(s.type, s.ticketId);
      const i = DEMANDES.findIndex((d) => d.id === s.id);
      if (i >= 0) DEMANDES[i] = s; else DEMANDES.push(s);
    });
    recompterDM();
  }
  function recompterDM() {
    const n = {};
    DEMANDES.forEach((d) => { n[d.ticketId] = (n[d.ticketId] || 0) + 1; });
    TICKETS.forEach((t) => { t.nbDM = n[t.id] || 0; });
  }

  /* =====================================================================
   * Écran 6 – Fiche partenaire Phenix (PagesMB/PartnerDetails.aspx)
   *   Nouvel onglet « Gestion », placé devant « Détails partenaire » et
   *   « Configuration des notifications ». Il regroupe les nouveaux modules :
   *   Tickets et Demandes de modification (CDC § 4.7).
   * ===================================================================== */
  const ONGLETS_FP = [['gestion', 'Gestion'], ['details', 'Détails partenaire'], ['notif', 'Configuration des notifications']];
  const ICONE_GRILLE = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="#51bc91"><rect x="1" y="1" width="7" height="7" rx="1"/><rect x="10" y="1" width="7" height="7" rx="1"/><rect x="1" y="10" width="7" height="7" rx="1"/><rect x="10" y="10" width="7" height="7" rx="1"/></svg>';
  const ICONE_INFO = '<svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="#00a65a"/><rect x="7" y="7" width="2" height="5" fill="#fff"/><rect x="7" y="4" width="2" height="2" fill="#fff"/></svg>';
  const ICONE_DEMANDES = '<svg width="66" height="44" viewBox="0 0 66 44" fill="none" stroke="#4a4a4a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 4h22l8 8v28H14z"/><path d="M36 4v8h8"/><path d="M20 19h16M20 26h12M20 33h7"/>' +
    '<path d="M41 37l12-12 4 4-12 12h-4z" fill="#fff" stroke="#EB6200"/></svg>';

  const partenaireParCode = (code) => PHX.PARTENAIRES.find((p) => p.code === code) || null;

  function pagePartenaire(code, params) {
    const p = partenaireParCode(code);
    ariane([{ lib: 'Accueil' }, { lib: 'Gestion Partenaires' }, { lib: 'Partenaires' }, { lib: 'Fiche partenaire ' + code }]);
    if (!p) {
      page.innerHTML = '<div class="nc-vide-grille">Le partenaire ' + esc(code) + ' n’existe pas.<br><a class="nc-btn" href="#/tickets">Retour aux tickets</a></div>';
      return;
    }
    const onglet = ONGLETS_FP.some((o) => o[0] === params.get('onglet')) ? params.get('onglet') : 'details';
    page.innerHTML = '<div class="fp-titre">' + ICONE_GRILLE + '<span>PHENIX - Fiche partenaire</span> <span class="fp-code">' + esc(p.code) + ' – ' + esc(p.rs) + '</span></div>' +
      '<div class="fp-onglets"><nav class="fp-onglets-tete" aria-label="Onglets de la fiche partenaire">' +
      ONGLETS_FP.map(([k, lib]) => '<a class="fp-onglet' + (k === onglet ? ' actif' : '') + '"' + (k === onglet ? ' aria-current="page"' : '') +
        ' href="#/partenaire/' + encodeURIComponent(p.code) + '?onglet=' + k + '">' + esc(lib) + (k === 'gestion' ? ' <small class="fp-nouveau">nouveau</small>' : '') + '</a>').join('') +
      '</nav><div class="fp-sep"></div><div class="fp-sep"></div><div class="fp-contenu" id="fpContenu"></div></div>';
    const zone = $('#fpContenu');
    if (onglet === 'gestion') ongletGestion(zone, p);
    else if (onglet === 'details') ongletDetails(zone, p);
    else ongletNotif(zone);
  }

  /* ---------- Onglet Gestion : boutons vers les pages Tickets et Demandes ---------- */
  function ongletGestion(zone, p) {
    const tk = TICKETS.filter((t) => t.partenaireCode === p.code);
    const tkCours = tk.filter((t) => PHX.etat(t.etat).actif).length;
    const dm = DEMANDES.filter((d) => d.partenaireCode === p.code);
    const dmCours = dm.filter((d) => !dmClose(d)).length;
    const bouton = (href, icone, lib, detail) => '<a class="fp-raccourci" href="' + href + '">' + icone + '<span><b>' + esc(lib) + '</b><small>' + detail + '</small></span></a>';
    zone.innerHTML = '<section class="fp-card" aria-labelledby="fpGestionTitre"><h4 class="fp-card-titre" id="fpGestionTitre">' + ICONE_INFO + ' GESTION</h4>' +
      '<div class="fp-raccourcis">' +
      bouton('#/partenaire/' + encodeURIComponent(p.code) + '/tickets', ICONE_LISTE, 'Tickets', esc(pluriel(tk.length, 'ticket')) + ', dont ' + tkCours + ' en cours') +
      bouton('#/partenaire/' + encodeURIComponent(p.code) + '/demandes', ICONE_DEMANDES, 'Demandes de modification', esc(pluriel(dm.length, 'demande')) + ', dont ' + dmCours + ' en cours') +
      '</div></section>';
  }

  const arianePartenaire = (p, fin) => [{ lib: 'Accueil' }, { lib: 'Gestion Partenaires' }, { lib: 'Partenaires' }, { lib: 'Fiche partenaire ' + p.code, href: lienPartenaire(p.code) }].concat(fin);

  /* =====================================================================
   * Écran 7 – Tickets du partenaire (modèle « Client Tickets » Netcom,
   *   ClientViewTickets.aspx) : un bloc par typologie, 6 tickets par page.
   * ===================================================================== */
  let ctxPT = { cle: null };
  const FILTRES_PT = { etat: '', agent: '', du: '', au: '' };

  function pageTicketsPartenaire(p) {
    ariane(arianePartenaire(p, [{ lib: 'Tickets' }]));
    if (ctxPT.cle !== p.code) ctxPT = { cle: p.code, pages: {}, f: Object.assign({}, FILTRES_PT) };
    const f = ctxPT.f;
    const agents = unique(TICKETS.filter((t) => t.partenaireCode === p.code && t.agent).map((t) => t.agent)).sort();
    page.innerHTML = '<div class="pt-cadre">' +
      '<div class="pt-entete"><h2 class="pt-titre">LISTE DES TICKETS PARTENAIRE</h2>' +
      '<span>Code partenaire : <b>' + esc(p.code) + '</b></span><span>Partenaire : <b>' + esc(p.rs) + '</b></span>' +
      '<span class="pt-liens"><a href="' + lienPartenaire(p.code) + '">Retour à la fiche partenaire</a>' +
      '<a href="#/ticket/nouveau?partenaire=' + encodeURIComponent(p.code) + '">' + img('demande') + 'Ouvrir un ticket</a></span></div>' +
      '<div class="pt-filtres" role="search" aria-label="Filtres des tickets du partenaire">' +
      '<label for="ptEtat">État</label><select id="ptEtat"><option value="">Tous</option><option value="ACTIFS"' + (f.etat === 'ACTIFS' ? ' selected' : '') + '>En cours</option><option value="TRAITES"' + (f.etat === 'TRAITES' ? ' selected' : '') + '>Résolus, rejetés ou fermés</option></select>' +
      '<label for="ptAgent">Agent</label><select id="ptAgent"><option value="">Tous</option><option value="__NA__"' + (f.agent === '__NA__' ? ' selected' : '') + '>Non affecté</option>' + agents.map((a) => '<option' + (a === f.agent ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select>' +
      '<label for="ptDu">Créés du</label><input type="date" id="ptDu" value="' + esc(f.du) + '"><label for="ptAu">au</label><input type="date" id="ptAu" value="' + esc(f.au) + '">' +
      '<button type="button" class="nc-btn nc-btn-orange" id="ptCsv">Exporter .csv</button></div>' +
      '<hr><div class="pt-blocs" id="ptBlocs"></div>' +
      '<p class="pt-legende">En gras : tickets en cours de traitement. Survolez une ligne pour voir sa date de création et l’agent qui le suit.</p></div>';
    const lire = () => { f.etat = $('#ptEtat').value; f.agent = $('#ptAgent').value; f.du = $('#ptDu').value; f.au = $('#ptAu').value; ctxPT.pages = {}; rendreBlocs(p); };
    ['#ptEtat', '#ptAgent', '#ptDu', '#ptAu'].forEach((s) => $(s).addEventListener('change', lire));
    $('#ptCsv').addEventListener('click', () => exporterTicketsPartenaire(p));
    $('#ptBlocs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-page]');
      if (b) { ctxPT.pages[b.getAttribute('data-bloc')] = +b.getAttribute('data-page'); rendreBlocs(p); const n = $('#ptb_' + b.getAttribute('data-bloc')); if (n) n.scrollIntoView({ block: 'nearest' }); return; }
      const a = e.target.closest('a[data-bloc]');
      if (a) {
        // Contexte pour « Retour à la liste » et « Précédent / Suivant » dans le bloc
        liste.hashListe = location.hash; liste.pageMemo = 1;
        liste.ordre = ticketsPartenaire(p).filter((t) => t.typo === a.getAttribute('data-bloc')).map((t) => t.id);
      }
    });
    rendreBlocs(p);
  }

  function ticketsPartenaire(p) {
    const f = ctxPT.f, du = parseIso(f.du), au = parseIso(f.au, true);
    return TICKETS.filter((t) => {
      if (t.partenaireCode !== p.code) return false;
      const e = PHX.etat(t.etat);
      if (f.etat === 'ACTIFS' && !e.actif) return false;
      if (f.etat === 'TRAITES' && e.actif) return false;
      if (f.agent === '__NA__') { if (t.agent) return false; } else if (f.agent && t.agent !== f.agent) return false;
      if (du && t.dateCreation < du) return false;
      if (au && t.dateCreation > au) return false;
      return true;
    }).sort((a, b) => b.dateCreation - a.dateCreation);
  }

  function rendreBlocs(p) {
    const tous = ticketsPartenaire(p);
    const parPage = 6;
    $('#ptBlocs').innerHTML = PHX.TYPOLOGIES.map((T) => {
      const l = tous.filter((t) => t.typo === T.code);
      const nb = Math.max(1, Math.ceil(l.length / parPage));
      const pg = Math.min(ctxPT.pages[T.code] || 1, nb);
      const lignes = l.slice((pg - 1) * parPage, pg * parPage).map((t) => {
        const actif = PHX.etat(t.etat).actif;
        const info = 'Créé le : ' + fDateHeure(t.dateCreation) + ' – Suivi par : ' + (t.agent || 'non affecté');
        return '<tr' + (actif ? ' class="pt-actif"' : '') + ' title="' + esc(info) + '"><td><a href="#/ticket/' + t.id + '" data-bloc="' + T.code + '">' + t.id + '</a></td>' +
          '<td>' + esc(t.objet) + '</td><td>' + esc(libSous(t.typo, t.sous)) + '</td><td>' + esc(PHX.etat(t.etat).libelle) + '</td></tr>';
      }).join('');
      let pager = '';
      if (nb > 1) for (let i = 1; i <= nb; i++) pager += '<button type="button" data-bloc="' + T.code + '" data-page="' + i + '"' + (i === pg ? ' aria-current="page"' : '') + ' aria-label="' + esc(T.libelle) + ', page ' + i + '">' + i + '</button>';
      return '<section class="pt-bloc" aria-labelledby="ptb_' + T.code + '"><h3 class="pt-bloc-titre" id="ptb_' + T.code + '">' + esc(T.libelle.toUpperCase()) + ' <small>(' + l.length + ')</small></h3>' +
        '<table class="pt-table"><thead><tr><th scope="col" class="pt-c-num">N°</th><th scope="col">Sujet</th><th scope="col" class="pt-c-sous">Sous-typologie</th><th scope="col" class="pt-c-etat">État</th></tr></thead><tbody>' +
        (lignes || '<tr><td colspan="4" class="pt-vide">Aucun ticket</td></tr>') + '</tbody></table>' +
        (pager ? '<div class="pt-pager">' + pager + '</div>' : '') + '</section>';
    }).join('');
  }

  // Export .csv : colonnes de la vue « Tickets » du CDC (§ 4.7.1)
  function exporterTicketsPartenaire(p) {
    const rows = ticketsPartenaire(p);
    if (!rows.length) { toast('Aucun ticket à exporter avec ces filtres.'); return; }
    const cols = ['id', 'typologie', 'sousTypologie', 'objet', 'etat', 'agent', 'dateCreation', 'dateMaj', 'dateResolution', 'createur', 'montantReclame']
      .map(champ).filter((c) => c && autorise(c));
    const lignes = [cols.map((c) => csvCellule(c.libelle)).join(';')];
    rows.forEach((t) => lignes.push(cols.map((c) => csvCellule(valeurCsv(c, t))).join(';')));
    telecharger('tickets_' + p.code, lignes, 'Export .csv : ' + pluriel(rows.length, 'ticket') + ' du partenaire ' + p.code + '.');
  }

  /* =====================================================================
   * Écran 8 – Demandes de modification du partenaire (modèle « Client
   *   Demande de Modification » Netcom, ClientViewDemandeModif.aspx).
   * ===================================================================== */
  let ctxPD = { cle: null };
  const COLONNES_PD = [
    { code: 'id', libelle: 'Id' }, { code: 'dateCreation', libelle: 'Date de création' }, { code: 'dateMaj', libelle: 'Dernière modif' },
    { code: 'demandeur', libelle: 'Créé par' }, { code: 'statut', libelle: 'État' }, { code: 'type', libelle: 'Demande' },
    { code: 'service', libelle: 'Service' }, { code: 'ticketId', libelle: 'Numéro de ticket' }, { code: 'dateCloture', libelle: 'Clôturée le' }
  ];

  function pageDemandesPartenaire(p) {
    ariane(arianePartenaire(p, [{ lib: 'Demandes de modification' }]));
    if (ctxPD.cle !== p.code) ctxPD = { cle: p.code, tri: { col: 'dateCreation', sens: -1 }, f: { statut: '', demandeur: '', du: '', au: '' } };
    const f = ctxPD.f;
    const demandeurs = unique(DEMANDES.filter((d) => d.partenaireCode === p.code).map((d) => d.demandeur)).sort();
    const haut = '<a href="#" data-haut>Haut</a>';
    page.innerHTML = '<div class="pd-cadre">' +
      '<div class="pd-section"><span class="pd-lib">Détail partenaire :</span><span class="pd-barre">' + haut + '</span></div>' +
      '<dl class="pd-detail"><dt>Partenaire</dt><dd><a href="' + lienPartenaire(p.code) + '">' + esc(p.rs) + '</a></dd><dt>Code partenaire</dt><dd>' + esc(p.code) + '</dd></dl>' +
      '<div class="pd-section"><span class="pd-lib">Demandes de modification :</span><span class="pd-barre"><button type="button" class="pd-csv" id="pdCsv">Exporter .csv</button>' + haut + '</span></div>' +
      '<div class="pd-filtres" role="search" aria-label="Filtres des demandes du partenaire">' +
      '<label for="pdStatut">État</label><select id="pdStatut"><option value="">-- Tous --</option><option value="ENCOURS"' + (f.statut === 'ENCOURS' ? ' selected' : '') + '>En cours (En attente, Validée)</option>' +
      PHX.STATUTS_DM.map((s) => '<option value="' + s.code + '"' + (s.code === f.statut ? ' selected' : '') + '>' + esc(s.libelle) + '</option>').join('') + '</select>' +
      '<label for="pdDemandeur">Créé par</label><select id="pdDemandeur"><option value="">-- Tous --</option>' + demandeurs.map((a) => '<option' + (a === f.demandeur ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select>' +
      '<label for="pdDu">Créées du</label><input type="date" id="pdDu" value="' + esc(f.du) + '"><label for="pdAu">au</label><input type="date" id="pdAu" value="' + esc(f.au) + '">' +
      '</div><div class="nc-grille-wrap dm-gv-wrap" id="pdGrille"></div>' +
      '<p class="rp-petit pd-note">Une demande de modification se crée depuis son ticket (lien « Nouvelle demande de modification » de la fiche ticket).</p></div>';
    const lire = () => { f.statut = $('#pdStatut').value; f.demandeur = $('#pdDemandeur').value; f.du = $('#pdDu').value; f.au = $('#pdAu').value; grillePD(p); };
    ['#pdStatut', '#pdDemandeur', '#pdDu', '#pdAu'].forEach((s) => $(s).addEventListener('change', lire));
    $('#pdCsv').addEventListener('click', () => {
      const rows = demandesPartenaire(p);
      if (!rows.length) { toast('Aucune demande à exporter avec ces filtres.'); return; }
      exporterDM({ resultat: rows });
    });
    page.querySelector('.pd-cadre').addEventListener('click', (e) => {
      if (e.target.closest('[data-haut]')) { e.preventDefault(); window.scrollTo(0, 0); return; }
      if (e.target.closest('a[href^="#/ticket/"]')) { liste.hashListe = location.hash; liste.ordre = []; liste.pageMemo = 1; return; }
      const th = e.target.closest('th[data-col]');
      if (th) {
        const c = th.getAttribute('data-col');
        ctxPD.tri = ctxPD.tri.col === c ? { col: c, sens: -ctxPD.tri.sens } : { col: c, sens: ['id', 'dateCreation', 'dateMaj', 'ticketId', 'dateCloture'].indexOf(c) >= 0 ? -1 : 1 };
        grillePD(p);
        const n = $('#pdGrille th[data-col="' + c + '"]'); if (n) n.focus();
      }
    });
    $('#pdGrille').addEventListener('keydown', (e) => {
      const th = e.target.closest('th[data-col]');
      if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); th.click(); }
    });
    grillePD(p);
  }

  function demandesPartenaire(p) {
    const f = ctxPD.f, du = parseIso(f.du), au = parseIso(f.au, true);
    return DEMANDES.filter((d) => {
      if (d.partenaireCode !== p.code) return false;
      if (f.statut === 'ENCOURS') { if (dmClose(d)) return false; } else if (f.statut && d.statut !== f.statut) return false;
      if (f.demandeur && d.demandeur !== f.demandeur) return false;
      if (du && d.dateCreation < du) return false;
      if (au && d.dateCreation > au) return false;
      return true;
    });
  }

  function grillePD(p) {
    const cle = (d, c) => {
      switch (c) {
        case 'statut': return PHX.STATUTS_DM.indexOf(PHX.statutDM(d.statut));
        case 'type': return norm(libTypeDM(d.type));
        case 'service': return norm(d.champs.service || '');
        case 'demandeur': return norm(d.demandeur);
        default: return d[c];
      }
    };
    const tri = ctxPD.tri;
    const rows = demandesPartenaire(p).sort((a, b) => {
      const va = cle(a, tri.col), vb = cle(b, tri.col);
      if ((va === null || va === undefined) && (vb === null || vb === undefined)) return b.id - a.id;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return ((va < vb ? -1 : va > vb ? 1 : 0) * tri.sens) || (b.id - a.id);
    });
    const cellule = {
      id: (d) => '<td class="pd-c">' + d.id + '</td>',
      dateCreation: (d) => '<td class="pd-c">' + fDateHeure(d.dateCreation) + '</td>',
      dateMaj: (d) => '<td>' + fDateHeure(d.dateMaj) + '</td>',
      demandeur: (d) => '<td class="pd-c">' + esc(d.demandeur) + '</td>',
      statut: (d) => '<td class="pd-c">' + badgeDM(d.statut) + '</td>',
      type: (d) => '<td>' + esc(libTypeDM(d.type)) + '</td>',
      service: (d) => '<td>' + esc(d.champs.service || '') + '</td>',
      ticketId: (d) => '<td class="pd-c"><a href="#/ticket/' + d.ticketId + '">' + d.ticketId + '</a></td>',
      dateCloture: (d) => '<td class="pd-c">' + (d.dateCloture ? fDate(d.dateCloture) : '') + '</td>'
    };
    $('#pdGrille').innerHTML = rows.length
      ? '<table class="nc-grille dm-gv pd-gv"><caption class="sr-only">Demandes de modification du partenaire</caption><thead><tr>' +
        COLONNES_PD.map((c) => {
          const actif = tri.col === c.code;
          return '<th scope="col" tabindex="0" data-col="' + c.code + '" aria-sort="' + (actif ? (tri.sens > 0 ? 'ascending' : 'descending') : 'none') + '">' + esc(c.libelle) +
            '<span class="tri" aria-hidden="true">' + (actif ? (tri.sens > 0 ? '▲' : '▼') : '') + '</span></th>';
        }).join('') + '<th scope="col"><span class="sr-only">Détails</span></th></tr></thead><tbody>' +
        rows.map((d) => '<tr>' + COLONNES_PD.map((c) => cellule[c.code](d)).join('') +
          '<td class="pd-c"><button type="button" class="pd-details" data-dm="' + d.id + '" aria-label="Détails de la demande n° ' + d.id + '">Details</button></td></tr>').join('') +
        '</tbody></table>'
      : '<div class="nc-vide-grille">Aucune demande de modification pour ce partenaire' + (Object.keys(ctxPD.f).some((k) => ctxPD.f[k]) ? ' avec ces filtres' : '') + '.</div>';
  }

  /* ---------- Onglet Détails partenaire (existant, reproduit à titre indicatif) ---------- */
  function detailsPartenaire(p) {
    const r = PHX.rng(PHX.hash('fp#' + p.code));
    const pick = (a) => a[Math.floor(r() * a.length)];
    const villes = [['75008', 'Paris'], ['69002', 'Lyon'], ['13008', 'Marseille'], ['31000', 'Toulouse'], ['44000', 'Nantes'], ['59000', 'Lille'], ['33000', 'Bordeaux'], ['67000', 'Strasbourg']];
    const v = pick(villes);
    const domaine = norm(p.rs).replace(/\b(sas|sarl)\b/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.example';
    const chiffres = (n) => Array.from({ length: n }, () => Math.floor(r() * 10)).join('');
    return {
      siret: chiffres(14), adresse: (1 + Math.floor(r() * 120)) + ' ' + pick(['rue de la République', 'avenue Jean Jaurès', 'boulevard Victor Hugo', 'rue du Commerce', 'allée des Tilleuls']),
      cp: v[0], ville: v[1], tva: 'FR' + chiffres(11), email: 'contact@' + domaine,
      contact: pick(['Claire Moreau', 'Julien Faure', 'Nadia Belkacem', 'Thomas Leroux', 'Sophie Garnier']), tel: '0' + (1 + Math.floor(r() * 5)) + ' ' + chiffres(2) + ' ' + chiffres(2) + ' ' + chiffres(2) + ' ' + chiffres(2),
      emailContact: 'support@' + domaine, responsable: pick(['a.martin', 's.benali', 'c.durand']), paiement: pick(['Prélèvement automatique', 'Virement bancaire']),
      statut: 'Partenaire actif', delais: pick(['10 jours', '30 jours', '45 jours'])
    };
  }
  function ongletDetails(zone, p) {
    const d = detailsPartenaire(p);
    const champ = (lib, v, large) => '<label>' + esc(lib) + ' :</label><input type="text" value="' + esc(v) + '" disabled' + (large ? ' class="fp-large"' : '') + '>';
    const caseFp = (lib, coche) => '<label class="fp-case"><input type="checkbox" disabled' + (coche ? ' checked' : '') + '> ' + esc(lib) + '</label>';
    zone.innerHTML = '<p class="nc-note nc-note-verrou">Onglet existant, reproduit à titre indicatif (champs inactifs, données fictives) : il n’est pas modifié par le module Tickets.</p>' +
      '<section class="fp-card"><h4 class="fp-card-titre">' + ICONE_INFO + ' INFORMATIONS GÉNÉRALES</h4><div class="fp-details">' +
      '<div class="fp-champs"><label>Code :</label><b class="fp-code-vert">' + esc(p.code) + '</b>' +
      champ('Raison Sociale', p.rs) + champ('Siret', d.siret) + champ('Adresse', d.adresse) +
      '<label>Code Postal / Ville :</label><span class="fp-double"><input type="text" value="' + esc(d.cp) + '" disabled><input type="text" value="' + esc(d.ville) + '" disabled></span>' +
      champ('TVA Intracommunautaire', d.tva) + champ('Email', d.email) + champ('Contact', d.contact) + champ('Tél Contact', d.tel) +
      champ('Email Contact', d.emailContact) + champ('Responsable de compte', d.responsable) + champ('Mode de paiement', d.paiement) +
      champ('Statut', d.statut) + champ('Délais Paiement', d.delais) + '</div>' +
      '<div class="fp-cote"><img src="assets/img/building.png" alt="" width="100" height="100"><hr>' +
      caseFp('N’est pas en prélèvement automatique', d.paiement !== 'Prélèvement automatique') + caseFp('Ne pas utiliser le système de facturation PHENIX', false) +
      caseFp('Afficher Msisdn complet dans la facture', true) + caseFp('Proposer détails de la facture au format csv', true) + caseFp('Activer E-Sim', true) + caseFp('Autoliquidation de la TVA', false) +
      '</div></div><div class="fp-boutons"><button type="button" class="fp-btn-rouge" disabled>Restreindre l’accès sur extranet</button><button type="button" class="fp-btn-vert" disabled>Enregistrer le partenaire</button></div></section>';
  }

  function ongletNotif(zone) {
    zone.innerHTML = '<p class="nc-note nc-note-verrou">Onglet existant : son contenu n’est pas modifié par le module Tickets et n’est pas reproduit dans la maquette.</p>';
  }

  /* =====================================================================
   * Écran 9 – Gestion des demandes de modification (menu principal),
   *   modèle « Consulter les Demandes » Netcom (demandeconsulter.aspx) :
   *   filtres + liste générale, puis une section par type de demande.
   * ===================================================================== */
  let ctxGD = null;
  const SECTION_PAR_PAGE = 10;

  function pageGestionDemandes() {
    ariane(ARIANE.concat([{ lib: 'Demandes de modification' }]));
    if (!ctxGD) {
      const defauts = Object.assign({}, FILTRES_DM, { statut: 'ATT' }); // comme Netcom : « En attente » à l'ouverture
      ctxGD = { pages: {}, liste: { f: Object.assign({}, defauts), defauts, tri: { col: 'dateCreation', sens: -1 }, page: 1, surligne: null, taille: 10, impression: true, apres: () => rendreSectionsDM() } };
    }
    page.innerHTML = titre('Demandes de modification', '<a class="nc-btn" href="#/tickets">Afficher les tickets</a><a class="nc-btn" href="#/stats">Statistiques</a>') +
      '<div id="gdListe"></div><div id="gdSections" class="gd-sections"></div>';
    $('#gdSections').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-gd-page]');
      if (b) { ctxGD.pages[b.getAttribute('data-gd-section')] = +b.getAttribute('data-gd-page'); rendreSectionsDM(); const s = $('#gds_' + b.getAttribute('data-gd-section')); if (s) s.scrollIntoView({ block: 'nearest' }); return; }
      if (e.target.closest('a[href^="#/ticket/"]')) { liste.hashListe = location.hash || '#/demandes'; liste.ordre = []; liste.pageMemo = 1; }
    });
    rendreListeDM($('#gdListe'), ctxGD.liste);
  }

  // Colonnes communes aux sections, puis colonnes propres à chaque type (comme dans Netcom)
  const colGD = (lib, cellule, classe) => ({ lib, cellule, classe });
  const COLS_BASE_GD = [
    colGD('Id', (d) => d.id, 'pd-c'),
    colGD('Code partenaire', (d) => '<a href="' + lienPartenaire(d.partenaireCode) + '">' + esc(d.partenaireCode) + '</a>', 'pd-c'),
    colGD('Partenaire', (d) => esc(d.partenaireRS)),
    colGD('Numéro de ticket', (d) => '<a href="#/ticket/' + d.ticketId + '">' + d.ticketId + '</a>', 'pd-c'),
    colGD('Date de création', (d) => fDateHeure(d.dateCreation), 'pd-c'),
    colGD('Dernière modif', (d) => fDateHeure(d.dateMaj), 'pd-c'),
    colGD('Créé par', (d) => esc(d.demandeur), 'pd-c'),
    colGD('État', (d) => badgeDM(d.statut), 'pd-c')
  ];
  const montantGD = (lib) => colGD(lib, (d) => (typeof d.champs.montant === 'number' ? (profil().montants ? esc(fmtEur.format(d.champs.montant)) : '🔒') : ''), 'num');
  const SECTIONS_GD = [
    { cle: 'REM', titre: 'Remises', filtre: (d) => d.type === 'REM', cols: [
      colGD('Service', (d) => esc(d.champs.service || '')), colGD('Date de début', (d) => (d.dateEffet ? fDate(d.dateEffet) : ''), 'pd-c'),
      colGD('Durée', (d) => (d.champs.duree ? esc(d.champs.duree) + ' mois' : ''), 'pd-c'), montantGD('Montant HT'),
      colGD('Pourcentage', (d) => (typeof d.champs.pourcentage === 'number' ? esc(fmtNb.format(d.champs.pourcentage)) + ' %' : ''), 'num')] },
    { cle: 'AVI', titre: 'Avoirs partenaires – impayés', filtre: (d) => d.type === 'AVO' && d.champs.urgent === true, cols: [
      colGD('Service', (d) => esc(d.champs.service || '')), montantGD('Montant HT'), colGD('Factures', (d) => esc(d.champs.factures || '')),
      colGD('Geste co', (d) => (d.champs.geste ? 'Oui' : 'Non'), 'pd-c')] },
    { cle: 'AVO', titre: 'Avoirs', filtre: (d) => d.type === 'AVO' && d.champs.urgent !== true, cols: [
      colGD('Service', (d) => esc(d.champs.service || '')), montantGD('Montant HT'), colGD('Factures', (d) => esc(d.champs.factures || '')),
      colGD('Geste co', (d) => (d.champs.geste ? 'Oui' : 'Non'), 'pd-c')] },
    { cle: 'DIV', titre: 'Divers', filtre: (d) => d.type === 'DIV', cols: [colGD('Type', (d) => esc(d.champs.nature || ''))] },
    { cle: 'TAR', titre: 'Tarifs', filtre: (d) => d.type === 'TAR', cols: [
      colGD('Service', (d) => esc(d.champs.service || '')), colGD('Destination', (d) => esc(d.champs.destination || '')), montantGD('Tarif HT / min')] }
  ];

  function rendreSectionsDM() {
    const zone = $('#gdSections');
    if (!zone || !ctxGD) return;
    const base = filtrerDM(ctxGD.liste.f).sort((a, b) => b.dateCreation - a.dateCreation);
    zone.innerHTML = SECTIONS_GD.map((S) => {
      const l = base.filter(S.filtre);
      const nb = Math.max(1, Math.ceil(l.length / SECTION_PAR_PAGE));
      const pg = Math.min(ctxGD.pages[S.cle] || 1, nb);
      const cols = COLS_BASE_GD.concat(S.cols);
      const tete = '<h4 class="gd-titre" id="gds_' + S.cle + '">' + esc(S.titre) + ' <small>(' + l.length + ')</small></h4>';
      if (!l.length) return '<section class="gd-section" aria-labelledby="gds_' + S.cle + '">' + tete + '<div class="gd-vide">Aucune demande n’a été trouvée</div></section>';
      let pager = '';
      if (nb > 1) {
        for (let i = 1; i <= nb; i++) pager += '<button type="button" data-gd-section="' + S.cle + '" data-gd-page="' + i + '"' + (i === pg ? ' aria-current="page"' : '') + '>' + i + '</button>';
        pager = '<div class="nc-pager">' + pager + '<span class="info">Page ' + pg + ' / ' + nb + '</span></div>';
      }
      return '<section class="gd-section" aria-labelledby="gds_' + S.cle + '">' + tete +
        '<div class="nc-grille-wrap dm-gv-wrap"><table class="nc-grille dm-gv gd-gv"><thead><tr><th scope="col"><span class="sr-only">Détails</span></th>' +
        cols.map((c) => '<th scope="col">' + esc(c.lib) + '</th>').join('') + '<th scope="col">Comm.</th></tr></thead><tbody>' +
        l.slice((pg - 1) * SECTION_PAR_PAGE, pg * SECTION_PAR_PAGE).map((d) => '<tr><td class="pd-c"><button type="button" class="pd-details" data-dm="' + d.id + '" aria-label="Détails de la demande n° ' + d.id + '">Details</button></td>' +
          cols.map((c) => '<td' + (c.classe ? ' class="' + c.classe + '"' : '') + '>' + c.cellule(d) + '</td>').join('') +
          '<td class="dm-com"><img src="' + ICONE_COM + '" alt="Journal" title="' + esc(journalTexte(d)) + '" width="14" height="16"></td></tr>').join('') +
        '</tbody></table></div>' + pager + '</section>';
    }).join('');
  }

  /* =====================================================================
   * Écran 10 – Création de ticket (modèle « Réception tickets » Netcom,
   *   Reception_tickets.aspx) : partenaire, un onglet par typologie,
   *   champs du ticket, notification, AJOUTER. CDC § 4.1 et § 7.1.
   * ===================================================================== */
  let ctxCT = null;

  function pageNouveauTicket(params) {
    const p0 = partenaireParCode((params.get('partenaire') || '').toUpperCase());
    const retour = p0 ? '#/partenaire/' + encodeURIComponent(p0.code) + '/tickets' : '#/tickets';
    ariane(p0 ? arianePartenaire(p0, [{ lib: 'Tickets', href: retour }, { lib: 'Ouvrir un ticket' }]) : ARIANE.concat([{ lib: 'Ouvrir un ticket' }]));
    ctxCT = {
      creation: true, retour, p: p0, typo: PHX.TYPOLOGIES[0].code, tente: false, groupesOuverts: {}, boite: '',
      t: { agent: null, destinataires: [] },
      d: { etat: 'OUV', agent: null, typo: PHX.TYPOLOGIES[0].code, sous: '', champs: {}, destinataires: [], commentaire: '' },
      objet: '', interlocuteur: '', joignable: ''
    };
    ctxCT.apres = () => evaluerCreation();
    page.innerHTML = titre('Ouvrir un ticket', '<a class="nc-btn" href="' + retour + '">' + img('retour') + 'Retour</a>') +
      '<div class="ct-cadre">' +
      '<div class="ct-ligne"><label for="ctCode" class="ct-lib">Code partenaire</label>' +
      '<input id="ctCode" list="ctListePart" autocomplete="off" placeholder="Code SO… ou raison sociale" value="' + (p0 ? esc(p0.code) : '') + '">' +
      '<datalist id="ctListePart">' + PHX.PARTENAIRES.map((x) => '<option value="' + esc(x.code) + '">' + esc(x.rs) + '</option>').join('') + '</datalist>' +
      '<button type="button" class="nc-btn" id="ctChercher">Chercher</button>' +
      '<span class="ct-rs" id="ctRs">' + (p0 ? esc(p0.rs) : '') + '</span><span class="tk-err" data-err-ct="partenaire"></span></div>' +
      '<p class="ct-consigne"><span class="ct-lib">Choisir la typologie du ticket :</span> elle détermine la file de traitement et les champs à renseigner.</p>' +
      '<div class="ct-onglets"><div class="ct-tabs" role="tablist" aria-label="Typologie du ticket">' +
      PHX.TYPOLOGIES.map((T, i) => '<button type="button" role="tab" class="ct-tab" id="ctt_' + T.code + '" data-typo="' + T.code + '" aria-selected="' + (i === 0) + '" aria-controls="ctPanneau"' + (i === 0 ? '' : ' tabindex="-1"') + '>' + esc(T.libelle) + '</button>').join('') +
      '</div><div class="ct-panneau" id="ctPanneau" role="tabpanel" aria-labelledby="ctt_' + ctxCT.typo + '"></div></div>' +
      '<div class="rp-grille ct-commun">' +
      '<label for="ctInterlocuteur">Nom de l’interlocuteur</label><div class="rp-champ"><input type="text" id="ctInterlocuteur" maxlength="80" placeholder="Contact chez le partenaire"></div>' +
      '<label for="ctJoignable">Joignable au</label><div class="rp-champ"><input type="text" id="ctJoignable" maxlength="40" placeholder="Téléphone ou e-mail"></div>' +
      '</div></div>' +
      '<section class="rp-panneau ct-notif" aria-labelledby="ctNotifTitre"><h3 class="rp-panneau-tete" id="ctNotifTitre">Notification par email :</h3><div class="rp-panneau-corps" id="rpNotif"></div></section>' +
      '<div class="rp-pied ct-pied"><div class="rp-resume" id="ctResume" aria-live="polite"></div>' +
      '<span class="rp-petit">Le ticket est créé à l’état Ouvert, sans agent : il arrive dans la file de sa typologie.</span>' +
      '<button type="button" class="rp-btn-enregistrer" id="ctAjouter">AJOUTER</button></div>';

    // Partenaire : recherche par code ou raison sociale
    const chercher = () => {
      const v = norm($('#ctCode').value).trim();
      const p = PHX.PARTENAIRES.find((x) => norm(x.code) === v) || (v ? PHX.PARTENAIRES.find((x) => norm(x.rs).indexOf(v) >= 0 || norm(x.code + ' ' + x.rs).indexOf(v) >= 0) : null);
      ctxCT.p = p || null;
      $('#ctRs').textContent = p ? p.rs : '';
      if (p) $('#ctCode').value = p.code;
      $('[data-err-ct="partenaire"]').textContent = p || !v ? '' : 'Partenaire introuvable.';
      evaluerCreation();
    };
    $('#ctChercher').addEventListener('click', chercher);
    $('#ctCode').addEventListener('change', chercher);
    $('#ctCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); chercher(); } });

    // Onglets de typologie (navigation clavier : flèches gauche / droite)
    const tabs = $$('.ct-tab');
    const choisir = (b) => {
      lireCreation();
      tabs.forEach((x) => { const actif = x === b; x.setAttribute('aria-selected', String(actif)); x.tabIndex = actif ? 0 : -1; });
      ctxCT.typo = ctxCT.d.typo = b.getAttribute('data-typo');
      ctxCT.d.sous = ''; ctxCT.d.champs = {};
      $('#ctPanneau').setAttribute('aria-labelledby', b.id);
      rendrePanneauCreation(); evaluerCreation();
    };
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => choisir(b));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        n.focus(); choisir(n);
      });
    });
    $('#ctPanneau').addEventListener('change', (e) => {
      if (e.target.id === 'ctSous') { lireCreation(); ctxCT.d.champs = {}; rendrePanneauCreation(); const s = $('#ctSous'); if (s) s.focus(); }
      evaluerCreation();
    });
    $('#ctPanneau').addEventListener('input', () => evaluerCreation());
    $('#ctAjouter').addEventListener('click', ajouterTicket);
    rendrePanneauCreation();
    rendreNotif(ctxCT);
    evaluerCreation();
    if (!p0) $('#ctCode').focus();
  }

  const champsCreation = (d) => (d.sous ? champsDuBrouillon(d).filter((c) => c.creation !== false) : []);

  function controleCreation(c, v) {
    const id = 'ctc_' + c.code;
    const attr = ' id="' + id + '" data-code-ct="' + esc(c.code) + '"';
    if (c.type === 'multi') {
      const coches = Array.isArray(v) ? v : [];
      return '<span class="rp-multi" role="group" aria-labelledby="lab_' + id + '"' + attr + '>' +
        c.options.map((o) => '<label><input type="checkbox" value="' + esc(o) + '"' + (coches.indexOf(o) >= 0 ? ' checked' : '') + '> ' + esc(o) + '</label>').join('') + '</span>';
    }
    if (c.type === 'booleen') return '<select' + attr + '><option value="">—</option><option value="oui"' + (v === true ? ' selected' : '') + '>Oui</option><option value="non"' + (v === false ? ' selected' : '') + '>Non</option></select>';
    if (c.options) return '<select' + attr + '><option value="">--Sélectionner--</option>' + c.options.map((o) => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
    if (c.type === 'montant') return '<span class="rp-montant"><input type="number" step="0.01" min="0" inputmode="decimal"' + attr + ' value="' + (v === null || v === undefined ? '' : esc(v)) + '"><span class="rp-unite">€ HT</span></span>';
    if (c.type === 'nombre') return '<input type="number" step="1" min="0"' + attr + ' value="' + (v === null || v === undefined ? '' : esc(v)) + '">';
    if (c.type === 'date' || c.type === 'datetime') return '<input type="date"' + attr + ' value="' + isoJour(v) + '">';
    return '<input type="text" maxlength="120"' + attr + ' value="' + (v === null || v === undefined ? '' : esc(v)) + '">';
  }

  function rendrePanneauCreation() {
    const d = ctxCT.d, T = PHX.typo(d.typo);
    const champs = champsCreation(d);
    $('#ctPanneau').innerHTML = '<div class="rp-grille">' +
      '<label for="ctSous">Sous-typologie <span class="req" aria-hidden="true">*</span></label><div class="rp-champ"><select id="ctSous"><option value="">--Sélectionner--</option>' +
      T.sous.map((s) => '<option value="' + s.code + '"' + (s.code === d.sous ? ' selected' : '') + '>' + esc(s.libelle) + '</option>').join('') + '</select>' +
      '<div class="rp-aide">Détermine la boîte fonctionnelle notifiée.</div><div class="tk-err" data-err-ct="sous"></div></div>' +
      '<span></span><span></span>' +
      '<label for="ctObjet" class="ct-col1">Objet <span class="req" aria-hidden="true">*</span></label><div class="rp-champ rp-large"><input type="text" id="ctObjet" maxlength="150" value="' + esc(ctxCT.objet) + '" placeholder="Résumé de la demande du partenaire"><div class="tk-err" data-err-ct="objet"></div></div>' +
      (champs.length ? '<div class="rp-sec">Champs spécifiques – ' + esc(T.libelle + ' › ' + libSous(d.typo, d.sous)) + '</div>' + champs.map((c) => {
        const id = 'ctc_' + c.code;
        const lab = (c.type === 'multi' ? '<span class="rp-lib" id="lab_' + id + '">' : '<label for="' + id + '">') + esc(c.libelle) +
          ' <span class="req" data-req-ct="' + esc(c.code) + '" aria-hidden="true" hidden>*</span>' + (c.type === 'multi' ? '</span>' : '</label>');
        if (!autorise(c)) return '<span class="rp-lib">' + esc(c.libelle) + ' :</span><div class="rp-champ"><i class="rp-verrou">🔒 Réservé aux profils habilités (RG-15)</i><div class="tk-err" data-err-ct="' + esc(c.code) + '"></div></div>';
        const aide = c.modifManager ? (AIDES_CHAMPS[c.code] || '') + ' Ensuite modifiable uniquement par un manager.' : (AIDES_CHAMPS[c.code] || '');
        return lab + '<div class="rp-champ">' + controleCreation(c, d.champs[c.code]) + (aide ? '<div class="rp-aide">' + esc(aide.trim()) + '</div>' : '') +
          '<div class="tk-err" data-err-ct="' + esc(c.code) + '"></div></div>';
      }).join('') : (d.sous ? '<p class="rp-aide rp-large-tout">Aucun champ spécifique à renseigner pour cette sous-typologie.</p>' : '')) +
      '<label for="ctDesc" class="ct-col1">Description <span class="req" aria-hidden="true">*</span></label><div class="rp-champ rp-large"><textarea id="ctDesc" rows="6" placeholder="Détail de la demande, éléments transmis par le partenaire">' + esc(d.commentaire) + '</textarea><div class="tk-err" data-err-ct="description"></div></div>' +
      '</div>';
  }

  function lireCreation() {
    const d = ctxCT.d;
    const s = $('#ctSous'); if (s) d.sous = s.value;
    const o = $('#ctObjet'); if (o) ctxCT.objet = o.value.trim();
    const de = $('#ctDesc'); if (de) d.commentaire = de.value.trim();
    ctxCT.interlocuteur = $('#ctInterlocuteur').value.trim();
    ctxCT.joignable = $('#ctJoignable').value.trim();
    $$('#ctPanneau [data-code-ct]').forEach((el) => { const c = champ(el.getAttribute('data-code-ct')); if (c) d.champs[c.code] = lireValeur(c, el); });
    const S = PHX.sousTypo(d.typo, d.sous);
    const boite = S ? S.boite : '';
    if (boite !== ctxCT.boite) { ctxCT.boite = boite; rendreNotif(ctxCT); }
  }

  function evaluerCreation() {
    lireCreation();
    const d = ctxCT.d;
    // Règles des champs spécifiques communes avec la fiche ticket (RG-05, RG-15…)
    const v = valider({ t: { etat: 'OUV' }, d });
    const err = Object.assign({}, v.err);
    if (!ctxCT.p) err.partenaire = $('#ctCode').value.trim() ? 'Partenaire introuvable.' : 'Choisissez un partenaire.';
    if (!ctxCT.objet) err.objet = 'Champ obligatoire';
    if (!d.commentaire) err.description = 'Champ obligatoire';
    $$('[data-req-ct]').forEach((x) => { x.hidden = !v.req[x.getAttribute('data-req-ct')]; });
    $$('[data-err-ct]').forEach((x) => {
      const k = x.getAttribute('data-err-ct');
      if (k === 'partenaire' && !ctxCT.tente) return;
      x.textContent = ctxCT.tente && err[k] ? err[k] : '';
    });
    const nb = Object.keys(err).length;
    const r = $('#ctResume');
    r.className = 'rp-resume' + (ctxCT.tente && nb ? ' err' : '');
    r.textContent = ctxCT.tente && nb ? 'Corrigez ' + (nb > 1 ? 'les ' + nb + ' champs signalés' : 'le champ signalé') + ' avant d’ajouter le ticket.' : '';
    return { err, avert: v.avert };
  }

  function ajouterTicket() {
    ctxCT.tente = true;
    const { err } = evaluerCreation();
    if (Object.keys(err).length) {
      const premier = $('.tk-err[data-err-ct]:not(:empty)');
      if (premier) { const z = premier.closest('.rp-champ, .ct-ligne'); const ctl = z && $('input, select, textarea', z); (ctl || premier).focus(); premier.scrollIntoView({ block: 'center' }); }
      return;
    }
    const d = ctxCT.d, p = ctxCT.p, S = PHX.sousTypo(d.typo, d.sous);
    const maintenant = Date.now();
    const id = TICKETS.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    const champs = {};
    champsCreation(d).forEach((c) => { if (autorise(c) && d.champs[c.code] !== undefined) champs[c.code] = d.champs[c.code]; });
    const destinataires = d.destinataires.slice();
    const notifies = unique([S.boite].concat(destinataires));
    const t = {
      id, typo: d.typo, sous: d.sous, etat: 'OUV', partenaireCode: p.code, partenaireRS: p.rs,
      dateCreation: maintenant, dateMaj: maintenant, dateResolution: null, dateFermeture: null,
      agent: null, decision: null, nbDM: 0, champs, boite: S.boite, objet: ctxCT.objet, createur: moi(),
      destinataires, interlocuteur: ctxCT.interlocuteur, joignable: ctxCT.joignable, dernierCommentaire: d.commentaire, cree: true,
      historique: [{ type: 'ouverture', date: maintenant, auteur: moi(), etatApres: 'OUV', typo: d.typo, sous: d.sous,
        servicesImpactes: Array.isArray(champs.servicesImpactes) ? champs.servicesImpactes.slice() : undefined,
        interlocuteur: ctxCT.interlocuteur, joignable: ctxCT.joignable, changements: [], commentaire: d.commentaire, notifies }]
    };
    TICKETS.push(t); PAR_ID[id] = t;
    store.nouveaux[id] = JSON.parse(JSON.stringify(t)); // état initial ; les mises à jour suivent dans store.tickets
    sauver();
    liste.hashListe = ctxCT.retour; liste.ordre = []; liste.pageMemo = 1;
    location.hash = '#/ticket/' + id;
    toast('Ticket n° ' + id + ' créé dans la file ' + libTypo(d.typo) + ' › ' + S.libelle + '. E-mail envoyé à : ' + notifies.join(', ') + ' (simulation).');
  }

  // Tickets créés pendant la démo : rechargés à l'ouverture, avant leurs mises à jour
  function appliquerNouveaux() {
    Object.keys(store.nouveaux).forEach((k) => {
      const t = store.nouveaux[k];
      if (!t || typeof t.id !== 'number' || PAR_ID[t.id] || !PHX.sousTypo(t.typo, t.sous) || !partenaireParCode(t.partenaireCode) || !Array.isArray(t.historique)) return;
      const copie = JSON.parse(JSON.stringify(t));
      TICKETS.push(copie); PAR_ID[copie.id] = copie;
    });
  }

  /* ---------- Sélecteur de colonnes personnalisées (à la Redmine) ---------- */
  function ouvrirColonnes() {
    let sel = colonnesPerso().map((c) => c.code);
    let recherche = '';
    const fond = ouvrirModal({
      titre: 'Colonnes affichées',
      corps:
        '<p class="nc-note">Les 8 colonnes par défaut restent toujours affichées. Ajoutez celles dont vous avez besoin : la liste est alimentée par le référentiel des champs (champs généraux et champs spécifiques de chaque typologie). Un champ ajouté au référentiel apparaît ici sans développement. Votre choix est enregistré sur votre profil et repris dans l’export .csv.</p>' +
        (profil().montants ? '' : '<p class="nc-note nc-note-verrou">🔒 Les montants sont réservés aux profils habilités (RG-15) : ils apparaissent grisés et ne peuvent pas être ajoutés.</p>') +
        '<div class="nc-picker">' +
        '<div><label for="pkDispo">Colonnes disponibles</label>' +
        '<input type="search" id="pkRech" placeholder="Rechercher une colonne" aria-label="Rechercher une colonne">' +
        '<select id="pkDispo" multiple></select></div>' +
        '<div class="fleches">' +
        '<button type="button" class="nc-btn" id="pkAjout" title="Ajouter" aria-label="Ajouter les colonnes sélectionnées">→</button>' +
        '<button type="button" class="nc-btn" id="pkRetrait" title="Retirer" aria-label="Retirer les colonnes sélectionnées">←</button></div>' +
        '<div><label for="pkSel">Colonnes affichées</label><div style="height:30px"></div>' +
        '<select id="pkSel" multiple></select></div>' +
        '<div class="fleches">' +
        '<button type="button" class="nc-btn" id="pkHaut2" title="Placer en premier" aria-label="Placer en premier">⇈</button>' +
        '<button type="button" class="nc-btn" id="pkHaut" title="Monter" aria-label="Monter">↑</button>' +
        '<button type="button" class="nc-btn" id="pkBas" title="Descendre" aria-label="Descendre">↓</button>' +
        '<button type="button" class="nc-btn" id="pkBas2" title="Placer en dernier" aria-label="Placer en dernier">⇊</button></div>' +
        '</div>',
      pied: '<button type="button" class="nc-btn" id="pkDefaut">Rétablir les colonnes par défaut</button><span class="flex"></span>' +
        '<button type="button" class="nc-btn" data-fermer>Annuler</button>' +
        '<button type="button" class="nc-btn nc-btn-orange" id="pkAppliquer">Appliquer</button>',
      focus: '#pkRech'
    });
    const dispo = $('#pkDispo', fond), selEl = $('#pkSel', fond);
    const choisis = (el) => Array.prototype.slice.call(el.selectedOptions).map((o) => o.value).filter(Boolean);

    function rendreDispo() {
      const groupes = {}, ordre = [];
      catalogue().forEach((c) => {
        if (c.defaut || sel.indexOf(c.code) >= 0) return;
        const g = PHX.groupeChamp(c);
        if (recherche && norm(c.libelle + ' ' + g).indexOf(norm(recherche)) < 0) return;
        if (!groupes[g]) { groupes[g] = []; ordre.push(g); }
        groupes[g].push(c);
      });
      dispo.innerHTML = ordre.length ? ordre.map((g) => '<optgroup label="' + esc(g) + '">' + groupes[g].map((c) =>
        '<option value="' + esc(c.code) + '"' + (autorise(c) ? '' : ' disabled') + '>' + esc(c.libelle) +
        (c.ajoute ? ' (nouveau)' : '') + (autorise(c) ? '' : ' 🔒') + '</option>').join('') + '</optgroup>').join('')
        : '<option disabled>Aucune colonne ' + (recherche ? 'ne correspond à « ' + esc(recherche) + ' »' : 'disponible') + '</option>';
    }
    function rendreSel(garder) {
      selEl.innerHTML = '<optgroup label="Par défaut (toujours affichées)">' +
        colonnesDefaut().map((c) => '<option disabled>' + esc(c.libelle) + '</option>').join('') + '</optgroup>' +
        '<optgroup label="Ajoutées par vous">' + (sel.length ? sel.map((code) => {
          const c = champ(code);
          return '<option value="' + esc(code) + '"' + (garder && garder.indexOf(code) >= 0 ? ' selected' : '') + '>' +
            esc(c.libelle) + ' (' + esc(PHX.groupeChamp(c)) + ')</option>';
        }).join('') : '<option disabled>Aucune pour l’instant</option>') + '</optgroup>';
    }
    function ajouter() {
      const codes = choisis(dispo);
      if (!codes.length) return;
      codes.forEach((c) => { if (sel.indexOf(c) < 0) sel.push(c); });
      rendreDispo(); rendreSel(codes);
    }
    function retirer() {
      const codes = choisis(selEl);
      if (!codes.length) return;
      sel = sel.filter((c) => codes.indexOf(c) < 0);
      rendreDispo(); rendreSel();
    }
    function deplacer(mode) {
      const codes = choisis(selEl);
      if (!codes.length) return;
      if (mode === 'haut2') sel = codes.concat(sel.filter((c) => codes.indexOf(c) < 0));
      else if (mode === 'bas2') sel = sel.filter((c) => codes.indexOf(c) < 0).concat(codes);
      else if (mode === 'haut') {
        for (let i = 1; i < sel.length; i++) if (codes.indexOf(sel[i]) >= 0 && codes.indexOf(sel[i - 1]) < 0) { const x = sel[i - 1]; sel[i - 1] = sel[i]; sel[i] = x; }
      } else {
        for (let i = sel.length - 2; i >= 0; i--) if (codes.indexOf(sel[i]) >= 0 && codes.indexOf(sel[i + 1]) < 0) { const x = sel[i + 1]; sel[i + 1] = sel[i]; sel[i] = x; }
      }
      rendreSel(codes);
    }
    $('#pkRech', fond).addEventListener('input', (e) => { recherche = e.target.value.trim(); rendreDispo(); });
    $('#pkAjout', fond).addEventListener('click', ajouter);
    $('#pkRetrait', fond).addEventListener('click', retirer);
    dispo.addEventListener('dblclick', ajouter);
    selEl.addEventListener('dblclick', retirer);
    dispo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } });
    selEl.addEventListener('keydown', (e) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); retirer(); } });
    $('#pkHaut2', fond).addEventListener('click', () => deplacer('haut2'));
    $('#pkHaut', fond).addEventListener('click', () => deplacer('haut'));
    $('#pkBas', fond).addEventListener('click', () => deplacer('bas'));
    $('#pkBas2', fond).addEventListener('click', () => deplacer('bas2'));
    $('#pkDefaut', fond).addEventListener('click', () => { sel = []; rendreDispo(); rendreSel(); });
    $('#pkAppliquer', fond).addEventListener('click', () => {
      store.colonnes[profil().login] = sel.slice();
      sauver();
      fermerModal();
      rafraichirListe();
      toast(sel.length ? 'Colonnes enregistrées pour ' + profil().login + ' : ' + pluriel(sel.length, 'colonne ajoutée') + '.' : 'Colonnes par défaut rétablies.');
    });
    rendreDispo(); rendreSel();
  }

  /* ---------- Export .csv (colonnes affichées, tous les tickets filtrés) ---------- */
  let dlPromesse = null;
  function capaciteTelechargement() {
    // Dans une page publiée claude.ai : capacité « downloads ». Ailleurs (GitHub, poste local) : téléchargement navigateur.
    if (dlPromesse) return dlPromesse;
    if (window.claude && typeof window.claude.use === 'function') {
      try { dlPromesse = Promise.resolve(window.claude.use('downloads')).catch(() => null); }
      catch (e) { dlPromesse = Promise.resolve(null); }
    } else dlPromesse = Promise.resolve(undefined);
    return dlPromesse;
  }
  function exporterCsv() {
    const cols = colonnesAffichees();
    const rows = liste.resultat || [];
    if (!rows.length) { toast('Aucun ticket à exporter avec ces filtres.'); return; }
    const lignes = [cols.map((c) => csvCellule(c.libelle)).join(';')];
    rows.forEach((t) => lignes.push(cols.map((c) => csvCellule(valeurCsv(c, t))).join(';')));
    telecharger('tickets_phenix', lignes, 'Export .csv : ' + pluriel(rows.length, 'ticket') + ', ' + pluriel(cols.length, 'colonne') + '.');
  }
  // Fichier .csv pour Excel en français : « ; », UTF-8 avec BOM, horodatage dans le nom
  function telecharger(prefixe, lignes, msgOk) {
    const contenu = '\ufeff' + lignes.join('\r\n');
    const d = new Date();
    const nom = prefixe + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.csv';
    capaciteTelechargement().then((dl) => {
      if (dl) {
        return dl.save({ filename: nom, data: contenu }).then(() => toast(msgOk), (err) => {
          const code = err && err.code;
          if (code === 'declined') return;
          if (code === 'rate_limited') toast('Un téléchargement attend déjà votre confirmation.');
          else toast('Le téléchargement n’est pas disponible dans cette vue.');
        });
      }
      if (dl === null) { toast('Le téléchargement n’est pas disponible dans cette vue.'); return; }
      const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nom;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      toast(msgOk);
    });
  }

  /* =====================================================================
   * Écran 3 – Statistiques
   *   Filtres : période de création (12 mois glissants par défaut), typologie, agent.
   *   Visuels communs : activité mensuelle (entrants, traités, reliquat),
   *   tickets par état et sous-typologie avec délai moyen, charge par agent.
   *   Visuels propres à la typologie filtrée : Réclamation, Recouvrement.
   * ===================================================================== */
  const stats = { f: {}, deplies: {}, pages: {} };
  const periodeDefaut = () => {
    const d = new Date(AUJOURDHUI); d.setDate(1); d.setMonth(d.getMonth() - 11);
    return { du: isoJour(d.getTime()), au: isoJour(AUJOURDHUI) };
  };
  const filtresStatsDefaut = () => Object.assign({ typo: '', agent: '' }, periodeDefaut());

  function pageStats(params) {
    ariane(ARIANE.concat([{ lib: 'Statistiques' }]));
    const f = stats.f = filtresStatsDefaut();
    ['du', 'au', 'typo', 'agent'].forEach((k) => { if (params.has(k)) f[k] = params.get(k); });
    if (!parseIso(f.du)) f.du = periodeDefaut().du;
    if (!parseIso(f.au)) f.au = periodeDefaut().au;
    if (f.typo && !PHX.typo(f.typo)) f.typo = '';
    stats.pages = {};
    page.innerHTML = titre('Statistiques', '<a class="nc-btn" href="#/tickets">Afficher les tickets</a>') +
      '<ul class="nc-filtres" aria-label="Filtres des statistiques">' +
      '<li><label for="sDu"><b>Créés du</b></label><input type="date" id="sDu" value="' + esc(f.du) + '"><label for="sAu"><b>au</b></label><input type="date" id="sAu" value="' + esc(f.au) + '"></li>' +
      '<li><label for="sTypo"><b>Typologie</b></label><select id="sTypo"><option value="">Toutes</option>' +
      PHX.TYPOLOGIES.map((T) => '<option value="' + T.code + '"' + (T.code === f.typo ? ' selected' : '') + '>' + esc(T.libelle) + '</option>').join('') + '</select></li>' +
      '<li><label for="sAgent"><b>Agent</b></label><select id="sAgent">' + optionsAgent(f.agent, false) + '</select></li>' +
      '</ul>' +
      '<div class="nc-actions"><button type="button" class="nc-btn" id="sChercher">Chercher</button>' +
      '<button type="button" class="nc-btn" id="sRaz">Réinitialiser les filtres</button><span class="st-periode" id="stPeriode"></span></div>' +
      '<div id="stContenu"></div>';
    const appliquer = () => {
      f.du = $('#sDu').value; f.au = $('#sAu').value; f.typo = $('#sTypo').value; f.agent = $('#sAgent').value;
      const p = new URLSearchParams();
      ['du', 'au', 'typo', 'agent'].forEach((k) => { if (f[k]) p.set(k, f[k]); });
      majHash('/stats', p);
      stats.pages = {};
      rendreStats();
    };
    ['#sDu', '#sAu', '#sTypo', '#sAgent'].forEach((s) => $(s).addEventListener('change', appliquer));
    $('#sChercher').addEventListener('click', appliquer);
    $('#sRaz').addEventListener('click', () => { majHash('/stats', new URLSearchParams()); pageStats(new URLSearchParams()); });
    $('#stContenu').addEventListener('click', (e) => {
      const b = e.target.closest('[data-deplier]');
      if (b) { const k = b.getAttribute('data-deplier'); stats.deplies[k] = !stats.deplies[k]; rendreStats(); const nb = $('[data-deplier="' + k + '"]'); if (nb) nb.focus(); return; }
      const pg = e.target.closest('button[data-st-page]');
      if (pg) { const k = pg.getAttribute('data-st-table'); stats.pages[k] = +pg.getAttribute('data-st-page'); rendreStats(); const t = $('#st_' + k); if (t) t.scrollIntoView({ block: 'nearest' }); }
    });
    rendreStats();
  }

  function lienListe(p) {
    const f = stats.f;
    const q = new URLSearchParams();
    if (f.du) q.set('du', f.du);
    if (f.au) q.set('au', f.au);
    if (f.typo) q.set('typo', f.typo);
    if (f.agent) q.set('agent', f.agent);
    Object.keys(p).forEach((k) => { if (p[k]) q.set(k, p[k]); });
    return '#/tickets?' + q.toString();
  }
  const nbLien = (n, p) => n ? '<a href="' + lienListe(p) + '">' + n + '</a>' : '<span class="zero">0</span>';

  function compter(tickets) {
    const c = { OUV: 0, ARP: 0, AAR: 0, RES: 0, REJ: 0, FER: 0, NA: 0, total: 0, dSom: 0, dNb: 0 };
    tickets.forEach((t) => {
      c[t.etat]++; c.total++;
      if (t.etat === 'OUV' && !t.agent) c.NA++;
      if (t.dateResolution) { c.dSom += (t.dateResolution - t.dateCreation) / JOUR; c.dNb++; }
    });
    return c;
  }
  // Tickets retenus par la typologie et l'agent (le graphique mensuel couvre ensuite chaque mois de la période)
  const filtrerTypoAgent = (f) => TICKETS.filter((t) => (!f.typo || t.typo === f.typo) && (!f.agent || t.agent === f.agent));

  function rendreStats() {
    const f = stats.f;
    const du = parseIso(f.du), au = parseIso(f.au, true);
    const typeAgent = filtrerTypoAgent(f);
    const base = typeAgent.filter((t) => (!du || t.dateCreation >= du) && (!au || t.dateCreation <= au));
    const T = PHX.typo(f.typo);
    $('#stPeriode').innerHTML = 'Période analysée : <b>' + fDate(du) + '</b> au <b>' + fDate(au) + '</b> · ' + esc(T ? T.libelle : 'Toutes typologies') +
      (f.agent ? ' · ' + esc(f.agent) : '') + ' · <b>' + pluriel(base.length, 'ticket') + '</b>';
    let specifique = '';
    if (f.typo === 'REC') {
      specifique = '<h3 class="st-section">Indicateurs Réclamation</h3><div class="st-ligne-2">' + blocAvoirs(base) + blocGestes(base) + '</div>';
    } else if (f.typo === 'RCV') {
      specifique = '<h3 class="st-section">Indicateurs Recouvrement</h3>' + kpiRecouvrement(base) +
        '<div class="st-grille">' + tableImpayes(base) + syntheseRejets(base) + tableRejets(base) + '</div>';
    } else if (f.typo) {
      specifique = '<h3 class="st-section">Indicateurs ' + esc(T.libelle) + '</h3><p class="st-aide">Aucun indicateur propre à cette typologie : les visuels communs ci-dessus tiennent compte du filtre.</p>';
    } else {
      specifique = '<p class="st-aide st-invite">Choisissez une typologie dans les filtres pour afficher ses indicateurs propres (Réclamation : avoirs et gestes commerciaux ; Recouvrement : impayés, rejets et montants).</p>';
    }
    $('#stContenu').innerHTML = '<h3 class="st-section">Indicateurs communs</h3><div class="st-grille">' +
      graphiqueMensuel(typeAgent, du, au) + matrice(base) + '<div class="st-ligne-agents">' + blocAgents(base) + '</div></div>' + specifique;
  }

  /* ---------- Activité mensuelle : entrants, traités, reliquat ---------- */
  function graphiqueMensuel(tickets, du, au) {
    const mois = [];
    const d = new Date(du || AUJOURDHUI); d.setDate(1); d.setHours(0, 0, 0, 0);
    const finPeriode = au || AUJOURDHUI;
    while (d.getTime() <= finPeriode && mois.length < 36) {
      const debut = d.getTime(); d.setMonth(d.getMonth() + 1); const fin = d.getTime() - 1;
      mois.push({ debut, fin, lib: new Date(debut).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) });
    }
    const series = mois.map((m) => ({
      lib: m.lib,
      entrants: tickets.filter((t) => t.dateCreation >= m.debut && t.dateCreation <= m.fin).length,
      traites: tickets.filter((t) => t.dateResolution && t.dateResolution >= m.debut && t.dateResolution <= m.fin).length,
      reliquat: tickets.filter((t) => t.dateCreation <= m.fin && (!t.dateResolution || t.dateResolution > m.fin)).length
    }));
    const COUL = { entrants: '#EB6200', traites: '#2F8F4E', reliquat: '#5B7FA6' };
    const LIB = { entrants: 'Entrants', traites: 'Traités', reliquat: 'Reliquat fin de mois' };
    const max = Math.max(1, ...series.map((s) => Math.max(s.entrants, s.traites, s.reliquat)));
    const pas = Math.max(1, Math.ceil(max / 5 / 5) * 5);
    const haut = Math.ceil(max / pas) * pas;
    const G = 46, H = 230, B = 32, largeurMois = 74, larg = G + series.length * largeurMois + 10;
    const y = (v) => 14 + (H - 14) * (1 - v / haut);
    let svg = '';
    for (let v = 0; v <= haut; v += pas) {
      svg += '<line x1="' + G + '" x2="' + (larg - 6) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e3e3e3"/>' +
        '<text x="' + (G - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#777">' + v + '</text>';
    }
    series.forEach((s, i) => {
      const x0 = G + i * largeurMois + 9;
      ['entrants', 'traites', 'reliquat'].forEach((k, j) => {
        const x = x0 + j * 19, h = y(0) - y(s[k]);
        svg += '<rect x="' + x + '" y="' + y(s[k]) + '" width="17" height="' + Math.max(0, h) + '" fill="' + COUL[k] + '"><title>' + esc(s.lib + ' – ' + LIB[k] + ' : ' + s[k]) + '</title></rect>';
        if (s[k]) svg += '<text x="' + (x + 8.5) + '" y="' + (y(s[k]) - 3) + '" text-anchor="middle" font-size="10" fill="#444">' + s[k] + '</text>';
      });
      svg += '<text x="' + (x0 + 27) + '" y="' + (H + 16) + '" text-anchor="middle" font-size="11" fill="#555">' + esc(s.lib) + '</text>';
    });
    svg = '<svg viewBox="0 0 ' + larg + ' ' + (H + B) + '" width="' + larg + '" role="img" aria-labelledby="stGraphTitre" class="st-graph"><title id="stGraphTitre">Tickets entrants, traités et reliquat par mois</title>' +
      '<line x1="' + G + '" x2="' + (larg - 6) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#999"/>' + svg + '</svg>';
    const legende = '<div class="st-legende">' + Object.keys(LIB).map((k) => '<span><i style="background:' + COUL[k] + '"></i>' + esc(LIB[k]) + '</span>').join('') + '</div>';
    const donnees = '<details class="st-donnees"><summary>Voir les données</summary><div class="st-wrap"><table class="st-table st-mini"><thead><tr><th class="g" scope="col">Mois</th>' +
      series.map((s) => '<th scope="col">' + esc(s.lib) + '</th>').join('') + '</tr></thead><tbody>' +
      ['entrants', 'traites', 'reliquat'].map((k) => '<tr><td class="g">' + esc(LIB[k]) + '</td>' + series.map((s) => '<td>' + s[k] + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div></details>';
    return '<section class="st-bloc" aria-labelledby="stGraphCap"><h4 class="st-cap" id="stGraphCap">Activité mensuelle</h4>' + legende +
      '<div class="st-wrap st-graph-wrap">' + svg + '</div>' + donnees +
      '<p class="st-aide">Entrants : tickets créés dans le mois. Traités : tickets passés en Résolu ou Rejeté dans le mois. Reliquat : tickets non traités à la fin du mois. Le graphique suit la typologie et l’agent filtrés.</p></section>';
  }

  /* ---------- Tickets par état et par sous-typologie ---------- */
  function matrice(base) {
    const cols = [
      ['OUV', 'Ouvert'], ['NA', 'dont non affectés'], ['ARP', 'Attente retour partenaire'], ['AAR', 'Attente arbitrage'],
      ['RES', 'Résolu'], ['REJ', 'Rejeté'], ['FER', 'Fermé']
    ];
    const ligne = (lib, c, p, classe, bouton) => '<tr' + (classe ? ' class="' + classe + '"' : '') + '><td class="g">' + (bouton || esc(lib)) + '</td>' +
      cols.map(([k]) => '<td' + (k === 'RES' ? ' class="sep"' : '') + '>' + nbLien(c[k], Object.assign({}, p, k === 'NA' ? { etat: 'OUV', agent: '__NA__' } : { etat: k })) + '</td>').join('') +
      '<td class="sep"><b>' + nbLien(c.total, Object.assign({}, p, { etat: 'TOUS' })) + '</b></td>' +
      '<td>' + (c.dNb ? fmtNb.format(c.dSom / c.dNb) + ' j' : '–') + '</td></tr>';
    const Tf = PHX.typo(stats.f.typo);
    let corps = '';
    if (Tf) {
      Tf.sous.forEach((S) => { corps += ligne(S.libelle, compter(base.filter((t) => t.sous === S.code)), { typo: Tf.code, sous: S.code }); });
    } else {
      PHX.TYPOLOGIES.forEach((T) => {
        const tt = base.filter((t) => t.typo === T.code);
        const ouvert = !!stats.deplies[T.code];
        const bouton = '<button type="button" class="deplier" data-deplier="' + T.code + '" aria-expanded="' + ouvert + '"><span aria-hidden="true">' + (ouvert ? '▼' : '▶') + '</span>' + esc(T.libelle) + '</button>';
        corps += ligne(T.libelle, compter(tt), { typo: T.code }, '', bouton);
        if (ouvert) T.sous.forEach((S) => { corps += ligne(S.libelle, compter(tt.filter((t) => t.sous === S.code)), { typo: T.code, sous: S.code }, 'sous'); });
      });
    }
    corps += ligne('TOTAL', compter(base), {}, 'total');
    return '<div><div class="st-wrap"><table class="st-table"><caption>' + (Tf ? 'Tickets par sous-typologie et par état – ' + esc(Tf.libelle) : 'Tickets par typologie, sous-typologie et état') + '</caption><thead><tr>' +
      '<th class="g" scope="col">' + (Tf ? 'Sous-typologie' : 'Typologie') + '</th>' +
      cols.map(([k, lib]) => '<th scope="col"' + (k === 'RES' ? ' class="sep"' : '') + '>' + esc(lib) + '</th>').join('') +
      '<th scope="col" class="sep">Total</th><th scope="col" title="De la création à la date de résolution">Délai moyen de résolution</th></tr></thead><tbody>' +
      corps + '</tbody></table></div>' +
      '<p class="st-aide">' + (Tf ? '' : 'Cliquez sur une typologie pour afficher ses sous-typologies. ') + 'Chaque nombre ouvre la liste des tickets correspondante.</p></div>';
  }

  function kv(lib, val, verrou, classe) {
    return '<tr' + (classe ? ' class="' + classe + '"' : '') + '><td class="g">' + esc(lib) + '</td>' + (verrou ? '<td class="verrou">🔒 Profils habilités</td>' : '<td class="v">' + val + '</td>') + '</tr>';
  }
  const somme = (arr, fn) => arr.reduce((s, t) => s + (fn(t) || 0), 0);
  const tranche = (t) => !!PHX.etat(t.etat).tranche;

  /* ---------- Réclamation ---------- */
  function blocAvoirs(base) {
    const m = !profil().montants;
    const rf = base.filter((t) => t.typo === 'REC' && t.sous === 'FAC');
    const enCours = rf.filter((t) => PHX.etat(t.etat).actif);
    const tr = rf.filter(tranche);
    const acc = tr.filter((t) => t.champs.avoirAccorde === true);
    const trAvecMontant = tr.filter((t) => t.champs.montantReclame);
    const reclame = somme(trAvecMontant, (t) => t.champs.montantReclame);
    const accordeSurReclame = somme(trAvecMontant, (t) => t.champs.avoirAccorde ? t.champs.montantAvoirHT : 0);
    const accordeTotal = somme(acc, (t) => t.champs.montantAvoirHT);
    const encours = somme(enCours, (t) => t.champs.montantReclame);
    return '<div><div class="st-wrap"><table class="st-table st-kv"><caption>Avoirs – Réclamation › Facturation</caption><tbody>' +
      kv('Réclamations facturation', nbLien(rf.length, { typo: 'REC', sous: 'FAC', etat: 'TOUS' })) +
      kv('En cours de traitement', nbLien(enCours.length, { typo: 'REC', sous: 'FAC', etat: 'ACTIFS' })) +
      kv('Tranchées (résolues, rejetées, fermées)', String(tr.length)) +
      kv('Avoirs accordés', acc.length + (tr.length ? ' <small>(' + fmtPct.format(acc.length / tr.length) + ' des tranchées)</small>' : '')) +
      kv('Montant réclamé HT (tranchées)', esc(fmtEur.format(reclame)), m) +
      kv('Montant avoir accordé HT', esc(fmtEur.format(accordeTotal)), m) +
      kv('Taux accordé / réclamé', reclame ? fmtPct.format(accordeSurReclame / reclame) : '–', m) +
      kv('Montant réclamé HT en cours', esc(fmtEur.format(encours)), m) +
      '</tbody></table></div><p class="st-aide">Le taux compare, sur les réclamations tranchées, le montant d’avoir accordé au montant réclamé.</p></div>';
  }

  function blocGestes(base) {
    const m = !profil().montants;
    const tr = base.filter((t) => t.typo === 'REC' && tranche(t));
    const accordes = (l) => l.filter((t) => t.champs.gesteAccorde === true);
    const montant = (l) => m ? '🔒' : esc(fmtEur.format(somme(accordes(l), (t) => t.champs.montantGesteHT)));
    const lignes = PHX.typo('REC').sous.map((S) => {
      const l = tr.filter((t) => t.sous === S.code);
      return '<tr><td class="g">' + esc(S.libelle) + '</td><td>' + l.length + '</td><td>' + accordes(l).length + '</td><td class="num">' + montant(l) + '</td></tr>';
    }).join('');
    const g = accordes(tr).length;
    return '<div><div class="st-wrap"><table class="st-table"><caption>Gestes commerciaux accordés – Réclamation</caption><thead><tr>' +
      '<th class="g" scope="col">Sous-typologie</th><th scope="col">Tranchées</th><th scope="col">Gestes co accordés</th><th scope="col">Montant HT</th></tr></thead><tbody>' +
      lignes + '<tr class="total"><td class="g">TOTAL</td><td>' + tr.length + '</td><td>' + g + (tr.length ? ' <small>(' + fmtPct.format(g / tr.length) + ')</small>' : '') + '</td><td class="num">' + montant(tr) + '</td></tr>' +
      '</tbody></table></div><p class="st-aide">Réclamations tranchées : Résolu, Rejeté ou Fermé. Un geste co peut s’ajouter à un avoir.</p></div>';
  }

  /* ---------- Recouvrement ---------- */
  const reclameRcv = (t) => t.champs.montantHTReclame || 0;
  const recouvreRcv = (t) => t.champs.montantRecouvreHT || 0;
  const irrecRcv = (t) => (t.champs.causeIrrecouvrable ? Math.max(0, reclameRcv(t) - recouvreRcv(t)) : 0);
  const resteRcv = (t) => Math.max(0, reclameRcv(t) - recouvreRcv(t) - irrecRcv(t));
  const eur = (v) => (profil().montants ? esc(fmtEur.format(v)) : '🔒');

  function kpiRecouvrement(base) {
    const m = !profil().montants;
    const rc = base.filter((t) => t.typo === 'RCV');
    const imp = rc.filter((t) => t.sous === 'IMP').length;
    const reclame = somme(rc, reclameRcv), recouvre = somme(rc, recouvreRcv), irrec = somme(rc, irrecRcv), reste = somme(rc, resteRcv);
    const taux = (v) => (reclame ? ' <small>(' + fmtPct.format(v / reclame) + ')</small>' : '');
    return '<div class="st-wrap st-kpi-wrap"><table class="st-table st-kv st-kpi"><caption>Synthèse des montants – Recouvrement</caption><tbody>' +
      kv('Dossiers', nbLien(rc.length, { typo: 'RCV', etat: 'TOUS' }) + ' <small>(' + imp + ' impayés, ' + (rc.length - imp) + ' rejets de prélèvement)</small>') +
      kv('En cours de traitement', nbLien(rc.filter((t) => PHX.etat(t.etat).actif).length, { typo: 'RCV', etat: 'ACTIFS' })) +
      kv('Montant HT à récupérer (réclamé)', eur(reclame), m) +
      kv('Montant recouvré HT', eur(recouvre) + (m ? '' : taux(recouvre)), m) +
      kv('Montant irrécouvrable HT', eur(irrec) + (m ? '' : taux(irrec)), m) +
      PHX.CAUSES_IRRECOUVRABLES.map((c) => {
        const l = rc.filter((t) => t.champs.causeIrrecouvrable === c);
        return kv('dont ' + c.toLowerCase() + ' (' + pluriel(l.length, 'dossier') + ')', eur(somme(l, irrecRcv)), m, 'st-sous-kv');
      }).join('') +
      kv('Reste à recouvrer HT', eur(reste) + (m ? '' : taux(reste)), m, 'st-total-kv') +
      '</tbody></table></div><p class="st-aide">Irrécouvrable : reste dû des dossiers pour lesquels une cause est indiquée (compte clos, facture indue, liquidation judiciaire). Reste à recouvrer = réclamé − recouvré − irrécouvrable.</p>';
  }

  function pagine(cle, lignes, parPage) {
    const nb = Math.max(1, Math.ceil(lignes.length / parPage));
    const pg = Math.min(stats.pages[cle] || 1, nb);
    let pager = '';
    if (nb > 1) {
      for (let i = 1; i <= nb; i++) pager += '<button type="button" data-st-table="' + cle + '" data-st-page="' + i + '"' + (i === pg ? ' aria-current="page"' : '') + '>' + i + '</button>';
      pager = '<div class="nc-pager">' + pager + '<span class="info">Page ' + pg + ' / ' + nb + '</span></div>';
    }
    return { vue: lignes.slice((pg - 1) * parPage, pg * parPage), pager };
  }

  function tableImpayes(base) {
    const l = base.filter((t) => t.typo === 'RCV' && t.sous === 'IMP').sort((a, b) => resteRcv(b) - resteRcv(a) || (a.champs.dateEcheance || 0) - (b.champs.dateEcheance || 0));
    const { vue, pager } = pagine('imp', l, 10);
    const tot = (fn) => eur(somme(l, fn));
    return '<section id="st_imp"><div class="st-wrap"><table class="st-table st-liste"><caption>Impayés (' + l.length + ')</caption><thead><tr>' +
      '<th scope="col">N° ticket</th><th class="g" scope="col">Partenaire</th><th scope="col">Facture</th><th scope="col">Échéance</th><th scope="col">Réclamé HT</th>' +
      '<th scope="col">Recouvré HT</th><th scope="col">Irrécouvrable HT</th><th scope="col">Reste dû HT</th><th scope="col">État</th><th class="g" scope="col">Cause</th></tr></thead><tbody>' +
      (vue.length ? vue.map((t) => '<tr><td><a href="#/ticket/' + t.id + '">' + t.id + '</a></td><td class="g">' + esc(t.partenaireCode + ' – ' + t.partenaireRS) + '</td>' +
        '<td>' + esc(t.champs.numFactureImpayee || '') + '</td><td>' + fDate(t.champs.dateEcheance) + '</td><td class="num">' + eur(reclameRcv(t)) + '</td><td class="num">' + eur(recouvreRcv(t)) + '</td>' +
        '<td class="num">' + eur(irrecRcv(t)) + '</td><td class="num"><b>' + eur(resteRcv(t)) + '</b></td><td>' + badgeEtat(t.etat) + '</td><td class="g">' + esc(t.champs.causeIrrecouvrable || '') + '</td></tr>').join('')
        : '<tr><td colspan="10">Aucun impayé sur la période.</td></tr>') +
      '<tr class="total"><td colspan="4" class="g">TOTAL</td><td class="num">' + tot(reclameRcv) + '</td><td class="num">' + tot(recouvreRcv) + '</td><td class="num">' + tot(irrecRcv) + '</td><td class="num">' + tot(resteRcv) + '</td><td colspan="2"></td></tr>' +
      '</tbody></table></div>' + pager + '<p class="st-aide">Triés par reste dû décroissant.</p></section>';
  }

  function syntheseRejets(base) {
    const l = base.filter((t) => t.typo === 'RCV' && t.sous === 'REJ');
    const ligne = (lib, x, classe) => '<tr' + (classe ? ' class="' + classe + '"' : '') + '><td class="g">' + esc(lib) + '</td><td>' + x.length + '</td><td>' + x.filter((t) => PHX.etat(t.etat).actif).length + '</td>' +
      '<td class="num">' + eur(somme(x, reclameRcv)) + '</td><td class="num">' + eur(somme(x, recouvreRcv)) + '</td><td class="num">' + eur(somme(x, irrecRcv)) + '</td><td class="num">' + eur(somme(x, resteRcv)) + '</td></tr>';
    return '<div class="st-wrap"><table class="st-table"><caption>Rejets de prélèvement – synthèse par motif</caption><thead><tr><th class="g" scope="col">Motif du rejet</th>' +
      '<th scope="col">Rejets</th><th scope="col">En cours</th><th scope="col">Réclamé HT</th><th scope="col">Recouvré HT</th><th scope="col">Irrécouvrable HT</th><th scope="col">Reste dû HT</th></tr></thead><tbody>' +
      PHX.MOTIFS_REJET.map((mo) => ligne(mo, l.filter((t) => t.champs.motifRejet === mo))).join('') + ligne('TOTAL', l, 'total') + '</tbody></table></div>';
  }

  function tableRejets(base) {
    const l = base.filter((t) => t.typo === 'RCV' && t.sous === 'REJ').sort((a, b) => (b.champs.dateRejet || 0) - (a.champs.dateRejet || 0));
    const { vue, pager } = pagine('rej', l, 10);
    return '<section id="st_rej"><div class="st-wrap"><table class="st-table st-liste"><caption>Rejets de prélèvement – détail (' + l.length + ')</caption><thead><tr>' +
      '<th scope="col">N° ticket</th><th class="g" scope="col">Partenaire</th><th scope="col">Date du rejet</th><th class="g" scope="col">Motif</th><th scope="col">RUM</th>' +
      '<th scope="col">Réclamé HT</th><th scope="col">Recouvré HT</th><th scope="col">Reste dû HT</th><th scope="col">État</th><th class="g" scope="col">Cause</th></tr></thead><tbody>' +
      (vue.length ? vue.map((t) => '<tr><td><a href="#/ticket/' + t.id + '">' + t.id + '</a></td><td class="g">' + esc(t.partenaireCode + ' – ' + t.partenaireRS) + '</td>' +
        '<td>' + fDate(t.champs.dateRejet) + '</td><td class="g">' + esc(t.champs.motifRejet || '') + '</td><td>' + esc(t.champs.rum || '') + '</td>' +
        '<td class="num">' + eur(reclameRcv(t)) + '</td><td class="num">' + eur(recouvreRcv(t)) + '</td><td class="num"><b>' + eur(resteRcv(t)) + '</b></td><td>' + badgeEtat(t.etat) + '</td><td class="g">' + esc(t.champs.causeIrrecouvrable || '') + '</td></tr>').join('')
        : '<tr><td colspan="10">Aucun rejet sur la période.</td></tr>') +
      '</tbody></table></div>' + pager + '</section>';
  }

  /* ---------- Charge par agent ---------- */
  function blocAgents(base) {
    const actifs = base.filter((t) => PHX.etat(t.etat).actif);
    const parAgent = {};
    actifs.forEach((t) => {
      if (!t.agent) return;
      const a = parAgent[t.agent] = parAgent[t.agent] || { OUV: 0, ARP: 0, AAR: 0, total: 0 };
      a[t.etat]++; a.total++;
    });
    const na = actifs.filter((t) => !t.agent).length;
    const agents = Object.keys(parAgent).sort((x, y) => parAgent[y].total - parAgent[x].total || (x < y ? -1 : 1));
    const lignes = (stats.f.agent ? '' : '<tr><td class="g"><span class="nc-non-affecte">Non affectés</span></td><td>' + nbLien(na, { etat: 'OUV', agent: '__NA__' }) + '</td><td></td><td></td><td class="sep"><b>' + nbLien(na, { etat: 'OUV', agent: '__NA__' }) + '</b></td></tr>') +
      agents.map((a) => {
        const c = parAgent[a];
        return '<tr><td class="g" title="' + esc(PHX.EQUIPES[a] || '') + '">' + esc(a) + '</td>' +
          ['OUV', 'ARP', 'AAR'].map((k) => '<td>' + nbLien(c[k], { etat: k, agent: a }) + '</td>').join('') +
          '<td class="sep"><b>' + nbLien(c.total, { etat: 'ACTIFS', agent: a }) + '</b></td></tr>';
      }).join('');
    // Ligne de total par état (non affectés compris dans « Ouvert »)
    const parEtat = (k) => actifs.filter((t) => t.etat === k).length;
    const total = actifs.length ? '<tr class="total"><td class="g">TOTAL</td>' +
      ['OUV', 'ARP', 'AAR'].map((k) => '<td>' + nbLien(parEtat(k), { etat: k }) + '</td>').join('') +
      '<td class="sep">' + nbLien(actifs.length, { etat: 'ACTIFS' }) + '</td></tr>' : '';
    return '<div><div class="st-wrap"><table class="st-table"><caption>Charge par agent (tickets en cours)</caption><thead><tr>' +
      '<th class="g" scope="col">Agent</th><th scope="col">Ouvert</th><th scope="col" title="Attente retour partenaire">Att. retour partenaire</th>' +
      '<th scope="col" title="Attente arbitrage">Att. arbitrage</th><th scope="col" class="sep">Total</th></tr></thead><tbody>' +
      (lignes || '<tr><td colspan="5">Aucun ticket en cours.</td></tr>') + total + '</tbody></table></div></div>';
  }

  /* =====================================================================
   * Fenêtre modale générique
   * ===================================================================== */
  let modale = null, focusAvant = null;
  function ouvrirModal(o) {
    fermerModal();
    focusAvant = document.activeElement;
    const fond = document.createElement('div');
    fond.className = 'nc-modal-fond';
    fond.innerHTML = '<div class="nc-modal' + (o.petit ? ' nc-modal-petit' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modalTitre">' +
      '<div class="nc-modal-entete"><h2 id="modalTitre">' + esc(o.titre) + '</h2><button type="button" data-fermer aria-label="Fermer">×</button></div>' +
      '<div class="nc-modal-corps">' + o.corps + '</div><div class="nc-modal-pied">' + o.pied + '</div></div>';
    document.body.appendChild(fond);
    fond.addEventListener('mousedown', (e) => { fond._cibleFond = e.target === fond; });
    fond.addEventListener('click', (e) => {
      if ((e.target === fond && fond._cibleFond) || e.target.closest('[data-fermer]')) fermerModal();
    });
    modale = fond;
    const premier = $(o.focus || 'button, select, input', fond);
    if (premier) premier.focus();
    return fond;
  }
  function fermerModal() {
    if (!modale) return;
    modale.remove(); modale = null;
    if (focusAvant && document.contains(focusAvant)) focusAvant.focus();
  }

  /* =====================================================================
   * Menu rapide, liens hors maquette, identité
   * ===================================================================== */
  function fermerMenuRapide() { $('#menuRapide').hidden = true; $('#btnMenuRapide').setAttribute('aria-expanded', 'false'); }
  $('#btnMenuRapide').addEventListener('click', (e) => {
    e.stopPropagation();
    const l = $('#menuRapide');
    l.hidden = !l.hidden;
    $('#btnMenuRapide').setAttribute('aria-expanded', String(!l.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nc-menu-rapide')) fermerMenuRapide();
    const lienDM = e.target.closest('[data-dm]');
    if (lienDM) { e.preventDefault(); ouvrirDemande(+lienDM.getAttribute('data-dm')); return; }
    const hm = e.target.closest('[data-hors-maquette]');
    if (hm) { e.preventDefault(); toast(hm.getAttribute('data-msg') || 'Hors périmètre de la maquette Tickets.'); }
  });
  function majIdentite() {
    $('#idNom').textContent = profil().nom;
    $('#idGroupe').textContent = profil().groupe;
  }

  /* =====================================================================
   * Panneau de simulation (ne fait pas partie de l'écran cible)
   * ===================================================================== */
  const panneau = $('#simPanneau');
  function ouvrirSim(ouvrir) {
    panneau.hidden = !ouvrir;
    $('#btnSim').setAttribute('aria-expanded', String(ouvrir));
    if (ouvrir) { rendreSim(); const b = $('[data-sim-fermer]', panneau); if (b) b.focus(); }
    else $('#btnSim').focus();
  }
  $('#btnSim').addEventListener('click', () => ouvrirSim(panneau.hidden));

  function rendreSim() {
    const typoSel = (panneau._typo || '');
    panneau.innerHTML =
      '<div class="sim-entete"><h2>Simulation</h2><button type="button" data-sim-fermer aria-label="Fermer le panneau">×</button></div>' +
      '<p class="sim-sous">Outil de démonstration pour l’équipe SI : il ne fait pas partie de l’écran cible. Données 100 % fictives.</p>' +
      '<h3>Profil connecté</h3>' +
      Object.keys(PHX.PROFILS).map((k) => {
        const p = PHX.PROFILS[k];
        return '<label class="radio"><input type="radio" name="simProfil" value="' + k + '"' + (store.profil === k ? ' checked' : '') + '><span><b>' + esc(p.libelle) + '</b>' +
          '<small>' + esc(p.login) + (p.montants ? ' · voit les montants' : ' · ne voit pas les montants (RG-15)') + '</small></span></label>';
      }).join('') +
      '<p class="sim-sous">Chaque utilisateur garde sa propre sélection de colonnes.</p>' +
      '<h3>Référentiel des champs</h3>' +
      '<p>Ajoutez un champ comme le ferait un administrateur fonctionnel : il devient aussitôt une colonne proposée dans « Colonnes… » et exportable en .csv.</p>' +
      '<div class="sim-form">' +
      '<label for="simLib">Libellé du champ</label><input type="text" id="simLib" maxlength="40" placeholder="ex. Date de mise en service">' +
      '<label for="simType">Type</label><select id="simType"><option value="texte">Texte</option><option value="montant">Montant HT</option><option value="date">Date</option><option value="booleen">Oui / Non</option><option value="nombre">Nombre</option></select>' +
      '<label for="simTypo">Typologie</label><select id="simTypo"><option value="">Toutes</option>' + PHX.TYPOLOGIES.map((t) => '<option value="' + t.code + '"' + (t.code === typoSel ? ' selected' : '') + '>' + esc(t.libelle) + '</option>').join('') + '</select>' +
      '<label for="simSous">Sous-typologie</label><select id="simSous"' + (typoSel ? '' : ' disabled') + '><option value="">Toutes</option>' + (typoSel ? PHX.typo(typoSel).sous.map((s) => '<option value="' + s.code + '">' + esc(s.libelle) + '</option>').join('') : '') + '</select>' +
      '<label class="check"><input type="checkbox" id="simSensible"> Montant confidentiel (RG-15)</label>' +
      '<button type="button" class="nc-btn nc-btn-orange" id="simAjout">Ajouter au référentiel</button>' +
      '</div>' +
      (store.champsAjoutes.length ? '<ul class="sim-liste">' + store.champsAjoutes.map((c) =>
        '<li><span><b>' + esc(c.libelle) + '</b><br><small>' + esc(PHX.groupeChamp(c)) + '</small></span><button type="button" data-sim-suppr="' + esc(c.code) + '">Retirer</button></li>').join('') + '</ul>' : '') +
      '<h3>Données de démonstration</h3>' +
      '<p class="sim-sous">' + TICKETS.length + ' tickets, ' + PHX.PARTENAIRES.length + ' partenaires fictifs. Jeu de données figé, dates décalées sur la semaine en cours.' +
      (Object.keys(store.tickets).length ? ' ' + pluriel(Object.keys(store.tickets).length, 'ticket') + ' mis à jour dans la démo.' : '') +
      (Object.keys(store.nouveaux).length ? ' ' + pluriel(Object.keys(store.nouveaux).length, 'ticket') + ' créé(s) dans la démo.' : '') +
      ' ' + pluriel(DEMANDES.length, 'demande') + ' de modification' + (Object.keys(store.demandes).length ? ', dont ' + Object.keys(store.demandes).length + ' créée(s) ou modifiée(s) dans la démo' : '') + '.</p>' +
      '<button type="button" class="nc-btn" id="simRaz">Réinitialiser la démo</button>' +
      '<p class="sim-sous">Efface les colonnes choisies, les champs ajoutés, les mises à jour de tickets, les demandes de modification et le profil sélectionné.</p>';

    $$('input[name="simProfil"]', panneau).forEach((r) => r.addEventListener('change', () => {
      store.profil = r.value; sauver(); majIdentite(); naviguer(); rendreSim();
      toast('Connecté(e) en tant que ' + profil().login + ' (' + profil().libelle + ').');
    }));
    $('#simTypo', panneau).addEventListener('change', (e) => {
      panneau._typo = e.target.value;
      const lib = $('#simLib', panneau).value, type = $('#simType', panneau).value, sens = $('#simSensible', panneau).checked;
      rendreSim();
      $('#simLib', panneau).value = lib; $('#simType', panneau).value = type; $('#simSensible', panneau).checked = sens;
      $('#simTypo', panneau).focus();
    });
    $('#simType', panneau).addEventListener('change', (e) => { $('#simSensible', panneau).checked = e.target.value === 'montant'; });
    $('#simLib', panneau).addEventListener('keydown', (e) => { if (e.key === 'Enter') ajouterChamp(); });
    $('#simAjout', panneau).addEventListener('click', ajouterChamp);
    $$('[data-sim-suppr]', panneau).forEach((b) => b.addEventListener('click', () => retirerChamp(b.getAttribute('data-sim-suppr'))));
    $('#simRaz', panneau).addEventListener('click', reinitialiser);
    $('[data-sim-fermer]', panneau).addEventListener('click', () => ouvrirSim(false));
  }

  function ajouterChamp() {
    const lib = $('#simLib', panneau).value.trim();
    if (!lib) { toast('Saisissez le libellé du champ.'); $('#simLib', panneau).focus(); return; }
    const typo = $('#simTypo', panneau).value, sous = $('#simSous', panneau).value;
    const c = {
      code: 'x_' + norm(lib).replace(/[^a-z0-9]+/g, '_').slice(0, 24) + '_' + Date.now().toString(36),
      libelle: lib, type: $('#simType', panneau).value, ajoute: true,
      sensible: $('#simSensible', panneau).checked,
      portee: typo ? { typo: typo, sous: sous ? [sous] : undefined } : undefined
    };
    if (catalogue().some((x) => norm(x.libelle) === norm(lib) && PHX.groupeChamp(x) === PHX.groupeChamp(c))) {
      toast('Un champ « ' + lib + ' » existe déjà pour ' + PHX.groupeChamp(c) + '.'); return;
    }
    store.champsAjoutes.push(c);
    sauver();
    appliquerChampsAjoutes();
    panneau._typo = '';
    rendreSim();
    rafraichirSiListe();
    toast('Champ « ' + lib + ' » ajouté : il est proposé dans « Colonnes… » (' + PHX.groupeChamp(c) + ').');
  }
  function retirerChamp(code) {
    store.champsAjoutes = store.champsAjoutes.filter((c) => c.code !== code);
    Object.keys(store.colonnes).forEach((k) => { store.colonnes[k] = (store.colonnes[k] || []).filter((x) => x !== code); });
    TICKETS.forEach((t) => { delete t.champs[code]; });
    sauver(); rendreSim(); rafraichirSiListe();
  }
  function reinitialiser() {
    store.profil = 'agent'; store.colonnes = {}; store.champsAjoutes = []; store.tickets = {}; store.demandes = {}; store.nouveaux = {};
    genererDonnees();
    ctxDM = { cle: null };
    ctxPT = { cle: null };
    ctxPD = { cle: null };
    ctxGD = null;
    try { window.localStorage.removeItem(CLE); } catch (e) { /* ignoré */ }
    majIdentite(); naviguer(); rendreSim();
    toast('Démo réinitialisée.');
  }
  function rafraichirSiListe() {
    const r = lireRoute();
    if ($('#grilleWrap')) rafraichirListe();
    const m = r.chemin.match(/^\/ticket\/(\d+)$/);
    if (m) pageTicket(+m[1]);
  }

  /* =====================================================================
   * Démarrage
   * ===================================================================== */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modale) fermerModal();
    else if (!panneau.hidden) ouvrirSim(false);
    else fermerMenuRapide();
  });
  window.addEventListener('hashchange', naviguer);
  charger();
  appliquerChampsAjoutes();
  appliquerNouveaux();
  appliquerMisesAJour();
  appliquerDemandes();
  majIdentite();
  capaciteTelechargement();
  naviguer();
})();
