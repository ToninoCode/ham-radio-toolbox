# Roadmap e backlog — Ham Radio Toolbox v1

| Campo                | Valore                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stato                | M0 chiusa (2026-10-17) · **M1 approvata per la chiusura (2026-10-17), versione 0.1.0** (§ 6.3) · **M2**: Blocchi A–D approvati (2026-10-24), consolidamento tecnico completato in locale; rilascio 0.2.0 in preparazione (§ 7) |
| Ultimo aggiornamento | 2026-10-24                                                                                                                                                                                                                     |
| Capacità             | 10–12 h/settimana (nominale 11 h)                                                                                                                                                                                              |
| Stima M1–M13         | 171 h di base + 40 h di riserva (23,4 %) = **211 h** ≈ **19–23 settimane** dopo M0 (nominale: 21 settimane in totale, M0 inclusa)                                                                                              |
| Documenti collegati  | [Requisiti](../requirements/REQUIREMENTS.md) · [Architettura](../architecture/ARCHITECTURE.md) · [Database](../architecture/DATABASE.md) · [Fonti dati](../data-sources/SOURCES.md)                                            |

La pianificazione è provvisoria (PROJECT §10) e va raffinata all'inizio di ogni milestone stimando i task del backlog. Le stime di questa versione derivano dalla **somma dei task del backlog** (§ 4) più una **riserva esplicita** (§ 2.2). Il perimetro funzionale non cambia rispetto alla prima stesura di M0. L'unica variazione di priorità è HFCC, passato a _Must_ per [ADR-0012](../adr/0012-hfcc-in-v1-scope.md).

---

## 1. Dipendenze fra milestone

```mermaid
flowchart LR
  M0[M0 Analisi] --> M1[M1 Fondamenta PWA]
  M1 --> M2[M2 Dati Dexie]
  M2 --> M3[M3 Logbook HAM]
  M2 --> M4[M4 Logbook SWL]
  M3 --> M4
  M2 --> M5[M5 Frequency Explorer]
  M2 --> M6[M6 Calcolatori]
  M2 --> M7[M7 Signal Explorer]
  M5 --> M8[M8 Satelliti]
  M2 --> M9[M9 Resource Manager]
  M3 --> M10[M10 DX e QSL]
  M4 --> M10
  M5 --> M10
  M8 --> M11[M11 APRS e ripetitori]
  M5 --> M12[M12 Propagazione]
  M3 & M4 & M5 & M6 & M7 & M8 & M9 & M10 & M11 & M12 --> M13[M13 Release v1.0]
```

### 1.1 Motivazione delle dipendenze

| Dipendenza        | Motivo                                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 → M2 → tutti   | Layer dati, repository, import pipeline e `core/*` (frequenza, locator, tempo) sono usati da ogni modulo.                                                                                                                                 |
| M3 → M4           | Componenti condivisi (input frequenza/ora UTC, allegati, pattern import/export).                                                                                                                                                          |
| M5 → M8, M10, M12 | M5 introduce il contratto `ProviderDescriptor`, il registry delle fonti e il pannello freschezza (BL-M5-04), riusati da CelesTrak (M8), DX Summit se approvato (M10) e NOAA SWPC/HamQSL (M12). _Dipendenza aggiunta alla chiusura di M0._ |
| M3, M4 → M10      | Le QSL si collegano a QSO e ricezioni SWL; FR-SWL-10 genera il rapporto di ricezione.                                                                                                                                                     |
| M8 → M11          | Integrazione Leaflet/OSM introdotta in M8.                                                                                                                                                                                                |
| M2 → M6           | Il domain di locator e unità (`core/locator`, `core/units`) è in M2 (D-11); M6 realizza solo le interfacce.                                                                                                                               |
| tutte → M13       | Test di sistema, backup completo, audit e release.                                                                                                                                                                                        |

**Verifica di coerenza** (eseguita alla chiusura di M0):

- tutte le dipendenze puntano da una milestone a una di numero maggiore, quindi l'ordine M0 → M13 di `CLAUDE.md` è un ordinamento topologico valido;
- nessun requisito è assegnato a una milestone precedente a quella che fornisce ciò di cui ha bisogno. I requisiti divisi su più milestone sono intenzionali: FR-SWL-09 (M5/M8), FR-HAM-11 (M3/M10), FR-DSH-05 (M5→M12), FR-RFC-09/10 (domain M2, UI M6).

### 1.2 Cammino critico

Lavoro di un solo sviluppatore con milestone in sequenza: la durata totale è la somma delle milestone. Il cammino critico serve quindi a individuare **dove un ritardo propaga**, non a parallelizzare.

| Catena dopo M2          | Ore di base           | Ore con riserva assegnata |
| ----------------------- | --------------------- | ------------------------- |
| **A**: M3 → M4 → M10    | 22 + 12 + 12 = **46** | 28 + 14 + 15 = 57         |
| **B**: M5 → M8 → M11    | 18 + 18 + 10 = **46** | 24 + 24 + 12 = **60**     |
| M5 → M12                | 24                    | 31                        |
| M6, M7, M9 (solo da M2) | 10 / 6 / 10           | 11 / 6 / 11               |

- Le catene **A e B sono entrambe critiche** con le stime di base (46 h ciascuna; con M0, M1, M2 e M13: 105 h). Considerando la riserva, B è la più lunga, perché contiene i rischi HFCC (M5) e SGP4 (M8).
- Il cammino critico del documento precedente (M1 → M2 → M3 → M4 → M10 → M13) resta valido, ma non è l'unico.
- M6, M7 e M9 hanno margine: non bloccano altre milestone. Spostarle nell'ordine resta comunque una deroga a `CLAUDE.md` e richiede l'approvazione del maintainer.
- **Rischio esterno su B**: la risposta sui termini HFCC (HFCC-DEP-02) può richiedere tempo. La richiesta va inviata **in anticipo**, durante M1–M4 (vedi BL-M5-07), così da non fermare M5.

---

## 2. Stime, riserva e calendario

### 2.1 Calendario indicativo (11 h/settimana)

| Milestone                         | Base (h) | Riserva (h) | Totale (h) | Settimane | Settimane di calendario |
| --------------------------------- | -------- | ----------- | ---------- | --------- | ----------------------- |
| M0 Analisi e progettazione        | 12       | —           | 12         | 1,1       | 1                       |
| M1 Fondamenta PWA e dashboard     | 13       | 2           | 15         | 1,4       | 2–3                     |
| M2 Persistenza e core domain      | 16       | 4           | 20         | 1,8       | 3–5                     |
| M3 HAM Logbook + ADIF             | 22       | 6           | 28         | 2,5       | 5–7                     |
| M4 SWL Logbook                    | 12       | 2           | 14         | 1,3       | 7–8                     |
| M5 Frequency Explorer + EiBi/HFCC | 18       | 6           | 24         | 2,2       | 9–11                    |
| M6 Calcolatori RF e locator       | 10       | 1           | 11         | 1,0       | 11–12                   |
| M7 Signal Explorer                | 6        | 0           | 6          | 0,5       | 12                      |
| M8 Satellite Explorer             | 18       | 6           | 24         | 2,2       | 12–14                   |
| M9 Resource Manager + Raindrop    | 10       | 1           | 11         | 1,0       | 14–15                   |
| M10 DX Cluster e QSL              | 12       | 3           | 15         | 1,4       | 15–17                   |
| M11 APRS e ripetitori             | 10       | 2           | 12         | 1,1       | 17–18                   |
| M12 Propagazione                  | 6        | 1           | 7          | 0,6       | 18                      |
| M13 Test, sicurezza, release v1.0 | 18       | 6           | 24         | 2,2       | 19–21                   |
| **Totale M1–M13**                 | **171**  | **40**      | **211**    | **19,2**  | **2–21**                |

- Le ore di base sono la somma dei task di § 4, senza arrotondamenti a forfait. Rispetto alla prima stesura (178 h, M0 inclusa), la base cresce di 5 h: M5 +2 h per la verifica HFCC (BL-M5-07), M1 +1 h per l'allineamento al backlog, M0 +2 h per la chiusura formale e la sua consuntivazione.
- Le settimane di calendario si sovrappongono quando una milestone finisce e la successiva inizia nella stessa settimana.
- Sensibilità: a 12 h/settimana servono 17,6 settimane dopo M0 (19 in totale); a 10 h/settimana 21,1 (23 in totale). Senza riserva, a 11 h, 15,5 settimane (17 in totale).
- **Scostamento da `PROJECT.md` §10** (16 settimane): già la sola base (171 h) supera le 16 settimane a 11 h/settimana. `PROJECT.md` dichiara il calendario provvisorio. Questo documento è il riferimento aggiornato, e `PROJECT.md` va allineato quando lo decide il maintainer (D-20).

### 2.2 Regole della riserva

1. **Entità**: 40 h, pari al 23,4 % della base M1–M13 (intervallo approvato: 20–25 %).
2. **Assegnazione indicativa per rischio**:
   - 6 h ciascuna a M3 (ADIF), M5 (HFCC), M8 (SGP4) e M13 (test di sistema);
   - 4 h a M2 (migrazioni);
   - 3 h a M10;
   - 2 h ciascuna a M1, M4 e M11;
   - 1 h ciascuna a M6, M9 e M12.
