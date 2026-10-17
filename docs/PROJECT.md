# Ham Radio Toolbox

**Version:** 1.0.0  
**Status:** Planning — Milestone M0  
**Platform:** Android Progressive Web Application  
**Architecture:** Local-first, offline-first  
**Primary language:** Italian (UI), English (source code)

---

## 1. Project Overview

Ham Radio Toolbox is a modular Progressive Web Application designed to transform an Android tablet into a comprehensive digital toolkit for amateur radio operators and Short Wave Listeners (SWL).

The application provides tools for amateur radio operations, radio listening, frequency management, signal identification, satellite tracking, propagation analysis, radio logging, and technical reference management.

The platform must work both in a home radio station (shack) and during portable or outdoor activities.

The first release is entirely client-side and must not require a dedicated backend server, radio gateway, Raspberry Pi, or physical connection to a transceiver.

Internet connectivity is optional for core features and required only for retrieving external information or accessing online services.

## 2. Project Objectives

The primary objectives are:

1. Develop a unified digital toolbox for amateur radio and SWL activities.
2. Provide an Android-first, touch-friendly user experience.
3. Support offline operation and local data persistence.
4. Implement a complete amateur radio QSO logbook.
5. Implement an SWL reception logbook supporting multiple radio services.
6. Integrate international broadcast frequency schedules.
7. Provide radio signal identification and satellite tracking tools.
8. Integrate DX Cluster, QSL, APRS, propagation and repeater resources.
9. Manage technical references and bookmarks.
10. Build a scalable architecture suitable for future extensions.

## 3. Target Users

### Amateur Radio Operators

Licensed amateur radio operators who require tools for:

- Logging radio contacts.
- Managing QSL confirmations.
- Consulting bands and propagation conditions.
- Tracking amateur radio satellites.
- Identifying callsigns and DX activity.
- Calculating RF parameters.
- Supporting portable radio activities.

### Short Wave Listeners

Radio listeners interested in:

- International broadcast stations.
- Amateur radio communication monitoring.
- Utility stations and time signals.
- Digital radio signals.
- Aeronautical communications.
- Maritime communications.
- Satellite signals.

### Radio and Electronics Enthusiasts

Users interested in:

- Radio frequency calculations.
- Radio signal identification.
- Technical documentation.
- Antenna design.
- Radio and electronics reference materials.

## 4. Technical Architecture

The application uses a modular, local-first architecture.

### Technology Stack

- Vue 3 with Composition API.
- TypeScript with strict type checking.
- Vite.
- Vue Router.
- Pinia.
- Tailwind CSS.
- IndexedDB with Dexie.js.
- Zod for schema validation.
- Workbox and vite-plugin-pwa.
- Leaflet with OpenStreetMap.
- satellite.js for orbital calculations.
- Vitest and Playwright for automated testing.
- ESLint and Prettier.
- GitHub Actions for CI/CD.

### Architecture Layers

**Presentation Layer**

Vue components, application layouts, forms, navigation, dashboards and visualizations.

**Application Layer**

Use cases, application services, state orchestration, validation and workflows.

**Domain Layer**

Business entities, domain rules, calculations and contracts.

**Infrastructure Layer**

IndexedDB persistence, import/export, offline storage and provider adapters.

**External Providers**

Optional connections to public data sources, radio services and external websites.

Domain logic must remain independent from the UI and infrastructure implementations.

## 5. Application Modules

### MOD-01 — Dashboard

The dashboard provides centralized access to all application modules.

Features:

- Touch-friendly navigation.
- HAM and SWL workspaces.
- Quick-access tools.
- Favorite modules.
- Offline/online status.
- Data freshness indicators.
- Dark and light themes.
- Responsive layouts.

### MOD-02 — HAM Logbook

A digital logbook for amateur radio contacts.

Features:

- Create, edit, delete and search QSO records.
- Callsign, frequency, band and operating mode.
- UTC timestamps.
- RST sent and received.
- Maidenhead locator.
- Country and station information.
- Notes and attachments.
- POTA/SOTA references.
- ADIF import and export.
- Statistics by band, mode, country and callsign.
- QSL confirmation tracking.

### MOD-03 — SWL Logbook

A reception logging system for Short Wave Listeners.

Supported categories:

1. International Broadcast.
2. Amateur Radio Monitoring.
3. Utility Stations and Time Signals.
4. Digital Modes.
5. Aeronautical Communications.
6. Maritime Communications.
7. Satellites.

Features:

- Reception date and time in UTC.
- Frequency and modulation.
- Station identification.
- Reception location.
- SINPO and RST reports.
- Notes and observations.
- Audio files and attachments.
- Category-specific metadata.
- Advanced filtering and statistics.
- CSV and JSON export.

### MOD-04 — Frequency Explorer

