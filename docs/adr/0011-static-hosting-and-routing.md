# 0011 — Hosting statico e modalità di routing

- **Stato**: Proposto (da decidere all'avvio di M1)
- **Data**: 2026-10-17
- **Milestone**: M1

## Contesto

`CLAUDE.md` prevede "hosting statico HTTPS" e deploy da GitHub Actions senza indicare il fornitore. La scelta influenza: base path di Vite, fallback SPA per `createWebHistory`, possibilità di impostare header HTTP (CSP, `Cache-Control` del service worker), costi.

## Decisione (proposta)

- Preferire un hosting che supporti **header personalizzati e rewrite SPA** (es. Cloudflare Pages o Netlify, piano gratuito), con deploy da GitHub Actions.
- Router con `createWebHistory`; CSP e `Cache-Control: no-cache` per `sw.js` e `index.html` impostati via header.
- Se si sceglie **GitHub Pages** (nessun header personalizzato, sottopercorso `/<repo>/`): `base` di Vite configurato, CSP via `<meta>`, router con `createWebHashHistory` o fallback `404.html`.

## Alternative considerate

| Alternativa                | Pro                                                    | Contro                                                          |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| GitHub Pages               | Integrato con il repository, nessun account aggiuntivo | Niente header custom, routing SPA con workaround, sottopercorso |
| Cloudflare Pages / Netlify | Header, rewrite, anteprime per PR                      | Account esterno aggiuntivo                                      |
| Server proprio             | Controllo completo                                     | È infrastruttura da gestire, fuori spirito v1                   |

## Conseguenze

La decisione va presa prima del primo deploy (BL-M1-13). Il cambio successivo di fornitore è a basso costo (build statica), ma cambiare la modalità di routing rompe i link salvati e le scorciatoie installate.
