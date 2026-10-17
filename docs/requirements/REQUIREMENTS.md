# Requisiti — Ham Radio Toolbox v1

| Campo                | Valore                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stato                | M0 — Bozza per approvazione                                                                                                                                                                                 |
| Ultimo aggiornamento | 2026-10-17                                                                                                                                                                                                  |
| Riferimento primario | [`docs/PROJECT.md`](../PROJECT.md) (perimetro e obiettivi)                                                                                                                                                  |
| Documenti collegati  | [Architettura](../architecture/ARCHITECTURE.md) · [Database](../architecture/DATABASE.md) · [Fonti dati](../data-sources/SOURCES.md) · [Roadmap e backlog](../roadmap/ROADMAP.md) · [ADR](../adr/README.md) |

In caso di conflitto prevale `PROJECT.md` per il perimetro funzionale e `CLAUDE.md` per vincoli tecnici e convenzioni. Le divergenze trovate sono elencate in [§ 9](#9-questioni-aperte).

---

## 1. Scopo

Ham Radio Toolbox è una PWA local-first che trasforma un tablet Android in una "cassetta degli attrezzi" per radioamatori e SWL. Questo documento traduce gli obiettivi di `PROJECT.md` in requisiti verificabili, identificati univocamente, con priorità e milestone di riferimento.

### 1.1 Convenzioni del documento

- **ID requisito**: `FR-<MOD>-<NN>` (funzionale), `NFR-<AREA>-<NN>` (non funzionale), `UC-<NN>` (caso d'uso), `CON-<NN>` (vincolo).
- **Priorità (MoSCoW)**: **M** = Must (necessario per v1.0), **S** = Should (atteso in v1.0, rinviabile con motivazione), **C** = Could (se c'è tempo), **W** = Won't (escluso dalla v1).
- **Milestone**: milestone in cui il requisito viene implementato (vedi [Roadmap](../roadmap/ROADMAP.md)).

### 1.2 Glossario

| Termine             | Significato                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **QSO**             | Collegamento radio bilaterale tra due stazioni radioamatoriali.                                                       |
| **SWL**             | Short Wave Listener: ascoltatore che registra ricezioni senza trasmettere.                                            |
| **ADIF**            | Amateur Data Interchange Format (`.adi`/`.adx`), standard di scambio dei log. Riferimento: ADIF 3.1.x.                |
| **RST**             | Rapporto Readability-Strength-Tone (es. `59`, `599`).                                                                 |
| **SINPO**           | Rapporto di ricezione Signal-Interference-Noise-Propagation-Overall, cinque cifre 1–5.                                |
| **Locator**         | Maidenhead Grid Locator (es. `JN45dl`), 4/6/8 caratteri.                                                              |
| **DXCC**            | Entità geografiche/politiche ARRL usate per diplomi e statistiche.                                                    |
| **POTA / SOTA**     | Parks on the Air / Summits on the Air: programmi di attività portatile con riferimenti (`IT-0001`, `I/LO-123`).       |
| **TLE / OMM**       | Two-Line Element set / Orbit Mean-Elements Message: formati degli elementi orbitali.                                  |
| **AOS / TCA / LOS** | Acquisition of Signal / Time of Closest Approach / Loss of Signal di un passaggio satellitare.                        |
| **Stagione A/B**    | Stagioni di programmazione broadcast HF: A = fine marzo–fine ottobre, B = fine ottobre–fine marzo (es. `A26`, `B26`). |
| **EiBi / HFCC**     | Fonti di palinsesti broadcast in onde corte (vedi [Fonti dati](../data-sources/SOURCES.md)).                          |
| **Spot**            | Segnalazione di una stazione DX ascoltata, pubblicata su un DX Cluster.                                               |
| **CTCSS / DCS**     | Toni sub-audio / codici digitali di accesso ai ripetitori.                                                            |
| **Fonte "native"**  | Fonte esterna interrogabile direttamente dal browser (CORS, licenza e termini compatibili).                           |

---

## 2. Attori

| Attore                       | Descrizione                                                                     | Moduli principali                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Operatore HAM**            | Radioamatore con licenza, opera da stazione fissa o portatile.                  | Logbook HAM, QSL, DX Cluster, Satelliti, Propagazione, Calcolatori, Ripetitori, APRS |
| **SWL**                      | Ascoltatore di broadcast, utility, digitali, aeronautica, marittima, satelliti. | Logbook SWL, Frequency Explorer, Signal Explorer, Satelliti                          |
| **Appassionato RF**          | Interessato a calcoli, antenne e documentazione.                                | Calcolatori RF, Resource Manager, Signal Explorer                                    |
| **Sistema (service worker)** | Gestisce cache, aggiornamenti dell'app e funzionamento offline.                 | Trasversale                                                                          |
| **Fonte esterna**            | Servizio o dataset pubblico (EiBi, CelesTrak, SatNOGS…).                        | Provider                                                                             |

Un singolo utente può avere sia il profilo HAM sia quello SWL (FR-SET-01). La v1 è **mono-utente e mono-dispositivo** (nessuna sincronizzazione).

---

## 3. Vincoli

| ID     | Vincolo                                                                                                                          | Fonte                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| CON-01 | Nessun backend obbligatorio: tutte le funzioni v1 girano nel browser.                                                            | PROJECT §1, CLAUDE                                      |
| CON-02 | Offline-first per le funzioni elencate in PROJECT §8.                                                                            | PROJECT §8                                              |
| CON-03 | Nessun hardware in v1: niente CAT, PTT, audio radio, seriale/USB, Raspberry Pi, SDR in tempo reale.                              | PROJECT §11                                             |
| CON-04 | Nessuna chiave API condivisa/segreta nel bundle frontend.                                                                        | CLAUDE, PROJECT §9                                      |
| CON-05 | Nessun endpoint inventato né scraping non autorizzato; se l'integrazione non è verificata → import manuale o link esterno.       | CLAUDE                                                  |
| CON-06 | Nessun dato dimostrativo presentato come live; fixture sempre etichettate.                                                       | CLAUDE                                                  |
| CON-07 | Stack fissato da `PROJECT.md` §4 e `CLAUDE.md`; variazioni solo tramite ADR.                                                     | CLAUDE                                                  |
| CON-08 | Ascolto aeronautico, marittimo e utility: nessuna funzione che incoraggi la divulgazione del contenuto di comunicazioni private. | CLAUDE                                                  |
| CON-09 | Nessuna dipendenza da API a pagamento o account cloud obbligatori.                                                               | PROJECT §11                                             |
| CON-10 | Convenzioni dati obbligatorie: UUID v4, frequenze in Hz interi, date UTC ISO 8601, WGS84 decimale.                               | CLAUDE, [ADR-0005](../adr/0005-data-conventions.md)     |
| CON-11 | UI in italiano tramite i18n; codice, commenti e commit in inglese.                                                               | CLAUDE                                                  |
| CON-12 | Hosting statico HTTPS: le risorse esterne servite solo in HTTP non sono raggiungibili dal browser (mixed content).               | Derivato, vedi [Fonti dati](../data-sources/SOURCES.md) |

---

## 4. Requisiti funzionali

### 4.0 Trasversali (tutti i moduli)

| ID        | Requisito                                                                                                                                                            | Pri. | M   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-GEN-01 | Ogni vista gestisce esplicitamente gli stati _caricamento_, _vuoto_ ed _errore_.                                                                                     | M    | M1→ |
| FR-GEN-02 | Ogni dato proveniente da fonte esterna mostra **fonte**, **licenza/attribuzione** e **data di ultimo aggiornamento**.                                                | M    | M5→ |
| FR-GEN-03 | Ogni import segue il flusso _parse → validazione → anteprima → report errori → commit unico_; un import fallito o annullato non lascia dati parziali.                | M    | M2→ |
| FR-GEN-04 | I dati di esempio sono caricabili solo esplicitamente e marcati come "Dati di esempio" in UI e in DB.                                                                | S    | M2→ |
| FR-GEN-05 | Tutte le date nei logbook sono mostrate in UTC per default, con indicazione esplicita "UTC".                                                                         | M    | M3→ |
| FR-GEN-06 | Le frequenze sono inserite e mostrate in kHz o MHz a scelta (impostazione), persistite in Hz.                                                                        | M    | M3→ |
| FR-GEN-07 | Ogni modulo è raggiungibile dalla dashboard e dalla navigazione principale, anche se non ancora implementato (stato "In sviluppo" esplicito, senza contenuti finti). | M    | M1  |

### 4.1 MOD-01 — Dashboard

| ID        | Requisito                                                                                                                                                     | Pri. | M                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| FR-DSH-01 | Griglia touch dei 14 moduli con icona, nome e stato (disponibile / in sviluppo).                                                                              | M    | M1                         |
| FR-DSH-02 | Workspace **HAM** e **SWL** che filtrano e ordinano i moduli rilevanti.                                                                                       | M    | M1                         |
| FR-DSH-03 | Moduli preferiti fissabili in alto; ordine persistito.                                                                                                        | S    | M1 (UI) / M2 (persistenza) |
| FR-DSH-04 | Indicatore online/offline sempre visibile (basato su `navigator.onLine` + esito ultime richieste).                                                            | M    | M1                         |
| FR-DSH-05 | Pannello "freschezza dati": per ogni fonte importata, età del dato e avviso se scaduto (es. elementi orbitali > 7 giorni, palinsesto di stagione precedente). | M    | M5 (prima fonte) → M12     |
| FR-DSH-06 | Tema chiaro/scuro/sistema.                                                                                                                                    | M    | M1                         |
| FR-DSH-07 | Strumenti rapidi: ora UTC corrente, locator della stazione, accesso diretto a "Nuovo QSO" e "Nuova ricezione".                                                | S    | M1 (orologio) / M3–M4      |
| FR-DSH-08 | Notifica di nuova versione dell'app disponibile con aggiornamento su richiesta.                                                                               | M    | M1                         |

### 4.2 MOD-02 — HAM Logbook

| ID        | Requisito                                                                                                                                                                                                   | Pri. | M                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------- |
| FR-HAM-01 | Creare, modificare, eliminare (con conferma) un QSO.                                                                                                                                                        | M    | M3                           |
| FR-HAM-02 | Campi minimi obbligatori: nominativo, data/ora inizio UTC, frequenza, modo. Banda **derivata** dalla frequenza secondo il band plan IARU Regione 1, modificabile solo se fuori banda (avviso).              | M    | M3                           |
| FR-HAM-03 | Campi opzionali: ora fine, frequenza RX (split), sottomodo, RST inviato/ricevuto, potenza, nome, QTH, locator, paese/DXCC, zone CQ/ITU, riferimenti POTA/SOTA (propri e del corrispondente), contest, note. | M    | M3                           |
| FR-HAM-04 | Validazioni: nominativo (formato ITU, normalizzato maiuscolo), locator Maidenhead, RST coerente col modo (2 cifre fonia, 3 cifre CW/digitale, rapporti dB per FT8/FT4), frequenza > 0.                      | M    | M3                           |
| FR-HAM-05 | Inserimento rapido "a raffica" (contest/portatile): ora UTC precompilata a "adesso", frequenza e modo ereditati dal QSO precedente, tastiera ottimizzata.                                                   | S    | M3                           |
| FR-HAM-06 | Avviso di possibile duplicato (stesso nominativo, banda, modo entro una finestra temporale configurabile, default 10 min).                                                                                  | S    | M3                           |
| FR-HAM-07 | Ricerca e filtri per nominativo (anche parziale), intervallo date, banda, modo, paese, riferimento POTA/SOTA, stato QSL.                                                                                    | M    | M3                           |
| FR-HAM-08 | Lista virtualizzata/paginata che resta fluida con ≥ 50 000 QSO (vedi NFR-PERF-04).                                                                                                                          | M    | M3                           |
| FR-HAM-09 | **Import ADIF** (`.adi`; `.adx` = S): mapping dei campi standard, conservazione dei campi non mappati, report per record, rilevazione duplicati, anteprima, commit atomico.                                 | M    | M3                           |
| FR-HAM-10 | **Export ADIF** (`.adi`) dell'intero log o del risultato filtrato, conforme ADIF 3.1.x, con header `PROGRAMID`/`ADIF_VER`. Round-trip import→export senza perdita dei campi supportati.                     | M    | M3                           |
| FR-HAM-11 | Statistiche: QSO per banda, modo, paese/DXCC, nominativo; totale paesi lavorati/confermati.                                                                                                                 | M    | M3 (base) / M10 (confermati) |
| FR-HAM-12 | Allegati (foto, file) associati a un QSO.                                                                                                                                                                   | S    | M3                           |
| FR-HAM-13 | Lo stato QSL sintetico di ciascun QSO è visibile in lista (dettaglio in MOD-09).                                                                                                                            | M    | M3 / M10                     |
| FR-HAM-14 | Profili stazione multipli (es. fissa / portatile) e associazione del QSO al profilo attivo.                                                                                                                 | S    | M3                           |
| FR-HAM-15 | Export CSV del log.                                                                                                                                                                                         | C    | M3                           |

### 4.3 MOD-03 — SWL Logbook

| ID        | Requisito                                                                                                                                                                                                                                                                                                               | Pri. | M       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| FR-SWL-01 | CRUD di ricezioni con categoria obbligatoria fra le 7: Broadcast internazionale, Monitoraggio radioamatoriale, Utility e segnali orari, Modi digitali, Aeronautica, Marittima, Satelliti.                                                                                                                               | M    | M4      |
| FR-SWL-02 | Campi comuni: data/ora UTC inizio (fine opzionale), frequenza, modulazione, identificazione stazione, località di ricezione (profilo o locator/coordinate), apparato e antenna, SINPO e/o RST, note.                                                                                                                    | M    | M4      |
| FR-SWL-03 | Metadati specifici per categoria (vedi [Database § reception_details](../architecture/DATABASE.md#reception_details)), validati con schema discriminato per categoria.                                                                                                                                                  | M    | M4      |
| FR-SWL-04 | Per Aeronautica e Marittima **non** esistono campi strutturati per il contenuto delle comunicazioni; il form mostra un avviso sulla riservatezza (art. 15 Cost., D.Lgs. 259/2003 e normativa vigente). Si registrano solo dati tecnici (servizio, frequenza, identificativo della stazione di terra/costiera, qualità). | M    | M4      |
| FR-SWL-05 | Allegati audio e immagini (registrazioni proprie), con limite di dimensione configurabile e avviso sullo spazio.                                                                                                                                                                                                        | S    | M4      |
| FR-SWL-06 | Filtri avanzati: categoria, intervallo date, banda/frequenza, stazione, paese, lingua, SINPO minimo.                                                                                                                                                                                                                    | M    | M4      |
| FR-SWL-07 | Statistiche per categoria, banda, paese, stazione.                                                                                                                                                                                                                                                                      | S    | M4      |
| FR-SWL-08 | Export **CSV** e **JSON** (filtrato o completo).                                                                                                                                                                                                                                                                        | M    | M4      |
| FR-SWL-09 | Collegamento opzionale di una ricezione broadcast a una voce di palinsesto (MOD-04) e di una ricezione satellitare a un satellite del catalogo (MOD-06) quando disponibili.                                                                                                                                             | S    | M5 / M8 |
| FR-SWL-10 | Generazione testo di rapporto di ricezione (per richiesta QSL alla stazione) dai dati tecnici.                                                                                                                                                                                                                          | C    | M10     |

### 4.4 MOD-04 — Frequency Explorer

| ID        | Requisito                                                                                                                                                              | Pri. | M   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-FRQ-01 | **Import manuale EiBi** (file `sked-XNN.csv`, separatore `;`), con riconoscimento della stagione dal nome file e conservazione dei codici originali.                   | M    | M5  |
| FR-FRQ-02 | **Import manuale HFCC** (file pubblico `XNNallx2.zip`/`.txt` a larghezza fissa) con parsing documentato.                                                               | S    | M5  |
| FR-FRQ-03 | Gestione dataset per stagione: elenco dataset importati, stagione attiva, sostituzione atomica, eliminazione; avviso se la stagione importata non è quella corrente.   | M    | M5  |
| FR-FRQ-04 | Ricerca per frequenza esatta o intervallo (± tolleranza), stazione, paese ITU, lingua, area target, sito trasmettitore.                                                | M    | M5  |
| FR-FRQ-05 | Query "**in onda ora**" e "in onda all'ora X UTC del giorno Y", che tiene conto dei giorni della settimana e delle date di validità.                                   | M    | M5  |
| FR-FRQ-06 | Consultazione completamente offline dei dataset importati.                                                                                                             | M    | M5  |
| FR-FRQ-07 | Catalogo di frequenze personali (memorie): etichetta, frequenza, modo, servizio, note, tag.                                                                            | S    | M5  |
| FR-FRQ-08 | Decodifica leggibile dei codici EiBi (lingue, paesi ITU, aree target, siti trasmettitori) tramite tabelle incluse nel dataset o inserite a mano, con fonte dichiarata. | S    | M5  |
| FR-FRQ-09 | Provenienza visibile su ogni risultato: fonte, stagione, data di import, nome file.                                                                                    | M    | M5  |

### 4.5 MOD-05 — Signal Explorer

| ID        | Requisito                                                                                                                                                          | Pri. | M   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | --- |
| FR-SIG-01 | Catalogo dei tipi di segnale: nome, alias, categoria, modulazione, larghezza di banda, intervalli di frequenza tipici, caratteristiche, descrizione.               | M    | M7  |
| FR-SIG-02 | Ricerca testuale e filtri per categoria, modulazione, intervallo di frequenza, larghezza di banda.                                                                 | M    | M7  |
| FR-SIG-03 | Collegamento esterno alla pagina SigIDWiki di riferimento per ogni voce.                                                                                           | M    | M7  |
| FR-SIG-04 | Il contenuto incluso nel bundle è **redatto in proprio** o con licenza compatibile verificata; audio/waterfall di terzi solo come link (salvo licenza verificata). | M    | M7  |
| FR-SIG-05 | Voci utente aggiuntive (CRUD) e import/export JSON del catalogo.                                                                                                   | S    | M7  |
| FR-SIG-06 | Da una frequenza (es. una ricezione SWL) proporre i tipi di segnale compatibili.                                                                                   | C    | M7  |

### 4.6 MOD-06 — Satellite Explorer

| ID        | Requisito                                                                                                                                                                                                                          | Pri. | M   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-SAT-01 | Catalogo satelliti con NORAD ID, nomi, stato operativo (attivo / non operativo / rientrato / sconosciuto) e fonte.                                                                                                                 | M    | M8  |
| FR-SAT-02 | **Download elementi orbitali da CelesTrak** (gruppo `amateur` e gruppi selezionati, formato OMM JSON o TLE) su richiesta dell'utente, rispettando la frequenza di aggiornamento della fonte (max 1 richiesta per gruppo ogni 2 h). | M    | M8  |
| FR-SAT-03 | **Import manuale** di file TLE (`.txt`/`.tle`) e OMM (JSON/XML/CSV).                                                                                                                                                               | M    | M8  |
| FR-SAT-04 | Transmitter SatNOGS (uplink/downlink, modo, baud, stato) tramite **import manuale del JSON** dell'API pubblica SatNOGS DB (CORS assente, vedi Fonti).                                                                              | M    | M8  |
| FR-SAT-05 | Previsione passaggi per la stazione attiva: AOS, TCA, LOS, elevazione massima, azimut AOS/LOS, con soglia di elevazione minima configurabile.                                                                                      | M    | M8  |
| FR-SAT-06 | Posizione in tempo reale (azimut/elevazione/distanza, sotto-satellite) aggiornata ogni secondo per il satellite selezionato.                                                                                                       | M    | M8  |
| FR-SAT-07 | Ground track su mappa Leaflet (online) e visualizzazione polare del passaggio (offline).                                                                                                                                           | S    | M8  |
| FR-SAT-08 | Effetto Doppler stimato sulle frequenze del transponder durante il passaggio.                                                                                                                                                      | C    | M8  |
| FR-SAT-09 | Avviso di **dati obsoleti**: età dell'epoca degli elementi sempre visibile; avviso oltre 7 giorni, avviso forte oltre 30 giorni; satelliti non operativi o rientrati esclusi dalle previsioni per default.                         | M    | M8  |
| FR-SAT-10 | Previsioni calcolate interamente offline sui dati già scaricati.                                                                                                                                                                   | M    | M8  |
| FR-SAT-11 | Testo informativo sui limiti di precisione di SGP4 e dei dati.                                                                                                                                                                     | M    | M8  |

### 4.7 MOD-07 — Resource Manager

| ID        | Requisito                                                                                                                                                                                                                                         | Pri. | M   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-RES-01 | Catalogo segnalibri: URL, titolo, descrizione, categoria, tag, preferito, data di aggiunta.                                                                                                                                                       | M    | M9  |
| FR-RES-02 | **Import Raindrop.io** da file HTML in formato Netscape Bookmark (`Ham_Radio.html`): cartelle `H3` annidate → categorie gerarchiche, attributi `ADD_DATE`, `LAST_MODIFIED`, `TAGS`, `DATA-IMPORTANT`, `DATA-COVER`, eventuali `DD` → descrizione. | M    | M9  |
| FR-RES-03 | Il file importato è trattato come **non fidato**: parsing con `DOMParser` in documento inerte, nessuna esecuzione di script, solo URL `http(s)` accettati, testi normalizzati e mai renderizzati come HTML.                                       | M    | M9  |
| FR-RES-04 | Rilevazione duplicati per URL normalizzato (schema/host minuscoli, rimozione `www.`, slash finale, parametri `utm_*`) con scelta salta/unisci/duplica.                                                                                            | M    | M9  |
| FR-RES-05 | Ricerca testuale, filtri per categoria, tag, preferiti; ordinamento.                                                                                                                                                                              | M    | M9  |
| FR-RES-06 | CRUD manuale di risorse e categorie.                                                                                                                                                                                                              | M    | M9  |
| FR-RES-07 | Documenti locali (PDF, immagini) memorizzati come allegati, solo se l'utente li carica.                                                                                                                                                           | S    | M9  |
| FR-RES-08 | Le immagini di copertina remote (`DATA-COVER`) **non** vengono caricate automaticamente (privacy, offline); caricamento su richiesta.                                                                                                             | S    | M9  |
| FR-RES-09 | Export JSON e Netscape HTML.                                                                                                                                                                                                                      | S    | M9  |
| FR-RES-10 | Le risorse di riferimento di tutti i moduli (link a fonti esterne) sono consultabili da qui.                                                                                                                                                      | S    | M9  |

### 4.8 MOD-08 — DX Cluster

| ID        | Requisito                                                                                                                                                                                                           | Pri. | M   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-DXC-01 | Elenco di cluster e servizi DX esterni (link) con preferiti.                                                                                                                                                        | M    | M10 |
| FR-DXC-02 | Integrazione nativa in sola lettura **solo se** l'endpoint HTTP è verificato (CORS, termini d'uso). Candidato: DX Summit (CORS `*` verificato, termini da confermare in M10). Telnet non è accessibile dal browser. | S    | M10 |
| FR-DXC-03 | Filtri spot per nominativo, banda, modo, frequenza, continente/paese.                                                                                                                                               | M    | M10 |
| FR-DXC-04 | Import manuale di spot (testo in formato cluster `DX de ...`) quando l'integrazione non è disponibile.                                                                                                              | C    | M10 |
| FR-DXC-05 | Indicazione "già lavorato / nuovo paese / nuova banda" confrontando con il logbook.                                                                                                                                 | S    | M10 |
| FR-DXC-06 | Gli spot sono dati effimeri: conservati in cache con orario di recupero, eliminati dopo 24 h, esclusi dal backup.                                                                                                   | M    | M10 |

### 4.9 MOD-09 — QSL Manager

| ID        | Requisito                                                                                                                                                                                                                    | Pri. | M                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------- |
| FR-QSL-01 | Record QSL collegati a un QSO o a una ricezione SWL, con canale (cartacea, eQSL, LoTW, QRZ, altro) e via (bureau, diretta, manager, elettronica).                                                                            | M    | M10              |
| FR-QSL-02 | Stati: _da inviare_, _richiesta_, _inviata_, _ricevuta_, _confermata_, con date per ogni transizione.                                                                                                                        | M    | M10              |
| FR-QSL-03 | Note e allegati (scansione della cartolina).                                                                                                                                                                                 | S    | M10              |
| FR-QSL-04 | Statistiche: QSL inviate/ricevute/in attesa per canale; paesi confermati.                                                                                                                                                    | M    | M10              |
| FR-QSL-05 | Interoperabilità ADIF: import/export dei campi `QSL_SENT`, `QSL_RCVD`, `QSLSDATE`, `QSLRDATE`, `QSL_VIA`, `LOTW_QSL_*`, `EQSL_QSL_*`, `QRZCOM_QSO_*`. Aggiornamento conferme importando il file ADIF scaricato da LoTW/eQSL. | M    | M3 (campi) / M10 |
| FR-QSL-06 | Link esterni a eQSL, LoTW, QRZ. **Nessuna** integrazione autenticata, nessuna automazione della firma TQSL.                                                                                                                  | M    | M10              |
| FR-QSL-07 | Coda di stampa/etichette QSL.                                                                                                                                                                                                | C    | —                |

### 4.10 MOD-10 — APRS Explorer

| ID        | Requisito                                                                                                                                                                                | Pri. | M   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-APR-01 | Accesso alla mappa APRS esterna (aprs.fi) tramite link, anche precompilato con nominativo o locator.                                                                                     | M    | M11 |
| FR-APR-02 | Segnalibri di stazioni APRS (nominativo, SSID, note).                                                                                                                                    | M    | M11 |
| FR-APR-03 | Lookup nominativo **solo** tramite servizi consentiti: v1 = link a aprs.fi. L'API aprs.fi richiede chiave personale e vieta il pre-caching: nessuna integrazione nativa in v1 senza ADR. | M    | M11 |
| FR-APR-04 | Conversione locator ↔ coordinate e mappa di riferimento della posizione di una stazione inserita a mano.                                                                                 | S    | M11 |

### 4.11 MOD-11 — Repeater Explorer

| ID        | Requisito                                                                                                                                                                                                     | Pri. | M   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-RPT-01 | Catalogo ripetitori gestito dall'utente: nominativo, nome, frequenza di uscita/ingresso (o shift), modo (FM, DMR, D-STAR, C4FM, …), tono CTCSS/DCS, color code/TG, località, coordinate/locator, stato, note. | M    | M11 |
| FR-RPT-02 | Ricerca per distanza dalla posizione attuale o dalla stazione, banda, modo.                                                                                                                                   | M    | M11 |
| FR-RPT-03 | Mappa dei ripetitori (Leaflet/OSM, online).                                                                                                                                                                   | S    | M11 |
| FR-RPT-04 | Import CSV generico con mapping colonne (es. export dell'utente da altri software) e export CSV/JSON.                                                                                                         | S    | M11 |
| FR-RPT-05 | Link esterni a RepeaterBook e MapForHam. Import da questi database solo se la licenza lo consente (RepeaterBook API: autenticazione richiesta, verificata HTTP 401).                                          | M    | M11 |
| FR-RPT-06 | Geolocalizzazione del dispositivo su richiesta esplicita, con fallback alla posizione della stazione.                                                                                                         | S    | M11 |

### 4.12 MOD-12 — Calcolatori RF

Tutti i calcolatori funzionano offline, validano gli input, mostrano unità esplicite e sono coperti da test numerici con valori di riferimento documentati.

| ID        | Calcolatore                                                                                                                       | Pri. | M                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------ |
| FR-RFC-01 | Legge di Ohm (V, I, R: dati due, calcola il terzo).                                                                               | M    | M6                       |
| FR-RFC-02 | Potenza elettrica (P da V·I, V²/R, I²·R).                                                                                         | M    | M6                       |
| FR-RFC-03 | Conversione W ↔ dBm ↔ dBW.                                                                                                        | M    | M6                       |
| FR-RFC-04 | Frequenza ↔ lunghezza d'onda (con fattore di velocità opzionale).                                                                 | M    | M6                       |
| FR-RFC-05 | Lunghezza dipolo a mezz'onda (fattore di accorciamento configurabile, default 0,95).                                              | M    | M6                       |
| FR-RFC-06 | Lunghezza stilo a quarto d'onda.                                                                                                  | M    | M6                       |
| FR-RFC-07 | ROS ↔ coefficiente di riflessione ↔ return loss ↔ potenza riflessa.                                                               | M    | M6                       |
| FR-RFC-08 | Attenuazione del cavo (tabella cavi comuni con dati dichiarati e fonte, lunghezza, frequenza; perdita in dB e potenza in uscita). | M    | M6                       |
| FR-RFC-09 | Distanza e azimut (great circle) fra due locator o coordinate, incluso azimut inverso.                                            | M    | M2/M3 (domain) · M6 (UI) |
| FR-RFC-10 | Conversione locator Maidenhead ↔ coordinate (4/6/8 caratteri).                                                                    | M    | M2/M3 (domain) · M6 (UI) |
| FR-RFC-11 | Conversione ora UTC ↔ locale (fuso del dispositivo o selezionato).                                                                | M    | M6                       |
| FR-RFC-12 | Storico degli ultimi calcoli.                                                                                                     | C    | M6                       |

### 4.13 MOD-13 — Propagazione

| ID        | Requisito                                                                                                                                                     | Pri. | M   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| FR-PRP-01 | Flusso solare (SFI 10,7 cm), indice Kp, indice A, vento solare, raggi X quando disponibili da fonte verificata.                                               | M    | M12 |
| FR-PRP-02 | Ogni valore è etichettato come **osservato** o **previsione**, con orario della misura (UTC) e fonte.                                                         | M    | M12 |
| FR-PRP-03 | Cache locale dei valori con timestamp; offline si mostrano gli ultimi valori con la loro età.                                                                 | M    | M12 |
| FR-PRP-04 | Condizioni HF per banda: banner HamQSL incorporato come immagine (consentito dal servizio) + link; nessun parsing XML diretto (CORS assente, verificato).     | M    | M12 |
| FR-PRP-05 | Informazioni MUF/foF2 tramite link a fonti di riferimento (es. ionosonde) se non esiste un endpoint compatibile.                                              | S    | M12 |
| FR-PRP-06 | Risorse di riferimento sulla propagazione (link curati).                                                                                                      | S    | M12 |
| FR-PRP-07 | Fonte dati numerica proposta: NOAA SWPC (JSON pubblico, CORS `*` verificato) — richiede approvazione [ADR-0010](../adr/0010-noaa-swpc-propagation-source.md). | S    | M12 |

### 4.14 MOD-14 — Impostazioni e Backup

| ID        | Requisito                                                                                                                                                                | Pri. | M                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------- |
| FR-SET-01 | Profilo operatore/SWL: nominativo (opzionale per SWL), identificativo SWL, nome, locator, coordinate, QTH, zone, apparati. Profili stazione multipli.                    | M    | M2 (dati) / M3 (UI) |
| FR-SET-02 | Preferenze: tema, unità di frequenza (kHz/MHz), unità di lunghezza (m/ft), formato data, fuso per la conversione.                                                        | M    | M1 (tema) / M3      |
| FR-SET-03 | Stato dello storage: quota stimata e uso (`navigator.storage.estimate()`), stato della persistenza (`navigator.storage.persisted()`), pulsante di richiesta persistenza. | M    | M2                  |
| FR-SET-04 | Gestione database: conteggio record per tabella, svuotamento cache derivate (passaggi, spot), eliminazione dataset importati.                                            | M    | M2 / M13            |
| FR-SET-05 | **Backup JSON versionato** di tutti i dati utente (con `schemaVersion`, `appVersion`, `exportedAt`), allegati inclusi opzionalmente.                                     | M    | M2 (formato) / M13  |
| FR-SET-06 | **Restore** con validazione Zod, anteprima, migrazione da versioni di schema precedenti, modalità _sostituisci_ (default) o _unisci_; atomico.                           | M    | M2 / M13            |
| FR-SET-07 | Diagnostica import/export: storico dei job di import con esito, conteggi ed errori.                                                                                      | M    | M2 / M13            |
| FR-SET-08 | Gestione fonti dati: elenco fonti con modalità di accesso (native / import manuale / link), licenza, ultimo aggiornamento.                                               | M    | M5 / M12            |
| FR-SET-09 | Promemoria di backup se l'ultimo è più vecchio di N giorni (default 30).                                                                                                 | S    | M13                 |
| FR-SET-10 | Informazioni sull'app: versione, licenze delle dipendenze e attribuzioni delle fonti.                                                                                    | M    | M13                 |

---

## 5. Casi d'uso principali

Formato sintetico. Le precondizioni comuni a tutti i casi d'uso: app installata o aperta nel browser; dati locali disponibili.

### UC-01 — Registrare un QSO (anche offline)

- **Attore**: Operatore HAM. **Requisiti**: FR-HAM-01..06.
- **Flusso**: 1) l'utente apre "Nuovo QSO" (dashboard o logbook); 2) il form propone ora UTC attuale, frequenza e modo dell'ultimo QSO, profilo stazione attivo; 3) l'utente inserisce nominativo e RST; 4) il sistema deriva la banda, valida i campi, segnala eventuale duplicato; 5) l'utente salva; 6) il QSO è persistito in IndexedDB e appare in cima alla lista.
- **Alternativi**: 4a) validazione fallita → errori accanto ai campi, nessun salvataggio. 4b) duplicato → avviso non bloccante.
- **Postcondizione**: record valido persistito; nessuna rete richiesta.

