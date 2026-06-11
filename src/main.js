import { initialStocks, simulateTick } from './mockData.js';
import { renderHeader } from './components/Header.js';
import { renderStockList, updateStockListPrices } from './components/StockList.js';
import { renderChartHeader, updateChartHeaderLivePrice, initChart } from './components/StockChart.js';
import { renderTradePanel, updateTradePanelPrice } from './components/TradePanel.js';
import { renderHoldings, renderHistory } from './components/Portfolio.js';
import { renderAdminPanel } from './components/AdminPanel.js';
import { store } from './store.js';

// Application State
let stocks = [];
let activeSymbol = 'ACWI'; // Default to オルカン (eMAXIS Slim All-Country)
let activeRange = '1D';
let activeView = 'DASHBOARD'; // 'DASHBOARD' or 'ADMIN'

// Quick price map for easy store calculations { SYMBOL: currentPrice }
function getPricesMap() {
  const map = {};
  stocks.forEach(s => {
    map[s.symbol] = s.price;
  });
  return map;
}

function getActiveStock() {
  return stocks.find(s => s.symbol === activeSymbol);
}

// Bootstrap Initialization
function init() {
  // Initialize stocks structure
  stocks = initialStocks.map(s => {
    const price = s.basePrice;
    const change = Number((price - s.prevPrice).toFixed(2));
    const changePercent = Number(((change / s.prevPrice) * 100).toFixed(2));
    return {
      ...s,
      price,
      change,
      changePercent,
      isUp: true
    };
  });

  // Bind auth view toggles ONCE to prevent listener pile-ups
  const loginSubview = document.getElementById('auth-login-subview');
  const regSubview = document.getElementById('auth-register-subview');
  const linkToRegister = document.getElementById('link-to-register');
  const linkToLogin = document.getElementById('link-to-login');
  
  if (linkToRegister && linkToLogin) {
    linkToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginSubview.classList.add('hidden');
      regSubview.classList.remove('hidden');
      document.getElementById('login-alert').classList.add('hidden');
    });

    linkToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      regSubview.classList.add('hidden');
      loginSubview.classList.remove('hidden');
      document.getElementById('register-alert').classList.add('hidden');
    });
  }

  // Bind form submissions ONCE with preventDefault to avoid reloading the page
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault(); // Stop page reload
      const idInput = document.getElementById('login-id').value;
      const pinInput = document.getElementById('login-password').value;
      const loginAlert = document.getElementById('login-alert');

      try {
        store.login(idInput, pinInput);
        
        // Clear fields
        document.getElementById('login-id').value = '';
        document.getElementById('login-password').value = '';
        loginAlert.classList.add('hidden');

        activeView = 'DASHBOARD'; // Reset view to Dashboard on login
        setupRouting();
      } catch (err) {
        loginAlert.textContent = err.message;
        loginAlert.classList.remove('hidden');
      }
    });
  }

  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      e.preventDefault(); // Stop page reload
      const id = document.getElementById('reg-id').value;
      const name = document.getElementById('reg-name').value;
      const password = document.getElementById('reg-password').value;
      const regAlert = document.getElementById('register-alert');

      try {
        const newId = store.register(id, name, password);
        store.login(newId, password);

        // Clear fields
        document.getElementById('reg-id').value = '';
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-password').value = '';
        regAlert.classList.add('hidden');

        activeView = 'DASHBOARD'; // Redirect to trading view on registration
        setupRouting();
      } catch (err) {
        regAlert.textContent = err.message;
        regAlert.classList.remove('hidden');
      }
    });
  }

  setupRouting();
  startTickLoop();
  startClockLoop();
}

// Check auth state and active view parameters to toggle visibility classes
function setupRouting() {
  const currentUser = store.getCurrentUser();
  const authView = document.getElementById('auth-view');
  const dashboardLayout = document.getElementById('view-dashboard');
  const adminLayout = document.getElementById('view-admin');
  const pricesMap = getPricesMap();

  // 1. Refresh global header metrics (visible in both dashboard and admin, logged in or guest)
  renderHeader('app-header', pricesMap, activeView, handleViewToggle, handleLogout);

  if (activeView === 'ADMIN') {
    // Admin mode is selected
    authView.classList.add('hidden');
    dashboardLayout.classList.add('hidden');
    adminLayout.classList.remove('hidden');
    
    renderAdminPanel('admin-panel', stocks, handleAdminChange);
  } else {
    // Trading view is selected: check login gate status
    adminLayout.classList.add('hidden');
    
    if (!currentUser) {
      // User is not logged in: show credentials gateway
      authView.classList.remove('hidden');
      dashboardLayout.classList.add('hidden');
    } else {
      // User is logged in: show client trading dashboard
      authView.classList.add('hidden');
      dashboardLayout.classList.remove('hidden');
      
      setupUI();
    }
  }
}

