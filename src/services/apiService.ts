
import { Order, UserAccount, TopUpTransaction, Message, Product } from '@/types';

export const ApiService = {
  _getLocalOrders: (): Order[] => {
    const data = localStorage.getItem('mwstore_orders');
    return data ? JSON.parse(data) : [];
  },

  _saveLocalOrders: (orders: Order[]) => {
    localStorage.setItem('mwstore_orders', JSON.stringify(orders));
  },

  _getLocalTopUps: (): TopUpTransaction[] => {
    const data = localStorage.getItem('mwstore_topups');
    return data ? JSON.parse(data) : [];
  },

  _saveLocalTopUps: (topups: TopUpTransaction[]) => {
    localStorage.setItem('mwstore_topups', JSON.stringify(topups));
  },

  _getLocalProducts: (): Product[] => {
    const data = localStorage.getItem('mwstore_products');
    return data ? JSON.parse(data) : [];
  },

  _saveLocalProducts: (products: Product[]) => {
    localStorage.setItem('mwstore_products', JSON.stringify(products));
  },

  _getLocalMessages: (): Message[] => {
    const data = localStorage.getItem('mwstore_messages');
    return data ? JSON.parse(data) : [];
  },

  _saveLocalMessages: (messages: Message[]) => {
    localStorage.setItem('mwstore_messages', JSON.stringify(messages));
  },

  _getLocalSettings: () => {
    const data = localStorage.getItem('mwstore_settings');
    return data ? JSON.parse(data) : { maintenanceMode: false };
  },

  _saveLocalSettings: (settings: any) => {
    localStorage.setItem('mwstore_settings', JSON.stringify(settings));
  },

  _getLocalUsers: (): UserAccount[] => {
    const data = localStorage.getItem('mwstore_users');
    return data ? JSON.parse(data) : [];
  },

  _saveLocalUsers: (users: UserAccount[]) => {
    localStorage.setItem('mwstore_users', JSON.stringify(users));
  },

  // Get user profile
  getUser: async (username: string): Promise<UserAccount | null> => {
    const users = ApiService._getLocalUsers();
    return users.find(u => u.username === username) || null;
  },

  // Save/Update user profile
  saveUser: async (user: UserAccount, username: string) => {
    const users = ApiService._getLocalUsers();
    const index = users.findIndex(u => u.username === username);
    if (index !== -1) {
      users[index] = { ...users[index], ...user };
    } else {
      users.push(user);
    }
    ApiService._saveLocalUsers(users);
  },

  // Get all users (Admin only)
  getUsers: async (): Promise<UserAccount[]> => {
    return ApiService._getLocalUsers();
  },

  // Helper to save whole list
  saveUsers: (users: UserAccount[]) => {
    ApiService._saveLocalUsers(users);
  },

  // Orders
  getOrders: async (username: string, isAdmin: boolean = false): Promise<Order[]> => {
    const allOrders = ApiService._getLocalOrders();
    if (isAdmin) return allOrders;
    return allOrders.filter(o => o.username === username);
  },

  createOrder: async (order: Order, username: string) => {
    const orders = ApiService._getLocalOrders();
    orders.unshift({ ...order, username });
    ApiService._saveLocalOrders(orders);
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const orders = ApiService._getLocalOrders();
    const index = orders.findIndex(o => o.id === orderId);
    if (index !== -1) {
      orders[index].status = status as any;
      ApiService._saveLocalOrders(orders);
    }
  },

  // Top Ups
  getTopUps: async (username: string, isAdmin: boolean = false): Promise<TopUpTransaction[]> => {
    const allTopUps = ApiService._getLocalTopUps();
    if (isAdmin) return allTopUps;
    return allTopUps.filter(t => t.username === username);
  },

  createTopUp: async (topup: TopUpTransaction, username: string) => {
    const topups = ApiService._getLocalTopUps();
    topups.unshift({ ...topup, username });
    ApiService._saveLocalTopUps(topups);
  },

  updateTopUpStatus: async (topupId: string, status: string) => {
    const topups = ApiService._getLocalTopUps();
    const index = topups.findIndex(t => t.id === topupId);
    if (index !== -1) {
      topups[index].status = status as any;
      ApiService._saveLocalTopUps(topups);
    }
  },

  // Products
  getProducts: async (): Promise<Product[]> => {
    let products = ApiService._getLocalProducts();
    // Filter out deleted products if any (redundant if using splicing but good to have)
    products = products.filter(p => !p.deleted);
    return products;
  },

  saveProducts: (products: Product[]) => {
    ApiService._saveLocalProducts(products);
  },

  saveProduct: async (product: Product) => {
    const products = ApiService._getLocalProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      products[index] = product;
    } else {
      products.push(product);
    }
    ApiService._saveLocalProducts(products);
  },

  deleteProduct: async (productId: string) => {
    const products = ApiService._getLocalProducts();
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
      // Real delete as requested for better UX if local
      products.splice(index, 1);
      ApiService._saveLocalProducts(products);
    }
  },

  // Messages
  listenToMessages: (username: string, isAdmin: boolean, callback: (messages: Message[]) => void) => {
    const checkMessages = () => {
      const allMessages = ApiService._getLocalMessages();
      const filtered = isAdmin 
        ? allMessages 
        : allMessages.filter(m => m.senderUid === username || m.recipient === username);
      callback(filtered);
    };

    checkMessages();
    const interval = setInterval(checkMessages, 2000);
    return () => clearInterval(interval);
  },

  sendMessage: async (message: Message, username: string) => {
    const messages = ApiService._getLocalMessages();
    messages.unshift({ ...message, senderUid: username });
    ApiService._saveLocalMessages(messages);
  },

  markAsRead: async (messageId: string) => {
    const messages = ApiService._getLocalMessages();
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      messages[index].read = true;
      ApiService._saveLocalMessages(messages);
    }
  },

  updateBalanceByUsername: async (username: string, newBalance: number) => {
    const users = ApiService._getLocalUsers();
    const index = users.findIndex(u => u.username === username);
    if (index !== -1) {
      users[index].balance = newBalance;
      ApiService._saveLocalUsers(users);
      return true;
    }
    return false;
  },

  // Maintenance
  listenToSettings: (callback: (settings: any) => void) => {
    const checkSettings = () => {
      callback(ApiService._getLocalSettings());
    };
    checkSettings();
    const interval = setInterval(checkSettings, 5000);
    return () => clearInterval(interval);
  },

  setMaintenanceMode: async (status: boolean) => {
    const settings = ApiService._getLocalSettings();
    settings.maintenanceMode = status;
    ApiService._saveLocalSettings(settings);
  }
};
