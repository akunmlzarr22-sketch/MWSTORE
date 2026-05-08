
import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Search, ChevronRight, LayoutGrid, LayoutDashboard, Trash2, Plus, Minus, CreditCard, AlertCircle, ShoppingCart, Settings, LogOut, Wallet, QrCode, Building2, CheckCircle2, Copy, MessageCircle, Mail, RefreshCw, Download, Info, Share2, ExternalLink, X, Smartphone, Globe, Gamepad2, Receipt, ShieldCheck, Banknote, Sparkles, Check, Scan, Save, MonitorSmartphone, Clock, Coins, ArrowUpCircle, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from './lib/firebase';
import { Product, CartItem, Order, View, AuthState, UserRole, UserAccount } from './types';
import { MOCK_PRODUCTS, formatIDR } from './constants';
import ProductCard from './components/ProductCard.tsx';
import AiAssistant from './components/AiAssistant.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import Login from './components/Login.tsx';
import UserProfile from './components/UserProfile.tsx';
import CustomerService from './components/CustomerService.tsx';
import { APP_CONFIG } from './config';
import { ApiService } from './services/apiService';
import { Message } from './types';

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
  const [isLoading, setIsLoading] = useState(true);

  // Authenticated listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // Fetch user data from Firestore
        const userData = await ApiService.getUser(user.uid);
        if (userData) {
          setAuth({
            isLoggedIn: true,
            role: userData.role,
            username: userData.username,
            balance: userData.balance
          });
        } else {
          // New user logic or handle error
          setAuth({
            isLoggedIn: true,
            role: 'user',
            username: user.displayName || user.email?.split('@')[0] || 'User',
            balance: 0
          });
        }
      } else {
        setAuth({
          isLoggedIn: false,
          role: null,
          username: null,
          balance: null
        });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const fetchedProducts = await ApiService.getProducts();
      setProducts(fetchedProducts.length > 0 ? fetchedProducts : MOCK_PRODUCTS);
      
      if (auth.isLoggedIn && auth.username) {
        const fetchedOrders = await ApiService.getOrders(firebaseAuth.currentUser?.uid || '', auth.role === 'admin');
        setOrders(fetchedOrders);
      }
    };
    fetchData();
  }, [auth.isLoggedIn, auth.role, auth.username]);

  // Listen for maintenance mode
  useEffect(() => {
    const unsubscribe = ApiService.listenToSettings((settings) => {
      if (settings && settings.maintenanceMode) {
        setIsMaintenance(true);
      } else {
        setIsMaintenance(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddOrUpdateProduct = async (product: Product) => {
    const productToSave = { ...product, rating: product.rating || 5.0 };
    await ApiService.saveProduct(productToSave);
    const updatedProducts = await ApiService.getProducts();
    setProducts(updatedProducts);
  };

  const handleUpdateUsers = (newUsers: UserAccount[]) => {
    setUsers(newUsers);
    // User data is now primarily handled via Google Auth and direct Firestore updates
  };

  const handleDeleteUser = async (username: string) => {
    // Soft delete or direct delete if needed, but for now we'll just alert that it's an admin task on Firebase Console
    alert(`Penghapusan akun ${username} harus dilakukan melalui Firebase Console atau Admin API.`);
  };

  const handleResetUserHistory = (username: string) => {
    alert(`Reset riwayat ${username} akan segera hadir.`);
  };

  const handleUpdateOrder = async (orderId: string, status: any) => {
    await ApiService.updateOrderStatus(orderId, status);
    const fetchedOrders = await ApiService.getOrders(firebaseAuth.currentUser?.uid || '', auth.role === 'admin');
    setOrders(fetchedOrders);
  };

  const handleDeleteProduct = async (id: string) => {
    await ApiService.deleteProduct(id);
    const updated = await ApiService.getProducts();
    setProducts(updated);
  };

  const [view, setView] = useState<View>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [paymentMethod, setPaymentMethod] = useState<'Saldo Akun' | 'QRIS / E-Wallet'>('Saldo Akun');
  const [isProcessing, setIsProcessing] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(50000);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [unreadMessages, setUnreadMessages] = useState<number>(0);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync unread messages
  useEffect(() => {
    if (auth.isLoggedIn && auth.username) {
      const unsubscribe = ApiService.listenToMessages(firebaseAuth.currentUser?.uid || '', auth.role === 'admin', (msgs) => {
        const unreadCount = msgs.filter(m => m.recipient === auth.username && !m.read).length;
        setUnreadMessages(unreadCount);
      });
      return () => unsubscribe();
    }
  }, [auth.isLoggedIn, auth.username, auth.role]);

  // Update Auth State Balance when users change
  useEffect(() => {
    if (auth.username && auth.isLoggedIn) {
      // Balance is already managed via AuthState which is updated in onAuthStateChanged
      // If we need to refresh it specifically when users list changes (admin action),
      // we can fetch it explicitly.
    }
  }, [users, auth.username, auth.isLoggedIn]);

  const categories = ['Semua', ...new Set(products.map(p => p.category))];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, products]);

  const handleLogin = (role: UserRole, username: string) => {
    // Note: This matches the old role/username but balance will come from onAuthStateChanged
    setAuth(prev => ({ ...prev, isLoggedIn: true, role, username }));
  };

  const handleRegister = (account: UserAccount): boolean => {
    // Registration is now handled via Google Login or Admin creation
    alert("Gunakan Google Login untuk mendaftar.");
    return false;
  };

  const handleLogout = async () => {
    await firebaseAuth.signOut();
    setAuth({ isLoggedIn: false, role: null, username: null, balance: null });
    setView('home');
    setCart([]);
  };

  const addToCart = (product: Product, redirect: boolean = false) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    if (redirect) setView('cart');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleProcessPayment = () => {
    if (cart.length === 0) return;
    
    if (paymentMethod === 'Saldo Akun' && (auth.balance || 0) < cartTotal) {
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
        await ApiService.saveProduct(p);
      }
      setProducts(newProducts);

      const orderId = Math.floor(100000 + Math.random() * 900000).toString();
      const newOrder: Order = {
        id: orderId,
        items: processedCart,
        totalAmount: cartTotal,
        date: new Date().toLocaleString('id-ID'),
        status: paymentMethod === 'Saldo Akun' ? 'Proses' : 'Pending',
        paymentMethod: paymentMethod,
        username: auth.username || 'Guest'
      };

      await ApiService.createOrder(newOrder, firebaseAuth.currentUser?.uid || 'guest');
      setOrders(prev => [newOrder, ...prev]);

      // If paid by balance, update balance
      if (paymentMethod === 'Saldo Akun' && auth.username) {
        const newBalance = (auth.balance || 0) - cartTotal;
        await ApiService.updateBalanceByUsername(auth.username, newBalance);
        setAuth(prev => ({ ...prev, balance: newBalance }));
      }

      setCart([]);
      setIsProcessing(false);
      setView('orders');
    }, 1500);
  };

  const handleProcessTopup = () => {
    if (topupAmount < 1000) return;
    setIsProcessing(true);
    
    setTimeout(async () => {
      if (auth.username) {
        const topupId = Math.random().toString(36).substring(7).toUpperCase();
        
        // Catat Transaksi Top Up sebagai PENDING
        const newTopUp: TopUpTransaction = {
          id: topupId,
          username: auth.username,
          amount: topupAmount,
          date: new Date().toLocaleString('id-ID'),
          status: 'Pending'
        };

        await ApiService.createTopUp(newTopUp, firebaseAuth.currentUser?.uid || 'guest');

        setIsProcessing(false);
        
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
        
        setView('profile'); // Arahkan ke profil untuk lihat riwayat
      }
    }, 1500);
  };

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
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-lg font-black text-gray-900 tracking-tighter">MWSTORE</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Balance Badge - Clickable to Top Up */}
            <button 
              onClick={() => setView('topup')}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-colors"
            >
               <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
               </div>
               <div className="flex flex-col items-start text-left">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">Isi Saldo</span>
                  <span className="text-xs font-black text-indigo-700 leading-tight">{formatIDR(auth.balance || 0)}</span>
               </div>
            </button>

            <button onClick={() => setView('orders')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
              <Receipt className="w-6 h-6" />
            </button>
            <button onClick={() => setView('customer-service')} className="relative p-2 text-gray-500 hover:text-blue-600 transition-colors">
              <MessageCircle className="w-6 h-6" />
              {unreadMessages > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>
            <button onClick={() => setView('profile')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
              <User className="w-6 h-6" />
            </button>
            {auth.role === 'admin' && (
              <button 
                onClick={() => setView('admin')} 
                className="p-2 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 rounded-xl"
                title="Dashboard Admin"
              >
                <LayoutDashboard className="w-6 h-6" />
              </button>
            )}
            <button onClick={() => setView('cart')} className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </nav>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
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
                            value={topupAmount}
                            onChange={(e) => setTopupAmount(Number(e.target.value))}
                            className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500/20 rounded-[2rem] py-6 pl-16 pr-8 focus:ring-4 focus:ring-indigo-500/5 outline-none font-black text-2xl text-gray-900 transition-all"
                            placeholder="Min. 1.000"
                            min="1000"
                          />
                       </div>
                       <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter px-2">
                         Minimal Top Up adalah Rp 1.000
                       </p>
                    </div>

                    <div className="bg-orange-50 p-6 rounded-[2.5rem] border border-orange-100 flex items-start gap-4">
                       <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                          <Info className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-[10px] text-orange-700 font-black uppercase tracking-widest mb-1">Informasi Pembayaran</p>
                          <p className="text-xs text-orange-600/80 font-bold leading-relaxed">
                             Pembayaran dilakukan secara manual dengan menghubungi WhatsApp Admin. Klik tombol di bawah untuk mendapatkan instruksi pembayaran ke nomor admin.
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
                                <MessageCircle className="w-6 h-6" />
                                Hubungi Admin & Bayar
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
                               <span className="text-[10px] font-black text-gray-900 uppercase">Total Bayar</span>
                               <span className="text-xl font-black text-blue-600">{formatIDR(cartTotal)}</span>
                            </div>
                         </div>
                      </div>

                      {(paymentMethod === 'Saldo Akun' && (auth.balance || 0) < cartTotal) && (
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
                         disabled={isProcessing || (paymentMethod === 'Saldo Akun' && (auth.balance || 0) < cartTotal)}
                         className="w-full py-6 bg-green-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                         {isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                         {paymentMethod === 'Saldo Akun' ? 'Bayar Pakai Saldo Sekarang' : 'Konfirmasi Sudah Transfer'}
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
                               {order.status !== 'Pending' && order.items.some(i => i.issuedData && i.issuedData.length > 0) && (
                                 <div className="mt-4 space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 max-w-md">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                       <ShieldCheck className="w-3 h-3" /> Data Barang Terkirim
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
                                  order.status === 'Pending' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                               }`}>
                                  {order.status === 'Pending' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
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
        </AnimatePresence>
      </main>

      <AiAssistant />
      
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
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-lg">
              {unreadMessages}
            </span>
          )}
        </motion.button>
      )}
      
      <footer className="bg-white border-t py-20 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-100">MW</div>
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
