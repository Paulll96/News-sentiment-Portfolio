# SentinelQuant Slide-by-Slide Deep Dive (Defense Study Edition)

Source baseline:
- `Presentation_Slides_v3.md`
- `README.md`
- `Backend_Architecture.txt`
- Backend code under `server/*`
- Frontend code under `client/src/*`
- `postman_collection.json`

Accuracy policy used in this document:
- No claim of Free/Pro feature enforcement in runtime routes.
- Admin-only routes are treated as non-core to the main portfolio pipeline.
- Testing and deployment statements are marked as "implemented", "observed in code", or "requires execution evidence".
- Formulas and thresholds are aligned with current implementation in `sentimentService.js` and `portfolioService.js`.

---

## Slide 1: Project Front Page
### Slide Purpose
Set identity and evaluation context in 20 seconds: what system, what domain, whose work.

### What This Slide Means (Conceptually)
SentinelQuant is not a generic stock app. It is a sentiment-to-allocation engine that connects NLP outputs to portfolio weight decisions.

### Exact Technical Mapping to Code
- Branding and route shell: `client/src/App.jsx`
- Sentiment core naming and model endpoint: `server/services/sentimentService.js`
- API identity: `/api` docs endpoint in `server/index.js`

### Data Flow / Formula / Logic Walkthrough
This slide has no formula. Flow summary to say:
1. News enters via scraper routes/cron.
2. FinBERT/mocked sentiment converts text to signal.
3. Quant engine computes target weights.
4. Portfolio holdings + transactions persist in PostgreSQL.

### What to Say in Defense (Speaker Script)
"Our project is SentinelQuant, a PERN-style financial intelligence system. It ingests market news, derives sentiment using FinBERT-compatible inference, and converts that into portfolio rebalance recommendations through a bounded quantitative allocation model."

### Likely Panel Questions + Strong Answers
- Q: "Is this live trading?"
  A: "No. Current implementation is simulation-only and writes to internal holdings and transaction tables; there is no broker API execution."
- Q: "Why NLP in a portfolio project?"
  A: "Because the strategy hypothesis is that new information appears in text before retail users can react manually."

### Common Mistakes / Risky Claims to Avoid
- Do not say "autonomous high-frequency trading".
- Do not claim broker integration.
- Do not claim paid tiers are enforced.

### Visual Guidance (what diagram/screenshot to show)
Simple title slide with subtitle and one pipeline strip: `Ingest -> Analyze -> Rebalance`.

### Cross-links to other slides
- Slide 2 (introduction pipeline)
- Slide 9 (system architecture)
- Slide 23/24 (quant allocation and threshold)

---

## Slide 2: Introduction
### Slide Purpose
Explain what SentinelQuant does end-to-end in plain language.

### What This Slide Means (Conceptually)
The product treats text as a market signal input, then applies deterministic math before any trade suggestion is generated.

### Exact Technical Mapping to Code
- Automated pipeline scheduling: `server/cron.js`
- Scrape orchestration: `server/scrapers/newsScraper.js#runAllScrapers`
- Sentiment inference + fallback: `server/services/sentimentService.js#analyzeSentiment`
- WSS computation: `server/services/sentimentService.js#calculateWSS`
- Rebalancing: `server/services/portfolioService.js#rebalancePortfolio`

### Data Flow / Formula / Logic Walkthrough
- Cron interval from `SCRAPE_INTERVAL_MINUTES`.
- Scraper merges multiple sources and saves deduped URLs to `news_articles`.
- Analyzer processes unprocessed articles and writes `sentiment_scores`.
- Sentiment summary per stock is computed as decayed weighted average.
- Portfolio service computes target weights from sentiment list.

### What to Say in Defense (Speaker Script)
"The introduction is our pipeline contract: source ingestion, sentiment extraction, then allocation math. The key is that each stage is decoupled in service modules so we can verify and debug each stage independently."

### Likely Panel Questions + Strong Answers
- Q: "Do you always use FinBERT cloud inference?"
  A: "If API key exists, yes. If unavailable or model loading persists, code falls back to a deterministic keyword mock so pipeline continuity is preserved."
- Q: "How fresh is data?"
  A: "By default cron runs every configured interval; freshness is bounded by scrape interval and source publication cadence."

### Common Mistakes / Risky Claims to Avoid
- Avoid saying every source is real-time streaming; most are polled.
- Avoid saying inference is guaranteed online; fallback exists.

### Visual Guidance (what diagram/screenshot to show)
3-box architecture: Scrape, Analyze, Rebalance with table names under each stage.

### Cross-links to other slides
- Slide 9 (block architecture)
- Slide 16 (cron-to-ingestion use case)
- Slide 20-22 (scoring formulas)

---

## Slide 3: Problem Statement
### Slide Purpose
Justify why automation + NLP are needed for portfolio decisions.

### What This Slide Means (Conceptually)
Retail users face timing and cognitive limits. The system removes subjective delay from reading and reacting to high-volume text streams.

### Exact Technical Mapping to Code
- Multi-source scraping and merge: `server/scrapers/newsScraper.js`
- Batch processing of unprocessed articles: `server/services/sentimentService.js#analyzeUnprocessedArticles`
- Portfolio rebalance trigger path: `server/routes/portfolio.js#POST /rebalance`

### Data Flow / Formula / Logic Walkthrough
Problem-to-solution chain:
1. Large text volume -> scraper fan-in.
2. Human interpretation latency -> machine inference call.
3. Emotional bias -> threshold-gated deterministic execution list.

### What to Say in Defense (Speaker Script)
"The problem is not just prediction; it is response speed and consistency. Our design converts textual events into bounded numeric influence and then acts only when drift exceeds configured significance."

### Likely Panel Questions + Strong Answers
- Q: "Are you proving market alpha?"
  A: "No guaranteed alpha claim. We provide a reproducible sentiment-driven decision framework and a backtest utility for evaluation."
- Q: "Does sentiment always lead price?"
  A: "Not always. The system is a decision support engine, not certainty inference."

### Common Mistakes / Risky Claims to Avoid
- Do not claim guaranteed profit.
- Do not claim institutional latency parity.

### Visual Guidance (what diagram/screenshot to show)
Three-column pain-point card: Overload, Delay, Bias mapped to automated module responses.

### Cross-links to other slides
- Slide 4 (objectives)
- Slide 30 (load/failure constraints)
- Slide 38 (conclusion boundaries)

---

## Slide 4: Project Objectives
### Slide Purpose
Define measurable engineering goals and where they are implemented.

### What This Slide Means (Conceptually)
Objectives are implementation targets, not slogans: ingestion reliability, scoring quality, mathematically bounded rebalancing, and transparent UI outputs.

### Exact Technical Mapping to Code
- Ingestion objective: `server/scrapers/newsScraper.js`
- Scoring objective: `server/services/sentimentService.js`
- Rebalancing objective: `server/services/portfolioService.js`
- Transparency objective: `client/src/pages/Dashboard.jsx`, `client/src/pages/Portfolio.jsx`

### Data Flow / Formula / Logic Walkthrough
- WSS bounded in `[-1, 1]`.
- Target weight blend uses `CONFIG.sentimentWeight` default `0.6`.
- Trade action only when `abs(target-current) >= REBALANCE_THRESHOLD` default `0.05`.

### What to Say in Defense (Speaker Script)
"Each objective maps to one module and one observable outcome: articles stored, sentiment scores generated, target weights produced, and suggested/committed trades visible in UI."

### Likely Panel Questions + Strong Answers
- Q: "What objective failed most often during development?"
  A: "External inference reliability; mitigated by retries plus mock fallback to preserve end-to-end flow."
- Q: "What objective is quantitatively configurable?"
  A: "Rebalance threshold and max position cap via env vars."

### Common Mistakes / Risky Claims to Avoid
- Do not claim objective completion without evidence.
- Avoid vague words like "optimized" without metric context.

### Visual Guidance (what diagram/screenshot to show)
Objective checklist with "module owner" and "observable output" columns.

### Cross-links to other slides
- Slide 8/8.1/8.2 (requirements)
- Slide 20-24 (algorithm implementation)

---

## Slide 5: Purpose and Need of the Project
### Slide Purpose
Show societal, technical, and academic reasons for building this system.

### What This Slide Means (Conceptually)
The project is a learning-grade but technically serious platform for reproducible sentiment-driven allocation workflows.

### Exact Technical Mapping to Code
- User-facing practicality: `client/src/pages/Portfolio.jsx`, `Dashboard.jsx`
- Technical integration complexity: `server/cron.js`, `sentimentService.js`, `portfolioService.js`
- Academic rigor from modular decomposition: distinct routes/services/scrapers/db layers

### Data Flow / Formula / Logic Walkthrough
Need pyramid mapping:
- User need -> dashboard and portfolio operations
- Technical need -> resilient API interaction, DB transactions
- Academic need -> explicit architecture boundaries

