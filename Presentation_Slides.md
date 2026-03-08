# SentinelQuant: News-Sentiment-Driven Quantitative Portfolio Management System
## Final Project Presentation Slides (39 Slides)

---

### Slide 1: Project Front Page
**Project Title:** SentinelQuant: News-Sentiment-Driven Quantitative Portfolio Management System
**Project Domain:** FinTech / AI Quantitative Finance / Natural Language Processing
**Project Guide:** [Insert Guide Name Here]
**Team Members:** 
- [Insert Name 1] (Reg. No: [Insert Reg No])
- [Insert Name 2] (Reg. No: [Insert Reg No])
- [Insert Name 3] (Reg. No: [Insert Reg No])
- [Insert Name 4] (Reg. No: [Insert Reg No])
**Institution / Department:** [Insert College/University Name], Department of Computer Science

---

### Slide 2: Introduction
- **What is SentinelQuant?** A full-stack (React/Node.js) web platform that dynamically manages stock portfolio allocations using live Artificial Intelligence and Natural Language Processing (NLP).
- **Core Philosophy:** Rather than relying exclusively on historical price charts (technical analysis), SentinelQuant connects to a Hugging Face FinBERT transformer model to read breaking financial news text, mathematically calculating the market's "mood" toward specific assets.
- **The Engine:** It continuously scrapes news (NewsAPI, Yahoo, Google News India, Stocktwits), applies exponential time-decay to the AI's sentiment insights, and executes quantitative `[Buy/Sell]` rebalancing algorithms when the drift crosses a configured threshold (e.g., 5%).

---

### Slide 3: Problem Statement
- **Severe Information Asymmetry:** Retail investors lack the computational tools to instantly parse thousands of financial articles, putting them at a severe disadvantage against high-frequency institutional trading algorithms.
- **Emotional Human Bias:** Human traders often suffer from psychological panic (selling at the bottom) or greed (holding winning positions too long).
- **Static "Bag Holding":** Traditional passive portfolios remain static during market crashes. They lack the intelligence to dynamically "dump" an asset the moment a catastrophic news cycle breaks.
- **The NLP Context Gap:** Standard sentiment models (like GPT or standard BERT) often misclassify financial jargon (e.g., "The stock *killed* the earnings estimates" is seen as negative by standard models, but highly positive in finance).

---

### Slide 4: Project Objectives
- **1. Live Multi-Source Ingestion:** To build robust background Cron schedulers connecting to US and NSE (National Stock Exchange) news feeds (Google News India, Reddit, Yahoo) with strict deduplication mechanisms.
- **2. Advanced NLP Implementation:** To successfully interface with the `ProsusAI/finbert` neural network via the Hugging Face Inference API for domain-specific financial sentiment classification.
- **3. Quantitative Temporal Scoring:** To develop a mathematically sound Weighted Sentiment Score (WSS) incorporating a Time-Decay curve (news from 1 hour ago exponentially outweighs news from 72 hours ago).
- **4. Automated Rebalancing Engine:** To create a mathematically disciplined `60/40` asset allocator that generates verifiable Buy/Sell drift ledgers to minimize transaction noise.
- **5. Interactive Dashboard:** To design a premium React (Vite) interface utilizing `Recharts` and `MagicBento` components to visualize live portfolio weight distribution.

---

### Slide 5: Purpose and Need of the Project
- **Democratizing Quant Tools:** Multi-million dollar institutional funds use NLP to front-run the market. SentinelQuant serves to prove that these advanced ML trading concepts can be successfully developed and deployed as an accessible, cost-effective web app.
- **Mathematical Risk Mitigation:** A pure-sentiment portfolio actively moves assets away from companies suffering scandals or supply chain crises *before* the stock price fully bottoms out, acting as a dynamic hedge.
- **Academic Exploration:** Bridging the gap between the strict rigors of mathematical quantitative finance (Portfolio Drift Math) and cutting-edge software engineering (Asynchronous API orchestration).
- **Complete Automation:** Providing a completely hands-off "set and forget" strategy driven purely by objective, unemotional data.

---

### Slide 6: Scope of the Project
- **In-Scope Boundaries:**
  - Scraping engines capable of handling unformatted HTML and JSON feeds.
  - Integration with the Hugging Face Inference API (incorporating 503 retry fallbacks/rate constraints).
  - PostgreSQL database design ensuring strict ACID compliance between abstract "Holdings" and the explicit "Transaction Ledger".
  - A responsive React Dashboard allowing simulated CSV Portfolio Imports and `isStrictDemoPortfolio` replacement logic.
