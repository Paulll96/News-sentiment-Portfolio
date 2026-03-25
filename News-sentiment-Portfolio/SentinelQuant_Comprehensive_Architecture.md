# SentinelQuant Architecture: Complete Deep Dive

# Directory Deep Dive: `server/routes/` (Backend Controllers)

This directory acts as the **Controller Layer** of the application. It is the direct interface between the frontend React application and the backend database/services. 

It uses **Express.js Routers** to group related API endpoints together. A Controller's *only* job is to receive an HTTP Request (`req`), validate the incoming data, pass it to a Service function to do the heavy lifting, and then format the HTTP Response (`res`) back to the client.

Here is a detailed breakdown of every file in this directory and exactly what it does:

---

## 1. `auth.js` (Authentication & Session Management)
This file handles everything related to user identity. It relies heavily on `bcrypt` for password hashing and `jsonwebtoken` (JWT) for session management.

*   **`POST /api/auth/register`**
    *   **Input:** Requires `email`, `password`, and `name` in the request body.
    *   **Action:** It queries the `users` table to ensure the email isn't already registered. If unique, it salts and hashes the password 10 times using `bcrypt`. It then inserts the new user into the database.
    *   **Output:** Returns a 201 Created status and the new user object (excluding the password hash).
*   **`POST /api/auth/login` (The 2FA Interceptor)**
    *   **Input:** Requires `email` and `password`.
    *   **Action:** Finds the user in the DB. Uses `bcrypt.compare()` to verify the password. 
    *   **Crucial Logic:** Before issuing a standard session token, it checks the `totp_enabled` boolean on the user's row. 
    *   **Output:** If 2FA is OFF, it issues a long-lived JWT and logs them in. If 2FA is ON, it explicitly refuses to log them in, returns a short-lived temporary token with `{ purpose: '2fa-challenge' }`, and tells the frontend `requires2FA: true`.
*   **`GET /api/auth/me`**
    *   **Middleware:** Protected by `authenticateToken`.
    *   **Action:** This is called by the React frontend every time the app loads. Because the JWT might be days old, this route hits the database using the ID inside the token to prove the user hasn't been deleted or banned.
    *   **Output:** Returns the fresh user profile data.

---

## 2. `portfolio.js` (The Core Application Endpoints)
This is the largest and most complex route file. It handles all portfolio viewing and manipulation.

*   **`GET /api/portfolio/dashboard` (The Mark-to-Market Engine)**
    *   This is the route we recently completely rebuilt. It does not just return a flat total; it calculates historical performance.
    *   **Action 1 (Holdings Breakdown):** It queries the `portfolio_holdings` table, joins the latest specific scraped news from `news_articles`, and calculates what percentage of the portfolio each stock commands (the `weight`).
    *   **Action 2 (True MTM Timeline):** It runs a complex algorithm that steps backward chronologically for 30 days. For each day, it scans the user's `transactions` ledger to deduce exactly how many fractional shares they owned *on that day*, and multiplies it by the historical closing price (fetched via `fetchHistoricalPrices` from Yahoo) to draw an accurate equity curve.
    *   **Output:** Returns the total value, the historical `perfHistory` array (for the area chart), and the individual `holdings` array (for the pie chart and grid).
*   **`POST /api/portfolio/rebalance`**
    *   **Action:** This is triggered when the user clicks the "Auto-Rebalance" button. It takes the user's total capital, analyzes the latest daily FinBERT AI sentiment for their stocks, and recalculates optimal percentage weights (highly positive stocks get more capital). 
    *   **Ledger Writing:** It specifically calls `portfolioService.js` to fetch live stock prices to figure out exactly how many fractional shares must be bought or sold to achieve those weights, writing explicit `buy`/`sell` records into the `transactions` table.