### What to Say in Defense (Speaker Script)
"The purpose is to demonstrate how unstructured text signals can be formalized into auditable portfolio decisions through transparent APIs and deterministic backend logic."

### Likely Panel Questions + Strong Answers
- Q: "Why not only chart-based indicators?"
  A: "Charts are lagging by design; we add event text as an additional leading context input."
- Q: "Is this production-ready risk management?"
  A: "It is prototype-grade with clear safeguards, not certified production brokerage infrastructure."

### Common Mistakes / Risky Claims to Avoid
- Avoid saying "institution-grade execution".
- Avoid saying "complete risk elimination".

### Visual Guidance (what diagram/screenshot to show)
Three-layer purpose pyramid: user, technical, academic with one code file under each.

### Cross-links to other slides
- Slide 7 (social relevance)
- Slide 38 (outcomes)

---

## Slide 6: Scope of the Project
### Slide Purpose
Define what the system does and does not do.

### What This Slide Means (Conceptually)
Scope control protects credibility. System supports paper-trading state updates, not real brokerage order placement.

### Exact Technical Mapping to Code
- In-scope sources: `server/scrapers/newsScraper.js`
- India market fallback: `server/services/sentimentService.js#isIndiaMarketNews`
- Simulation transactions: `server/services/portfolioService.js#executeTrades`
- Out-of-scope broker APIs: no Alpaca/Zerodha route/service files present

### Data Flow / Formula / Logic Walkthrough
Pipeline terminates at local DB transaction commits (`transactions`, `portfolio_holdings`) and API JSON response.

### What to Say in Defense (Speaker Script)
"Our scope ends at simulation-level rebalance execution inside PostgreSQL. We do not send market orders to any broker; this is intentional to avoid capital risk in an academic prototype."

### Likely Panel Questions + Strong Answers
- Q: "Can this be connected to brokers later?"
  A: "Yes, by adding an execution adapter layer after trade list generation and before DB commit."
- Q: "Why include `type='rebalance'` in schema when service uses buy/sell?"
  A: "Schema is extensible; current implementation writes explicit buy/sell for readability."

### Common Mistakes / Risky Claims to Avoid
- Do not imply live order execution exists.
- Do not imply compliance/regulatory certifications.

### Visual Guidance (what diagram/screenshot to show)
Two-column table: in-scope vs out-of-scope, each line tied to a real code anchor.

### Cross-links to other slides
- Slide 19 (transaction safety)
- Slide 32 (deployment model)

---

## Slide 7: Social Relevance and SDGs
### Slide Purpose
Map the project to SDG outcomes without exaggerating impact.

### What This Slide Means (Conceptually)
System improves transparency and financial literacy by making market-text-to-decision logic visible.

### Exact Technical Mapping to Code
- Literacy via visual analytics: `Dashboard.jsx`, `Sentiment.jsx`, `StockDetail.jsx`
- Infrastructure/innovation via AI + API + DB integration: `sentimentService.js`, `index.js`, `db/*`

### Data Flow / Formula / Logic Walkthrough
Societal relevance is in explainability path:
- News article -> sentiment score -> WSS -> target shift -> visible trade suggestion.

### What to Say in Defense (Speaker Script)
"Our SDG mapping is practical: we provide explainable analytics rather than opaque predictions, helping users understand signal processing and disciplined allocation behavior."

### Likely Panel Questions + Strong Answers
- Q: "How does this improve financial literacy?"
  A: "By exposing the intermediate states: article count, score, signal, and resulting allocation drift."
- Q: "What SDGs are directly addressed?"
  A: "SDG 8 and SDG 9 through accessible decision infrastructure and applied innovation." 

### Common Mistakes / Risky Claims to Avoid
- Avoid saying direct poverty reduction outcomes.
- Avoid saying regulatory investment advice compliance.

### Visual Guidance (what diagram/screenshot to show)
SDG icon pair with specific UI screenshot callouts (heatmap, sentiment table, rebalance preview).

### Cross-links to other slides
- Slide 11 (GUI explainability)
- Slide 34/35 (demo and screenshots)

---

## Slide 8: Software Requirement Specification (SRS)
### Slide Purpose
State platform prerequisites, actors, and baseline runtime constraints.

### What This Slide Means (Conceptually)
SRS is the contract between architecture and execution environment.

### Exact Technical Mapping to Code
- API server runtime assumptions: `server/index.js`
- Frontend runtime assumptions: `client/package.json`, Vite dev/build scripts
- DB requirement: `server/db/index.js`, `server/db/migrate.js`

### Data Flow / Formula / Logic Walkthrough
Runtime dependencies:
- Browser executes React SPA.
- SPA calls `/api/*` with optional Bearer token.
- Express validates and processes request.
- PostgreSQL persists state.

### What to Say in Defense (Speaker Script)
"The minimum operating envelope is Node.js runtime with PostgreSQL connectivity and modern browser support. Sentiment inference runs in cloud mode when Hugging Face key is configured, else mock fallback keeps the pipeline operable."

### Likely Panel Questions + Strong Answers
- Q: "Is model inference mandatory?"
  A: "No. It is preferred, but fallback mode is implemented for resilience and demos."
- Q: "Why PostgreSQL over NoSQL?"
  A: "Because transaction integrity and relational joins are central to holdings and ledger consistency."

### Common Mistakes / Risky Claims to Avoid
- Avoid saying complete offline FinBERT is present (not in current Node path).
- Avoid saying container orchestration is required (not required in local setup).

### Visual Guidance (what diagram/screenshot to show)
SRS matrix with columns: client runtime, server runtime, database runtime, external dependencies.

### Cross-links to other slides
- Slide 14 (tech stack)
- Slide 26 (env setup)

---

## Slide 8.1: Functional Requirements
### Slide Purpose
Tie each core requirement to one concrete implementation point.

### What This Slide Means (Conceptually)
FRs define observable behavior from user action to API response.

### Exact Technical Mapping to Code
- FR-Auth: `server/routes/auth.js`, `server/middleware/auth.js`
- FR-Ingest: `server/scrapers/newsScraper.js`, `server/routes/news.js`
- FR-Analyze: `server/services/sentimentService.js`, `server/routes/sentiment.js`
- FR-Import: `client/src/pages/Portfolio.jsx#parseHoldingsCsv`, `server/routes/portfolio.js#POST /import`
- FR-Rebalance: `server/services/portfolioService.js#rebalancePortfolio`

### Data Flow / Formula / Logic Walkthrough
FR example path (CSV import):
1. User uploads CSV.
2. `parseHoldingsCsv` normalizes rows.
3. API dry-run validates rows and quote fallback.
4. Commit mode writes holdings and transactions in transaction wrapper.

### What to Say in Defense (Speaker Script)
"Every FR in this table is demonstrable through one endpoint and one response object, making verification straightforward during viva demo."

### Likely Panel Questions + Strong Answers
- Q: "Can import run without prices?"
  A: "Only if live quote fetch succeeds; otherwise avgCost is required and explicit error code is returned."
- Q: "Does rebalance always execute trades?"
  A: "No, dry-run is default and threshold gating may return zero trades."

### Common Mistakes / Risky Claims to Avoid
- Do not claim all FRs are covered by automated tests.
- Do not claim real-time websockets are the only update path (HTTP polling is primary).

### Visual Guidance (what diagram/screenshot to show)
FR table with "route", "service function", and "sample payload" columns.

### Cross-links to other slides
- Slide 12 (API design)
- Slide 15-19 (use case paths)

---

## Slide 8.2: Non-Functional Requirements
### Slide Purpose
Explain resilience, security, consistency, and configurability constraints.

### What This Slide Means (Conceptually)
NFRs define quality of operation when things go wrong, not just when happy path works.

### Exact Technical Mapping to Code
- Resilience: `sentimentService.js` retry + mock fallback
- Security: `server/index.js` Helmet/CORS/rate-limits + JWT middleware
- Consistency: `server/db/index.js#transaction`
- Configurability: `.env.example`, `portfolioService.js` CONFIG

### Data Flow / Formula / Logic Walkthrough
Failure-handling flow:
- If 503 from HF -> wait 20s -> retry up to 3 -> fallback mock.
- If DB operation fails in transaction -> rollback entire bundle.

### What to Say in Defense (Speaker Script)
"We treated external model latency and DB consistency as first-class NFRs, because financial recommendation systems fail dangerously if partial writes or unstable inference states are not controlled."

### Likely Panel Questions + Strong Answers
- Q: "How do you prevent brute force?"
  A: "`/api/auth` and `/api/2fa` have dedicated stricter rate limiting; global API limiter applies to rest."
- Q: "What guarantees data consistency?"
  A: "Transaction wrapper with BEGIN/COMMIT/ROLLBACK around coupled writes."

### Common Mistakes / Risky Claims to Avoid
- Avoid claiming full HA/disaster recovery.
- Avoid claiming formal penetration testing completed.