- **System Constraints (Out of Scope):**
  - **Live Brokerage Execution:** The system acts as a highly accurate paper-trading/simulation platform; it will *not* physically execute trades via real APIs like Alpaca or Kite/Zerodha in this academic iteration.
  - **Minute-by-Minute Tick Data:** We utilize live EOD (End of Day)/Delayed API quotes, focusing on the NLP text vector rather than high-frequency price pinging.

---

### Slide 7: Social Relevance of the Project and SDGs Addressed
- **Social Relevance:** The financial markets govern global stability. By making sentiment-analysis algorithms transparent and visual in a web dashboard, the project promotes intense financial literacy, demystifying how heavily institutions rely on AI to move markets.
- **SDG 8 (Decent Work and Economic Growth):** By providing technical, AI-driven tools to individuals, it encourages better personal financial decision-making, which is fundamentally a pillar of personal economic stability and growth.
- **SDG 9 (Industry, Innovation, and Infrastructure):** Demonstrates applied rapid innovation by successfully bridging modern Transformer Neural Networks with traditional web infrastructures (Node.js/PostgreSQL), supplying a blueprint for modular financial technology.

---

### Slide 8: Software Requirement Specification (SRS)
**Introduction:** The SentinelQuant SRS defines the interactions between the Node.js API Gateway, the PostgreSQL persistence layer, and the external ML inference nodes.

**System Environment:**
- **Runtime:** Node.js 18+ LTS
- **Frontend Engine:** Vite 7 Server -> React 19 Client
- **RDBMS:** PostgreSQL 14+ (Connection Pooling)
- **External Dependency:** Internet access for NewsAPI scraping and Hugging Face HTTP POST requests.

**User Archetypes:**
- **Free/Standard User:** Can import CSV portfolios, view the Live Bento Heatmap, and trigger manual "Dry-Run" rebalances.
- **System Administrator:** Configures `SCRAPE_INTERVAL_MINUTES`, `REBALANCE_THRESHOLD`, and `MAX_POSITION_PERCENT` in the backend `.env` variables.

---

### Slide 8.1: Functional Requirements
- **FR1 (Auth & Session):** The system shall create secure accounts utilizing `bcryptjs` for passport hashing and issue 15-minute expiring JWTs (JSON Web Tokens) for API authorization.
- **FR2 (Automated Ingestion):** The `cron.js` module shall trigger Python/JavaScript scrapers on a configurable interval, bypassing HTTP blocks using customized `User-Agent` headers.
- **FR3 (FinBERT Evaluation):** The backend shall truncate raw articles to 512 tokens, POST to Hugging Face, and calculate a raw score formula: `(positive - negative) * (1 - neutral * 0.5)`.
- **FR4 (Portfolio Computation):** The `portfolioService.js` shall calculate drift. If `|TargetWeight - CurrentWeight| > 0.05`, the system *must* generate explicit `BUY/SELL` ledger rows.
- **FR5 (Dashboard Import):** The UI shall accept `.csv` uploads, map the columns (Symbol/Shares), cross-reference them against the `instrument_master` lookup table, and initialize the portfolio.

---

### Slide 8.2: Non-Functional Requirements
- **NFR1 (Fault Tolerance):** If the Hugging Face AI node returns HTTP 503 (Model Loading), the system shall wait 20 seconds up to 3 times before failing securely over to local keyword-based `getMockSentiment()` mapping without crashing the app.
- **NFR2 (Security Headers):** The Express API must enact `helmet` Content Security Policies (CSP) to block XSS (Cross-Site Scripting) and `express-rate-limit` (max 100 requests / 15 mins) on Authentication routes to mitigate brute force.
- **NFR3 (DB ACID Integrity):** `portfolioService.js` must wrap holding updates and transaction logging within a `transaction(async (client))` block. If logging a trade fails, the portfolio holding update must inherently roll back.
- **NFR4 (Performance):** The React client must remain highly responsive (60fps); computationally heavy charts (Recharts DOM drawing) and MagicBento particle glows must conditionally disable animations if `useMobileDetection()` is true.

---

### Slide 9: System Architecture (Block Diagram)
*(Placeholder: Create a flowchart showing the interactions described below)*

