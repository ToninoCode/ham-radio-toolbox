# 0011 — Hosting statico e modalità di routing

- **Stato**: Accettato (approvato dal maintainer il 2026-10-17, chiusura M0)
- **Data**: 2026-10-17
- **Milestone**: M0 (decisione) · M1 (attuazione, BL-M1-13)

## Contesto

`CLAUDE.md` prevede "hosting statico HTTPS" e deploy da GitHub Actions. La scelta influenza: base path di Vite, fallback SPA per `createWebHistory`, header HTTP (CSP, cache del service worker), costi. Il maintainer ha scelto **Cloudflare Pages** con routing SPA in **history mode**, previa verifica della configurazione necessaria.

## Verifica della configurazione (2026-10-17, documentazione ufficiale Cloudflare)

| Aspetto                                                                                                                              | Comportamento documentato                                                                                                                                                                      | Conseguenza per il progetto                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fallback SPA ([Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/))                                 | Se nell'output **non c'è un `404.html` di primo livello**, Pages tratta il sito come SPA e serve la radice `/` per ogni percorso che non corrisponde a un asset statico.                       | `createWebHistory()` funziona senza `_redirects`. La build **non** deve produrre `dist/404.html` (verifica in CI da M1).                                        |
| Cache predefinita                                                                                                                    | Asset in cache sulla CDN fino al deploy successivo; header `Cache-Control: public, max-age=0, must-revalidate` ed `ETag` con `304`. La documentazione sconsiglia cache personalizzate.         | Il browser rivalida `index.html` e `sw.js` a ogni richiesta: gli aggiornamenti della PWA vengono rilevati. Nessuna regola di cache custom necessaria.           |
| Redirect di estensione                                                                                                               | `/x.html` viene reindirizzato a `/x`, `/x/index.html` a `/x/`.                                                                                                                                 | Irrilevante: unica pagina `index.html`.                                                                                                                         |
| Header personalizzati ([Headers](https://developers.cloudflare.com/pages/configuration/headers/))                                    | File `_headers` nella cartella degli asset statici (per Vite: `public/`, copiato in `dist/`); al massimo 100 regole, al massimo 2 000 caratteri per riga; non si applica alle Pages Functions. | CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` in `public/_headers`. La CSP deve restare sotto i 2 000 caratteri. Non usiamo Functions. |
| Deploy da CI ([Direct Upload con CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)) | `cloudflare/wrangler-action@v4` con `pages deploy <dir> --project-name=<nome>`; secret `CLOUDFLARE_API_TOKEN` (permesso _Account › Cloudflare Pages › Edit_) e `CLOUDFLARE_ACCOUNT_ID`.        | Deploy da GitHub Actions **dopo** typecheck, lint, test, build ed E2E verdi (`ARCHITECTURE.md` § 12).                                                           |
| Limiti del piano gratuito ([Limits](https://developers.cloudflare.com/pages/platform/limits/))                                       | 20 000 file per sito, 25 MiB per asset, 500 build/mese (non usate con Direct Upload).                                                                                                          | Ampiamente compatibili con una SPA.                                                                                                                             |

Quanto sopra viene dalla documentazione, non da un deploy reale: la prova pratica (deploy, navigazione diretta su una route profonda, header, installazione della PWA) è un criterio di accettazione di M1.

## Decisione

- Hosting: **Cloudflare Pages**, progetto `ham-radio-toolbox`, in modalità **Direct Upload** da GitHub Actions. Il deploy parte solo da `main` e solo con pipeline verde; le anteprime per branch e PR sono opzionali (`--branch`).
- Routing: **`createWebHistory()`** con base `/`, affidandosi al fallback SPA di Pages (nessun `404.html` nell'output). Offline, la navigazione è servita dal service worker (`NavigationRoute` → `index.html`).
- Header di sicurezza in `public/_headers` (CSP definita in `ARCHITECTURE.md` § 11).
- Le credenziali Cloudflare esistono **solo** come secret di GitHub Actions: non entrano mai nel bundle (CON-04).
- Il dominio personalizzato è opzionale; di default si usa `*.pages.dev`.

## Alternative considerate

| Alternativa                                                        | Pro                         | Contro                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Integrazione Git di Cloudflare Pages (build sui server Cloudflare) | Nessun secret in GitHub     | La build avviene fuori dalla pipeline CI, quindi il deploy non è condizionato a test ed E2E verdi; ambiente Node da allineare |
| GitHub Pages                                                       | Integrato con il repository | Niente header personalizzati (CSP solo via `<meta>`), routing SPA con workaround, sottopercorso `/<repo>/`                    |
| Netlify                                                            | Header e rewrite            | Equivalente a Pages; nessun vantaggio specifico, scelta del maintainer per Cloudflare                                         |

## Conseguenze

- In M1 servono: creazione del progetto Pages, token API con permesso minimo, secret in GitHub, `public/_headers`, job di deploy e un controllo che la build non produca `404.html`.
- Le route profonde (es. `/ham-logbook/123`) funzionano anche al primo accesso senza service worker.
- Da riconfermare in M1: se un progetto Direct Upload si possa convertire in seguito all'integrazione Git (la documentazione consultata non lo dice). Non blocca nulla, perché la scelta è Direct Upload.
- Cambiare hosting in futuro costa poco (build statica). Abbandonare la history mode, invece, romperebbe i link salvati.
