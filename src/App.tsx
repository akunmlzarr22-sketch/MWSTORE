
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
import { JasaOtpSmsRetriever } from './components/JasaOtpSmsRetriever';
import { SmmOrderTracker } from './components/SmmOrderTracker';
import { NokosMenuTab } from './components/NokosMenuTab';
import { SmmMenuTab } from './components/SmmMenuTab';
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
    
    // Add background polling for balance updates
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        ApiService.syncFromServer().catch(console.error);
      }
    }, 5000);

    // Immediate sync on window focus (important after payment)
    const handleFocus = () => {
      ApiService.syncFromServer().catch(console.error);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
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
  const [activeMenus, setActiveMenus] = useState<Record<string, boolean>>({
    nokos: true,
    game: true,
    pulsa: true,
    ewallet: true,
    voucher: true,
    smm: true
  });
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
      if (settings) {
        setIsMaintenance(settings.maintenanceMode);
        
        let mergedActiveMenus = settings.activeMenus ? { ...settings.activeMenus } : {
          nokos: true,
          game: true,
          pulsa: true,
          ewallet: true,
          voucher: true,
          smm: true
        };
        
        if (settings.smmSettings) {
          mergedActiveMenus.smm = settings.smmSettings.isActive !== false;
        }
        if (settings.nokosSettings) {
          mergedActiveMenus.nokos = settings.nokosSettings.isActive !== false;
        }
        
        setActiveMenus(mergedActiveMenus);
      }
    });
    
    return () => {
      unsubscribePayment();
      unsubscribeSystem();
    };
  }, []);

  // Auto-redirect if viewing a disabled service
  useEffect(() => {
    if (view === 'smm' && activeMenus.smm === false) {
      setView('home');
    }
    if (view === 'nokos' && activeMenus.nokos === false) {
      setView('home');
    }
  }, [view, activeMenus]);

  // Periodic Server Sync handled by global listener in initializeAuth

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
        if (newestMsg && !newestMsg.read && newestMsg.sender === 'System') {
           if (newestMsg.content.includes('berhasil') || newestMsg.content.includes('Top up')) {
              ApiService.syncFromServer();
           }
        }
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

  const categories = useMemo(() => {
    const cats = products
      .map(p => (p.category || '').trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const uniqueCats: string[] = [];
    for (const cat of cats) {
      const lower = cat.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        
        // Dynamic title casing or fallback
        const formatted = cat.charAt(0).toUpperCase() + cat.slice(1);
        uniqueCats.push(formatted);
      }
    }
    return ['Semua', ...uniqueCats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Semua' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, products]);

  const greetingText = useMemo(() => {
    const hour = currentDateTime.getHours();
    let greeting = 'Selamat Malam';
    let emoji = '🌙';

    if (hour >= 4 && hour < 11) {
      greeting = 'Selamat Pagi';
      emoji = '🌅';
    } else if (hour >= 11 && hour < 15) {
      greeting = 'Selamat Siang';
      emoji = '☀️';
    } else if (hour >= 15 && hour < 18) {
      greeting = 'Selamat Sore';
      emoji = '🌇';
    }
    
    const displayName = auth.isLoggedIn && auth.username ? auth.username : 'Pelanggan';
    return `${greeting}, ${displayName} ${emoji}`;
  }, [currentDateTime, auth.isLoggedIn, auth.username]);

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

    setTimeout(async () => {
      try {
        // LOGIKA PENGURANGAN STOK DAN PEMBERIAN DATA BARANG (TERMASUK JASAOTP)
        const processedCart = [];
        for (const item of cart) {
          const product = products.find(p => p.id === item.id);
          let issuedData: string[] = [];

          if (product && product.category.toLowerCase() === 'nokos' && product.isNokosApi) {
            // Panggil API JasaOTP untuk order nomor baru
            for (let q = 0; q < item.quantity; q++) {
              try {
                const reqBody = {
                  negara: product.nokosCountry || '6',
                  layanan: product.nokosService || 'wa',
                  operator: product.nokosOperator || 'any'
                };
                const res = await fetch('/api/nokos/order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(reqBody)
                });
                const resJson = await res.json();
                if (resJson && resJson.success && resJson.data) {
                  const oData = resJson.data; // e.g. { id: 121151, nomor: "628xxx" }
                  issuedData.push(`JASAOTP_ORDER:${JSON.stringify({
                    id: oData.id,
                    number: oData.nomor,
                    country: product.nokosCountry || '6',
                    service: product.nokosService || 'wa',
                    operator: product.nokosOperator || 'any',
                    status: 'Aktif',
                    createdAt: Date.now()
                  })}`);
                } else {
                  let errorMsg = resJson.message || "Saldo API JasaOTP habis atau operator kehabisan stok nomor.";
                  if (errorMsg.includes("ID negara tidak valid")) {
                    errorMsg = "ID Negara tidak valid (Saldo API JasaOTP Anda di provider habis / kurang dari Rp 3.000, atau IP server belum didaftarkan di dashboard JasaOTP).";
                  }
                  throw new Error(errorMsg);
                }
              } catch (err: any) {
                console.error("[App] JasaOTP Order error:", err);
                issuedData.push(`ERR:${err.message || 'Error koneksi service'}`);
              }
            }
          } else if (product) {
            if (product.productType === 'Unik') {
              // Ambil item dari inventory sebanyak quantity
              issuedData = (product.inventory || []).slice(0, item.quantity);
            } else {
              // Duplikat: Berikan data yang sama (inventory[0]) sebanyak quantity
              const singleData = (product.inventory && product.inventory[0]) || 'Produk akan segera diproses';
              issuedData = Array(item.quantity).fill(singleData);
            }
          }
          processedCart.push({ ...item, issuedData });
        }

        // Refund Verifikator: batalkan transaksi apabila JasaOTP gagal menyuplai nomor
        const hasNokosError = processedCart.some(item => 
          item.issuedData && item.issuedData.some(d => d.startsWith('ERR:'))
        );

        if (hasNokosError) {
          let errMsg = "Stok nomor virtual sedang habis di JasaOTP. Silakan coba beberapa saat lagi.";
          for (const item of processedCart) {
            const errD = item.issuedData?.find(d => d.startsWith('ERR:'));
            if (errD) {
              errMsg = errD.replace('ERR:', '');
              break;
            }
          }
          alert(`Gagal Memproses Pembelian:\n${errMsg}`);
          setIsProcessing(false);
          return;
        }
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
            // Panduan Resmi Pak Kasir: https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}
            const amount = finalTotal;
            const baseUrl = gateway.baseUrl || 'https://app.pakasir.com';
            const checkoutUrl = `${baseUrl}/pay/${gateway.slug}/${amount}?order_id=${orderId}&redirect=${encodeURIComponent(window.location.origin + '/?view=orders')}&qris_only=1`;
            
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
        if (auth.role === 'admin') {
          setView('orders');
        } else {
          alert('Pembayaran Berhasil! Pesanan Anda telah diterima dan akan segera diproses oleh admin. Silakan pantau status pesanan dengan menghubungi Admin via Layanan CS.');
          setView('home');
        }
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
            const baseUrl = gateway.baseUrl || 'https://app.pakasir.com';
            const checkoutUrl = `${baseUrl}/pay/${gateway.slug}/${topupAmount}?order_id=${topupId}&redirect=${encodeURIComponent(window.location.origin + '/?view=profile')}&qris_only=1`;
            
            setTimeout(() => {
              window.open(checkoutUrl, '_blank');
            }, 500);
            
            alert(`Permintaan Top Up ID ${topupId} berhasil dibuat. Anda akan diarahkan ke halaman pembayaran ${gateway.provider}.`);
          } else if (gateway && gateway.provider === 'SanPay' && gateway.baseUrl) {
            // SanPay / BukaOlshop Unique Link Implementation
            // Menggunakan parameter id dan nominal sebagai standar integrasi BukaOlshop
            const checkoutUrl = gateway.baseUrl.includes('?') 
              ? `${gateway.baseUrl}&id=${topupId}&nominal=${topupAmount}&external_id=${topupId}` 
              : `${gateway.baseUrl}?id=${topupId}&nominal=${topupAmount}&external_id=${topupId}`;
            
            setTimeout(() => {
               window.open(checkoutUrl, '_blank');
            }, 500);
            
            alert(`Permintaan Top Up ID ${topupId} Berhasil. Klik OK untuk menuju Link Pembayaran SanPay.`);
          } else if (gateway && gateway.provider === 'ZannPay' && gateway.baseUrl) {
            // ZannPay Unique Link Implementation
            const checkoutUrl = gateway.baseUrl.includes('?') 
              ? `${gateway.baseUrl}&id=${topupId}&nominal=${topupAmount}&external_id=${topupId}` 
              : `${gateway.baseUrl}?id=${topupId}&nominal=${topupAmount}&external_id=${topupId}`;
            
            setTimeout(() => {
               window.open(checkoutUrl, '_blank');
            }, 500);
            
            alert(`Permintaan Top Up ID ${topupId} Berhasil. Klik OK untuk menuju Link Pembayaran ZannStore.`);
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
      <div className="bg-indigo-600 text-white text-[10px] py-2 overflow-hidden flex font-black uppercase tracking-widest relative border-b border-indigo-700/30">
        <motion.div 
          className="flex whitespace-nowrap shrink-0 gap-8 min-w-full"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            repeat: Infinity,
            repeatType: "loop",
            duration: 16,
            ease: "linear"
          }}
        >
          {/* Group 1 */}
          <div className="flex gap-8 shrink-0">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-200" /> Gunakan MW-Store untuk Transaksi Lebih Cepat & Aman
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-200" /> Gunakan MW-Store untuk Transaksi Lebih Cepat & Aman
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-200" /> Gunakan MW-Store untuk Transaksi Lebih Cepat & Aman
            </span>
          </div>
          {/* Group 2 (identical duplicate content) */}
          <div className="flex gap-8 shrink-0">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-200" /> Gunakan MW-Store untuk Transaksi Lebih Cepat & Aman
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-200" /> Gunakan MW-Store untuk Transaksi Lebih Cepat & Aman
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-200" /> Gunakan MW-Store untuk Transaksi Lebih Cepat & Aman
            </span>
          </div>
        </motion.div>
      </div>

      <nav className="bg-white/95 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setView('home')}>
              <img src="https://i.imgur.com/oR61kTA.png" className="w-7 h-7 sm:w-9 sm:h-9 object-contain" alt="MWSTORE Logo" />
              <span className="text-sm sm:text-lg font-black text-gray-900 tracking-tighter">MWSTORE</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Customer Service Hub Shortcut */}
            <button 
              onClick={() => setView('customer-service')}
              className="relative p-1.5 sm:p-2 text-gray-700 hover:text-indigo-600 transition-colors"
              title="Layanan CS"
            >
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              {unreadMessages > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            {/* Balance Badge - Clickable to Top Up */}
            <button 
              onClick={() => setView('topup')}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-4 sm:py-2 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors"
            >
               <div className="w-5 h-5 sm:w-6 sm:h-6 bg-indigo-600 rounded-md sm:rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0">
                  <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
               </div>
               <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">Isi Saldo</span>
                  <span className="text-xs font-black text-indigo-700 leading-tight">{formatIDR(auth.balance || 0)}</span>
               </div>
               <div className="sm:hidden text-[11px] font-black text-indigo-700 font-mono">{formatIDR(auth.balance || 0)}</div>
            </button>

            <button onClick={() => setView('cart')} className="relative p-1.5 sm:p-2 text-gray-700 hover:text-blue-600 transition-colors">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[8px] sm:text-[9px] font-bold w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full border border-white">
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

                {auth.isLoggedIn && (
                  <button 
                    onClick={() => { setView('orders'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'orders' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <Receipt className="w-5 h-5" />
                    <span>Pesanan Saya</span>
                  </button>
                )}

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

                {activeMenus.smm !== false && (
                  <button 
                    onClick={() => { setView('smm'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${view === 'smm' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <Globe className="w-5 h-5" />
                    <span>Suntik Sosmed</span>
                  </button>
                )}

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
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-700 to-blue-900 p-4 md:p-6 mb-6 text-white shadow-lg">
                <div className="max-w-xl relative z-10">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full text-[7.5px] font-bold uppercase tracking-widest mb-2 border border-white/10">
                    <ShieldCheck className="w-2.5 h-2.5 text-green-400" />
                    MW-STORE READY {APP_VERSION}
                  </div>
                  <h1 className="text-lg md:text-xl font-extrabold mb-0.5 leading-none tracking-tight">
                    MWSTORE
                  </h1>
                  <div className="text-[10px] md:text-xs font-extrabold text-blue-100 tracking-wide mt-1 mb-2">
                    {greetingText}
                  </div>
                  <p className="text-blue-100/80 text-[9px] md:text-[10px] mb-4 leading-relaxed font-medium uppercase tracking-wider font-mono">
                    {currentDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {currentDateTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setView('topup')} className="bg-white text-blue-700 px-3.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-50 transition-all flex items-center gap-1 shadow-sm active:scale-95">
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      Isi Saldo
                    </button>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-lg">
                       <Coins className="w-3.5 h-3.5 text-indigo-300" />
                       <motion.span 
                         key={auth.balance}
                         initial={{ opacity: 0, y: -10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="font-extrabold text-[10px]"
                       >
                         {formatIDR(auth.balance || 0)}
                       </motion.span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LAYANAN PORTAL MENU UTAMA */}
              {(() => {
                const shortcuts = [
                  {
                    key: 'nokos',
                    name: 'Nokos',
                    category: 'Nokos',
                    icon: (
                      <div className="relative flex items-center justify-center w-9 h-9 bg-gradient-to-tr from-blue-50 to-blue-100 rounded-lg border border-blue-200 group-hover:scale-105 group-hover:rotate-2 transition-all text-blue-600 shadow-sm">
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white animate-pulse" />
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M10 12h3" />
                        </svg>
                      </div>
                    ),
                    description: 'OTP SMS Virtual'
                  },
                  {
                    key: 'smm',
                    name: 'Suntik Sosmed',
                    category: 'Suntik Sosmed',
                    icon: (
                      <div className="relative flex items-center justify-center w-9 h-9 bg-gradient-to-tr from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200 group-hover:scale-105 group-hover:rotate-2 transition-all text-indigo-600 shadow-sm">
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full border border-white animate-pulse" />
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" />
                        </svg>
                      </div>
                    ),
                    description: 'Followers & Views'
                  }
                ];

                const visible = shortcuts.filter(s => activeMenus[s.key] !== false);
                if (visible.length === 0) return null;

                return (
                  <div className="mb-6">
                    <h2 className="text-[9px] font-black text-gray-900 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                      <span className="w-0.5 h-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg inline-block" />
                      Layanan Portal MWSTORE
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-sm">
                      {visible.map(menu => {
                        const isSelected = (menu.key === 'nokos' && view === 'nokos') || (menu.key === 'smm' && view === 'smm') || (selectedCategory.toLowerCase() === menu.category.toLowerCase() && view === 'home');
                        return (
                          <button
                            key={menu.key}
                            onClick={() => {
                              if (menu.key === 'nokos') {
                                setView('nokos');
                              } else if (menu.key === 'smm') {
                                setView('smm');
                              } else {
                                setView('home');
                                setSelectedCategory(menu.category);
                              }
                            }}
                            className={`group flex flex-col items-center text-center p-2.5 bg-white border rounded-xl transition-all hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 ${
                              isSelected 
                                ? 'border-blue-600 ring-2 ring-blue-500/5 bg-blue-50/10 shadow-sm' 
                                : 'border-gray-100 hover:bg-gray-50/50'
                            }`}
                          >
                            {menu.icon}
                            <span className="mt-1.5 text-[9px] font-bold text-gray-900 leading-tight uppercase tracking-tight line-clamp-1">
                              {menu.name}
                            </span>
                            <span className="mt-0.5 text-[7px] text-gray-400 font-bold tracking-tight uppercase line-clamp-1">
                              {menu.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="relative mb-4 max-w-xs mx-auto md:mx-0">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari produk impianmu..."
                    className="w-full bg-white border-2 border-gray-100 rounded-lg py-2 pl-8 pr-8 focus:border-blue-500/20 focus:ring-2 focus:ring-blue-500/5 transition-all outline-none font-bold text-[10px] text-gray-900 shadow-sm"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-5 items-center overflow-x-auto pb-1.5 no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-md text-[8.5px] font-extrabold uppercase tracking-wider transition-all shrink-0 ${
                      selectedCategory === cat 
                        ? 'bg-blue-600 text-white shadow-sm scale-[1.01]' 
                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {filteredProducts.length === 0 ? (
                <div className="w-full text-center py-6 px-3 bg-white border border-gray-100 rounded-xl flex flex-col items-center justify-center shadow-sm mb-10 max-w-xs mx-auto md:mx-0">
                  <div className="w-8 h-8 bg-blue-50/50 text-blue-600 rounded-lg flex items-center justify-center text-base mb-2 shadow-sm border border-blue-100/30">
                     🔍
                  </div>
                  <h3 className="text-[9px] font-black text-gray-900 uppercase tracking-widest mb-0.5">
                     Produk Tidak Ditemukan
                  </h3>
                  <p className="text-[7.5px] font-bold text-gray-400 max-w-xs text-center leading-relaxed uppercase">
                     Belum ada produk di kategori "{selectedCategory}" saat ini. Admin akan segera menambahkan produk baru!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 mb-20">
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
              )}
            </motion.div>
          )}

          {view === 'nokos' && (
            <motion.div
              key="nokos"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
            >
              <NokosMenuTab 
                auth={auth} 
                onUpdateBalance={(bal) => setAuth(prev => ({ ...prev, balance: bal }))} 
                setView={setView} 
                setOrders={setOrders} 
              />
            </motion.div>
          )}

          {view === 'smm' && (
            <motion.div
              key="smm"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
            >
              <SmmMenuTab 
                auth={auth} 
                onUpdateBalance={(bal) => setAuth(prev => ({ ...prev, balance: bal }))} 
                setView={setView} 
                setOrders={setOrders} 
              />
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
                               
                               {/* TAMPILKAN DATA BARANG SETELAH BAYAR ATAU LACAK SMM */}
                               {((order.status === 'Selesai' && order.items.some(i => i.issuedData && i.issuedData.length > 0)) || 
                                 order.items.some(i => i.issuedData?.some(d => d.startsWith('SMM_ORDER:')))) && (
                                 <div className="mt-4 space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 max-w-md">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                       <ShieldCheck className="w-3 h-3" /> 
                                       {order.items.some(i => i.issuedData?.some(d => d.startsWith('SMM_ORDER:')))
                                         ? 'Lacak Pesanan Suntik Sosmed'
                                         : (order.items.some(i => i.issuedData?.some(d => d !== 'Produk akan segera diproses')) 
                                           ? 'Data Barang Terkirim' 
                                           : 'Status Pengiriman')}
                                    </p>
                                    <div className="space-y-4">
                                       {order.items.map((item, idx) => (
                                          item.issuedData && item.issuedData.length > 0 && (
                                             <div key={idx} className="space-y-1">
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">{item.name}</p>
                                                <div className="flex flex-col gap-2">
                                                   {item.issuedData.map((data, dIdx) => {
                                                      if (data.startsWith('SMM_ORDER:')) {
                                                         return (
                                                            <div key={dIdx} className="w-full">
                                                               <SmmOrderTracker 
                                                                  orderId={order.id}
                                                                  rawStr={data}
                                                                  username={order.username}
                                                                  onUpdateBalance={(bal) => setAuth(prev => ({ ...prev, balance: bal }))}
                                                                  onUpdateOrderData={async (newRawStr, updatedStoreStatus) => {
                                                                     try {
                                                                        const updatedItems = order.items.map(oItem => {
                                                                           if (oItem.id === item.id) {
                                                                              const updatedIssued = [...(oItem.issuedData || [])];
                                                                              updatedIssued[dIdx] = newRawStr;
                                                                              return { ...oItem, issuedData: updatedIssued };
                                                                           }
                                                                           return oItem;
                                                                        });
                                                                        const updatedOrder = { 
                                                                           ...order, 
                                                                           items: updatedItems,
                                                                           status: updatedStoreStatus || order.status 
                                                                        };
                                                                        await ApiService.createOrder(updatedOrder, order.username);
                                                                        setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
                                                                     } catch (e) {
                                                                        console.error("Error saving updated SMM status:", e);
                                                                     }
                                                                  }}
                                                               />
                                                            </div>
                                                         );
                                                      }
                                                      if (data.startsWith('JASAOTP_ORDER:')) {
                                                         return (
                                                            <div key={dIdx} className="w-full">
                                                               <JasaOtpSmsRetriever 
                                                                 orderId={order.id}
                                                                 rawStr={data}
                                                                 username={order.username}
                                                                 refundAmount={order.totalAmount}
                                                                 onUpdateOrderData={async (newRawStr) => {
                                                                   try {
                                                                     const updatedItems = order.items.map(oItem => {
                                                                       if (oItem.id === item.id) {
                                                                          const updatedIssued = [...(oItem.issuedData || [])];
                                                                          updatedIssued[dIdx] = newRawStr;
                                                                          return { ...oItem, issuedData: updatedIssued };
                                                                       }
                                                                       return oItem;
                                                                     });
                                                                     const updatedOrder = { ...order, items: updatedItems };
                                                                     await ApiService.createOrder(updatedOrder, order.username);
                                                                     setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
                                                                   } catch (e) {
                                                                     console.error("Error saving updated JasaOTP status:", e);
                                                                   }
                                                                 }}
                                                               />
                                                            </div>
                                                         );
                                                      }
                                                      return (
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
                                                      );
                                                   })}
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
             <div className="max-w-3xl mx-auto w-full p-2 sm:p-4 lg:p-5 space-y-3.5 sm:space-y-4.5 animate-in slide-in-from-bottom-5 duration-500">
                {/* Header Card */}
                <div className="bg-white p-3.5 sm:p-4.5 rounded-xl border border-gray-100 shadow-xs relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-indigo-50/10 to-indigo-50/40 rounded-full -mr-18 -mt-18"></div>
                   <div className="relative z-10 flex flex-col">
                      <h2 className="text-[12px] sm:text-sm font-black text-gray-900 tracking-tight uppercase">Voucher & Promo</h2>
                      <p className="text-gray-400 font-semibold text-[10px] sm:text-[11px] mt-0.5 max-w-md">Gunakan kode voucher di bawah ini untuk mendapatkan potongan harga spesial.</p>
                   </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {vouchers.filter(v => v.isActive && (!v.recipient || (auth.username && v.recipient.toLowerCase() === auth.username.toLowerCase()))).length === 0 ? (
                      <div className="md:col-span-2 py-8 bg-indigo-50/5/10 rounded-xl border border-dashed border-indigo-100 flex flex-col items-center justify-center text-center gap-2">
                         <div className="w-8 h-8 bg-gray-50/80 rounded-full flex items-center justify-center text-gray-450 border border-gray-100">
                            <Tag className="w-4 h-4 text-gray-400" />
                         </div>
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Belum ada promo tersedia</p>
                      </div>
                   ) : (
                      vouchers.filter(v => v.isActive && (!v.recipient || (auth.username && v.recipient.toLowerCase() === auth.username.toLowerCase()))).map(v => (
                         <div key={v.id} className="bg-white p-3 sm:p-4 rounded-xl border border-gray-150/60 shadow-xs relative group hover:shadow-xs transition-all duration-200">
                            <div className="flex justify-between items-start mb-2.5">
                               <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                  <Tag className="w-3.5 h-3.5" />
                               </div>
                               <div className="text-right">
                                  <span className="text-[7px] font-bold text-indigo-500 uppercase tracking-wider block leading-none mb-0.5">Potongan</span>
                                  <p className="text-sm font-black text-gray-900 leading-none">{formatIDR(v.amount)}</p>
                               </div>
                            </div>
                            
                            <div className="space-y-2.5">
                               <div>
                                  <h4 className="text-[11px] sm:text-[12px] font-black text-gray-900 leading-none uppercase tracking-wide">{v.code}</h4>
                                  {v.minPurchase && v.minPurchase > 0 && (
                                     <p className="text-[8px] font-semibold text-gray-400 mt-0.5 leading-none">Min. Blj {formatIDR(v.minPurchase)}</p>
                                  )}
                               </div>

                               <div className="flex gap-1">
                                  <button 
                                     onClick={() => {
                                        navigator.clipboard.writeText(v.code);
                                        alert("Kode voucher berhasil disalin!");
                                     }}
                                     className="flex-1 py-1 sm:py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md font-black uppercase text-[8px] tracking-wider transition-all flex items-center justify-center gap-1"
                                  >
                                     <Copy className="w-2.5 h-2.5" /> Salin
                                  </button>
                                  <button 
                                     onClick={() => setView('home')}
                                     className="px-3 py-1 sm:py-1.5 bg-indigo-600 text-white rounded-md font-black uppercase text-[8px] tracking-wider hover:bg-indigo-700 transition-all flex items-center justify-center gap-0.5"
                                  >
                                     Pakai <ChevronRight className="w-2.5 h-2.5" />
                                  </button>
                               </div>
                            </div>

                            {/* Ticket Notch effect */}
                            <div className="absolute top-1/2 -left-1.5 w-3 h-3 bg-[#f8fafc] rounded-full border border-gray-100/80 -translate-y-1/2"></div>
                            <div className="absolute top-1/2 -right-1.5 w-3 h-3 bg-[#f8fafc] rounded-full border border-gray-100/80 -translate-y-1/2"></div>
                         </div>
                      ))
                   )}
                </div>
                
                {/* Reward Banner */}
                <div className="bg-indigo-600 p-3.5 sm:p-4.5 rounded-xl text-white overflow-hidden relative shadow-xs">
                   <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full -mr-18 -mt-18"></div>
                   <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                      <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg">
                         <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                         <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-wider mb-0.5">Dapatkan Lebih Banyak Reward!</h3>
                         <p className="text-white/80 text-[9.5px] font-medium leading-snug">Lakukan transaksi minimal 10 kali menggunakan Saldo MW-Wallet untuk mendapatkan bonus voucher saldo otomatis.</p>
                      </div>
                      <button 
                         onClick={() => setView('topup')}
                         className="w-full sm:w-auto px-3.5 py-1.5 bg-white text-indigo-600 rounded-md font-black uppercase text-[8px] tracking-wider hover:bg-indigo-50 transition-all active:scale-95"
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
      
      <footer className="bg-white border-t py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-2.5">
            <img src="https://i.imgur.com/oR61kTA.png" className="w-5 h-5 object-contain" alt="MWSTORE Logo" />
            <span className="text-sm font-extrabold text-gray-900 tracking-tighter">MWSTORE</span>
          </div>
          <p className="text-gray-400 text-[7px] font-bold uppercase tracking-[0.25em] mb-4">
            Official MW-Store Enabled Commerce
          </p>
          <div className="flex flex-wrap justify-center gap-2">
             <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-[8px] font-black uppercase tracking-widest text-gray-600 border border-gray-100 transition-all active:scale-95">
                <Download className="w-3 h-3" />
                Dapatkan App
             </button>
             <a href="https://wa.me/6283845890648" target="_blank" className="flex items-center gap-1.5 px-3.5 py-1.5 bg-green-50/70 hover:bg-green-100/70 rounded-lg text-[8px] font-black uppercase tracking-widest text-green-600 border border-green-100/30 transition-all active:scale-95">
                <MessageCircle className="w-3 h-3" />
                Customer Service
             </a>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-50 text-[7px] font-bold text-gray-400 uppercase tracking-widest">
             <p>© MWSTORE OFFICIAL - PERDAGANGAN PRODUK DIGITAL </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
