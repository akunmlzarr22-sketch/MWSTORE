import { Order, UserAccount, TopUpTransaction, Message, Product } from '@/types';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc,
  serverTimestamp,
  FieldValue
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Helper for parsing mixed timestamps (ISO or old format)
export const safeParseDate = (timestamp: string): Date => {
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) return d;
  
  // If it's an old string like "HH:mm:ss", pad it with today's date
  if (typeof timestamp === 'string' && timestamp.includes(':') && timestamp.split(':').length >= 2) {
    const [hours, minutes, seconds] = timestamp.split(':');
    const now = new Date();
    now.setHours(parseInt(hours) || 0);
    now.setMinutes(parseInt(minutes) || 0);
    now.setSeconds(parseInt(seconds || '0') || 0);
    return now;
  }
  
  return new Date(0); // Fallback to epoch
};

export const ApiService = {
  // Users
  getUser: async (username: string): Promise<UserAccount | null> => {
    const docRef = doc(db, 'users', username);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as UserAccount : null;
  },

  saveUser: async (user: UserAccount, username: string) => {
    await setDoc(doc(db, 'users', username), user, { merge: true });
  },

  getUsers: async (): Promise<UserAccount[]> => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => doc.data() as UserAccount);
  },

  saveUsers: async (users: UserAccount[]) => {
    for (const user of users) {
      await setDoc(doc(db, 'users', user.username), user, { merge: true });
    }
  },

  listenToUsers: (callback: (users: UserAccount[]) => void) => {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as UserAccount));
    });
  },

  // Orders
  getOrders: async (username: string, isAdmin: boolean = false): Promise<Order[]> => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    } else {
      q = query(collection(db, 'orders'), where('username', '==', username), orderBy('date', 'desc'));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  },

  createOrder: async (order: Order, username: string) => {
    await addDoc(collection(db, 'orders'), { ...order, username, createdAt: serverTimestamp() });
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const q = query(collection(db, 'orders'), where('id', '==', orderId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      await updateDoc(doc(db, 'orders', querySnapshot.docs[0].id), { status });
    }
  },

  listenToOrders: (username: string, isAdmin: boolean, callback: (orders: Order[]) => void) => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    } else {
      q = query(collection(db, 'orders'), where('username', '==', username), orderBy('date', 'desc'));
    }
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });
  },

  // Top Ups
  getTopUps: async (username: string, isAdmin: boolean = false): Promise<TopUpTransaction[]> => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'topups'), orderBy('date', 'desc'));
    } else {
      q = query(collection(db, 'topups'), where('username', '==', username), orderBy('date', 'desc'));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TopUpTransaction));
  },

  createTopUp: async (topup: TopUpTransaction, username: string) => {
    await addDoc(collection(db, 'topups'), { ...topup, username, createdAt: serverTimestamp() });
  },

  updateTopUpStatus: async (topupId: string, status: string) => {
    const q = query(collection(db, 'topups'), where('id', '==', topupId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      await updateDoc(doc(db, 'topups', querySnapshot.docs[0].id), { status });
    }
  },

  listenToTopUps: (username: string, isAdmin: boolean, callback: (topups: TopUpTransaction[]) => void) => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'topups'), orderBy('date', 'desc'));
    } else {
      q = query(collection(db, 'topups'), where('username', '==', username), orderBy('date', 'desc'));
    }
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TopUpTransaction)));
    });
  },

  // Products
  getProducts: async (): Promise<Product[]> => {
    const querySnapshot = await getDocs(collection(db, 'products'));
    return querySnapshot.docs.map(doc => doc.data() as Product);
  },

  saveProducts: async (products: Product[]) => {
    for (const product of products) {
      await setDoc(doc(db, 'products', product.id), product);
    }
  },

  saveProduct: async (product: Product) => {
    await setDoc(doc(db, 'products', product.id), product, { merge: true });
  },

  deleteProduct: async (productId: string) => {
    await deleteDoc(doc(db, 'products', productId));
  },

  deleteUser: async (username: string) => {
    await deleteDoc(doc(db, 'users', username));
  },

  listenToProducts: (callback: (products: Product[]) => void) => {
    return onSnapshot(collection(db, 'products'), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Product));
    });
  },

  // Messages
  listenToMessages: (username: string, isAdmin: boolean, callback: (messages: Message[]) => void) => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'));
    } else {
      q = query(
        collection(db, 'messages'), 
        where('recipient', 'in', [username, 'admin']),
        orderBy('timestamp', 'desc')
      );
    }
    
    return onSnapshot(q, (snapshot) => {
      let msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      if (!isAdmin) {
        msgs = msgs.filter(m => m.sender === username || m.recipient === username);
      }
      callback(msgs);
    });
  },

  sendMessage: async (message: Message, username: string) => {
    await addDoc(collection(db, 'messages'), { 
      ...message, 
      sender: message.sender || username, // Ensure 'sender' is present for filters
      senderUid: username, 
      createdAt: serverTimestamp() 
    });
  },

  markAsRead: async (messageIds: string[]) => {
    // Use Promise.all for faster execution
    await Promise.all(messageIds.map(async (messageId) => {
      try {
        const docRef = doc(db, 'messages', messageId);
        await updateDoc(docRef, { read: true });
      } catch (error) {
        console.warn(`Could not mark message ${messageId} as read:`, error);
      }
    }));
  },

  clearProducts: async () => {
    const querySnapshot = await getDocs(collection(db, 'products'));
    await Promise.all(querySnapshot.docs.map(doc => deleteDoc(doc.ref)));
  },

  updateBalanceByUsername: async (username: string, newBalance: number) => {
    try {
      const docRef = doc(db, 'users', username);
      await updateDoc(docRef, { balance: newBalance });
      return true;
    } catch (error) {
      console.error("Error updating balance:", error);
      return false;
    }
  },

  // Settings
  listenToSettings: (callback: (settings: any) => void) => {
    return onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      callback(doc.data() || { maintenanceMode: false });
    });
  },

  setMaintenanceMode: async (status: boolean) => {
    await setDoc(doc(db, 'settings', 'global'), { maintenanceMode: status }, { merge: true });
  }
};