3. **Gestione a pool**: la riserva non consumata da una milestone torna disponibile per le successive. Non è un "tempo libero" da pianificare in anticipo.
4. **Nessun aumento di perimetro**: la riserva copre stime errate e rischi, non nuove funzionalità.
   - Tagliare requisiti _Should/Could_ richiede una nota nel backlog.
   - Tagliare requisiti _Must_ richiede un ADR e l'approvazione del maintainer.
5. **Soglia di ripianificazione**: se prima dell'inizio di M8 è stato consumato più del 50 % della riserva (> 20 h), si ripianifica con il maintainer.
6. **Consuntivo**: alla chiusura di ogni milestone si registrano ore effettive e riserva usata in § 2.3.

### 2.3 Consuntivo

| Milestone | Stima (h)                   | Effettivo (h)       | Riserva usata (h)   | Riserva residua (h) | Note                                                                                 |
| --------- | --------------------------- | ------------------- | ------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| M0        | 12                          | n/d (non tracciato) | —                   | 40                  | Ore effettive non misurate.                                                          |
| M1        | 13 (+1 residui BL-M1-14…16) | n/d (non tracciato) | n/d (non tracciata) | 40 (nominale)       | Ore effettive non comunicate: consuntivo da completare se il maintainer le registra. |

---

## 3. Milestone

Ogni milestone richiede (PROJECT §10): perimetro documentato, task, criteri di accettazione, test automatici pertinenti, documentazione aggiornata, build di produzione riuscita. Criterio comune a tutte da M1 in poi: **`typecheck`, `lint`, `test` e `build` verdi in CI**.

### M0 — Analisi e progettazione ✅ (approvata, chiusura formale 2026-10-17)

- **Obiettivo**: requisiti, architettura, ADR, modello dati, casi d'uso, fonti dati, backlog.
- **Deliverable**:
  - `docs/requirements/REQUIREMENTS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATABASE.md`;
  - `docs/data-sources/SOURCES.md`, `docs/roadmap/ROADMAP.md`;
  - `docs/adr/0001…0012`, README, aggiornamento di `CLAUDE.md`.
