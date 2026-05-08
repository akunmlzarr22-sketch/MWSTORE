
import { Order, CartItem, UserAccount, TopUpTransaction, Message } from '../types';

/**
 * Konfigurasi API sesuai dengan script PHP Anda
 */
const API_CONFIG = {
  endpoint_domain: 'http://domain.test',
  api_id: '1',
  api_key: 'qyu6jo-q9nxke-rvi1ky-c4qkxi-vsfkix'
};

export const ApiService = {
  // Simulasi cek saldo (API: balance)
  getBalance: (username: string): number => {
    const users = ApiService.getUsers();
    const user = users.find(u => u.username === username);
    return user ? user.balance : 0;
  },

  // Simulasi Update Saldo
  updateBalance: (username: string, amount: number): boolean => {
    const users = ApiService.getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      users[userIndex].balance = amount;
      localStorage.setItem('mw_users', JSON.stringify(users));
      return true;
    }
    return false;
  },

  getUsers: (): UserAccount[] => {
    return JSON.parse(localStorage.getItem('mw_users') || '[]');
  },

  saveUsers: (users: UserAccount[]) => {
    localStorage.setItem('mw_users', JSON.stringify(users));
  },

  saveOrder: (order: Order) => {
    const existing = JSON.parse(localStorage.getItem('mw_orders') || '[]');
    localStorage.setItem('mw_orders', JSON.stringify([order, ...existing]));
  },

  saveOrders: (orders: Order[]) => {
    localStorage.setItem('mw_orders', JSON.stringify(orders));
  },

  getOrders: (): Order[] => {
    return JSON.parse(localStorage.getItem('mw_orders') || '[]');
  },

  saveTopUp: (topup: TopUpTransaction) => {
    const existing = JSON.parse(localStorage.getItem('mw_topups') || '[]');
    localStorage.setItem('mw_topups', JSON.stringify([topup, ...existing]));
  },

  saveTopUps: (topups: TopUpTransaction[]) => {
    localStorage.setItem('mw_topups', JSON.stringify(topups));
  },

  getTopUps: (): TopUpTransaction[] => {
    return JSON.parse(localStorage.getItem('mw_topups') || '[]');
  },

  getProducts: (fallback: any[]): any[] => {
    const stored = localStorage.getItem('mw_products');
    return stored ? JSON.parse(stored) : fallback;
  },

  saveProducts: (products: any[]) => {
    localStorage.setItem('mw_products', JSON.stringify(products));
  },

  getMaintenanceMode: (): boolean => {
    return localStorage.getItem('mw_maintenance') === 'true';
  },

  setMaintenanceMode: (status: boolean) => {
    localStorage.setItem('mw_maintenance', String(status));
  },

  // Simulasi membuat pesanan (API: order)
  createOrder: (username: string, items: CartItem[], total: number, method: string): Order => {
    const currentBalance = ApiService.getBalance(username);
    
    // Jika bayar pakai saldo, kurangi saldo otomatis
    if (method === 'Saldo Akun') {
      if (currentBalance >= total) {
        ApiService.updateBalance(username, currentBalance - total);
      }
    }

    const newOrder: Order = {
      id: Math.floor(100000 + Math.random() * 900000).toString(),
      items: [...items],
      totalAmount: total,
      date: new Date().toLocaleString('id-ID'),
      status: method === 'Saldo Akun' ? 'Proses' : 'Pending',
      paymentMethod: method,
      username: username
    };
    
    ApiService.saveOrder(newOrder);
    return newOrder;
  },

  getMessages: (): Message[] => {
    return JSON.parse(localStorage.getItem('mw_messages') || '[]');
  },

  saveMessages: (messages: Message[]) => {
    localStorage.setItem('mw_messages', JSON.stringify(messages));
  },

  sendMessage: (sender: string, recipient: string, content: string): Message => {
    const messages = ApiService.getMessages();
    const newMessage: Message = {
      id: Math.floor(100000 + Math.random() * 900000).toString(),
      sender,
      recipient,
      content,
      timestamp: new Date().toLocaleString('id-ID'),
      read: false
    };
    const updatedMessages = [newMessage, ...messages];
    ApiService.saveMessages(updatedMessages);
    return newMessage;
  },

  markAsRead: (messageIds: string[]) => {
    const messages = ApiService.getMessages();
    const updatedMessages = messages.map(m => 
      messageIds.includes(m.id) ? { ...m, read: true } : m
    );
    ApiService.saveMessages(updatedMessages);
  }
};
