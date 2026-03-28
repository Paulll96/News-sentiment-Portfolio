# SentinelQuant 📊

> **News-Sentiment-Driven Quantitative Portfolio Management System**
>
> Analyzes financial news in real-time using FinBERT NLP to drive automated portfolio allocation and rebalancing decisions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite 7, React Router v7, Recharts, Vanilla CSS |
| **Backend** | Node.js 18, Express.js |
| **Database** | PostgreSQL 14+ |
| **NLP / AI** | FinBERT via HuggingFace Inference API (`ProsusAI/finbert`) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **Scraping** | NewsAPI, Yahoo Finance RSS, Reddit |
| **Automation** | node-cron (configurable scrape interval) |
| **Security** | Helmet, express-rate-limit, CORS |

---

## Architecture

```mermaid
graph LR
    A[React Frontend<br/>Vite + Recharts] -->|REST API| B[Express Server<br/>Node.js]
    B --> C[(PostgreSQL<br/>Database)]
    B --> D[HuggingFace<br/>FinBERT API]
    E[News Sources] -->|NewsAPI / Yahoo / Reddit| B
    B --> |Cron every 15min| F[Sentiment<br/>Analysis Engine]
    F --> C
```

**Data Flow:**
1. `node-cron` triggers scraper every 15 minutes
2. Articles fetched from NewsAPI, Yahoo Finance RSS, Reddit (with deduplication)
3. Each article sent to FinBERT → returns `positive` / `negative` / `neutral` + confidence score
4. Weighted Sentiment Score (WSS) calculated with exponential time-decay
5. Portfolio rebalancing engine uses WSS to compute target weights (60% sentiment + 40% equal-weight)
6. Frontend polls the API and visualises live sentiment, holdings, and rebalancing signals

---

## Features

