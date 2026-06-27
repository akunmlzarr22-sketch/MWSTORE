import { Order, UserAccount, TopUpTransaction, Message, Product, Voucher, PaymentSettings } from '@/types';

// Mock operation type for internal compatibility
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Local Storage Keys
const KEYS = {
  USERS: 'mwstore_users',
  PRODUCTS: 'mwstore_products',
  ORDERS: 'mwstore_orders',
  TOPUPS: 'mwstore_topups',
  MESSAGES: 'mwstore_messages',
  VOUCHERS: 'mwstore_vouchers',
  SETTINGS: 'mwstore_settings',
  PAYMENT_SETTINGS: 'mwstore_payment_settings',
  ADMINS: 'mwstore_admins',
  AUTH_SESSION: 'mwstore_auth_session'
};

// Helper for parsing mixed timestamps
export const safeParseDate = (timestamp: any): Date => {
  if (!timestamp) return new Date(0);
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) return d;
  return new Date(0);
};

// Simple event-driven listener system
class StoreListener {
  private listeners: Record<string, ((data: any) => void)[]> = {};

  subscribe(key: string, callback: (data: any) => void) {
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(callback);
    return () => {
      this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    };
  }

  notify(key: string, data: any) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(cb => cb(data));
    }
  }
}

const store = new StoreListener();

// Persistence Helper
const Storage = {
  _syncInProgress: false,
  _syncPending: false,
  _loadedFromServer: false,

  get: <T>(key: string, defaultValue: T): T => {
    const data = localStorage.getItem(key);
    try {
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error("Storage parse error for key", key, e);
        return defaultValue;
    }
  },
  set: (key: string, data: any, silent: boolean = false) => {
    localStorage.setItem(key, JSON.stringify(data));
    store.notify(key, data);
    // Auto sync to server for persistence and webhook support
    if (!silent) {
      Storage.syncToServer();
    }
  },
// Remote Sync
  syncToServer: async (retryCount = 3) => {
    if (!Storage._loadedFromServer) {
      console.warn("ApiService: Skipping syncToServer because database has not been loaded from server yet.");
      return;
    }
    if (Storage._syncInProgress) {
      Storage._syncPending = true;
      return;
    }
    Storage._syncInProgress = true;
    Storage._syncPending = false;

    const db = {
      users: Storage.get(KEYS.USERS, {}),
      products: Storage.get(KEYS.PRODUCTS, []),
      orders: Storage.get(KEYS.ORDERS, []),
      topups: Storage.get(KEYS.TOPUPS, []),
      messages: Storage.get(KEYS.MESSAGES, []),
      vouchers: Storage.get(KEYS.VOUCHERS, []),
      paymentSettings: Storage.get(KEYS.PAYMENT_SETTINGS, null),
      settings: Storage.get(KEYS.SETTINGS, { maintenanceMode: false })
    };
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
      
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          const text = await response.text();
          if (text.includes("Starting Server...")) {
             console.warn("ApiService: Server booting, skipping sync retry.");
             Storage._syncInProgress = false;
             return;
          }
        }
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      // Delay before next sync to batch rapid alterations
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error("Server sync failed", e);
      if (retryCount > 0 && !Storage._syncPending) {
        console.warn(`Retrying sync... (${retryCount} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        Storage._syncInProgress = false;
        await Storage.syncToServer(retryCount - 1);
        return;
      }
    } finally {
      Storage._syncInProgress = false;
      if (Storage._syncPending) {
        // Run subsequent pending syncs immediately
        Storage.syncToServer();
      }
    }
  },
  fetchFromServer: async (retryCount = 10) => {
    // If a sync is currently in progress or pending, do NOT fetch from server to avoid over-riding local changes
    if (Storage._syncInProgress || Storage._syncPending) {
      console.warn("ApiService: Skipping fetchFromServer because local changes are currently syncing to server.");
      return;
    }

    // Add cache buster to prevent stale responses
    const url = `/api/db?t=${Date.now()}`;
    console.log(`ApiService: Fetching from ${url}... (Retries left: ${retryCount})`);
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      const contentType = res.headers.get("content-type");
      
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.warn(`ApiService: Received non-JSON or error response (${res.status}):`, text.substring(0, 200));
        
        // If we see "Starting Server..." it means the infrastructure is booting
        if (text.includes("Starting Server...") || text.includes("<title>Starting Server...</title>")) {
          if (retryCount > 0) {
            console.warn(`ApiService: Server is booting. Retrying in 4 seconds... (${retryCount} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 4000));
            return Storage.fetchFromServer(retryCount - 1);
          }
        }
        
        if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
        throw new Error(`Expected JSON but received ${contentType || 'unknown type'}.`);
      }
      
      const db = await res.json();
      if (db) {
        // Mark that we successfully synced from server
        Storage._loadedFromServer = true;

        // Verify again that no sync is in progress before writing to storage
        if (Storage._syncInProgress || Storage._syncPending) {
          console.warn("ApiService: Skipping storage update because local sync was triggered during fetch.");
          return;
        }

        // Use silent set to avoid sync loop
        if (db.users) Storage.set(KEYS.USERS, db.users, true);
        if (db.products) Storage.set(KEYS.PRODUCTS, db.products, true);
        if (db.orders) Storage.set(KEYS.ORDERS, db.orders, true);
        if (db.topups) Storage.set(KEYS.TOPUPS, db.topups, true);
        if (db.messages) Storage.set(KEYS.MESSAGES, db.messages, true);
        if (db.vouchers) Storage.set(KEYS.VOUCHERS, db.vouchers, true);
        if (db.paymentSettings) Storage.set(KEYS.PAYMENT_SETTINGS, db.paymentSettings, true);
        if (db.settings) Storage.set(KEYS.SETTINGS, db.settings, true);
      }
    } catch (e) {
      console.error("Server fetch failed", e);
      if (retryCount > 0) {
        console.warn(`Retrying fetch... (${retryCount} left)`);
        setTimeout(() => Storage.fetchFromServer(retryCount - 1), 2000);
      }
    }
  }
};