### UC-02 — Importare un log ADIF

- **Attore**: Operatore HAM. **Requisiti**: FR-HAM-09, FR-QSL-05, FR-GEN-03.
- **Flusso**: 1) selezione file `.adi`; 2) parsing in streaming con limiti di dimensione; 3) validazione per record; 4) anteprima: totali, validi, invalidi (con motivo e posizione), duplicati; 5) l'utente sceglie la politica per i duplicati e conferma; 6) commit in un'unica transazione; 7) `import_jobs` registra esito e conteggi.
- **Alternativi**: 3a) file non ADIF/corrotto → errore, nessuna scrittura. 6a) errore durante il commit → rollback completo.

### UC-03 — Esportare il log in ADIF per LoTW/eQSL/QRZ

- **Attore**: Operatore HAM. **Requisiti**: FR-HAM-10, FR-QSL-06.
- **Flusso**: 1) filtri opzionali (es. QSO non ancora caricati); 2) generazione file `.adi`; 3) download; 4) il sistema mostra i link ai servizi esterni dove l'utente caricherà il file (firma TQSL fuori dall'app per LoTW).

### UC-04 — Registrare una ricezione SWL

- **Attore**: SWL. **Requisiti**: FR-SWL-01..05, FR-SWL-09.
- **Flusso**: 1) scelta categoria; 2) form con campi comuni + campi specifici; 3) per broadcast: suggerimento delle stazioni in palinsesto sulla frequenza all'ora indicata (se dataset importato); 4) SINPO con selettori 1–5; 5) allegato audio opzionale; 6) salvataggio.
- **Vincolo**: per Aeronautica/Marittima il form non propone campi per il contenuto delle comunicazioni (FR-SWL-04).