*   **`GET /api/portfolio/search` (The Sentiment Search Bar)**
    *   **Action:** This powers the UI dropdown. It queries the `instrument_master` directory looking for symbols matching the user's keystrokes. 
    *   **Feature:** It joins live AI metric data so the dropdown can overlay "Bullish/Bearish/Neutral" badges directly in the autocomplete results.

---

## 3. `twoFactor.js` (The Security Layer)
This file strictly handles the logic for the TOTP (Time-Based One-Time Password) algorithm, relying on the `otplib` and `qrcode` libraries.

*   **`POST /api/2fa/setup`**
    *   **Action:** Generates a secure random Base32 `secret` via `otplib.authenticator.generateSecret()`. It formats this into a standard `otpauth://` URI and then generates a visual QR code image string based on that URI.
    *   **Safety:** It saves the secret to the DB but leaves `totp_enabled = false` so the user isn't locked out if they abort the setup early.
*   **`POST /api/2fa/verify`**
    *   **Input:** Requires a 6-digit `code` the user typed from their phone.
    *   **Action:** The server verifies the code against the saved secret. If the math checks out, it permanently sets `totp_enabled = true` in the database, locking the account down. It also generates 6 random alphanumeric backup codes.
*   **`POST /api/2fa/validate`**
    *   **Action:** This is the second half of the login process. It receives the short-lived `tempToken` issued by `/api/auth/login` alongside a newly typed 6-digit TOTP code. If the code is valid, it throws away the temp token and issues the real, long-lived global session JWT.

---

## 4. `admin.js` (System Monitoring)
This file is protected by intense role-based access control. Only users with `role === 'admin'` can access these endpoints.

*   **`GET /api/admin/system/status`**
    *   **Action:** This endpoint provides a "health check" of the backend. It queries the database to count the total number of users, the total number of tracked stocks, the total processed news articles, and the global health of the automated Cron scrapers.
    *   **Output:** Returns statistics used by the Admin Dashboard to visualize application growth and health.


<div style="page-break-after: always;"></div>

# Directory Deep Dive: `server/services/` (Backend Business Logic)

This directory contains the **Service Layer**. While the "Controllers" (`routes/`) handle HTTP traffic, the "Services" (`services/`) are fully decoupled Javascript modules that handle all mathematical calculations, external API calls, machine learning logic, and complex database transactions.

By separating this logic from the routes, the code becomes highly reusable (e.g., the Cron job can call a service, and an HTTP API endpoint can call the same service without repeating code).

Here is the exact breakdown of the three critical Service files:

---

## 1. `portfolioService.js` (The Ledger & Allocation Engine)
This is the most complex file in the backend. It manages the math behind user wealth.

*   **`calculateTargetWeights(sentiments)`**
    *   **Purpose:** This is the AI-driven allocation algorithm.
    *   **Logic:** It maps over an array of stocks and their `sentiment_score` (ranging from -1.0 bearish to +1.0 bullish). It scales these scores into "Weights." A highly bullish stock might be assigned a `0.40` (40%) weight, while a neutral stock gets `0.10` (10%), and bearish gets `0` (sold off). It normalizes the math so the weights always perfectly equal 1.0 (100% of the portfolio).
*   **`initializePortfolio(userId, initialCapital)`**
    *   **Purpose:** The bootstrap function when a user first signs up.
    *   **Logic:** It takes the `$10,000` default starting capital, calls the `calculateTargetWeights` formula, and assigns dollar values to stocks. 
    *   **The Fidelity Fix (Importantly!):** We recently modified this directly. Instead of assigning a fake value of `1 share`, it explicitly fetches the *live, down-to-the-second market price* of the stock (e.g., $150.00). It divides the allocated capital by the real price to calculate the true, granular fractional shares (e.g., 6.666 shares) and writes *that* real number to the permanent `transactions` table.
