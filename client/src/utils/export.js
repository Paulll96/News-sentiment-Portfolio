/**
 * Data export utility — generates CSV downloads
 */

/**
 * Convert an array of objects to a CSV string
 * @param {Object[]} data - Array of objects
 * @param {string[]} columns - Column keys to include (uses all keys if not specified)
 * @param {Object} headers - Optional map of key → display header
 * @returns {string} CSV content
 */
export function toCSV(data, columns = null, headers = null) {
    if (!data || data.length === 0) return '';

    const keys = columns || Object.keys(data[0]);
    const headerRow = keys.map(k => headers?.[k] || k).join(',');
    const rows = data.map(row =>
        keys.map(k => {
            let val = row[k];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',')
    );

    return [headerRow, ...rows].join('\n');
}

/**
 * Trigger a CSV file download in the browser
 * @param {string} csvContent - CSV string
 * @param {string} filename - Filename for download
 */
export function downloadCSV(csvContent, filename = 'export.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export sentiment data as CSV
 * @param {Object[]} sentiments - Array of sentiment objects
 */
export function exportSentiments(sentiments) {
    const csv = toCSV(sentiments,
        ['symbol', 'name', 'wss', 'signal', 'articleCount'],
        {
            symbol: 'Symbol',
            name: 'Company',
            wss: 'Weighted Sentiment Score',
            signal: 'Signal',
            articleCount: 'Articles Analyzed',
        }
    );
    downloadCSV(csv, `sentinelquant_sentiment_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Export portfolio holdings as CSV
 * @param {Object[]} holdings - Array of holding objects
 */
export function exportPortfolio(holdings) {
    const csv = toCSV(holdings,
        ['symbol', 'shares', 'current_weight', 'target_weight', 'value'],
        {
            symbol: 'Symbol',
            shares: 'Shares',
            current_weight: 'Current Weight',
            target_weight: 'Target Weight',
            value: 'Value (USD)',
        }
    );
    downloadCSV(csv, `sentinelquant_portfolio_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Export backtest results as CSV
 * @param {Object[]} backtests - Array of backtest result objects
 */
export function exportBacktests(backtests) {
    const csv = toCSV(backtests,
        ['name', 'start_date', 'end_date', 'initial_capital', 'final_value', 'total_return', 'cagr', 'sharpe_ratio', 'max_drawdown', 'alpha'],
        {
            name: 'Backtest Name',
            start_date: 'Start Date',
            end_date: 'End Date',
            initial_capital: 'Initial Capital',
            final_value: 'Final Value',
            total_return: 'Total Return',
            cagr: 'CAGR',
            sharpe_ratio: 'Sharpe Ratio',
            max_drawdown: 'Max Drawdown',
            alpha: 'Alpha',
        }
    );
    downloadCSV(csv, `sentinelquant_backtests_${new Date().toISOString().split('T')[0]}.csv`);
}