### UC-05 — Importare un palinsesto EiBi e cercare "cosa c'è in onda"

- **Attore**: SWL. **Requisiti**: FR-FRQ-01, 03, 05, 09.
- **Flusso**: 1) l'utente scarica `sked-XNN.csv` dal sito EiBi (link nell'app); 2) lo importa; 3) anteprima con stagione rilevata, numero righe valide/invalide; 4) se esiste un dataset della stessa stagione, lo sostituisce atomicamente; 5) l'utente apre "In onda ora" e filtra per lingua/banda.
- **Alternativi**: 3a) stagione non corrente → avviso, import comunque consentito.

### UC-06 — Aggiornare gli elementi orbitali e prevedere i passaggi

- **Attore**: Operatore HAM / SWL. **Requisiti**: FR-SAT-02, 05, 09, 10.
- **Flusso**: 1) l'utente preme "Aggiorna da CelesTrak" (online); 2) il sistema verifica che l'ultimo download del gruppo sia più vecchio di 2 h; 3) scarica OMM JSON, valida, salva con data di download; 4) calcola i passaggi delle prossime 24/48 h per la stazione attiva; 5) mostra elenco con AOS/TCA/LOS ed età degli elementi.
- **Alternativi**: 1a) offline → calcolo sui dati esistenti con avviso di età. 3a) HTTP 403/404 → nessun retry automatico, messaggio all'utente (policy CelesTrak).