- 🤖 **Live FinBERT NLP** — Real-time sentiment analysis on financial news via HuggingFace API
- 📈 **Weighted Sentiment Score (WSS)** — Exponential time-decay algorithm ranking stocks by news momentum
- 💼 **Portfolio Rebalancing Engine** — Sentiment-driven 60/40 weight blend with configurable threshold triggers
- 🗞️ **Multi-Source Scraping** — NewsAPI, Yahoo Finance RSS, Reddit with deduplication
- ⏱️ **Cron Automation** — Background scraping and analysis on a configurable schedule
- 🔐 **Security** — JWT auth, bcrypt hashing, RBAC middleware, rate limiting, Helmet headers
- 📊 **Backtesting** — Historical simulation of sentiment strategy vs. benchmark
- 🎯 **Subscription Tiers** — Free (5 stocks) and Pro (all stocks) via RBAC middleware

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new user |
| `POST` | `/api/auth/login` | Public | Login, returns JWT |
| `GET` | `/api/auth/me` | JWT | Get current user |
| `GET` | `/api/users/profile` | JWT | Get user profile |
| `PUT` | `/api/users/profile` | JWT | Update profile name |
| `GET` | `/api/stocks` | Public | List all tracked stocks |
| `GET` | `/api/stocks/:symbol` | Public | Get stock detail |
| `GET` | `/api/sentiment` | Optional JWT | All stock sentiments (free: limit 5) |
| `GET` | `/api/sentiment/:symbol` | Public | WSS + recent scores for a stock |
| `GET` | `/api/sentiment/history/:symbol` | Public | Historical daily sentiment for charting |
| `POST` | `/api/sentiment/analyze` | JWT | Trigger sentiment analysis manually |
| `GET` | `/api/portfolio` | JWT | Get user holdings |
| `POST` | `/api/portfolio/initialize` | JWT | Initialize portfolio with sentiment weights |
| `POST` | `/api/portfolio/rebalance` | JWT | Run rebalance (dry-run by default) |
| `GET` | `/api/news/live` | Public | Latest scraped articles |
| `POST` | `/api/news/scrape` | JWT | Trigger manual scrape |
| `POST` | `/api/backtest/run` | JWT | Run a backtest simulation |
| `GET` | `/api/backtest` | JWT | List saved backtests |
| `GET` | `/api/health` | Public | Server health check |

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- HuggingFace API key (free at [huggingface.co](https://huggingface.co))
- NewsAPI key (free tier at [newsapi.org](https://newsapi.org))
- Twelve Data API key for live quotes

### 1. Clone and Install

```bash
git clone https://github.com/Paulll96/News-sentiment-Portfolio.git
cd News-sentiment-Portfolio

# Install backend dependencies
cd server && npm install

# Install frontend dependencies
cd ../client && npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/sentinelquant

# Auth
JWT_SECRET=your-long-secret-key-here

# APIs
HUGGINGFACE_API_KEY=hf_your_key_here
NEWS_API_KEY=your_newsapi_key_here
QUOTE_PROVIDER=twelvedata
QUOTE_API_KEY=your_twelvedata_key_here
QUOTE_API_BASE_URL=https://api.twelvedata.com

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173

# Cron Schedule
SCRAPE_INTERVAL_MINUTES=15

# Portfolio Config
MAX_POSITION_PERCENT=30
REBALANCE_THRESHOLD=0.05
```

Live quotes for add-holding/import flows require a valid Twelve Data API key. Yahoo fallback should be treated as best-effort only, not as a guaranteed live quote source.

### 3. Database Setup

```bash
# Create the database (PostgreSQL must be running)
psql -U postgres -c "CREATE DATABASE sentinelquant;"

# Run migrations (creates all tables + seeds 10 default stocks)
cd server && npm run db:migrate
```

### 4. Run the Application

```bash
# Terminal 1: Start backend (default Port 3001)
cd server && npm run dev

# Terminal 2: Start frontend (default Port 5173)
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Algorithm Details

### Weighted Sentiment Score (WSS)

Each stock's WSS is calculated from its recent news articles:

```
WSS = Σ (sentiment_score × confidence × time_decay) / Σ time_decay

where:
  sentiment_score = +1 (positive), -1 (negative), 0 (neutral)
  time_decay      = e^(-λ × article_age_in_hours)
  λ (lambda)      = 0.1  (decay rate — articles older than ~10 hours have half impact)
```

### Portfolio Weight Calculation

```
target_weight = (0.6 × sentiment_weight) + (0.4 × equal_weight)

sentiment_weight = normalized WSS score across all tracked stocks
equal_weight     = 1 / total_number_of_stocks
capped at        = MAX_POSITION_PERCENT per stock (default: 30%)
```

Rebalancing triggers when a stock's current weight deviates from its target by more than `REBALANCE_THRESHOLD` (default: 5%).

---

## Project Structure

```
News-sentiment-Portfolio/
├── client/                   # React Frontend (Vite)
│   └── src/
│       ├── components/       # Sidebar, AuthModal, SentimentTicker
│       ├── context/          # AuthContext (JWT), ToastContext
│       ├── pages/            # Dashboard, Sentiment, Portfolio, Backtest, News
│       └── utils/            # api.js (fetch wrapper with JWT injection)
├── server/                   # Express Backend
│   ├── db/                   # PostgreSQL connection pool + migration script
│   ├── middleware/           # JWT authenticateToken, requirePro (RBAC)
│   ├── routes/               # auth, users, portfolio, sentiment, news, backtest, stocks
│   ├── scrapers/             # NewsAPI, Yahoo Finance RSS, Reddit scrapers
│   ├── services/             # sentimentService.js (FinBERT + WSS), portfolioService.js
│   └── cron.js               # Automated scheduler (node-cron)
└── README.md
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Auth, tiers, profile |
| `stocks` | Tracked securities (10 seeded by default) |
| `news_articles` | Scraped articles with deduplication |
| `sentiment_scores` | FinBERT analysis results per article per stock |
| `daily_sentiment` | Aggregated daily WSS per stock (for charting) |
| `portfolio_holdings` | User portfolio positions and weights |
| `transactions` | Buy/sell/rebalance history |
| `backtest_results` | Saved backtest runs |
