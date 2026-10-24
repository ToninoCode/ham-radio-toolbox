# 0016 — Preferenze persistenti, avvio dell'app e coordinamento fra schede

- **Stato**: Accettato (2026-10-24, approvazione del Blocco D di M2, con le correzioni della revisione riportate in fondo)
- **Data**: 2026-10-24
- **Milestone**: M2

## Contesto

BL-M2-09 rende persistenti tema e preferiti della dashboard (FR-DSH-03/06, FR-SET-02, residuo BL-M1-10) e collega alla UI storage, profili, backup e restore. Vincoli:

- IndexedDB è l'unica fonte di verità: niente copia delle preferenze in `localStorage` (richiesta del Blocco D);
- la lettura da IndexedDB è asincrona; un tema salvato diverso da quello di sistema, letto dopo il primo rendering, farebbe cambiare i colori a pagina già visibile;
- l'app deve restare navigabile anche senza IndexedDB (navigazione privata, storage bloccato);
- con più schede aperte, una scheda può mostrare dati vecchi e poi sovrascrivere quelli scritti da un'altra (preferiti, profili, restore);
- `versionchange` e `blocked` sono già esposti dalla porta `DatabaseLifecycle` ([ADR-0014](0014-repositories-unit-of-work-and-persistence-errors.md)), manca l'avviso in UI;
- gli store Pinia non usano Dexie ([ADR-0004](0004-layered-feature-modules.md)).

Fatti verificati (Chromium di Playwright, `fake-indexeddb`):

- aprire il database e leggere due chiavi di `settings` richiede pochi millisecondi; con un upgrade bloccato da un'altra scheda l'apertura resta in attesa finché quella scheda non chiude;
- `BroadcastChannel` consegna i messaggi alle altre schede della stessa origine, mai a chi li invia; esiste anche in Node 22 (test);
- un `<a download>` su un URL `blob:` scarica il file senza passare dal service worker né dalla Cache Storage, anche sotto la CSP di produzione (`tests/cloudflare/pages.spec.ts`);
- `navigator.storage.persist()` in Chromium risponde senza chiedere nulla all'utente.

## Decisione