### Visual Guidance (what diagram/screenshot to show)
NFR table plus small fallback sequence diagram for 503 handling.

### Cross-links to other slides
- Slide 19 (ACID flow)
- Slide 30 (load and fallback)

---

## Slide 9: System Architecture (Block Diagram)
### Slide Purpose
Present full runtime topology at system level.

### What This Slide Means (Conceptually)
The architecture is event-driven with two triggers: user-triggered REST and cron-triggered background pipeline.

### Exact Technical Mapping to Code
- Server composition and route mounting: `server/index.js`
- Cron trigger: `server/cron.js`
- Socket broadcasts: `server/socket.js`
- Persistence: `server/db/index.js`, `server/db/migrate.js`

### Data Flow / Formula / Logic Walkthrough
Two entry paths:
1. User path: React -> API route -> service -> DB.
2. Background path: cron -> scrapers -> sentiment analyzer -> DB -> optional socket broadcast.

### What to Say in Defense (Speaker Script)
"The architecture separates ingestion from scoring and from portfolio execution. This isolation avoids cascading failures and keeps modules independently testable."

### Likely Panel Questions + Strong Answers
- Q: "Is websocket required for functionality?"
  A: "No, websocket is auxiliary for live feed signals; REST endpoints are complete."
- Q: "Where is auth enforced?"
  A: "At route-level middleware; optional auth is used for public-plus-personalized sentiment views."

### Common Mistakes / Risky Claims to Avoid
- Do not claim microservices deployment; current implementation is modular monolith.
- Do not claim event queue broker (none present).

### Visual Guidance (what diagram/screenshot to show)
Block diagram with two trigger inputs and explicit DB tables touched by each path.

### Cross-links to other slides
- Slide 10 (module decomposition)
- Slide 16/17/18 (execution path details)

---

## Slide 10: Application Architecture Design (9 Modules)
### Slide Purpose
Show separation of concerns inside the backend/frontend application.

### What This Slide Means (Conceptually)
The same runtime can still be cleanly layered: interface, gateway, security, ingestion, preprocessing, intelligence, quant, execution, persistence.

### Exact Technical Mapping to Code
- Client interface: `client/src/App.jsx`, pages
- API gateway: `server/index.js`, route files
- Security: `server/middleware/auth.js`, rate limiter and helmet in `index.js`
- Data ingestion: `server/scrapers/newsScraper.js`, `stocktwitsScraper.js`
- Preprocessing: `detectStockMentions`, alias normalization in `sentimentService.js`
- Sentiment intelligence: `analyzeSentiment`, `calculateRawScore`, `calculateWSS`
- Quant engine: `calculateTargetWeights`, rebalance drift loop in `portfolioService.js`
- Trade execution: `executeTrades`
- Persistence: `server/db/index.js`, migration schema

### Data Flow / Formula / Logic Walkthrough
The strongest engineering point:
- Every layer has explicit inputs/outputs and can degrade gracefully (e.g., inference fallback does not break ingestion).

### What to Say in Defense (Speaker Script)
"Our nine-module decomposition reduced coupling and made debugging clear: if sentiment fails, we still know ingestion and storage status; if execution is dry-run, we still inspect target weights and drift decisions."

### Likely Panel Questions + Strong Answers
- Q: "Why not combine scraper and sentiment in one file?"
  A: "Separation allows independent retries, logging, and future replacement of model provider without scraper rewrite."
- Q: "Where is business logic concentrated?"
  A: "In services (`sentimentService`, `portfolioService`), not in route handlers."

### Common Mistakes / Risky Claims to Avoid
- Avoid saying all modules are independent deployables.
- Avoid saying CQRS/event-sourcing architecture if not implemented.

### Visual Guidance (what diagram/screenshot to show)
Layered 9-block flow from UI to DB with function names inside each block.

### Cross-links to other slides
- Slide 12 (API contract)
- Slide 13 (schema)
- Slide 15-19 (module use cases)

---

## Slide 11: GUI Design (Mockups)
### Slide Purpose
Connect UI design artifacts to actual implemented components.

### What This Slide Means (Conceptually)
The UI is not decorative only; it is the explanation layer for quantitative outputs and sentiment state.

### Exact Technical Mapping to Code
- Main shell and navigation: `client/src/App.jsx`
- Dashboard visuals (Recharts + heatmap cards): `client/src/pages/Dashboard.jsx`
- Sentiment table and scope controls: `client/src/pages/Sentiment.jsx`
- Portfolio workflows (import/add/rebalance): `client/src/pages/Portfolio.jsx`
- Detail drilldown: `client/src/pages/StockDetail.jsx`

### Data Flow / Formula / Logic Walkthrough
- Dashboard calls `/api/portfolio/dashboard`.
- Sentiment page calls `/api/sentiment` with timeframe/scope.
- Portfolio page drives `/initialize`, `/import`, `/rebalance`, `/holdings`.

### What to Say in Defense (Speaker Script)
"Mockup intent and implementation align: each major panel corresponds to one backend route family and displays directly computed values, not hardcoded static content."

### Likely Panel Questions + Strong Answers
- Q: "How do you handle loading states?"
  A: "Skeleton components are shown while API promises resolve; error state falls back to safe placeholders."
- Q: "How do users inspect one stock deeply?"
  A: "From heatmap/sentiment table, users route to `/stock/:symbol` for historical sentiment and recent analyzed articles."

### Common Mistakes / Risky Claims to Avoid
- Do not claim UI is websocket-only live.
- Do not claim all cards are fed by independent microservices.

### Visual Guidance (what diagram/screenshot to show)
Annotated collage: dashboard cards, heatmap, portfolio table, stock detail chart.

### Cross-links to other slides
- Slide 12 (API contract)
- Slide 35 (screenshots evidence)

---

## Slide 12: API Design
### Slide Purpose
Describe endpoint contract and auth flow.

### What This Slide Means (Conceptually)
REST API is the product backbone; each user feature maps to predictable endpoint behavior with JSON payloads.

### Exact Technical Mapping to Code
- Gateway mountpoints: `server/index.js`
- Request helper with token injection: `client/src/utils/api.js`
- Endpoint implementations: `server/routes/*`
- Sample requests: `postman_collection.json`

### Data Flow / Formula / Logic Walkthrough
- Auth flow: register/login -> JWT -> Bearer header for protected endpoints.
- Protected flows: portfolio ops, scrape trigger, analyze trigger, backtest, notifications, settings.
- Optional auth flow: sentiment/news listing can still work publicly.

### What to Say in Defense (Speaker Script)
"Our API follows resource-based routes with explicit auth boundaries. Frontend always uses a single fetch wrapper that injects Bearer token when present and normalizes errors into typed JavaScript exceptions."

### Likely Panel Questions + Strong Answers
- Q: "What happens on invalid token?"
  A: "Middleware returns 401/403; frontend auth context clears token on definitive auth failure during profile load."
- Q: "Any versioning strategy?"
  A: "Current version is single `/api` namespace; versioning can be introduced as `/api/v2` without UI architecture changes."

### Common Mistakes / Risky Claims to Avoid
- Avoid claiming GraphQL.
- Avoid claiming OpenAPI spec generation exists in repo.

### Visual Guidance (what diagram/screenshot to show)
Endpoint table grouped by domain: auth, sentiment, portfolio, news, backtest, supporting routes.

### Cross-links to other slides
- Slide 8.1 (functional requirements)
- Slide 28 (integration testing)

---

## Slide 13: Database Design
### Slide Purpose
Explain relational model and integrity strategy.

### What This Slide Means (Conceptually)
Relational tables anchor traceability: every recommendation and trade state can be audited historically.

### Exact Technical Mapping to Code
- Schema definitions and constraints: `server/db/migrate.js`
- Transaction helper: `server/db/index.js#transaction`
- Holdings + ledger write paths: `server/services/portfolioService.js`

### Data Flow / Formula / Logic Walkthrough
Core relationship chain:
- `news_articles` -> `sentiment_scores` (article-to-stock sentiment rows)
- `users` + `stocks` -> `portfolio_holdings`
- Rebalance execution writes `transactions` and updates `portfolio_holdings`

### What to Say in Defense (Speaker Script)
"We chose PostgreSQL because portfolio and ledger operations require relational integrity and rollback safety, especially when multiple rows must stay synchronized."

### Likely Panel Questions + Strong Answers
- Q: "What prevents duplicate articles?"
  A: "`news_articles.url` is unique and checked before insert."
- Q: "How is portfolio uniqueness enforced?"
  A: "`portfolio_holdings` has unique `(user_id, stock_id)` constraint."

### Common Mistakes / Risky Claims to Avoid
- Avoid saying strict serializable isolation level is configured (not explicitly set).
- Avoid claiming sharded database architecture.

### Visual Guidance (what diagram/screenshot to show)
ER diagram with table keys and relationship arrows for sentiment and portfolio modules.

