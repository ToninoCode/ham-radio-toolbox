import type { MessageTree } from "../types";

/**
 * Italian catalog: the reference catalog of the application (ADR-0008).
 * Every other locale must satisfy `CatalogShape<typeof it>`.
 */
export const it = {
  app: {
    name: "Ham Radio Toolbox",
    tagline: "Cassetta degli attrezzi per radioamatori e SWL",
    documentTitle: "{page} · Ham Radio Toolbox",
    skipToContent: "Vai al contenuto principale",
  },
  nav: {
    primary: "Navigazione principale",
    compact: "Navigazione rapida",
    home: "Dashboard",
    more: "Altro",
    openMenu: "Apri il menu con tutti i moduli",
    closeMenu: "Chiudi il menu",
    menuTitle: "Tutti i moduli",
  },
  areas: {
    ham: {
      title: "Area HAM",
      short: "HAM",
      description: "Strumenti per l'attività radioamatoriale.",
    },
    swl: {
      title: "Area SWL",
      short: "SWL",
      description: "Strumenti per l'ascolto e l'identificazione dei segnali.",
    },
    shared: {
      title: "Strumenti condivisi",
      short: "Comuni",
      description: "Strumenti utili sia ai radioamatori sia agli SWL.",
    },
  },
  workspace: {
    label: "Workspace",
    all: "Tutti",
    ham: "HAM",
    swl: "SWL",
  },
  connection: {
    online: "Online",
    offline: "Offline",
    onlineDescription: "Connessione di rete disponibile.",
    offlineDescription:
      "Nessuna connessione di rete: restano disponibili le funzioni offline.",
  },
  clock: {
    label: "Ora UTC corrente",
    utc: "UTC",
  },
  theme: {
    label: "Tema",
    system: "Sistema",
    light: "Chiaro",
    dark: "Scuro",
  },
  availability: {
    available: "Disponibile",
    inDevelopment: "In sviluppo",
    plannedIn: "Milestone {milestone}",
  },
  dashboard: {
    intro:
      "Accesso rapido a tutti i moduli. I moduli contrassegnati come “In sviluppo” non contengono ancora funzioni né dati.",
    modulesHeading: "Moduli",
    moduleCount: {
      one: "{count} modulo",
      other: "{count} moduli",
    },
    openModule: "Apri {module}",
    favorites: {
      title: "Preferiti",
      empty:
        "Nessun modulo preferito. Tocca la stella su una scheda per fissarla qui.",
      notPersisted:
        "I preferiti restano solo fino alla chiusura dell'app: il salvataggio arriverà con la milestone M2.",
      add: "Aggiungi {module} ai preferiti",
      remove: "Rimuovi {module} dai preferiti",
    },
    clock: {
      title: "Ora UTC",
      date: "Data UTC",
    },
    dataFreshness: {
      title: "Freschezza dei dati",
      empty: "Nessuna fonte importata.",
      note: "Fonte, età e scadenza dei dati esterni compariranno qui dopo il primo import (dalla milestone M5).",
    },
  },
  underDevelopment: {
    body: "Questo modulo non è ancora disponibile: non contiene funzioni né dati.",
    planned: "È previsto nella milestone {milestone} della roadmap.",
    backToDashboard: "Torna alla dashboard",
  },
  notFound: {
    title: "Pagina non trovata",
    body: "L'indirizzo {path} non corrisponde a nessuna sezione dell'app.",
    backToDashboard: "Torna alla dashboard",
  },
  modules: {
    dashboard: {
      title: "Dashboard",
      description:
        "Accesso a tutti i moduli, workspace HAM e SWL, stato dell'app.",
    },
    "ham-logbook": {
      title: "Logbook HAM",
      description: "Registro dei QSO con import ed export ADIF e statistiche.",
    },
    "swl-logbook": {
      title: "Logbook SWL",
      description:
        "Registro delle ricezioni in sette categorie, con SINPO ed export.",
    },
    "frequency-explorer": {
      title: "Frequency Explorer",
      description:
        "Palinsesti broadcast EiBi e HFCC importati e memorie di frequenza.",
    },
    "signal-explorer": {
      title: "Signal Explorer",
      description: "Catalogo per l'identificazione dei segnali radio.",
    },
    "satellite-explorer": {
      title: "Satellite Explorer",
      description: "Elementi orbitali, transmitter e previsione dei passaggi.",
    },
    "resource-manager": {
      title: "Risorse",
      description: "Segnalibri e documenti tecnici, con import da Raindrop.",
    },
    "dx-cluster": {
      title: "DX Cluster",
      description: "Accesso ai cluster DX e filtri degli spot.",
    },
    "qsl-manager": {
      title: "QSL Manager",
      description: "Stato delle conferme QSL cartacee ed elettroniche.",
    },
    "aprs-explorer": {
      title: "APRS Explorer",
      description: "Collegamenti alla mappa APRS e segnalibri di stazioni.",
    },
    "repeater-explorer": {
      title: "Ripetitori",
      description:
        "Catalogo personale dei ripetitori con ricerca per distanza.",
    },
    "rf-calculators": {
      title: "Calcolatori RF",
      description: "Ohm, potenza, dBm, antenne, ROS, cavi, locator e ora UTC.",
    },
    propagation: {
      title: "Propagazione",
      description:
        "Indici solari e geomagnetici, con distinzione fra dato osservato e previsione.",
    },
    "settings-backup": {
      title: "Impostazioni e backup",
      description:
        "Profilo, preferenze, stato dello storage, backup e ripristino.",
    },
  },
} as const satisfies MessageTree;
