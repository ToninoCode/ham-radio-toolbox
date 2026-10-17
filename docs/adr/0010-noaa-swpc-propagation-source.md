# 0010 — NOAA SWPC come fonte numerica per la propagazione

- **Stato**: Proposto (richiede approvazione del maintainer; decisione entro M12)
- **Data**: 2026-10-17
- **Milestone**: M12

## Contesto

MOD-13 richiede flusso solare, Kp, informazioni solari/geomagnetiche con distinzione fra osservazioni e previsioni (FR-PRP-01/02). PROJECT §6 cita **HamQSL** come fonte: l'XML `solarxml.php` è raggiungibile in HTTPS ma **senza CORS** (verificato il 2026-10-17), quindi non leggibile dal browser. È possibile solo incorporare i banner come immagine. Aggiungere una fonte modifica il perimetro di PROJECT §6 e richiede quindi un ADR (`CLAUDE.md`).

## Decisione (proposta)

Aggiungere **NOAA Space Weather Prediction Center** come fonte `native` per i valori numerici:

- Endpoint verificati: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`, `https://services.swpc.noaa.gov/json/f107_cm_flux.json` (HTTPS, `Access-Control-Allow-Origin: *`, `Last-Modified`). Elenco definitivo (incluse previsioni e vento solare) da fissare in M12.
- Dati del governo USA (pubblico dominio); attribuzione mostrata comunque.
- Refresh al massimo ogni 15 minuti, solo a modulo aperto; cache in `space_weather` con `kind: 'observed' | 'forecast'`.
- HamQSL resta per i banner (immagine) e come link.

## Alternative considerate

| Alternativa               | Pro                       | Contro                                                                                                             |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Solo banner HamQSL + link | Nessuna fonte nuova       | Nessun dato numerico in cache, nessuna distinzione osservato/previsione strutturata; FR-PRP-01..03 non soddisfatti |
| Proxy per l'XML HamQSL    | Fonte prevista da PROJECT | Viola ADR-0003/0007                                                                                                |

## Conseguenze

Se approvato: `SOURCES.md` e la tabella fonti di `PROJECT.md` vanno aggiornati e la CSP deve includere `connect-src https://services.swpc.noaa.gov`. Se respinto: FR-PRP-01/03 si riducono al banner e ai link, e i requisiti vanno riclassificati.