### UC-07 — Importare i transmitter SatNOGS

- **Attore**: Operatore HAM. **Requisiti**: FR-SAT-04.
- **Flusso**: 1) l'app mostra il link all'endpoint pubblico JSON di SatNOGS DB; 2) l'utente salva il file e lo importa; 3) validazione e associazione ai satelliti per NORAD ID; 4) report degli orfani (satelliti non presenti nel catalogo).

### UC-08 — Importare i segnalibri Raindrop

- **Attore**: qualsiasi. **Requisiti**: FR-RES-02..04.
- **Flusso**: 1) selezione `Ham_Radio.html`; 2) parsing sicuro; 3) anteprima: categorie, risorse, duplicati, URL scartati; 4) conferma; 5) commit atomico.

### UC-09 — Consultare la propagazione

- **Attore**: Operatore HAM. **Requisiti**: FR-PRP-01..04.
- **Flusso**: 1) apertura modulo; 2) se online e i dati in cache sono più vecchi della soglia, refresh dalle fonti verificate; 3) visualizzazione valori con etichetta osservato/previsione, orario e fonte; 4) banner HamQSL e link di approfondimento.
- **Alternativi**: offline → ultimi valori con età evidenziata.

### UC-10 — Gestire una QSL

- **Attore**: Operatore HAM / SWL. **Requisiti**: FR-QSL-01..05.
- **Flusso**: 1) dal QSO/ricezione l'utente apre la QSL; 2) imposta canale e via; 3) registra gli avanzamenti di stato con data; 4) allega la scansione. 5) In alternativa importa il file ADIF di conferme LoTW: il sistema abbina per nominativo + data/ora (± tolleranza) + banda + modo e aggiorna lo stato.

