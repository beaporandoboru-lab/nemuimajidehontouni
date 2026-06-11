import { store } from '../store.js';

export function formatUSD(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Render Header with active user details and view toggles
 * @param {string} containerId - Element container ID
 * @param {Object} currentPrices - Current price values map { SYMBOL: price }
 * @param {string} activeView - Current active view: 'DASHBOARD' or 'ADMIN'
 * @param {Function} onViewToggle - Callback to toggle between 'DASHBOARD' and 'ADMIN'
 * @param {Function} onLogout - Callback when logout executes
 */
export function renderHeader(containerId, currentPrices, activeView, onViewToggle, onLogout) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = store.getCurrentUser();
  
  let statsHTML = '';
  let userCardHTML = '';
  
  if (user) {
    const summary = store.getPortfolioSummary(currentPrices);
    const isProfit = summary.totalGain >= 0;
    const gainSign = isProfit ? '+' : '';
    const gainClass = summary.totalGain > 0 ? 'up' : (summary.totalGain < 0 ? 'down' : '');
    
    statsHTML = `
      <div class="stat-group">
        <span class="stat-label">総資産評価額</span>
        <span class="stat-value" id="header-total-value">${formatUSD(summary.totalValue)}</span>
      </div>
      <div class="stat-group">
        <span class="stat-label">買付余力 (米ドル)</span>
        <span class="stat-value" id="header-cash">${formatUSD(summary.cash)}</span>
      </div>
      <div class="stat-group">
        <span class="stat-label">トータル評価損益</span>
        <span class="stat-value ${gainClass}" id="header-pnl">
          ${gainSign}${formatUSD(summary.totalGain)} (${gainSign}${summary.totalGainPercent}%)
        </span>
      </div>
    `;

    userCardHTML = `
      <div class="header-user-card">
        <span class="header-user-icon">👤</span>
        <span>${user.name} (${user.id})</span>
        <button class="logout-btn" id="header-logout-btn">ログアウト</button>
      </div>
    `;
  } else {
    // Guest layout before login
    statsHTML = `
      <div style="display: flex; align-items: center; color: var(--text-muted); font-size: 0.8rem; font-style: italic;">
        ※ 取引情報を表示するにはログインしてください
      </div>
    `;
    userCardHTML = `
      <div class="header-user-card" style="opacity: 0.75;">
        <span class="header-user-icon">👤</span>
        <span>ゲストユーザー</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="logo-section">
      <div class="logo-icon">NV</div>
      <div>
        <h1 style="font-weight: 800; font-size: 1.2rem; letter-spacing: 0.5px; line-height: 1.1;">NV証券</h1>
        <span style="font-size: 0.58rem; color: var(--primary); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">NV Securities Trading Portal</span>
      </div>
    </div>
    
    <div class="header-stats">
      ${statsHTML}
    </div>

    <div class="header-actions">
      ${userCardHTML}
      <button class="nav-btn ${activeView === 'ADMIN' ? 'secondary-nav' : ''}" id="header-view-toggle-btn">
        ${activeView === 'ADMIN' ? '取引画面へ' : '管理画面へ'}
      </button>
    </div>
  `;

  // Bind View Toggle - Guarded to prevent TypeErrors
  const toggleBtn = document.getElementById('header-view-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (onViewToggle) onViewToggle();
    });
  }

  // Bind Logout (only if user is logged in)
  const logoutBtn = document.getElementById('header-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      store.logout();
      if (onLogout) onLogout();
    });
  }
}
