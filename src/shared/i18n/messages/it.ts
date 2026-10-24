// Explicit extension: this file is also loaded by vite.config.ts (Node).
import type { MessageTree } from "../types.ts";

/**
 * Italian catalog: the reference catalog of the application (ADR-0008).
 * Every other locale must satisfy `CatalogShape<typeof it>`.
 */
export const it = {
  app: {
    name: "Ham Radio Toolbox",
    shortName: "Ham Toolbox",
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
  pwa: {
    region: "Notifiche dell'app",
    updateRegion: "Aggiornamento dell'app",
    offlineReady: "App pronta per l'uso offline.",
    offlineReadyDetail:
      "Dashboard e pagine dei moduli si aprono anche senza connessione.",
    updateAvailable: "Nuova versione disponibile.",
    updateDetail:
      "Aggiorna ora o più tardi: l'aggiornamento ricarica la pagina e non modifica i dati salvati sul dispositivo.",
    update: "Aggiorna",
    updating: "Aggiornamento in corso…",
    later: "Più tardi",
    dismiss: "Chiudi la notifica",
    registerError:
      "Modalità offline non disponibile: il service worker non è stato registrato.",
    updateError: "Aggiornamento non riuscito. Riprova più tardi.",
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
      loading: "Caricamento dei preferiti…",
      notPersisted:
        "Archivio locale non disponibile: i preferiti restano solo fino alla chiusura dell'app.",
      notSaved:
        "L'ultima modifica dei preferiti non è stata salvata: resta valida fino alla chiusura dell'app.",
      invalid:
        "I preferiti salvati non erano leggibili: sono stati azzerati e la prossima modifica li sostituirà.",
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
  format: {
    bytes: "{value} B",
    kib: "{value} KiB",
    mib: "{value} MiB",
    gib: "{value} GiB",
    utcDateTime: "{date}, {time} UTC",
    technicalCode: "Dettaglio tecnico: {code}",
  },
  errors: {
    unknown: "Si è verificato un errore imprevisto.",
  },
  operation: {
    errors: {
      aborted: "Operazione annullata: nessun dato è stato modificato.",
    },
  },
  file: {
    errors: {
      "save-failed":
        "Il browser non ha avviato il download del file. Riprova o controlla le autorizzazioni di download.",
    },
  },
  persistence: {
    notSaved: "Le modifiche potrebbero non essere salvate.",
    errors: {
      "not-found":
        "Il dato richiesto non esiste più: potrebbe essere stato eliminato in un'altra scheda.",
      "invalid-input":
        "Alcuni dati non sono validi: correggi i campi indicati.",
      conflict: "L'operazione è in conflitto con i dati salvati.",
      "transaction-failed":
        "Il salvataggio non è stato completato e nessuna modifica parziale è stata registrata. Riprova.",
      "quota-exceeded":
        "Spazio di archiviazione esaurito: nessuna modifica è stata salvata. Libera spazio sul dispositivo o esporta un backup.",
      unavailable:
        "Archivio locale non disponibile: le modifiche non possono essere salvate.",
    },
    unavailable: {
      "missing-api":
        "Questo browser non offre IndexedDB (alcune modalità di navigazione privata lo disattivano): l'app si consulta, ma non salva i dati.",
      "open-failed":
        "Il browser non ha aperto l'archivio locale (spazio bloccato dalle impostazioni sulla privacy o errore del browser).",
      "newer-version":
        "I dati sul dispositivo sono stati salvati da una versione più recente dell'app: questa versione non li apre, per non danneggiarli. Aggiorna l'app.",
      "upgrade-failed":
        "L'aggiornamento della struttura dei dati non è riuscito ed è stato annullato: i dati restano quelli di prima. Ricarica l'app.",
      closed:
        "La connessione all'archivio locale è stata chiusa, ad esempio per un aggiornamento dell'app aperto in un'altra scheda. Ricarica la pagina.",
    },
    rules: {
      "unique-key": "Esiste già un record con la stessa chiave.",
      "station-profile": {
        referenced:
          "Il profilo è usato da QSO o da ricezioni SWL e non può essere eliminato.",
        last: "È l'unico profilo: non può essere eliminato.",
      },
      qso: {
        "station-profile-missing": "Il profilo stazione del QSO non esiste.",
      },
      swl: {
        "station-profile-missing":
          "Il profilo stazione della ricezione non esiste.",
      },
      "reception-details": {
        "category-mismatch":
          "I dettagli non corrispondono alla categoria della ricezione.",
      },
      "qsl-record": {
        "subject-missing": "Il QSO o la ricezione della QSL non esiste.",
        "channel-taken": "Esiste già una QSL per lo stesso canale.",
      },
      attachment: {
        "owner-missing": "Il record a cui appartiene l'allegato non esiste.",
        "owner-type-unavailable":
          "Questo tipo di allegato non è ancora disponibile.",
        "same-content": "Lo stesso file è già allegato a questo record.",
        "too-large": "L'allegato supera la dimensione massima.",
      },
    },
  },
  database: {
    region: "Stato dell'archivio locale",
    versionChange: {
      title: "Aggiornamento dell'app in un'altra scheda",
      body: "Un'altra scheda ha aperto una versione più recente dell'app e ha aggiornato la struttura dei dati. Questa scheda ha chiuso l'archivio locale per non danneggiarlo: le modifiche già confermate sono salvate, le nuove non lo sarebbero.",
      action:
        "Ricarica la pagina per continuare. I dati non ancora salvati in un modulo di questa pagina andrebbero persi: copiali prima di ricaricare.",
    },
    blocked: {
      title: "Aggiornamento dei dati in attesa",
      body: "Questa versione dell'app deve aggiornare la struttura dei dati, ma un'altra scheda usa ancora la versione precedente. Chiudi le altre schede di Ham Radio Toolbox: l'aggiornamento continuerà da solo.",
    },
    unavailable: {
      title: "Archivio locale non disponibile",
      body: "Navigazione e consultazione restano disponibili, ma le modifiche potrebbero non essere salvate.",
    },
    reload: "Ricarica la pagina",
    dismiss: "Chiudi l'avviso",
  },
  storage: {
    title: "Archiviazione sul dispositivo",
    localOnly:
      "I dati sono salvati soltanto su questo dispositivo, nel browser: nessuna copia viene inviata a un server. Se il browser li elimina o il dispositivo si guasta, vanno persi.",
    backupAdvice:
      "Esporta periodicamente un backup e conservalo fuori dal dispositivo.",
    checking: "Verifica in corso…",
    refresh: "Aggiorna lo stato",
    database: {
      label: "Database locale (IndexedDB)",
      available: "Disponibile",
      unavailable: "Non disponibile",
    },
    usage: {
      label: "Spazio usato (stima)",
      value: "{used} su {quota} ({percent})",
      unknown: "Il browser non fornisce una stima.",
    },
    quota: {
      label: "Quota disponibile per l'app (stima)",
      note: "È la stima del browser: non garantisce che lo spazio sia davvero libero sul dispositivo.",
    },
    nearQuota:
      "Lo spazio usato supera l'80 % della quota stimata: esporta un backup e libera spazio.",
    persistence: {
      label: "Archiviazione persistente",
      persisted:
        "Concessa: il browser non elimina i dati per mancanza di spazio.",
      bestEffort:
        "Non concessa: il browser può eliminare i dati se lo spazio scarseggia.",
      unsupported: "Il browser non indica se i dati sono persistenti.",
      request: "Richiedi archiviazione persistente",
      requesting: "Richiesta in corso…",
      granted: "Il browser ha concesso l'archiviazione persistente.",
      denied:
        "Il browser non ha concesso l'archiviazione persistente. La decisione spetta al browser (Chrome la concede, ad esempio, all'app installata o usata spesso): riprova più tardi e, nel frattempo, esporta backup regolari.",
      requestUnsupported:
        "Il browser non permette di richiedere l'archiviazione persistente.",
    },
  },
  tables: {
    station_profiles: "Profili stazione",
    qso_logs: "QSO",
    swl_receptions: "Ricezioni SWL",
    reception_details: "Dettagli delle ricezioni",
    qsl_records: "QSL",
    attachments: "Allegati",
    settings: "Preferenze",
    data_sources: "Fonti dati",
    import_jobs: "Storico di import e ripristini",
  },
  validation: {
    generic: "Valore non valido.",
    text: { empty: "Campo obbligatorio." },
    number: { invalid: "Inserisci un numero valido." },
    callsign: {
      empty: "Inserisci il nominativo.",
      "invalid-characters":
        "Il nominativo può contenere solo lettere, cifre e «/».",
      "too-long": "Nominativo troppo lungo.",
      "invalid-format": "Nominativo non valido (es. IZ1ABC o IZ1ABC/P).",
    },
    locator: {
      "invalid-format":
        "Locator non valido: usa 4, 6 o 8 caratteri (es. JN45 o JN45dl).",
    },
    "station-profile": {
      "callsign-required":
        "Il nominativo è obbligatorio per i profili HAM e HAM/SWL.",
      "default-invalid": "Deve esserci un solo profilo predefinito.",
    },
    fields: { "incomplete-group": "Compila anche i campi collegati." },
    timestamps: {
      "updated-before-created":
        "La data di modifica precede quella di creazione.",
    },
    "catalog-key": { invalid: "Identificativo non valido." },
    sha256: { invalid: "Impronta SHA-256 non valida." },
    frequency: {
      negative: "La frequenza non può essere negativa.",
      "not-integer": "La frequenza deve essere un numero intero di hertz.",
      "too-large": "Frequenza troppo alta.",
      "not-a-number": "Frequenza non numerica.",
      "not-finite": "Frequenza non valida.",
      "invalid-format": "Formato della frequenza non valido.",
    },
    time: {
      "invalid-format": "Data/ora non valida.",
      "missing-offset": "Data/ora senza fuso: serve l'ora UTC (Z).",
      "invalid-offset": "Fuso orario non valido.",
      "invalid-date": "Data inesistente.",
      "invalid-time": "Ora inesistente.",
      "out-of-range": "Data fuori dall'intervallo ammesso.",
    },
    coordinates: {
      "latitude-out-of-range": "Latitudine fuori dall'intervallo −90…90.",
      "longitude-out-of-range": "Longitudine fuori dall'intervallo −180…180.",
      "latitude-not-finite": "Latitudine non valida.",
      "longitude-not-finite": "Longitudine non valida.",
    },
    dashboard: { "favorite-repeated": "Modulo ripetuto nei preferiti." },
    attachment: {
      "content-invalid": "Contenuto dell'allegato non decodificabile.",
      "content-missing": "Contenuto dell'allegato mancante.",
      "file-name-empty": "Nome del file mancante.",
      "mime-type-not-allowed": "Tipo di file non ammesso.",
      "size-mismatch": "La dimensione dichiarata non corrisponde al file.",
      "sha256-mismatch":
        "L'impronta dichiarata non corrisponde al contenuto dell'allegato.",
      "too-large": "L'allegato supera la dimensione massima.",
      "owner-missing": "Il record a cui appartiene l'allegato non esiste.",
      "owner-skipped": "Allegato di un record escluso dal ripristino.",
      "same-content": "Lo stesso file è allegato due volte allo stesso record.",
    },
    backup: {
      "table-name": "Nome di tabella non valido.",
      "record-not-object": "Il record non è un oggetto JSON.",
      "duplicate-id": "Identificativo ripetuto nella stessa tabella.",
    },
    qso: {
      "station-profile-missing": "Il profilo stazione del QSO manca.",
      "frequency-zero": "La frequenza del QSO non può essere zero.",
      "off-before-on": "La fine del QSO precede l'inizio.",
    },
    swl: {
      "station-profile-missing": "Il profilo stazione della ricezione manca.",
      "frequency-zero": "La frequenza della ricezione non può essere zero.",
      "end-before-start": "La fine della ricezione precede l'inizio.",
    },
    "reception-details": {
      "category-mismatch":
        "I dettagli non corrispondono alla categoria della ricezione.",
      duplicate: "Dettagli ripetuti per la stessa ricezione.",
      "reception-missing": "La ricezione dei dettagli manca.",
    },
    "qsl-record": {
      "subject-missing": "Il QSO o la ricezione della QSL manca.",
      "channel-taken": "Due QSL per lo stesso canale dello stesso contatto.",
      "subject-changed": "La QSL è associata a un contatto diverso.",
    },
    "import-job": {
      "finished-before-started": "La fine dell'import precede l'inizio.",
    },
    band: { invalid: "Banda non valida." },
    mode: { invalid: "Modo non valido." },
    modulation: { invalid: "Modulazione non valida." },
    zod: {
      invalid_type: "Valore mancante o di tipo errato.",
      too_small: "Valore troppo piccolo o troppo corto.",
      too_big: "Valore troppo grande o troppo lungo.",
      invalid_value: "Valore non ammesso.",
      invalid_format: "Formato non valido.",
      unrecognized_keys: "Campi non previsti.",
      invalid_union: "Valore non valido.",
      invalid_key: "Chiave non valida.",
      invalid_element: "Elemento non valido.",
      not_multiple_of: "Valore non ammesso.",
      custom: "Valore non valido.",
    },
  },
  import: {
    errors: {
      "file-empty": "Il file è vuoto.",
      "file-too-large": "Il file supera la dimensione massima di {limit}.",
      "file-unreadable": "Il file non può essere letto.",
      "encoding-invalid": "Il file non è un testo UTF-8 valido.",
      "format-unknown": "Formato del file non riconosciuto.",
      "format-invalid": "Il file non rispetta il formato atteso.",
      "preview-stale":
        "I dati sono cambiati dopo l'anteprima: ripeti l'anteprima prima di importare.",
      "duplicate-in-file": "Record ripetuto nel file.",
      "commit-failed":
        "L'import non è stato completato: nessun record è stato scritto.",
      "unexpected-error":
        "Errore imprevisto durante l'import: nessun record è stato scritto.",
    },
  },
  backup: {
    errors: {
      empty: "Il file è vuoto.",
      "too-large":
        "Il file ({size}) supera il limite operativo dei backup ({limit}).",
      "read-failed": "Il file non può essere letto.",
      "encoding-invalid": "Il file non è un testo UTF-8 valido.",
      "not-a-backup": "Il file non è un backup di Ham Radio Toolbox.",
      "json-invalid": "Il file non è un JSON valido: è danneggiato.",
      "unknown-field": "Il file contiene campi non previsti dal formato.",
      "layout-invalid":
        "La struttura del file non rispetta il formato dei backup.",
      truncated: "Il file è incompleto (troncato).",
      "format-version-unsupported":
        "Versione del formato di backup non supportata da questa app.",
      "manifest-invalid": "L'intestazione del backup non è valida.",
      "table-duplicate": "Una tabella compare due volte nel file.",
      "record-too-large": "Un record supera la dimensione massima ammessa.",
      "integrity-missing": "Mancano le impronte di integrità del file.",
      "integrity-invalid": "Le impronte di integrità non sono valide.",
      "checksum-mismatch":
        "Le impronte SHA-256 non corrispondono al contenuto: il file è danneggiato o è stato modificato.",
      "schema-newer":
        "Il backup è stato creato da una versione più recente dell'app: aggiorna l'app per ripristinarlo.",
      "migration-unavailable":
        "Questa app non sa convertire i dati di questa versione del backup.",
      "unknown-table": "Il backup contiene una tabella sconosciuta.",
      "table-missing": "Nel backup manca una tabella.",
      "attachments-mismatch":
        "L'indicazione sugli allegati non corrisponde al contenuto del file.",
      "count-mismatch":
        "Il numero di record dichiarato non corrisponde a quelli presenti.",
      "has-errors":
        "Il backup contiene record non validi e non può essere ripristinato.",
      "preview-stale":
        "I dati sul dispositivo sono cambiati dopo l'anteprima (ad esempio in un'altra scheda): ricalcola l'anteprima.",
      "verification-failed":
        "La verifica dei dati dopo la scrittura non è riuscita: il ripristino è stato annullato.",
      "export-too-large":
        "Il backup supererebbe il limite operativo di {limit}: crealo senza allegati.",
      "source-invalid":
        "Alcuni dati salvati non sono validi ({count}): il backup non verrebbe ripristinato e non è stato creato.",
      "export-unverified":
        "Il file generato non ha superato la verifica e non è stato offerto per il download.",
      "restore-failed": "Il ripristino non è riuscito.",
      "unexpected-error": "Errore imprevisto durante il ripristino.",
    },
    export: {
      title: "Backup",
      intro:
        "Un unico file JSON con i dati dell'app: profili stazione, logbook, QSL, preferenze, fonti dati e storico degli import.",
      inventoryLoading: "Conteggio dei record…",
      records: {
        one: "{count} record da esportare",
        other: "{count} record da esportare",
      },
      attachments: {
        one: "{count} allegato, {size}",
        other: "{count} allegati, {size}",
      },
      noAttachments: "Nessun allegato salvato.",
      includeAttachments: "Includi gli allegati",
      includeAttachmentsHint:
        "Gli allegati entrano nel file in base64: aggiungono almeno {size}.",
      overLimit:
        "Con gli allegati il file supererebbe il limite operativo di {limit}: crea il backup senza allegati.",
      limit: "Limite operativo di un file di backup: {limit}.",
      create: "Crea backup",
      creating: "Creazione del backup…",
      verifying: "Verifica del file creato…",
      cancel: "Annulla",
      cancelled: "Creazione del backup annullata: nessun file prodotto.",
      ready: "Backup pronto e verificato",
      readyDetail: {
        one: "{name} · {size} · {count} record",
        other: "{name} · {size} · {count} record",
      },
      download: "Scarica il backup",
      downloaded:
        "Download avviato. Conserva il file fuori dal dispositivo, in un luogo sicuro.",
      checksumNote:
        "Il file contiene un'impronta SHA-256 per ogni tabella: rileva file danneggiati o incompleti, ma non è una firma digitale e non garantisce chi ha creato o modificato il file.",
      privacy:
        "Il file non è cifrato: contiene i dati della stazione e i log. Non condividerlo se non vuoi renderli pubblici.",
      failed: "Backup non riuscito",
      another: "Crea un altro backup",
    },
    restore: {
      title: "Ripristino",
      intro:
        "Il file viene prima analizzato senza modificare i dati. Prima di qualsiasi modifica vedrai un'anteprima e dovrai confermare.",
      choose: "Scegli un file di backup",
      chooseHint: "File .json creato da Ham Radio Toolbox, fino a {limit}.",
      analyzing: "Analisi del file…",
      cancelAnalysis: "Annulla l'analisi",
      analysisFailed: "Il file non può essere ripristinato",
      unchanged: "Nessun dato sul dispositivo è stato modificato.",
      summary: {
        title: "Contenuto del backup",
        file: "File",
        size: "Dimensione",
        exportedAt: "Creato il",
        appVersion: "Versione dell'app",
        schemaVersion: "Versione dei dati",
        formatVersion: "Versione del formato",
        attachments: "Allegati",
        included: "Inclusi",
        excluded: "Esclusi",
        table: "Tabella",
        records: "Record",
        caption: "Record presenti nel backup, per tabella",
      },
      migrated:
        "Backup di una versione precedente dei dati: i record sono stati convertiti alla versione attuale.",
      dropped: {
        one: "{count} record non più previsto dalla versione attuale non sarà ripristinato.",
        other:
          "{count} record non più previsti dalla versione attuale non saranno ripristinati.",
      },
      invalid: {
        title: "Il backup non può essere ripristinato",
        body: {
          one: "È stato trovato {count} problema.",
          other: "Sono stati trovati {count} problemi.",
        },
        shown: "Sono elencati i primi {count}.",
        caption: "Problemi trovati nel backup",
        where: "Dove",
        field: "Campo",
        problem: "Problema",
        record: "{table}, record n. {position}",
      },
      mode: {
        legend: "Modalità di ripristino",
        replace: "Sostituisci",
        replaceHint:
          "I dati del dispositivo vengono sostituiti da quelli del backup (predefinita).",
        merge: "Unisci",
        mergeHint:
          "I record del backup si aggiungono ai dati del dispositivo; se un record esiste già vince la versione modificata più di recente. Nulla viene eliminato.",
      },
      preview: "Mostra l'anteprima",
      previewing: "Calcolo dell'anteprima…",
      effects: {
        title: "Anteprima delle modifiche",
        caption: "Effetto del ripristino su ogni tabella",
        table: "Tabella",
        inserted: "Scritti",
        updated: "Aggiornati",
        deleted: "Eliminati",
        unchanged: "Invariati",
        skipped: "Esclusi",
      },
      attachmentsKept: {
        one: "Il backup non contiene allegati: {count} allegato del dispositivo resta, perché il suo record esiste ancora dopo il ripristino.",
        other:
          "Il backup non contiene allegati: {count} allegati del dispositivo restano, perché i loro record esistono ancora dopo il ripristino.",
      },
      attachmentsDeleted: {
        one: "{count} allegato del dispositivo sarà eliminato, perché il suo record non esisterà più.",
        other:
          "{count} allegati del dispositivo saranno eliminati, perché i loro record non esisteranno più.",
      },
      conflicts: {
        title: {
          one: "{count} record del backup non sarà applicato",
          other: "{count} record del backup non saranno applicati",
        },
        caption: "Record del backup esclusi e motivo",
        record: "Record",
      },
      noChanges: "Il ripristino non cambierebbe nessun dato.",
      confirm: "Ripristina…",
      discard: "Annulla il ripristino",
      discarded: "Ripristino annullato: nessun dato è stato modificato.",
      dialog: {
        title: "Confermi il ripristino?",
        replaceBody: {
          one: "I dati del dispositivo saranno sostituiti da quelli del backup: {count} record locale sarà eliminato.",
          other:
            "I dati del dispositivo saranno sostituiti da quelli del backup: {count} record locali saranno eliminati.",
        },
        mergeBody:
          "I record del backup saranno uniti ai dati del dispositivo. Nessun record locale sarà eliminato, ma quelli più vecchi saranno aggiornati.",
        irreversible:
          "L'app non può annullare l'operazione: per tornare indietro serve un backup dei dati attuali. Se non ne hai uno, annulla e crealo prima.",
        acknowledge: "Ho capito che i dati attuali saranno sostituiti",
        replaceAction: "Sostituisci i dati",
        mergeAction: "Unisci i dati",
        cancel: "Annulla",
      },
      committing:
        "Ripristino in corso. L'operazione è atomica e una volta avviata non può essere interrotta dall'app: attendi la conclusione.",
      done: {
        title: "Ripristino completato",
        body: {
          one: "{count} record verificato sul dispositivo. Profili, preferenze e dashboard sono stati aggiornati.",
          other:
            "{count} record verificati sul dispositivo. Profili, preferenze e dashboard sono stati aggiornati.",
        },
      },
      failed: "Ripristino non riuscito",
      another: "Ripristina un altro file",
    },
  },
  settings: {
    intro:
      "Profili stazione, preferenze, stato dell'archivio, backup e ripristino dei dati.",
    preferences: {
      title: "Preferenze",
      theme: "Tema dell'interfaccia",
      favorites:
        "I moduli preferiti si fissano dalla dashboard, toccando la stella su una scheda.",
      notSaved: "La preferenza non è stata salvata",
      invalid:
        "Alcune preferenze salvate non erano leggibili (forse scritte da una versione più recente dell'app): sono in uso i valori predefiniti e la prossima modifica le sostituirà.",
      loading: "Caricamento delle preferenze…",
    },
    profiles: {
      title: "Profili stazione",
      intro:
        "Dati della stazione usati dai logbook. L'app funziona anche senza profili; il primo profilo creato diventa quello predefinito.",
      loading: "Caricamento dei profili…",
      loadError: "Impossibile leggere i profili",
      empty: "Nessun profilo stazione",
      emptyBody: "Crea un profilo HAM, SWL o misto quando ti serve.",
      list: "Profili disponibili",
      add: "Nuovo profilo",
      default: "Predefinito",
      edit: "Modifica",
      editLabel: "Modifica il profilo {name}",
      remove: "Elimina",
      removeLabel: "Elimina il profilo {name}",
      makeDefault: "Rendi predefinito",
      makeDefaultLabel: "Rendi predefinito il profilo {name}",
      onlyProfile:
        "È l'unico profilo: crea un altro profilo prima di eliminarlo.",
      kinds: { ham: "HAM", swl: "SWL", both: "HAM e SWL" },
      kindLabel: "Tipo di profilo",
      saved: "Profilo «{name}» salvato.",
      removed: "Profilo «{name}» eliminato.",
      defaultChanged: "«{name}» è ora il profilo predefinito.",
      actionFailed: "Operazione non riuscita",
      form: {
        createTitle: "Nuovo profilo stazione",
        editTitle: "Modifica il profilo",
        required: "I campi contrassegnati con * sono obbligatori.",
        name: "Nome del profilo",
        nameHint: "Es. Casa, Portatile SOTA, Ascolto.",
        callsign: "Nominativo",
        callsignHint: "Obbligatorio per i profili HAM e HAM/SWL.",
        swlId: "Identificativo SWL",
        swlIdHint: "Es. I-12345.",
        operatorName: "Nome dell'operatore",
        locator: "Locator",
        locatorHint: "Maidenhead, 4, 6 o 8 caratteri (es. JN45dl).",
        qth: "QTH",
        country: "Paese",
        dxcc: "Entità DXCC",
        dxccHint: "Codice numerico ADIF.",
        cqZone: "Zona CQ",
        ituZone: "Zona ITU",
        altitudeM: "Altitudine (m)",
        equipment: "Apparati",
        rig: "Ricetrasmettitore",
        receiver: "Ricevitore",
        antenna: "Antenna",
        powerW: "Potenza (W)",
        firstDefault: "È il primo profilo: diventerà quello predefinito.",
        makeDefault: "Imposta come profilo predefinito",
        save: "Salva il profilo",
        saving: "Salvataggio…",
        cancel: "Annulla",
        invalid: "Il profilo non è stato salvato: correggi i campi indicati.",
        keptOnFailure:
          "I dati inseriti restano nel modulo: puoi riprovare o copiarli.",
      },
      removeDialog: {
        title: "Eliminare il profilo?",
        body: "Il profilo «{name}» sarà eliminato da questo dispositivo. L'operazione non si può annullare.",
        promoted:
          "È il profilo predefinito: diventerà predefinito il profilo più vecchio fra quelli rimasti.",
        confirm: "Elimina il profilo",
        cancel: "Annulla",
      },
    },
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