**The SentinelQuant Pipeline:**
1. **Frontend Request (React):** User requests Rebalance Preview.
2. **API Router (Express):** Receives HTTP request, validates JWT token via Middleware.
3. **Database Pull (PostgreSQL):** Fetches user's current shares + Active WSS (Weighted Sentiment Score) from `sentiment_scores`.
4. **Quant Engine Update (Node.js):** Runs `calculateTargetWeights()`.
5. **Scheduler (Cron):** (Running asynchronously) Aggregates unstructured web texts.
6. **Inference Layer:** Transmits sanitized arrays to HuggingFace `ProsusAI/finbert`.
7. **Database Push:** Inserts resulting sentiment label (`positive`: 0.94) attached to the Stock ID.

---

### Slide 10: Application Architecture Design
SentinelQuant deliberately avoids monolithic structures, favoring a clean 9-Module separation of concerns:

1. **Client Interface Module:** Vite+React SPA, Hooks, routing.
2. **API Gateway Module:** Express router (`/api/portfolio`, `/api/sentiment`).
3. **Security & Auth Module:** Bearer tokens, Bcrypt, Rate Limiters.
4. **Data Ingestion Module:** Specialized scrapers (`newsScraper.js`, `stocktwitsScraper.js`).
5. **Preprocessing Module:** Explicit regex Entity Linkers targeting `\$AAPL` or `.NS` ticker suffixes.
6. **Sentiment Intelligence Module:** The `FinBERT` API connector payload generator.
7. **Portfolio Quant Module:** Exponential time-decay math and 60/40 allocation logic.
8. **Trade Execution Module:** Abstracting drift thresholds into distinct ledger Buy/Sell actions.
9. **Persistence Module:** The `pg_pool` database driver.

---

### Slide 11: GUI Design (Mockups)
*(Include screenshots in presentation)*

- **Dashboard View (Dark Mode UI):**
  - **Metrics Stack:** Top row Spotlight Cards showing "Total Return", "Sharpe Ratio", "Portfolio Value".
  - **Asset Allocation (Center):** A large Recharts internal-radius Interactive Donut Chart displaying active percentage distribution.
  - **Portfolio Performance:** A Recharts `AreaChart` with an underlying gradient (`#22d3a7` shadow).
- **The "Magic Bento" Sentiment Heatmap:**
  - A highly animated grid row rendering individual stock cards (`ParticleCard`). If WSS is extremely bullish (> +0.10), the card border casts a pulsing neon green glow effect. Conversely, bearish casts a red glow.
- **Control Modals:** Full-page translucent overlays for `.csv` CSV Portfolio Import processing.

---

### Slide 12: API Design
A robust backend operating purely via JSON REST principles.

| Verb | Segment | Action / Description | Key Payloads / Query |
|---|---|---|---|
| `POST` | `/api/auth/login` | Issues JWT Token | `{ email, password }` |
| `GET` | `/api/portfolio` | Retrieves parsed Pie Chart ready weights | Requires `Authorization: Bearer` |
| `POST` | `/api/portfolio/rebalance`| Triggers the mathematical execution | `{ dryRun: true/false }` |
| `GET` | `/api/stocks/search` | Fast NSE Instrument lookup | `?q=RELIANCE&limit=8` |
| `POST` | `/api/news/scrape` | Manually triggers the Cron Scraping loop | (Admin/Pro restricted) |
| `GET` | `/api/health` | Diagnostic check | Verifies DB ping and HF Model availability |

---

### Slide 13: Database Design
Fully normalized PostgreSQL schema supporting complex analytical queries and ACID protection.

- **`users` (Core Auth):** `id` (UUID Primary), `email`, `password_hash`, `tier` (enum free/pro/enterprise).
- **`stocks` (Tracked Tracking):** Includes specific columns for globalization: `exchange` (NSE vs US), `currency` (INR vs USD).
- **`instrument_master` (Fast Search):** A lookup database to map imported CSV strings to legitimate global tickers instantly.
- **`news_articles` (Deduplication Log):** URL hashes prevent identical stories from overloading FinBERT token limits.
- **`sentiment_scores` (AI Result):** Links `Article ID` to `Stock ID` -> stores `sentiment`, raw `confidence` decimal, and the computed `raw_score`.
- **`portfolio_holdings` (Live State):** The ephemeral current state tracking `shares` * `avg_cost`.
- **`transactions` (Permanent Audit):** Absolute immutable ledger tracking every systemic trade `reason` ("Manual Add" vs "Sentiment Rebalance").

