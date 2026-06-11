import { store } from '../store.js';
import { formatUSD } from './Header.js';

let activeTab = 'BUY'; // 'BUY' or 'SELL'
let panelActiveStock = null;

export function renderTradePanel(containerId, stock, onTradeExecuted) {
  const container = document.getElementById(containerId);
  if (!container) return;

  panelActiveStock = stock;
  const user = store.getCurrentUser();
  const holdings = store.getHoldings();
  const ownedShares = holdings[stock.symbol]?.shares || 0;
  const cash = store.getCash();
  const isFrozen = user?.isFrozen || false;

  container.innerHTML = `
    <div class="panel-header">
      <h2>注文発注</h2>
    </div>

    <!-- BUY / SELL Tab Selector -->
    <div class="trade-tabs">
      <button class="trade-tab-btn buy ${activeTab === 'BUY' ? 'active' : ''}" id="btn-tab-buy" ${isFrozen ? 'disabled' : ''}>買付</button>
      <button class="trade-tab-btn sell ${activeTab === 'SELL' ? 'active' : ''}" id="btn-tab-sell" ${isFrozen ? 'disabled' : ''}>売却</button>
    </div>

    <div class="trade-stock-header">
      <div class="ticker-info">
        <span class="ticker-symbol">${stock.symbol}</span>
        <span class="trade-stock-name">${stock.name}</span>
      </div>
      <span class="trade-stock-price" id="trade-live-price">${formatUSD(stock.price)}</span>
    </div>

    <!-- Trade Info Alert Banner -->
    <div class="panel-alert error ${isFrozen ? '' : 'hidden'}" id="trade-alert">
      ${isFrozen ? '<span>⚠️</span> 口座が凍結されています。取引を執行できません。' : ''}
    </div>

    <form class="trade-form" id="trade-execution-form" onsubmit="return false;">
      <div class="form-group">
        <div class="form-label-row">
          <span class="form-label">${activeTab === 'BUY' ? '買付可能残高' : '保有株数'}</span>
          <span class="form-sublabel" id="trade-available-asset">
            ${activeTab === 'BUY' ? formatUSD(cash) : `${ownedShares} 株`}
          </span>
        </div>
      </div>

      <!-- Quantity Input -->
      <div class="form-group">
        <div class="form-label-row">
          <span class="form-label">注文数量</span>
          <span class="form-sublabel" id="trade-max-calc-btn" style="${isFrozen ? 'pointer-events: none; opacity: 0.5;' : ''}">MAXを指定</span>
        </div>
        <div class="input-container">
          <input type="number" step="any" min="0.0001" placeholder="0" class="trade-input" id="trade-qty-input" required ${isFrozen ? 'disabled' : ''}>
          <span class="input-suffix">株</span>
        </div>
      </div>

      <!-- Quick Number Helper Buttons -->
      <div class="number-helpers">
        <button type="button" class="helper-btn" data-value="1" ${isFrozen ? 'disabled' : ''}>1</button>
        <button type="button" class="helper-btn" data-value="10" ${isFrozen ? 'disabled' : ''}>10</button>
        <button type="button" class="helper-btn" data-value="100" ${isFrozen ? 'disabled' : ''}>100</button>
        <button type="button" class="helper-btn" id="helper-half-btn" ${isFrozen ? 'disabled' : ''}>50%</button>
      </div>

      <!-- Order Summary Invoice Card -->
      <div class="trade-summary-card">
        <div class="summary-row">
          <span class="summary-label">概算単価</span>
          <span class="summary-value" id="summary-price">${formatUSD(stock.price)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">取引手数料</span>
          <span class="summary-value">無料 ($0.00)</span>
        </div>
        <div class="summary-row total">
          <span class="summary-label">概算注文総額</span>
          <span class="summary-value" id="summary-total">$0.00</span>
        </div>
      </div>

      <!-- Execution Button -->
      <button type="submit" class="execute-btn ${activeTab === 'BUY' ? 'buy' : 'sell'}" id="trade-submit-btn" disabled>
        ${activeTab === 'BUY' ? '買い注文を実行' : '売り注文を実行'}
      </button>
    </form>
  `;

  if (isFrozen) return; // Skip binding events if frozen

  // Bind Tab switching events
  document.getElementById('btn-tab-buy').addEventListener('click', () => {
    activeTab = 'BUY';
    renderTradePanel(containerId, stock, onTradeExecuted);
  });
  
  document.getElementById('btn-tab-sell').addEventListener('click', () => {
    activeTab = 'SELL';
    renderTradePanel(containerId, stock, onTradeExecuted);
  });

  // Bind input listeners
  const qtyInput = document.getElementById('trade-qty-input');
  const submitBtn = document.getElementById('trade-submit-btn');
  const summaryTotal = document.getElementById('summary-total');

  function updateCalculations() {
    const qty = parseFloat(qtyInput.value) || 0;
    const price = stock.price;
    const total = qty * price;

    summaryTotal.textContent = formatUSD(total);

    // Validate order size
    let isValid = qty > 0;
    if (activeTab === 'BUY') {
      isValid = isValid && total <= cash;
    } else {
      isValid = isValid && qty <= ownedShares;
    }

    submitBtn.disabled = !isValid;
  }

  qtyInput.addEventListener('input', updateCalculations);

  // Bind Helper Buttons
  document.querySelectorAll('.helper-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = parseInt(e.target.dataset.value);
      if (val) {
        qtyInput.value = val;
        updateCalculations();
      }
    });
  });

  document.getElementById('helper-half-btn').addEventListener('click', () => {
    if (activeTab === 'BUY') {
      const halfCash = cash / 2;
      qtyInput.value = Number((halfCash / stock.price).toFixed(4));
    } else {
      qtyInput.value = Number((ownedShares / 2).toFixed(4));
    }
    updateCalculations();
  });

  // Bind MAX button click
  const maxBtn = document.getElementById('trade-max-calc-btn');
  maxBtn.addEventListener('click', () => {
    if (activeTab === 'BUY') {
      qtyInput.value = Number((cash / stock.price).toFixed(4));
    } else {
      qtyInput.value = ownedShares;
    }
    updateCalculations();
  });

  // Bind Form Submit Action
  document.getElementById('trade-execution-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const qty = parseFloat(qtyInput.value);
    const price = stock.price;
    const alertBanner = document.getElementById('trade-alert');

    try {
      if (activeTab === 'BUY') {
        store.buy(stock.symbol, qty, price);
        showAlert(alertBanner, 'success', `${stock.name} を ${qty} 株購入しました。`);
      } else {
        store.sell(stock.symbol, qty, price);
        showAlert(alertBanner, 'success', `${stock.name} を ${qty} 株売却しました。`);
      }

      qtyInput.value = '';
      updateCalculations();
      
      if (onTradeExecuted) onTradeExecuted();
    } catch (err) {
      showAlert(alertBanner, 'error', `エラー: ${err.message}`);
    }
  });
}

