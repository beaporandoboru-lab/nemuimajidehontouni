import { store } from '../store.js';
import { formatUSD } from './Header.js';

/**
 * Render user's current holdings
 * @param {string} containerId - Element ID for Holdings panel
 * @param {Object} currentPrices - Map of current stock prices { SYMBOL: price }
 * @param {Function} onSelectStock - Callback when user clicks "取引" action link
 */
export function renderHoldings(containerId, currentPrices, onSelectStock) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const holdings = store.getHoldings();
  const holdingsKeys = Object.keys(holdings);

  if (holdingsKeys.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 1.5rem;">📁</div>
        <span>現在、保有している銘柄はありません。</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">銘柄一覧から選択して購入してみましょう。</span>
      </div>
    `;
    return;
  }

  let tableRows = '';
  holdingsKeys.forEach(symbol => {
    const item = holdings[symbol];
    const curPrice = currentPrices[symbol] || item.avgPrice;
    const marketValue = item.shares * curPrice;
    const costBasis = item.shares * item.avgPrice;
    const profit = marketValue - costBasis;
    const profitPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    
    const profitClass = profit > 0 ? 'text-green' : (profit < 0 ? 'text-red' : '');
    const profitSign = profit > 0 ? '+' : '';

    tableRows += `
      <tr style="cursor: pointer;" class="holdings-row" data-symbol="${symbol}">
        <td class="symbol-col">${symbol}</td>
        <td>${item.shares.toFixed(4)} 株</td>
        <td>${formatUSD(item.avgPrice)}</td>
        <td>${formatUSD(curPrice)}</td>
        <td style="font-weight: 600;">${formatUSD(marketValue)}</td>
        <td class="${profitClass}" style="font-weight: 600;">
          ${profitSign}${formatUSD(profit)} (${profitSign}${profitPct.toFixed(2)}%)
        </td>
        <td style="text-align: right;">
          <button class="helper-btn" style="padding: 4px 8px; border-radius: 4px;" onclick="event.stopPropagation(); window.selectStock('${symbol}')">取引</button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="portfolio-table">
      <thead>
        <tr>
          <th>銘柄コード</th>
          <th>保有数量</th>
          <th>平均取得単価</th>
          <th>現在値</th>
          <th>評価額</th>
          <th>評価損益</th>
          <th style="text-align: right;">操作</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;

  // Bind row click to select stock
  document.querySelectorAll('.holdings-row').forEach(row => {
    row.addEventListener('click', () => {
      const symbol = row.dataset.symbol;
      if (onSelectStock) onSelectStock(symbol);
    });
  });
}

/**
 * Render user's historical transaction log
 * @param {string} containerId - Element ID for history panel
 */
export function renderHistory(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const history = store.getHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 1.5rem;">⏳</div>
        <span>まだ取引履歴はありません。</span>
      </div>
    `;
    return;
  }

  let tableRows = '';
  history.forEach(tx => {
    const dateStr = new Date(tx.timestamp).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const badgeClass = tx.type === 'BUY' ? 'buy' : 'sell';
    const typeLabel = tx.type === 'BUY' ? '買付' : '売却';

    tableRows += `
      <tr>
        <td style="color: var(--text-muted); font-variant-numeric: tabular-nums;">${dateStr}</td>
        <td style="font-weight: 700;">${tx.symbol}</td>
        <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
        <td>${tx.qty} 株</td>
        <td style="font-variant-numeric: tabular-nums;">${formatUSD(tx.price)}</td>
        <td style="font-weight: 600; font-variant-numeric: tabular-nums;">${formatUSD(tx.total)}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="portfolio-table">
      <thead>
        <tr>
          <th>日時</th>
          <th>銘柄</th>
          <th>取引区分</th>
          <th>数量</th>
          <th>約定単価</th>
          <th>受渡金額</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
}