### Cross-links to other slides
- Slide 19 (ACID persistence)
- Slide 32 (deployment DB hosting)

---

## Slide 14: Technology Stack
### Slide Purpose
Justify chosen technologies and their role in the architecture.

### What This Slide Means (Conceptually)
Stack selection supports async I/O, numeric processing, and rich visualization without unnecessary complexity.

### Exact Technical Mapping to Code
- Runtime deps: root `package.json`
- Frontend deps: `client/package.json`
- Security libs and usage: `server/index.js`
- NLP calls: `server/services/sentimentService.js`

### Data Flow / Formula / Logic Walkthrough
Each layer has one primary responsibility:
- React/Vite -> presentation and user interaction
- Express/Node -> orchestration and business logic
- PostgreSQL -> consistency and storage
- HF/TwelveData/Yahoo -> external data and inference providers

### What to Say in Defense (Speaker Script)
"We intentionally avoided heavy ORMs and used direct SQL through `pg` for transparency and control in a finance-oriented transaction workflow."

### Likely Panel Questions + Strong Answers
- Q: "Why not use ORM?"
  A: "Direct SQL kept migration and transaction behavior explicit for academic clarity."
- Q: "Why Vite?"
  A: "Faster local iteration and simpler modern React toolchain."

### Common Mistakes / Risky Claims to Avoid
- Avoid saying Kubernetes/microservice mesh is used.
- Avoid saying on-device NLP model inference exists.

### Visual Guidance (what diagram/screenshot to show)
Layered stack chart with logos and one-line role per tech.

### Cross-links to other slides
- Slide 8 (SRS)
- Slide 26 (environment and setup)

---

## Slide 15: Module Use Case (M1/M2) - Client to API Gateway
### Slide Purpose
Walk through user-initiated data entry path.

### What This Slide Means (Conceptually)
Data enters system through client validation before server validation, reducing noisy backend failures.

### Exact Technical Mapping to Code
- CSV parse: `client/src/pages/Portfolio.jsx#parseHoldingsCsv`
- Import endpoint: `server/routes/portfolio.js#POST /import`
- Row normalization/aggregation: `server/services/portfolioService.js#normalizeAndAggregateRows`, `aggregateRows`

### Data Flow / Formula / Logic Walkthrough
1. User uploads CSV.
2. Client parses headers and rows.
3. Dry-run import performs symbol resolution + quote lookup.
4. Commit replaces holdings and inserts import transactions.

### What to Say in Defense (Speaker Script)
"We use a preview-first import strategy to catch invalid rows and missing quote data before touching portfolio state."

### Likely Panel Questions + Strong Answers
- Q: "How are duplicate CSV rows handled?"
  A: "Rows are aggregated by `exchange|symbol` key and average cost recomputed for priced rows."
- Q: "What if symbol not in stocks table?"
  A: "It can be resolved through instrument master and created during non-dry-run path."

### Common Mistakes / Risky Claims to Avoid
- Do not claim arbitrary CSV schema support beyond declared headers.
- Do not claim import append mode (current release supports replace mode only).

### Visual Guidance (what diagram/screenshot to show)
Sequence diagram: User -> Portfolio UI -> `/api/portfolio/import` dryRun -> preview -> commit.

### Cross-links to other slides
- Slide 8.1 (FR import)
- Slide 18/19 (post-import rebalance and persistence)

---

## Slide 16: Module Use Case (M3/M4) - Security to Ingestion
### Slide Purpose
Show protected manual trigger and automated cron trigger.

### What This Slide Means (Conceptually)
System supports both operator-triggered and scheduled ingestion, each with security and robustness controls.

### Exact Technical Mapping to Code
- Manual trigger route: `server/routes/news.js#POST /scrape` (auth protected)
- Scheduler trigger: `server/cron.js#pipelineJob`
- Source fan-in: `runAllScrapers` in `newsScraper.js`

### Data Flow / Formula / Logic Walkthrough
- Cron schedule derived from env: every N minutes.
- Scraper runs `Promise.all` across NewsAPI, Google India RSS, Yahoo, Reddit, Stocktwits.
- Save deduped by URL.

### What to Say in Defense (Speaker Script)
"Ingestion can be run manually for demos, but real operation is cron-driven. Both paths call the same scraper orchestration function to avoid behavior drift."

### Likely Panel Questions + Strong Answers
- Q: "How do you avoid duplicate article rows?"
  A: "URL uniqueness and pre-insert check in `saveArticles`." 
- Q: "Any source-specific rate handling?"
  A: "Stocktwits scraper delays between symbols and handles 429 gracefully."

### Common Mistakes / Risky Claims to Avoid
- Avoid saying every source has OAuth integration.
- Avoid claiming perfect source uptime.

### Visual Guidance (what diagram/screenshot to show)
Dual-path diagram: manual API trigger vs cron trigger converging at `runAllScrapers`.

### Cross-links to other slides
- Slide 30 (load/retry behavior)
- Slide 34 (demo sequence manual trigger)

---

## Slide 17: Module Use Case (M5/M6) - Preprocessing to Sentiment Intelligence
### Slide Purpose
Explain how raw text becomes stock-linked sentiment rows.

### What This Slide Means (Conceptually)
Entity resolution quality determines whether sentiment can be attached to correct portfolio symbols.

### Exact Technical Mapping to Code
- Mention detection and regex tokenization: `server/scrapers/newsScraper.js#detectStockMentions`
- Name aliasing and macro India fallback: `server/services/sentimentService.js`
- Persistence write: `INSERT INTO sentiment_scores` in `analyzeUnprocessedArticles`

### Data Flow / Formula / Logic Walkthrough
1. Build text from title + content.
2. Run model inference and obtain sentiment scores/raw score.
3. Detect symbols by ticker patterns and company aliases.
4. If India macro news, restrict/map to NSE symbols.
5. Insert sentiment rows and mark article processed.

### What to Say in Defense (Speaker Script)
"We combine regex ticker detection with company-name alias matching to reduce missed mappings, and we use explicit macro-keyword fallback for India-wide market headlines."

### Likely Panel Questions + Strong Answers
- Q: "Why can one article map to multiple stocks?"
  A: "Because many headlines discuss sectors or comparisons; schema supports one article to many stock sentiment rows."
- Q: "How do you avoid repeated scoring of same article-stock pair?"
  A: "Insert query contains `WHERE NOT EXISTS` guard on `(article_id, stock_id)`."

### Common Mistakes / Risky Claims to Avoid
- Do not claim perfect NER accuracy.
- Do not claim full multilingual support.

### Visual Guidance (what diagram/screenshot to show)
Swimlane: Raw text -> symbol detection -> FinBERT/mock -> sentiment_scores insert.

### Cross-links to other slides
- Slide 20/21/22 (scoring math)
- Slide 25 (India fallback detail)

---

## Slide 18: Module Use Case (M7/M8) - Quant Engine to Execution
### Slide Purpose
Show decision mechanics from sentiment to trade queue.

### What This Slide Means (Conceptually)
Rebalance suggestions are generated only after target allocation and drift threshold checks.

### Exact Technical Mapping to Code
- Target weight function: `calculateTargetWeights` in `portfolioService.js`
- Drift filter and trade queue creation: loop in `rebalancePortfolio`
- Commit action: `executeTrades`

### Data Flow / Formula / Logic Walkthrough
- Sentiment normalization: `(wss + 1) / 2`
- Blend: `0.6 * sentimentWeight + 0.4 * equalWeight`
- Cap: `maxPositionPercent`
- Renormalize to sum to 1
- Queue trades when drift >= threshold

### What to Say in Defense (Speaker Script)
"The quant module is bounded and deterministic. Even high sentiment cannot exceed max position cap, and small drift is intentionally ignored to reduce churn."

### Likely Panel Questions + Strong Answers
- Q: "What if there is no sentiment for holdings?"
  A: "Fallback sentiment objects are created with WSS 0 and neutral signal so rebalance still functions."
- Q: "Can target weights exceed 100% total?"
  A: "No, final normalization enforces sum to 1."

### Common Mistakes / Risky Claims to Avoid
- Do not claim optimization solver or mean-variance model.
- Do not claim transaction-cost optimizer is implemented.

### Visual Guidance (what diagram/screenshot to show)
Decision flowchart with explicit threshold gate and dry-run vs execute branch.

### Cross-links to other slides
- Slide 23 (60/40 formula)
- Slide 24 (threshold logic)

---

## Slide 19: Module Use Case (M9) - ACID Persistence
### Slide Purpose
Demonstrate consistency control for coupled financial writes.

### What This Slide Means (Conceptually)
A trade log and holding update must commit together or not at all.

### Exact Technical Mapping to Code
- Transaction wrapper: `server/db/index.js#transaction`
- Trade insert + holdings upsert: `executeTrades` in `portfolioService.js`
- Import/add flows also wrapped in transaction blocks.

