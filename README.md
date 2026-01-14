# 🚀 SentinelQuant

> **AI-Powered FinTech SaaS Platform** for Sentiment-Based Portfolio Management

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com/)
[![FinBERT](https://img.shields.io/badge/FinBERT-NLP-orange.svg)](https://huggingface.co/ProsusAI/finbert)

---

## 🎯 Overview

SentinelQuant is a production-grade automated investment platform that leverages **Natural Language Processing (NLP)** using **FinBERT** to analyze financial news sentiment and automatically rebalance portfolios for optimal returns.

### Key Features

- 📊 **Real-Time Sentiment Analysis** - FinBERT-powered analysis of financial news
- 🔄 **Automated Rebalancing** - Dynamic portfolio adjustments based on sentiment scores
- 📈 **Backtesting Engine** - Test strategies against historical data
- 🎨 **Premium Dashboard** - Dark-mode SaaS interface with live data
- 🔐 **Secure Authentication** - Multi-tier subscription system
- 🔍 **Vector Search** - Semantic search across news history

---

## 🏗️ Architecture

```
sentinelquant/
├── frontend/          # Next.js 14 Dashboard
│   ├── app/           # App Router pages
│   ├── components/    # React components
│   └── lib/           # Utilities
├── backend/           # FastAPI Server
│   ├── api/           # REST endpoints
│   ├── ai/            # FinBERT & ML models
│   ├── scrapers/      # Data ingestion
│   ├── quant/         # Portfolio logic
│   └── models/        # Database schemas
└── docker/            # Containerization
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 15+ (with pgvector)
- Redis

### Installation

```bash
# Clone the repository
git clone https://github.com/yourname/sentinelquant.git
cd sentinelquant

# Install all dependencies
npm run install:all

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development servers
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sentinelquant

# API Keys
NEWS_API_KEY=your_newsapi_key
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_secret

# Auth
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=http://localhost:3000

# Redis
REDIS_URL=redis://localhost:6379
```

---

## 📊 Features in Detail

### 1. Sentiment Analysis Engine
- **FinBERT Integration**: Financial domain-specific BERT model
- **Entity Mapping**: Automatic news-to-stock-ticker association
- **Weighted Scoring**: Time-decay weighted sentiment aggregation

### 2. Portfolio Management
- **Dynamic Rebalancing**: Sentiment-driven position sizing
- **Risk Management**: Built-in stop-loss and position limits
- **Performance Tracking**: Real-time P&L calculations

### 3. Data Pipeline
- **Multi-Source Ingestion**: NewsAPI, Yahoo Finance, Reddit
- **Background Processing**: Celery workers for async tasks
- **Vector Storage**: pgvector for semantic search

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL + pgvector |
| Cache | Redis |
| AI/ML | FinBERT, Transformers, PyTorch |
| Task Queue | Celery |
| Charts | Recharts, D3.js |

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ for Tier-1 FinTech Excellence**
