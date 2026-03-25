const axios = require('axios');
const { query, transaction } = require('../db');

const NSE_INSTRUMENTS_URL = process.env.NSE_INSTRUMENTS_URL || 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';

function toUpper(value) {
    return String(value || '').trim().toUpperCase();
}

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }

        current += ch;
    }

    cells.push(current.trim());
    return cells;
}

function parseCsv(text) {
    if (!text) return [];

    const lines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length === 0) continue;

        const row = {};
        for (let c = 0; c < headers.length; c++) {
            row[headers[c]] = cols[c] || '';
        }
        rows.push(row);
    }

    return rows;
}

function ensureNseSymbolSuffix(symbol) {
    const clean = String(symbol || '').trim().toUpperCase();
    if (!clean) return '';
    return clean.endsWith('.NS') ? clean : `${clean}.NS`;
}

async function fetchNseInstrumentRows() {
    const response = await axios.get(NSE_INSTRUMENTS_URL, {
        timeout: 25000,
        headers: {
            'User-Agent': 'Mozilla/5.0 SentinelQuant/1.0',
            'Accept': 'text/csv,text/plain,*/*'
        }
    });

    const rawRows = parseCsv(response.data);
    const mapped = [];

    for (const row of rawRows) {
        const rawSymbol = row.SYMBOL || row.Symbol || row.symbol || '';
        const rawName = row['NAME OF COMPANY'] || row.NAME || row.Name || row.name || '';
        const rawIsin = row['ISIN NUMBER'] || row.ISIN || row.isin || null;

        if (!rawSymbol || !rawName) continue;

        mapped.push({
            symbol: ensureNseSymbolSuffix(rawSymbol),
            name: String(rawName).trim(),
            exchange: 'NSE',
            country: 'IN',
            currency: 'INR',
            isin: rawIsin ? String(rawIsin).trim() : null,
            isTradable: true
        });
    }

    return mapped;
}

async function syncInstrumentMaster() {
    const rows = await fetchNseInstrumentRows();

    if (rows.length === 0) {
        return { synced: 0 };
    }

    await transaction(async (client) => {
        for (const row of rows) {
            await client.query(
                `INSERT INTO instrument_master (symbol, name, exchange, country, currency, isin, is_tradable, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                 ON CONFLICT (symbol, exchange)
                 DO UPDATE SET
                    name = EXCLUDED.name,
                    country = EXCLUDED.country,
                    currency = EXCLUDED.currency,
                    isin = EXCLUDED.isin,
                    is_tradable = EXCLUDED.is_tradable,
                    updated_at = NOW()`,
                [row.symbol, row.name, row.exchange, row.country, row.currency, row.isin, row.isTradable]
            );
        }
    });

    return { synced: rows.length };
}

async function searchInstruments(search, exchange = 'NSE', limit = 20) {
    const q = String(search || '').trim();
    if (!q) return [];

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const result = await query(
        `SELECT im.symbol, im.name, im.exchange, im.country, im.currency,
                s.id AS stock_id
         FROM instrument_master im
         LEFT JOIN stocks s ON s.symbol = im.symbol
         WHERE im.exchange = $1
           AND (
                LOWER(im.symbol) LIKE LOWER($2)
                OR LOWER(im.name) LIKE LOWER($2)
           )
         ORDER BY
            CASE WHEN LOWER(im.symbol) = LOWER($3) THEN 0
                 WHEN LOWER(im.symbol) LIKE LOWER($3 || '%') THEN 1
                 ELSE 2
            END,
            im.symbol
         LIMIT $4`,
        [String(exchange || 'NSE').toUpperCase(), `%${q}%`, q, safeLimit]
    );

    let rows = result.rows;

    if (rows.length === 0) {
        const fallback = await query(
            `SELECT s.symbol, s.name, s.exchange, s.country, s.currency, s.id AS stock_id
             FROM stocks s
             WHERE s.exchange = $1
               AND (
                    LOWER(s.symbol) LIKE LOWER($2)
                    OR LOWER(s.name) LIKE LOWER($2)
               )
             ORDER BY s.symbol
             LIMIT $3`,
            [String(exchange || 'NSE').toUpperCase(), `%${q}%`, safeLimit]
        );
        rows = fallback.rows;
    }

    return rows.map(r => ({
        symbol: r.symbol,
        name: r.name,
        exchange: r.exchange,
        country: r.country,
        currency: r.currency,
        isTracked: Boolean(r.stock_id),
        stockId: r.stock_id || null
    }));
}

async function findInstrument(symbol, exchange = 'NSE') {
    const normalizedExchange = String(exchange || 'NSE').toUpperCase();
    const normalizedSymbol = normalizedExchange === 'NSE'
        ? ensureNseSymbolSuffix(symbol)
        : toUpper(symbol);

    const result = await query(
        `SELECT symbol, name, exchange, country, currency, isin
         FROM instrument_master
         WHERE symbol = $1 AND exchange = $2
         LIMIT 1`,
        [normalizedSymbol, normalizedExchange]
    );

    return result.rows[0] || null;
}

module.exports = {
    ensureNseSymbolSuffix,
    syncInstrumentMaster,
    searchInstruments,
    findInstrument,
};
