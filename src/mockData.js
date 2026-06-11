// Initial Stock Definitions parsed from the spreadsheet (prices mapped to USD)
export const initialStocks = [
  {
    symbol: 'HOR',
    name: '蓬莱平均',
    basePrice: 49.63,
    prevPrice: 50.20,
    fullName: 'Hourai Average Index'
  },
  {
    symbol: 'NED',
    name: 'ネーデル平均',
    basePrice: 45.06,
    prevPrice: 45.64,
    fullName: 'Neder Average Index'
  },
  {
    symbol: 'BAB',
    name: 'バビロニア平均',
    basePrice: 8.22,
    prevPrice: 8.42,
    fullName: 'Babylonia Index'
  },
  {
    symbol: 'LUX',
    name: 'LUX指数',
    basePrice: 293.51,
    prevPrice: 307.85,
    fullName: 'LUX Composite Index'
  },
  {
    symbol: 'KOS',
    name: 'KOSPI',
    basePrice: 683.69,
    prevPrice: 716.41,
    fullName: 'Korean Composite Stock Index'
  },
  {
    symbol: 'HAN',
    name: '阪急企業',
    basePrice: 167.82,
    prevPrice: 174.50,
    fullName: 'Hankyu Enterprise Co.'
  },
  {
    symbol: 'MCS',
    name: 'MCSPI5',
    basePrice: 74.67,
    prevPrice: 75.46,
    fullName: 'MCS Sector Index 5'
  },
  {
    symbol: 'ACWI',
    name: 'オルカン',
    basePrice: 113.96,
    prevPrice: 118.68,
    fullName: 'eMAXIS Slim All-Country Equity'
  }
];

/**
 * Generates historical stock price data for the last N intervals (e.g. 30 days/hours)
 * @param {number} currentPrice - Starting current price
 * @param {number} prevPrice - Reference previous price to establish direction
 * @param {number} pointsCount - Number of points to generate (defaults to 30)
 * @returns {Array<{date: string, price: number}>}
 */
export function generateHistory(currentPrice, prevPrice, pointsCount = 30) {
  const history = [];
  let price = prevPrice;
  const time = new Date();
  
  // Calculate a reasonable daily volatility based on price magnitude
  const volatility = 0.015; // 1.5% daily volatility
  
  // Generate points backwards in time, then reverse
  for (let i = pointsCount - 1; i >= 0; i--) {
    const dateStr = new Date(time.getTime() - i * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric'
    });
    
    if (i === pointsCount - 1) {
      history.push({ date: dateStr, price: Number(currentPrice.toFixed(2)) });
      continue;
    }
    
    // Random Walk: P_t = P_t+1 * (1 - change)
    // Add a slight upward drift over the long term
    const drift = 0.001; 
    const change = (Math.random() - 0.48) * 2 * volatility + drift;
    price = price * (1 - change);
    
    // Floor price at $0.01
    if (price <= 0) price = 0.01;
    
    history.push({
      date: dateStr,
      price: Number(price.toFixed(2))
    });
  }
  
  // Ensure the history ends precisely at currentPrice and starts around prevPrice
  history[history.length - 1].price = Number(currentPrice.toFixed(2));
  
  return history;
}

/**
 * Simulates a single real-time market price tick (random walk)
 * @param {object} stock - The stock object to update
 * @param {object} overrides - Active price overrides map from store { SYMBOL: price }
 * @returns {object} - Updated stock fields: price, change, changePercent
 */
export function simulateTick(stock, overrides = {}) {
  // If admin has overridden the price, snap to it immediately
  const isOverridden = overrides[stock.symbol] !== undefined;
  const currentPrice = isOverridden ? overrides[stock.symbol] : (stock.price || stock.basePrice);
  
  let finalPrice;
  let isUp;
  
  if (isOverridden) {
    // If overridden, the price is locked/set by admin. Tick is flat or tiny walk.
    finalPrice = overrides[stock.symbol];
    isUp = finalPrice >= (stock.price || stock.basePrice);
  } else {
    // Volatility factor per tick (e.g. 3 seconds)
    const tickVolatility = 0.002; // 0.2% max change per tick
    
    // Random price change percentage (-0.2% to +0.22% with positive drift)
    const drift = 0.0001; // Tiny positive drift
    const pctChange = (Math.random() - 0.49) * 2 * tickVolatility + drift;
    
    const newPrice = Number((currentPrice * (1 + pctChange)).toFixed(2));
    
    // Avoid dropping to zero
    finalPrice = Math.max(0.01, newPrice);
    isUp = finalPrice >= currentPrice;
  }
  
  // Calculate relative change since yesterday's close (prevPrice)
  const change = Number((finalPrice - stock.prevPrice).toFixed(2));
  const changePercent = Number(((change / stock.prevPrice) * 100).toFixed(2));
  
  return {
    price: finalPrice,
    change: change,
    changePercent: changePercent,
    isUp: isUp
  };
}
