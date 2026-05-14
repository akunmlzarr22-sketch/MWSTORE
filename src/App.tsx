
import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Search, ChevronRight, LayoutGrid, LayoutDashboard, Trash2, Plus, Minus, CreditCard, AlertCircle, ShoppingCart, Settings, LogOut, Wallet, QrCode, Building2, CheckCircle2, Copy, MessageCircle, Mail, RefreshCw, Download, Info, Share2, ExternalLink, X, Smartphone, Globe, Gamepad2, Receipt, ShieldCheck, Banknote, Sparkles, Check, Scan, Save, MonitorSmartphone, Clock, Coins, ArrowUpCircle, User, Menu, Users, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatIDR } from '@/constants';
import ProductCard from '@/components/ProductCard';
import AdminDashboard from '@/components/AdminDashboard';
import Login from '@/components/Login';
import UserProfile from '@/components/UserProfile';
import CustomerService from '@/components/CustomerService';
import CommunityChat from '@/components/CommunityChat';
import { APP_CONFIG } from '@/config';
import { ApiService } from '@/services/apiService';
import { Product, CartItem, Order, View, AuthState, UserRole, UserAccount, Message, Voucher, PaymentSettings, PaymentGatewayConfig } from '@/types';
// import { auth as firebaseAuth } from '@/lib/firebase';
// import { onAuthStateChanged } from 'firebase/auth';