function setupUI() {
  const activeStock = getActiveStock();
  const pricesMap = getPricesMap();

  // Apply any active admin overrides to the local prices array right away
  const overrides = store.getPriceOverrides();
  stocks = stocks.map(s => {
    if (overrides[s.symbol] !== undefined) {
      const targetVal = overrides[s.symbol];
      const change = Number((targetVal - s.prevPrice).toFixed(2));
      const changePercent = Number(((change / s.prevPrice) * 100).toFixed(2));
      return {
        ...s,
        price: targetVal,
        change,
        changePercent
      };
    }
    return s;
  });

  // 1. Render Stock List Panel
  renderStockList('stock-list', stocks, activeSymbol, handleStockSelect);

  // 2. Render Center Chart
  renderChartHeader('chart-header', activeStock);
  initChart('main-chart', activeStock, activeRange);

  // 3. Render Right Trade Panel
  renderTradePanel('trade-panel', activeStock, handleTradeExecuted);

  // 4. Render Bottom Portfolio Tables
  renderHoldings('tab-holdings', pricesMap, handleStockSelect);
  renderHistory('tab-history');

  // Bind Portfolio Tab Switching
  const tabButtons = document.querySelectorAll('.portfolio-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      if (targetTab === 'holdings') {
        document.getElementById('tab-holdings').classList.add('active');
        renderHoldings('tab-holdings', getPricesMap(), handleStockSelect);
      } else {
        document.getElementById('tab-history').classList.add('active');
        renderHistory('tab-history');
      }
    });
  });

  // Bind Chart Range Selector Buttons
  const rangeButtons = document.querySelectorAll('.filter-btn');
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      rangeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      activeRange = btn.dataset.range;
      initChart('main-chart', getActiveStock(), activeRange);
    });
  });

  // Expose global callback for Portfolio table actions
  window.selectStock = handleStockSelect;
}

// User Actions Handlers
function handleStockSelect(symbol) {
  activeSymbol = symbol;
  const activeStock = getActiveStock();
  
  // Highlight card in list
  document.querySelectorAll('.stock-ticker-card').forEach(card => {
    if (card.dataset.symbol === symbol) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Update Detail Chart Header & Data
  renderChartHeader('chart-header', activeStock);
  initChart('main-chart', activeStock, activeRange);

  // Update Order Entry Panel
  renderTradePanel('trade-panel', activeStock, handleTradeExecuted);
}

function handleTradeExecuted() {
  const pricesMap = getPricesMap();
  const activeStock = getActiveStock();

  // Redraw Header, Portfolio holdings and history logs
  renderHeader('app-header', pricesMap, activeView, handleViewToggle, handleLogout);
  renderHoldings('tab-holdings', pricesMap, handleStockSelect);
  renderHistory('tab-history');

  // Re-render Trade panel to reflect new balance and owned shares count
  renderTradePanel('trade-panel', activeStock, handleTradeExecuted);
}

function handleViewToggle() {
  activeView = activeView === 'DASHBOARD' ? 'ADMIN' : 'DASHBOARD';
  setupRouting();
}

function handleLogout() {
  activeView = 'DASHBOARD'; // Reset view back to Trading screen upon logging out
  setupRouting();
}

function handleAdminChange() {
  // Re-setup views to load updated database states or overridden stock values
  setupRouting();
}

// Live Simulated Loops
function startTickLoop() {
  // Tick every 3 seconds
  setInterval(() => {
    const overrides = store.getPriceOverrides();

    stocks = stocks.map(stock => {
      // Pass overrides to tick calculator
      const updates = simulateTick(stock, overrides);
      return {
        ...stock,
        ...updates
      };
    });

    const activeStock = getActiveStock();
    const pricesMap = getPricesMap();

    // If we are in Dashboard, update ticker quotes and live price indicators
    if (activeView === 'DASHBOARD') {
      // 1. Update stock tickers in left pane (flashing animations)
      updateStockListPrices(stocks);

      // 2. Update chart header live price (if not hovered)
      updateChartHeaderLivePrice(activeStock);

      // 3. Update order panel live price
      updateTradePanelPrice(activeStock);

      // 4. Update holdings table values (only if user is logged in)
      if (store.getCurrentUser()) {
        const holdingsTab = document.getElementById('tab-holdings');
        if (holdingsTab && holdingsTab.classList.contains('active')) {
          renderHoldings('tab-holdings', pricesMap, handleStockSelect);
        }
      }
    }

    // Update Header metrics silently (total assets change as prices fluctuate)
    if (store.getCurrentUser()) {
      const summary = store.getPortfolioSummary(pricesMap);
      const totalValEl = document.getElementById('header-total-value');
      const cashEl = document.getElementById('header-cash');
      const pnlEl = document.getElementById('header-pnl');

      if (totalValEl) totalValEl.textContent = formatUSD(summary.totalValue);
      if (cashEl) cashEl.textContent = formatUSD(summary.cash);
      if (pnlEl) {
        const isProfit = summary.totalGain >= 0;
        const gainSign = isProfit ? '+' : '';
        pnlEl.className = `stat-value ${summary.totalGain > 0 ? 'up' : (summary.totalGain < 0 ? 'down' : '')}`;
        pnlEl.textContent = `${gainSign}${formatUSD(summary.totalGain)} (${gainSign}${summary.totalGainPercent}%)`;
      }
    }
  }, 3000);
}

function startClockLoop() {
  setInterval(() => {
    const clockEl = document.getElementById('market-time');
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, 1000);
}

// Run on window load
window.addEventListener('DOMContentLoaded', init);