// Removed immediate initSync root call
// We will call it explicitly from the App component or a dedicated init function

export const ApiService = {
  initialize: async () => {
    try {
        console.log("ApiService: Initializing system connection...");
        // Use Storage.fetchFromServer which now has robust retry logic for "Starting Server" page
        await Storage.fetchFromServer();
        console.log("ApiService: Initialized successfully");
        
        // Seed products if empty (ONLY on initial launch if never seeded before)
        const products = Storage.get<Product[]>(KEYS.PRODUCTS, []);
        const alreadySeeded = localStorage.getItem('mwstore_seeded') === 'true';
        if (products.length === 0 && !alreadySeeded) {
          console.log("ApiService: Seeding initial products because database was empty...");
          const { MOCK_PRODUCTS } = await import('../constants');
          // Add default products including Nokos with isNokosApi configured
          const seededProducts = MOCK_PRODUCTS.map(p => {
            if (p.category.toLowerCase() === 'nokos') {
              return {
                ...p,
                isNokosApi: true,
                nokosCountry: p.id === 'nokos-wa-1' ? '6' : '6', // e.g. 6 is Indonesia in JasaOTP
                nokosService: p.id === 'nokos-wa-1' ? 'wa' : 'tg',
                nokosOperator: 'any'
              };
            }
            return p;
          });
          Storage.set(KEYS.PRODUCTS, seededProducts);
          localStorage.setItem('mwstore_seeded', 'true');
        } else if (products.length > 0) {
          // If we loaded products successfully, also mark as seeded so we don't clear and re-seed
          localStorage.setItem('mwstore_seeded', 'true');
        }
    } catch (e) {
        console.error("Initialization failed", e);
    }
  },
  syncFromServer: async () => {
    await Storage.fetchFromServer();
  },
  
  // Users Support
  waitForAuthInit: async (): Promise<any> => {
    await Storage.fetchFromServer();
    return Storage.get(KEYS.AUTH_SESSION, null);
  },

  ensureAuth: async (force: boolean = false) => {
    const session = Storage.get(KEYS.AUTH_SESSION, null);
    if (!session && force) {
        // Mock a guest session if forced
        const guestSession = { uid: 'guest-' + Math.random().toString(36).substr(2, 9), isAnonymous: true };
        Storage.set(KEYS.AUTH_SESSION, guestSession);
        return guestSession;
    }
    return session;
  },

  getCurrentUser: () => {
    return Storage.get(KEYS.AUTH_SESSION, null);
  },

  logout: async () => {
    localStorage.removeItem(KEYS.AUTH_SESSION);
    store.notify(KEYS.AUTH_SESSION, null);
  },

  getUser: async (username: string): Promise<UserAccount | null> => {
    const users = Storage.get<Record<string, UserAccount>>(KEYS.USERS, {});
    const actualKey = Object.keys(users).find(k => k.toLowerCase() === username.toLowerCase());
    return actualKey ? users[actualKey] : null;
  },

  saveUser: async (user: UserAccount, username: string) => {
    const users = Storage.get<Record<string, UserAccount>>(KEYS.USERS, {});
    const actualKey = Object.keys(users).find(k => k.toLowerCase() === username.toLowerCase()) || username;
    users[actualKey] = { ...user, username: actualKey };
    Storage.set(KEYS.USERS, users);
  },

  updateUserSession: async (username: string, sessionData: { uid: string, lastLogin: string }) => {
    const users = Storage.get<Record<string, UserAccount>>(KEYS.USERS, {});
    const actualKey = Object.keys(users).find(k => k.toLowerCase() === username.toLowerCase());
    if (actualKey && users[actualKey]) {
      users[actualKey] = { ...users[actualKey], ...sessionData };
      Storage.set(KEYS.USERS, users);
    }
    // Update active session too if it matches
    const session = Storage.get<any>(KEYS.AUTH_SESSION, null);
    if (session) {
        Storage.set(KEYS.AUTH_SESSION, { ...session, ...sessionData, username });
    }
  },

  getUsers: async (): Promise<UserAccount[]> => {
    const users = Storage.get<Record<string, UserAccount>>(KEYS.USERS, {});
    return Object.values(users);
  },

  listenToUser: (username: string, callback: (user: UserAccount | null) => void) => {
    const fetch = () => {
      const users = Storage.get<Record<string, UserAccount>>(KEYS.USERS, {});
      const actualKey = Object.keys(users).find(k => k.toLowerCase() === username.toLowerCase());
      callback(actualKey ? users[actualKey] : null);
    };
    fetch();
    return store.subscribe(KEYS.USERS, fetch);
  },

  listenToUsers: (isAdmin: boolean, callback: (users: UserAccount[]) => void) => {
    if (!isAdmin) return () => {};
    callback(Object.values(Storage.get<Record<string, UserAccount>>(KEYS.USERS, {})));
    return store.subscribe(KEYS.USERS, (users) => callback(Object.values(users)));
  },

  // Orders
  getOrders: (username?: string, isAdmin: boolean = false): Order[] => {
    const orders = Storage.get<Order[]>(KEYS.ORDERS, []);
    if (!username || isAdmin) return orders;
    return orders.filter(o => o.username === username);
  },

  createOrder: async (order: Order, username: string) => {
    const orders = Storage.get<Order[]>(KEYS.ORDERS, []);
    const newOrder = { ...order, username, id: order.id || Math.random().toString(36).substr(2, 9), date: order.date || new Date().toISOString() };
    orders.unshift(newOrder);
    Storage.set(KEYS.ORDERS, orders);
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const orders = Storage.get<Order[]>(KEYS.ORDERS, []);
    const index = orders.findIndex(o => o.id === orderId);
    if (index !== -1) {
      orders[index].status = status;
      Storage.set(KEYS.ORDERS, orders);
    }
  },

  listenToOrders: (username: string, isAdmin: boolean, callback: (orders: Order[]) => void) => {
    const fetch = () => {
        const orders = Storage.get<Order[]>(KEYS.ORDERS, []);
        callback(isAdmin ? orders : orders.filter(o => o.username === username));
    };
    fetch();
    return store.subscribe(KEYS.ORDERS, fetch);
  },

  // Top Ups
  getTopUps: async (username: string, isAdmin: boolean = false): Promise<TopUpTransaction[]> => {
    const topups = Storage.get<TopUpTransaction[]>(KEYS.TOPUPS, []);
    if (isAdmin) return topups;
    return topups.filter(t => t.username === username);
  },

  createTopUp: async (topup: TopUpTransaction, username: string) => {
    const topups = Storage.get<TopUpTransaction[]>(KEYS.TOPUPS, []);
    const newTopup = { ...topup, username, id: topup.id || Math.random().toString(36).substr(2, 9), date: topup.date || new Date().toISOString() };
    topups.unshift(newTopup);
    Storage.set(KEYS.TOPUPS, topups);
  },

  updateTopUpStatus: async (topupId: string, status: string) => {
    const topups = Storage.get<TopUpTransaction[]>(KEYS.TOPUPS, []);
    const index = topups.findIndex(t => t.id === topupId);
    if (index !== -1) {
      topups[index].status = status;
      Storage.set(KEYS.TOPUPS, topups);
    }
  },

  listenToTopUps: (username: string, isAdmin: boolean, callback: (topups: TopUpTransaction[]) => void) => {
    const fetch = () => {
        const topups = Storage.get<TopUpTransaction[]>(KEYS.TOPUPS, []);
        callback(isAdmin ? topups : topups.filter(t => t.username === username));
    };
    fetch();
    return store.subscribe(KEYS.TOPUPS, fetch);
  },

  deleteTopUp: async (topupId: string) => {
    const topups = Storage.get<TopUpTransaction[]>(KEYS.TOPUPS, []);
    const filtered = topups.filter(t => t.id !== topupId);
    Storage.set(KEYS.TOPUPS, filtered);
  },

  deleteAllTopUps: async () => Storage.set(KEYS.TOPUPS, []),
  deleteAllOrders: async () => Storage.set(KEYS.ORDERS, []),

  // Products
  getProducts: async (): Promise<Product[]> => {
    return Storage.get<Product[]>(KEYS.PRODUCTS, []);
  },

  saveProducts: async (products: Product[]) => {
    Storage.set(KEYS.PRODUCTS, products);
  },

  saveProduct: async (product: Product) => {
    const products = Storage.get<Product[]>(KEYS.PRODUCTS, []);
    const index = products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      products[index] = { ...products[index], ...product };
    } else {
      products.push(product);
    }
    Storage.set(KEYS.PRODUCTS, products);
  },

  updateProductStock: async (productId: string, stock: number, inventory?: string[]) => {
    const products = Storage.get<Product[]>(KEYS.PRODUCTS, []);
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
      products[index].stock = stock;
      if (inventory) products[index].inventory = inventory;
      Storage.set(KEYS.PRODUCTS, products);
    }
  },

  deleteProduct: async (productId: string) => {
    const products = Storage.get<Product[]>(KEYS.PRODUCTS, []);
    Storage.set(KEYS.PRODUCTS, products.filter(p => p.id !== productId));
  },

  listenToProducts: (callback: (products: Product[]) => void) => {
    callback(Storage.get<Product[]>(KEYS.PRODUCTS, []));
    return store.subscribe(KEYS.PRODUCTS, callback);
  },

  // Messages
  listenToMessages: (username: string, isAdmin: boolean, callback: (messages: Message[]) => void, type: 'all' | 'private' | 'community' = 'all') => {
    const fetch = () => {
      let msgs = Storage.get<Message[]>(KEYS.MESSAGES, []);
      if (!isAdmin) {
        msgs = msgs.filter(m => 
          m.sender === username || 
          m.recipient === username || 
          m.recipient === 'community'
        );
      }
      
      if (type === 'community') msgs = msgs.filter(m => m.recipient === 'community');
      else if (type === 'private') msgs = msgs.filter(m => m.recipient !== 'community');
      
      callback(msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    fetch();
    return store.subscribe(KEYS.MESSAGES, fetch);
  },

  sendMessage: async (message: Message, username: string) => {
    const msgs = Storage.get<Message[]>(KEYS.MESSAGES, []);
    const newMsg = { 
        ...message, 
        id: message.id || Math.random().toString(36).substr(2, 9),
        sender: message.sender || username,
        timestamp: message.timestamp || new Date().toISOString()
    };
    msgs.unshift(newMsg);
    Storage.set(KEYS.MESSAGES, msgs);
  },

  markAsRead: async (messageIds: string[]) => {
    const msgs = Storage.get<Message[]>(KEYS.MESSAGES, []);
    msgs.forEach(m => {
        if (messageIds.includes(m.id)) m.read = true;
    });
    Storage.set(KEYS.MESSAGES, msgs);
  },

  deleteMessage: async (messageId: string) => {
    const msgs = Storage.get<Message[]>(KEYS.MESSAGES, []);
    Storage.set(KEYS.MESSAGES, msgs.filter(m => m.id !== messageId));
  },

  clearCommunityChat: async () => {
    const msgs = Storage.get<Message[]>(KEYS.MESSAGES, []);
    Storage.set(KEYS.MESSAGES, msgs.filter(m => m.recipient !== 'community'));
  },

  deleteAllMessages: async () => Storage.set(KEYS.MESSAGES, []),

  // Balance
  updateBalanceByUsername: async (username: string, newBalance: number) => {
    const users = Storage.get<Record<string, UserAccount>>(KEYS.USERS, {});
    const actualKey = Object.keys(users).find(k => k.toLowerCase() === username.toLowerCase());
    if (actualKey && users[actualKey]) {
      users[actualKey].balance = newBalance;
      Storage.set(KEYS.USERS, users);
      return true;
    }
    return false;
  },

  // Settings
  listenToSettings: (callback: (settings: any) => void) => {
    const defaultSettings = { 
      maintenanceMode: false,
      activeMenus: {
        nokos: true,
        game: true,
        pulsa: true,
        ewallet: true,
        voucher: true,
        smm: true
      },
      nokosSettings: {
        provider: 'SMSHub',
        apiKey: '',
        baseUrl: 'https://smshub.org/api',
        isActive: false
      },
      smmSettings: {
        provider: 'Pipzpedia SMM',
        apiKey: '2e935e9150f29fd3703901b508f7ce19',
        baseUrl: 'https://pipzpedia.my.id/api/v2',
        isActive: true
      }
    };
    const current = Storage.get(KEYS.SETTINGS, defaultSettings);
    if (!current.activeMenus) {
      current.activeMenus = defaultSettings.activeMenus;
    } else if (current.activeMenus.smm === undefined) {
      current.activeMenus.smm = true;
    }
    if (!current.nokosSettings) {
      current.nokosSettings = defaultSettings.nokosSettings;
    }
    if (!current.smmSettings) {
      current.smmSettings = defaultSettings.smmSettings;
    }
    callback(current);
    return store.subscribe(KEYS.SETTINGS, (newVal) => {
      if (newVal) {
        if (!newVal.activeMenus) {
          newVal.activeMenus = defaultSettings.activeMenus;
        } else if (newVal.activeMenus.smm === undefined) {
          newVal.activeMenus.smm = true;
        }
        if (!newVal.nokosSettings) {
          newVal.nokosSettings = defaultSettings.nokosSettings;
        }
        if (!newVal.smmSettings) {
          newVal.smmSettings = defaultSettings.smmSettings;
        }
        callback(newVal);
      } else {
        callback(defaultSettings);
      }
    });
  },

  setMaintenanceMode: async (status: boolean) => {
    const defaultSettings = { 
      maintenanceMode: status,
      activeMenus: {
        nokos: true,
        game: true,
        pulsa: true,
        ewallet: true,
        voucher: true,
        smm: true
      },
      nokosSettings: {
        provider: 'SMSHub',
        apiKey: '',
        baseUrl: 'https://smshub.org/api',
        isActive: false
      },
      smmSettings: {
        provider: 'Pipzpedia SMM',
        apiKey: '2e935e9150f29fd3703901b508f7ce19',
        baseUrl: 'https://pipzpedia.my.id/api/v2',
        isActive: true
      }
    };
    const settings = Storage.get(KEYS.SETTINGS, defaultSettings);
    settings.maintenanceMode = status;
    Storage.set(KEYS.SETTINGS, settings);
  },

  setActiveMenus: async (activeMenus: Record<string, boolean>) => {
    const defaultSettings = { 
      maintenanceMode: false,
      activeMenus: activeMenus,
      nokosSettings: {
        provider: 'SMSHub',
        apiKey: '',
        baseUrl: 'https://smshub.org/api',
        isActive: false
      },
      smmSettings: {
        provider: 'Pipzpedia SMM',
        apiKey: '2e935e9150f29fd3703901b508f7ce19',
        baseUrl: 'https://pipzpedia.my.id/api/v2',
        isActive: true
      }
    };
    const settings = Storage.get(KEYS.SETTINGS, defaultSettings);
    settings.activeMenus = activeMenus;
    Storage.set(KEYS.SETTINGS, settings);
  },

  setNokosSettings: async (nokosSettings: { provider: string; apiKey: string; baseUrl?: string; isActive: boolean }) => {
    const defaultSettings = { 
      maintenanceMode: false,
      activeMenus: {
        nokos: true,
        game: true,
        pulsa: true,
        ewallet: true,
        voucher: true,
        smm: true
      },
      nokosSettings: nokosSettings,
      smmSettings: {
        provider: 'Pipzpedia SMM',
        apiKey: '2e935e9150f29fd3703901b508f7ce19',
        baseUrl: 'https://pipzpedia.my.id/api/v2',
        isActive: true
      }
    };
    const settings = Storage.get(KEYS.SETTINGS, defaultSettings);
    settings.nokosSettings = nokosSettings;
    Storage.set(KEYS.SETTINGS, settings);
  },

  setSmmSettings: async (smmSettings: { provider: string; apiKey: string; baseUrl?: string; isActive: boolean; markupPercent?: number; markupFlat?: number }) => {
    const defaultSettings = { 
      maintenanceMode: false,
      activeMenus: {
        nokos: true,
        game: true,
        pulsa: true,
        ewallet: true,
        voucher: true,
        smm: true
      },
      nokosSettings: {
        provider: 'SMSHub',
        apiKey: '',
        baseUrl: 'https://smshub.org/api',
        isActive: false
      },
      smmSettings: smmSettings
    };
    const settings = Storage.get(KEYS.SETTINGS, defaultSettings);
    settings.smmSettings = smmSettings;
    Storage.set(KEYS.SETTINGS, settings);
  },

  getPaymentSettings: async (): Promise<PaymentSettings | null> => {
    return Storage.get<PaymentSettings | null>(KEYS.PAYMENT_SETTINGS, null);
  },

  listenToPaymentSettings: (callback: (settings: PaymentSettings | null) => void) => {
    callback(Storage.get<PaymentSettings | null>(KEYS.PAYMENT_SETTINGS, null));
    return store.subscribe(KEYS.PAYMENT_SETTINGS, callback);
  },

  savePaymentSettings: async (settings: Omit<PaymentSettings, 'id'>) => {
    Storage.set(KEYS.PAYMENT_SETTINGS, { ...settings, id: 'payment' });
  },

  promoteToAdmin: async (uid: string, email: string = 'admin@mwstore.com') => {
    const admins = Storage.get<Record<string, any>>(KEYS.ADMINS, {});
    admins[uid] = { isAdmin: true, email };
    Storage.set(KEYS.ADMINS, admins);
    return true;
  },

  // Vouchers
  getVouchers: async (username: string, isAdmin: boolean): Promise<Voucher[]> => {
    const vouchers = Storage.get<Voucher[]>(KEYS.VOUCHERS, []);
    if (isAdmin) return vouchers;
    return vouchers.filter(v => v.recipient === username);
  },

  listenToVouchers: (username: string, isAdmin: boolean, callback: (vouchers: Voucher[]) => void) => {
    const fetch = () => {
      const vouchers = Storage.get<Voucher[]>(KEYS.VOUCHERS, []);
      callback(isAdmin ? vouchers : vouchers.filter(v => v.recipient === username));
    };
    fetch();
    return store.subscribe(KEYS.VOUCHERS, fetch);
  },

  createVoucher: async (voucher: Omit<Voucher, 'id'>) => {
    const vouchers = Storage.get<Voucher[]>(KEYS.VOUCHERS, []);
    vouchers.push({ ...voucher, id: voucher.code } as Voucher);
    Storage.set(KEYS.VOUCHERS, vouchers);
  },

  deleteVoucher: async (voucherId: string) => {
    const vouchers = Storage.get<Voucher[]>(KEYS.VOUCHERS, []);
    Storage.set(KEYS.VOUCHERS, vouchers.filter(v => v.id !== voucherId));
  },

  redeemVoucher: async (code: string) => {
    const vouchers = Storage.get<Voucher[]>(KEYS.VOUCHERS, []);
    const index = vouchers.findIndex(v => v.code === code);
    if (index !== -1) {
      vouchers[index].isUsed = true;
      vouchers[index].isActive = false;
      Storage.set(KEYS.VOUCHERS, vouchers);
    }
  },

  validateVoucher: async (code: string, username?: string): Promise<Voucher | null> => {
    const vouchers = Storage.get<Voucher[]>(KEYS.VOUCHERS, []);
    const voucher = vouchers.find(v => v.code === code);
    if (voucher && voucher.isActive && !voucher.isUsed) {
        if (voucher.recipient && voucher.recipient !== username) return null;
        return voucher;
    }
    return null;
  },
  
  // Dummy checkAndGrantReward for compatibility
  checkAndGrantReward: async (username: string): Promise<{ rewarded: boolean, amount: number }> => {
      return { rewarded: false, amount: 0 };
  },
  
  deleteUser: async (username: string) => {
      const users = Storage.get<Record<string, UserAccount>>(KEYS.USERS, {});
      delete users[username];
      Storage.set(KEYS.USERS, users);
  },
  
  deleteOrderHistoryByUsername: async (username: string) => {
      const orders = Storage.get<Order[]>(KEYS.ORDERS, []);
      Storage.set(KEYS.ORDERS, orders.filter(o => o.username !== username));
  },
  
  deleteChatByUsername: async (username: string) => {
      const msgs = Storage.get<Message[]>(KEYS.MESSAGES, []);
      Storage.set(KEYS.MESSAGES, msgs.filter(m => m.sender !== username && m.recipient !== username));
  }
};