### UC-11 — Consultare gli spot DX

- **Attore**: Operatore HAM. **Requisiti**: FR-DXC-01..06.
- **Flusso**: se l'integrazione nativa è approvata: caricamento spot recenti (in primo piano, con limite di frequenza di refresh), filtri, evidenza dei nuovi paesi/bande; altrimenti elenco dei cluster esterni come link.

### UC-12 — Trovare un ripetitore vicino

- **Attore**: Operatore HAM. **Requisiti**: FR-RPT-01..03, FR-RPT-06.
- **Flusso**: 1) l'utente concede la geolocalizzazione o usa la stazione attiva; 2) il sistema ordina i ripetitori del catalogo locale per distanza; 3) dettaglio con frequenze, shift, tono; 4) mappa se online.

### UC-13 — Eseguire un calcolo RF

- **Attore**: Appassionato RF. **Requisiti**: FR-RFC-*.
- **Flusso**: scelta calcolatore → inserimento valori con unità → risultato immediato con formula e unità → copia del risultato.

### UC-14 — Backup e restore

- **Attore**: qualsiasi. **Requisiti**: FR-SET-05..07.
- **Flusso backup**: 1) scelta inclusione allegati; 2) generazione JSON versionato; 3) download (o condivisione tramite Web Share API se disponibile).
- **Flusso restore**: 1) selezione file; 2) validazione formato e `schemaVersion`; 3) migrazione in memoria alla versione corrente se precedente; 4) anteprima conteggi; 5) scelta _sostituisci/unisci_; 6) commit atomico; 7) report.
- **Alternativi**: `schemaVersion` più recente dell'app → rifiuto con messaggio "aggiorna l'app".