A searchable database of frequencies and radio services.

Features:

- International broadcast schedules.
- Frequency search.
- Station and country filters.
- Language and operating mode filters.
- UTC-based schedule queries.
- Seasonal schedule management.
- EiBi and HFCC file imports.
- Offline schedule consultation.
- Dataset provenance and update information.

### MOD-05 — Signal Explorer

A radio signal identification reference.

Features:

- Signal classifications.
- Modulation descriptions.
- Typical bandwidths.
- Frequency ranges.
- Signal characteristics.
- Audio and waterfall examples when licensed.
- Search and filtering.
- Reference links to signal databases.

Primary reference: SigIDWiki.

### MOD-06 — Satellite Explorer

Satellite tracking and reference system.

Features:

- Satellite catalog.
- CelesTrak orbital data import.
- SatNOGS transmitter information.
- TLE/OMM data management.
- Satellite pass predictions.
- AOS and LOS calculations.
- Azimuth and elevation.
- Ground tracks.
- Operating frequencies and modes.
- Satellite operational status.
- Offline predictions using previously downloaded data.

Orbital computations must clearly indicate data age and prediction limitations.

### MOD-07 — Resource Manager

Personal radio resource management system.

Features:

- Bookmark catalog.
- Raindrop.io HTML import.
- Categories and tags.
- Favorite resources.
- Search and filtering.
- External links.
- Technical documentation.
- Locally stored documents where permitted.
- Duplicate detection.
- Export and backup.

The initial reference collection is located at:

`docs/references/Ham_Radio.html`

### MOD-08 — DX Cluster

DX spotting and activity reference.

Features:

- External DX Cluster access.
- Spot filtering by callsign, frequency, band and mode.
- Favorite DX resources.
- Manual spot import where supported.
- Optional native integration when an authorized browser-compatible endpoint is available.

### MOD-09 — QSL Manager

QSL confirmation management.

Features:

- QSL sent, requested, received and confirmed states.
- Physical and electronic QSL records.
- Notes and attachments.
- QSL statistics.
- ADIF interoperability.
- External links to eQSL, LoTW and QRZ.

Automatic authenticated integrations are not mandatory for version 1.

### MOD-10 — APRS Explorer

APRS monitoring tools.

Features:

- APRS map access.
- Station bookmarks.
- Callsign lookup via permitted services.
- Station location references.
- Locator conversion.
- External APRS.fi integration.

### MOD-11 — Repeater Explorer

Radio repeater reference system.

Features:

- Repeater catalog.
- Frequency and mode information.
- Input/output frequencies.
- Tone information.
- Geographic search.
- Repeater maps.
- User-managed repeater records.
- External references to RepeaterBook and MapForHam.

External database imports must respect licensing and authorization requirements.

### MOD-12 — RF Calculators

A collection of technical radio frequency utilities.

Calculators include:

- Ohm's law.
- Electrical power.
- Watts/dBm conversion.
- Frequency/wavelength conversion.
- Dipole antenna length.
- Quarter-wave antenna length.
- SWR and reflection coefficient.
- Return loss.
- Cable attenuation.
- Geographic distance and bearing.
- Maidenhead locator conversion.
- UTC/local time conversion.

Calculators must function offline and include automated numerical tests.

### MOD-13 — Propagation

HF propagation information and prediction tools.

Features:

- Solar flux.
- Kp index.
- Solar and geomagnetic information.
- HF band conditions.
- MUF information where available.
- Propagation reference resources.
- Cached data with timestamps.
- Clear distinction between observations and forecasts.

### MOD-14 — Settings & Backup

Application configuration and data protection.

Features:

- Operator/SWL profile.
- Callsign and locator settings.
- Theme preferences.
- Measurement units.
- Offline storage status.
- Database management.
- Versioned JSON backup.
- Backup restoration.
- Import/export diagnostics.
- Data source management.

## 6. External Data Sources

Primary sources:

| Source       | Purpose                           |
| ------------ | --------------------------------- |
| EiBi         | International shortwave schedules |
| HFCC         | Broadcast schedules               |
| SigIDWiki    | Signal identification             |
| CelesTrak    | Satellite orbital elements        |
| SatNOGS      | Satellite transmitters            |
| HamQSL       | Solar and propagation references  |
| QRZ.com      | Callsign information              |
| eQSL.cc      | Electronic QSL                    |
| LoTW         | Log confirmations                 |
| APRS.fi      | APRS data and maps                |
| RepeaterBook | Repeater information              |
| MapForHam    | Repeater maps                     |
| WebSDR       | Remote receivers                  |
| Raindrop.io  | Personal bookmark collection      |

External integrations must respect API requirements, CORS, authentication, data licensing and usage policies.

The application must provide manual file import or external links when native integration is unavailable.