---

### Slide 14: Technology Stack
- **Frontend / Client UI:**
  - **React 19 & Vite 7 (ESM):** Lightning-fast HMR and minimal bundle sizes.
  - **React Router v7:** Modern layout nesting.
  - **Recharts:** Performant, customizable SVG charting logic.
  - **Vanilla CSS:** Modular class design avoiding heavy Tailwind bloat.
- **Backend / Engine Controller:**
  - **Node.js (18 LTS) & Express.js:** Event-loop driven async processing.
  - **node-cron & axios:** Background automation and multi-threaded request firing.
- **System Storage & ML Link:**
  - **PostgreSQL (`pg` node driver):** Direct complex query writing over ORM bloat for speed.
  - **Hugging Face (`ProsusAI/finbert`):** The standard ML Transformer benchmark fine-tuned strictly on the TRC2-Financial dataset.

---

### Slide 15: Module Breakdown — M1 & M2 (Interface -> Gateway Router)
**M1: Client Interface (Frontend React Shell)**
- **Use Case:** A user uploads their ZeroDha or Robinhood CSV file directly into the Dashboard.
- **Flow:** React reads the CSV DOM Object, parses it in the browser, and structures a sanitized JSON payload `{symbol: 'AAPL', shares: 50}`.

**M2: API Gateway (`index.js` Router)**
- **Use Case:** Defending the backend.
- **Flow:** Catches the incoming HTTP `POST /api/portfolio/import`. Instantly checks `express-rate-limit` restrictions, parses incoming `json({ limit: '2mb' })` payload sizes, and routes the request to `portfolio.js` controllers if deemed safe.

---

### Slide 16: Module Breakdown — M3 & M4 (Security -> Ingress Scrapers)
**M3: Security & Auth (`requirePro` Middleware)**
- **Use Case:** Validating API privileges.
- **Flow:** Verifies the signed JWT secret. Blocks Free-Tier users attempting to trigger expensive manual scrapers by instantly returning an `HTTP 403 Forbidden` JSON block before scraping logic can even start.

**M4: Data Ingestion Module (`newsScraper.js`)**
- **Use Case:** The 15-minute polling Cron interval fires.
- **Flow:** Dispatches concurrent `axios.get` promises to `NewsAPI` (Business feed) and `GoogleNewsIndia` RSS XML feeds. Receives hundreds of JSON objects containing `title`, `url`, and `publishedAt`.

---

### Slide 17: Module Breakdown — M5 & M6 (Preprocessing -> AI Intelligence)
**M5: Preprocessing & Deduplication**
- **Use Case:** Preventing "Double Counting" of the exact same press release mapped to AAPL.
- **Flow:** Regex patterns (e.g., `/\$([A-Z0-9]{1,12}(?:\.NS)?)/g`) identify explicit `.NS` NSE stock suffixes inside the scraped headline. Verifies URL hash against the database to confirm it is a completely new story.

**M6: Sentiment Intelligence Module (`FinBERT`)**
- **Use Case:** Analyzing the raw scraped string.
- **Flow:** Post payload: `"Reliance shares plummet following massive Q3 revenue miss"`. The HuggingFace `ProsusAI/finbert` model scores this mathematically. The System calculates `Raw Score = (positive - negative) * (1 - neutral * 0.5)` resulting in a strongly negative `-0.85`.

---

### Slide 18: Module Breakdown — M7 & M8 (Portfolio Quant -> Execution Engine)
**M7: Portfolio Quant Module (`portfolioService.js`)**
- **Use Case:** Processing the aggregate Sentiment Data Array.
- **Flow:** Takes the `-0.85` Reliance score and applies exponential age-decay math. Combines it with all other stocks. Calculates the "Target Weights": Determines RELIANCE should immediately drop from a 15% holding down to a 3% holding.

**M8: Trade Execution Engine**
- **Use Case:** Generating actionable ledger drift.
- **Flow:** Checks Drift `(15% - 3% = 12% shift)`. 12% is completely above the `CONFIG.rebalanceThreshold` of `0.05` (5%). The engine issues a mathematical `SELL` command to dump shares of Reliance, storing the exact transaction value based on current cached stock quotes.

---