### UC-15 — Installare l'app e usarla offline

- **Attore**: qualsiasi. **Requisiti**: NFR-OFF-*, FR-DSH-04, FR-DSH-08.
- **Flusso**: 1) apertura dell'URL HTTPS in Chrome Android; 2) prompt di installazione; 3) primo avvio: precache dell'app shell, richiesta di persistenza storage; 4) in modalità aereo l'app si apre e le funzioni offline sono operative; 5) quando una nuova versione è disponibile compare un avviso con "Aggiorna".

---

## 6. Requisiti non funzionali

### 6.1 Offline e affidabilità (NFR-OFF, NFR-REL)

| ID         | Requisito                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-OFF-01 | Funzionano senza rete: dashboard e navigazione, logbook HAM e SWL, calcolatori, utility Maidenhead, palinsesti importati, catalogo segnali locale, calcoli satellitari su dati salvati, Resource Manager (metadati), backup ed export (PROJECT §8). |
| NFR-OFF-02 | L'app shell è precaricata dal service worker; tutte le route sono navigabili offline dopo il primo caricamento.                                                                                                                                     |
| NFR-OFF-03 | Le funzioni che richiedono rete lo dichiarano in UI e degradano in modo esplicito (messaggio + ultimo dato in cache con età).                                                                                                                       |
| NFR-OFF-04 | Il funzionamento offline è verificato su un **tablet Android reale** (checklist manuale in M1 e M13) oltre che con Playwright (contesto offline).                                                                                                   |
| NFR-REL-01 | Nessuna perdita di dati per chiusura dell'app durante una scrittura: ogni operazione multi-record è una transazione Dexie.                                                                                                                          |
| NFR-REL-02 | Migrazioni di schema esplicite, testate e mai modificate dopo il rilascio.                                                                                                                                                                          |
| NFR-REL-03 | All'avvio si richiede `navigator.storage.persist()`; se negato, avviso persistente in Impostazioni e promemoria di backup.                                                                                                                          |
| NFR-REL-04 | Round-trip backup → restore produce dati identici (test automatico su tutte le tabelle).                                                                                                                                                            |

