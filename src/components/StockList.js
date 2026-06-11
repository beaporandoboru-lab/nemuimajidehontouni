import { formatUSD } from './Header.js';
import { generateHistory } from '../mockData.js';

// Cache historical data for sparklines so we don't regenerate on every tick
const sparklineHistoryCache = {};

export function renderStockList(containerId, stocks, activeSymbol, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  stocks.forEach(stock => {
    const isSelected = stock.symbol === activeSymbol;
    const card = document.createElement('div');
    card.className = `stock-ticker-card ${isSelected ? 'active' : ''}`;
    card.id = `ticker-${stock.symbol}`;
    card.dataset.symbol = stock.symbol;

    const chgClass = stock.changePercent >= 0 ? 'up' : 'down';
    const chgSign = stock.changePercent >= 0 ? '+' : '';

    card.innerHTML = `
      <div class="ticker-info">
        <span class="ticker-symbol">${stock.symbol}</span>
        <span class="ticker-name">${stock.name}</span>
      </div>
      <canvas class="ticker-chart-mini" id="sparkline-${stock.symbol}" width="60" height="24"></canvas>
      <div class="ticker-prices">
        <span class="ticker-price" id="ticker-price-${stock.symbol}">${formatUSD(stock.price)}</span>
        <span class="ticker-change ${chgClass}" id="ticker-change-${stock.symbol}">
          ${chgSign}${stock.changePercent}%
        </span>
      </div>
    `;

    card.addEventListener('click', () => {
      // Toggle active states in DOM
      document.querySelectorAll('.stock-ticker-card').forEach(el => el.classList.remove('active'));
      card.classList.add('active');
      onSelect(stock.symbol);
    });

    container.appendChild(card);

    // Draw sparkline
    drawSparkline(stock);
  });
}

export function updateStockListPrices(stocks) {
  stocks.forEach(stock => {
    const priceEl = document.getElementById(`ticker-price-${stock.symbol}`);
    const changeEl = document.getElementById(`ticker-change-${stock.symbol}`);
    if (!priceEl || !changeEl) return;

    const currentText = priceEl.textContent;
    const newText = formatUSD(stock.price);

    if (currentText !== newText) {
      // Determine direction of price change for animation flash
      const isUp = stock.isUp;
      priceEl.className = 'ticker-price'; // reset
      void priceEl.offsetWidth; // trigger reflow
      priceEl.classList.add(isUp ? 'flash-up' : 'flash-down');
      
      priceEl.textContent = newText;
    }

    const chgClass = stock.changePercent >= 0 ? 'up' : 'down';
    const chgSign = stock.changePercent >= 0 ? '+' : '';
    changeEl.className = `ticker-change ${chgClass}`;
    changeEl.textContent = `${chgSign}${stock.changePercent}%`;
  });
}

function drawSparkline(stock) {
  const canvas = document.getElementById(`sparkline-${stock.symbol}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Retrieve or generate historical price points
  let history = sparklineHistoryCache[stock.symbol];
  if (!history) {
    history = generateHistory(stock.price, stock.prevPrice, 15);
    sparklineHistoryCache[stock.symbol] = history;
  }

  const prices = history.map(h => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const width = canvas.width;
  const height = canvas.height;
  const padding = 2;

  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  
  // Set trend color based on final relative trajectory
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUpTrend = lastPrice >= firstPrice;
  
  ctx.strokeStyle = isUpTrend ? '#00ff88' : '#ff4a5a';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  history.forEach((h, index) => {
    const x = (index / (history.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((h.price - min) / range) * (height - padding * 2) - padding;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw gradient fill under the sparkline
  ctx.lineTo((width - padding), height);
  ctx.lineTo(padding, height);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, isUpTrend ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 74, 90, 0.15)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fill();
}