### Slide 19: Module Breakdown — M9 (Persistence Layer)
**M9: Persistence Module (`db/index.js`)**
- **Use Case:** Executing the Rebalance cleanly.
- **Flow:** Utilizes PostgreSQL `BEGIN;` and `COMMIT;` transaction wrappers. 
- The module attempts to update `portfolio_holdings` (updating Reliance weight) AND insert the `SELL` order into the `transactions` ledger simultaneously.
- **Safety Standard:** If a network drop occurs during the ledger insertion, the SQL query explicitly throws an error and executes `ROLLBACK;`, ensuring the user's portfolio state never desynchronizes from the underlying trade math.

---

### Slide 20: Algorithm 1 - FinBERT NLP Inference Formula
**The Transformer Difference:**
While generic tools like ChatGPT attempt chat generation, FinBERT is specifically optimized to read millions of financial journals. E.g., The word `bullish` means nothing generally, but in Finance, it's overwhelmingly positive.

**Our Backend Logic Formula (`calculateRawScore`):**
1. Model outputs three probabilistic values: $P_{pos}, P_{neg}, P_{neu}$ that add up to 1.0.
2. We calculate: Let $RawScore = (P_{pos} - P_{neg}) \times (1 - P_{neu} \times 0.5)$
3. **Reasoning:** Extremely positive results approach +1.0. Extremely negative approach -1.0. High neutrality acts as a mathematical penalty, pushing the score dynamically closer to 0, ensuring we only trade on highly confident, declarative news.

---

### Slide 21: Algorithm 2 - Exponential Time Decay Equation
**Solving information stall:** In financial markets, news is 'priced in' almost instantly. A great headline from Friday is useless for algorithmic trading by Tuesday.

**Our Decay Function Algorithm:**
1. Determine article age: $T_{hours} = \frac{CurrentUnixTime - PublishedUnixTime}{1000 \times 60 \times 60}$
2. Calculate multiplier weight: $W_{article} = e^{\left(\frac{-T_{hours}}{24 \times Days}\right)}$
3. **Reasoning:** We utilize the exponential constant $e$. Using our baseline configuration, an article that is 1 hour old retains 99% of its sentiment multiplier. An article 3 days old has its mathematical impact severely crushed toward 0, preventing old data from "polluting" the live dashboard.

---

### Slide 22: Algorithm 3 - Weighted Sentiment Score (WSS) Normalization
**Aggregation Calculation:**
Once every individual article from the last rolling 7 days is scored AND decayed, the system compresses them into one singular, unified signal metric for the Stock.

**Algorithm:**
$$WSS = \frac{ \sum_{i=1}^{n} \left( RawScore_i \times Weight_i \right) }{ \sum_{i=1}^{n} Weight_i }$$

**Why mathematically Divide by the Sum of Weights?**
This acts as a strict normalizing divisor constraint. Whether Apple has 500 articles scraped today, or Tesla only has 2 articles, dividing by the sum keeps the final WSS strictly bounded between `[-1.0, 1.0]`. Without this, stocks with massive media presence would numerically explode the algorithm.

---

### Slide 23: Algorithm 4 - The 60/40 Portfolio Target Allocation Strategy
**Protecting from Ruin:** If a single stock receives 5 highly positive articles, a pure sentiment engine might dump massive amounts of cash 100% into that single stock, creating catastrophic vulnerability.

**Our Allocation Solution (`calculateTargetWeights`):**
1. System assigns an $EqualWeight = (\frac{1}{TotalTrackedStocks})$. (e.g., 10 stocks = 10% base each).
2. It processes the WSS.
3. $TargetWeight = (0.60 \times SentimentWeight) + (0.40 \times EqualWeight)$
4. This ensures that even in scenarios of pure negative panic, the asset maintains a diversified baseline weight. Furthermore, a strict `CONFIG.maxPositionPercent` dynamically caps any single stock from ever exceeding 30% of the user portfolio layout.

---

### Slide 24: Algorithm 5 - Rebalance Drift Threshold Check
**Preventing Micro-Transaction Noise:** Brokerages charge flat fees per trade. Tax authorities track every executed trade. If Sentiment pushes a target weight from `12.01%` to `12.03%`, making essentially 1-cent trades destroys the portfolio via fees.

**Threshold Check algorithm:**
1. Loop over every sentiment output.
2. Determine $\Delta = | TargetWeight - CurrentHoldingWeight |$
3. Evaluate constraint condition: 
   `if (Math.abs(Delta) >= CONFIG.rebalanceThreshold) { Execute_Trade(); } else { IGNORE(); }`
