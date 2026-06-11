import { store } from '../store.js';
import { formatUSD } from './Header.js';

/**
 * Render the full Administrative Panel
 * @param {string} containerId - Element container ID
 * @param {Array<object>} stocks - Current running list of stocks in main memory
 * @param {Function} onAdminActionExecuted - Callback to refresh views after admin change
 */
export function renderAdminPanel(containerId, stocks, onAdminActionExecuted) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const users = store.getAllUsers();
  const currentPrices = {};
  stocks.forEach(s => {
    currentPrices[s.symbol] = s.price;
  });

  // Renders User Management List
  let userRows = '';
  users.forEach(user => {
    // Calculate portfolio holdings value for this specific user
    let holdingsValue = 0;
    Object.keys(user.holdings).forEach(symbol => {
      const holding = user.holdings[symbol];
      const curPrice = currentPrices[symbol] || holding.avgPrice;
      holdingsValue += holding.shares * curPrice;
    });

    const netAssets = user.cash + holdingsValue;
    const isCurrentUser = store.getCurrentUser()?.id === user.id;

    userRows += `
      <tr>
        <td class="symbol-col">${user.id} ${isCurrentUser ? '<span class="text-green">(あなた)</span>' : ''}</td>
        <td>${user.name}</td>
        <td>
          <div class="override-input-group">
            <input type="number" step="100" class="admin-input-small" id="cash-input-${user.id}" value="${user.cash.toFixed(2)}">
            <button class="admin-action-btn" onclick="window.adminUpdateCash('${user.id}')">設定</button>
          </div>
        </td>
        <td>${formatUSD(holdingsValue)}</td>
        <td style="font-weight: 700;">${formatUSD(netAssets)}</td>
        <td>
          <span class="badge ${user.isFrozen ? 'frozen' : 'active'}">
            ${user.isFrozen ? '凍結中' : '稼働中'}
          </span>
        </td>
        <td>
          <div class="override-input-group">
            <button class="admin-action-btn ${user.isFrozen ? 'success-action' : 'danger-action'}" onclick="window.adminToggleFreeze('${user.id}')">
              ${user.isFrozen ? '凍結解除' : '口座凍結'}
            </button>
            <button class="admin-action-btn danger-action" onclick="window.adminDeleteUser('${user.id}')" ${user.id === 'NV-1001' ? 'disabled' : ''}>
              削除
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  // Renders stock overrides settings grid
  let stockRows = '';
  const overrides = store.getPriceOverrides();

  stocks.forEach(stock => {
    const isOverridden = overrides[stock.symbol] !== undefined;
    const overrideVal = isOverridden ? overrides[stock.symbol] : '';

    stockRows += `
      <div class="override-row">
        <div class="override-stock-info">
          <span class="override-symbol">${stock.symbol}</span>
          <span class="override-name">${stock.name}</span>
        </div>
        <div class="override-input-group">
          <input type="number" step="0.01" class="admin-input-small" id="price-override-${stock.symbol}" placeholder="${stock.price.toFixed(2)}" value="${overrideVal}">
          <button class="admin-action-btn" onclick="window.adminSetPriceOverride('${stock.symbol}')">適用</button>
          <button class="admin-action-btn danger-action" onclick="window.adminClearPriceOverride('${stock.symbol}')" ${!isOverridden ? 'disabled' : ''}>解除</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <!-- Left Panel: User Management -->
    <div class="admin-section glass-card">
      <div class="panel-header">
        <h2>口座マネージャー</h2>
      </div>
      <div class="admin-table-container">
        <table class="portfolio-table">
          <thead>
            <tr>
              <th>口座ID</th>
              <th>名義</th>
              <th>買付余力 (米ドル)</th>
              <th>株式評価額</th>
              <th>総資産額</th>
              <th>ステータス</th>
              <th>管理メニュー</th>
            </tr>
          </thead>
          <tbody>
            ${userRows}
          </tbody>
        </table>
      </div>
      
      <!-- System Reset Widget -->
      <div style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
        <h3 style="font-size: 0.9rem; color: var(--danger); margin-bottom: 8px;">システムメンテナンス</h3>
        <button class="admin-action-btn danger-action" onclick="window.adminResetAllSystem()" style="padding: 10px 16px;">
          全口座および株価設定のデータベース初期化
        </button>
      </div>
    </div>

    <!-- Right Panel: Manual Price Overrides -->
    <div class="admin-section glass-card">
      <div class="panel-header">
        <h2>株価手動設定</h2>
      </div>
      <p class="auth-description" style="text-align: left;">
        特定の銘柄の株価を強制的に設定します。空白にして「適用」または「解除」をクリックすると、スプレッドシートに基づく基準値に戻ります。
      </p>
      <div class="admin-override-grid">
        ${stockRows}
      </div>
    </div>
  `;

  // Define global handlers on window for onClick actions to work in raw HTML strings
  window.adminUpdateCash = (userId) => {
    const input = document.getElementById(`cash-input-${userId}`);
    if (input) {
      store.updateUserCash(userId, input.value);
      if (onAdminActionExecuted) onAdminActionExecuted();
    }
  };

  window.adminToggleFreeze = (userId) => {
    store.toggleUserFreeze(userId);
    if (onAdminActionExecuted) onAdminActionExecuted();
  };

  window.adminDeleteUser = (userId) => {
    if (confirm(`口座ID: ${userId} を削除しますか？ (この操作は取り消せません)`)) {
      try {
        store.deleteUser(userId);
        if (onAdminActionExecuted) onAdminActionExecuted();
      } catch (e) {
        alert(e.message);
      }
    }
  };

  window.adminSetPriceOverride = (symbol) => {
    const input = document.getElementById(`price-override-${symbol}`);
    if (input) {
      store.setPriceOverride(symbol, input.value);
      if (onAdminActionExecuted) onAdminActionExecuted();
    }
  };

  window.adminClearPriceOverride = (symbol) => {
    store.setPriceOverride(symbol, null);
    if (onAdminActionExecuted) onAdminActionExecuted();
  };

  window.adminResetAllSystem = () => {
    if (confirm('警告: すべてのユーザー口座、ウォレット残高、株価設定が消去されます。よろしいですか？')) {
      store.resetAllData();
      if (onAdminActionExecuted) onAdminActionExecuted();
    }
  };
}