1. **Preferenze in `settings`**, chiavi `app` (`{ theme }`) e `dashboard` (`{ favorites }`, id dei moduli in ordine di fissaggio, senza ripetizioni), con schema Zod e default dichiarati con `defineSetting` nel dominio di `settings-backup`. Casi d'uso `PreferencesService` (lettura con ripiego sul default per un valore non più valido, segnalato; scritture validate). Nessuna copia in `localStorage`.
2. **Uno store delle preferenze** (`usePreferencesStore`) in `settings-backup/presentation`, esportato dall'`index.ts` del modulo: lo usano lo store del tema (`src/app/theme`) e quello della dashboard. Le modifiche si applicano subito, le scritture sono in coda e in ordine; se una scrittura fallisce il valore resta in memoria e la UI dice che non è salvato. È l'unica eccezione, motivata, alla regola "l'`index.ts` espone l'API dell'application": un solo stato condiviso evita due copie in memoria della stessa preferenza.
3. **Avvio**: `main.ts` legge le preferenze prima di montare l'app, aspettando **al massimo 500 ms**; oltre (database lento o bloccato) monta con i default e applica i valori quando arrivano. Prima del montaggio la pagina mostra solo lo sfondo, che segue già `prefers-color-scheme` via CSS: l'unico cambio possibile avviene prima che compaia qualsiasi contenuto.
4. **Servizi per la presentation** forniti dal composition root con una chiave di iniezione del modulo (`SETTINGS_SERVICES_KEY`): preferenze, profili, storage, notifiche fra schede, `FileSaver`, caricamento pigro del backup. Gli store li ottengono con `inject()` (setup store di Pinia), mai importando il container.
5. **Notifica fra schede**: porta `DataChangeNotifier` (`preferences`, `station-profiles`, `all`), adattatore su `BroadcastChannel`. I casi d'uso pubblicano dopo ogni scrittura confermata (il restore pubblica `all`); gli store delle altre schede rileggono. Senza l'API (browser molto vecchi) non si notifica: comportamento best effort dichiarato.
6. **Stato del database nella shell** (`DatabaseStatus`, nel flusso della pagina): `version-change` (connessione chiusa, le modifiche confermate sono salvate, le nuove no; pulsante di ricarica), `blocked` (chiudere le altre schede; scompare quando l'apertura riesce), archivio non disponibile all'avvio o durante una scrittura.
7. **Persistenza dello storage**: all'avvio si legge soltanto lo stato con `navigator.storage.persisted()`; `persist()` si chiama **solo su richiesta esplicita** dell'utente, con il pulsante in Impostazioni (correzione della revisione). Esito e diniego sono mostrati senza presentare la quota come garanzia.
8. **Download del backup** con la porta `FileSaver` (adattatore `<a download>` su URL `blob:`, revocato dopo 60 s); il file è offerto solo dopo la rilettura di verifica (`BackupService.verifyBackup`).

## Alternative considerate

| Alternativa                                                                  | Pro                                   | Contro                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Copia del tema in `localStorage`, letta da uno script sincrono in `<head>`   | Nessuna attesa all'avvio              | Seconda fonte di verità, esclusa dalla richiesta; script inline incompatibile con la CSP senza `unsafe-inline` o hash                 |
| Montare subito e applicare le preferenze dopo                                | Primo rendering più rapido            | Cambio di tema e comparsa dei preferiti a pagina visibile                                                                             |
| Attesa illimitata delle preferenze                                           | Nessun cambio dopo il montaggio       | Con un upgrade bloccato da un'altra scheda l'app non si aprirebbe                                                                     |
| Uno store per tema e uno per i preferiti, ciascuno con il proprio caso d'uso | Store indipendenti                    | Due letture e due gestioni degli errori uguali; il contratto resta comunque nel modulo `settings-backup`                              |
| Evento `storage` di `localStorage` per avvisare le altre schede              | API universale                        | Richiede di scrivere in `localStorage` solo per notificare                                                                            |
| `liveQuery` di Dexie (osservazione delle tabelle)                            | Aggiornamenti automatici anche locali | Dexie dovrebbe arrivare alla presentation tramite un adattatore osservabile per ogni vista; più pesante del necessario per tre ambiti |
| Web Share API per il backup                                                  | Condivisione diretta su Android       | Non disponibile ovunque; da valutare con il collaudo su tablet (M13)                                                                  |

## Conseguenze

- Il primo montaggio attende la lettura delle preferenze (pochi ms, al massimo 500 ms). Un test E2E che preme Tab subito dopo il caricamento deve attendere la dashboard (`tests/e2e/app-shell.spec.ts`).
- Il JS iniziale cresce da 118,2 a 132,3 kB gzip (store delle preferenze, casi d'uso, catalogo i18n esteso, avvisi), entro i 200 kB di NFR-PERF-01. Vista Impostazioni (11,3 kB gzip) e backup (10,8 kB gzip) restano chunk separati.
- Con `version-change` le scritture successive falliscono con `persistence.unavailable/closed`: i dati inseriti restano nel modulo aperto, l'utente li può copiare prima di ricaricare.
- La sincronizzazione fra schede copre preferenze, profili e restore; i moduli successivi (logbook) dovranno pubblicare i propri ambiti con la stessa porta.
- I test di componente e degli store forniscono i servizi con un container reale su `fake-indexeddb` (`tests/support/app-services.ts`).

## Correzioni all'accettazione (revisione del Blocco D, 2026-10-24)

1. **Nessuna richiesta automatica di persistenza.** La versione proposta chiamava `persist()` all'avvio quando i dati non erano persistenti; ora l'avvio legge solo lo stato (`persisted()`, store `useStorageStatusStore`) e `persist()` parte esclusivamente dal pulsante di Impostazioni. Verificato in Chromium contando le chiamate (`tests/e2e/settings.spec.ts`, "persistence is read at startup and requested only by the user"). Il testo di NFR-REL-03 in REQUIREMENTS ("all'avvio si richiede `persist()`") diverge da questa decisione e va allineato dal maintainer.
2. **Lettura delle preferenze oltre i 500 ms.** Una lettura che termina dopo l'attesa di avvio non sovrascrive le scelte fatte nel frattempo dall'utente, né quelle ancora in scrittura; applica i valori letti solo alle preferenze non toccate. Coperto da test dello store (`preferences-store.spec.ts`), dell'attesa (`src/app/startup.spec.ts`) e da un E2E con il database bloccato da un'altra scheda.
3. **Coerenza fra schede e dopo un restore**, verificata in Chromium con due schede: preferiti e profili creati in una scheda compaiono nell'altra; dopo un restore tema, profili e preferiti si aggiornano senza ricaricare, nella scheda del restore e nelle altre.