4. The system effectively implements a "Lazy Rebalancing" strategy, requiring a minimum `0.05` (5%) drift gap before committing to the heavy `UPDATE transaction` PostgreSQL logic.

---

### Slide 25: Procedure - The `isIndiaMarketNews` Regional Fallback Mechanism
**The Cross-Border Challenge:** Indian News Outlets (Scraped via Google News India) frequently publish articles titled "Markets closed higher across the board" without specifically tagging an NSE stock ticker.

**Our Procedural Solution (`newsScraper.js` -> `sentimentService.js`):**
1. If the scanner detects generalized Indian macroeconomic keywords (`nifty`, `sensex`, `midcap`, `rupee`).
2. AND if explicitly mapped tickers (`reliance.ns`) are absolutely `null`.
3. The system fires a lookup: `SELECT symbol FROM portfolio_holdings WHERE exchange = 'NSE'`.
4. It dynamically attaches that macro-market sentiment directly to the user's primary Indian holdings, ensuring domestic market mood correctly influences portfolio tracking seamlessly.

---

### Slide 26: Coding Standards, Environment & Source Control
- **Backend Standard:** Node modules leverage strict functional paradigms (avoiding heavy Class instantiation) using `async/await` handling inside native `try/catch` enclosures.
- **Frontend Standard:** React Components specifically destruct via ES6 assignments. UI logic avoids nested DOM drilling over 3-layers deep by utilizing generalized custom Hooks and `AuthContext` Providers.
- **Environment Setup:** Sensitive constants (`HUGGINGFACE_API_KEY`, `JWT_SECRET`, `MAX_POSITION_PERCENT`) are rigidly separated out of the application structure into a `.env` file loaded via `dotenv`, guaranteeing zero hardcoded credentials.
- **Source Control:** Hosted via GitHub. Branches are segmented, isolating SQL schema alterations (`migrate.js`) from API route generation to prevent merge conflicts during development sprints.

---

### Slide 27: Unit Testing Methodology
- **Objective:** Validating that deterministic functions yield completely predictable numerical mathematical outputs stripped of database access.
- **Focus Areas:**
  - **Function:** `calculateRawScore()`
  - **Inputs injected:** `{positive: 0.8, negative: 0.1, neutral: 0.1}`
  - **Assertion:** Strict assertion expecting the specific outcome float `0.665`.
  - **Function:** `normalizeTickerCandidate()`
  - **Inputs injected:** `"$AAPL"` and `"RELIANCE.NS"`
  - **Assertion:** Verify regex appropriately strips syntax yielding pure `"AAPL"` and `"RELIANCE.NS"`. This ensures the Entity Mapper engine maps strings flawlessly.

---

### Slide 28: Integration Testing Methodology
- **Objective:** Ensuring two distinct application modules talk to each other without pipeline breakage or schema violation errors.
- **Scenario Array:**
  1. **Router to Database:** Triggering `/api/portfolio/initialize` on a Free-Tier mock account. Assertion confirms PostgreSQL correctly cascades rows into `transactions` and `portfolio_holdings` simultaneously.
  2. **Route to AI Node:** Triggering `/api/sentiment/analyze` injecting mocked strings. Verifying the `axios.post` payload hits Hugging Face accurately and formats the incoming Object model safely bypassing mapping errors.

---

### Slide 29: Functional UI Testing Methodology
- **Objective:** Mimicking complex real-world end-user behaviors spanning the entire lifecycle from the browser to the backend.
- **Scenario Array:**
  1. **The Overwrite Workflow:** User creates empty account -> Dashboard initiates dummy data (`isStrictDemoPortfolio = true`) -> User clicks "Add Indian Stock (RELIANCE)" -> Validation verifies system automatically wipes dummy transactions silently and initiates real portfolio data without application lockout or reload.
  2. **Data-Grid Loading State:** Refresh Dashboard. Ensures `SkeletonStatCard` UI placeholders render seamlessly holding grid layout structure while React suspends awaiting slower REST API fetches (preventing layout shift jank).

---

