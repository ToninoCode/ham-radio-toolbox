# Fonti dati esterne — stato di verifica

| Campo               | Valore                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stato               | M0 — Prima verifica                                                                                                                                                                                             |
| Data di verifica    | 2026-10-17                                                                                                                                                                                                      |
| Documenti collegati | [ADR-0007 Policy provider](../adr/0007-external-provider-policy.md) · [Architettura § 7](../architecture/ARCHITECTURE.md#7-fonti-esterne-contratto-dei-provider) · [Requisiti](../requirements/REQUIREMENTS.md) |

Regola (`CLAUDE.md`): prima di implementare un'integrazione si documentano endpoint reale, formato, CORS, licenza/termini, autenticazione, rate limit e fallback. Se il browser non può accedere direttamente → **import manuale** o **link esterno**. Nessun proxy, nessuno scraping.

Questo documento va **ri-verificato** all'inizio della milestone che implementa ciascuna fonte (colonna "M"): endpoint, termini e header possono cambiare.

---

## 1. Metodo di verifica

- **CORS**: richiesta `GET` (e, dove rilevante, preflight `OPTIONS`) con intestazione `Origin: https://example.org`, controllando `Access-Control-Allow-Origin` nella risposta (`curl -D -`).
- **HTTPS**: richiesta allo stesso percorso con schema `https://`. Una PWA servita in HTTPS **non può** leggere risorse `http://` (mixed content bloccato dal browser).
- **Termini/licenza**: lettura delle pagine ufficiali della fonte. Dove non è stato trovato un testo esplicito, lo stato è "da verificare".
- **Formato**: ispezione di un campione reale.

Legenda modalità di accesso: **native** = lettura diretta dal browser · **import** = l'utente scarica il file e lo importa · **link** = solo collegamento esterno.

---

## 2. Riepilogo

| Fonte                  | Uso                               | HTTPS                       | CORS                              | Auth                            | Licenza / termini                                                                                                                            | Modalità v1                        | M      |
| ---------------------- | --------------------------------- | --------------------------- | --------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ |
| EiBi                   | Palinsesti broadcast HF           | ❌ (solo HTTP)              | ❌                                | No                              | ✅ Libero uso, copia, distribuzione e uso in software di terzi                                                                               | **import** + link                  | M5     |
| HFCC                   | Palinsesti coordinati             | ❌ (HTTPS non risponde)     | ❌                                | No                              | ⚠️ Dati pubblici dichiarati "unlimited availability"; termini formali da verificare                                                          | **import** + link                  | M5     |
| SigIDWiki              | Identificazione segnali           | ✅                          | ❌ (API 403 a client non browser) | No                              | ⚠️ Da verificare                                                                                                                             | **link**                           | M7     |
| CelesTrak              | Elementi orbitali (GP: OMM/TLE)   | ✅                          | ✅ `*`                            | No                              | ✅ Uso pubblico con limiti di frequenza (aggiornamento ogni 2 h; blocco IP in caso di abuso)                                                 | **native** + import                | M8     |
| SatNOGS DB             | Transmitter, satelliti            | ✅                          | ❌                                | No (lettura)                    | ⚠️ Da riconfermare (dati della comunità, attesa CC BY-SA)                                                                                    | **import** + link                  | M8     |
| HamQSL (N0NBH)         | Banner condizioni solari/HF       | ✅                          | ❌ (XML)                          | No                              | ⚠️ Banner pensati per l'inclusione su siti terzi; da riconfermare                                                                            | **link** + immagine incorporata    | M12    |
| NOAA SWPC _(proposta)_ | Kp, SFI, vento solare, previsioni | ✅                          | ✅ `*`                            | No                              | ✅ Dati del governo USA (pubblico dominio)                                                                                                   | **native** (se ADR-0010 approvato) | M12    |
| QRZ.com                | Info nominativi                   | ✅                          | ✅ `*` (XML API)                  | Sì (account + abbonamento XML)  | Servizio a pagamento per l'XML API                                                                                                           | **link**                           | M10    |
| eQSL.cc                | QSL elettroniche                  | ✅                          | n/d                               | Sì                              | Upload/download ADIF dal sito                                                                                                                | **link** + ADIF manuale            | M10    |
| LoTW (ARRL)            | Conferme                          | ✅                          | ❌                                | Sì + firma TQSL                 | Upload tramite TQSL; download ADIF dal sito                                                                                                  | **link** + ADIF manuale            | M10    |
| DX Summit              | Spot DX                           | ✅                          | ✅ `*`                            | No (lettura)                    | ⚠️ Termini d'uso dell'API da verificare                                                                                                      | **link** (native da approvare)     | M10    |
| aprs.fi                | Mappe/dati APRS                   | ✅                          | ❌                                | Sì (chiave API per utente)      | Vietato pre-caricare/pre-cachare; chiave per utente                                                                                          | **link**                           | M11    |
| RepeaterBook           | Database ripetitori               | ✅                          | n/d                               | Sì (HTTP 401 senza credenziali) | Uso dell'API soggetto ad autorizzazione                                                                                                      | **link**                           | M11    |
| MapForHam              | Mappe ripetitori                  | ✅ (sito)                   | n/d                               | —                               | Nessuna API pubblica individuata                                                                                                             | **link**                           | M11    |
| WebSDR                 | Ricevitori remoti                 | ❌ (`websdr.org` solo HTTP) | n/d                               | —                               | Siti dei singoli operatori                                                                                                                   | **link** (nuova scheda)            | M9/M12 |
| Raindrop.io            | Segnalibri personali              | —                           | —                                 | —                               | Export dell'utente                                                                                                                           | **import** file HTML               | M9     |
| OpenStreetMap tile     | Mappe                             | ✅                          | ✅ `*`                            | No                              | ODbL + [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/): attribuzione obbligatoria, niente download massivo/offline | **native** (solo online)           | M8/M11 |

✅ verificato · ❌ verificato assente · ⚠️ da verificare · n/d non rilevante per la modalità scelta.

---

## 3. Schede per fonte

### 3.1 EiBi

| Voce                | Dettaglio                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sito                | `http://www.eibispace.de/dx/`                                                                                                                                                                                                                                                                                                                                |
| Endpoint verificato | `http://www.eibispace.de/dx/sked-a26.csv` → 200 `text/csv`, `Last-Modified: 2026-10-04`. Stagione B26 prevista da fine ottobre 2026 (`sked-b26.csv`, al momento della verifica 404).                                                                                                                                                                         |
| HTTPS               | Nessuna risposta su `https://www.eibispace.de/` (timeout).                                                                                                                                                                                                                                                                                                   |
| CORS                | Assente.                                                                                                                                                                                                                                                                                                                                                     |
| Formato             | CSV con separatore `;`, prima riga di intestazione: `kHz;Time(UTC);Days;ITU;Station;Lng;Target;Remarks;P;Start;Stop`. Esempio: `16.3;0000-2400;;IND;VTX1 Indian Navy;;SAs;v;1;;`. Frequenza in kHz con decimali, orario `HHMM-HHMM`, giorni opzionali (formati da documentare in M5 da `README.TXT`), codici ITU/lingua/area in tabelle separate del README. |
| Codifica            | Da verificare in M5 (il README contiene caratteri non UTF-8: probabile Latin-1/Windows-1252).                                                                                                                                                                                                                                                                |
| Licenza             | `README.TXT`, sezione _Conditions of use_: "free of cost, and any person is absolutely free to download, use, copy, or distribute these files or to use them within third-party software". Nessuna garanzia sui contenuti.                                                                                                                                   |
| Rate limit          | Nessuno dichiarato (non rilevante: download manuale).                                                                                                                                                                                                                                                                                                        |
| Modalità            | **Import manuale** del CSV + link alla pagina di download. Il fetch diretto è impossibile (HTTP + nessun CORS).                                                                                                                                                                                                                                              |
| Attribuzione in app | "Dati EiBi — Eike Bierwirth, eibispace.de, stagione XNN, importato il …".                                                                                                                                                                                                                                                                                    |

### 3.2 HFCC

| Voce          | Dettaglio                                                                                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sito          | `http://www.hfcc.org/data/` (HTTP 200); `https://www.hfcc.org/` timeout.                                                                                                                                                                                  |
| File pubblici | Per stagione: `http://www.hfcc.org/data/a26/a26allx2.zip` (indice `data/a26/index.phtml`); archivio storico dal 1998.                                                                                                                                     |
| CORS          | Assente.                                                                                                                                                                                                                                                  |
| Formato       | Testo a larghezza fissa ("Standard Format" documentato sul sito) compresso ZIP. La specifica dei campi va letta e codificata in M5.                                                                                                                       |
| Licenza       | Pagina "Public access HFCC database": i dati sono resi pubblici per garantire agli ascoltatori l'accesso alle programmazioni. Nessun testo di licenza formale individuato → **da verificare in M5** prima di distribuire fixture derivate nel repository. |
| Modalità      | **Import manuale** (ZIP o TXT estratto) + link.                                                                                                                                                                                                           |
| Nota          | FR-FRQ-02 è _Should_: se la specifica del formato o la licenza non sono chiare, si rinvia senza bloccare M5.                                                                                                                                              |

### 3.3 SigIDWiki

| Voce     | Dettaglio                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Sito     | `https://www.sigidwiki.com/wiki/Signal_Identification_Guide` (200 con user-agent da browser).                                                   |
| API      | `api.php` MediaWiki → 403 a client non browser (protezione anti-bot). Nessun CORS.                                                              |
| Licenza  | Non individuata nella pagina verificata → **da verificare in M7** (Q-05).                                                                       |
| Modalità | **Link** per ogni voce del catalogo. Le descrizioni incluse nell'app sono redatte in proprio; audio/waterfall solo come link. Nessuno scraping. |

### 3.4 CelesTrak

| Voce                | Dettaglio                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint verificati | `https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=json` (200, `application/json`, `Access-Control-Allow-Origin: *`) · `…&FORMAT=tle` (200, `text/plain`, CORS `*`). Formati disponibili: TLE, 3LE, OMM in XML/KVN/JSON/CSV.                                                                                               |
| Auth                | Nessuna.                                                                                                                                                                                                                                                                                                                                  |
| Policy              | Dalla documentazione GP: i dati vengono controllati "una volta ogni 2 ore", richieste più frequenti sono inutili e portano a **blocchi temporanei** dell'IP; in caso di **403/404** non ripetere la richiesta.                                                                                                                            |
| Implementazione     | `minRefreshIntervalMs = 2 h` per gruppo, persistito in `data_sources.nextAllowedFetchAt`; nessun retry su 4xx; download solo su azione dell'utente (o all'apertura del modulo se il dato ha più di 24 h e l'utente lo ha abilitato). Preferire **OMM JSON** (numeri di catalogo a più di 5 cifre in arrivo; il TLE ha limiti di formato). |
| Fallback            | Import manuale di file TLE/OMM.                                                                                                                                                                                                                                                                                                           |
| Attribuzione        | "Elementi orbitali: CelesTrak (Dr. T.S. Kelso)".                                                                                                                                                                                                                                                                                          |

### 3.5 SatNOGS DB

| Voce                  | Dettaglio                                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint verificati   | `https://db.satnogs.org/api/transmitters/?format=json&satellite__norad_cat_id=25544` → 200 JSON; `https://db.satnogs.org/api/satellites/?format=json&norad_cat_id=25544` → 200 JSON.                                                     |
| CORS                  | **Assente** sia sulla `GET` sia sul preflight `OPTIONS`.                                                                                                                                                                                 |
| Formato (transmitter) | Campi rilevati: `uuid`, `description`, `alive`, `type`, `uplink_low/high`, `downlink_low/high` (Hz), `mode`, `uplink_mode`, `invert`, `baud`, `sat_id`, `norad_cat_id`, `status`, `updated`, `citation`, `service`, `iaru_coordination`… |
| Licenza               | Da riconfermare in M8 sul sito SatNOGS DB (atteso CC BY-SA 4.0).                                                                                                                                                                         |
| Modalità              | **Import manuale** dei file JSON (`/api/transmitters/?format=json`, `/api/satellites/?format=json`) scaricati dall'utente tramite link generati dall'app.                                                                                |

### 3.6 HamQSL (N0NBH)

| Voce                | Dettaglio                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint verificato | `https://www.hamqsl.com/solarxml.php` → 200 `text/xml`, **senza CORS**.                                                                                                               |
| Banner              | Il sito offre immagini/banner con le condizioni solari e HF pensati per l'inclusione in siti terzi (`<img>` non richiede CORS). URL esatti e condizioni d'uso da riconfermare in M12. |
| Modalità            | **Immagine incorporata** (con attribuzione e link) + link alla pagina. Nessun parsing dell'XML dal browser.                                                                           |

### 3.7 NOAA SWPC (proposta, non in `PROJECT.md`)

| Voce                | Dettaglio                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Endpoint verificati | `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json` e `https://services.swpc.noaa.gov/json/f107_cm_flux.json` → 200 JSON, `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=60`, `Last-Modified` presente. |
| Licenza             | Dati prodotti da un'agenzia federale USA: pubblico dominio (attribuzione comunque mostrata).                                                                                                                                         |
| Auth / rate limit   | Nessuna auth; nessun limite pubblicato individuato → refresh client al massimo ogni 15 min.                                                                                                                                          |
| Uso                 | Valori numerici osservati e previsti (Kp, F10.7, vento solare, raggi X) per FR-PRP-01/02.                                                                                                                                            |
| Stato               | **Richiede approvazione** — [ADR-0010](../adr/0010-noaa-swpc-propagation-source.md). Endpoint definitivi (osservato vs previsione) da fissare in M12.                                                                                |

### 3.8 QRZ.com

| Voce                | Dettaglio                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint verificato | `https://xmldata.qrz.com/xml/current/` → 200, CORS `*`.                                                                                                                                       |
| Auth                | Login con username/password per ottenere una session key; l'accesso completo ai dati richiede un **abbonamento XML**.                                                                         |
| Modalità            | **Link** alla pagina del nominativo (`https://www.qrz.com/db/<CALL>`). Nessuna integrazione autenticata in v1 (`CLAUDE.md`). Gli export ADIF del logbook QRZ si importano come ADIF generico. |

### 3.9 eQSL.cc

| Voce     | Dettaglio                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sito     | `https://www.eqsl.cc/` → 302 verso `/qslcard/Index.cfm`.                                                                                                                             |
| Modalità | **Link** + ADIF: l'utente esporta dall'app e carica su eQSL; scarica l'ADIF delle conferme e lo importa (aggiornamento `qsl_records`, canale `eqsl`). Nessuna automazione del login. |

### 3.10 LoTW (ARRL)

| Voce              | Dettaglio                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sito              | `https://lotw.arrl.org/`                                                                                                                                            |
| Upload            | Richiede firma con **TQSL** (applicazione desktop): fuori dall'app. Nessuna automazione della firma (`CLAUDE.md`).                                                  |
| Download conferme | ADIF scaricabile dall'utente dal sito → import in app.                                                                                                              |
| Dato pubblico     | `https://lotw.arrl.org/lotw-user-activity.csv` → 200 `text/csv`, senza CORS: eventuale import manuale (indicatore "utente LoTW attivo") — _Could_, non pianificato. |

### 3.11 DX Summit

| Voce                | Dettaglio                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint verificato | `https://www.dxsummit.fi/api/v1/spots?limit=5` → 200 JSON, `Access-Control-Allow-Origin: *`.                                                                                              |
| Formato             | Array di spot: `id`, `de_call`, `dx_call`, `frequency` (kHz con decimali), `time` (ISO senza fuso, da trattare come UTC — da confermare), `info`, `dx_country`, coordinate `de_*`/`dx_*`. |
| Termini             | API non documentata pubblicamente come servizio per terzi → **da verificare in M10** (Q-04).                                                                                              |
| Modalità            | v1: **link**. Integrazione nativa in sola lettura solo dopo verifica dei termini, con refresh minimo 60 s e solo con modulo in primo piano.                                               |
| Nota                | I DX Cluster telnet (DXSpider, AR-Cluster, CC Cluster) non sono raggiungibili dal browser.                                                                                                |

### 3.12 aprs.fi

| Voce                 | Dettaglio                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint             | `https://api.aprs.fi/api/get?name=…&what=loc&apikey=…&format=json` → 200 JSON, **senza CORS**.                                                                                                                                          |
| Termini (pagina API) | Chiave API personale per ogni utente; le applicazioni distribuite devono far richiedere a ciascun utente la propria chiave; richieste solo quando servono all'utente; **vietato pre-caricare/pre-cachare** o raccogliere dati in massa. |
| Modalità             | **Link** alla mappa/stazione (`https://aprs.fi/#!call=<CALL>`, formato da riconfermare in M11) + segnalibri locali. Nessuna integrazione nativa in v1 (CORS assente; una chiave nel frontend violerebbe CON-04).                        |

### 3.13 RepeaterBook

| Voce     | Dettaglio                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint | `https://www.repeaterbook.com/api/export.php?country=Italy` → **401** senza credenziali.                                                                                               |
| Modalità | **Link**. Nessun import dai loro dati senza autorizzazione esplicita e compatibilità di licenza. Catalogo ripetitori gestito dall'utente (FR-RPT-01) e import CSV dei **propri** dati. |

### 3.14 MapForHam

| Voce     | Dettaglio                                                             |
| -------- | --------------------------------------------------------------------- |
| Sito     | `https://www.mapforham.com/` → 200. Nessuna API pubblica individuata. |
| Modalità | **Link**.                                                             |

### 3.15 WebSDR

| Voce     | Dettaglio                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sito     | `http://websdr.org/` (elenco ricevitori, solo HTTP). Ogni ricevitore è un sito indipendente.                                                                                      |
| Modalità | **Link** in nuova scheda (eventualmente segnalibri in Resource Manager). Nessun incorporamento (iframe/audio) in v1: fuori perimetro (PROJECT §11, ricezione SDR in tempo reale). |

### 3.16 Raindrop.io

| Voce     | Dettaglio                                                                                                                                                                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato  | Export HTML "Netscape Bookmark File" (`<!DOCTYPE NETSCAPE-Bookmark-file-1>`).                                                                                                                                                                                                                                                           |
| Campione | `docs/references/Ham_Radio.html` (personale, non versionato): 52 KB, 200 link (`<A>`), 2 cartelle (`<H3>`: _Hobbies_ › _Ham Radio_), attributi `HREF`, `ADD_DATE`, `LAST_MODIFIED` (epoch in secondi), `TAGS` (19 con `radio`, 181 vuoti), `DATA-COVER` (URL `rdl.ink/render/…`), `DATA-IMPORTANT`; nessun `<DD>`; 42 URL in `http://`. |
| Modalità | **Import manuale**. L'API Raindrop (OAuth) non è usata in v1.                                                                                                                                                                                                                                                                           |
| Privacy  | `DATA-COVER` punta a un servizio di rendering esterno: non caricato automaticamente (FR-RES-08).                                                                                                                                                                                                                                        |

### 3.17 OpenStreetMap (tile)

| Voce     | Dettaglio                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` → 200, CORS `*`.                                                                                 |
| Policy   | Attribuzione "© OpenStreetMap contributors" visibile; nessun download massivo/prefetch per uso offline; uso intensivo scoraggiato.                |
| Modalità | **Native, solo online**; cache del SW limitata alle tile visitate. Se l'uso crescesse, passare a un fornitore di tile con termini adeguati (ADR). |

---

## 4. Fonti da valutare (non in `PROJECT.md`)

| Fonte                          | Uso potenziale                           | Stato                                                                                              | Milestone |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------- | --------- |
| NOAA SWPC                      | Propagazione numerica                    | Verificata (§ 3.7), richiede ADR-0010                                                              | M12       |
| Country Files `cty.dat` (AD1C) | Prefisso → entità DXCC, continente, zone | Licenza e formato da verificare (Q-06)                                                             | M3        |
| ITU / tabelle EiBi             | Decodifica codici paese/lingua/area      | Le tabelle sono nel `README.TXT` EiBi (stessa licenza)                                             | M5        |
| Band plan IARU Regione 1       | Derivazione banda                        | Documento pubblico IARU; i limiti di banda sono dati fattuali da codificare a mano con riferimento | M2/M3     |

---

## 5. Registro delle verifiche

| Data       | Fonte                 | Esito               | Note                                                                                                          |
| ---------- | --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-10-17 | Tutte le fonti di § 2 | Prima verifica (M0) | Header raccolti con `curl` da Linux/WSL2; contenuti di termini letti dalle pagine ufficiali dove disponibili. |