### 6.2 Prestazioni (NFR-PERF)

Dispositivo di riferimento: tablet Android di fascia media (≈ 4 GB RAM, Chrome stabile). Valori da verificare in M13 con Lighthouse e misure manuali.

| ID          | Requisito                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| NFR-PERF-01 | JS iniziale (route dashboard) ≤ 200 KB gzip; moduli caricati in lazy loading per route.               |
| NFR-PERF-02 | Avvio a freddo da cache (app installata) con dashboard interattiva ≤ 2 s.                             |
| NFR-PERF-03 | Navigazione fra moduli ≤ 300 ms percepiti (chunk già in cache).                                       |
| NFR-PERF-04 | Logbook con 50 000 QSO: apertura lista ≤ 1 s, filtro per nominativo/banda ≤ 300 ms.                   |
| NFR-PERF-05 | Query "in onda ora" su un dataset EiBi completo (≈ 10–15 000 righe) ≤ 300 ms.                         |
| NFR-PERF-06 | Import ADIF di 10 000 QSO ≤ 10 s, senza bloccare l'interfaccia (parsing in Web Worker se necessario). |
| NFR-PERF-07 | Previsione passaggi 48 h per ≤ 100 satelliti ≤ 3 s (Web Worker).                                      |
| NFR-PERF-08 | Lighthouse (mobile) ≥ 90 in Performance, Accessibility, Best Practices; PWA installabile.             |

### 6.3 Usabilità e accessibilità (NFR-UX, NFR-ACC)

| ID         | Requisito                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-UX-01  | Mobile-first, ottimizzata per tablet in orizzontale e verticale; utilizzabile da desktop.                                                      |
| NFR-UX-02  | Target touch ≥ 44 × 44 px; nessuna funzione raggiungibile solo con hover.                                                                      |
| NFR-UX-03  | Tema scuro e chiaro; il tema scuro è utilizzabile di notte in stazione (luminanza bassa, niente bianco pieno).                                 |
| NFR-UX-04  | Form con tastiere virtuali adatte (`inputmode="decimal"` per frequenze, maiuscolo automatico per nominativi).                                  |
| NFR-ACC-01 | Obiettivo WCAG 2.2 livello AA: contrasto, etichette, focus visibile, ordine di tabulazione, navigazione da tastiera, `prefers-reduced-motion`. |
| NFR-ACC-02 | Grafici e mappe hanno un'alternativa testuale/tabellare.                                                                                       |
| NFR-ACC-03 | Test automatici di accessibilità (axe con Playwright) sulle viste principali.                                                                  |

### 6.4 Sicurezza e privacy (NFR-SEC, NFR-PRIV)

| ID          | Requisito                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SEC-01  | Nessun segreto condiviso nel bundle; eventuali credenziali personali (future) solo inserite dall'utente e mai incluse nel backup senza consenso esplicito.                |
| NFR-SEC-02  | Tutti i file importati (ADIF, CSV, HTML, JSON, TLE, ZIP) sono non fidati: limiti di dimensione, validazione Zod, nessun `v-html` non sanificato, nessun `eval`.           |
| NFR-SEC-03  | Content Security Policy restrittiva (default `self`, eccezioni dichiarate per tile OSM, immagini HamQSL e fonti native).                                                  |
| NFR-SEC-04  | Link esterni con `rel="noopener noreferrer"`; solo schemi `http(s)` ammessi per URL forniti dall'utente o da import.                                                      |
| NFR-SEC-05  | `npm audit` senza vulnerabilità alte/critiche in CI per le dipendenze runtime.                                                                                            |
| NFR-PRIV-01 | Nessuna telemetria né analytics in v1. I dati restano sul dispositivo; le richieste esterne avvengono solo verso fonti dichiarate e su azione o abilitazione dell'utente. |
| NFR-PRIV-02 | Geolocalizzazione solo su richiesta esplicita.                                                                                                                            |
| NFR-PRIV-03 | Rispetto della riservatezza delle comunicazioni (CON-08).                                                                                                                 |

