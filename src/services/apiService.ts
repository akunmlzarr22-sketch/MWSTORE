
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Order, CartItem, UserAccount, TopUpTransaction, Message, Product } from '@/types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const ApiService = {
  // User Local Storage Helpers
  _getLocalUsers: (): UserAccount[] => {
    const users = localStorage.getItem('mwstore_users');
    return users ? JSON.parse(users) : [];
  },

  _saveLocalUsers: (users: UserAccount[]) => {
    localStorage.setItem('mwstore_users', JSON.stringify(users));
  },

  // Get user profile
  getUser: async (uid: string): Promise<UserAccount | null> => {
    const users = ApiService._getLocalUsers();
    // Assuming uid is username for local storage if not using Firebase Auth
    return users.find(u => u.username === uid) || null;
  },

  // Save/Update user profile
  saveUser: async (user: UserAccount, uid: string) => {
    const users = ApiService._getLocalUsers();
    const index = users.findIndex(u => u.username === uid);
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
  getOrders: async (uid: string, isAdmin: boolean = false): Promise<Order[]> => {
    try {
      const q = isAdmin 
        ? query(collection(db, 'orders'), orderBy('date', 'desc'))
        : query(collection(db, 'orders'), where('uid', '==', uid), orderBy('date', 'desc'));
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as Order);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      return [];
    }
  },

  createOrder: async (order: Order, uid: string) => {
    try {
      // Menambahkan uid ke order agar sesuai rule
      const orderWithUid = { ...order, uid };
      await setDoc(doc(db, 'orders', order.id), orderWithUid);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `orders/${order.id}`);
    }
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  // Top Ups
  getTopUps: async (uid: string, isAdmin: boolean = false): Promise<TopUpTransaction[]> => {
    try {
      const q = isAdmin
        ? query(collection(db, 'topups'), orderBy('date', 'desc'))
        : query(collection(db, 'topups'), where('uid', '==', uid), orderBy('date', 'desc'));
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as TopUpTransaction);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'topups');
      return [];
    }
  },

  createTopUp: async (topup: TopUpTransaction, uid: string) => {
    try {
      const topupWithUid = { ...topup, uid };
      await setDoc(doc(db, 'topups', topup.id), topupWithUid);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `topups/${topup.id}`);
    }
  },

  updateTopUpStatus: async (topupId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'topups', topupId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topups/${topupId}`);
    }
  },

  // Products
  getProducts: async (): Promise<any[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      // Filter out deleted products in JS just in case soft delete was used
      return querySnapshot.docs
        .map(d => d.data())
        .filter(p => !p.deleted);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'products');
      return [];
    }
  },

  saveProduct: async (product: any) => {
    try {
      console.log('Saving product:', product);
      await setDoc(doc(db, 'products', product.id), product);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${product.id}`);
    }
  },

  deleteProduct: async (productId: string) => {
    try {
      // Use real delete for better UX as rules allow it
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
    }
  },

  // Messages
  listenToMessages: (uid: string, isAdmin: boolean, callback: (messages: Message[]) => void) => {
    const q = isAdmin
      ? query(collection(db, 'messages'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'messages'), where('senderUid', '==', uid), orderBy('timestamp', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(d => d.data() as Message);
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });
  },

  sendMessage: async (message: Message, senderUid: string) => {
    try {
      const messageWithUid = { ...message, senderUid };
      await setDoc(doc(db, 'messages', message.id), messageWithUid);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `messages/${message.id}`);
    }
  },

  markAsRead: async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `messages/${messageId}`);
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
    return onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      callback(doc.data());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
  },

  setMaintenanceMode: async (status: boolean) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { maintenanceMode: status }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  }
};