### Slide 30: Load Testing Methodology
- **Objective:** Discovering memory leak failure points and concurrent user limitations.
- **Tools utilized:** JMeter or Artillery HTTP blasters configured to simulate spikes of 150 login REST calls simultaneously.
- **Mitigation Architectures Enacted:**
  - `express-rate-limit` instantly rejects DDOS level hammering on `/login`.
  - `pg_pool` database driver utilized to gracefully queue SQL transactions waiting on available server CPU threads.
  - Hugging Face API rate limitation (HTTP 429 Retry-After) throttled natively inside a `setTimeout` Batch execution loop in the AI service, allowing 100 articles to be fed cleanly over 2-minutes rather than crashing in an instantaneous bulk `Promise.all`.

---

### Slide 31: Bug Reports & Resolved Resolutions

| Bug Identifier | Module Origin | Nature of Issue | Applied Resolution | Status |
|---|---|---|---|---|
| **#SQ-010** | Quant Engine | Rebalancer attempting infinite recursion loop (Dividing by zero) when Portfolio Total Cash Value = `0` | Implemented strict `if (portfolioValue === 0) return { error: 'Empty portfolio' }` short circuit logic. | `Resolved` |
| **#SQ-024** | React UI | Recharts SVG `<Pie>` DOM crashing when Sentiment WSS calculations yielded exact matching 0.0 percentages. | Enacted floating minimum weight fallback constants `(0.1)` inside Context maps. | `Resolved` |
| **#SQ-031** | Intelligence | Hugging Face node repeatedly failing with `503 Service Unavailable` when waking up cold ML model. | Developed a 3-loop recursive API retry wrapper separated by 20-second timeout delays. | `Resolved` |

---

### Slide 32: System Deployment Architecture Outline
- **Containerization / Cloud Flow:** SentinelQuant is designed to be cloud-native, avoiding strict on-premise hardware binding.
- **PostgreSQL Database Deployment:** Hosted primarily on heavily managed instances like **Supabase** or **Render PostgreSQL** (Provides daily automated snapshots and native SSD high-I/O indexing).
- **Node.js Express API Container:** Deployed bound natively to **Render Web Services**. Pulls environments straight from secured Cloud dashboards rather than local `.env`.
- **Vite React UI Delivery:** Source code auto-built strictly by CI/CD pipelines through **Vercel** or **Netlify**. Any PR merged to GitHub `main` triggers an isolated ESBuild instance, pushing a compiled `dist/` folder directory seamlessly onto low latency Edge CDN delivery networks globally.

---

### Slide 33: Status of the Work & Individual Contributions
**Status Array:** The system architecture is fundamentally complete. Multi-source article ingestion, deduplication, 3rd party AI node inference, automated drift evaluation math logic, and secure Database persistence have all successfully bound to a polished React User Interface Dashboard.
**Contributions Array:**
- **[Insert Name 1]:** Focused heavily on the AI layer; Engineered the Hugging Face `finbert` fetch routes, error retry mechanisms, and the Time-Decay Sentiment normalization logic.
- **[Insert Name 2]:** Acted as SQL Architect; drafted `migrate.js` schema diagrams, established `transactions` persistence protocols, generated Express Gateways.
- **[Insert Name 3]:** Focused on DOM UI; mapped Vite component structuring, Recharts integration, styling elements (`MagicBento`).
- **[Insert Name 4]:** Constructed Python/Node extraction scrapers (`newsScraper.js` & `stocktwitsScraper.js`), defining `.NS` NSE entity resolution Regex mappings.

---

### Slide 34: Demonstration of Working Models Flow
*(Presenter: Shift to Live Interactive Browser Window here)*
1. **The Baseline UI:** Display the Dark-Mode React app at localhost. Show the fully loaded Pie-chart visualization of an initial $10,000 portfolio base (Equal weight mapping).
2. **The Ingestion:** Click "Trigger Refresh Scraper". Highlight the system terminal actively dumping `axios` results fetching 100+ articles traversing the web live via RSS and API.
3. **The AI Evaluation:** Wait 10 seconds. Show the FinBERT terminal responses: E.g., `["Apple sales crushed"] -> Score: -0.92`.
4. **The UI Reaction:** Display the Live Dashboard updating via Websocket reload. Point to the SentinelQuant heat map pulsing 'Red' automatically above the failing entity. 
5. **The Rebalance Commit:** Execute the "Preview Rebalance" modal. Show the exact system `SELL` action ledger executing without human prompting constraint.

---

### Slide 35: Screen Shots Array
*(Placeholder: Copy/Paste corresponding platform images directly inside these zones)*

