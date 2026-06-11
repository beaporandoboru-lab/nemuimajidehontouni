import { formatUSD } from './Header.js';
import { generateHistory } from '../mockData.js';

let chartHistory = [];
let hoveredPoint = null;
let canvasElement = null;
let chartActiveStock = null;
let currentRange = '1D';

export function renderChartHeader(containerId, stock) {
  const container = document.getElementById(containerId);
  if (!container) return;

  chartActiveStock = stock;
  const chgClass = stock.changePercent >= 0 ? 'up' : 'down';
  const chgSign = stock.changePercent >= 0 ? '+' : '';

  // Generate high/low/open based on current price
  const openPrice = stock.prevPrice;
  const highPrice = Math.max(stock.price, openPrice) * 1.012;
  const lowPrice = Math.min(stock.price, openPrice) * 0.988;

  container.innerHTML = `
    <div class="chart-title-area">
      <span class="chart-symbol">${stock.symbol}</span>
      <span class="chart-name">${stock.name} (${stock.fullName})</span>
    </div>
    <div class="chart-stats-area">
      <div class="chart-price-today">
        <span class="current-price-huge" id="chart-live-price">${formatUSD(stock.price)}</span>
        <span class="price-change-badge-huge ${chgClass}" id="chart-live-change">
          ${chgSign}${formatUSD(stock.change)} (${chgSign}${stock.changePercent}%)
        </span>
      </div>
      <div class="meta-stats-grid">
        <div class="meta-stat-item">
          <span class="meta-stat-label">前日終値</span>
          <span class="meta-stat-val">${formatUSD(openPrice)}</span>
        </div>
        <div class="meta-stat-item">
          <span class="meta-stat-label">始値</span>
          <span class="meta-stat-val">${formatUSD(openPrice * 1.002)}</span>
        </div>
        <div class="meta-stat-item">
          <span class="meta-stat-label">高値</span>
          <span class="meta-stat-val" id="chart-meta-high">${formatUSD(highPrice)}</span>
        </div>
        <div class="meta-stat-item">
          <span class="meta-stat-label">安値</span>
          <span class="meta-stat-val" id="chart-meta-low">${formatUSD(lowPrice)}</span>
        </div>
      </div>
    </div>
  `;
}

export function updateChartHeaderLivePrice(stock) {
  if (!stock || chartActiveStock?.symbol !== stock.symbol) return;
  
  // Only update if not hovering, otherwise we show the hovered price
  if (hoveredPoint !== null) return;

  const priceEl = document.getElementById('chart-live-price');
  const changeEl = document.getElementById('chart-live-change');
  if (priceEl && changeEl) {
    const chgClass = stock.changePercent >= 0 ? 'up' : 'down';
    const chgSign = stock.changePercent >= 0 ? '+' : '';
    
    priceEl.textContent = formatUSD(stock.price);
    changeEl.className = `price-change-badge-huge ${chgClass}`;
    changeEl.textContent = `${chgSign}${formatUSD(stock.change)} (${chgSign}${stock.changePercent}%)`;
  }
}

export function initChart(canvasId, stock, range = '1D') {
  canvasElement = document.getElementById(canvasId);
  if (!canvasElement) return;

  currentRange = range;
  chartActiveStock = stock;

  // Generate historical data based on selected range
  let pointsCount = 30; // 1M default
  if (range === '1D') pointsCount = 24; // 24 hours
  else if (range === '1W') pointsCount = 7;  // 7 days
  else if (range === '1M') pointsCount = 30; // 30 days

  chartHistory = generateHistory(stock.price, stock.prevPrice, pointsCount);
  hoveredPoint = null;

  // Setup Canvas high DPI
  resizeCanvas();
  drawChart();

  // Mouse interactivity
  canvasElement.addEventListener('mousemove', handleMouseMove);
  canvasElement.addEventListener('mouseleave', handleMouseLeave);
  
  // Watch window resize
  window.removeEventListener('resize', resizeCanvas);
  window.addEventListener('resize', () => {
    resizeCanvas();
    drawChart();
  });
}

function resizeCanvas() {
  if (!canvasElement) return;
  const rect = canvasElement.getBoundingClientRect();
  
  // Set logical canvas dimensions to match CSS display width
  const dpr = window.devicePixelRatio || 1;
  canvasElement.width = rect.width * dpr;
  canvasElement.height = rect.height * dpr;
  
  const ctx = canvasElement.getContext('2d');
  ctx.scale(dpr, dpr);
}