- **Criteri di accettazione**: vedi [§ 5 Checklist M0](#5-checklist-di-completamento-m0).

### M1 — Fondamenta PWA e dashboard ✅ (approvata per la chiusura 2026-10-17, v0.1.0)

- **Dipende da**: M0 approvata e committata.
- **Obiettivo**: app shell installabile e offline, struttura cartelle, qualità, CI e deploy su Cloudflare Pages.
- **Requisiti**: FR-GEN-01, FR-GEN-07, FR-DSH-01..04, 06, 08, NFR-OFF-02, NFR-MNT-01/02/04, NFR-I18N-01, CON-13.
- **Criteri di accettazione**:
  - `npm run dev|build|preview|typecheck|lint|format|test|test:e2e` funzionanti come in `CLAUDE.md`.
  - Lighthouse: PWA installabile; manifest e icone validi.
  - Con rete disattivata (Playwright `setOffline`) l'app si apre e tutte le route dei 14 moduli sono navigabili.
  - Toast di aggiornamento funzionante (test manuale con due build).
  - Regole ESLint di layer attive e verificate da un test negativo.
  - Nessuna stringa UI hardcoded: catalogo i18n tipizzato ([ADR-0008](../adr/0008-i18n-approach.md)) e controllo in lint o CI.
  - Deploy su Cloudflare Pages da GitHub Actions ([ADR-0011](../adr/0011-static-hosting-and-routing.md)), con questi controlli:
    - accesso diretto a una route profonda (es. `/ham-logbook`) senza service worker: risposta 200 con l'app;
    - header di `public/_headers` presenti nella risposta;
    - nessun `dist/404.html`.
  - Checklist manuale su tablet Android: installazione, avvio offline.

### M2 — Persistenza e core domain

- **Dipende da**: M1.
- **Obiettivo**: database Dexie v1, repository base, transazioni, migrazioni, backup/restore di base, domain condiviso.
- **Requisiti**: FR-GEN-03/04, FR-SET-01 (dati), FR-SET-03/05/06/07 (base), NFR-REL-01..04; `core/frequency`, `core/locator`, `core/time`, `core/callsign`, `core/reports`.
- **Criteri di accettazione**:
  - Schema v1 come [DATABASE.md § 5](../architecture/DATABASE.md#5-definizione-dexie-versione-1-implementata).
  - ADR-0006 e ADR-0009 **decisi** (accettati o sostituiti) prima di scrivere lo schema.
  - Test di integrazione dei repository con `fake-indexeddb` (CRUD, cascate, transazioni con rollback).
  - Test unitari con valori di riferimento:
    - band plan (limiti di ogni banda HF/VHF/UHF);
    - Maidenhead ↔ WGS84 (4/6/8 caratteri, casi ai bordi);
    - distanza e azimut;
    - validazione nominativi, RST/SINPO.
  - Backup → restore round-trip identico su tutte le tabelle v1.
  - Stato storage e persistenza visibili in Impostazioni.

### M3 — HAM Logbook + ADIF

- **Dipende da**: M2.
- **Requisiti**: FR-HAM-01..15, FR-QSL-05 (campi), FR-SET-01/02 (UI profilo), UC-01/02/03.
- **Criteri di accettazione**:
  - CRUD QSO con validazioni, banda derivata, duplicati.
  - Import ADIF:
    - fixture reali anonimizzate (export di almeno 2 software diversi);
    - report errori;
    - rollback su errore simulato.
  - Export ADIF valido; round-trip senza perdita dei campi supportati e di `adifExtra`.
  - Lista fluida con 50 000 QSO (misura documentata).
  - E2E: inserimento QSO, ricarica pagina, ricerca, export.

### M4 — SWL Logbook

- **Dipende da**: M2, M3.
- **Requisiti**: FR-SWL-01..08, UC-04.
- **Criteri di accettazione**:
  - 7 categorie con schemi discriminati testati;
  - avviso di riservatezza per aeronautica e marittima;
  - export CSV (con protezione da formula injection) e JSON;
  - allegati audio entro i limiti;
  - E2E di inserimento e filtro.

### M5 — Frequency Explorer + EiBi/HFCC

- **Dipende da**: M2.
- **Requisiti**: FR-FRQ-01..09 (**FR-FRQ-02 HFCC: Must**, [ADR-0012](../adr/0012-hfcc-in-v1-scope.md)), FR-GEN-02, FR-DSH-05, FR-SET-08, FR-SWL-09 (broadcast), UC-05.
- **Precondizione (gate HFCC)**: BL-M5-07 chiude HFCC-DEP-01..03 ([Requisiti § 4.4.1](../requirements/REQUIREMENTS.md#441-dipendenze-dellimport-hfcc)) **prima** di BL-M5-05.
  - Se una dipendenza risulta bloccante: nuovo ADR e decisione del maintainer.
  - Nessun rinvio silenzioso.
- **Criteri di accettazione**:
  - Ri-verifica di EiBi e HFCC registrata in `SOURCES.md`.
  - Parser EiBi testato su un estratto reale, con attribuzione.
  - Parser HFCC testato:
    - su un estratto reale se HFCC-DEP-02 lo consente, altrimenti su fixture sintetiche conformi al formato;
    - su due stagioni;
    - con lettura dello ZIP o, in alternativa, del `.TXT`.
  - Query "in onda ora" corretta su fasce a cavallo della mezzanotte e giorni della settimana, per entrambe le fonti.
  - Sostituzione atomica del dataset.
  - Provenienza visibile.
  - Consultazione offline (E2E).

### M6 — Calcolatori RF e locator

- **Dipende da**: M2 (domain `core/locator`, `core/units`).
- **Requisiti**: FR-RFC-01..12, UC-13.
- **Criteri di accettazione**:
  - ogni calcolatore ha test numerici con valori di riferimento citati nel test;
  - validazione degli input;
  - funzionamento offline;
  - form accessibili.

### M7 — Signal Explorer

- **Dipende da**: M2.
- **Requisiti**: FR-SIG-01..06.
- **Criteri di accettazione**:
  - catalogo iniziale redatto in proprio, versionato in JSON, con link a SigIDWiki;
  - licenza SigIDWiki verificata, oppure contenuti limitati ai link;
  - ricerca e filtri testati.

### M8 — Satellite Explorer

- **Dipende da**: M2, M5 (contratto provider).
- **Requisiti**: FR-SAT-01..11, UC-06/07.
- **Criteri di accettazione**:
  - download CelesTrak con rate limit e gestione di 403/404;
  - import TLE/OMM con verifica del checksum;
  - import del JSON SatNOGS;
  - previsioni SGP4 confrontate con valori di riferimento (es. passaggi ISS calcolati con uno strumento indipendente, documentati nel test);
  - avvisi sull'età dei dati;
  - calcolo in Web Worker;
  - mappa Leaflet online e vista polare offline.

### M9 — Resource Manager + Raindrop

- **Dipende da**: M2.
- **Requisiti**: FR-RES-01..10, UC-08.
- **Criteri di accettazione**:
  - import della fixture anonimizzata (struttura identica a `Ham_Radio.html`) e test manuale con il file reale;
  - test di sicurezza senza esecuzione: HTML con `<script>`, URL `javascript:`, attributi `on*`;
  - rilevazione dei duplicati;
  - export.

### M10 — DX Cluster e QSL Manager

- **Dipende da**: M3, M4, M5 (contratto provider).
- **Requisiti**: FR-DXC-01..06, FR-QSL-01..06, FR-SWL-10, UC-10/11.
- **Criteri di accettazione**:
  - stati QSL e transizioni testati;
  - import delle conferme LoTW/eQSL da ADIF, con abbinamento entro una tolleranza;
  - statistiche;
  - DX: link, oppure integrazione nativa solo con termini verificati e ADR;
  - spot eliminati dopo 24 h.

### M11 — APRS e Repeater Explorer

- **Dipende da**: M2, M8 (Leaflet).
- **Requisiti**: FR-APR-01..04, FR-RPT-01..06, UC-12.
- **Criteri di accettazione**:
  - catalogo ripetitori con toni in decimi di Hz;
  - ricerca per distanza testata;
  - import/export CSV;
  - link esterni verificati;
  - geolocalizzazione solo su richiesta.

### M12 — Propagazione e servizi esterni

- **Dipende da**: M5 (pattern provider/freschezza).
- **Requisiti**: FR-PRP-01..07, UC-09.
- **Criteri di accettazione**:
  - ADR-0010 deciso (NOAA SWPC approvato o respinto, con conseguente riclassificazione di FR-PRP-01/03);
  - distinzione osservato/previsione in UI e in DB;
  - cache con indicazione dell'età;
  - offline con gli ultimi valori;
  - banner HamQSL con attribuzione.

### M13 — Test, backup, sicurezza, ottimizzazione, release v1.0

- **Dipende da**: tutte.
- **Requisiti**: FR-SET-04..10, tutti gli NFR, criteri di [Requisiti § 7](../requirements/REQUIREMENTS.md#7-criteri-di-accettazione-della-v10) (incluso il criterio 5: importer EiBi **e** HFCC).
- **Criteri di accettazione**:
  - Definition of Done di PROJECT §12 interamente soddisfatta;
  - audit di accessibilità (axe e verifica manuale);
  - revisione di sicurezza (CSP, import non fidati, dipendenze);
  - budget di prestazioni verificati su tablet;
  - documentazione utente;
  - release `1.0.0` taggata e pubblicata su Cloudflare Pages.

---

## 4. Backlog

ID `BL-<milestone>-<NN>`. Stima in ore (h). Priorità come nei requisiti. Stato: ☐ da fare · ◐ in corso · ☑ fatto. I task di **chiusura milestone** coprono E2E, documentazione e checklist dove non sono già inclusi negli altri task.

### M0 (12 h)

| ID       | Task                                                                                                          | Req. | Pri. | h   | Stato                             |
| -------- | ------------------------------------------------------------------------------------------------------------- | ---- | ---- | --- | --------------------------------- |
| BL-M0-01 | Verifica coerenza PROJECT/CLAUDE/repository                                                                   | —    | M    | 1   | ☑                                 |
| BL-M0-02 | Requisiti funzionali e non funzionali, casi d'uso                                                             | —    | M    | 3   | ☑                                 |
| BL-M0-03 | Architettura e struttura cartelle                                                                             | —    | M    | 2   | ☑                                 |
| BL-M0-04 | Modello dati e schema Dexie v1                                                                                | —    | M    | 2   | ☑                                 |
| BL-M0-05 | Verifica fonti dati (CORS, HTTPS, licenze)                                                                    | —    | M    | 1,5 | ☑                                 |
| BL-M0-06 | ADR 0001–0011                                                                                                 | —    | M    | 1   | ☑                                 |
| BL-M0-07 | Roadmap, backlog, README, aggiornamento CLAUDE.md                                                             | —    | M    | 0,5 | ☑                                 |
| BL-M0-08 | Revisione e approvazione da parte del maintainer, con applicazione delle decisioni                            | —    | M    | —   | ☑ (2026-10-17)                    |
| BL-M0-09 | Chiusura formale: ADR-0008/0011 accettati, ADR-0012 (HFCC), riserva, verifica dipendenze, link e allineamento | —    | M    | 1   | ☑                                 |
| BL-M0-10 | Commit di chiusura M0 sul repository                                                                          | —    | M    | —   | ☐ (comandi forniti al maintainer) |

### M1 (13 h)

| ID       | Task                                                                                                                                                                                   | Req.               | Pri. | h    | Stato                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| BL-M1-01 | Pulizia `.gitignore` (riga `*.local` duplicata), protezione branch `main`                                                                                                              | D-09, D-10         | M    | 0,5  | ☑ `.gitignore` (Blocco A); protezione `main` attiva (BL-M1-14)                                                                      |
| BL-M1-02 | Rimozione scaffold Vite; `index.html` con `lang="it"`, titolo, meta PWA                                                                                                                | D-06, D-07         | M    | 0,5  | ☑ (icone e manifest in BL-M1-11)                                                                                                    |
| BL-M1-03 | `tsconfig`: `noUncheckedIndexedAccess`, alias `@/`                                                                                                                                     | D-18               | M    | 0,5  | ☑                                                                                                                                   |
| BL-M1-04 | ESLint flat config + Prettier + regole di layer + script npm                                                                                                                           | D-02, D-04         | M    | 1,5  | ☑                                                                                                                                   |
| BL-M1-05 | Vitest (jsdom) + Playwright config, test di esempio reali (non placeholder)                                                                                                            | —                  | M    | 1    | ☑                                                                                                                                   |
| BL-M1-06 | Tailwind v4 + design token chiaro/scuro                                                                                                                                                | FR-DSH-06          | M    | 1    | ☑                                                                                                                                   |
| BL-M1-07 | Catalogo i18n tipizzato interno (ADR-0008, accettato)                                                                                                                                  | NFR-I18N-01        | M    | 1    | ☑ (lint `vue/no-bare-strings-in-template`)                                                                                          |
| BL-M1-08 | Router `createWebHistory` con route lazy per i 14 moduli e vista "In sviluppo"                                                                                                         | FR-GEN-07          | M    | 1    | ☑                                                                                                                                   |
| BL-M1-09 | Layout responsive, navigazione, indicatore online/offline                                                                                                                              | FR-DSH-04          | M    | 1,5  | ☑                                                                                                                                   |
| BL-M1-10 | Dashboard: griglia moduli, workspace HAM/SWL, orologio UTC, preferiti (in memoria/`settings` da M2)                                                                                    | FR-DSH-01/02/03/07 | M    | 1,5  | ☑ (preferiti in memoria; persistenza in M2)                                                                                         |
| BL-M1-11 | `vite-plugin-pwa`: manifest, icone, precache, prompt di aggiornamento                                                                                                                  | FR-DSH-08          | M    | 1,5  | ☑ test automatici verdi in CI e sulla preview; collaudo su tablet fisico **dichiarato superato dal maintainer** (dettagli in § 6.1) |
| BL-M1-12 | GitHub Actions: typecheck, lint, test, build, E2E                                                                                                                                      | NFR-MNT-04         | M    | 1    | ☑ CI eseguita su GitHub: PR #1, run `39061024680` (2 tentativi), `quality` ed `e2e` verdi su `3185158`                              |
| BL-M1-13 | Cloudflare Pages (ADR-0011): progetto Direct Upload, token con permesso minimo, secret GitHub, `public/_headers`, controllo assenza `404.html`, primo deploy e verifica route profonde | CON-13             | M    | 0,5  | ☑ deploy preview da GitHub Actions verificato (§ 6.2); produzione al merge su `main` (§ 6.3)                                        |
| BL-M1-14 | Protezione del branch `main` su GitHub (PR obbligatoria, controlli CI richiesti); residuo di BL-M1-01, da completare nel Blocco D                                                      | D-10               | M    | 0,25 | ☑ ruleset `main protection` (id 25316364) attivo dal 2026-10-17, regole verificate via API; lista dei bypass da confermare nella UI |
| BL-M1-15 | Allineamento documentale: `ARCHITECTURE.md` § 12 indica `npm run format -- --check`, lo script reale è `npm run format:check`                                                          | NFR-MNT-04         | M    | 0,25 | ☑                                                                                                                                   |
| BL-M1-16 | Regole ESLint contro gli import **relativi** fra moduli (`../../altro-modulo/...`), oggi non intercettati, con test negativi dedicati                                                  | NFR-MNT-02         | M    | 0,5  | ☑ regola locale `hrt/no-cross-boundary-relative-import` + controllo stringhe UI negli script, con test negativi                     |

BL-M1-14…16 sono residui del Blocco A, registrati all'approvazione del Blocco B (2026-10-17). L'ora aggiuntiva grava sulla riserva di M1 (2 h).

### M2 (16 h)

| ID       | Task                                                                                       | Req.         | Pri. | h   | Stato (2026-10-24)                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------ | ------------ | ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BL-M2-01 | `core/frequency`: Hz, conversioni, band plan IARU R1 + test                                | FR-HAM-02    | M    | 2   | ☑ approvato (2026-10-24); band plan fino a 13 cm (microonde escluse, BL-M2-10)                                                                                                                                                                                                                                                                                              |
| BL-M2-02 | `core/locator`: Maidenhead ↔ WGS84, distanza, azimut + test                                | FR-RFC-09/10 | M    | 2   | ☑ approvato (2026-10-24)                                                                                                                                                                                                                                                                                                                                                    |
| BL-M2-03 | `core/time`, `core/callsign`, `core/reports` (RST/SINPO) + test                            | FR-HAM-04    | M    | 1,5 | ☑ approvato (2026-10-24)                                                                                                                                                                                                                                                                                                                                                    |
| BL-M2-04 | Schemi Zod comuni (`core/validation`)                                                      | —            | M    | 1   | ☑ approvato (2026-10-24), [ADR-0013](../adr/0013-core-domain-types-and-validation.md) accettato; in B aggiunti helper additivi (testo, regole fra campi, Zod `jitless`)                                                                                                                                                                                                     |
| BL-M2-05 | Decisione ADR-0006/0009; `AppDatabase` v1, repository base, `UnitOfWork`, `fake-indexeddb` | —            | M    | 3   | ☑ approvato (2026-10-24), [ADR-0014](../adr/0014-repositories-unit-of-work-and-persistence-errors.md) accettato                                                                                                                                                                                                                                                             |
| BL-M2-06 | Integrità referenziale e test di cascata                                                   | —            | M    | 1,5 | ☑ approvato (2026-10-24)                                                                                                                                                                                                                                                                                                                                                    |
| BL-M2-07 | Pipeline di import generica (preview/commit/job)                                           | FR-GEN-03    | M    | 2   | ☑ approvato (2026-10-24): `createImportPipeline` (identificazione, parsing, validazione, duplicati e conflitti, anteprima senza scritture, commit unico con job, rollback, annullamento, interruzione)                                                                                                                                                                      |
| BL-M2-08 | Backup/restore JSON v1 + test round-trip                                                   | FR-SET-05/06 | M    | 2   | ☑ approvato (2026-10-24): formato v1 progressivo con checksum, restore atomico _sostituisci_/_unisci_, round-trip identico, fixture v1, limite operativo 100 MiB ([ADR-0015](../adr/0015-backup-format-and-atomic-restore.md) accettato)                                                                                                                                    |
| BL-M2-09 | Impostazioni: storage, persistenza, profilo stazione (dati)                                | FR-SET-01/03 | M    | 1   | ☑ approvato (2026-10-24) con correzioni applicate nel consolidamento: vista Impostazioni (storage, profili, preferenze, backup, ripristino), preferiti e tema persistenti, avvisi del database nella shell, notifica fra schede; `persist()` solo su richiesta esplicita ([ADR-0016](../adr/0016-persistent-preferences-startup-and-tabs.md) accettato). Ore effettive: n/d |
| BL-M2-10 | Band plan: bande da 9 cm in su, dopo verifica sul _VHF Managers Handbook_ IARU R1 corrente | FR-HAM-02    | S    | 0,5 | ☐ residuo del Blocco A, da pianificare (M3 o M6)                                                                                                                                                                                                                                                                                                                            |

Nota sul perimetro di BL-M2-09 (Blocco D): su richiesta del maintainer la gestione dei profili stazione è completa già in M2 (creazione, modifica, profilo predefinito, eliminazione con conferma). Di **BL-M3-08** (profili multipli, UI) resta in M3 solo l'integrazione con il logbook (scelta del profilo nel form del QSO). La persistenza dei preferiti chiude il residuo di BL-M1-10.

#### Piano per blocchi

| Blocco                         | Task               | Dipende da                                    | Criteri di accettazione                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Core Domain**            | BL-M2-01…04        | M1                                            | Domain puro (nessun import di Vue, Pinia, Dexie, browser API, verificato da ESLint e test negativi); test con valori di riferimento documentati per band plan (ogni limite HF/VHF/UHF), Maidenhead 4/6/8 e bordi, distanza/azimut, UTC e mezzanotte, nominativi, RST/SINPO; schemi Zod con tipi derivati; typecheck, lint, test, build, E2E verdi |
| **B — Database & Repository**  | BL-M2-05, BL-M2-06 | A (schemi e tipi delle entità), ADR-0006/0009 | Schema v1 come DATABASE § 5; `fake-indexeddb` (dev); repository base e `UnitOfWork`; test CRUD, transazioni con rollback, cascate (DATABASE § 6), vincolo "un solo profilo predefinito"; allegati testati in ambiente `node`; ADR-0006/0009 rispettati                                                                                            |
| **C — Import & Backup**        | BL-M2-07, BL-M2-08 | B                                             | Pipeline parse → validazione → anteprima → commit unico con `import_jobs`; import fallito senza dati parziali; backup JSON versionato (`schemaVersion`) e round-trip identico su tutte le tabelle v1; fixture in `tests/fixtures/backup/`                                                                                                         |
| **D — Settings & Integration** | BL-M2-09, collaudo | B, C                                          | Porta `StorageInfo`, `navigator.storage.persist()` e stato/quota visibili in Impostazioni; profilo stazione persistito; preferiti della dashboard persistiti in `settings` (residuo BL-M1-10); checklist di completamento M2                                                                                                                      |

#### Questioni aperte (da risolvere prima del codice che ne dipende)

| #       | Questione                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Blocco  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Q-M2-01 | `core/units` (dB, lunghezze, potenze) è citato in ROADMAP § 1.1 e in D-11 come M2, ma nessun task del backlog M2 lo copre. Proposta: spostarlo in M6 (calcolatori), dove si usa; M3 non ne ha bisogno.                                                                                                                                                                                                                                                     | —       |
| Q-M2-02 | Collocazione delle funzioni di migrazione pure, condivise fra `upgrade` Dexie e restore ([ADR-0006](../adr/0006-dexie-naming-and-migrations.md), conseguenze). **Proposta attuata nel Blocco B**: `src/infrastructure/db/migrations/` senza dipendenze da Dexie, esposte al restore dalla porta `BackupGateway` ([ADR-0014](../adr/0014-repositories-unit-of-work-and-persistence-errors.md)).                                                             | B / C   |
| Q-M2-03 | Gestione `versionchange`/`blocked` con notifica in UI: porta verso la presentation. **Blocco B**: porta `DatabaseLifecycle` e gestione in `AppDatabase` (testate). **Resta** l'avviso in UI.                                                                                                                                                                                                                                                               | B / D   |
| Q-M2-04 | Limite realistico del backup JSON su tablet (DATABASE § 8 propone 500 MB, non gestibile con un solo `JSON.parse`) ([ADR-0009](../adr/0009-attachments-in-indexeddb.md)). **Blocco C**: lettura e scrittura progressive, limite operativo 100 MB verificato su Chromium desktop ([ADR-0015](../adr/0015-backup-format-and-atomic-restore.md)); oltre: Q-M2-10.                                                                                              | C       |
| Q-M2-05 | `src/app/container.ts` (ARCHITECTURE § 4, "da M2"): nasce nel Blocco B con i primi adattatori. **Risolta**: `createContainer`, `APP_CONTAINER_KEY`, `useContainer()`, fornito da `main.ts`.                                                                                                                                                                                                                                                                | B ✅    |
| Q-M2-06 | Persistenza dei preferiti della dashboard (BL-M1-10, "persistenza in M2") non ha un task esplicito: inclusa nel Blocco D insieme a BL-M2-09. **Risolta**: chiave `dashboard` di `settings`, store delle preferenze ([ADR-0016](../adr/0016-persistent-preferences-startup-and-tabs.md)).                                                                                                                                                                   | D ✅    |
| Q-M2-07 | Il container all'avvio porta Dexie e Zod nel chunk iniziale: da 18,6 a 86,0 kB gzip (JS iniziale ≈ 122 kB gzip, budget NFR-PERF-01 200 kB). **Blocco D** (build locale): JS iniziale 118,2 → 132,3 kB gzip; Impostazioni (11,3 kB) e backup (10,8 kB) in chunk separati. Rimisurare a ogni milestone; caricamento pigro dei repository per modulo se il budget si avvicina.                                                                                | M13     |
| Q-M2-08 | Verifiche della persistenza su browser reale non coperte da `fake-indexeddb` ([DATABASE § 10.1](../architecture/DATABASE.md#101-verifiche-da-eseguire-su-browser-reale)). **Blocco D**: due schede (`versionchange`, `blocked`, notifica), storage bloccato, riavvio offline, download e scelta del file verificati in Chromium desktop (`tests/e2e/settings.spec.ts`). Restano: quota reale, allegati grandi, prestazioni e tutte le verifiche su tablet. | D / M13 |
| Q-M2-09 | Messaggi i18n per i codici `persistence.*` (e per le `rule` dei conflitti). **Risolta** nel Blocco D: catalogo `persistence.*`, `database.*`, `validation.*`, completezza verificata da `tests/integration/i18n-error-codes.spec.ts`.                                                                                                                                                                                                                      | D ✅    |
| Q-M2-10 | Backup oltre 100 MB (fino ai 500 MB di DATABASE § 8): restore con database di appoggio e attivazione atomica tramite puntatore, più contenitore ZIP per gli allegati. Cambia una convenzione approvata (nome fisso del database): serve un ADR e il collaudo su tablet ([ADR-0015](../adr/0015-backup-format-and-atomic-restore.md), proposta).                                                                                                            | M13     |
| Q-M2-11 | Collaudo di backup e restore su tablet Android fino al limite operativo: tempi (su desktop 320 000 record richiedono circa un minuto fra analisi e commit), reattività dell'interfaccia, memoria; valutare analisi e scrittura in un Web Worker. Se il limite non regge, abbassarlo via configurazione. **Blocco D**: checklist progressiva pronta (§ 7.2), collaudo **non eseguito**.                                                                     | D / M13 |
| Q-M2-12 | Codici `backup.*`, `import.*`, `operation.aborted` nel catalogo; `catalogKeySchema`, `sha256HexSchema` e il nome di tabella del manifest producevano `zod.invalid_format`. **Risolta** nel Blocco D: messaggi nel catalogo; gli schemi usano `patternSchema` (issue `custom` con il codice di dominio: `catalog-key.invalid`, `sha256.invalid`, `backup.table-name`). `uuidSchema` resta `zod.invalid_format` (nessun codice di dominio previsto).         | D ✅    |
| Q-M2-13 | FR-SET-07 (storico dei job di import e restore in Impostazioni) e FR-SET-04 (conteggio record per tabella come funzione di gestione) non hanno ancora una vista: i job sono registrati e i conteggi compaiono solo nell'export.                                                                                                                                                                                                                            | M13     |
| Q-M2-14 | Su Android: download del backup (nome, cartella), eventuale Web Share e scelta del file dal selettore di sistema da verificare sul tablet. (La richiesta automatica di persistenza all'avvio è stata eliminata nel consolidamento: nessun prompt all'avvio.)                                                                                                                                                                                               | M13     |

#### Verifica del Blocco B (2026-10-24)

Esiti di verifiche eseguite in locale (Linux/WSL2, Node 22); CI non ancora eseguita sul branch.

| Criterio (piano per blocchi)                                         | Esito                                                                                                                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Schema v1 come DATABASE § 5                                          | ✅ `SCHEMA_V1` identico al testo e schema fisico IndexedDB verificato (`tests/integration/db/app-database.spec.ts`, `migrations.spec.ts`) |
| `fake-indexeddb` (dev)                                               | ✅ 6.2.6, una factory isolata per test                                                                                                    |
| Repository base e `UnitOfWork`                                       | ✅ 8 repository, `DexieUnitOfWork`, container ([ADR-0014](../adr/0014-repositories-unit-of-work-and-persistence-errors.md) proposto)      |
| CRUD, transazioni con rollback, cascate, un solo profilo predefinito | ✅ test di integrazione per ogni repository, `unit-of-work.spec.ts`, `referential-integrity.spec.ts`, `station-profiles.spec.ts`          |
| Allegati testati in ambiente `node`                                  | ✅ `attachments.spec.ts` (`// @vitest-environment node`)                                                                                  |
| ADR-0006/0009 rispettati                                             | ✅ nomi `snake_case`/`camelCase` senza mapping, `EntityTable`, versioni incrementali; deduplicazione limitata al proprietario             |
| typecheck, lint, format, test, build, check:dist, E2E                | ✅ in locale (dettaglio nel report del blocco); un E2E della CSP ha rilevato e fatto correggere l'uso di `eval` da parte di Zod           |
| Collaudo su browser reale                                            | ☐ non eseguito: elenco in [DATABASE § 10.1](../architecture/DATABASE.md#101-verifiche-da-eseguire-su-browser-reale) (Q-M2-08)             |

#### Verifica del Blocco C (2026-10-24)

Esiti di verifiche eseguite in locale (Linux/WSL2, Node 22, Chromium di Playwright); CI non ancora eseguita sul branch.

| Criterio (piano per blocchi e richiesta del blocco)                       | Esito                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline parse → validazione → anteprima → commit unico con `import_jobs` | ✅ `createImportPipeline`; anteprima senza scritture, duplicati e conflitti, politiche `skip`/`replace`, anteprima superata rifiutata (`tests/integration/import/import-pipeline.spec.ts`, 19 test)                                                     |
| Import fallito senza dati parziali                                        | ✅ rollback con errore restituito, eccezione e quota simulata; job `failed` scritto da solo                                                                                                                                                             |
| Backup JSON versionato e round-trip identico su tutte le tabelle v1       | ✅ formato v1 con manifest, `backupId`, conteggi, checksum per tabella; round-trip identico (anche byte per byte sulle tabelle) su `fake-indexeddb` e su Chromium                                                                                       |
| Fixture in `tests/fixtures/backup/`                                       | ✅ `v1-basic.json` (sintetica, deterministica), ripristinata a ogni esecuzione                                                                                                                                                                          |
| Restore atomico senza cancellazione preventiva                            | ✅ svuotamento e scrittura nella stessa `UnitOfWork`, conteggi verificati nella transazione; dati invariati dopo quota simulata, eccezione, anteprima superata e **chiusura della pagina durante il commit** (Chromium)                                 |
| File non attendibili                                                      | ✅ checksum errato, file troncato, tabella mancante, conteggi errati, schema futuro, versione di contenitore futura, campi sconosciuti, tipi, date, frequenze, UUID duplicati, riferimenti mancanti, allegati con hash o dimensione errati, `__proto__` |
| Allegati inclusi ed esclusi                                               | ✅ base64 solo su richiesta; senza allegati il restore conserva quelli locali dei proprietari che restano                                                                                                                                               |
| Grandi dimensioni                                                         | ✅ nessun `JSON.parse`/`stringify` del file; limite operativo 100 MB verificato su Chromium desktop (109 MB di soli record, fino a 420 MB con allegati); ☐ collaudo su tablet (Q-M2-11); 500 MB → Q-M2-10                                               |
| Bundle iniziale                                                           | ✅ backup in un chunk separato (10,6 kB gzip); chunk principale 86,0 → 87,4 kB gzip                                                                                                                                                                     |
| CSP non indebolita                                                        | ✅ `public/_headers` invariato; harness servito con la CSP di produzione, nessuna violazione                                                                                                                                                            |
| typecheck, lint, format, test, build, check:dist, E2E                     | ✅ in locale (dettaglio nel report del blocco)                                                                                                                                                                                                          |

#### Verifica del Blocco D (2026-10-24)

Esiti di verifiche eseguite **in locale** (Linux/WSL2, Node 22, Chromium di Playwright). La CI GitHub non è ancora stata eseguita sul branch; il collaudo su tablet Android non è stato eseguito.

| Criterio (piano per blocchi e richiesta del blocco)             | Esito                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Porta `StorageInfo`, `persist()`, stato e quota in Impostazioni | ✅ adattatore `createNavigatorStorageInfo`, `StorageService`, `useStorageStatusStore`: all'avvio solo `persisted()`, `persist()` solo dal pulsante (verificato contando le chiamate in Chromium); avviso oltre l'80 %, quota presentata come stima |
| Profilo stazione persistito                                     | ✅ creazione (il primo diventa predefinito), modifica, cambio del predefinito, eliminazione con conferma e vincoli; database senza profili valido                                                                                                  |
| Preferiti e tema persistiti in `settings`                       | ✅ chiavi `app` e `dashboard`, nessuna copia in `localStorage`, attesa all'avvio ≤ 500 ms, verificati dopo ricarica e riavvio offline                                                                                                              |
| IndexedDB non disponibile                                       | ✅ navigazione e dashboard funzionano, avviso "le modifiche potrebbero non essere salvate" (E2E con `IDBFactory.open` bloccato)                                                                                                                    |
| UI di backup e restore                                          | ✅ inventario, allegati su richiesta, annullamento, verifica prima del download; analisi annullabile, contenuto, errori, conflitti, modalità, anteprima, allegati conservati/eliminati, conferma esplicita                                         |
| `versionchange`, `blocked`, multi-scheda                        | ✅ avvisi nella shell; due schede reali in Chromium; scritture dopo la chiusura rifiutate senza perdere i dati nel modulo                                                                                                                          |
| Controlli aggiuntivi sul Blocco C (richiesta § 9)               | ✅ `tests/integration/backup/backup-block-d.spec.ts`: job `failed` non registrabile, allegati senza backup, anteprima = effetti, file manomessi con impronte ricalcolate, verifica del file, notifica                                              |
| i18n e codici                                                   | ✅ catalogo completo per i codici delle union (controllo a compilazione e test); codici tecnici solo come dettaglio secondario                                                                                                                     |
| Accessibilità (axe, WCAG 2.2 AA, temi chiaro e scuro)           | ✅ pagina Impostazioni e dialog del profilo con errori; nessuna violazione                                                                                                                                                                         |
| CSP non indebolita, backup non nella Cache Storage              | ✅ `public/_headers` invariato; backup, download e anteprima senza violazioni sull'emulatore Pages; nessuna voce del backup nelle cache del service worker                                                                                         |
| Bundle iniziale                                                 | ✅ 132,4 kB gzip dopo il consolidamento (era 118,2 prima del Blocco D), budget 200 kB                                                                                                                                                              |
| typecheck, lint, format, test, build, check:dist, E2E           | ✅ in locale dopo il consolidamento: 1118 test Vitest, 130 test Playwright (2 saltati per progetto), `format:check` verde dopo l'esclusione di `.vitest/`                                                                                          |
| Collaudo Android                                                | ☐ non eseguito (§ 7.2)                                                                                                                                                                                                                             |

#### Consolidamento dopo l'approvazione del Blocco D (2026-10-24)

| Correzione                                              | Evidenza                                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.vitest/` escluso da Git e Prettier                    | Il report `.vitest/json/output.json` (con percorsi locali assoluti) era stato committato nel Blocco C: rimosso dall'indice; con il merge _squash_ non arriva su `main`. `format:check` verde |
| `persist()` solo su richiesta esplicita                 | Avvio: solo `persisted()` (`useStorageStatusStore`); E2E che conta le chiamate a `persist()`                                                                                                 |
| Lettura delle preferenze dopo il timeout di 500 ms      | `settleWithin` (`src/app/startup.ts`) e test con timer simulati; `preferences-store.spec.ts`; E2E con database bloccato da un'altra scheda                                                   |
| Sincronizzazione fra schede, `versionchange`, `blocked` | E2E: preferiti e profili fra due schede, upgrade da un'altra scheda, upgrade bloccato e poi completato                                                                                       |
| Restore senza stati obsoleti                            | E2E: dopo il restore tema, profili e preferiti aggiornati senza ricaricare, anche in una seconda scheda aperta sulla dashboard                                                               |

### M3 (22 h)

| ID       | Task                                                                                                                                                       | Req.            | Pri. | h   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | --- |
| BL-M3-01 | Domain QSO, schema, regole duplicati                                                                                                                       | FR-HAM-02..06   | M    | 2   |
| BL-M3-02 | Form QSO (frequenza kHz/MHz, ora UTC, RST per modo)                                                                                                        | FR-HAM-01/04/05 | M    | 4   |
| BL-M3-03 | Lista virtualizzata, ricerca, filtri                                                                                                                       | FR-HAM-07/08    | M    | 3   |
| BL-M3-04 | Parser ADIF + test (fixture anonimizzate)                                                                                                                  | FR-HAM-09       | M    | 4   |
| BL-M3-05 | Writer ADIF + round-trip                                                                                                                                   | FR-HAM-10       | M    | 2   |
| BL-M3-06 | Mapping campi QSL ADIF → `qsl_records`                                                                                                                     | FR-QSL-05       | M    | 1,5 |
| BL-M3-07 | Statistiche base                                                                                                                                           | FR-HAM-11       | M    | 2   |
| BL-M3-08 | Profili stazione multipli (UI) — **parzialmente anticipato in M2** (gestione dei profili in Impostazioni); resta la selezione del profilo nel form del QSO | FR-HAM-14       | S    | 1,5 |
| BL-M3-09 | Allegati QSO                                                                                                                                               | FR-HAM-12       | S    | 1   |
| BL-M3-10 | Valutazione `cty.dat` per DXCC (Q-06)                                                                                                                      | FR-HAM-11       | S    | 1   |

### M4–M13 (da dettagliare all'avvio della milestone)

| ID        | Task                                                                                                                                                                                  | Req.                 | Pri.  | h   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----- | --- |
| BL-M4-01  | Schemi discriminati delle 7 categorie + form dinamico                                                                                                                                 | FR-SWL-01..04        | M     | 5   |
| BL-M4-02  | Filtri, statistiche, export CSV/JSON                                                                                                                                                  | FR-SWL-06..08        | M     | 4   |
| BL-M4-03  | Allegati audio con limiti                                                                                                                                                             | FR-SWL-05            | S     | 2   |
| BL-M4-04  | Chiusura milestone (E2E, documentazione, checklist)                                                                                                                                   | —                    | M     | 1   |
| BL-M5-01  | Ri-verifica fonte EiBi; parser EiBi + test                                                                                                                                            | FR-FRQ-01            | M     | 4   |
| BL-M5-02  | Gestione dataset per stagione                                                                                                                                                         | FR-FRQ-03            | M     | 2   |
| BL-M5-03  | Query "in onda ora", ricerca e filtri (EiBi e HFCC)                                                                                                                                   | FR-FRQ-04/05         | M     | 4   |
| BL-M5-04  | Contratto `ProviderDescriptor`/registry + pannello freschezza                                                                                                                         | FR-GEN-02, FR-DSH-05 | M     | 2   |
| BL-M5-05  | Parser HFCC (ZIP/TXT) + test su due stagioni — dopo BL-M5-07                                                                                                                          | FR-FRQ-02            | **M** | 3   |
| BL-M5-06  | Memorie di frequenza personali                                                                                                                                                        | FR-FRQ-07            | S     | 1   |
| BL-M5-07  | Gate HFCC: formato (documento ITU + due stagioni), termini d'uso (testo pubblico o conferma scritta: **richiesta da inviare già durante M1–M4**), spike ZIP con `DecompressionStream` | FR-FRQ-02, ADR-0012  | M     | 2   |
| BL-M6-01  | Calcolatori 01–08 + test numerici                                                                                                                                                     | FR-RFC-01..08        | M     | 6   |
| BL-M6-02  | UI locator/distanza/UTC                                                                                                                                                               | FR-RFC-09..11        | M     | 3   |
| BL-M6-03  | Chiusura milestone (E2E, documentazione, checklist)                                                                                                                                   | —                    | M     | 1   |
| BL-M7-01  | Catalogo segnali JSON + vista e filtri                                                                                                                                                | FR-SIG-01..04        | M     | 5   |
| BL-M7-02  | Chiusura milestone (E2E, documentazione, checklist)                                                                                                                                   | —                    | M     | 1   |
| BL-M8-01  | Provider CelesTrak + import TLE/OMM                                                                                                                                                   | FR-SAT-02/03         | M     | 4   |
| BL-M8-02  | Import SatNOGS                                                                                                                                                                        | FR-SAT-04            | M     | 2   |
| BL-M8-03  | Passaggi SGP4 in worker + test di riferimento                                                                                                                                         | FR-SAT-05/06/10      | M     | 6   |
| BL-M8-04  | Leaflet ground track + vista polare                                                                                                                                                   | FR-SAT-07            | S     | 4   |
| BL-M8-05  | Chiusura milestone (E2E, documentazione, checklist)                                                                                                                                   | —                    | M     | 2   |
| BL-M9-01  | Parser Raindrop sicuro + fixture anonimizzata                                                                                                                                         | FR-RES-02/03         | M     | 3   |
| BL-M9-02  | Catalogo, categorie, duplicati, ricerca                                                                                                                                               | FR-RES-01/04/05/06   | M     | 5   |
| BL-M9-03  | Chiusura milestone (E2E, documentazione, checklist)                                                                                                                                   | —                    | M     | 2   |
| BL-M10-01 | QSL Manager (stati, statistiche, import conferme)                                                                                                                                     | FR-QSL-01..05        | M     | 7   |
| BL-M10-02 | DX Cluster: link + (se approvato) provider DX Summit                                                                                                                                  | FR-DXC-\*            | M/S   | 4   |
| BL-M10-03 | Chiusura milestone (E2E, documentazione, checklist)                                                                                                                                   | —                    | M     | 1   |
| BL-M11-01 | Catalogo ripetitori, distanza, CSV                                                                                                                                                    | FR-RPT-01/02/04      | M     | 6   |
| BL-M11-02 | APRS: link e segnalibri                                                                                                                                                               | FR-APR-\*            | M     | 2   |
| BL-M11-03 | Chiusura milestone (E2E, documentazione, checklist)                                                                                                                                   | —                    | M     | 2   |
| BL-M12-01 | Decisione ADR-0010, provider SWPC, cache osservato/previsione                                                                                                                         | FR-PRP-01..03/07     | M     | 4   |
| BL-M12-02 | Banner HamQSL e risorse                                                                                                                                                               | FR-PRP-04..06        | M     | 2   |
| BL-M13-01 | Audit accessibilità e prestazioni su tablet                                                                                                                                           | NFR-ACC, NFR-PERF    | M     | 5   |
| BL-M13-02 | Revisione sicurezza (CSP, import, dipendenze)                                                                                                                                         | NFR-SEC              | M     | 3   |
| BL-M13-03 | Backup/restore completo (tutte le tabelle, allegati, versioni)                                                                                                                        | FR-SET-05/06         | M     | 4   |
| BL-M13-04 | Documentazione utente, pagina Informazioni, release 1.0.0                                                                                                                             | FR-SET-10            | M     | 6   |

Totali per milestone (base): M4 12 · M5 18 · M6 10 · M7 6 · M8 18 · M9 10 · M10 12 · M11 10 · M12 6 · M13 18.

---

## 5. Checklist di completamento M0

| #   | Criterio                                                                                    | Esito                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Verifica di coerenza fra `PROJECT.md`, stack e repository documentata                       | ✅ [Architettura § 13](../architecture/ARCHITECTURE.md#13-verifica-di-coerenza-progetto--stack--repository)                                                      |
| 2   | Requisiti funzionali per i 14 moduli, con ID, priorità e milestone                          | ✅ [Requisiti § 4](../requirements/REQUIREMENTS.md#4-requisiti-funzionali)                                                                                       |
| 3   | Requisiti non funzionali misurabili                                                         | ✅ [Requisiti § 6](../requirements/REQUIREMENTS.md#6-requisiti-non-funzionali)                                                                                   |
| 4   | Casi d'uso principali                                                                       | ✅ 15 casi d'uso, [Requisiti § 5](../requirements/REQUIREMENTS.md#5-casi-duso-principali)                                                                        |
| 5   | Architettura a layer, struttura cartelle, porte, PWA, sicurezza, test, deployment           | ✅ [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)                                                                                                            |
| 6   | Modello dati per tutte le entità di PROJECT §7, schema Dexie v1, migrazioni, import, backup | ✅ [DATABASE.md](../architecture/DATABASE.md)                                                                                                                    |
| 7   | Fonti esterne verificate (endpoint, HTTPS, CORS, licenza, auth, fallback)                   | ✅ con voci ⚠️ da chiudere nelle milestone indicate ([SOURCES.md](../data-sources/SOURCES.md))                                                                   |
| 8   | ADR per le decisioni rilevanti                                                              | ✅ 0001–0012: 9 accettati, 3 proposti con milestone di decisione (0006 e 0009 in M2, 0010 in M12)                                                                |
| 9   | HFCC nel perimetro v1 con dipendenze esplicite, allineato fra requisiti, backlog e DoD      | ✅ [Requisiti § 4.4.1](../requirements/REQUIREMENTS.md#441-dipendenze-dellimport-hfcc), BL-M5-05/07, criterio DoD 5, [ADR-0012](../adr/0012-hfcc-in-v1-scope.md) |
| 10  | Roadmap con dipendenze verificate, cammino critico, riserva del 20–25 % e backlog stimato   | ✅ § 1–4 (riserva 23,4 %)                                                                                                                                        |
| 11  | README e `CLAUDE.md` allineati alla struttura documentale e alle decisioni                  | ✅                                                                                                                                                               |
| 12  | Collegamenti interni (file e ancore) verificati                                             | ✅ controllo automatico su tutti i `.md` di `docs/`, `README.md` e `CLAUDE.md`                                                                                   |
| 13  | Formattazione Prettier dei documenti                                                        | ✅ `prettier --check` sui file modificati                                                                                                                        |
| 14  | Nessuna funzionalità di milestone successive implementata                                   | ✅ nessun file fuori da `docs/`, `README.md` e `CLAUDE.md` modificato rispetto a `08f2d66`                                                                       |
| 15  | Approvazione del maintainer                                                                 | ✅ 2026-10-17 (BL-M0-08)                                                                                                                                         |
| 16  | Commit di chiusura                                                                          | ☐ da eseguire (BL-M0-10)                                                                                                                                         |

---

## 6. Checklist di completamento M1

Stato al 2026-10-17. M1 è **approvata per la chiusura** dal maintainer. Restano le operazioni di rilascio di § 6.3, senza le quali la versione 0.1.0 non è in produzione. Gli esiti riportano solo verifiche effettivamente eseguite o dichiarate dal maintainer, ed è indicato quale dei due casi.

| #   | Criterio (§ 3, M1)                                                                                        | Esito                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run dev\|build\|preview\|typecheck\|lint\|format\|test\|test:e2e` funzionanti                        | ✅ in locale e in CI (§ 6.2)                                                                                                                            |
| 2   | PWA installabile; manifest e icone validi                                                                 | ✅ Chrome non riporta errori di manifest né di installabilità (CDP), in CI e sulla preview reale. Lighthouse non eseguito: sostituito dal controllo CDP |
| 3   | Offline (Playwright `setOffline`): app e route dei 14 moduli navigabili                                   | ✅ `tests/e2e/pwa.spec.ts`, desktop e tablet emulato, in CI                                                                                             |
| 4   | Toast di aggiornamento funzionante con due build                                                          | ✅ automatico con due build reali (`tests/e2e/pwa-update.spec.ts`) in CI                                                                                |
| 5   | Regole ESLint di layer attive, verificate da test negativi; nessuna stringa UI hardcoded                  | ✅ `tests/integration/eslint-layer-rules.spec.ts`, lint in CI                                                                                           |
| 6   | Deploy su Cloudflare Pages da GitHub Actions: route profonda 200, header di `_headers`, nessun `404.html` | ✅ sulla **preview** (deploy da GitHub Actions, smoke test 7/7, § 6.2). Produzione: alla prima esecuzione su `main` (§ 6.3)                             |
| 7   | Checklist manuale su tablet Android: installazione, avvio offline                                         | ✅ **dichiarato dal maintainer** il 2026-10-17; scheda di § 6.1 senza dati di dettaglio                                                                 |
| 8   | `typecheck`, `lint`, `test` e `build` verdi in CI                                                         | ✅                                                                                                                                                      |

### 6.1 Collaudo su tablet Android

Procedura: [ARCHITECTURE § 8.2](../architecture/ARCHITECTURE.md#82-collaudo-manuale-su-tablet-android). Esito complessivo **superato, su dichiarazione del maintainer** (2026-10-17). I dati di dettaglio non sono stati comunicati e non vengono ricostruiti: completarli, se disponibili, al primo aggiornamento della roadmap.

| Campo                       | Valore                |
| --------------------------- | --------------------- |
| Data                        | 2026-10-17            |
| Tablet (modello)            | non fornito           |
| Android / Chrome (versioni) | non fornito           |
| URL collaudato              | non fornito           |
| `build-id`                  | non fornito           |
| Esecutore                   | maintainer            |
| Esito                       | superato (dichiarato) |

### 6.2 Evidenze verificate (2026-10-17)

| Area                         | Evidenza                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI GitHub Actions            | PR #1. Run `39061024680` su `3185158` (2 tentativi) e run `39063898122` su `187c3ac` (4 tentativi): `quality` ed `e2e` verdi in tutti i tentativi                                                                                                                                                                                          |
| Deploy preview               | Run `39063898122`, tentativo 4: job `deploy` verde (20:21–20:22 UTC), deployment GitHub `7145258884` (ambiente `preview`), URL `https://3b30b77a.ham-radio-toolbox.pages.dev`, alias `https://feature-m1-pwa-foundation.ham-radio-toolbox.pages.dev`; artefatto `dist` della stessa esecuzione                                             |
| HTTPS e sicurezza            | `npm run test:deployment` ripetuto in locale su entrambi gli URL della preview: **7/7**. Verificati CSP (nessuna violazione, niente `unsafe-*`), `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `COOP`, `Permissions-Policy`, cache (`sw.js` `no-cache`, asset `immutable`). Le preview hanno anche `x-robots-tag: noindex` (Cloudflare) |
| Service worker, routing, PWA | Sulla preview: route profonde 200 dal fallback SPA, `/404.html` assente, SW registrato sotto CSP, nessun errore di manifest o di installabilità (CDP), `build-id` = `9ad12a9`, cioè il merge commit di prova della PR (`187c3ac` su `df0bd37`), come previsto per gli eventi `pull_request`                                                |
| Protezione di `main`         | Ruleset `main protection` (id 25316364) attivo, regole effettive lette via API: `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks` (`quality`, `e2e`, branch aggiornato). Lista dei bypass non leggibile senza autenticazione                                                                                        |
| Produzione                   | Non ancora presente: `https://ham-radio-toolbox.pages.dev` risponde 404, nessun deploy da `main` prima del merge                                                                                                                                                                                                                           |

### 6.3 Operazioni di rilascio e impedimenti

| #   | Voce                                                                                                                                                                                                                                                                                                                                                                 | Tipo                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | **Integrazione Git di Cloudflare attiva** (divergenza D-24): sui commit della PR compare il check _Workers Builds: ham-radio-toolbox_ della GitHub App `cloudflare-workers-and-pages`, **fallito**. Un Worker `ham-radio-toolbox` con build collegate al repository contraddice ADR-0011 e rende la PR `unstable`. Il check non è obbligatorio e non blocca il merge | Bloccante per la chiusura formale: va rimosso prima del merge |
| 2   | Merge squash della PR #1, deploy di produzione da `main` e smoke test su `https://ham-radio-toolbox.pages.dev`                                                                                                                                                                                                                                                       | Operazione di rilascio                                        |
| 3   | Tag `v0.1.0` sul commit di `main` e GitHub Release                                                                                                                                                                                                                                                                                                                   | Operazione di rilascio                                        |
| 4   | Lista dei bypass del ruleset da confermare nella UI GitHub                                                                                                                                                                                                                                                                                                           | Non bloccante                                                 |
| 5   | Dati di dettaglio del collaudo Android (§ 6.1)                                                                                                                                                                                                                                                                                                                       | Non bloccante (documentale)                                   |

---

## 7. Checklist di completamento M2

Stato al 2026-10-24, dopo il Blocco D. Gli esiti distinguono verifiche eseguite in locale, test in Chromium, CI e collaudo su tablet.

| #   | Criterio (§ 3, M2)                                                             | Esito                                                                                                                |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Schema v1 come DATABASE § 5                                                    | ✅ invariato nel Blocco D (in locale)                                                                                |
| 2   | ADR-0006 e ADR-0009 decisi prima dello schema                                  | ✅                                                                                                                   |
| 3   | Test di integrazione dei repository con `fake-indexeddb`                       | ✅ in locale                                                                                                         |
| 4   | Test unitari con valori di riferimento (band plan, Maidenhead, distanze, RST…) | ✅ in locale (Blocco A)                                                                                              |
| 5   | Backup → restore round-trip identico su tutte le tabelle v1                    | ✅ in locale su `fake-indexeddb` e in Chromium                                                                       |
| 6   | Stato storage e persistenza visibili in Impostazioni                           | ✅ in locale e in Chromium                                                                                           |
| 7   | Profilo stazione e preferiti persistiti                                        | ✅ in locale e in Chromium                                                                                           |
| 8   | `typecheck`, `lint`, `test` e `build` verdi in CI                              | ☐ **CI GitHub da eseguire** sulla PR (in locale tutti verdi, § 4 Verifica del Blocco D)                              |
| 9   | Collaudo su tablet Android (§ 7.2)                                             | ☐ **non eseguito**: nessun collaudo fisico registrato per M2                                                         |
| 10  | ADR-0016 approvato                                                             | ✅ accettato (2026-10-24)                                                                                            |
| 11  | Approvazione del Blocco D e chiusura di M2 da parte del maintainer             | ✅ Blocco D approvato (2026-10-24); ☐ chiusura formale dopo CI, collaudo e rilascio                                  |
| 12  | Rilascio: merge su `main`, deploy di produzione verificato, tag `v0.2.0`       | ☐ piano in § 7.3; da quel momento lo schema v1 è immutabile ([ADR-0006](../adr/0006-dexie-naming-and-migrations.md)) |

### 7.1 Requisiti rinviati da M2

| Voce                                                                                                                                                                                     | Rinvio               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Backup fino a 500 MB (staging, eventuale ZIP) — Q-M2-10                                                                                                                                  | M13 (ADR dedicato)   |
| Limite di 100 MiB confermato su tablet — Q-M2-11                                                                                                                                         | collaudo § 7.2 / M13 |
| Storico degli import job e dei restore nella UI di Impostazioni (FR-SET-07) e gestione database (FR-SET-04) — Q-M2-13: **non implementati**, i job sono solo registrati in `import_jobs` | M13                  |
| Promemoria di backup (FR-SET-09)                                                                                                                                                         | M13                  |
| Derivazione di `lat`/`lon` dal locator nel form del profilo (DB-7)                                                                                                                       | M3                   |
| Scelta del profilo nel form del QSO (resto di BL-M3-08)                                                                                                                                  | M3                   |
| Band plan oltre 13 cm (BL-M2-10)                                                                                                                                                         | M3 o M6              |
| Budget del bundle e caricamento pigro dei repository — Q-M2-07                                                                                                                           | M13                  |

### 7.2 Collaudo su tablet Android (checklist)

Ambiente: Chrome stabile sul tablet, app installata dall'URL HTTPS di preview o produzione (ARCHITECTURE § 8.2). Annotare modello, versioni di Android e Chrome, `build-id`. Usare **solo dati sintetici**: profili inventati (es. "Test", `IZ0TST`), backup prodotti con l'harness (`tests/browser/backup-harness`, `syntheticTables`) o creati sul tablet stesso. Per ogni passo registrare esito, tempo (cronometro) e anomalie.

| #   | Passo                                                                                                                               | Esito atteso                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Impostazioni → Archiviazione: leggere stato database, spazio, quota e persistenza; poi premere _Richiedi archiviazione persistente_ | Database disponibile, valori plausibili; nessun prompt all'avvio; esito della richiesta mostrato (concessa, o diniego con spiegazione) |
| 2   | Creare un profilo, chiudere l'app dal multitasking, riaprirla                                                                       | Profilo presente, predefinito                                                                                                          |
| 3   | Fissare due preferiti e scegliere il tema Scuro; riavviare il tablet; aprire in modalità aereo                                      | Preferiti, ordine e tema conservati; nessun cambio di tema visibile all'apertura                                                       |
| 4   | Backup piccolo (pochi record, senza allegati): creare, scaricare                                                                    | File `hrt-backup-…json` nella cartella Download; nome corretto                                                                         |
| 5   | Ripristinare quel file dal selettore di sistema (Sostituisci) dopo aver creato un secondo profilo                                   | Anteprima con 1 profilo eliminato; conferma richiesta; profilo extra rimosso                                                           |
| 6   | Backup sintetico da ~5 MB (10 000 QSO): analisi, anteprima, commit                                                                  | Tempi annotati; interfaccia reattiva (scroll e tocco) durante l'analisi                                                                |
| 7   | Ripetere con ~25 MB (50 000 QSO) e ~50 MB (100 000 QSO)                                                                             | Tempi annotati; nessun crash della scheda; dati verificati                                                                             |
| 8   | Solo se 7 è superato: ~100 MiB (200 000 QSO) e 100 MiB con allegati                                                                 | Completamento o abbassamento del limite via configurazione (Q-M2-11)                                                                   |
| 9   | Durante un commit grande, chiudere l'app dal multitasking; riaprirla                                                                | Dati invariati (vecchi), nessun dato parziale                                                                                          |
| 10  | Aprire l'app in due schede di Chrome; fissare un preferito in una                                                                   | L'altra scheda lo mostra                                                                                                               |
| 11  | Navigazione in incognito                                                                                                            | Avviso di archivio non disponibile o dati non persistenti; app navigabile                                                              |

#### Esiti del collaudo fisico

| Data | Dispositivo | Android / Chrome | URL e `build-id` | Passi superati | Esito                                                |
| ---- | ----------- | ---------------- | ---------------- | -------------- | ---------------------------------------------------- |
| —    | —           | —                | —                | —              | Nessun collaudo fisico eseguito per M2 al 2026-10-24 |

Il limite di backup **verificato** resta quello su Chromium desktop (100 MiB). Su Android il limite è **non verificato** finché i passi 6–8 non sono registrati qui; se un passo fallisce, il limite per Android si abbassa via configurazione e si annota il valore adottato.

### 7.3 Piano di rilascio 0.2.0

Nessun passo è stato eseguito: ciascuno richiede l'autorizzazione del maintainer.

| #   | Passo                                                                                                                               | Esito atteso / verifica                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Commit del consolidamento sul branch `feature/m2-database-persistence` e push                                                       | `origin/feature/m2-database-persistence` aggiornato                                                         |
| 2   | Versione `0.2.0` in `package.json` e `package-lock.json` (`npm version 0.2.0 --no-git-tag-version`), commit `chore(release): 0.2.0` | `appVersion` dei backup = `0.2.0`                                                                           |
| 3   | PR verso `main` con descrizione, checklist § 7 e link agli ADR 0013–0016                                                            | PR aperta                                                                                                   |
| 4   | GitHub Actions `quality` ed `e2e` verdi                                                                                             | Run e SHA registrati in questa sezione                                                                      |
| 5   | Deploy di preview Cloudflare Pages dal job `deploy` (variabile `CF_PAGES_DEPLOY=true`)                                              | URL di preview registrato                                                                                   |
| 6   | Smoke test HTTPS: `PAGES_URL=<preview> EXPECTED_BUILD_ID=<sha> npm run test:deployment`                                             | Tutti verdi (header, CSP, SW, route profonde, Impostazioni sotto CSP)                                       |
| 7   | Collaudo su tablet Android (§ 7.2) sulla preview                                                                                    | Esiti nella tabella sopra; limite Android deciso                                                            |
| 8   | Merge _squash_ autorizzato su `main`                                                                                                | Commit di `main` registrato                                                                                 |
| 9   | Deploy di produzione da `main` e smoke test su `https://ham-radio-toolbox.pages.dev`                                                | `build-id` = SHA del merge                                                                                  |
| 10  | **Congelamento dello schema Dexie v1**: dal deploy di produzione `SCHEMA_V1` non si modifica più; ogni cambio = v2 con migrazione   | Annotato in DATABASE § 7.1 (stato "rilasciata") e in [ADR-0006](../adr/0006-dexie-naming-and-migrations.md) |
| 11  | Tag `v0.2.0` sul commit di `main` e GitHub Release con note (perimetro M2, limiti, collaudo)                                        | Tag e release pubblicati                                                                                    |
| 12  | Chiusura formale di M2 in questa roadmap (§ 2.3 consuntivo, § 7)                                                                    | —                                                                                                           |