export function updateTradePanelPrice(stock) {
  if (!stock || panelActiveStock?.symbol !== stock.symbol) return;
  const livePriceEl = document.getElementById('trade-live-price');
  const summaryPriceEl = document.getElementById('summary-price');
  if (livePriceEl && summaryPriceEl) {
    livePriceEl.textContent = formatUSD(stock.price);
    summaryPriceEl.textContent = formatUSD(stock.price);
    
    const qtyInput = document.getElementById('trade-qty-input');
    if (qtyInput && qtyInput.value) {
      const summaryTotal = document.getElementById('summary-total');
      const submitBtn = document.getElementById('trade-submit-btn');
      const cash = store.getCash();
      const holdings = store.getHoldings();
      const ownedShares = holdings[stock.symbol]?.shares || 0;

      const qty = parseFloat(qtyInput.value) || 0;
      const total = qty * stock.price;
      summaryTotal.textContent = formatUSD(total);

      let isValid = qty > 0;
      if (activeTab === 'BUY') {
        isValid = isValid && total <= cash;
      } else {
        isValid = isValid && qty <= ownedShares;
      }
      submitBtn.disabled = !isValid;
    }
  }
}

function showAlert(banner, type, message) {
  if (!banner) return;
  banner.className = `panel-alert ${type}`;
  banner.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span> ${message}`;
  
  // Fade out alert after 4 seconds
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 4000);
}
