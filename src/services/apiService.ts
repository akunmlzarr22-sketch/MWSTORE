
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
import { db, auth } from '../lib/firebase';
import { Order, CartItem, UserAccount, TopUpTransaction, Message, Product } from '../types';

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
  // Get user profile
  getUser: async (uid: string): Promise<UserAccount | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      return userDoc.exists() ? userDoc.data() as UserAccount : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      return null;
    }
  },

  // Save/Update user profile
  saveUser: async (user: UserAccount, uid: string) => {
    try {
      await setDoc(doc(db, 'users', uid), user, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
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
      return querySnapshot.docs.map(d => d.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'products');
      return [];
    }
  },

  saveProduct: async (product: any) => {
    try {
      await setDoc(doc(db, 'products', product.id), product);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${product.id}`);
    }
  },

  deleteProduct: async (productId: string) => {
    try {
      await setDoc(doc(db, 'products', productId), { deleted: true }, { merge: true }); // Prefer soft delete
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
    try {
      const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), { balance: newBalance });
        return true;
      }
      return false;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/by-username/${username}`);
      return false;
    }
  },

  // Get all users (Admin only)
  getUsers: async (): Promise<UserAccount[]> => {
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as UserAccount);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return [];
    }
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