## 7. Data Management

Use IndexedDB through Dexie.js.

Principal data entities include:

- StationProfile
- QsoLog
- SwlReception
- ReceptionDetails
- Station
- Frequency
- BroadcastSchedule
- SignalType
- Satellite
- OrbitalElements
- SatelliteTransmitter
- SatellitePass
- DxSpot
- Repeater
- QslRecord
- Attachment
- Resource
- ResourceCategory
- DataSource
- ImportJob
- Settings

Data conventions:

- UUID identifiers.
- Frequencies stored in Hz.
- UTC timestamps.
- WGS84 geographic coordinates.
- Schema versioning.
- IndexedDB migrations.
- Referential validation at application level.
- Source attribution and licensing metadata.

## 8. Offline-First Requirements

The following must work without Internet:

- Dashboard and navigation.
- HAM Logbook.
- SWL Logbook.
- RF calculators.
- Maidenhead utilities.
- Imported frequency schedules.
- Locally stored signal references.
- Satellite calculations based on stored orbital data.
- Resource Manager with previously saved metadata.
- Backup and export.

Live data and external websites may require Internet access.

Offline operation must be tested on a real Android tablet.

## 9. Non-Functional Requirements

The system must provide:

- Responsive and touch-friendly interfaces.
- Reliable local data persistence.
- Fast startup and navigation.
- Clear error handling.
- Accessible UI components, targeting WCAG 2.2 AA.
- Type-safe application logic.
- Modular and maintainable source code.
- Automated tests.
- Versioned database migrations.
- Backup and restore validation.
- Protection against unsafe imported content.
- No frontend exposure of shared secrets.
- Clear presentation of data freshness.
- Proper handling of externally licensed data.

## 10. Development Roadmap

The project will be developed incrementally.

| Milestone | Scope                                                   |
| --------- | ------------------------------------------------------- |
| M0        | Requirements, architecture, database design and backlog |
| M1        | Vue PWA foundation and dashboard                        |
| M2        | IndexedDB persistence and repositories                  |
| M3        | HAM Logbook                                             |
| M4        | SWL Logbook                                             |
| M5        | Frequency Explorer and EiBi/HFCC imports                |
| M6        | RF calculators and locator utilities                    |
| M7        | Signal Explorer                                         |
| M8        | Satellite Explorer                                      |
| M9        | Resource Manager and Raindrop import                    |
| M10       | DX Cluster and QSL Manager                              |
| M11       | APRS and Repeater Explorer                              |
| M12       | Propagation tools                                       |
| M13       | Testing, offline verification, security and release     |

Estimated duration: 16 weeks, assuming approximately 10–12 development hours per week.

The schedule is provisional and must be refined after milestone task estimation.

Each milestone requires:

- Documented scope.
- Implementation tasks.
- Acceptance criteria.
- Relevant automated tests.
- Updated documentation.
- Successful production build.

## 11. Out of Scope — Version 1

The following features are explicitly excluded:

- Mandatory backend server.
- Raspberry Pi gateway.
- CAT transceiver control.
- PTT and radio transmission.
- Direct radio audio interfaces.
- Real-time SDR reception.
- Native DSP decoding engines.
- Automatic synchronization between multiple devices.
- Mandatory cloud accounts.
- Paid API dependencies without explicit approval.

These capabilities may be evaluated in future versions.

## 12. Definition of Done

Version 1.0 is considered complete when:

1. The application can be installed as a PWA on a supported Android tablet.
2. All planned modules are accessible.
3. Core offline functionality works correctly.
4. QSO and SWL records are persisted reliably.
5. Frequency importers pass validation tests.
6. Satellite calculations work with valid orbital datasets.
7. RF calculations pass automated numerical tests.
8. Resource Manager imports Raindrop bookmarks.
9. QSL, DX, APRS and repeater functionality operates within the documented integration scope.
10. Data export, backup and restoration are tested.
11. The production build succeeds.
12. Automated tests and Android acceptance tests pass.
13. User and technical documentation are complete.
14. Known limitations and external-provider restrictions are documented.

## 13. Future Evolution

Possible future enhancements include:

- Optional Laravel backend.
- Cross-device synchronization.
- Native Android packaging with Capacitor.
- CAT control through a radio gateway.
- SDR streaming.
- Digital mode decoding.
- Advanced propagation prediction.
- Integrated DX spot feeds.
- Expanded QSL service integrations.
- Multi-user features.

These features must not introduce unnecessary complexity into version 1.

---

## Project Status

**Current milestone:** M0 — Analysis and Design.

The development environment and initial Vue application foundation may already exist, but feature implementation must follow milestone approval and dependency order.

The immediate objective is to finalize requirements, architecture, data models, provider contracts and the development backlog before starting M1.