const APP_VERSION = "v3.5.0";

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    role: null,
    username: null,
    balance: null
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  // Authenticated listener - Updated for Local Storage (keeping for session persistent login)
  useEffect(() => {
    const savedAuth = localStorage.getItem('mwstore_auth');
    if (savedAuth) {
      try {
        setAuth(JSON.parse(savedAuth));
      } catch (e) {
        localStorage.removeItem('mwstore_auth');
      }
    }
    
    // Establish session correctly by waiting for Firebase to tell us who the user is
    const initializeAuth = async () => {
      try {
        console.log("App: Initializing system...");
        
        // 0. Base Initialization (Health Check & Initial Fetch)
        await ApiService.initialize();
        
        // 1. Wait for Firebase to check if user was already logged in
        let currentUser = await ApiService.waitForAuthInit();
        console.log("App: Auth init finished. User UID:", currentUser?.uid);
        
        // 2. If no user found (Guest), attempt anonymous sign in
        if (!currentUser) {
          console.log("App: No session found, establishing anonymous guest session...");
          currentUser = await ApiService.ensureAuth();
          if (currentUser) {
            console.log("App: Guest session ready. UID:", currentUser.uid);
          } else {
            console.log("App: Note - Anonymous session could not be established. This is normal if Anonymous sign-in is disabled in your Firebase Console. Public data is still accessible.");
          }
        }

        // 3. Check local storage for legacy/saved admin session
        const savedAuthStr = localStorage.getItem('mwstore_auth');
        if (savedAuthStr) {
          try {
            const sAuth = JSON.parse(savedAuthStr);
            
            // Ensure admin promotion if saved as admin
            if (sAuth.role === 'admin') {
               if (currentUser) {
                 console.log("App: Admin role detected in storage, promoting UID:", currentUser.uid);
                 const success = await ApiService.promoteToAdmin(currentUser.uid, currentUser.email || 'admin@session.local');
                 console.log("App: Promotion success:", success);
               } else {
                 console.warn("App: Admin role in storage but NO FIREBASE USER to promote.");
               }
            }
            
            // Only sync state after potential promotion is initiated
            setAuth(sAuth);
          } catch (e) {
            console.error("Error restoring session:", e);
          }
        }

        // 4. Mark system ready
        setIsFirebaseReady(true);
        setIsLoading(false);
        console.log("App: System ready.");
        
        // 6. Ensure default payment settings if none exist
        const currentPayment = await ApiService.getPaymentSettings();
        if (!currentPayment) {
          console.log("App: No payment settings found, initializing defaults...");
          await ApiService.savePaymentSettings({
            gateways: [
              { provider: 'Pak Kasir', apiKey: '', isActive: false, mode: 'Production', slug: '' },
              { provider: 'Manual', apiKey: '', isActive: true, mode: 'Production', slug: '' }
            ],
            updatedAt: new Date().toISOString(),
            updatedBy: 'system'
          });
        }
      } catch (err) {
        console.error("App: Fatal initialization error:", err);
      } finally {
        setIsFirebaseReady(true);
        setIsLoading(false);
        console.log("App: System ready.");
      }
    };

    initializeAuth();

    return () => {};
  }, []);

  // Use Reactive Listeners for Products, Users, and Orders
  useEffect(() => {
    if (!isFirebaseReady) return;

    const unsubProducts = ApiService.listenToProducts((fetchedProducts) => {
      setProducts(fetchedProducts);
    });

    const unsubUsers = ApiService.listenToUsers(auth.role === 'admin' && isFirebaseReady, (fetchedUsers) => {
      if (fetchedUsers.length === 0 && auth.role === 'admin') {
        const initialAdmin: UserAccount = {
          username: 'admin',
          password: 'adminpassword',
          role: 'admin',
          balance: 999999999,
          email: 'admin@mwstore.com'
        };
        ApiService.saveUser(initialAdmin, 'admin');
      } else {
        setUsers(fetchedUsers);
      }
    });

    let unsubOrders = () => {};
    if (auth.isLoggedIn && auth.username && isFirebaseReady) {
      unsubOrders = ApiService.listenToOrders(auth.username, auth.role === 'admin', (fetchedOrders) => {
        setOrders(fetchedOrders);
      });
    }

    return () => {
      unsubProducts();
      unsubUsers();
      unsubOrders();
    };
  }, [auth.isLoggedIn, auth.role, auth.username, isFirebaseReady]);

  // Listen to current user specifically for balance updates
  useEffect(() => {
    if (!isFirebaseReady || !auth.isLoggedIn || !auth.username) {
      return;
    }

    const unsub = ApiService.listenToUser(auth.username, (userData) => {
      if (userData && userData.balance !== auth.balance) {
        const newAuth = { ...auth, balance: userData.balance };
        setAuth(newAuth);
        localStorage.setItem('mwstore_auth', JSON.stringify(newAuth));
      }
    });

    return () => unsub();
  }, [auth.username, auth.isLoggedIn, auth.balance, isFirebaseReady]);

  // Listen for maintenance mode
  useEffect(() => {
    if (!isFirebaseReady) return;
    const unsubscribe = ApiService.listenToSettings((settings) => {
      if (settings && settings.maintenanceMode) {
        setIsMaintenance(true);
      } else {
        setIsMaintenance(false);
      }
    });
    return () => unsubscribe();
  }, [isFirebaseReady]);

  const handleAddOrUpdateProduct = async (product: Product) => {
    const productToSave = { ...product, rating: product.rating || 5.0 };
    await ApiService.saveProduct(productToSave);
    // No need to manually setProducts, listener handles it
  };

  const handleUpdateUsers = React.useCallback((newUsers: UserAccount[]) => {
    // Listener handles it
  }, []);

  const handleDeleteUser = async (username: string) => {
    if (username === 'admin') {
      alert("Admin tidak dapat dihapus!");
      return;
    }
    await ApiService.deleteUser(username);
    alert(`Akun ${username} berhasil dihapus.`);
  };

  const handleResetUserHistory = async (username: string) => {
    alert(`Fitur reset riwayat untuk ${username} sedang diproses.`);
  };

  const handleUpdateOrder = async (orderId: string, status: any) => {
    await ApiService.updateOrderStatus(orderId, status);
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await ApiService.deleteProduct(id);
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Gagal menghapus produk. Silakan coba lagi.");
    }
  };

  const [view, setView] = useState<View>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [paymentMethod, setPaymentMethod] = useState<string>('Saldo Akun');
  const [topupPaymentMethod, setTopupPaymentMethod] = useState<string>('Manual WhatsApp');
  const [isProcessing, setIsProcessing] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>({
    id: 'payment',
    gateways: [
      { provider: 'Pak Kasir', apiKey: '', isActive: false, mode: 'Production', slug: '' },
      { provider: 'Manual', apiKey: '', isActive: true, mode: 'Production', slug: '' }
    ],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  });
  
  const lastProcessedMsgId = React.useRef<string | null>(null);
  const isInitialLoad = React.useRef(true);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load global settings
  useEffect(() => {
    const unsubscribePayment = ApiService.listenToPaymentSettings(settings => {
      if (settings) setPaymentSettings(settings);
    });
    
    const unsubscribeSystem = ApiService.listenToSettings((settings) => {
      if (settings) setIsMaintenance(settings.maintenanceMode);
    });
    
    return () => {
      unsubscribePayment();
      unsubscribeSystem();
    };
  }, []);

  // Periodic Server Sync (Background pull from server)
  useEffect(() => {
    if (!auth.isLoggedIn) return;
    
    // Check for updates every 10 seconds
    const syncInterval = setInterval(() => {
      ApiService.syncFromServer();
    }, 10000);
    
    return () => clearInterval(syncInterval);
  }, [auth.isLoggedIn]);

  // Sync unread messages and notifications
  useEffect(() => {
    if (auth.isLoggedIn && auth.username) {
      const normalizedUsername = auth.username.toLowerCase().trim();
      const unsubscribeMessages = ApiService.listenToMessages(normalizedUsername, auth.role === 'admin', (msgs) => {
        // Handle unread count
        const unreadCount = msgs.filter(m => 
          (m.recipient?.toLowerCase() === normalizedUsername || (auth.role === 'admin' && m.recipient === 'admin')) && 
          !m.read && 
          m.sender !== auth.username
        ).length;
        setUnreadMessages(unreadCount);

        // Handle notification flags
        const newestMsg = msgs[0];
        if (newestMsg && newestMsg.id !== lastProcessedMsgId.current) {
          lastProcessedMsgId.current = newestMsg.id;
        }
        isInitialLoad.current = false;
      }, 'all');
      
      const unsubscribeVouchers = ApiService.listenToVouchers(normalizedUsername, auth.role === 'admin' && isFirebaseReady, setVouchers);
      return () => {
        unsubscribeMessages();
        unsubscribeVouchers();
      };
    } else {
      isInitialLoad.current = true;
      lastProcessedMsgId.current = null;
    }
  }, [auth.isLoggedIn, auth.username, auth.role]);

  const categories = ['Semua', ...new Set(products.map(p => p.category))];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, products]);

  const handleLogin = async (role: UserRole, username: string) => {
    const normalizedUsername = username.toLowerCase().trim();
    let user = users.find(u => u.username.toLowerCase() === normalizedUsername);
    
    // If not in the local list (common for non-admins), fetch directly
    if (!user) {
      user = await ApiService.getUser(normalizedUsername) || undefined;
    }
    
    if (!user && role !== 'admin') {
      alert("Akun tidak ditemukan!");
      return;
    }

    // Promotion for legacy login
    if (role === 'admin') {
      const currentUser = await ApiService.ensureAuth(true); // Force auth for admin
      if (currentUser) {
        console.log("App: Admin session established. UID:", currentUser.uid);
        await ApiService.promoteToAdmin(currentUser.uid, user?.email || 'admin@session.local');
      } else {
        console.error("App: FAILED to establish Firebase session for admin. Permission errors will occur.");
        alert("Gagal menyambungkan ke server aman. Beberapa fitur admin mungkin tidak berfungsi.");
      }
    }

    const newAuth: AuthState = { 
      isLoggedIn: true, 
      role, 
      username: normalizedUsername, 
      balance: user?.balance || (role === 'admin' ? 999999999 : 0) 
    };
    setAuth(newAuth);
    localStorage.setItem('mwstore_auth', JSON.stringify(newAuth));
  };

  const handleRegister = (account: UserAccount): boolean => {
    // Note: Availability check is now handled in the Login component before calling onRegister
    
    const accountWithDate = {
      ...account,
      createdAt: new Date().toISOString()
    };
    ApiService.saveUser(accountWithDate, account.username);
    return true;
  };

  const handleLogout = async () => {
    await ApiService.logout();
    setAuth({ isLoggedIn: false, role: null, username: null, balance: null });
    localStorage.removeItem('mwstore_auth');
    setView('home');
    setCart([]);
  };

  const addToCart = (product: Product, redirect: boolean = false, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { ...product, quantity }];
    });
    if (redirect) setView('cart');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountAmount = appliedVoucher ? appliedVoucher.amount : 0;
  const finalTotal = Math.max(0, cartTotal - discountAmount);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleApplyVoucher = async () => {
    if (!voucherCode) return;
    const v = await ApiService.validateVoucher(voucherCode.toUpperCase(), auth.username || undefined);
    if (!v) {
      alert("Kode voucher tidak valid, sudah digunakan, kedaluwarsa, atau bukan milik Anda.");
      return;
    }
    if (v.minPurchase && cartTotal < v.minPurchase) {
      alert(`Voucher ini minimal pembelian ${formatIDR(v.minPurchase)}`);
      return;
    }
    
    setAppliedVoucher(v);
    alert(`Voucher ${v.code} berhasil dipasang! Potongan ${formatIDR(v.amount)}`);
  };

  const handleProcessPayment = () => {
    if (cart.length === 0) return;

    if (!auth.isLoggedIn) {
      alert("Silakan login terlebih dahulu untuk melakukan pembelian.");
      setView('login');
      return;
    }
    
    if (paymentMethod === 'Saldo Akun' && (auth.balance || 0) < finalTotal) {
      alert("Saldo Anda tidak cukup! Silakan top up.");
      setView('topup');
      return;
    }

    setIsProcessing(true);

    // LOGIKA PENGURANGAN STOK DAN PEMBERIAN DATA BARANG
    const processedCart = cart.map(item => {
      const product = products.find(p => p.id === item.id);
      let issuedData: string[] = [];

      if (product) {
        if (product.productType === 'Unik') {
          // Ambil item dari inventory sebanyak quantity
          issuedData = (product.inventory || []).slice(0, item.quantity);
        } else {
          // Duplikat: Berikan data yang sama (inventory[0]) sebanyak quantity
          const singleData = (product.inventory && product.inventory[0]) || 'Produk akan segera diproses';
          issuedData = Array(item.quantity).fill(singleData);
        }
      }
      return { ...item, issuedData };
    });

    setTimeout(async () => {
      try {
        // Update Produk (Kurangi Stok)
        const newProducts = products.map(p => {
          const cartItem = cart.find(ci => ci.id === p.id);
          if (cartItem) {
            if (p.productType === 'Unik') {
              const remainingInventory = (p.inventory || []).slice(cartItem.quantity);
              return { ...p, inventory: remainingInventory, stock: remainingInventory.length };
            } else {
              const newStock = Math.max(0, p.stock - cartItem.quantity);
              return { ...p, stock: newStock };
            }
          }
          return p;
        });

        // Save updated products to Firebase
        const productsToUpdate = newProducts.filter(p => cart.some(ci => ci.id === p.id));
        for (const p of productsToUpdate) {
          await ApiService.updateProductStock(p.id, p.stock, p.inventory);
        }
        setProducts(newProducts);

        const orderId = Math.floor(100000 + Math.random() * 900000).toString();
        const newOrder: Order = {
          id: orderId,
          items: processedCart,
          totalAmount: finalTotal,
          date: new Date().toLocaleString('id-ID'),
          status: paymentMethod === 'Saldo Akun' ? 'Selesai' : 'Pending',
          paymentMethod: paymentMethod,
          username: auth.username || 'Guest'
        };

        await ApiService.createOrder(newOrder, auth.username || 'guest');
        setOrders(prev => [newOrder, ...prev]);

        // If voucher was used, redeem it
        if (appliedVoucher) {
          await ApiService.redeemVoucher(appliedVoucher.code);
        }

        // If paid by WhatsApp, redirect to WhatsApp
        if (paymentMethod === 'Manual WhatsApp') {
          const waNumber = APP_CONFIG.admin.whatsapp;
          const message = `Halo Admin, saya ingin konfirmasi pesanan.\n\n` +
                          `ID Pesanan: ${orderId}\n` +
                          `Username: ${auth.username}\n` +
                          `Total: ${formatIDR(finalTotal)}\n\n` +
                          `Mohon segera diproses ya, terima kasih!`;
          
          const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
          window.open(waUrl, '_blank');
        } else if (paymentMethod !== 'Saldo Akun') {
          // Handling for Automated Gateways (Pak Kasir, Tripay, etc.)
          const gateway = paymentSettings?.gateways.find(g => g.provider === paymentMethod);
          if (gateway && gateway.provider === 'Pak Kasir' && gateway.slug) {
            console.log(`Processing with Pak Kasir [${gateway.slug}]...`);
            // Constructed URL for Pak Kasir (Common pattern)
            const amount = finalTotal;
            const checkoutUrl = `https://pakkasir.id/checkout/${gateway.slug}?external_id=${orderId}&amount=${amount}&callback_url=${encodeURIComponent(window.location.origin + '/?view=orders')}`;
            
            // In a real implementation with a backend, you'd create a session first via API.
            // For this frontend-only request, we redirect to the presumed checkout link.
            setTimeout(() => {
              window.open(checkoutUrl, '_blank');
            }, 1000);
            
            alert(`Pesanan ${orderId} berhasil dibuat. Anda akan diarahkan ke halaman pembayaran Pak Kasir.`);
          } else if (gateway) {
            console.log(`Processing with ${gateway.provider} automated gateway...`);
            alert(`Pesanan ${orderId} berhasil dibuat menggunakan ${gateway.provider}. Silakan cek status pesanan Anda secara berkala.`);
          }
        }

        // If paid by balance, update balance
        if (paymentMethod === 'Saldo Akun' && auth.username) {
          const newBalance = (auth.balance || 0) - finalTotal;
          await ApiService.updateBalanceByUsername(auth.username, newBalance);
          const updatedAuth = { ...auth, balance: newBalance };
          setAuth(updatedAuth);
          localStorage.setItem('mwstore_auth', JSON.stringify(updatedAuth));
        }

        // Reward Logic: Check if user has bought 10 times with balance
        if (paymentMethod === 'Saldo Akun' && auth.username) {
           const reward = await ApiService.checkAndGrantReward(auth.username);
           if (reward.rewarded) {
              alert(`🎉 Selamat! Anda mendapatkan Reward Voucher Belanja karena telah berbelanja 10 kali menggunakan saldo. Cek pesan masuk Anda untuk mengambil kodenya!`);
           }
        }

        setCart([]);
        setAppliedVoucher(null);
        setVoucherCode('');
        setView('orders');
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        let displayErr = "Terjadi kesalahan saat memproses pembayaran.";
        try {
          const parsed = JSON.parse(err);
          displayErr = `Kesalahan: ${parsed.error || err}`;
        } catch(e) {}
        console.error("Payment failed:", error);
        alert(displayErr + ". Hubungi admin via Layanan CS jika saldo Anda terpotong namun pesanan tidak muncul.");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleProcessTopup = () => {
    if (topupAmount < 1000) return;
    setIsProcessing(true);
    
    setTimeout(async () => {
      if (auth.username) {
        const topupId = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Catat Transaksi Top Up sebagai PENDING
        const newTopUp: TopUpTransaction = {
          id: topupId,
          username: auth.username,
          amount: topupAmount,
          date: new Date().toLocaleString('id-ID'),
          status: 'Pending'
        };

        await ApiService.createTopUp(newTopUp, auth.username || 'guest');

        setIsProcessing(false);
        
        if (topupPaymentMethod === 'Manual WhatsApp') {
          // Redirect ke WhatsApp Admin
          const waNumber = APP_CONFIG.admin.whatsapp;
          const message = `Halo Admin, saya ingin konfirmasi Top Up Saldo.\n\n` +
                          `ID Tiket: ${topupId}\n` +
                          `Username: ${auth.username}\n` +
                          `Nominal: ${formatIDR(topupAmount)}\n\n` +
                          `Mohon segera diproses ya, terima kasih!`;
          
          const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
          
          alert(`Permintaan Top Up ID ${topupId} telah dibuat. Anda akan diarahkan ke WhatsApp Admin untuk konfirmasi pembayaran.`);
          window.open(waUrl, '_blank');
        } else {
          // Automated Gateway
          const gateway = paymentSettings?.gateways.find(g => g.provider === topupPaymentMethod);
          if (gateway && gateway.provider === 'Pak Kasir' && gateway.slug) {
            const checkoutUrl = `https://pakkasir.id/checkout/${gateway.slug}?external_id=${topupId}&amount=${topupAmount}&callback_url=${encodeURIComponent(window.location.origin + '/?view=profile')}`;
            
            setTimeout(() => {
              window.open(checkoutUrl, '_blank');
            }, 500);
            
            alert(`Permintaan Top Up ID ${topupId} berhasil dibuat. Anda akan diarahkan ke halaman pembayaran ${gateway.provider}.`);
          } else if (gateway) {
            alert(`Permintaan Top Up ID ${topupId} berhasil dibuat menggunakan ${gateway.provider}. Silakan cek status saldo Anda secara berkala.`);
          }
        }
        
        setView('profile'); // Arahkan ke profil untuk lihat riwayat
      }
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading System...</p>
        </div>
      </div>
    );
  }

  if (!auth.isLoggedIn) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Login onLogin={handleLogin} onRegister={handleRegister} registeredUsers={users} />
      </motion.div>
    );
  }

  // Maintenance Check
  if (isMaintenance && auth.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100 flex flex-col items-center gap-8"
        >
          <div className="w-24 h-24 bg-orange-50 rounded-[2rem] flex items-center justify-center text-orange-500 relative">
             <RefreshCw className="w-12 h-12 animate-spin-slow" />
             <div className="absolute top-0 right-0 w-8 h-8 bg-orange-500 rounded-full border-4 border-white flex items-center justify-center">
                <Settings className="w-3.5 h-3.5 text-white" />
             </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight uppercase">Server Maintenance</h1>
            <p className="text-gray-500 font-medium leading-relaxed">
              Kami sedang melakukan pemeliharaan rutin untuk meningkatkan layanan. Mohon tunggu beberapa saat.
            </p>
          </div>
          <div className="w-full bg-gray-50 p-6 rounded-3xl border border-gray-100 flex items-center justify-center gap-3">
             <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Estimasi Selesai: 15-30 Menit</span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-sm font-black text-red-500 uppercase tracking-widest hover:underline"
          >
            Keluar Akun
          </button>
        </motion.div>
      </div>
    );
  }

  if (view === 'admin' && auth.role === 'admin') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <AdminDashboard 
          orders={orders} 
          onBack={() => setView('home')} 
          products={products}
          users={users}
          onAddProduct={handleAddOrUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          onUpdateUsers={handleUpdateUsers}
          onDeleteUser={handleDeleteUser}
          onResetUserHistory={handleResetUserHistory}
          onUpdateOrder={handleUpdateOrder}
          onLogout={handleLogout}
        />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <div className="bg-indigo-600 text-white text-[10px] py-2 px-4 flex justify-center items-center font-black uppercase tracking-widest gap-2">
         <motion.div
           animate={{ scale: [1, 1.2, 1] }}
           transition={{ repeat: Infinity, duration: 2 }}
         >
           <Wallet className="w-3 h-3" />
         </motion.div>
         Gunakan MW-Store untuk Transaksi Lebih Cepat & Aman
      </div>

      <nav className="bg-white/95 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
              <img src="https://i.imgur.com/oR61kTA.png" className="w-9 h-9 object-contain" alt="MWSTORE Logo" />
              <span className="text-lg font-black text-gray-900 tracking-tighter">MWSTORE</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Customer Service Hub Shortcut */}
            <button 
              onClick={() => setView('customer-service')}
              className="relative p-2 text-gray-700 hover:text-indigo-600 transition-colors"
              title="Layanan CS"
            >
              <MessageCircle className="w-6 h-6" />
              {unreadMessages > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            {/* Balance Badge - Clickable to Top Up */}
            <button 
              onClick={() => setView('topup')}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-colors"
            >
               <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
               </div>
               <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">Isi Saldo</span>
                  <span className="text-xs font-black text-indigo-700 leading-tight">{formatIDR(auth.balance || 0)}</span>
               </div>
               <div className="sm:hidden text-xs font-black text-indigo-700">{formatIDR(auth.balance || 0)}</div>
            </button>

            <button onClick={() => setView('cart')} className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-72 bg-white z-[101] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <img src="https://i.imgur.com/oR61kTA.png" className="w-10 h-10 object-contain" alt="MWSTORE Logo" />
                  <span className="text-xl font-black text-gray-900 tracking-tighter">MWSTORE</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <button 
                  onClick={() => { setView('home'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'home' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                  <span>Beranda</span>
                </button>

                <button 
                  onClick={() => { setView('profile'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <User className="w-5 h-5" />
                  <span>Profil Saya</span>
                </button>

                <button 
                  onClick={() => { setView('orders'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'orders' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <Receipt className="w-5 h-5" />
                  <span>Pesanan Saya</span>
                </button>

                <button 
                  onClick={() => { setView('vouchers'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'vouchers' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <Tag className="w-5 h-5" />
                  <span>Voucher & Promo</span>
                </button>

                <button 
                  onClick={() => { setView('customer-service'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'customer-service' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <MessageCircle className="w-5 h-5" />
                    <span>Layanan CS</span>
                  </div>
                  {unreadMessages > 0 && (
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-sm"></span>
                  )}
                </button>

                <button 
                  onClick={() => { setView('community-chat'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'community-chat' ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <Users className="w-5 h-5" />
                    <span>Obrolan Komunitas</span>
                  </div>
                </button>

                {auth.role === 'admin' && (
                  <button 
                    onClick={() => { setView('admin'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Panel Admin</span>
                  </button>
                )}
              </div>

              <div className="p-6 border-t font-black text-[9px] text-gray-300 uppercase tracking-widest text-center">
                MWSTORE {APP_VERSION}
              </div>

              <div className="p-6 pt-0">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Keluar</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
            >
              <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-indigo-700 to-blue-900 p-8 md:p-14 mb-12 text-white shadow-2xl">
                <div className="max-w-xl relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-white/10">
                    <ShieldCheck className="w-3 h-3 text-green-400" />
                    MW-STORE READY {APP_VERSION}
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black mb-2 leading-[1.1]">
                    MWSTORE
                  </h1>
                  <p className="text-blue-100/90 text-lg md:text-xl mb-10 leading-relaxed font-black uppercase tracking-[0.2em]">
                    {currentDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {currentDateTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button onClick={() => setView('topup')} className="bg-white text-blue-700 px-8 py-4 rounded-2xl font-black hover:bg-blue-50 transition-all flex items-center gap-2 shadow-xl shadow-blue-900/20">
                      <ArrowUpCircle className="w-5 h-5" />
                      Isi Saldo Sekarang
                    </button>
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-2xl">
                       <Coins className="w-5 h-5 text-indigo-300" />
                       <motion.span 
                         key={auth.balance}
                         initial={{ opacity: 0, y: -10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="font-black text-sm"
                       >
                         {formatIDR(auth.balance || 0)}
                       </motion.span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mb-10 max-w-2xl mx-auto md:mx-0">
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari produk impianmu..."
                    className="w-full bg-white border-2 border-gray-100 rounded-[2rem] py-5 pl-14 pr-6 focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900 shadow-sm"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-10 items-center overflow-x-auto pb-4 no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                      selectedCategory === cat 
                        ? 'bg-blue-600 text-white shadow-xl scale-105' 
                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-20">
                {filteredProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <ProductCard product={product} onAddToCart={addToCart} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'topup' && (
            <motion.div
              key="topup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="max-w-2xl mx-auto py-10">
                 <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-gray-900 mb-4 flex items-center justify-center gap-4">
                       <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                          <Plus className="w-7 h-7" />
                       </div>
                       Top Up Saldo
                    </h2>
                    <p className="text-gray-500 font-medium tracking-tight">Masukkan nominal top up yang Anda inginkan.</p>
                 </div>

                 <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-xl space-y-8">
                    <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3 block">Nominal Top Up (Rp)</label>
                       <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-400 text-2xl">Rp</span>
                          <input 
                            type="number" 
                            value={topupAmount === 0 ? '' : topupAmount}
                            onChange={(e) => setTopupAmount(Number(e.target.value))}
                            className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500/20 rounded-[2rem] py-6 pl-16 pr-8 focus:ring-4 focus:ring-indigo-500/5 outline-none font-black text-2xl text-gray-900 transition-all"
                            placeholder="Pilih Nominal"
                            min="1000"
                          />
                       </div>
                       <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter px-2">
                         Minimal Top Up adalah Rp 1.000
                       </p>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block">Pilih Metode Pembayaran</label>
                       
                       <div className="grid grid-cols-1 gap-3">
                          <button 
                             onClick={() => setTopupPaymentMethod('Manual WhatsApp')}
                             className={`p-5 rounded-3xl border-2 text-left flex items-center justify-between transition-all ${topupPaymentMethod === 'Manual WhatsApp' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                          >
                             <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${topupPaymentMethod === 'Manual WhatsApp' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                   <MessageCircle className="w-5 h-5" />
                                </div>
                                <div>
                                   <p className="text-xs font-black text-gray-900">Manual WhatsApp</p>
                                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Konfirmasi via Chat</p>
                                </div>
                             </div>
                             <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${topupPaymentMethod === 'Manual WhatsApp' ? 'border-indigo-600' : 'border-gray-200'}`}>
                                {topupPaymentMethod === 'Manual WhatsApp' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                             </div>
                          </button>

                          {paymentSettings?.gateways.filter(g => g.isActive && g.provider !== 'Manual').map(gw => (
                             <button 
                                key={gw.provider}
                                onClick={() => setTopupPaymentMethod(gw.provider)}
                                className={`p-5 rounded-3xl border-2 text-left flex items-center justify-between transition-all ${topupPaymentMethod === gw.provider ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                             >
                                <div className="flex items-center gap-4">
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${topupPaymentMethod === gw.provider ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                      <QrCode className="w-5 h-5" />
                                   </div>
                                   <div>
                                      <p className="text-xs font-black text-gray-900">{gw.provider} Automated</p>
                                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">QRIS / Instant Payment</p>
                                   </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${topupPaymentMethod === gw.provider ? 'border-indigo-600' : 'border-gray-200'}`}>
                                   {topupPaymentMethod === gw.provider && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                                </div>
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="bg-orange-50 p-6 rounded-[2.5rem] border border-orange-100 flex items-start gap-4">
                       <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                          <Info className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-[10px] text-orange-700 font-black uppercase tracking-widest mb-1">Informasi Pembayaran</p>
                          <p className="text-xs text-orange-600/80 font-bold leading-relaxed">
                             {topupPaymentMethod === 'Manual WhatsApp' 
                                ? 'Pembayaran dilakukan secara manual dengan menghubungi WhatsApp Admin. Klik tombol di bawah untuk mendapatkan instruksi pembayaran.'
                                : `Pembayaran akan diproses secara otomatis melalui ${topupPaymentMethod}. Anda akan diarahkan ke halaman pembayaran instan.`}
                          </p>
                       </div>
                    </div>

                    <div className="pt-4">
                       <button 
                          onClick={handleProcessTopup}
                          disabled={isProcessing || topupAmount < 1000}
                          className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                       >
                          {isProcessing ? (
                             <>
                                <RefreshCw className="w-6 h-6 animate-spin" />
                                Memproses Tiket...
                             </>
                          ) : (
                             <>
                                {topupPaymentMethod === 'Manual WhatsApp' ? <MessageCircle className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                                {topupPaymentMethod === 'Manual WhatsApp' ? 'Hubungi Admin & Bayar' : `Bayar via ${topupPaymentMethod}`}
                             </>
                          )}
                       </button>
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-4">
                       <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aman</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Terpercaya</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Respon Cepat</span>
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {view === 'cart' && (
            <motion.div
              key="cart"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
              className="max-w-4xl mx-auto py-10"
            >
                <h2 className="text-3xl font-black mb-10 text-gray-900">Keranjang Belanja</h2>
                {cart.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[3rem] border border-gray-100 shadow-sm">
                     <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShoppingCart className="w-8 h-8 text-gray-200" />
                     </div>
                     <p className="text-gray-400 font-bold">Keranjang kosong.</p>
                     <button onClick={() => setView('home')} className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">Cari Produk</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 flex items-center gap-6 shadow-sm">
                         <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" />
                         <div className="flex-1">
                            <p className="font-black text-gray-900">{item.name}</p>
                            <p className="text-blue-600 font-black text-lg">{formatIDR(item.price)}</p>
                         </div>
                         <button onClick={() => removeFromCart(item.id)} className="text-red-400 p-2 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    ))}
                    <div className="mt-10 p-10 bg-indigo-600 text-white rounded-[3rem] flex flex-col md:flex-row justify-between items-center shadow-2xl gap-6">
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Total Tagihan</p>
                        <p className="text-4xl font-black">{formatIDR(cartTotal)}</p>
                      </div>
                      <button onClick={() => setView('checkout')} className="bg-white text-blue-600 px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg">Pilih Pembayaran</button>
                    </div>
                  </div>
                )}
            </motion.div>
          )}

          {view === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4 }}
              className="max-w-5xl mx-auto py-10"
            >
                <h2 className="text-3xl font-black mb-10">Pilih Metode Pembayaran</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                         <h3 className="font-black text-gray-900 mb-6 uppercase tracking-widest text-xs">Informasi Akun</h3>
                         <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                               <Wallet className="w-5 h-5" />
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Saldo Tersedia</p>
                               <p className="font-black text-indigo-700">{formatIDR(auth.balance || 0)}</p>
                            </div>
                         </div>
                         
                         <div className="mt-10 h-px bg-gray-100 mb-6" />
                         
                         <div className="space-y-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ringkasan Tagihan</p>
                            {cart.map(item => (
                              <div key={item.id} className="flex justify-between text-xs font-bold text-gray-600">
                                 <span>{item.name} x{item.quantity}</span>
                                 <span>{formatIDR(item.price * item.quantity)}</span>
                              </div>
                            ))}
                            <div className="pt-4 border-t border-gray-50 flex justify-between items-end">
                               <span className="text-[10px] font-black text-gray-900 uppercase">Harga Produk</span>
                               <span className="text-xl font-black text-gray-900 leading-none">{formatIDR(cartTotal)}</span>
                            </div>

                            {appliedVoucher && (
                               <div className="flex justify-between items-end text-green-600 pt-2">
                                  <span className="text-[10px] font-black uppercase">Voucher Diskon ({appliedVoucher.code})</span>
                                  <span className="text-sm font-black italic">-{formatIDR(appliedVoucher.amount)}</span>
                               </div>
                            )}

                            <div className="pt-4 mt-2 border-t border-indigo-100 flex justify-between items-end">
                               <span className="text-[10px] font-black text-indigo-600 uppercase">Total Bayar</span>
                               <span className="text-2xl font-black text-blue-600 leading-none">{formatIDR(finalTotal)}</span>
                            </div>

                            {!appliedVoucher && (
                               <div className="mt-8 space-y-3">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Punya Voucher Diskon?</p>
                                  <div className="flex gap-2">
                                     <input 
                                        type="text"
                                        placeholder="MASUKKAN KODE"
                                        value={voucherCode}
                                        onChange={e => setVoucherCode(e.target.value)}
                                        className="flex-1 bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-black uppercase text-xs"
                                     />
                                     <button 
                                        type="button"
                                        onClick={handleApplyVoucher}
                                        className="px-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[9px] hover:bg-indigo-700 transition-all"
                                     >
                                        Pasang
                                     </button>
                                  </div>
                               </div>
                            )}
                         </div>
                      </div>

                      {(paymentMethod === 'Saldo Akun' && (auth.balance || 0) < finalTotal) && (
                         <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex flex-col gap-4">
                            <div className="flex items-start gap-4">
                               <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                               <p className="text-[11px] text-red-700 font-bold leading-relaxed uppercase tracking-tighter">
                                  Saldo Anda tidak mencukupi untuk pesanan ini.
                               </p>
                            </div>
                            <button onClick={() => setView('topup')} className="w-full bg-red-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">Top Up Sekarang</button>
                         </div>
                      )}
                   </div>

                   <div className="lg:col-span-2 space-y-4">
                      <button onClick={() => setPaymentMethod('Saldo Akun')} className={`w-full p-8 rounded-[2.5rem] border-2 transition-all text-left flex items-center justify-between ${paymentMethod === 'Saldo Akun' ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                         <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${paymentMethod === 'Saldo Akun' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-gray-50 text-gray-400'}`}>
                               <Coins className="w-7 h-7" />
                            </div>
                            <div>
                               <h4 className="font-black text-gray-900 text-lg">Saldo Akun MW-Wallet</h4>
                               <p className="text-sm text-gray-500 font-medium">Bayar instan & otomatis tanpa scan QR.</p>
                            </div>
                         </div>
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'Saldo Akun' ? 'border-indigo-600' : 'border-gray-200'}`}>
                            {paymentMethod === 'Saldo Akun' && <div className="w-3 h-3 bg-indigo-600 rounded-full" />}
                         </div>
                      </button>

                      {/* Dynamic Payment Gateways from Admin Settings */}
                      {paymentSettings?.gateways.filter(g => g.isActive && g.provider !== 'Manual').map(gateway => (
                        <button 
                          key={gateway.provider}
                          onClick={() => setPaymentMethod(gateway.provider)} 
                          className={`w-full p-8 rounded-[2.5rem] border-2 transition-all text-left flex items-center justify-between ${paymentMethod === gateway.provider ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                        >
                           <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${paymentMethod === gateway.provider ? 'bg-indigo-600 text-white shadow-xl' : 'bg-gray-50 text-gray-400'}`}>
                                 <CreditCard className="w-7 h-7" />
                              </div>
                              <div>
                                 <h4 className="font-black text-gray-900 text-lg">{gateway.provider} Automated</h4>
                                 <p className="text-sm text-gray-500 font-medium">Pembayaran otomatis melalui {gateway.provider}.</p>
                              </div>
                           </div>
                           <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === gateway.provider ? 'border-indigo-600' : 'border-gray-200'}`}>
                              {paymentMethod === gateway.provider && <div className="w-3 h-3 bg-indigo-600 rounded-full" />}
                           </div>
                        </button>
                      ))}

                      <button onClick={() => setPaymentMethod('Manual WhatsApp')} className={`w-full p-8 rounded-[2.5rem] border-2 transition-all text-left flex items-center justify-between ${paymentMethod === 'Manual WhatsApp' ? 'bg-blue-50 border-blue-600' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                         <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${paymentMethod === 'Manual WhatsApp' ? 'bg-blue-600 text-white shadow-xl' : 'bg-gray-50 text-gray-400'}`}>
                               <MessageCircle className="w-7 h-7" />
                            </div>
                            <div>
                               <h4 className="font-black text-gray-900 text-lg">Hubungi Admin (Manual)</h4>
                               <p className="text-sm text-gray-500 font-medium">Bayar via transfer & konfirmasi ke WhatsApp.</p>
                            </div>
                         </div>
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'Manual WhatsApp' ? 'border-blue-600' : 'border-gray-200'}`}>
                            {paymentMethod === 'Manual WhatsApp' && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
                         </div>
                      </button>

                      <button 
                         onClick={handleProcessPayment}
                         disabled={isProcessing || (paymentMethod === 'Saldo Akun' && (auth.balance || 0) < finalTotal)}
                         className="w-full py-6 bg-green-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                         {isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                         {paymentMethod === 'Saldo Akun' ? 'Bayar Pakai Saldo Sekarang' : 'Lanjutkan Pembayaran'}
                      </button>
                   </div>
                </div>
            </motion.div>
          )}

          {view === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="max-w-4xl mx-auto py-10"
            >
                <h2 className="text-3xl font-black mb-10 text-gray-900 flex items-center gap-4">
                   <Receipt className="w-8 h-8 text-blue-600" />
                   Laporan Pesanan
                </h2>
                
                {orders.filter(o => o.username === auth.username || auth.role === 'admin').length === 0 ? (
                   <div className="text-center py-20 bg-white rounded-[3rem] border border-gray-100 shadow-sm">
                      <p className="text-gray-400 font-bold">Belum ada riwayat belanja.</p>
                   </div>
                ) : (
                   <div className="space-y-6">
                      {orders.filter(o => o.username === auth.username || auth.role === 'admin').map(order => (
                         <div key={order.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                               <div className="flex items-center gap-3 mb-2">
                                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">#{order.id}</span>
                                  <span className="text-[10px] font-black text-gray-400 uppercase">{order.date}</span>
                               </div>
                               <h4 className="font-black text-gray-900 mb-2 truncate max-w-[250px]">
                                  {order.items.map(i => i.name).join(', ')}
                               </h4>
                               
                               {/* TAMPILKAN DATA BARANG SETELAH BAYAR */}
                               {order.status === 'Selesai' && order.items.some(i => i.issuedData && i.issuedData.length > 0) && (
                                 <div className="mt-4 space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 max-w-md">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                       <ShieldCheck className="w-3 h-3" /> 
                                       {order.items.some(i => i.issuedData?.some(d => d !== 'Produk akan segera diproses')) 
                                         ? 'Data Barang Terkirim' 
                                         : 'Status Pengiriman'}
                                    </p>
                                    <div className="space-y-2">
                                       {order.items.map((item, idx) => (
                                          item.issuedData && item.issuedData.length > 0 && (
                                             <div key={idx} className="space-y-1">
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">{item.name}</p>
                                                <div className="flex flex-col gap-1">
                                                   {item.issuedData.map((data, dIdx) => (
                                                      <div key={dIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                         <code className="text-xs font-mono text-gray-700 break-all">{data}</code>
                                                         <button 
                                                            onClick={() => {
                                                               navigator.clipboard.writeText(data);
                                                               alert('Berhasil disalin!');
                                                            }}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                         >
                                                            <Copy className="w-3 h-3" />
                                                         </button>
                                                      </div>
                                                   ))}
                                                </div>
                                             </div>
                                          )
                                       ))}
                                    </div>
                                 </div>
                               )}

                               <div className="flex items-center gap-2 mt-4 text-xs font-bold text-gray-400">
                                  <span className="text-blue-600 font-black text-xl">{formatIDR(order.totalAmount)}</span>
                                  <span className="text-[9px] font-black px-2 py-0.5 bg-gray-100 text-gray-500 rounded uppercase tracking-tighter">{order.paymentMethod}</span>
                               </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                               <div className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                  order.status === 'Selesai' ? 'bg-green-100 text-green-600' : 
                                  order.status === 'Pending' ? 'bg-orange-100 text-orange-600' : 
                                  order.status === 'Gagal' ? 'bg-red-100 text-red-600' : 
                                  'bg-blue-100 text-blue-600'
                               }`}>
                                  {order.status === 'Pending' ? <Clock className="w-4 h-4" /> : 
                                   order.status === 'Gagal' ? <AlertCircle className="w-4 h-4" /> :
                                   <CheckCircle2 className="w-4 h-4" />}
                                  {order.status}
                               </div>
                               <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Download Invois</button>
                            </div>
                         </div>
                      ))}
                   </div>
                )}
            </motion.div>
          )}

          {view === 'vouchers' && (
             <div className="max-w-4xl mx-auto w-full p-6 space-y-8 animate-in slide-in-from-bottom-5 duration-500">
                <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32"></div>
                   <div className="relative z-10">
                      <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-2">Voucher & Promo</h2>
                      <p className="text-gray-400 font-medium text-sm">Gunakan kode voucher di bawah ini untuk mendapatkan potongan harga spesial.</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {vouchers.filter(v => v.isActive && (!v.recipient || (auth.username && v.recipient.toLowerCase() === auth.username.toLowerCase()))).length === 0 ? (
                      <div className="md:col-span-2 py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center gap-4">
                         <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                            <Tag className="w-8 h-8" />
                         </div>
                         <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Belum ada promo tersedia</p>
                      </div>
                   ) : (
                      vouchers.filter(v => v.isActive && (!v.recipient || (auth.username && v.recipient.toLowerCase() === auth.username.toLowerCase()))).map(v => (
                         <div key={v.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative group hover:shadow-xl hover:shadow-indigo-100/50 transition-all">
                            <div className="flex justify-between items-start mb-6">
                               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                  <Tag className="w-6 h-6" />
                               </div>
                               <div className="text-right">
                                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Potongan</span>
                                  <p className="text-2xl font-black text-gray-900 leading-none">{formatIDR(v.amount)}</p>
                               </div>
                            </div>
                            
                            <div className="space-y-4">
                               <div>
                                  <h4 className="text-lg font-black text-gray-900 leading-none">{v.code}</h4>
                                  {v.minPurchase && v.minPurchase > 0 && (
                                     <p className="text-[10px] font-bold text-gray-400 mt-2">Min. Pembelian {formatIDR(v.minPurchase)}</p>
                                  )}
                               </div>

                               <div className="flex gap-2">
                                  <button 
                                     onClick={() => {
                                        navigator.clipboard.writeText(v.code);
                                        alert("Kode voucher berhasil disalin!");
                                     }}
                                     className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2"
                                  >
                                     <Copy className="w-3.5 h-3.5" /> Salin Kode
                                  </button>
                                  <button 
                                     onClick={() => setView('home')}
                                     className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                  >
                                     Gunakan <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                               </div>
                            </div>

                            {/* Ticket Notch effect */}
                            <div className="absolute top-1/2 -left-3 w-6 h-6 bg-[#f8fafc] rounded-full border border-gray-100 -translate-y-1/2"></div>
                            <div className="absolute top-1/2 -right-3 w-6 h-6 bg-[#f8fafc] rounded-full border border-gray-100 -translate-y-1/2"></div>
                         </div>
                      ))
                   )}
                </div>
                
                <div className="bg-indigo-600 p-10 rounded-[3rem] text-white overflow-hidden relative">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                      <div className="p-5 bg-white/20 backdrop-blur-md rounded-[2rem]">
                         <Sparkles className="w-10 h-10" />
                      </div>
                      <div className="text-center md:text-left flex-1">
                         <h3 className="text-xl font-black uppercase tracking-tight mb-1">Dapatkan Lebih Banyak Reward!</h3>
                         <p className="text-white/70 text-sm font-medium">Lakukan transaksi minimal 10 kali menggunakan Saldo MW-Wallet untuk mendapatkan bonus voucher saldo otomatis.</p>
                      </div>
                      <button 
                         onClick={() => setView('topup')}
                         className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-50 transition-all active:scale-95"
                      >
                         Top Up Sekarang
                      </button>
                   </div>
                </div>
             </div>
          )}
          {view === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <UserProfile 
                username={auth.username || ''} 
                onBack={() => setView('home')} 
                onUpdate={() => {
                  // No-op or fetch current user balance if needed
                }}
              />
            </motion.div>
          )}

          {view === 'customer-service' && auth.username && (
             <CustomerService username={auth.username} onBack={() => setView('home')} />
          )}

          {view === 'community-chat' && auth.username && (
             <CommunityChat username={auth.username} onBack={() => setView('home')} isAdmin={auth.role === 'admin'} />
          )}
        </AnimatePresence>
      </main>
      
      {/* Floating Customer Service Button */}
      {auth.isLoggedIn && view !== 'customer-service' && auth.role !== 'admin' && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setView('customer-service')}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 z-50 group"
          id="floating-cs-button"
        >
          <MessageCircle className="w-8 h-8 group-hover:rotate-12 transition-transform" />
          {unreadMessages > 0 && (
            <span className="absolute top-3 right-3 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-md"></span>
          )}
        </motion.button>
      )}
      
      <footer className="bg-white border-t py-20 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src="https://i.imgur.com/oR61kTA.png" className="w-10 h-10 object-contain" alt="MWSTORE Logo" />
            <span className="text-2xl font-black text-gray-900 tracking-tighter">MWSTORE</span>
          </div>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em] mb-12">Official MW-Store Enabled Commerce</p>
          <div className="flex flex-wrap justify-center gap-4">
             <button className="flex items-center gap-2 px-8 py-4 bg-gray-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-600 border border-gray-100 hover:bg-white transition-all">
                <Download className="w-4 h-4" />
                Dapatkan App
             </button>
             <a href="https://wa.me/6283845890648" target="_blank" className="flex items-center gap-2 px-8 py-4 bg-green-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-green-600 border border-green-100 hover:bg-white transition-all">
                <MessageCircle className="w-4 h-4" />
                Customer Service
             </a>
          </div>
          <div className="mt-20 pt-10 border-t border-gray-50 text-[9px] font-black text-gray-300 uppercase tracking-widest">
             <p>© MWSTORE OFFICIAL - PERDAGANGAN PRODUK DIGITAL</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
