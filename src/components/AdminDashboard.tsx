
import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Package, Search, TrendingUp, DollarSign, ArrowLeft, Plus, X, Image as ImageIcon, Tag, Trash2, LayoutDashboard, ShoppingBasket, Wallet, RefreshCw, Smartphone, Users, User, Eye, EyeOff, ShieldCheck, AlertCircle, Settings, Mail, MessageCircle, LayoutGrid, Coins, ArrowUpRight, ArrowDownLeft, Clock, Copy, Check, CheckCircle, Menu, LogOut, Loader2 } from 'lucide-react';
import { formatIDR } from '@/constants';
import { Order, Product, UserAccount, TopUpTransaction, Message, Voucher, PaymentSettings, PaymentGatewayConfig } from '@/types';
import { APP_CONFIG } from '@/config';
import { ApiService, safeParseDate } from '@/services/apiService';
import { compressImage } from '@/lib/imageUtils';
import CommunityChat from '@/components/CommunityChat';

interface AdminDashboardProps {
  orders: Order[];
  onBack: () => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateUsers: (users: UserAccount[]) => void;
  onUpdateOrder?: (orderId: string, status: 'Pending' | 'Proses' | 'Selesai' | 'Gagal') => void;
  onDeleteUser?: (username: string) => void;
  onResetUserHistory?: (username: string) => void;
  onLogout?: () => void;
  products: Product[];
  users: UserAccount[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  orders, 
  onBack, 
  onAddProduct, 
  onDeleteProduct, 
  onUpdateUsers, 
  onUpdateOrder,
  onDeleteUser,
  onResetUserHistory,
  onLogout,
  products, 
  users 
}) => {
  // Calculate top users for the chart
  const getTopUsersData = () => {
    const userCounts: Record<string, number> = {};
    orders.forEach(order => {
        userCounts[order.username] = (userCounts[order.username] || 0) + 1;
    });
    
    return Object.entries(userCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  };

  const topUsersChartData = getTopUsersData();
  const COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'];
  
  const [activeTab, setActiveTab] = useState<'stats' | 'products' | 'system' | 'users' | 'orders' | 'messages' | 'topups' | 'community' | 'vouchers' | 'payment'>('users');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [selectedUserChat, setSelectedUserChat] = useState<string | null>(null);
  const [adminMessages, setAdminMessages] = useState<Message[]>([]);
  const [hasNewCommunityMessage, setHasNewCommunityMessage] = useState(false);
  const lastProcessedCommunityMsgId = useRef<string | null>(null);
  const isInitialLoadAdmin = useRef(true);
  const [userTopUps, setUserTopUps] = useState<TopUpTransaction[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  const getDefaultExpiry = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    // Format to yyyy-MM-ddThh:mm for datetime-local input
    return d.toISOString().slice(0, 16);
  };

  const generateRandomCode = (prefix = 'MW') => {
    return `${prefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  };

  const [newVoucher, setNewVoucher] = useState({
    code: '',
    amount: '',
    type: 'fixed' as 'fixed' | 'percentage',
    isActive: true,
    minPurchase: '0',
    expiryDate: getDefaultExpiry(),
    recipient: ''
  });
  const [newAdminMessage, setNewAdminMessage] = useState('');
  const [isUploadingChat, setIsUploadingChat] = useState(false);
  const adminChatFileInputRef = useRef<HTMLInputElement>(null);
  const adminChatEndRef = useRef<HTMLDivElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubMaintenance = ApiService.listenToSettings((settings) => {
      if (settings && settings.maintenanceMode !== undefined) {
        setIsMaintenance(settings.maintenanceMode);
      }
    });

    const unsubMessages = ApiService.listenToMessages('', true, (msgs) => {
      setAdminMessages(msgs);

      // Handle community notification for admin
      if (msgs.length > 0) {
        const newestMsg = msgs[0];
        if (newestMsg.id !== lastProcessedCommunityMsgId.current) {
          lastProcessedCommunityMsgId.current = newestMsg.id;
          
          if (!isInitialLoadAdmin.current) {
            if (newestMsg.recipient === 'community' && newestMsg.sender !== 'admin') {
              setHasNewCommunityMessage(true);
            }
          }
        }
        isInitialLoadAdmin.current = false;
      }
    }, 'all');

    const unsubTopUps = ApiService.listenToTopUps('', true, (data) => {
      setUserTopUps(data);
    });

    const unsubVouchers = ApiService.listenToVouchers('', true, (data) => {
      setVouchers(data);
    });

    const fetchPaymentSettings = async (retryCount = 0) => {
      try {
        console.log(`AdminDashboard: Fetching payment settings (attempt ${retryCount + 1})...`);
        const settings = await ApiService.getPaymentSettings();
        if (settings) {
          setPaymentSettings(settings);
          setPaymentError(null);
        } else {
          // If settings is null but no error was thrown, it means handleFirestoreError caught it
          // Check if auth is actually working
          if (!ApiService.getCurrentUser()) {
             setPaymentError("Akses Ditolak: Anda tidak memiliki izin untuk melihat pengaturan pembayaran.");
          } else {
              // Init default if not found (but no error)
              setPaymentSettings({
                id: 'payment',
                gateways: [
                  { provider: 'Pak Kasir', merchantCode: '', apiKey: '', privateKey: '', baseUrl: '', isActive: false, mode: 'Production', slug: '' },
                  { provider: 'Manual', merchantCode: '', apiKey: '', privateKey: '', baseUrl: '', isActive: true, mode: 'Production', slug: '' }
                ],
                updatedAt: new Date().toISOString(),
                updatedBy: 'admin'
              });
          }
        }
      } catch (err: any) {
        console.warn("AdminDashboard: Error loading payment settings:", err);
        
        const isAuthDisabled = err.message?.includes('AUTHENTICATION_DISABLED');
        const isPermissionError = err.message?.includes('permissions') || err.message?.includes('PERMISSION_DENIED');
        
        if (isAuthDisabled) {
          setPaymentError("Sistem Error: Login anonim dinonaktifkan di Firebase Console. Harap aktifkan Otentikasi Anonim di Firebase Console.");
        } else if (isPermissionError && retryCount < 5) {
          console.log(`AdminDashboard: Permission delay or auth sync required, retrying in 3s... (retry ${retryCount + 1}/5)`);
          setTimeout(() => fetchPaymentSettings(retryCount + 1), 3000);
        } else {
          setPaymentError("Gagal memuat pengaturan pembayaran. Mohon pastikan akun Anda memiliki akses Admin.");
        }
      } finally {
        setIsLoadingPayment(false);
      }
    };

    fetchPaymentSettings();

    return () => {
      unsubMaintenance();
      unsubMessages();
      unsubTopUps();
      unsubVouchers();
    };
  }, []);

  useEffect(() => {
    adminChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedUserChat, adminMessages]);

  useEffect(() => {
    if (selectedUserChat && activeTab === 'messages' && adminMessages.length > 0) {
      const messagesToMark = adminMessages
        .filter(m => m.sender === selectedUserChat && m.recipient !== 'community' && !m.read && m.sender !== 'admin')
        .map(m => m.id as string);
      
      if (messagesToMark.length > 0) {
        // Optimistic update to reflect immediately in UI
        setAdminMessages(prev => prev.map(m => 
          messagesToMark.includes(m.id) ? { ...m, read: true } : m
        ));
        ApiService.markAsRead(messagesToMark);
      }
    }
  }, [selectedUserChat, adminMessages, activeTab]);

  const handleMarkAllMessagesRead = async () => {
    const unreadIds = adminMessages
      .filter(m => m.sender !== 'admin' && m.recipient !== 'community' && !m.read)
      .map(m => m.id as string);
    
    if (unreadIds.length > 0) {
      // Optimistic update
      setAdminMessages(prev => prev.map(m => 
        unreadIds.includes(m.id) ? { ...m, read: true } : m
      ));
      await ApiService.markAsRead(unreadIds);
    }
  };

  const handleSendAdminReply = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!newAdminMessage.trim() && !imageUrl) return;
    if (!selectedUserChat) return;

    const recipient = selectedUserChat.toLowerCase().trim();

    const newMessage: Message = {
       id: Math.floor(100000 + Math.random() * 900000).toString(),
       sender: 'admin',
       recipient: recipient,
       content: newAdminMessage,
       imageUrl: imageUrl,
       timestamp: new Date().toISOString(),
       read: false // Mark as unread for the user
    };

    await ApiService.sendMessage(newMessage, 'admin');
    setNewAdminMessage('');
  };

  const handleAdminChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingChat(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        await handleSendAdminReply(undefined, compressed);
      } catch (error) {
        console.error("Compression error:", error);
        alert("Gagal memproses gambar.");
      } finally {
        setIsUploadingChat(false);
        if (adminChatFileInputRef.current) adminChatFileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert("Gagal membaca file.");
      setIsUploadingChat(false);
    };
    reader.readAsDataURL(file);
  };

  const getUserLastMessage = (username: string) => {
    const userMsgs = adminMessages.filter(m => (m.sender === username || m.recipient === username) && m.recipient !== 'community');
    return userMsgs[0]; // Messages are stored newest first in ApiService.getMessages
  };

  const getUnreadCount = (username: string) => {
    return adminMessages.filter(m => m.sender === username && m.recipient !== 'community' && !m.read).length;
  };

  const toggleMaintenance = async () => {
    const newState = !isMaintenance;
    setIsMaintenance(newState);
    await ApiService.setMaintenanceMode(newState);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Top Up Game',
    image: '',
    stock: '',
    discount: '0',
    productType: 'Duplikat' as 'Duplikat' | 'Unik',
    inventory: [''] as string[]
  });

  const [balanceAdjustments, setBalanceAdjustments] = useState<Record<string, string>>({});
  const [selectedUserHistory, setSelectedUserHistory] = useState<string | null>(null);

  const handleAdjustBalance = async (username: string, isAddition: boolean) => {
    const amountStr = balanceAdjustments[username] || '0';
    const amount = Number(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
      alert("Masukkan jumlah yang valid (lebih dari 0)");
      return;
    }

    const user = users.find(u => u.username === username);
    const current = user?.balance || 0;
    const multiplier = isAddition ? 1 : -1;
    const finalAmount = amount * multiplier;
    
    if (!isAddition && current + finalAmount < 0) {
       alert("Saldo tidak bisa kurang dari 0!");
       return;
    }

    const success = await ApiService.updateBalanceByUsername(username, current + finalAmount);
    if (success) {
      // Catat sebagai Top Up / Adjustment
      await ApiService.createTopUp({
        id: `ADJ-${Math.random().toString(36).substring(7).toUpperCase()}`,
        username: username,
        amount: finalAmount,
        date: new Date().toLocaleString('id-ID'),
        status: 'Selesai'
      }, username); 
      
      setBalanceAdjustments(prev => ({ ...prev, [username]: '' }));
      alert(`Berhasil ${isAddition ? 'menambah' : 'mengurangi'} saldo ${username}.`);
    }
  };

  const handleApproveTopUp = async (topup: TopUpTransaction) => {
    if (confirm(`Setujui Top Up sebesar ${formatIDR(topup.amount)} untuk ${topup.username}?`)) {
      const user = users.find(u => u.username === topup.username);
      if (!user) {
        alert("User tidak ditemukan di database!");
        return;
      }
      const currentBalance = user.balance || 0;
      const success = await ApiService.updateBalanceByUsername(topup.username, currentBalance + topup.amount);
      
      if (success) {
        await ApiService.updateTopUpStatus(topup.id!, 'Selesai');
        alert('Top Up Berhasil Disetujui!');
      }
    }
  };

  const handleCancelTopUp = async (topupId: string) => {
    if (confirm("Yakin ingin membatalkan request top up ini?")) {
      await ApiService.updateTopUpStatus(topupId, 'Gagal');
      alert('Top Up Dibatalkan!');
    }
  };

  const handleRejectTopUp = async (topupId: string) => {
    await handleDeleteTopUp(topupId);
  };

  const handleDeleteTopUp = async (topupId: string) => {
    if (confirm("Hapus riwayat top up ini dari database?")) {
      await ApiService.deleteTopUp(topupId);
    }
  };

  const handleDeleteChat = async (username: string) => {
    if (confirm(`Hapus semua percakapan dengan ${username}? Tindakan ini tidak bisa dibatalkan.`)) {
      // Optimistic update
      setAdminMessages(prev => prev.filter(m => m.sender !== username && m.recipient !== username));
      await ApiService.deleteChatByUsername(username);
      setSelectedUserChat(null);
    }
  };

  const handleDeleteSingleMessage = async (messageId: string) => {
    if (confirm("Hapus pesan ini?")) {
      // Optimistic update
      setAdminMessages(prev => prev.filter(m => m.id !== messageId));
      await ApiService.deleteMessage(messageId);
    }
  };

  const handleDeleteAllMessages = async () => {
    if (confirm("Apakah Anda yakin ingin menghapus SEMUA pesan? Tindakan ini akan mengosongkan seluruh riwayat chat semua pengguna.")) {
      // Optimistic update
      setAdminMessages([]);
      await ApiService.deleteAllMessages();
      setSelectedUserChat(null);
    }
  };

  const handleDeleteAllTopUps = async () => {
    if (confirm("Apakah Anda yakin ingin menghapus SEMUA riwayat top up?")) {
      await ApiService.deleteAllTopUps();
    }
  };

  const handleDeleteAllOrders = async () => {
    if (confirm("Apakah Anda yakin ingin menghapus SEMUA riwayat pesanan?")) {
      await ApiService.deleteAllOrders();
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (confirm(`Yakin ingin menghapus akun ${username}?`)) {
      await ApiService.deleteUser(username);
      alert('Akun dihapus.');
      onUpdateUsers?.(users.filter(u => u.username !== username));
    }
  };

  const handleDeleteUserHistory = async (username: string) => {
    if (confirm(`Yakin ingin menghapus riwayat transaksi ${username}?`)) {
      await ApiService.deleteOrderHistoryByUsername(username);
      alert('Riwayat dihapus.');
    }
  };

  const handleClearAllProducts = async () => {
    if (confirm("Apakah Anda yakin ingin mengosongkan semua produk? Tindakan ini tidak dapat dibatalkan.")) {
      await ApiService.saveProducts([]);
      alert("Katalog telah dikosongkan.");
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If no code, generate one automatically
    const codeToUse = newVoucher.code.trim().toUpperCase() || generateRandomCode();
    const amountToUse = Number(newVoucher.amount) || 0;

    await ApiService.createVoucher({
      code: codeToUse,
      amount: amountToUse,
      type: newVoucher.type,
      isActive: newVoucher.isActive,
      minPurchase: Number(newVoucher.minPurchase),
      expiryDate: newVoucher.expiryDate || getDefaultExpiry(),
      recipient: newVoucher.recipient.trim().toLowerCase() || ''
    });

    setNewVoucher({
      code: '',
      amount: '',
      type: 'fixed',
      isActive: true,
      minPurchase: '0',
      expiryDate: getDefaultExpiry(),
      recipient: ''
    });
    alert(`Voucher ${codeToUse} berhasil dibuat!`);
  };

  const handleQuickGiftVoucher = async (username: string, amount: number) => {
    const code = generateRandomCode('GIFT');
    const expiry = getDefaultExpiry();
    
    await ApiService.createVoucher({
      code,
      amount,
      type: 'fixed',
      isActive: true,
      minPurchase: 0,
      expiryDate: expiry,
      recipient: username.toLowerCase(),
      description: `Hadiah langsung untuk ${username}`,
      createdAt: new Date().toISOString()
    });
    
    // Kirim pesan notifikasi
    await ApiService.sendMessage({
      sender: 'admin',
      recipient: username,
      content: `🎁 Anda mendapatkan hadiah Voucher Diskon senilai ${formatIDR(amount)}!\n\nKode: ${code}\n\nBerlaku selama 2 hari. Gunakan saat checkout!`,
      timestamp: new Date().toISOString(),
      read: false
    }, 'admin');

    alert(`Voucher hadiah ${formatIDR(amount)} berhasil dikirim ke ${username}`);
  };

  const handleSavePaymentSettings = async () => {
    if (!paymentSettings) return;
    setIsSavingPayment(true);
    await ApiService.savePaymentSettings(paymentSettings);
    setIsSavingPayment(false);
    alert("Konfigurasi Pembayaran Berhasil Disimpan!");
  };

  const updateGatewayConfig = (provider: string, updates: Partial<any>) => {
    if (!paymentSettings) return;
    const newGateways = paymentSettings.gateways.map(g => 
      g.provider === (provider as any) ? { ...g, ...updates } : g
    );
    setPaymentSettings({ ...paymentSettings, gateways: newGateways });
  };

  const handleDeleteVoucher = async (code: string) => {
    if (confirm(`Hapus voucher ${code}?`)) {
      await ApiService.deleteVoucher(code);
    }
  };

  const filteredUsers = users.filter(user => {
    const query = userSearchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(query) ||
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.phone && user.phone.includes(userSearchQuery))
    );
  });

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category,
      image: product.image,
      stock: product.stock.toString(),
      discount: (product.discount || 0).toString(),
      productType: (product.productType || 'Duplikat') as 'Duplikat' | 'Unik',
      inventory: product.inventory?.length ? [...product.inventory] : ['']
    });
    setShowAddModal(true);
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setNewProduct({ 
      name: '', 
      description: '', 
      price: '', 
      category: 'Top Up Game', 
      image: '', 
      stock: '',
      discount: '0',
      productType: 'Duplikat',
      inventory: ['']
    });
    setShowAddModal(false);
  };

  const handleAddProduct = async (e: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!newProduct.name || !newProduct.price) {
      alert("Nama dan harga harus diisi!");
      return;
    }

    try {
      if (editingProduct) {
        const updatedProduct: Product = {
          ...editingProduct,
          name: newProduct.name,
          description: newProduct.description,
          price: Number(newProduct.price),
          category: newProduct.category,
          image: newProduct.image,
          stock: newProduct.productType === 'Unik' ? newProduct.inventory.filter(i => i.trim()).length : Number(newProduct.stock),
          discount: Number(newProduct.discount),
          productType: (newProduct.productType || 'Duplikat') as 'Duplikat' | 'Unik',
          inventory: newProduct.inventory.filter(i => i.trim())
        };
        await onAddProduct(updatedProduct); 
        setEditingProduct(null);
        alert("Produk berhasil diperbarui!");
      } else {
        const product: Product = {
          id: 'PROD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          name: newProduct.name,
          description: newProduct.description,
          price: Number(newProduct.price),
          category: newProduct.category,
          image: newProduct.image || `https://picsum.photos/seed/${newProduct.name}/600/400`,
          rating: 5.0,
          stock: newProduct.productType === 'Unik' ? newProduct.inventory.filter(i => i.trim()).length : (Number(newProduct.stock) || 10),
          discount: Number(newProduct.discount),
          productType: (newProduct.productType || 'Duplikat') as 'Duplikat' | 'Unik',
          inventory: newProduct.inventory.filter(i => i.trim())
        };
        await onAddProduct(product);
        alert("Produk berhasil ditambahkan!");
      }
      setNewProduct({ 
        name: '', 
        description: '', 
        price: '', 
        category: 'Top Up Game', 
        image: '', 
        stock: '',
        discount: '0',
        productType: 'Duplikat',
        inventory: ['']
      });
      setShowAddModal(false);
    } catch (error) {
      console.error("Error creating product:", error);
      alert("Gagal menyimpan produk. Silakan cek koneksi atau izin admin.");
    }
  };

  const getChatParticipants = () => {
    const participantsMap = new Map<string, string>(); // lowercase -> original case (keep one)
    adminMessages.forEach(m => {
      if (m.recipient !== 'community') {
        if (m.sender !== 'admin') {
          participantsMap.set(m.sender.toLowerCase(), m.sender);
        }
        if (m.recipient !== 'admin') {
          participantsMap.set(m.recipient.toLowerCase(), m.recipient);
        }
      }
    });
    
    return Array.from(participantsMap.values()).sort((a, b) => {
      const lastA = getUserLastMessage(a);
      const lastB = getUserLastMessage(b);
      return safeParseDate(lastB?.timestamp).getTime() - safeParseDate(lastA?.timestamp).getTime();
    });
  };

  const chatParticipants = getChatParticipants();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Navigation */}
      <aside className={`fixed lg:sticky top-0 h-screen bg-white shadow-2xl lg:shadow-none border-r flex flex-col shrink-0 z-50 transition-all duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:w-72'}`}>
        <div className="p-8 pb-10 flex items-center justify-between">
           <h1 className="text-2xl font-black text-gray-900 tracking-tighter flex flex-col gap-2">
              MWSTORE 
              <span className="text-indigo-600 text-[10px] font-black px-2 py-1 bg-indigo-50 rounded-lg uppercase tracking-widest border border-indigo-100 self-start">Super Admin Panel</span>
           </h1>
           <button 
             onClick={() => setIsSidebarOpen(false)}
             className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors"
           >
             <X className="w-5 h-5 text-gray-500" />
           </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
          <button 
            onClick={() => { setActiveTab('stats'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === 'stats' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
               <LayoutDashboard className="w-4 h-4" />
            </div>
            <span>Dashboard Stats</span>
          </button>

          <button 
            onClick={() => { 
              setActiveTab('messages'); 
              setIsSidebarOpen(false); 
            }}
            className={`w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'messages' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className="flex items-center gap-4">
               <div className={`p-2 rounded-xl transition-colors ${activeTab === 'messages' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
                  <MessageCircle className="w-4 h-4" />
               </div>
               <span>Pesan Masuk</span>
            </div>
            {adminMessages.filter(m => m.sender !== 'admin' && m.recipient !== 'community' && !m.read).length > 0 && (
              <div className="relative">
                <span className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-[9px] font-black rounded-full border-2 border-white shadow-sm animate-in zoom-in duration-300">
                  {adminMessages.filter(m => m.sender !== 'admin' && m.recipient !== 'community' && !m.read).length}
                </span>
                <span className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-20"></span>
              </div>
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('community'); setIsSidebarOpen(false); setHasNewCommunityMessage(false); }}
            className={`w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'community' ? 'bg-orange-600 text-white shadow-xl shadow-orange-100' : 'text-gray-400 hover:bg-gray-50 hover:text-orange-600'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-xl transition-colors ${activeTab === 'community' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-orange-50'}`}>
                 <Users className="w-4 h-4" />
              </div>
              <span>Grup Komunitas</span>
            </div>
            {hasNewCommunityMessage && activeTab !== 'community' && (
              <span className="w-2.5 h-2.5 bg-red-600 border-2 border-white rounded-full animate-pulse shadow-sm"></span>
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('topups'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'topups' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className="flex items-center gap-4">
               <div className={`p-2 rounded-xl transition-colors ${activeTab === 'topups' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
                  <Coins className="w-4 h-4" />
               </div>
               <span>Top Up Request</span>
            </div>
            {userTopUps.filter(t => t.status === 'Pending').length > 0 && (
              <span className="flex items-center justify-center min-w-[24px] h-6 bg-red-600 border-2 border-white text-white text-[10px] font-black rounded-full shadow-lg animate-pulse">
                {userTopUps.filter(t => t.status === 'Pending').length}
              </span>
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
               <Users className="w-4 h-4" />
            </div>
            <span>Data Pengguna</span>
          </button>

          <button 
            onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'products' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === 'products' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
               <ShoppingBasket className="w-4 h-4" />
            </div>
            <span>Katalog Produk</span>
          </button>

          <button 
            onClick={() => { setActiveTab('vouchers'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'vouchers' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === 'vouchers' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
               <Tag className="w-4 h-4" />
            </div>
            <span>Kelola Voucher</span>
          </button>

          <button 
            onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className="flex items-center gap-4">
               <div className={`p-2 rounded-xl transition-colors ${activeTab === 'orders' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
                  <LayoutGrid className="w-4 h-4" />
               </div>
               <span>Semua Pesanan</span>
            </div>
            {orders.filter(o => o.status === 'Pending').length > 0 && (
              <span className="flex items-center justify-center min-w-[24px] h-6 bg-red-600 border-2 border-white text-white text-[10px] font-black rounded-full shadow-lg animate-pulse">
                {orders.filter(o => o.status === 'Pending').length}
              </span>
            )}
          </button>

          <div className="h-4"></div>
          <p className="px-6 text-[8px] font-black text-gray-300 uppercase tracking-[0.2em] mb-2">Konfigurasi</p>
          
          <button 
            onClick={() => { setActiveTab('payment'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'payment' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === 'payment' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
               <ShieldCheck className="w-4 h-4" />
            </div>
            <span>Integrasi Gateway</span>
          </button>

          <button 
            onClick={() => { setActiveTab('system'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'system' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === 'system' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
               <Settings className="w-4 h-4" />
            </div>
            <span>Sistem & Maintenance</span>
          </button>
        </nav>

        <div className="p-6 border-t border-gray-50 space-y-2">
           <button 
             onClick={onBack}
             className="w-full flex items-center gap-4 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl text-blue-600 hover:bg-blue-50 transition-all border border-blue-50"
           >
             <ArrowLeft className="w-4 h-4" />
             Kembali ke Toko
           </button>
           <button 
             onClick={onLogout}
             className="w-full flex items-center gap-4 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl text-red-600 hover:bg-red-50 transition-all border border-red-50"
           >
             <LogOut className="w-4 h-4" />
             Keluar Akun
           </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 px-6 lg:px-8 h-20 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4">
              <div className="relative">
                 <button 
                   onClick={() => setIsSidebarOpen(true)}
                   className="lg:hidden p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors text-gray-600"
                 >
                    <Menu className="w-6 h-6" />
                 </button>
                 {(adminMessages.filter(m => m.sender !== 'admin' && m.recipient !== 'community' && !m.read).length + 
                   userTopUps.filter(t => t.status === 'Pending').length +
                   orders.filter(o => o.status === 'Pending').length +
                   (hasNewCommunityMessage ? 1 : 0)) > 0 && (
                   <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 border-2 border-white rounded-full lg:hidden block animate-pulse"></span>
                 )}
              </div>
              <div>
                 <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    {activeTab === 'stats' && 'Statistik & Ringkasan'}
                 {activeTab === 'messages' && 'Layanan Pelanggan (Inbox)'}
                 {activeTab === 'topups' && 'Konfirmasi Pembayaran Saldo'}
                 {activeTab === 'users' && 'Manajemen Saldo & Akun'}
                 {activeTab === 'products' && 'Manajemen Katalog'}
                 {activeTab === 'orders' && 'Riwayat Transaksi Pelanggan'}
                 {activeTab === 'system' && 'Pengaturan Sistem'}
                 {activeTab === 'community' && 'Obrolan Komunitas'}
                 
                 {/* Header dot indicators */}
                 {activeTab !== 'messages' && adminMessages.filter(m => m.sender !== 'admin' && m.recipient !== 'community' && !m.read).length > 0 && (
                   <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                 )}
                 {activeTab !== 'community' && hasNewCommunityMessage && (
                   <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.5)]"></span>
                 )}
                 {activeTab !== 'topups' && userTopUps.filter(t => t.status === 'Pending').length > 0 && (
                   <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                 )}
              </h2>
              <p className="text-[10px] font-bold text-gray-400">Selamat datang kembali, Admin MWStore</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                 <div className={`w-2 h-2 rounded-full ${isMaintenance ? 'bg-orange-500' : 'bg-green-500'} animate-pulse`}></div>
                 <span className="text-[9px] font-black uppercase tracking-widest">{isMaintenance ? 'Maintenance' : 'Server Live'}</span>
              </div>
              
              <button 
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
           </div>
        </header>

        <main className="p-8 pb-32 flex-1">
        {activeTab === 'community' && (
           <div className="animate-in slide-in-from-bottom-5 duration-500">
              <CommunityChat username="admin" isAdmin={true} onBack={() => setActiveTab('stats')} />
           </div>
        )}
        {activeTab === 'messages' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-5 duration-500 min-h-[600px] h-[calc(100vh-280px)]">
            {/* List Chat */}
            <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden">
               <div className="p-6 border-b border-gray-50 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-indigo-600">
                    <h3 className="font-black uppercase tracking-[0.2em] text-[10px]">Layanan Pelanggan</h3>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={handleDeleteAllMessages}
                         className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-red-500"
                         title="Hapus Semua Pesan Di Sistem"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={handleMarkAllMessagesRead}
                         className="p-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                         title="Tandai Semua Dibaca"
                       >
                         <CheckCircle className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                  <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Daftar Percakapan</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Total {adminMessages.filter(m => m.sender !== 'admin' && m.recipient !== 'community' && !m.read).length} Pesan Belum Dibaca</p>
               </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {chatParticipants.map(participantUsername => {
                     const lastMsg = getUserLastMessage(participantUsername);
                     const unread = getUnreadCount(participantUsername);
                     return (
                        <button 
                          key={participantUsername}
                          onClick={() => {
                            setSelectedUserChat(participantUsername);
                            const unreadIds = adminMessages
                              .filter(m => m.sender === participantUsername && !m.read)
                              .map(m => m.id);
                            
                            if (unreadIds.length > 0) {
                              // Optimistic update
                              setAdminMessages(prev => prev.map(msg => 
                                unreadIds.includes(msg.id) ? { ...msg, read: true } : msg
                              ));
                              ApiService.markAsRead(unreadIds as string[]);
                            }
                          }}
                          className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border-2 ${
                            selectedUserChat === participantUsername 
                              ? 'bg-blue-50 border-blue-600 shadow-md' 
                              : 'bg-white border-transparent hover:bg-gray-50'
                          }`}
                        >
                           <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black shrink-0">
                              {participantUsername.charAt(0).toUpperCase()}
                           </div>
                           <div className="flex-1 text-left min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                 <div className="flex items-center gap-2 min-w-0">
                                   <span className="font-black text-gray-900 truncate">{participantUsername}</span>
                                   {unread > 0 && (
                                     <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.5)]"></span>
                                   )}
                                 </div>
                                 {unread > 0 && (
                                   <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full leading-none shrink-0 ml-2">
                                      {unread}
                                   </span>
                                 )}
                              </div>
                              <p className="text-[10px] text-gray-400 truncate">
                                 {lastMsg ? lastMsg.content : 'Belum ada pesan'}
                              </p>
                           </div>
                        </button>
                     );
                  })}
                  {chatParticipants.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-xs font-black text-gray-300 uppercase">Tidak ada percakapan</p>
                    </div>
                  )}
               </div>
            </div>

            {/* Chat Window */}
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col overflow-hidden">
               {selectedUserChat ? (
                  <>
                     <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-blue-600 text-white">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black">
                              {selectedUserChat.charAt(0).toUpperCase()}
                           </div>
                           <div>
                              <p className="font-black tracking-tight">{selectedUserChat}</p>
                              <p className="text-[9px] font-black uppercase opacity-60">Sedang Chatting</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => handleDeleteChat(selectedUserChat)} 
                             className="p-2 bg-white/10 rounded-xl hover:bg-red-500 transition-colors"
                             title="Hapus Semua Pesan"
                           >
                              <Trash2 className="w-5 h-5" />
                           </button>
                           <button onClick={() => setSelectedUserChat(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20">
                              <X className="w-5 h-5" />
                           </button>
                        </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                        {adminMessages
                          .filter(m => (m.sender === selectedUserChat || m.recipient === selectedUserChat) && m.recipient !== 'community')
                          .sort((a, b) => {
                            const timeA = safeParseDate(a.timestamp).getTime();
                            const timeB = safeParseDate(b.timestamp).getTime();
                            return timeA - timeB;
                          })
                          .map(m => (
                            <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                               <div className={`max-w-[70%] p-4 rounded-xl shadow-sm relative group ${
                                  m.sender === 'admin' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                               }`}>
                                  <button 
                                    onClick={() => handleDeleteSingleMessage(m.id!)}
                                    className={`absolute -top-1 ${m.sender === 'admin' ? '-left-1' : '-right-1'} w-6 h-6 bg-white border border-gray-100 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-all shadow-sm z-10`}
                                    title="Hapus untuk Semua"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  {m.imageUrl && (
                                    <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                                      <img 
                                        src={m.imageUrl} 
                                        alt="Sent content" 
                                        className="max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(m.imageUrl, '_blank')}
                                      />
                                    </div>
                                  )}
                                  {m.content && <p className="text-sm font-medium">{m.content}</p>}
                                  <p className={`text-[8px] mt-2 opacity-50 font-black flex items-center gap-1 ${m.sender === 'admin' ? 'justify-end' : ''}`}>
                                     <Clock className="w-2 h-2" /> {(() => {
                                        const date = safeParseDate(m.timestamp);
                                        return isNaN(date.getTime()) || date.getTime() === 0 
                                          ? m.timestamp 
                                          : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                     })()}
                                  </p>
                               </div>
                            </div>
                          ))}
                        <div ref={adminChatEndRef} />
                     </div>

                     <form onSubmit={handleSendAdminReply} className="p-4 border-t border-gray-50 bg-white">
                        <div className="flex items-center gap-2">
                           <div className="relative flex-1">
                              <input 
                                type="text"
                                value={newAdminMessage}
                                onChange={(e) => setNewAdminMessage(e.target.value)}
                                placeholder={`Balas ${selectedUserChat}...`}
                                className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-6 pr-14 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-gray-900"
                              />
                              <button 
                                type="submit"
                                disabled={!newAdminMessage.trim() && !isUploadingChat}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                              >
                                 <ArrowUpRight className="w-5 h-5" />
                              </button>
                           </div>
                           
                           <input 
                             type="file" 
                             ref={adminChatFileInputRef}
                             onChange={handleAdminChatImageUpload}
                             accept="image/*"
                             className="hidden"
                           />
                           
                           <button 
                             type="button"
                             onClick={() => adminChatFileInputRef.current?.click()}
                             disabled={isUploadingChat}
                             className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-indigo-600 border-2 border-transparent hover:border-indigo-100 transition-all disabled:opacity-50"
                           >
                              {isUploadingChat ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> : <ImageIcon className="w-6 h-6" />}
                           </button>
                        </div>
                     </form>
                  </>
               ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-20 grayscale">
                     <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center text-gray-200 mb-6">
                        <MessageCircle className="w-12 h-12" />
                     </div>
                     <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-2">Pilih Chat</h3>
                     <p className="text-gray-400 font-medium max-w-xs uppercase text-[10px] tracking-widest leading-loose mb-6">Pilih salah satu pelanggan di samping untuk memulai percakapan atau membalas pesan.</p>
                     
                     {adminMessages.filter(m => m.sender !== 'admin' && !m.read).length > 0 && (
                        <button 
                          onClick={handleMarkAllMessagesRead}
                          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                        >
                           <CheckCircle className="w-5 h-5" />
                           Tandai Semua Sebagai Dibaca
                        </button>
                     )}
                  </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center mb-10">
               <h2 className="text-3xl font-black text-gray-900 flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-100">
                     <LayoutGrid className="w-7 h-7" />
                  </div>
                  Kelola Semua Pesanan
               </h2>
               <div className="flex items-center gap-3">
                  <button 
                    onClick={handleDeleteAllOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-all border border-red-100"
                  >
                    <Trash2 className="w-4 h-4" /> Hapus Semua
                  </button>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pesanan:</span>
                     <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-black text-gray-600">{orders.length}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
              {orders.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[3rem]">
                   <p className="text-gray-400 font-bold">Belum ada pesanan masuk.</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight bg-blue-50 px-2 py-1 rounded">#{order.id}</span>
                        <span className="text-xs font-bold text-gray-400">{order.date}</span>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
                          <User className="w-3 h-3" /> {order.username}
                        </span>
                      </div>
                      <h4 className="font-black text-gray-900 border-l-4 border-blue-500 pl-3 py-1">
                        {order.items.map(i => i.name).join(', ')}
                      </h4>
                      <div className="mt-3 flex items-center gap-2">
                         <span className="text-lg font-black text-blue-600">{formatIDR(order.totalAmount)}</span>
                         <span className="text-[9px] font-black px-2 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-tighter">{order.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(['Pending', 'Proses', 'Selesai', 'Gagal'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => onUpdateOrder?.(order.id, status)}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                            order.status === status
                            ? status === 'Selesai' ? 'bg-green-600 text-white shadow-lg shadow-green-100' :
                              status === 'Proses' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' :
                              status === 'Gagal' ? 'bg-red-600 text-white shadow-lg shadow-red-100' :
                              'bg-orange-600 text-white shadow-lg shadow-orange-100'
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
               <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  Grafik Penjualan Mingguan
               </h3>
               <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topUsersChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          padding: '12px'
                        }}
                      />
                      <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                        {topUsersChartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

             <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                         <ShoppingBasket className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Produk</p>
                      <p className="text-3xl font-black text-gray-900">{products.length}</p>
                   </div>
                   <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                         <Users className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pelanggan</p>
                      <p className="text-3xl font-black text-gray-900">{users.length}</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-20">
             {isLoadingPayment ? (
               <div className="bg-white p-20 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                  <p className="text-gray-500 font-bold">Memuat konfigurasi pembayaran...</p>
               </div>
             ) : paymentError ? (
                <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                   <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-6">
                      <ShieldCheck className="w-10 h-10" />
                   </div>
                   <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Akses Ditolak / Masalah Koneksi</h3>
                   <p className="text-gray-500 font-medium max-w-md mb-8">{paymentError}</p>
                   
                    <div className="flex flex-col sm:flex-row gap-4">
                       <button 
                         onClick={() => window.location.reload()}
                         className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                       >
                          Muat Ulang Halaman
                       </button>
                    </div>
                </div>
             ) : paymentSettings ? (
               <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-10">
                     <h3 className="text-2xl font-black text-gray-900 flex items-center gap-4 uppercase tracking-tighter">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                           <ShieldCheck className="w-6 h-6" />
                        </div>
                        Integrasi Payment Gateway
                     </h3>
                     <button 
                       onClick={handleSavePaymentSettings}
                       disabled={isSavingPayment}
                       className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                     >
                       {isSavingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                       Simpan Perubahan
                     </button>
                  </div>

                <div className="grid grid-cols-1 gap-12">
                   {paymentSettings.gateways.filter(g => g.provider === 'Pak Kasir').map((gateway) => (
                      <div key={gateway.provider} className="bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100 space-y-6 relative overflow-hidden">
                         <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-indigo-600 border border-gray-100">
                                  {gateway.provider.charAt(0)}
                               </div>
                               <div>
                                  <h4 className="text-lg font-black text-gray-900 tracking-tight">{gateway.provider} Automated</h4>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Konfigurasi API & Webhook</p>
                               </div>
                            </div>
                            <button 
                              onClick={() => updateGatewayConfig(gateway.provider, { isActive: !gateway.isActive })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${gateway.isActive ? 'bg-green-500 shadow-lg shadow-green-100' : 'bg-gray-200'}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gateway.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">URL Slug / ID Toko Pak Kasir</label>
                               <input 
                                 type="text"
                                 value={gateway.slug || ''}
                                 onChange={(e) => updateGatewayConfig(gateway.provider, { slug: e.target.value })}
                                 placeholder="Contoh: toko-saya"
                                 className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3.5 px-6 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none font-bold text-gray-900 transition-all shadow-sm"
                               />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">API Key</label>
                               <input 
                                 type="password"
                                 value={gateway.apiKey}
                                 onChange={(e) => updateGatewayConfig(gateway.provider, { apiKey: e.target.value })}
                                 placeholder="API_KEY_HERE"
                                 className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3.5 px-6 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none font-mono text-xs transition-all shadow-sm"
                               />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                               <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Webhook URL (Salin ke Dashboard Pak Kasir)</label>
                               <input 
                                 readOnly
                                 value={`${window.location.origin}/api/webhook/pakkasir`}
                                 className="w-full bg-blue-50 border-2 border-blue-100 rounded-2xl py-3.5 px-6 font-mono text-[10px] text-blue-600 outline-none shadow-sm cursor-copy"
                                 onClick={(e) => {
                                   const el = e.currentTarget;
                                   el.select();
                                   navigator.clipboard.writeText(el.value);
                                   alert("Webhook URL disalin!");
                                 }}
                               />
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
                
                <div className="mt-12 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100">
                   <div className="flex gap-4">
                      <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600 h-fit">
                         <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                         <h5 className="font-black text-blue-900 uppercase tracking-tight mb-1">Informasi Integrasi</h5>
                         <p className="text-xs font-bold text-blue-700 leading-relaxed max-w-2xl">
                            API Key dikirim terenkripsi untuk keamanan data Anda. 
                            Silakan masukkan Slug dan API Key yang didapat dari Dashboard Pak Kasir Anda.
                         </p>
                      </div>
                   </div>
                </div>
             </div>
           ) : null}
        </div>
      )}

        {activeTab === 'system' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-500">
             <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                <h3 className="text-2xl font-black text-gray-900 mb-10 flex items-center gap-4 uppercase tracking-tighter">
                   <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                      <Settings className="w-6 h-6" />
                   </div>
                   Kontrol Panel Sistem
                </h3>
                
                <div className="space-y-6">
                   <div className="flex justify-between items-center p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 transition-all hover:bg-white hover:shadow-md group">
                      <div>
                         <p className="text-sm font-black text-gray-900 mb-1 uppercase tracking-widest">Mode Maintenance</p>
                         <p className="text-xs font-bold text-gray-400">Matikan akses publik ke aplikasi untuk perbaikan.</p>
                      </div>
                      <button 
                        onClick={toggleMaintenance}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all focus:outline-none ${isMaintenance ? 'bg-red-500 shadow-lg shadow-red-100' : 'bg-gray-200'}`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isMaintenance ? 'translate-x-7' : 'translate-x-1'}`}
                        />
                      </button>
                   </div>

                   <div className="flex justify-between items-center p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100">
                      <div>
                         <p className="text-sm font-black text-gray-900 mb-1 uppercase tracking-widest">Versi Aplikasi</p>
                         <p className="text-xs font-bold text-gray-400">Versi build saat ini di produksi.</p>
                      </div>
                      <span className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black border border-indigo-100">
                        v3.5.2-stable
                      </span>
                   </div>

                   <div className="flex justify-between items-center p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100">
                      <div>
                         <p className="text-sm font-black text-gray-900 mb-1 uppercase tracking-widest">Status Engine</p>
                         <p className="text-xs font-bold text-gray-400">Kesehatan server dan database.</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className={`w-3 h-3 ${isMaintenance ? 'bg-orange-500' : 'bg-green-500'} rounded-full animate-pulse shadow-sm`}></div>
                         <span className={`text-xs font-black ${isMaintenance ? 'text-orange-600' : 'text-green-600'} tracking-widest uppercase`}>
                           {isMaintenance ? 'Maintenance View' : 'All-Systems Operational'}
                         </span>
                      </div>
                   </div>
                </div>
             </div>
             
             <div className="p-10 bg-indigo-900 rounded-[3rem] text-white overflow-hidden relative">
                <div className="relative z-10">
                   <h4 className="text-xl font-black mb-2 uppercase tracking-tighter">MWSTORE Cloud Console</h4>
                   <p className="text-indigo-200 text-sm font-bold mb-6">Database terenkripsi dengan standar industri.</p>
                   <div className="flex items-center gap-4">
                      <div className="px-4 py-2 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
                         <ShieldCheck className="w-3 h-3 text-green-400" /> Secure SSL
                      </div>
                      <div className="px-4 py-2 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
                         <AlertCircle className="w-3 h-3 text-orange-400" /> Backup Daily
                      </div>
                   </div>
                </div>
                <div className="absolute -right-20 -bottom-20 opacity-10">
                   <Settings className="w-64 h-64 rotate-12" />
                </div>
             </div>
          </div>
        )}

        {activeTab === 'topups' && (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in slide-in-from-bottom-5 duration-500">
             <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-gray-900 flex items-center gap-4">
                   <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-xl shadow-orange-100">
                      <Coins className="w-7 h-7" />
                   </div>
                   Konfirmasi Top Up Manual
                </h2>
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={handleDeleteAllTopUps}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-all border border-red-100"
                    >
                      <Trash2 className="w-4 h-4" /> Hapus Semua
                    </button>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending:</span>
                       <span className="px-3 py-1 bg-orange-100 rounded-lg text-xs font-black text-orange-600">
                         {userTopUps.filter(t => t.status === 'Pending').length}
                       </span>
                    </div>
                 </div>
             </div>

             <div className="space-y-4">
                {userTopUps.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[3rem]">
                     <p className="text-gray-400 font-bold">Belum ada riwayat top up.</p>
                  </div>
                ) : (
                  [...userTopUps].sort((a, b) => a.status === 'Pending' ? -1 : 1).map((topup) => (
                    <div key={topup.id} className={`p-6 rounded-[2.5rem] border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all ${topup.status === 'Pending' ? 'bg-orange-50/30 border-orange-100 shadow-sm' : 'bg-white border-gray-50 opacity-70'}`}>
                       <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight bg-gray-100 px-2 py-1 rounded">#{topup.id}</span>
                             <span className="text-xs font-bold text-gray-400">{topup.date}</span>
                             <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border flex items-center gap-1 ${topup.status === 'Pending' ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-green-100 text-green-600 border-green-200'}`}>
                                {topup.status === 'Pending' ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                {topup.status}
                             </span>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                                {topup.username.charAt(0).toUpperCase()}
                             </div>
                             <div>
                                <p className="font-black text-gray-900">{topup.username}</p>
                                <p className="text-xl font-black text-indigo-600">{formatIDR(topup.amount)}</p>
                             </div>
                          </div>
                       </div>

                       <div className="flex items-center gap-3">
                          {topup.status === 'Pending' && (
                             <>
                                <button 
                                   onClick={() => handleDeleteTopUp(topup.id!)}
                                   className="p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                   title="Tolak"
                                >
                                   <X className="w-6 h-6" />
                                </button>
                                <button 
                                   onClick={() => handleApproveTopUp(topup)}
                                   className="px-8 py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-2"
                                >
                                   <Check className="w-4 h-4" />
                                   Konfirmasi Lunas
                                </button>
                             </>
                          )}
                          {topup.status === 'Selesai' && (
                             <button 
                                onClick={() => handleRejectTopUp(topup.id)}
                                className="p-3 text-gray-300 hover:text-red-500 transition-all"
                                title="Hapus Riwayat"
                             >
                                <Trash2 className="w-5 h-5" />
                             </button>
                          )}
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
               <h2 className="text-3xl font-black flex items-center gap-4 text-gray-900">
                 <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100">
                    <Wallet className="w-7 h-7" />
                 </div>
                 Pusat Saldo Pelanggan
               </h2>
               <div className="bg-green-50 px-6 py-3 rounded-2xl border border-green-100">
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none mb-1">Total Dana Mengendap</p>
                  <p className="text-2xl font-black text-green-700">{formatIDR(users.reduce((acc, u) => acc + (u.balance || 0), 0))}</p>
               </div>
            </div>

            <div className="relative mb-8">
              <div className="relative group/search">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within/search:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Cari User, No WA, atau Email..."
                  className="w-full bg-gray-50 border-2 border-transparent rounded-[2rem] py-5 pl-14 pr-6 focus:border-indigo-500/20 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none font-bold text-gray-900 shadow-sm"
                />
                {userSearchQuery && (
                  <button 
                    onClick={() => setUserSearchQuery('')}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">
                    <th className="pb-4 pl-2">Informasi Akun</th>
                    <th className="pb-4">Saldo</th>
                    <th className="pb-4 text-right pr-2">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((user, idx) => (
                    <tr key={idx} className="group hover:bg-gray-50/50 transition-all">
                      <td className="py-6 pl-2">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
                               {user.username.charAt(0).toUpperCase()}
                            </div>
                             <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-gray-900">{user.username}</p>
                                  <button onClick={() => handleCopy(user.username, `uname-${idx}`)} className="text-gray-300 hover:text-blue-500 transition-colors">
                                    {copiedId === `uname-${idx}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{user.role}</p>
                                  {user.phone && (
                                    <div className="flex items-center gap-1.5 group/phone">
                                      <p className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                                        <Smartphone className="w-3 h-3" /> {user.phone}
                                      </p>
                                      <button onClick={() => handleCopy(user.phone || '', `phone-${idx}`)} className="opacity-0 group-hover/phone:opacity-100 transition-opacity">
                                        {copiedId === `phone-${idx}` ? <Check className="w-4 h-4 p-0.5 text-green-500" /> : <Copy className="w-4 h-4 p-0.5 text-gray-300" />}
                                      </button>
                                    </div>
                                  )}
                                  {user.email && (
                                    <div className="flex items-center gap-1.5 group/email">
                                      <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-indigo-400" /> {user.email}
                                      </p>
                                      <button onClick={() => handleCopy(user.email || '', `email-${idx}`)} className="opacity-0 group-hover/email:opacity-100 transition-opacity">
                                        {copiedId === `email-${idx}` ? <Check className="w-4 h-4 p-0.5 text-green-500" /> : <Copy className="w-4 h-4 p-0.5 text-gray-300" />}
                                      </button>
                                    </div>
                                  )}
                                </div>
                                 {user.password && (
                                  <div className="flex items-center gap-2 mt-1 group/pass">
                                    <p className="text-[9px] font-mono text-gray-400">
                                      {showPasswords[user.username] ? user.password : '••••••••'}
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={() => setShowPasswords(prev => ({ ...prev, [user.username]: !prev[user.username] }))}
                                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                                      >
                                        {showPasswords[user.username] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                      </button>
                                      <button onClick={() => handleCopy(user.password || '', `pass-${idx}`)} className="opacity-0 group-hover/pass:opacity-100 transition-opacity">
                                        {copiedId === `pass-${idx}` ? <Check className="w-4 h-4 p-0.5 text-green-500" /> : <Copy className="w-4 h-4 p-0.5 text-gray-300" />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {user.currentOtp && (
                                  <div className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded-xl flex flex-col gap-1 items-start">
                                    <div className="flex justify-between items-center w-full">
                                      <span className="text-[8px] font-black text-orange-600 uppercase tracking-tighter">OTP Reset Password:</span>
                                      <span className={`text-[8px] font-black px-1 rounded ${new Date(user.otpExpiry || 0) > new Date() ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {new Date(user.otpExpiry || 0) > new Date() ? 'AKTIF' : 'EXPIRED'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-gray-900 tracking-[0.2em]">{user.currentOtp}</span>
                                      <button onClick={() => handleCopy(user.currentOtp || '', `otp-${idx}`)} className="text-gray-400 hover:text-orange-600 transition-colors">
                                        {copiedId === `otp-${idx}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                             </div>
                          </div>
                      </td>
                      <td className="py-6">
                        <div className="flex items-center gap-2">
                           <Coins className="w-4 h-4 text-orange-500" />
                           <span className="font-black text-lg text-indigo-700">{formatIDR(user.balance || 0)}</span>
                        </div>
                      </td>
                      <td className="py-6 text-right pr-2">
                        <div className="flex justify-end gap-3 items-center">
                           <button 
                            onClick={() => setSelectedUserHistory(user.username)}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition-all border border-gray-200 shadow-sm"
                           >
                             <Clock className="w-3.5 h-3.5" /> Riwayat
                           </button>

                           <div className="flex justify-end items-center gap-2">
                             <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                <span className="text-[10px] font-black text-gray-400 mr-1">Rp</span>
                                <input 
                                  type="number" 
                                  placeholder="0" 
                                  value={balanceAdjustments[user.username] || ''} 
                                  onChange={(e) => setBalanceAdjustments(prev => ({ ...prev, [user.username]: e.target.value }))}
                                  className="w-20 bg-transparent border-none outline-none text-xs font-black text-gray-900 p-1"
                                />
                             </div>
                             <div className="flex gap-1">
                                <button 
                                  onClick={() => handleAdjustBalance(user.username, false)} 
                                  className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors shadow-sm"
                                  title="Kurangi Saldo"
                                >
                                  <ArrowDownLeft className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleAdjustBalance(user.username, true)} 
                                  className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-md"
                                  title="Tambah Saldo"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleQuickGiftVoucher(user.username, 5000)}
                                  className="p-2 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-colors shadow-sm"
                                  title="Hadiah Voucher 5rb (Otomatis)"
                                >
                                  <Tag className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteUserHistory(user.username)}
                                  className="p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors shadow-sm"
                                  title="Hapus Riwayat Transaksi"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(user.username)}
                                  className="p-2 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors shadow-md"
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                           </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Tab produk dan statistik tetap sama dengan sebelumnya */}
        {activeTab === 'products' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
               <h2 className="text-3xl font-black text-gray-900 flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-100">
                     <ShoppingBasket className="w-7 h-7" />
                  </div>
                  Kelola Katalog Produk
               </h2>
               <div className="flex items-center gap-3 w-full md:w-auto">
                 <button 
                   onClick={handleClearAllProducts}
                   className="flex-1 md:flex-none p-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                 >
                   <Trash2 className="w-4 h-4" /> Kosongkan
                 </button>
                 <button 
                   onClick={() => {
                     setEditingProduct(null);
                     setNewProduct({ 
                       name: '', 
                       description: '', 
                       price: '', 
                       category: 'Top Up Game', 
                       image: '', 
                       stock: '',
                       discount: '0',
                       productType: 'Duplikat',
                       inventory: ['']
                     });
                     setShowAddModal(true);
                   }}
                   className="flex-1 md:flex-none p-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                 >
                   <Plus className="w-4 h-4" /> Tambah Produk
                 </button>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-3 group hover:border-blue-200 transition-all hover:shadow-xl">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                       <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <h4 className="font-black truncate pr-4 text-gray-900 leading-tight">{p.name}</h4>
                        <div className="flex gap-1">
                          <button onClick={() => handleEditProduct(p)} className="text-gray-300 hover:text-blue-500 transition-colors p-1"><Settings className="w-5 h-5" /></button>
                          <button 
                            onClick={() => {
                              if (confirm(`Hapus produk ${p.name}?`)) {
                                onDeleteProduct(p.id);
                              }
                            }} 
                            className="text-red-300 hover:text-red-600 transition-colors p-1"
                            title="Hapus Produk"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <p className="text-blue-600 font-black text-lg">{formatIDR(p.price)}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Stok: {p.stock}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'vouchers' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500">
               <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-4">
                     <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                        <Tag className="w-6 h-6" />
                     </div>
                     Buat Voucher Baru
                  </h3>
                  
                  <form onSubmit={handleCreateVoucher} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kode Voucher</label>
                        <div className="flex gap-2">
                           <input 
                              type="text"
                              placeholder="KOSONGKAN UNTUK OTOMATIS"
                              value={newVoucher.code}
                              onChange={e => setNewVoucher({...newVoucher, code: e.target.value})}
                              className="flex-1 bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-black uppercase text-sm"
                           />
                           <button 
                              type="button"
                              onClick={() => setNewVoucher({...newVoucher, code: generateRandomCode()})}
                              className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200"
                              title="Generate Random Code"
                           >
                              <RefreshCw className="w-4 h-4" />
                           </button>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nominal Potongan</label>
                        <input 
                           type="number"
                           placeholder="500, 1000, dst"
                           value={newVoucher.amount}
                           onChange={e => setNewVoucher({...newVoucher, amount: e.target.value})}
                           className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-black text-sm"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Minimal Belanja</label>
                        <input 
                           type="number"
                           placeholder="0 jika tidak ada"
                           value={newVoucher.minPurchase}
                           onChange={e => setNewVoucher({...newVoucher, minPurchase: e.target.value})}
                           className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-black text-sm"
                        />
                     </div>
                     <div className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Username Penerima (Opsional)</label>
                         <input 
                            type="text"
                            placeholder="Username atau Kosongkan"
                            value={newVoucher.recipient}
                            onChange={e => setNewVoucher({...newVoucher, recipient: e.target.value})}
                            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-black text-sm"
                         />
                         <p className="text-[8px] text-gray-400 font-bold uppercase">Jika kosong, semua orang bisa pakai</p>
                      </div>
                     <div className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tenggang Waktu (Opsional)</label>
                         <input 
                            type="datetime-local"
                            value={newVoucher.expiryDate}
                            onChange={e => setNewVoucher({...newVoucher, expiryDate: e.target.value})}
                            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-black text-sm"
                         />
                         <p className="text-[8px] text-gray-400 font-bold uppercase">Default: 2 Hari dari sekarang jika kosong</p>
                      </div>
                      <div className="md:col-span-3">
                        <button 
                           type="submit"
                           className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                           <Plus className="w-4 h-4" /> Simpan Voucher
                        </button>
                     </div>
                  </form>
               </div>

               <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs mb-6">Daftar Voucher Aktif</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {vouchers.length === 0 ? (
                        <div className="md:col-span-3 text-center py-10 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Belum ada voucher</div>
                     ) : (
                        vouchers.map(v => (
                           <div key={v.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 relative group overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-600/5 -mr-8 -mt-8 rounded-full"></div>
                              <div className="flex justify-between items-start mb-2 relative z-10">
                                 <div>
                                    <h4 className={`text-lg font-black tracking-tighter ${v.isUsed || !v.isActive ? 'text-gray-400 line-through' : 'text-indigo-600'}`}>{v.code}</h4>
                                    <p className="text-[9px] font-black text-gray-400 uppercase">Potongan: {formatIDR(v.amount)}</p>
                                 </div>
                                 <button 
                                    onClick={() => handleDeleteVoucher(v.id || v.code)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors bg-white rounded-xl shadow-sm"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                              <div className="space-y-1 relative z-10">
                                 <div className="flex items-center gap-2">
                                    {v.isUsed ? (
                                       <span className="text-[8px] font-black px-2 py-0.5 bg-red-100 text-red-600 rounded uppercase">Sudah Digunakan</span>
                                    ) : v.isActive ? (
                                       <span className="text-[8px] font-black px-2 py-0.5 bg-green-100 text-green-600 rounded uppercase">Aktif</span>
                                    ) : (
                                       <span className="text-[8px] font-black px-2 py-0.5 bg-gray-200 text-gray-500 rounded uppercase">Non-aktif</span>
                                    )}
                                    {v.minPurchase && v.minPurchase > 0 && (
                                       <span className="text-[8px] font-black px-2 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Min: {formatIDR(v.minPurchase)}</span>
                                    )}
                                 </div>
                                 {v.expiryDate && (
                                    <p className="text-[8px] font-bold text-red-400 uppercase flex items-center gap-1">
                                       <Clock className="w-2 h-2" />
                                       Exp: {new Date(v.expiryDate).toLocaleString('id-ID')}
                                    </p>
                                 )}
                                 {v.recipient && (
                                    <p className="text-[8px] font-bold text-indigo-400 uppercase flex items-center gap-1">
                                       <User className="w-2 h-2" />
                                       Untuk: {v.recipient}
                                    </p>
                                 )}
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>
          )}
        </main>

      {/* MODAL BUAT PRODUK (MATCHING SCREENSHOT) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelEdit}></div>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative flex flex-col h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center shrink-0">
               <h3 className="text-xl font-bold text-gray-800 tracking-tight">
                 {editingProduct ? 'Ubah Produk' : 'Buat Produk'}
               </h3>
               <button onClick={cancelEdit} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                  <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
               <form onSubmit={handleAddProduct} className="space-y-6 pb-20">
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-gray-500">Nama</label>
                     <input 
                       required
                       value={newProduct.name}
                       onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                       className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 transition-all font-medium" 
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-sm font-medium text-gray-500">Kategori</label>
                     <input 
                       required
                       value={newProduct.category}
                       onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                       className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 transition-all font-medium" 
                     />
                  </div>

                  <div className="space-y-3">
                     <label className="text-sm font-medium text-gray-500 block">Foto</label>
                     <div className="flex gap-4 items-start">
                        <div className="w-28 h-28 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                           {newProduct.image ? (
                             <img src={newProduct.image} className="w-full h-full object-cover" alt="Preview" />
                           ) : (
                             <ImageIcon className="w-12 h-12 text-gray-300" />
                           )}
                        </div>
                        <div className="flex-1 space-y-3">
                           <input 
                             type="file" 
                             id="imageUpload" 
                             className="hidden" 
                             accept="image/*"
                             onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) {
                                 const reader = new FileReader();
                                 reader.onloadend = () => {
                                   setNewProduct({...newProduct, image: reader.result as string});
                                 };
                                 reader.readAsDataURL(file);
                               }
                             }}
                           />
                           <button 
                             type="button" 
                             onClick={() => document.getElementById('imageUpload')?.click()}
                             className="w-full bg-[#64748b] text-white py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-[#475569] transition-all"
                           >
                              Buka Galeri
                           </button>
                           <div className="grid grid-cols-2 gap-3">
                              <button type="button" className="bg-white border border-gray-200 text-gray-700 py-2.5 rounded-lg text-xs font-bold hover:bg-gray-50 transition-all">
                                 Lihat
                              </button>
                              <button type="button" onClick={() => setNewProduct({...newProduct, image: ''})} className="bg-white border border-gray-200 text-red-500 py-2.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-all">
                                 Mengatur ulang
                              </button>
                           </div>
                        </div>
                     </div>
                     <input 
                        placeholder="Tempel URL gambar di sini..."
                        value={newProduct.image}
                        onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                        className="w-full bg-white border border-gray-100 rounded-lg py-2 px-4 text-xs italic text-gray-500 outline-none focus:border-blue-300"
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-sm font-medium text-gray-500">Harga</label>
                     <input 
                       required
                       type="number"
                       value={newProduct.price}
                       onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                       className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 transition-all font-medium" 
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-sm font-medium text-gray-500">Diskon</label>
                     <input 
                       type="number"
                       value={newProduct.discount}
                       onChange={e => setNewProduct({...newProduct, discount: e.target.value})}
                       className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 transition-all font-medium" 
                     />
                  </div>

                  <div className="space-y-4">
                     <label className="text-sm font-medium text-gray-500">Jenis Produk</label>
                     <div className="grid grid-cols-2 gap-3">
                        {['Duplikat', 'Unik'].map((type) => (
                           <button
                              key={type}
                              type="button"
                              onClick={() => setNewProduct({
                                 ...newProduct, 
                                 productType: type as 'Duplikat' | 'Unik'
                              })}
                              className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                                 newProduct.productType === type 
                                 ? 'bg-blue-50 border-blue-500 text-blue-600' 
                                 : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                              }`}
                           >
                              {type === 'Duplikat' ? 'Duplikat (Stok Manual)' : 'Unik (Per Item)'}
                           </button>
                        ))}
                     </div>
                  </div>

                  {newProduct.productType === 'Duplikat' ? (
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-500">Jawaban Produk (Data yang dikirim ke pembeli)</label>
                        <input 
                          placeholder="Contoh: Kode Voucher atau Akun Login"
                          value={newProduct.inventory[0] || ''}
                          onChange={e => {
                            const newInv = [...newProduct.inventory];
                            newInv[0] = e.target.value;
                            setNewProduct({...newProduct, inventory: newInv});
                          }}
                          className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 font-medium" 
                        />
                        <div className="mt-4 space-y-2">
                           <label className="text-sm font-medium text-gray-500">Stok (Manual)</label>
                           <input 
                             required
                             type="number"
                             value={newProduct.stock}
                             onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                             className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 transition-all font-medium" 
                           />
                        </div>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        <div className="flex justify-between items-center">
                           <label className="text-sm font-medium text-gray-500">Data Barang (Satu baris per stok)</label>
                           <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">TOTAL STOK: {newProduct.inventory.length}</span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                           {newProduct.inventory.map((item, idx) => (
                              <div key={idx} className="flex gap-2 animate-in slide-in-from-right-2 duration-200">
                                 <input 
                                   placeholder={`Data Barang #${idx + 1}`}
                                   value={item}
                                   onChange={e => {
                                     const newInv = [...newProduct.inventory];
                                     newInv[idx] = e.target.value;
                                     setNewProduct({...newProduct, inventory: newInv});
                                   }}
                                   className="flex-1 bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 font-medium" 
                                 />
                                 <button 
                                    type="button"
                                    onClick={() => {
                                       const newInv = newProduct.inventory.length > 1 
                                          ? newProduct.inventory.filter((_, i) => i !== idx)
                                          : [''];
                                       setNewProduct({...newProduct, inventory: newInv});
                                    }}
                                    className="p-3 text-red-100 bg-red-500 hover:bg-red-600 rounded-lg transition-all"
                                 >
                                    <Trash2 className="w-5 h-5" />
                                 </button>
                              </div>
                           ))}
                        </div>
                        <button 
                           type="button"
                           onClick={() => setNewProduct({...newProduct, inventory: [...newProduct.inventory, '']})}
                           className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-black text-gray-400 hover:border-blue-200 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                        >
                           <Plus className="w-4 h-4" /> Tambah Kolom Barang
                        </button>
                     </div>
                  )}

                  <div className="space-y-2">
                     <label className="text-sm font-medium text-gray-500">Deskripsi</label>
                     <textarea 
                       rows={4}
                       value={newProduct.description}
                       onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                       className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 transition-all font-medium resize-none" 
                     />
                  </div>

                  <button type="button" className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-all pt-2">
                     <Plus className="w-4 h-4 text-gray-400" /> Foto tambahan
                  </button>
               </form>
            </div>
            
            <div className="p-6 border-t bg-white shrink-0">
               <button 
                 onClick={handleAddProduct}
                 className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98]"
               >
                 {editingProduct ? 'Simpan Perubahan' : 'Buat Produk'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RIWAYAT TRANSAKSI */}
      {selectedUserHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b flex justify-between items-center bg-indigo-600 text-white">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                       <Clock className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black uppercase tracking-widest">Riwayat Transaksi</h3>
                       <p className="text-indigo-100 font-bold opacity-80">Pelanggan: <span className="text-white underline">{selectedUserHistory}</span></p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedUserHistory(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-[#fdfdfd]">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* RIWAYAT PESANAN */}
                    <div>
                       <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                          <ShoppingBasket className="w-4 h-4" /> Daftar Pembelian
                       </h4>
                       <div className="space-y-4">
                          {orders.filter(o => o.username === selectedUserHistory).length > 0 ? (
                             orders.filter(o => o.username === selectedUserHistory).map((order) => (
                                <div key={order.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                                   <div className="flex justify-between items-start mb-3">
                                      <div>
                                         <p className="text-[10px] font-black text-blue-600 uppercase">#{order.id}</p>
                                         <p className="text-xs font-bold text-gray-400">{order.date}</p>
                                      </div>
                                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                                         order.status === 'Selesai' ? 'bg-green-100 text-green-600' : 
                                         order.status === 'Proses' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                      }`}>
                                         {order.status}
                                      </span>
                                   </div>
                                   <div className="space-y-2 mb-4">
                                      {order.items.map((item, idx) => (
                                         <div key={idx} className="flex justify-between text-xs font-bold">
                                            <span className="text-gray-700 truncate max-w-[40px]">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                                            <span className="text-gray-900">{formatIDR(item.price * item.quantity)}</span>
                                         </div>
                                      ))}
                                   </div>
                                   <div className="pt-3 border-t flex justify-between items-center">
                                      <p className="text-[10px] font-black text-gray-400 uppercase">Total</p>
                                      <p className="font-black text-gray-900">{formatIDR(order.totalAmount)}</p>
                                   </div>
                                </div>
                             ))
                          ) : (
                             <div className="py-12 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold text-sm">Belum ada pembelian</p>
                             </div>
                          )}
                       </div>
                    </div>

                    {/* RIWAYAT TOP UP */}
                    <div>
                       <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                          <Wallet className="w-4 h-4" /> Riwayat Isi Saldo
                       </h4>
                       <div className="space-y-4">
                          {userTopUps.filter(t => t.username === selectedUserHistory).length > 0 ? (
                             userTopUps.filter(t => t.username === selectedUserHistory).map((topup) => (
                                <div key={topup.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-xl ${topup.amount >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                         {topup.amount >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                      </div>
                                      <div>
                                         <p className="font-black text-gray-900 tracking-tight">
                                            {topup.amount >= 0 ? 'Penambahan Saldo' : 'Pengurangan Saldo'}
                                         </p>
                                         <p className="text-xs font-bold text-gray-400">{topup.date}</p>
                                      </div>
                                   </div>
                                   <div className="text-right">
                                      <p className={`font-black text-lg ${topup.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                         {topup.amount >= 0 ? '+' : ''}{formatIDR(topup.amount)}
                                      </p>
                                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{topup.status}</p>
                                   </div>
                                </div>
                             ))
                          ) : (
                             <div className="py-12 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold text-sm">Belum ada riwayat top up</p>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="p-8 bg-gray-50 border-t flex justify-end">
                 <button onClick={() => setSelectedUserHistory(null)} className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                    Tutup Riwayat
                 </button>
              </div>
           </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminDashboard;