function drawChart() {
  if (!canvasElement || chartHistory.length === 0) return;
  const ctx = canvasElement.getContext('2d');
  if (!ctx) return;

  const width = canvasElement.width / (window.devicePixelRatio || 1);
  const height = canvasElement.height / (window.devicePixelRatio || 1);

  // Clear Canvas
  ctx.clearRect(0, 0, width, height);

  const paddingLeft = 10;
  const paddingRight = 50;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const prices = chartHistory.map(h => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  // Render Grid Lines (Horizontal & Vertical)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  
  // 3 Horizontal lines
  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (chartHeight * i) / 3;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    // Price Labels on right side
    const priceVal = max - (range * i) / 3;
    ctx.fillStyle = '#8e9bb2';
    ctx.font = '10px Outfit';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatUSD(priceVal), width - paddingRight + 8, y);
  }

  // Determine trend color (up or down)
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUpTrend = lastPrice >= firstPrice;
  const trendColor = isUpTrend ? '#00ff88' : '#ff4a5a';

  // Plot Line Chart
  ctx.beginPath();
  chartHistory.forEach((pt, index) => {
    const x = paddingLeft + (index / (chartHistory.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((pt.price - min) / range) * chartHeight;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.strokeStyle = trendColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = trendColor;
  ctx.shadowBlur = 10; // Glowing chart effect
  ctx.stroke();
  
  // Reset shadow for subsequent draws
  ctx.shadowBlur = 0;

  // Area gradient fill
  ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
  ctx.lineTo(paddingLeft, paddingTop + chartHeight);
  ctx.closePath();
  const fillGradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  fillGradient.addColorStop(0, isUpTrend ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 74, 90, 0.15)');
  fillGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fillGradient;
  ctx.fill();

  // Draw X Axis dates (at bottom)
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '10px Outfit';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  const labelSteps = 4;
  for (let i = 0; i < labelSteps; i++) {
    const index = Math.floor((i / (labelSteps - 1)) * (chartHistory.length - 1));
    const pt = chartHistory[index];
    if (pt) {
      const x = paddingLeft + (index / (chartHistory.length - 1)) * chartWidth;
      ctx.fillText(pt.date, x, paddingTop + chartHeight + 10);
    }
  }

  // Draw Hover Interactivity Details
  if (hoveredPoint !== null) {
    const hoverIndex = hoveredPoint.index;
    const pt = chartHistory[hoverIndex];
    const x = paddingLeft + (hoverIndex / (chartHistory.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((pt.price - min) / range) * chartHeight;

    // Draw vertical dotted line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, paddingTop);
    ctx.lineTo(x, paddingTop + chartHeight);
    ctx.stroke();
    ctx.setLineDash([]); // clear dash

    // Draw pulsing node at intersection
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = trendColor;
    ctx.shadowColor = trendColor;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Inner white dot
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Floating Tooltip rendering
    const tooltipText = `${pt.date}: ${formatUSD(pt.price)}`;
    ctx.font = 'bold 11px Outfit';
    const textWidth = ctx.measureText(tooltipText).width;
    const tooltipW = textWidth + 16;
    const tooltipH = 24;
    
    // Position tooltip to avoid edges
    let tooltipX = x - tooltipW / 2;
    if (tooltipX < paddingLeft) tooltipX = paddingLeft;
    if (tooltipX + tooltipW > width - paddingRight) tooltipX = width - paddingRight - tooltipW;
    
    const tooltipY = Math.max(paddingTop - 10, y - 35);

    // Draw tooltip box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 6);
    ctx.fill();
    ctx.stroke();

    // Draw text inside tooltip
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tooltipText, tooltipX + tooltipW / 2, tooltipY + tooltipH / 2);
  }
}

function handleMouseMove(e) {
  if (!canvasElement || chartHistory.length === 0) return;
  const rect = canvasElement.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;

  const paddingLeft = 10;
  const paddingRight = 50;
  const chartWidth = rect.width - paddingLeft - paddingRight;

  // Calculate matching historical point index
  const relativeX = mouseX - paddingLeft;
  let fraction = relativeX / chartWidth;
  if (fraction < 0) fraction = 0;
  if (fraction > 1) fraction = 1;

  const index = Math.round(fraction * (chartHistory.length - 1));
  const hoveredData = chartHistory[index];

  if (hoveredPoint === null || hoveredPoint.index !== index) {
    hoveredPoint = { index, data: hoveredData };
    drawChart();

    // Update Header price to match hovered price
    const priceEl = document.getElementById('chart-live-price');
    const changeEl = document.getElementById('chart-live-change');
    if (priceEl && changeEl && chartActiveStock) {
      priceEl.textContent = formatUSD(hoveredData.price);
      
      const openPrice = chartActiveStock.prevPrice;
      const change = Number((hoveredData.price - openPrice).toFixed(2));
      const changePct = Number(((change / openPrice) * 100).toFixed(2));
      const chgClass = change >= 0 ? 'up' : 'down';
      const chgSign = change >= 0 ? '+' : '';
      
      changeEl.className = `price-change-badge-huge ${chgClass}`;
      changeEl.textContent = `${chgSign}${formatUSD(change)} (${chgSign}${changePct}%)`;
    }
  }
}

function handleMouseLeave() {
  hoveredPoint = null;
  drawChart();

  // Restore live price display
  updateChartHeaderLivePrice(chartActiveStock);
}