*   **`rebalancePortfolio(userId, dryRun = false)`**
    *   **Purpose:** Triggers the portfolio to sell off underperforming stocks and buy surging stocks.
    *   **Logic:** If `dryRun` is true, it just calculates the proposed changes (Delta) and returns a summary to the frontend ("We plan to sell AAPL and buy MSFT"). If false, it immediately hooks into the PostgreSQL `db.transaction()` wrapper. It explicitly calculates the live fractional share differences, executes the trades in the database ledger, and updates the `portfolio_holdings` table to reflect the new reality. If any row fails to update, the entire PostgreSQL transaction is rolled back safely.

---

## 2. `sentimentService.js` (The AI NLP Pipeline)
This file is the specific bridge between the database and the Machine Learning model.

*   **`analyzeText(text)` (The FinBERT Bridge)**
    *   **Purpose:** The actual interface with the Natural Language Processing AI.
    *   **Logic:** Currently, this mocks the transformer output using heuristic keyword scoring (for speed), but it is structurally designed to make an Axios `POST` request to a Python Flask server running the HuggingFace `ProsusAI/finbert` model. It passes the raw headline text (e.g., "Apple misses Q3 earnings due to supply chain woes") and receives back a probability array: `[Positive: 0.05, Negative: 0.85, Neutral: 0.10]`.
*   **`calculateWSS()` (Weighted Sentiment Score)**
    *   **Purpose:** Converts the raw probabilities into a single, highly actionable mathematical float between -1.0 and 1.0.
    *   **Formula:** `WSS = Probability(Positive) - Probability(Negative)`. 
    *   **Example:** Using the scores above, `0.05 - 0.85 = -0.80`. The system flags this as highly `Bearish`, and the `portfolioService.js` will respond by selling off the asset during the next rebalance.
*   **`aggregateDailySentiment(stockId)`**
    *   **Purpose:** Called by the Cron job at midnight. 
    *   **Logic:** It finds all `news_articles` for a specific stock scraped over the last 24 hours. It averages out all their specific WSS scores into one master "Daily Score" and inserts it into the `daily_sentiment` database table. This provides the historical sentiment tracking shown on the individual stock detail pages.

---

## 3. `quoteService.js` (The Real-Time Market Feed)
This handles fetching financial pricing data from the outside world.

*   **`fetchLiveQuote(symbol)`**
    *   **Purpose:** Abstracted price fetching that prevents the app from crashing if an external API goes down.
    *   **Logic:** It has fallback mechanics. It first attempts to call the **TwelveData API** for real-time WebSocket-style pricing. If TwelveData hits a rate limit or goes down, it catches the error and silently attempts to query the **Yahoo Finance Finance API** as a fallback. 
*   **`getQuoteForStock(stock, options)`**
    *   **Purpose:** The caching layer.
    *   **Logic:** External APIs charge money per request. To save rate-limits, this function checks PostgreSQL to see if we've already fetched the price of `AAPL` in the last `15 minutes`. If so, it returns the cached database value immediately (ultra-fast). If the cache is stale, it calls `fetchLiveQuote()`, overwrites the database with the new price, and resets the freshness timer.
*   **`fetchHistoricalPrices(symbols, range = '1mo')`**
    *   **Purpose:** The data ingestion engine for True Mark-to-Market charting.
    *   **Logic:** It takes an array of symbols (e.g., `['AAPL', 'MSFT']`) and calls the Yahoo API explicitly asking for the `chart` endpoint with a `1d` (daily) interval. It parses the complex nested JSON response (`response.data.chart.result[0].indicators.quote[0].close`) and reconstructs it into a highly efficient Hash Map: `{ 'AAPL': { '2026-03-01': 150.50 } }`. This allows the `portfolio.js` router to execute million-iteration timeline calculations in milliseconds.


<div style="page-break-after: always;"></div>

# Directory Deep Dive: `server/` Core Systems (Cron, Scrapers, DB, Middleware)

This document breaks down the foundational infrastructure directories of the SentinelQuant backend. These are the unsung heroes of the application: the automated workers that run in the background, the database connection pool manager, the security interceptors, and the core scripts that fetch data from the outside world.