### Data Flow / Formula / Logic Walkthrough
Atomic write pattern:
1. BEGIN
2. Insert transaction row
3. Upsert holding value/weight/sentiment
4. COMMIT on success
5. ROLLBACK on any failure

### What to Say in Defense (Speaker Script)
"This module protects state integrity. Without transaction boundaries, ledger and holdings could diverge under partial failures."

### Likely Panel Questions + Strong Answers
- Q: "What if one trade in queue fails?"
  A: "Whole transaction rolls back; no partial portfolio mutation."
- Q: "How do you prove rollback behavior?"
  A: "By forcing a controlled SQL error in a staging run and verifying no rows are committed."

### Common Mistakes / Risky Claims to Avoid
- Avoid claiming distributed transactions.
- Avoid claiming serial execution across app instances (not implemented).

### Visual Guidance (what diagram/screenshot to show)
Commit/rollback branch diagram with affected tables.

### Cross-links to other slides
- Slide 13 (schema)
- Slide 31 (bug resolution and integrity)

---

## Slide 20: Algorithm 1 - FinBERT Raw Scoring
### Slide Purpose
Explain how model class probabilities are converted into one signed scalar.

### What This Slide Means (Conceptually)
Raw score balances polarity and discounts high-neutrality responses to avoid overreaction to bland text.

### Exact Technical Mapping to Code
- `server/services/sentimentService.js#calculateRawScore`
- Called by `analyzeSentiment`

### Data Flow / Formula / Logic Walkthrough
Formula in code:
`raw_score = (positive - negative) * (1 - neutral * 0.5)`

Interpretation:
- If positive > negative and neutral low -> strong positive raw score.
- If neutral high -> dampened magnitude.
- Output typically within [-1, 1] though clamped later at WSS stage.

### What to Say in Defense (Speaker Script)
"We intentionally dampen neutral-heavy outputs because financial headlines can be informational without directional bias; the multiplier prevents such text from dominating portfolio moves."

### Likely Panel Questions + Strong Answers
- Q: "Why not simple positive-negative?"
  A: "Neutral confidence carries useful uncertainty signal; damping increases robustness."
- Q: "Is this your own training?"
  A: "No retraining; this is post-processing over pre-trained model probabilities."

### Common Mistakes / Risky Claims to Avoid
- Do not claim custom finetuned model training.
- Do not claim this formula is industry standard.

### Visual Guidance (what diagram/screenshot to show)
Formula box plus one worked numeric example (e.g., pos 0.7 neg 0.1 neu 0.2).

### Cross-links to other slides
- Slide 21/22 (decay and normalization)
- Slide 17 (preprocessing and inference flow)

---

## Slide 21: Algorithm 2 - Exponential Time Decay
### Slide Purpose
Show how recency is mathematically prioritized in sentiment aggregation.

### What This Slide Means (Conceptually)
A headline from hours ago should influence decisions more than one from several days ago. The model should "forget" stale news gradually, not abruptly.

### Exact Technical Mapping to Code
- `server/services/sentimentService.js#calculateWSS`
- Weight computation line uses:
  `weight = Math.exp(-hoursAgo / (24 * days))`

### Data Flow / Formula / Logic Walkthrough
- For each sentiment row, compute article age in hours.
- Convert age to decay weight through negative exponential.
- Multiply `raw_score * weight` and accumulate.
- Recent rows have higher effective contribution.

### What to Say in Defense (Speaker Script)
"We use exponential decay because information relevance decays continuously in markets. This avoids binary cutoffs and gives smooth influence reduction over time."

### Likely Panel Questions + Strong Answers
- Q: "Why exponential instead of linear decay?"
  A: "Exponential better models rapid early relevance drop and long-tail residual relevance."
- Q: "Can decay horizon be tuned?"
  A: "Yes. The `days` parameter controls effective decay period in WSS calculation endpoints/services."

### Common Mistakes / Risky Claims to Avoid
- Do not claim this is a statistically validated alpha-optimal decay for all markets.
- Do not claim hard expiry of old news; it is asymptotic decay.

### Visual Guidance (what diagram/screenshot to show)
Plot with X=hours, Y=weight for 1d/3d/7d settings to show sensitivity.

### Cross-links to other slides
- Slide 20 (raw score generation)
- Slide 22 (final normalized WSS)

---

## Slide 22: Algorithm 3 - Weighted Sentiment Score (WSS) Normalization
### Slide Purpose
Explain how multiple decayed article scores become one bounded stock signal.

### What This Slide Means (Conceptually)
WSS is a weighted average with decay-based weights, so media volume alone does not directly dominate polarity.

### Exact Technical Mapping to Code
- `server/services/sentimentService.js#calculateWSS`
- Return object includes `{ wss, articleCount }`
- Signal classification uses `classifySignal` with threshold env.

### Data Flow / Formula / Logic Walkthrough
Formula implemented:
`wss = sum(raw_score * weight) / sum(weight)`
Then bounded by code:
`wss = max(-1, min(1, wss))`

### What to Say in Defense (Speaker Script)
"Normalization ensures we represent polarity, not just count. A stock with fewer but strongly consistent recent articles can still show strong WSS."

### Likely Panel Questions + Strong Answers
- Q: "What happens if no articles are available?"
  A: "Service returns `wss: 0` and `articleCount: 0`, which maps to neutral handling in downstream logic."
- Q: "What defines bullish/bearish?"
  A: "`SENTIMENT_SIGNAL_THRESHOLD` (default 0.1) in `classifySignal`."

### Common Mistakes / Risky Claims to Avoid
- Do not claim WSS predicts returns directly.
- Do not claim cross-asset comparability without calibration.

### Visual Guidance (what diagram/screenshot to show)
Simple weighted-average table: three rows with age, raw score, decayed weight, weighted contribution.

### Cross-links to other slides
- Slide 23 (target allocation)
- Slide 17 (how rows enter `sentiment_scores`)

---

## Slide 23: Algorithm 4 - Target Weight Allocation (60/40 Blend)
### Slide Purpose
Show portfolio construction from sentiment signals under diversification and cap constraints.

### What This Slide Means (Conceptually)
Sentiment influences allocation, but is blended with equal-weight baseline so no single sentiment spike fully dominates.

### Exact Technical Mapping to Code
- `server/services/portfolioService.js#calculateTargetWeights`
- Config values:
  - `sentimentWeight` default `0.6`
  - `maxPositionPercent` from env, default `25`

### Data Flow / Formula / Logic Walkthrough
Code behavior:
1. Convert each WSS from `[-1,1]` to `[0,1]`.
2. Normalize scores into sentiment weights.
3. Compute equal baseline `1 / N`.
4. Blend:
   `target = 0.6 * sentimentWeight + 0.4 * equalWeight`.
5. Cap each target by max position percent.
6. Renormalize all targets to sum to 1.

### What to Say in Defense (Speaker Script)
"The 60/40 blend is a risk-control design choice. It injects sentiment responsiveness while retaining structural diversification and hard caps."

### Likely Panel Questions + Strong Answers
- Q: "What if all article counts are zero?"
  A: "Function returns equal weights across provided symbols."
- Q: "Can one stock still dominate after renormalization?"
  A: "Only within `MAX_POSITION_PERCENT` cap before normalization; cap prevents extreme concentration."

### Common Mistakes / Risky Claims to Avoid
- Do not claim Markowitz/mean-variance optimization.
- Do not claim covariance-aware portfolio optimizer.

### Visual Guidance (what diagram/screenshot to show)
Before/after table: WSS, normalized sentiment weight, equal weight, blended target, capped target.

### Cross-links to other slides
- Slide 24 (threshold to trade)
- Slide 18 (quant use case)

---

## Slide 24: Algorithm 5 - Rebalance Threshold Logic
### Slide Purpose
Explain why not every allocation difference results in a trade.

### What This Slide Means (Conceptually)
Threshold gating prevents micro-adjustments that create churn and noise.

### Exact Technical Mapping to Code
- `server/services/portfolioService.js#rebalancePortfolio`
- Threshold config:
  - `rebalanceThreshold` from env, default `0.05`

### Data Flow / Formula / Logic Walkthrough
Per symbol:
- `weightDiff = targetWeight - currentWeight`
- If `abs(weightDiff) >= threshold` then queue trade.
- Trade value computed as `weightDiff * portfolioValue`.
- Type derived from sign (`buy` or `sell`).

### What to Say in Defense (Speaker Script)
"Thresholding is intentional friction. It ensures trade suggestions represent meaningful allocation changes, not random oscillation."

### Likely Panel Questions + Strong Answers
- Q: "Can threshold be changed without code edits?"
  A: "Yes, via `.env` using `REBALANCE_THRESHOLD`."
- Q: "Is threshold percentage or absolute amount?"
  A: "It is a portfolio weight fraction (e.g., 0.05 equals 5% weight drift)."