- **Top Left Screenshot Region:** Display the Core User Dashboard, specifically focusing cleanly on the Recharts `Asset Allocation` Donut Chart visualization panel highlighting weight percentage drops safely.
- **Bottom Left Screenshot Region:** Capture the Visual Studio Code Terminal actively executing `node cron.js`. Capture cleanly the line showing: `✅ Analyzed: "...Nvidia profits skyrocket..." -> bullish (94.2%)`.
- **Right Half Screenshot Region:** Include an image of the React Table Module mapping `transactions`. Highlighting a Buy ledger execution labeled dynamically by the system: `Trigger Reason: WSS: +0.72 (bullish)`.

---

### Slide 36: Project Cost Analysis & Budget

*(Estimated Academic Prototype Deployment Costs via PaaS Frameworks)*

| Infrastructure Stack Layer | Commercial Hardware Equivalent | Academic PaaS Cloud Tool Leveraged | Est. Monthly Cost |
|---|---|---|---|
| **Relational Database Server** | Local AWS RDS Small Instance | Render managed Postgres (Free Tier: <1GB) | `$0.00` |
| **API Express Hosting** | AWS EC2 (t2.micro node) | Render managed Web Service (Down-scales on idle) | `$0.00` |
| **Frontend CDN Hosting** | S3 Bucket + Cloudfront | Vercel Edge Server Node Deployment | `$0.00` |
| **Machine Learning Inference** | On-prem 8x NVIDIA GPU Rack | Hugging Face free-tier API endpoint | `$0.00` |
| **Global News Ingestion** | Bloomberg Terminal ($2k/mo) | NewsAPI Developer Free + Google RSS | `$0.00` |
| **Total Expenditure Base** | | | **`$0.00`** |

---

### Slide 37: Project Scheduling Gantt Flow

*Execution Array spanning identical 12-Week Academic Semester Constraints:*
- **Phase A: Conception & Design Scoping (Weeks 1-2):** Evaluated FinBERT model accuracy baselines. Selected Postgres SQL over NoSQL due to strict transaction ledger necessities.
- **Phase B: Schema & Auth Backbones (Weeks 3-4):** Wrote `migrate.js`. Integrated JWT middleware and BCrypt.
- **Phase C: Ingestion & Intelligence Pipes (Weeks 5-7):** Bound `node-cron` to scrape arrays. Established HTTP connection to Hugging Face AI. Wrote `.NS` specific fallback code parsing algorithms.
- **Phase D: Quant Engine Dev (Weeks 8-10):** Transcribed Decay math logic and 60/40 Portfolio algorithms directly into `portfolioService.js`.
- **Phase E: React Frontend UI (Week 11):** Wrapped backend REST API cleanly into Vite components ensuring visual DOM Recharts updating.
- **Phase F: Quality Control (Week 12):** Post-stress testing endpoints. Polished UI logic. Created slides.

---

### Slide 38: Conclusion Summary
SentinelQuant definitively serves as a functioning proof of concept that extreme Institutional Quantitative Finance algorithms are no longer exclusive mechanisms.

By successfully linking cutting-edge open-source Transformer AI models (FinBERT) directly correlated via asynchronous Node REST APIs to React UI DOM visualization logic, this platform mathematically successfully replaced human emotional trading panic with calculated, time-decay sentiment metrics. The strict utilization of thresholds (checking $0.05$ baseline drifts) proves software can actively hedge against catastrophic financial news actively, algorithmically, and cost-effectively safely.

---

### Slide 39: References and Bibliography
1. **ProsusAI FinBERT Origins:** Araci, Dogu. "FinBERT: Financial Sentiment Analysis with Pre-trained Language Models." *arXiv preprint arXiv:1908.10063 (2019).*
2. **Efficient Market Theories:** Fama, Eugene F. "Efficient Capital Markets: A Review of Theory and Empirical Work." *The Journal of Finance 25.2 (1970)*.
3. **React DOM Rendering Documentation:** React.dev architecture guidelines (*Meta Open Source Frameworks*).
4. **Node.js Foundation Logic:** Node.js V18 LTS Async Event loop documentation block handling.
5. **Database Transaction Protocols:** PostgreSQL Global Development Group (*ACID Compliance documentation 14+*).
6. **Machine Learning Integrations API:** Hugging Face Inference API Documentation Guidelines. (https://huggingface.co/docs)