---

## 1. Directory: `server/cron/` (Background Automation)
The "Cron" directory utilizes the `node-cron` library. These are scripts that the Express server actively launches when it boots up (`index.js`). They run silently in the background on specific time schedules, completely independently of user requests. They are the engine of a "Quant" system.

*   **`sentimentJob.js` (The Midnight Aggregator)**
    *   **Schedule:** Runs at `0 0 * * *` (Midnight every day).
    *   **Action:** It queries the `stocks` table for every single symbol actively tracked by any user in the system.
    *   **Calculation:** It calls `aggregateDailySentiment(stock.id)` from the sentiment service. This looks at all the scraped news headlines from the past 24 hours, runs the mathematical FinBERT AI equations to find the probabilities of bullish/bearish, averages everything together, and writes a single permanent historical record (e.g., `-0.45` Bearish) to the `daily_sentiment` table for that specific date.
*   **`marketDataJob.js` (The Live Quote Updater)**
    *   **Schedule:** Runs at `*/15 * * * *` (Every 15 minutes).
    *   **Action:** It queries the database for all `stocks` that haven't had their price updated in the last 15 minutes. It then massively fetches live prices from external APIs (Yahoo Finance/TwelveData) and runs an SQL `UPDATE` on the `stocks` table.
    *   **Purpose:** This guarantees that when a user logs in and loads their dashboard, the total portfolio value math isn't using 3-day-old stock prices.

---

## 2. Directory: `server/scrapers/` (The Data Gatherers)
This directory is responsible for ingesting the raw string data that feeds the AI.

*   **`newsScraper.js`**
    *   **Technology:** Often uses tools like `axios` to download raw HTML, and `cheerio` (a fast server-side jQuery implementation) to parse the DOM tree of news and financial websites.
    *   **Action:** It specifically targets the DOM elements containing article headlines, publication dates, and summarized content.
    *   **Integration:** After successfully parsing a headline (e.g., "Microsoft acquires AI startup"), it immediately passes the string into the FinBERT analyzer pipeline to get the 3-axis probability (Pos/Neg/Neu), calculates the final WSS score (`0.65`), and inserts the raw article *plus* its AI score into the `news_articles` table.
*   **`runScraper.js`**
    *   This is an independent Node script designed to be run manually from the terminal (`npm run scrape`). It allows administrators to force a massive, instantaneous scrape of the financial web without waiting for the automated Cron schedules.

---

## 3. Directory: `server/db/` (The Database Engine)
This is the only directory allowed to "talk" directly to PostgreSQL.

*   **`index.js` (The Connection Pooler)**
    *   **Technology:** Uses the native `pg` Node driver.
    *   **Action:** It creates a massive "Pool" of connections to the database using the `DATABASE_URL` environment variable.
    *   **The `query(text, params)` wrapper:** It intercepts all SQL queries from the rest of the application. It guarantees that they use parameterized inputs (`$1, $2`) to completely neutralize the threat of malicious SQL Injection hacks.
    *   **The `transaction(callback)` wrapper:** It provides an explicit `BEGIN`, `COMMIT`, and `ROLLBACK` interface. If a Service (like `rebalancePortfolio`) needs to securely execute 5 different SQL inserts, it wraps them in this transaction. If Insert #4 fails, the engine throws a `ROLLBACK`, guaranteeing no corrupted half-data is written to the ledger.
*   **`migrate.js` & `schema.sql`**
    *   These handle the schema creation. `schema.sql` physically contains the `CREATE TABLE` and `ON CONFLICT` constraints for the entire relational model. `migrate.js` executes this file upon the first system deployment.

---

## 4. Directory: `server/middleware/` (The Security Checkpoints)
Middleware functions are literal roadblocks. Before an HTTP Request (`req`) is allowed to touch a Route or a Service, it must pass through these interceptor functions. If it fails, the middleware returns a `401/403` error and the request dies instantly.