### Common Mistakes / Risky Claims to Avoid
- Do not call this transaction-cost optimization model.
- Do not claim broker fee simulation exists in current code.

### Visual Guidance (what diagram/screenshot to show)
Decision tree with two branches: execute vs skip based on absolute drift.

### Cross-links to other slides
- Slide 18 (trade queue creation)
- Slide 31 (bug/risk controls)

---

## Slide 25: Procedure - Entity Extraction and India Fallback
### Slide Purpose
Describe fallback behavior when direct symbol tags are absent in text.

### What This Slide Means (Conceptually)
Market-wide India headlines can still be useful for NSE-focused portfolios even without explicit ticker mentions.

### Exact Technical Mapping to Code
- Macro India detector: `server/services/sentimentService.js#isIndiaMarketNews`
- Mention detection: `server/scrapers/newsScraper.js#detectStockMentions`
- NSE prioritization logic in `analyzeUnprocessedArticles`

### Data Flow / Formula / Logic Walkthrough
- Detect direct mentions first.
- If India macro terms found and no direct NSE symbol mention:
  - Build prioritized NSE symbol list from held + tracked NSE symbols.
  - Assign article sentiment to up to N prioritized symbols.

### What to Say in Defense (Speaker Script)
"This fallback improves coverage of regional macro headlines, but we keep it constrained to NSE symbols to avoid cross-market misassignment."

### Likely Panel Questions + Strong Answers
- Q: "Is fallback perfect?"
  A: "No. It is a controlled heuristic to reduce missed signal coverage, not a full semantic entity linker."
- Q: "Could this introduce noise?"
  A: "Yes, potentially. That is why recency weighting and threshold gating downstream reduce overreaction risk."

### Common Mistakes / Risky Claims to Avoid
- Do not claim enterprise-grade NER.
- Do not claim exact company-level mapping on all macro headlines.

### Visual Guidance (what diagram/screenshot to show)
Swimlane with three outcomes: direct map, macro fallback map, discard.

### Cross-links to other slides
- Slide 17 (preprocessing flow)
- Slide 22 (WSS smoothing effect)

---

## Slide 26: Coding Standards, Environment Setup, and Source Control
### Slide Purpose
Show engineering hygiene and reproducibility controls.

### What This Slide Means (Conceptually)
Stable behavior depends on coding conventions, environment separation, and disciplined repository workflows.

### Exact Technical Mapping to Code
- Env template: `.env.example`
- Server entry + middleware order: `server/index.js`
- DB migration command: `npm run db:migrate` in root `package.json`
- Frontend scripts: `client/package.json`

### Data Flow / Formula / Logic Walkthrough
- Env controls runtime constants (`JWT_SECRET`, provider keys, thresholds).
- Migrations create required schema and indexes before app execution.
- Dev scripts start API and UI separately.

### What to Say in Defense (Speaker Script)
"Configuration is externalized to `.env`, and all critical runtime assumptions are documented in `.env.example` plus migration scripts. This keeps code portable across local and cloud environments."

### Likely Panel Questions + Strong Answers
- Q: "What module style is backend using?"
  A: "CommonJS (`require/module.exports`)."
- Q: "How do you avoid committing secrets?"
  A: "By using `.env` and keeping only placeholders in `.env.example`."

### Common Mistakes / Risky Claims to Avoid
- Do not claim CI pipeline exists unless you show workflow files.
- Do not claim secret manager integration is implemented.

### Visual Guidance (what diagram/screenshot to show)
Checklist with setup steps: env file, migrate DB, run backend, run frontend.

### Cross-links to other slides
- Slide 8 (SRS runtime)
- Slide 32 (deployment variables)

---

## Slide 27: Unit Testing (for Core Functions)
### Slide Purpose
Present unit-level validation status honestly and define what is covered vs pending.

### What This Slide Means (Conceptually)
Unit testing should isolate deterministic functions (math, parsing, classification) from network and DB variability.

### Exact Technical Mapping to Code
High-value unit candidates in current code:
- `calculateRawScore` (`sentimentService.js`)
- `classifySignal` (`sentimentService.js`)
- `calculateTargetWeights` (`portfolioService.js`)
- `parseCsvLine` / `parseHoldingsCsv` (`Portfolio.jsx` client-side)
- `detectStockMentions` (`newsScraper.js`)

### Data Flow / Formula / Logic Walkthrough
Current repo evidence:
- No dedicated automated test suite files (`*.test.*` / `*.spec.*`) found.
- Unit test design can still be shown as planned deterministic cases with expected outputs.

### What to Say in Defense (Speaker Script)
"We identified deterministic units and validated behavior during development runs, but a formal automated unit test suite is still a planned improvement and should be stated transparently."

### Likely Panel Questions + Strong Answers
- Q: "Do you have Jest/Vitest reports?"
  A: "Not in the current repository snapshot; we present unit test cases and expected outcomes as verification matrix."
- Q: "Which function is easiest to unit test first?"
  A: "`calculateRawScore` and `calculateTargetWeights` because they are pure functions."

### Common Mistakes / Risky Claims to Avoid
- Do not claim CI-backed unit test pass percentage.
- Do not claim coverage metrics without reports.

### Visual Guidance (what diagram/screenshot to show)
Unit-test matrix table with `function`, `input`, `expected`, `status` (designed/executed manually/automated pending).

### Cross-links to other slides
- Slide 20-24 (algorithms to test)
- Slide 31 (defect prevention)

---

## Slide 28: Integration Testing
### Slide Purpose
Verify interaction between routes, services, DB, and external inference calls.

### What This Slide Means (Conceptually)
Integration quality is about pipeline continuity under real dependencies and partial failures.

### Exact Technical Mapping to Code
- API contracts: `postman_collection.json`
- Core integrated routes: `server/routes/auth.js`, `portfolio.js`, `sentiment.js`, `news.js`
- DB layer: `server/db/index.js`
- External dependency integration: `sentimentService.js` (HF), `quoteService.js`, scrapers

### Data Flow / Formula / Logic Walkthrough
Representative integrated path:
1. Login route returns JWT.
2. Authenticated rebalance route invokes portfolio service.
3. Portfolio service reads holdings + sentiments.
4. On execute mode, writes transactions and holdings in DB transaction.

### What to Say in Defense (Speaker Script)
"Integration testing focus is route-to-service-to-database flow stability, especially around auth middleware and external service error conditions like 503."

### Likely Panel Questions + Strong Answers
- Q: "Is Postman collection enough as proof?"
  A: "It defines repeatable requests, but execution logs/screenshots should be shown as evidence in final defense."
- Q: "What failure path did you integrate-test?"
  A: "Inference unavailability fallback path and protected-route auth rejection path."

### Common Mistakes / Risky Claims to Avoid
- Do not claim automated integration test runner exists if absent.
- Do not claim full third-party SLA coverage.

### Visual Guidance (what diagram/screenshot to show)
Integration sequence: client request -> middleware -> service -> DB/external API -> response.

### Cross-links to other slides
- Slide 12 (API design)
- Slide 30 (failure and load behavior)

---

## Slide 29: Functional Testing (E2E Behavior)
### Slide Purpose
Show user-centric scenarios and expected outcomes from UI through backend.

### What This Slide Means (Conceptually)
Functional testing validates business behavior, not just endpoint response shapes.

### Exact Technical Mapping to Code
- Scenario pages: `Dashboard.jsx`, `Portfolio.jsx`, `Sentiment.jsx`, `News.jsx`
- Scenario endpoints: `/api/portfolio/*`, `/api/sentiment*`, `/api/news*`

### Data Flow / Formula / Logic Walkthrough
Key scenarios to present:
1. New user login -> empty dashboard state.
2. CSV import preview -> rejected row handling -> commit replace.
3. Rebalance preview -> execute -> holdings/transactions update.
4. Sentiment scope toggles and stock detail drilldown.

### What to Say in Defense (Speaker Script)
"Functional checks follow real user journeys and validate both normal and edge states, including empty portfolios, missing quotes, and no-sentiment situations."

### Likely Panel Questions + Strong Answers
- Q: "How do you verify UI reacted to backend changes?"
  A: "By comparing dashboard allocation/performance/heatmap before and after import or rebalance execution."
- Q: "Do you have scripted browser tests?"
  A: "Not yet in repository; current evidence is manual runbook with reproducible steps."

### Common Mistakes / Risky Claims to Avoid
- Do not claim Cypress/Playwright suite if absent.
- Do not claim full accessibility audit completed.

### Visual Guidance (what diagram/screenshot to show)
E2E runbook table with `Step`, `Expected`, `Observed`, `Evidence artifact` columns.

### Cross-links to other slides
- Slide 11 (GUI mapping)
- Slide 34 (live demo runbook)

---

## Slide 30: Load Testing / Concurrency Behavior
### Slide Purpose
Explain current concurrency controls and realistic load limits.

