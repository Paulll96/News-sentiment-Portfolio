/**
 * Database Migration Script
 * Creates all required tables for SentinelQuant
 */


const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool } = require('./index');

const migrations = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (authentication & subscription tiers)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT false,
    totp_backup_codes TEXT,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Stocks table (tracked securities)
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(24) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    sector VARCHAR(100),
    exchange VARCHAR(16) DEFAULT 'US',
    country VARCHAR(2) DEFAULT 'US',
    currency VARCHAR(3) DEFAULT 'USD',
    market_cap DECIMAL(20, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Searchable instrument universe (kept separate from tracked stocks table)
CREATE TABLE IF NOT EXISTS instrument_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(24) NOT NULL,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(16) NOT NULL DEFAULT 'NSE',
    country VARCHAR(2) DEFAULT 'IN',
    currency VARCHAR(3) DEFAULT 'INR',
    isin VARCHAR(20),
    is_tradable BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, exchange)
);

-- Cached market quotes per tracked stock
CREATE TABLE IF NOT EXISTS stock_quotes (
    stock_id UUID PRIMARY KEY REFERENCES stocks(id) ON DELETE CASCADE,
    price DECIMAL(15, 4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    source VARCHAR(40) DEFAULT 'unknown',
    as_of TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- News articles table (scraped content)
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    url VARCHAR(500) UNIQUE,
    published_at TIMESTAMP,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT false
);

-- Sentiment scores table (FinBERT analysis results)
CREATE TABLE IF NOT EXISTS sentiment_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES news_articles(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    confidence DECIMAL(5, 4) CHECK (confidence >= 0 AND confidence <= 1),
    raw_score DECIMAL(10, 6),
    source VARCHAR(20) DEFAULT 'finbert',
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio holdings table (user portfolios)
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
    shares DECIMAL(15, 6) NOT NULL,
    avg_cost DECIMAL(15, 4),
    current_value DECIMAL(15, 2),
    weight DECIMAL(5, 4),
    sentiment_score DECIMAL(5, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stock_id)
);

-- Transactions table (buy/sell history)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
    type VARCHAR(10) CHECK (type IN ('buy', 'sell', 'rebalance')),
    shares DECIMAL(15, 6) NOT NULL,
    price DECIMAL(15, 4) NOT NULL,
    total_value DECIMAL(15, 2),
    reason TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backtest results table
CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital DECIMAL(15, 2),
    final_value DECIMAL(15, 2),
    total_return DECIMAL(10, 4),
    cagr DECIMAL(10, 4),
    sharpe_ratio DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4),
    alpha DECIMAL(10, 4),
    trades_count INTEGER,
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Aggregated sentiment table (daily stock sentiment)
CREATE TABLE IF NOT EXISTS daily_sentiment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    avg_sentiment DECIMAL(5, 4),
    weighted_sentiment DECIMAL(5, 4),
    article_count INTEGER,
    positive_count INTEGER,
    negative_count INTEGER,
    neutral_count INTEGER,
    UNIQUE(stock_id, date)
);

-- Watchlist table (user favorites)
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stock_id)
);

-- Notifications table (alerts and updates)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backward-safe migration: add source column to existing sentiment_scores tables
ALTER TABLE sentiment_scores ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'finbert';
-- Backward-safe migration: add role column to existing users tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
-- Backward-safe migration: extend symbol length + stock metadata
ALTER TABLE stocks ALTER COLUMN symbol TYPE VARCHAR(24);
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS exchange VARCHAR(16) DEFAULT 'US';
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'US';
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);
CREATE INDEX IF NOT EXISTS idx_sentiment_stock ON sentiment_scores(stock_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_date ON sentiment_scores(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON portfolio_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_sentiment_date ON daily_sentiment(date DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_stocks_exchange_symbol ON stocks(exchange, symbol);
CREATE INDEX IF NOT EXISTS idx_instrument_exchange_symbol ON instrument_master(exchange, symbol);
CREATE INDEX IF NOT EXISTS idx_instrument_symbol_lower ON instrument_master(LOWER(symbol));
CREATE INDEX IF NOT EXISTS idx_instrument_name_lower ON instrument_master(LOWER(name));

-- Insert default stocks (top traded)
INSERT INTO stocks (symbol, name, sector, exchange, country, currency) VALUES
    ('AAPL', 'Apple Inc.', 'Technology', 'NASDAQ', 'US', 'USD'),
    ('MSFT', 'Microsoft Corporation', 'Technology', 'NASDAQ', 'US', 'USD'),
    ('GOOGL', 'Alphabet Inc.', 'Technology', 'NASDAQ', 'US', 'USD'),
    ('AMZN', 'Amazon.com Inc.', 'Consumer Cyclical', 'NASDAQ', 'US', 'USD'),
    ('TSLA', 'Tesla Inc.', 'Automotive', 'NASDAQ', 'US', 'USD'),
    ('NVDA', 'NVIDIA Corporation', 'Technology', 'NASDAQ', 'US', 'USD'),
    ('META', 'Meta Platforms Inc.', 'Technology', 'NASDAQ', 'US', 'USD'),
    ('JPM', 'JPMorgan Chase & Co.', 'Financial', 'NYSE', 'US', 'USD'),
    ('V', 'Visa Inc.', 'Financial', 'NYSE', 'US', 'USD'),
    ('JNJ', 'Johnson & Johnson', 'Healthcare', 'NYSE', 'US', 'USD')
ON CONFLICT (symbol) DO NOTHING;

SELECT 'Migration completed successfully!' as status;
`;

async function runMigration() {
    console.log('🔄 Running database migrations...\n');

    try {
        await pool.query(migrations);
        console.log('✅ All migrations completed successfully!');
        console.log('📊 Default stocks inserted');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration();