*   **`auth.js` (`authenticateToken`)**
    *   **Technology:** Requires `jsonwebtoken`.
    *   **Action:** It checks the `Authorization` header of an incoming HTTP request. It expects the format `Bearer {eyX.....}`.
    *   **Verification:** It runs `jwt.verify(token, process.env.JWT_SECRET)`. 
    *   **Outcome:** If the token is mathematically valid and not expired, it extracts the `user_id` payload from inside the token, explicitly attaches it to the request object (`req.user = decoded`), and calls `next()` to let the request continue to the Controller route. If invalid, it returns `401 Unauthorized` and blocks the request entirely.
*   **`requireRole.js` (`requireAdmin`)**
    *   **Action:** Usually chained *after* `authenticateToken`. It specifically checks if the decoded token claims the user is an `admin` (`req.user.role === 'admin'`). If they are just a `user`, it returns `403 Forbidden` and kills the request. This is how the `/api/admin/*` endpoints are physically defended.


<div style="page-break-after: always;"></div>

# Directory Deep Dive: `client/src/components/` (Frontend React UI)

This directory houses the reusable, modular UI building blocks of the React frontend. SentinelQuant heavily relies on component-driven architecture to ensure the code remains DRY (Don't Repeat Yourself) and highly maintainable. 

Here is a comprehensive, file-by-file breakdown of exactly what these visual components do and how they function:

---

## 1. Core Layout & Navigation Structure

### `Layout.jsx` & `Navbar.jsx`
*   **Purpose:** The persistent "Shell" of the application.
*   **Action (`Layout.jsx`):** This is the master wrapper. It renders the `Navbar` component permanently at the top of the screen. Directly below the Navbar, it renders the React Router `<Outlet />`. Everything the user natively interacts with (the Dashboard, the Settings page) is dynamically injected directly into this Outlet without the page ever refreshing.
*   **Action (`Navbar.jsx`):** Uses the `AuthContext` to determine its state. If `user` is null (logged out), it renders simple "Login/Register" generic links. If `user` exists, it renders the secure internal navigation (Dashboard, Research, Admin) and physically changes the UI to a darker, more complex dashboard aesthetic. It also executes the `logout` function, instantly shredding the JWT token from `localStorage`.

### `ProtectedRoute.jsx`
*   **Purpose:** The frontend security checkpoint.
*   **Action:** It intercepts React Router navigation attempts. If a user tries to manually type `/dashboard` in their URL bar, this component checks the `AuthContext`. If they do not have a valid token loaded, it forcefully uses `<Navigate to="/login" replace />` to teleport them back to the login screen, destroying their browser history stack so they cannot hit the "Back" button to bypass security.

---

## 2. Advanced Feature Components

### `SearchBar.jsx` (The Sentiment Engine Interface)
*   **Purpose:** The most complex UI interaction built into the `model-8` upgrade.
*   **The Input Field:** It uses standard React controlled state (`useState`). However, it wraps the onChange handler in a custom `useEffect` timer. This is called **Debouncing**. It intercepts the user's keystrokes. Instead of firing an API request for every single letter "A", "A-A", "A-A-P", it waits mathematically for 300 milliseconds of silence *after* the user stops typing to fire the actual `axios` request to the backend. This prevents the Postgres database from melting under load.
*   **The Dropdown Render:** When the backend array returns, this component maps over the JSON. It doesn't just show text; it parses the live `sentiment_score` (`wss`). It executes conditional rendering logic: `wss > 0.2 ? 'Bullish' : wss < -0.2 ? 'Bearish' : 'Neutral'`. It attaches dynamic CSS classes (e.g., green text with a glowing border for Bullish) directly onto the list element, overlaying Lucide-React micro-animations.

---

## 3. The Reusable UI Kit (`ui/` sub-folder)

SentinelQuant uses a custom-built Design System rather than a generic library like Material-UI or Bootstrap. This guarantees the "Premium Fintech" aesthetic isn't muddy.

### `Card.jsx`
*   **Purpose:** The fundamental wrapper mapping to the visual "Bento Box" grid system.
*   **Implementation:** It forces a highly specific CSS shadow (`box-shadow`), a border-radius (`rounded-xl`), and dark mode specific background colors (`bg-dark-surface`). Every graph, list, and form on the Dashboard is physically rendered inside a `Card`.

### `Button.jsx`
*   **Purpose:** A unified interactive element.
*   **Features:** It accepts multiple generic visual `variants` (`primary`, `secondary`, `danger`, `ghost`). Most importantly, it accepts a boolean `isLoading` prop.
*   **UX Implementation:** If `isLoading={true}` is passed (e.g., during a Form submission), the Button physically disables its HTML `disabled` attribute to prevent double-clicks, and swaps its internal text label for a spinning SVG circle animation. 

### `Input.jsx`
*   **Purpose:** A standardized wrapper around the HTML `<input>` element.
*   **Implementation:** It handles Focus states, Error states, and dynamic label positioning. If an `error` prop string is passed to it, it turns the entire border structure perfectly red and renders the microscopic error message immediately below the field, handling visual validation feedback.

---

## 4. The "ReactBits" Visual Effects Package
Located in `components/ReactBits/`, this represents the pure CSS/JS visual flair code designed to "wow" users in an enterprise portfolio evaluation context.

### `SpotlightCard.jsx`
*   **Purpose:** A high-end mouse tracking visual effect.
*   **Implementation:** It hooks a `mousemove` event onto a massive invisible HTML `div`. As the user drags their cursor across the screen, the React code physically parses the exact `X/Y` mouse pixel coordinates. It takes those coordinates and mathematically writes a CSS `radial-gradient` variable dynamically onto the DOM element. The result is a subtle "flashlight" effect that perfectly tracks the mouse behind the glassmorphic glass of the UI panels.


<div style="page-break-after: always;"></div>

# Directory Deep Dive: `client/src/` Pages & State Management

This document provides an exhaustive breakdown of the top-level React architecture. While the `components/` directory contains small, reusable building blocks (buttons, inputs), the `pages/` directory contains the massive "Smart" components that compose those blocks together, handle routing, data fetching, and page-level logic. This document also explains the `context/` and `utils/` files that power them.

---

## 1. Directory: `client/src/context/` (Global State)
Context provides a way to pass data through the component tree without having to pass props down manually at every level.

### `AuthContext.jsx`
*   **Purpose:** The central nervous system of user identity in the frontend. Everything depends on this file.
*   **State Objects:**
    *   `user`: Stores the decoded JSON user profile (`id`, `email`, `role`).
    *   `loading`: A crucial boolean. When the app first mounts, it is `true`. The app stays physically blank until this resolves. It prevents a logged-in user from seeing a flash of the "Login" screen before the token is validated.
*   **Methods:**
    *   `login(email, password)`: Makes the `axios` POST to `/api/auth/login`. It handles the 2FA interruption. If the server says `requires2FA = true`, it returns that data structure to the login page so it can swing the UI over to the 6-digit input box.
    *   `validate2fa(tempToken, code)`: The second half of the 2FA handshake.
    *   `logout()`: Synchronously executes `localStorage.removeItem('token')` and runs React `setUser(null)`. This instantly triggers a re-render cascade across the entire App, kicking the user out of all `ProtectedRoutes`.
*   **The Initialization Hook (`useEffect`):** On refresh, it checks if a token exists in browser memory. If yes, it silently calls `/api/auth/me` with that token. If the backend accepts it, it silently restores the `user` state. If the backend rejects it (e.g., token expired after 7 days, or the user was deleted), it forcefully executes `logout()`.

---

## 2. Directory: `client/src/utils/` (Helper Functions)
This folder keeps the UI components clean by abstracting away complex math or generic network wiring.

### `api.js`
*   **Purpose:** The single gateway for all frontend-to-backend communication.
*   **`apiRequest(endpoint, options)`:** 
    *   Instead of calling `fetch('http://localhost:3000/api...')` directly in every component, they call `apiRequest('/api/...')`.
    *   **Header Injection:** It automatically executes `localStorage.getItem('token')` and appends it to the `Authorization: Bearer <token>` header of every outgoing request. The components don't even need to think about authentication.
    *   **Error Normalization:** It wraps the generic fetch response. If `!response.ok`, it intercepts the JSON, attempts to parse the specific `{ error: "Message", code: "ERR_CODE" }` format sent by the Express server, and explicitly `throw`s a new JavaScript Error so the React UI can seamlessly `.catch()` it and display Toast notifications.

---

## 3. Directory: `client/src/pages/` (The Main Routes)
These are mapped 1-to-1 with specific URLs in `react-router-dom` (e.g., `/dashboard`, `/login`, `/admin`).

### `Login.jsx` & `Register.jsx`
*   **Purpose:** The public-facing entry points.
*   **Complexity:** The `Login.jsx` is effectively a state machine. It manages `step = 1` (Email/Password) and `step = 2` (The 2FA Code prompt). It implements `lucide-react` eye icons to toggle password visibility. Upon successful login, it calls `useNavigate()` to manually redirect the browser to `/dashboard`.

### `Dashboard.jsx`
*   **Purpose:** The primary landing zone for a logged-in user. It is the most complex UI component in the codebase.
*   **Data Dependencies:** It relies entirely on `/api/portfolio/dashboard`. 
*   **Skeleton Loading:** It implements multiple granular loading states. While fetching, the UI doesn't just show a generic spinner; it renders gray pulsing "Skeleton" blocks in the exact dimensions of the expected UI (the area chart, the asset grid). This is a premium UX technique to prevent layout shift.
*   **The Visualization (`recharts`):** 
    *   It renders a `<ResponsiveContainer>` containing an `<AreaChart>` using the True Mark-to-Market `perfHistory` array. It handles custom tooltips and gradient SVG fills.
    *   It renders a `<PieChart>` for the asset allocation (`weights`), dynamically generating HSL colors based on the stock's sentiment score (green for bullish allocations, gray for neutral, removing red because bearish stocks are sold off).

### `Portfolio.jsx`
*   **Purpose:** Manual asset management and system actions.
*   **Action Buttons:** Houses the critical "Auto-Rebalance Portfolio" and "Initialize Portfolio" buttons, which trigger the AI NLP pipeline on the backend.
*   **Error Catching (The Fallback UX):** When adding a stock that Yahoo Finance doesn't recognize (or if the API is rate-limited), it catches the custom `AVG_COST_REQUIRED_NO_QUOTE` error string from `api.js`. It instantly flips a boolean `requiresManualPrice = true` in the state. This unhides a forced "Average Purchase Price" input field inside the Add Stock modal, requiring the user to type in the share price manually so the database ledger math isn't broken.

### `Settings.jsx`
*   **Purpose:** Security and profile management.
*   **Features:** It contains the UI logic for updating passwords and the critical `Setup 2FA` functionality. 
*   **The 2FA Modal:** When the user clicks "Setup", it pops open a modal, renders an `<img>` tag passing the Base64 Data-URL string from the server as the `src` attribute (displaying the physical QR code), and provides the input box and submission logic for the validation step.

### `AdminDashboard.jsx`
*   **Purpose:** Only reachable if `user.role === 'admin'`. Restricted by both the backend API and an explicit `<AdminRoute>` conditional render wrapper in the React Router config.
*   **Features:** Fetches from `/api/admin/system/status`. Visualizes the total number of users, stocks tracked, and importantly: the manual "Run Scrapers Now" button, allowing administrators to manually kick off the `node-cron` AI ingestion pipeline without waiting for midnight.


<div style="page-break-after: always;"></div>