### What This Slide Means (Conceptually)
System includes defensive controls (rate limits, retries, delays) but does not yet include a formal stress benchmark suite.

### Exact Technical Mapping to Code
- Rate limit config: `server/index.js` (`authLimiter`, `apiLimiter`)
- Inference retries and fallback: `sentimentService.js`
- Stocktwits pacing: `stocktwitsScraper.js` delay between symbols

### Data Flow / Formula / Logic Walkthrough
- Auth endpoints capped at 100 requests/15 min.
- General API capped at 1000 requests/15 min (with auth routes skipped from this broader limiter).
- 503 model loading path retries up to 3 times then falls back.

### What to Say in Defense (Speaker Script)
"We implemented protective concurrency controls and graceful degradation. Formal load benchmark scripts are a next step for quantitative throughput limits."

### Likely Panel Questions + Strong Answers
- Q: "Can it handle 100 concurrent users?"
  A: "We designed controls for resilience but do not claim validated throughput numbers without explicit load test reports."
- Q: "What happens under provider throttling?"
  A: "The code degrades to fallback sentiment and continues pipeline execution."

### Common Mistakes / Risky Claims to Avoid
- Do not claim k6/JMeter results unless you show logs.
- Do not claim autoscaling logic is implemented in code.

### Visual Guidance (what diagram/screenshot to show)
Rate-limiter + retry flow chart with "degrade gracefully" path.

### Cross-links to other slides
- Slide 8.2 (NFR resilience)
- Slide 31 (bug fixes tied to reliability)

---

## Slide 31: Bug Report and Resolution (Table Format)
### Slide Purpose
Demonstrate engineering maturity through defect discovery and controlled fixes.

### What This Slide Means (Conceptually)
A good defense explicitly separates observed issues, root causes, fixes, and current status.

### Exact Technical Mapping to Code
Examples grounded in code behavior:
- HF 503 cold start fallback in `sentimentService.js`
- Missing quote import failure handling in `portfolioService.js` (`AVG_COST_REQUIRED_NO_QUOTE`)
- Duplicate article suppression in `newsScraper.js` URL check
- Transaction rollback safety in `db/index.js`

### Data Flow / Formula / Logic Walkthrough
Use a bug log table with columns:
`Bug ID | Trigger | Symptom | Root Cause | Fix | Verification | Status`

### What to Say in Defense (Speaker Script)
"We treated defects as data: we captured trigger conditions, patched at module boundary, and re-validated the full flow to ensure no regression in adjacent modules."

### Likely Panel Questions + Strong Answers
- Q: "Which bug had highest impact?"
  A: "Inference unavailability was highest impact because it could stall analysis; fallback path removed hard-stop behavior."
- Q: "Any unresolved critical bugs?"
  A: "No known critical blockers for core demo flow, but formal load/perf validation remains pending evidence."

### Common Mistakes / Risky Claims to Avoid
- Do not say "zero bugs".
- Do not claim bug fix without showing changed logic and verification step.

### Visual Guidance (what diagram/screenshot to show)
Formal bug table with at least 4 concrete rows and status tags.

### Cross-links to other slides
- Slide 27-30 (testing and reliability)
- Slide 38 (final outcomes and limits)

---

## Slide 32: Deployment (Cloud Details)
### Slide Purpose
Present target cloud topology and what is currently implementation-ready.

### What This Slide Means (Conceptually)
Deployment architecture is decoupled: static frontend, API service, managed DB, external AI endpoint.

### Exact Technical Mapping to Code
- Server runtime assumptions and CORS config: `server/index.js`
- Build scripts: root `package.json`, `client/package.json`
- Env dependencies: `.env.example`

### Data Flow / Formula / Logic Walkthrough
Proposed deployment path:
1. Build frontend (`client/dist`) and host on CDN/static host.
2. Host Node API on managed service.
3. Connect managed PostgreSQL.
4. Configure env secrets for JWT/API keys.

### What to Say in Defense (Speaker Script)
"The architecture is deployment-ready in structure, but production deployment claims should be tied to actual environment evidence (URLs, logs, health checks)."

### Likely Panel Questions + Strong Answers
- Q: "Is it deployed right now?"
  A: "State exactly: local/staging/prod based on your current evidence. If no live URL evidence, present this as target deployment topology."
- Q: "Any migrations on deploy?"
  A: "Yes, database migration script is available and should be run before first app start."

### Common Mistakes / Risky Claims to Avoid
- Do not claim live production unless link and health endpoint are shown.
- Do not claim managed secrets rotation is configured unless done.

### Visual Guidance (what diagram/screenshot to show)
Cloud topology diagram with service icons and environment variable boundary box.

### Cross-links to other slides
- Slide 26 (env setup)
- Slide 36 (cost model)

---

## Slide 33: Status of Work and Individual Contributions
### Slide Purpose
Provide honest project completion status and team ownership mapping.

### What This Slide Means (Conceptually)
Assessment expects both technical completeness and accountability by contributor.

### Exact Technical Mapping to Code
Suggested contribution map by subsystem:
- Auth/security/routes: `server/index.js`, `routes/auth.js`, middleware
- Ingestion/intelligence: `scrapers/*`, `sentimentService.js`
- Quant/portfolio: `portfolioService.js`, `routes/portfolio.js`
- Frontend and UX: `client/src/pages/*`, `App.jsx`

### Data Flow / Formula / Logic Walkthrough
Status framing template:
- Core pipeline: implemented
- Reliability hardening: implemented with known limits
- Formal automated test suite: pending/partial
- Production deployment evidence: pending or done (state accurately)

### What to Say in Defense (Speaker Script)
"We mapped responsibilities by module and can trace each major feature to owned files and commits. Current status is core-complete for demo, with formal automation/perf evidence as next iteration."

### Likely Panel Questions + Strong Answers
- Q: "Who handled algorithm design?"
  A: "Name person + point to `portfolioService.js` and `sentimentService.js` sections."
- Q: "How did you coordinate merges?"
  A: "Use your actual branch flow; keep answer factual (feature branches + PR or direct merge)."

### Common Mistakes / Risky Claims to Avoid
- Do not assign vague roles like "everything by everyone".
- Do not claim completed tasks without file-level evidence.

### Visual Guidance (what diagram/screenshot to show)
Responsibility matrix table: module, owner, file evidence, completion status.

### Cross-links to other slides
- Slide 34 (demo ownership)
- Slide 37 (schedule execution)

---

## Slide 34: Demonstration of Working Model
### Slide Purpose
Define a deterministic live demo run order that minimizes failure risk.

### What This Slide Means (Conceptually)
A strong demo proves the complete loop from authenticated user action to data mutation and UI reflection.

### Exact Technical Mapping to Code
Demo path components:
- Login: `AuthContext.jsx` + `/api/auth/login`
- News scrape/analyze: `News.jsx`, `/api/news/scrape`, `/api/sentiment/analyze`
- Dashboard update: `/api/portfolio/dashboard`
- Rebalance preview/execute: `/api/portfolio/rebalance`

### Data Flow / Formula / Logic Walkthrough
Recommended demo script:
1. Login.
2. Open News and trigger scrape.
3. Trigger analyze.
4. Open Sentiment and show updated rows.
5. Open Portfolio and run rebalance preview.
6. Execute rebalance and show transactions.
7. Return Dashboard to show changed allocation.

### What to Say in Defense (Speaker Script)
"The demo intentionally follows data dependency order so each stage has fresh inputs: scrape first, analyze second, then rebalance and dashboard verification."

### Likely Panel Questions + Strong Answers
- Q: "What if inference API is down during demo?"
  A: "Fallback sentiment mode keeps pipeline runnable; we can still demonstrate control flow and state transitions."
- Q: "How do you prove trade commit happened?"
  A: "Show transaction list endpoint response and updated holdings in portfolio table."

### Common Mistakes / Risky Claims to Avoid
- Do not random-click flows without sequencing.
- Do not rely on unstable network call as first demo step without fallback narrative.

### Visual Guidance (what diagram/screenshot to show)
Step-by-step runbook slide with expected output checkpoint per step.

### Cross-links to other slides
- Slide 12 (API routes used)
- Slide 35 (screenshots from this flow)

---

## Slide 35: Screenshots
### Slide Purpose
Provide visual evidence artifacts for key workflows.

### What This Slide Means (Conceptually)
Screenshots should validate claims made in architecture and algorithm slides.

### Exact Technical Mapping to Code
Capture targets:
- Dashboard charts and heatmap: `Dashboard.jsx`
- News scrape + analyzed badges: `News.jsx`
- Portfolio rebalance suggestions and holdings: `Portfolio.jsx`
- Stock detail history and recent sentiment: `StockDetail.jsx`

### Data Flow / Formula / Logic Walkthrough
Screenshot set should correspond to one complete run instance:
- Before scrape/analyze
- After analyze (sentiment populated)
- Before/after rebalance execution

