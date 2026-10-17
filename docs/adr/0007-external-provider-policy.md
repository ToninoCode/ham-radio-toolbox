# 0007 — Policy per le fonti esterne

- **Stato**: Accettato
- **Data**: 2026-10-17
- **Milestone**: M0

## Contesto

PROJECT §6 elenca 14 fonti esterne. `CLAUDE.md` vieta endpoint inventati, scraping non autorizzato, chiavi nel frontend, proxy non dichiarati e automazioni che aggirino autenticazione o firma TQSL. La verifica di M0 (`SOURCES.md`) mostra che solo poche fonti sono accessibili dal browser: EiBi e HFCC sono solo HTTP, molte API non hanno CORS o richiedono credenziali.

## Decisione

1. Ogni fonte ha una **modalità di accesso** dichiarata: `native` (fetch diretto), `manual-import` (file scaricato dall'utente) o `link`.
2. `native` è consentita solo se **tutte** le condizioni sono verificate e registrate in `SOURCES.md`: HTTPS, CORS compatibile, nessuna credenziale condivisa, termini d'uso che permettono l'uso da client di terzi, rate limit rispettabile lato client.
3. In assenza anche di una sola condizione si ripiega su `manual-import` o `link`. **Nessun proxy CORS**, né pubblico né proprio, in v1.
4. Ogni provider implementa il contratto `ProviderDescriptor` (licenza, attribuzione, CORS, auth, `minRefreshIntervalMs`, `verifiedAt`) e i dati salvati conservano fonte, versione/stagione e data di acquisizione.
5. Nessuna richiesta automatica in background: i fetch partono da azione dell'utente o all'apertura del modulo se il dato è scaduto e l'utente l'ha abilitato.
6. Su 4xx nessun retry automatico; su 5xx/rete backoff esponenziale limitato.
7. Le fonti si ri-verificano all'inizio della milestone che le implementa.

## Alternative considerate

| Alternativa                 | Pro                                  | Contro                                                                                       |
| --------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Proxy CORS pubblico         | Integrazione di quasi tutte le fonti | Viola i termini di molte fonti, terza parte non affidabile, privacy, contrario a `CLAUDE.md` |
| Funzione serverless propria | Controllo                            | È un backend (viola ADR-0003); chiavi da gestire                                             |
| Solo link per tutto         | Massima semplicità                   | Perde valore offline (palinsesti, orbite)                                                    |

## Conseguenze

Integrazioni native in v1: CelesTrak (verificata), tile OSM, e — se approvate — NOAA SWPC ([ADR-0010](0010-noaa-swpc-propagation-source.md)) e DX Summit. Tutto il resto passa da import manuale o link; l'UI deve guidare l'utente nel download dei file (link diretti alle pagine ufficiali).