### 6.5 Manutenibilità e qualità (NFR-MNT)

| ID         | Requisito                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-MNT-01 | TypeScript `strict`; nessun `any` implicito; `noUncheckedIndexedAccess` abilitato (vedi Architettura).                                                      |
| NFR-MNT-02 | Regole di dipendenza fra layer verificate automaticamente in lint.                                                                                          |
| NFR-MNT-03 | Copertura test ≥ 90 % righe sul domain critico (conversioni, locator, calcolatori, parser, migrazioni, backup); ≥ 70 % complessiva su domain + application. |
| NFR-MNT-04 | CI su GitHub Actions: typecheck, lint, unit, build, E2E su ogni push/PR.                                                                                    |
| NFR-MNT-05 | Ogni decisione architetturale rilevante documentata come ADR.                                                                                               |

### 6.6 Compatibilità (NFR-CMP)

| ID         | Requisito                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| NFR-CMP-01 | Target primario: Chrome per Android (ultime 2 versioni stabili), PWA installata.                                                  |
| NFR-CMP-02 | Supportati: Chrome, Edge, Firefox desktop (ultime 2 versioni). Safari/iOS: best effort, non bloccante per v1.                     |
| NFR-CMP-03 | Funzioni dipendenti da API non universali (File System Access, Web Share, Geolocation) hanno fallback (download/upload classico). |

### 6.7 Internazionalizzazione (NFR-I18N)

| ID          | Requisito                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------- |
| NFR-I18N-01 | Tutte le stringhe UI in catalogo i18n (italiano in v1); nessuna stringa hardcoded nei componenti. |
| NFR-I18N-02 | Numeri e date formattati con `Intl` (locale `it-IT`), date dei log in UTC.                        |
| NFR-I18N-03 | Struttura predisposta per l'aggiunta dell'inglese senza modifiche ai componenti.                  |

---

## 7. Criteri di accettazione della v1.0

Coincidono con la _Definition of Done_ di `PROJECT.md` §12, resa verificabile:

| #   | Criterio                                                 | Verifica                                                    |
| --- | -------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | PWA installabile su tablet Android supportato            | Test manuale su dispositivo + Lighthouse                    |
| 2   | Tutti i 14 moduli accessibili                            | E2E navigazione                                             |
| 3   | Funzioni offline di NFR-OFF-01 operative                 | E2E offline + checklist su dispositivo                      |
| 4   | QSO e ricezioni SWL persistiti in modo affidabile        | Test integrazione repository + E2E con reload               |
| 5   | Importer EiBi/HFCC superano i test di validazione        | Unit test su fixture reali ridotte                          |
| 6   | Calcoli satellitari corretti con dataset validi          | Unit test SGP4 contro valori di riferimento                 |
| 7   | Calcolatori RF superano i test numerici                  | Unit test con valori documentati                            |
| 8   | Import Raindrop funzionante                              | Unit + E2E con fixture anonimizzata                         |
| 9   | QSL, DX, APRS, ripetitori entro il perimetro documentato | E2E + revisione di [Fonti dati](../data-sources/SOURCES.md) |
| 10  | Export, backup e restore testati                         | Unit round-trip + E2E                                       |
| 11  | Build di produzione riuscita                             | CI                                                          |
| 12  | Test automatici e test di accettazione Android superati  | CI + checklist firmata                                      |
| 13  | Documentazione utente e tecnica completa                 | Revisione `docs/` + README                                  |
| 14  | Limiti noti e restrizioni dei provider documentati       | `SOURCES.md` + pagina "Informazioni" in app                 |

---

## 8. Fuori perimetro v1 (Won't)

Da `PROJECT.md` §11: backend obbligatorio, gateway Raspberry Pi, controllo CAT, PTT e trasmissione, interfacce audio radio, ricezione SDR in tempo reale, decodifica DSP nativa, sincronizzazione multi-dispositivo, account cloud obbligatori, API a pagamento senza approvazione.

Aggiunti in M0 (derivati dai vincoli, da confermare):

- Mappe offline (download massivo di tile): vietato dalla [Tile Usage Policy OSM](https://operations.osmfoundation.org/policies/tiles/); le mappe sono solo online.
- Integrazioni autenticate con QRZ, eQSL, LoTW, aprs.fi, RepeaterBook.
- Proxy CORS di qualunque tipo.
- Multi-utente sullo stesso dispositivo.

---

## 9. Questioni aperte

Da risolvere entro la milestone indicata; ogni decisione produce o aggiorna un ADR.

| #    | Questione                                                                                                  | Proposta                                                                                                                                                                              | Entro |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Q-01 | Hosting statico: GitHub Pages, Cloudflare Pages o altro? Influisce su base path, routing SPA e header CSP. | Cloudflare Pages o Netlify (header personalizzati e fallback SPA); GitHub Pages solo con `createWebHashHistory` o fallback 404. [ADR-0011](../adr/0011-static-hosting-and-routing.md) | M1    |
| Q-02 | Libreria i18n: `vue-i18n` o catalogo tipizzato leggero?                                                    | Catalogo tipizzato interno + `Intl`. [ADR-0008](../adr/0008-i18n-approach.md)                                                                                                         | M1    |
| Q-03 | Fonte numerica per la propagazione non presente in `PROJECT.md`.                                           | Aggiungere NOAA SWPC. [ADR-0010](../adr/0010-noaa-swpc-propagation-source.md)                                                                                                         | M12   |
| Q-04 | Integrazione nativa DX Summit: termini d'uso dell'API da confermare con i gestori.                         | Link nella v1; nativa solo con conferma scritta.                                                                                                                                      | M10   |
| Q-05 | Licenza dei contenuti testuali SigIDWiki (riuso di descrizioni).                                           | Descrizioni redatte in proprio + link; nessuna copia finché la licenza non è verificata.                                                                                              | M7    |
| Q-06 | Fonte delle tabelle DXCC (prefissi → entità) per statistiche e "nuovo paese".                              | Valutare `cty.dat` (AD1C, Country Files) — licenza e formato da verificare; fallback: campo DXCC da ADIF/inserimento manuale.                                                         | M3    |
| Q-07 | Dimensione massima consigliata degli allegati audio e impatto sulla quota.                                 | 20 MB per file, avviso oltre l'80 % della quota. [ADR-0009](../adr/0009-attachments-in-indexeddb.md)                                                                                  | M2    |
| Q-08 | I documenti di M0 vanno committati sul repository git (già inizializzato, remote GitHub).                  | Commit `docs: complete M0 analysis and design` dopo l'approvazione.                                                                                                                   | M0    |