### What to Say in Defense (Speaker Script)
"Each screenshot maps to a specific API-backed state transition, so visual evidence is not static design but runtime proof."

### Likely Panel Questions + Strong Answers
- Q: "Are screenshots from your build?"
  A: "Yes, from the same codebase and route flow shown in demo runbook."
- Q: "Can you show logs too?"
  A: "Yes, include backend terminal snapshots for scrape/analyze cycle timestamps."

### Common Mistakes / Risky Claims to Avoid
- Do not use mockups where runtime screenshots are expected.
- Do not include screenshots with inconsistent data timeline.

### Visual Guidance (what diagram/screenshot to show)
Three-panel collage: UI state, API/console evidence, DB/transaction evidence.

### Cross-links to other slides
- Slide 34 (demo steps)
- Slide 31 (bug verification evidence)

---

## Slide 36: Project Budget
### Slide Purpose
Quantify prototype operating cost assumptions and constraints.

### What This Slide Means (Conceptually)
Academic prototype can run at near-zero recurring cost using free tiers, with clear caveats about limits.

### Exact Technical Mapping to Code
Cost-driving components in code:
- External inference calls: `sentimentService.js`
- Quote providers: `quoteService.js`
- API and DB runtime dependency from `server/index.js` and `db/index.js`

### Data Flow / Formula / Logic Walkthrough
Budget model categories:
- Frontend hosting
- Backend hosting
- DB hosting
- Inference API
- Optional market data API

State budget as "estimated for prototype usage" rather than guaranteed fixed monthly value.

### What to Say in Defense (Speaker Script)
"For academic scale, we can operate on free/hobby tiers, but production-scale usage would require paid plans due to request and compute limits."

### Likely Panel Questions + Strong Answers
- Q: "Is cost always $0?"
  A: "Only within free-tier quotas and low usage; scaling increases cost."
- Q: "Which cost increases first?"
  A: "Usually model inference and backend compute under frequent scraping and analysis."

### Common Mistakes / Risky Claims to Avoid
- Do not guarantee zero cost at all usage levels.
- Do not ignore external API quota limits.

### Visual Guidance (what diagram/screenshot to show)
Budget table with "prototype", "scaled", and "risk" columns.

### Cross-links to other slides
- Slide 32 (deployment)
- Slide 30 (load behavior and limits)

---

## Slide 37: Project Scheduling (Detailed Timeline / Gantt)
### Slide Purpose
Show phased planning and execution traceability.

### What This Slide Means (Conceptually)
A schedule demonstrates engineering process discipline from research to delivery.

### Exact Technical Mapping to Code
Suggested phase-to-artifact mapping:
- Phase A research: slide/references and architecture notes
- Phase B backend + DB: `server/db/*`, `server/index.js`, route skeletons
- Phase C ingestion + sentiment: `scrapers/*`, `sentimentService.js`
- Phase D portfolio quant: `portfolioService.js`, `routes/portfolio.js`
- Phase E frontend: `client/src/pages/*`, `App.jsx`
- Phase F validation/docs: `Presentation_Slides_v3.md`, docs folder

### Data Flow / Formula / Logic Walkthrough
Use 12-week sample with milestones:
1. Requirements freeze
2. Schema + auth complete
3. Scraper + analyzer complete
4. Quant rebalance complete
5. UI integration complete
6. Validation and defense prep complete

### What to Say in Defense (Speaker Script)
"Our schedule tracked dependency order: data model before services, services before UI integration, and only then validation and defense packaging."

### Likely Panel Questions + Strong Answers
- Q: "Which phase slipped?"
  A: "Usually external integration and reliability hardening. Show how retries/fallback were added after observing failures."
- Q: "How did schedule affect scope?"
  A: "It forced us to keep broker execution out-of-scope for stable academic delivery."

### Common Mistakes / Risky Claims to Avoid
- Do not present unrealistically parallel phases.
- Do not hide deferred items (automation/perf evidence).

### Visual Guidance (what diagram/screenshot to show)
Gantt chart with phase bars and milestone markers.

### Cross-links to other slides
- Slide 6 (scope decisions)
- Slide 33 (status and ownership)

---

## Slide 38: Conclusion
### Slide Purpose
Summarize achievements and boundaries in one precise closing argument.

### What This Slide Means (Conceptually)
Project validates feasibility of converting financial text sentiment into disciplined portfolio rebalancing recommendations.

### Exact Technical Mapping to Code
- Feasibility proof modules: `newsScraper.js`, `sentimentService.js`, `portfolioService.js`, `Dashboard.jsx`

### Data Flow / Formula / Logic Walkthrough
Closing chain:
- Multi-source text ingest
- Scored sentiment with recency decay
- Bounded allocation and thresholded trade logic
- Persistent auditable state and visual reporting

### What to Say in Defense (Speaker Script)
"SentinelQuant demonstrates an end-to-end, explainable sentiment-driven allocation engine. It is robust as an academic prototype and clearly identifies next steps for production-grade validation."

### Likely Panel Questions + Strong Answers
- Q: "What is the biggest next milestone?"
  A: "Automated testing and formal performance benchmarking with reproducible reports."
- Q: "Can this become live-trading?"
  A: "Yes, with additional execution adapters, compliance controls, and risk guardrails."

### Common Mistakes / Risky Claims to Avoid
- Do not claim final production readiness.
- Do not claim statistically proven outperformance from current evidence set.

### Visual Guidance (what diagram/screenshot to show)
Single summary slide with 4 completed pillars and 3 next-step pillars.

### Cross-links to other slides
- Slide 3 (problem)
- Slide 4 (objectives)
- Slide 39 (references)

---

## Slide 39: Bibliography
### Slide Purpose
Provide primary references for model, frameworks, and data platform decisions.

### What This Slide Means (Conceptually)
References demonstrate that methodology and implementation choices are grounded in credible technical sources.

### Exact Technical Mapping to Code
- FinBERT model usage: `sentimentService.js` API endpoint points to `ProsusAI/finbert`
- Framework docs used in implementation:
  - Node.js / Express
  - PostgreSQL
  - React / Recharts
  - Hugging Face Inference API

### Data Flow / Formula / Logic Walkthrough
No runtime logic; this is academic traceability.

### What to Say in Defense (Speaker Script)
"Our bibliography covers model-level references, platform documentation, and framework-level implementation references directly used in this build."

### Likely Panel Questions + Strong Answers
- Q: "Did you retrain FinBERT?"
  A: "No, we use inference API of pre-trained model and apply our own post-processing and portfolio logic."
- Q: "Are docs enough as references?"
  A: "For implementation details yes; for model rationale we also cite the FinBERT paper."

### Common Mistakes / Risky Claims to Avoid
- Do not cite tools not used in code.
- Do not omit publication year and source context for model paper.

### Visual Guidance (what diagram/screenshot to show)
Clean citation list with consistent citation style.

### Cross-links to other slides
- Slide 20-24 (algorithms derived from model outputs)
- Slide 14 (tech stack)

---

## Appendix A: Claim Corrections Applied
1. Removed Free/Pro subscription enforcement claims from technical narrative.
2. Treated admin routes as non-core to main sentiment-portfolio pipeline.
3. Reframed testing claims to evidence-based wording (implemented behavior vs formal automated evidence).
4. Reframed deployment claims as "proposed/ready architecture" unless live evidence exists.
5. Kept formulas strictly aligned to current code in `sentimentService.js` and `portfolioService.js`.

## Appendix B: Quick Slide-to-Code Index
- Slides 1-2: `client/src/App.jsx`, `server/index.js`, `server/cron.js`
- Slide 3: `server/scrapers/newsScraper.js`
- Slide 4: `server/services/sentimentService.js`, `server/services/portfolioService.js`
- Slide 5-7: `README.md`, UI pages, service modules
- Slide 8-8.2: `server/index.js`, `middleware/auth.js`, `.env.example`, service configs
- Slide 9-10: `server/index.js`, `cron.js`, `socket.js`, routes/services
- Slide 11: `client/src/pages/*`
- Slide 12: `server/routes/*`, `client/src/utils/api.js`, `postman_collection.json`
- Slide 13: `server/db/migrate.js`, `server/db/index.js`
- Slide 14: `package.json`, `client/package.json`
- Slides 15-19: `Portfolio.jsx`, `portfolioService.js`, `newsScraper.js`, `sentimentService.js`, `db/index.js`
- Slides 20-25: `sentimentService.js`, `portfolioService.js`, `newsScraper.js`
- Slide 26: `.env.example`, scripts in `package.json`
- Slides 27-31: routes/services + validation runbooks + bug table evidence
- Slide 32: deployment topology tied to `index.js`, scripts, env
- Slide 33-35: contribution matrix + UI/runtime evidence
- Slide 36-37: cost/schedule planning artifacts
- Slide 38-39: outcome summary + references
