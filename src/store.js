const STORAGE_KEY = 'nv_sec_multiuser_state_v2';

const DEFAULT_STATE = {
  users: {
    "NV-1001": {
      id: "NV-1001",
      name: "デモ顧客 A",
      password: "1234",
      cash: 50000.00,
      holdings: {},
      history: [],
      isFrozen: false
    }
  },
  currentUserId: null,
  priceOverrides: {} // { SYMBOL: number }
};

class Store {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Ensure default user exists if users list is wiped
        if (!parsed.users || Object.keys(parsed.users).length === 0) {
          parsed.users = JSON.parse(JSON.stringify(DEFAULT_STATE.users));
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse user state from localStorage', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save user state to localStorage', e);
    }
  }

  // Account Gateways
  register(id, name, password) {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) throw new Error('口座IDを入力してください。');
    if (this.state.users[cleanId]) throw new Error('この口座IDはすでに登録されています。');
    if (!password || !/^\d{4}$/.test(password)) throw new Error('暗証番号は4桁の数字である必要があります。');
    if (!name.trim()) throw new Error('お名前を入力してください。');

    this.state.users[cleanId] = {
      id: cleanId,
      name: name.trim(),
      password: password,
      cash: 50000.00, // Starting balance
      holdings: {},
      history: [],
      isFrozen: false
    };

    this.saveState();
    return cleanId;
  }

  login(id, password) {
    const cleanId = id.trim().toUpperCase();
    const user = this.state.users[cleanId];
    if (!user) {
      throw new Error('指定された口座IDが見つかりません。');
    }
    if (user.password !== password) {
      throw new Error('暗証番号が正しくありません。');
    }

    this.state.currentUserId = cleanId;
    this.saveState();
    return user;
  }

  logout() {
    this.state.currentUserId = null;
    this.saveState();
  }

  getCurrentUser() {
    if (!this.state.currentUserId) return null;
    return this.state.users[this.state.currentUserId] || null;
  }

  // Admin Controls
  getAllUsers() {
    return Object.values(this.state.users);
  }

  updateUserCash(userId, newCash) {
    const user = this.state.users[userId];
    if (!user) return;
    user.cash = Number(Math.max(0, parseFloat(newCash) || 0).toFixed(2));
    this.saveState();
  }

  toggleUserFreeze(userId) {
    const user = this.state.users[userId];
    if (!user) return;
    user.isFrozen = !user.isFrozen;
    this.saveState();
  }

  deleteUser(userId) {
    if (userId === 'NV-1001') {
      throw new Error('デフォルトのデモアカウントは削除できません。');
    }
    if (this.state.currentUserId === userId) {
      this.state.currentUserId = null;
    }
    delete this.state.users[userId];
    this.saveState();
  }

  setPriceOverride(symbol, newPrice) {
    const val = parseFloat(newPrice);
    if (isNaN(val) || val <= 0) {
      delete this.state.priceOverrides[symbol];
    } else {
      this.state.priceOverrides[symbol] = Number(val.toFixed(2));
    }
    this.saveState();
  }

  getPriceOverrides() {
    return this.state.priceOverrides || {};
  }

  resetAllData() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.saveState();
  }

  // Client Wallet Getters (scoped to logged-in user)
  getCash() {
    const user = this.getCurrentUser();
    return user ? user.cash : 0;
  }

  getHoldings() {
    const user = this.getCurrentUser();
    return user ? user.holdings : {};
  }

  getHistory() {
    const user = this.getCurrentUser();
    return user ? user.history : [];
  }

  buy(symbol, qty, price) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('ログインされていません。');
    if (user.isFrozen) {
      throw new Error('口座が凍結されています。取引を執行できません。カスタマーサポートへご連絡ください。');
    }
    if (qty <= 0 || isNaN(qty)) {
      throw new Error('数量は0より大きい値である必要があります。');
    }

    const cost = qty * price;
    if (user.cash < cost) {
      throw new Error('資金が不足しています。');
    }

    user.cash = Number((user.cash - cost).toFixed(2));

    if (!user.holdings[symbol]) {
      user.holdings[symbol] = { shares: 0, avgPrice: 0 };
    }

    const currentHoldings = user.holdings[symbol];
    const totalShares = currentHoldings.shares + qty;
    const totalCost = (currentHoldings.shares * currentHoldings.avgPrice) + cost;

    currentHoldings.shares = totalShares;
    currentHoldings.avgPrice = Number((totalCost / totalShares).toFixed(2));

    user.history.unshift({
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      type: 'BUY',
      symbol,
      qty,
      price,
      total: Number(cost.toFixed(2))
    });

    this.saveState();
  }

  sell(symbol, qty, price) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('ログインされていません。');
    if (user.isFrozen) {
      throw new Error('口座が凍結されています。取引を執行できません。カスタマーサポートへご連絡ください。');
    }

    const holdings = user.holdings[symbol];
    if (!holdings || holdings.shares < qty) {
      throw new Error('保有株数が不足しています。');
    }

    if (qty <= 0 || isNaN(qty)) {
      throw new Error('数量は0より大きい値である必要があります。');
    }

    const proceeds = qty * price;
    user.cash = Number((user.cash + proceeds).toFixed(2));

    holdings.shares = Number((holdings.shares - qty).toFixed(4));
    if (holdings.shares <= 0.0001) {
      delete user.holdings[symbol];
    }

    user.history.unshift({
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      type: 'SELL',
      symbol,
      qty,
      price,
      total: Number(proceeds.toFixed(2))
    });

    this.saveState();
  }

  getPortfolioSummary(currentPrices) {
    const user = this.getCurrentUser();
    if (!user) {
      return { cash: 0, holdingsValue: 0, totalValue: 0, totalGain: 0, totalGainPercent: 0 };
    }

    let holdingsValue = 0;
    let totalCostBasis = 0;

    Object.keys(user.holdings).forEach(symbol => {
      const holding = user.holdings[symbol];
      const curPrice = currentPrices[symbol] || holding.avgPrice;
      
      holdingsValue += holding.shares * curPrice;
      totalCostBasis += holding.shares * holding.avgPrice;
    });

    const totalValue = Number((user.cash + holdingsValue).toFixed(2));
    const totalGain = Number((holdingsValue - totalCostBasis).toFixed(2));
    const totalGainPercent = totalCostBasis > 0 
      ? Number(((holdingsValue - totalCostBasis) / totalCostBasis * 100).toFixed(2))
      : 0;

    return {
      cash: user.cash,
      holdingsValue: Number(holdingsValue.toFixed(2)),
      totalValue,
      totalGain,
      totalGainPercent
    };
  }
}

export const store = new Store();
export default store;
