
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Package, Search, TrendingUp, DollarSign, ArrowLeft, Plus, X, Image as ImageIcon, Tag, Trash2, LayoutDashboard, ShoppingBasket, Wallet, RefreshCw, Smartphone, Users, User, Eye, EyeOff, ShieldCheck, AlertCircle, Settings, Mail, MessageCircle, LayoutGrid, Coins, ArrowUpRight, ArrowDownLeft, Clock, Copy, Check, CheckCircle, Menu } from 'lucide-react';
import { formatIDR } from '@/constants';
import { Order, Product, UserAccount, TopUpTransaction, Message } from '@/types';
import { APP_CONFIG } from '@/config';
import { ApiService } from '@/services/apiService';

const chartData = [
  { name: 'Sen', sales: 4000000 },
  { name: 'Sel', sales: 3000000 },
  { name: 'Rab', sales: 2000000 },
  { name: 'Kam', sales: 2780000 },
  { name: 'Jum', sales: 1890000 },
  { name: 'Sab', sales: 2390000 },
  { name: 'Min', sales: 3490000 },
];

interface AdminDashboardProps {
  orders: Order[];
  onBack: () => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateUsers: (users: UserAccount[]) => void;
  onUpdateOrder?: (orderId: string, status: 'Pending' | 'Proses' | 'Selesai' | 'Gagal') => void;
  onDeleteUser?: (username: string) => void;
  onResetUserHistory?: (username: string) => void;
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
  products, 
  users 
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'products' | 'system' | 'users' | 'orders' | 'messages' | 'topups'>('users');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [selectedUserChat, setSelectedUserChat] = useState<string | null>(null);
  const [adminMessages, setAdminMessages] = useState<Message[]>([]);
  const [newAdminMessage, setNewAdminMessage] = useState('');
  const adminChatEndRef = React.useRef<HTMLDivElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchAdminData = async () => {
      const data = await ApiService.getUsers();
      onUpdateUsers(data);
    };
    fetchAdminData();
  }, [onUpdateUsers]);

  useEffect(() => {
    const unsubMaintenance = ApiService.listenToSettings((settings) => {
      if (settings && settings.maintenanceMode !== undefined) {
        setIsMaintenance(settings.maintenanceMode);
      }
    });

    const unsubMessages = ApiService.listenToMessages('', true, (msgs) => {
       setAdminMessages(msgs);
    });

    return () => {
      unsubMaintenance();
      unsubMessages();
    };
  }, []);

  useEffect(() => {
    adminChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedUserChat, adminMessages]);

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminMessage.trim() || !selectedUserChat) return;

    // We need to find the recipient message to get their senderUid if possible
    // Or just use the username
    const lastUserMsg = adminMessages.find(m => m.sender === selectedUserChat);
    const recipientUid = lastUserMsg?.senderUid || '';

    const newMessage: Message = {
       id: Math.floor(100000 + Math.random() * 900000).toString(),
       sender: 'admin',
       recipient: selectedUserChat,
       content: newAdminMessage,
       timestamp: new Date().toLocaleString('id-ID'),
       read: false
    };

    await ApiService.sendMessage(newMessage, 'admin'); // Admin UID could be 'admin' or something else
    setNewAdminMessage('');
  };

  const getUserLastMessage = (username: string) => {
    const userMsgs = adminMessages.filter(m => m.sender === username || m.recipient === username);
    return userMsgs[0]; // Messages are stored newest first in ApiService.getMessages
  };

  const getUnreadCount = (username: string) => {
    return adminMessages.filter(m => m.sender === username && !m.read).length;
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
  const [userTopUps, setUserTopUps] = useState<TopUpTransaction[]>([]);

  useEffect(() => {
    const fetchTopUps = async () => {
      const data = await ApiService.getTopUps('', true);
      setUserTopUps(data);
    };
    fetchTopUps();
  }, [activeTab, orders]);

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
      }, ''); 
      
      setBalanceAdjustments(prev => ({ ...prev, [username]: '' }));
      
      // Refresh topups
      const data = await ApiService.getTopUps('', true);
      setUserTopUps(data);
    }
  };

  const handleApproveTopUp = async (topup: TopUpTransaction) => {
    if (confirm(`Setujui Top Up sebesar ${formatIDR(topup.amount)} untuk ${topup.username}?`)) {
      const user = users.find(u => u.username === topup.username);
      const currentBalance = user?.balance || 0;
      const success = await ApiService.updateBalanceByUsername(topup.username, currentBalance + topup.amount);
      
      if (success) {
        await ApiService.updateTopUpStatus(topup.id, 'Selesai');
        const updatedTopUps = await ApiService.getTopUps('', true);
        setUserTopUps(updatedTopUps);
        alert('Top Up Berhasil Disetujui!');
      }
    }
  };

  const handleRejectTopUp = async (id: string) => {
    if (confirm('Hapus/Tolak permintaan top up ini?')) {
      // For now I'll just update status to 'Pending' (or maybe add 'Gagal' later)
      // Or if deleting is preferred, we need a delete method.
      // I'll keep it simple for now and just refresh.
      alert('Fitur penghapusan transaksi akan segera hadir.');
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

  const COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'];

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
            onClick={() => { setActiveTab('messages'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'messages' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className="flex items-center gap-4">
               <div className={`p-2 rounded-xl transition-colors ${activeTab === 'messages' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
                  <MessageCircle className="w-4 h-4" />
               </div>
               <span>Pesan Masuk</span>
            </div>
            {adminMessages.filter(m => m.sender !== 'admin' && !m.read).length > 0 && (
              <span className="flex items-center justify-center w-6 h-6 bg-red-500 text-white text-[9px] font-black rounded-xl">
                {adminMessages.filter(m => m.sender !== 'admin' && !m.read).length}
              </span>
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
              <span className="flex items-center justify-center w-6 h-6 bg-orange-500 text-white text-[9px] font-black rounded-xl">
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
            onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all group ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === 'orders' ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-indigo-50'}`}>
               <LayoutGrid className="w-4 h-4" />
            </div>
            <span>Semua Pesanan</span>
          </button>

          <div className="h-4"></div>
          <p className="px-6 text-[8px] font-black text-gray-300 uppercase tracking-[0.2em] mb-2">Konfigurasi</p>
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

        <div className="p-6 border-t border-gray-50">
           <button 
             onClick={onBack}
             className="w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] text-red-500 hover:bg-red-50 transition-all"
           >
             <ArrowLeft className="w-5 h-5" />
             Keluar Panel
           </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 px-6 lg:px-8 h-20 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors text-gray-600"
              >
                 <Menu className="w-6 h-6" />
              </button>
              <div>
                 <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                    {activeTab === 'stats' && 'Statistik & Ringkasan'}
                 {activeTab === 'messages' && 'Layanan Pelanggan (Inbox)'}
                 {activeTab === 'topups' && 'Konfirmasi Pembayaran Saldo'}
                 {activeTab === 'users' && 'Manajemen Saldo & Akun'}
                 {activeTab === 'products' && 'Manajemen Katalog'}
                 {activeTab === 'orders' && 'Riwayat Transaksi Pelanggan'}
                 {activeTab === 'system' && 'Pengaturan Sistem'}
              </h2>
              <p className="text-[10px] font-bold text-gray-400">Selamat datang kembali, Admin MWStore</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                 <div className={`w-2 h-2 rounded-full ${isMaintenance ? 'bg-orange-500' : 'bg-green-500'} animate-pulse`}></div>
                 <span className="text-[9px] font-black uppercase tracking-widest">{isMaintenance ? 'Maintenance' : 'Server Live'}</span>
              </div>
           </div>
        </header>

        <main className="p-8 pb-32 flex-1">
        {activeTab === 'messages' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-5 duration-500 min-h-[600px] h-[calc(100vh-280px)]">
            {/* List Chat */}
            <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden">
               <div className="p-6 border-b border-gray-50">
                  <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Daftar Percakapan</h3>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {users.filter(u => u.username !== 'admin').map(user => {
                     const lastMsg = getUserLastMessage(user.username);
                     const unread = getUnreadCount(user.username);
                     return (
                        <button 
                          key={user.username}
                          onClick={() => {
                            setSelectedUserChat(user.username);
                            const unreadIds = adminMessages
                              .filter(m => m.sender === user.username && !m.read)
                              .map(m => m.id);
                            if (unreadIds.length > 0) ApiService.markAsRead(unreadIds);
                          }}
                          className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border-2 ${
                            selectedUserChat === user.username 
                              ? 'bg-blue-50 border-blue-600 shadow-md' 
                              : 'bg-white border-transparent hover:bg-gray-50'
                          }`}
                        >
                           <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black shrink-0">
                              {user.username.charAt(0).toUpperCase()}
                           </div>
                           <div className="flex-1 text-left min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="font-black text-gray-900 truncate">{user.username}</span>
                                 {unread > 0 && (
                                   <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full leading-none">
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
                        <button onClick={() => setSelectedUserChat(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20">
                           <X className="w-5 h-5" />
                        </button>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                        {adminMessages
                          .filter(m => m.sender === selectedUserChat || m.recipient === selectedUserChat)
                          .reverse()
                          .map(m => (
                            <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                               <div className={`max-w-[70%] p-4 rounded-xl shadow-sm ${
                                  m.sender === 'admin' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                               }`}>
                                  <p className="text-sm font-medium">{m.content}</p>
                                  <p className={`text-[8px] mt-2 opacity-50 font-black flex items-center gap-1 ${m.sender === 'admin' ? 'justify-end' : ''}`}>
                                     <Clock className="w-2 h-2" /> {m.timestamp}
                                  </p>
                               </div>
                            </div>
                          ))}
                        <div ref={adminChatEndRef} />
                     </div>

                     <form onSubmit={handleSendAdminReply} className="p-4 border-t border-gray-50 bg-white">
                        <div className="relative">
                           <input 
                             type="text"
                             value={newAdminMessage}
                             onChange={(e) => setNewAdminMessage(e.target.value)}
                             placeholder={`Balas ${selectedUserChat}...`}
                             className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-6 pr-14 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-gray-900"
                           />
                           <button 
                             type="submit"
                             className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                           >
                              <ArrowUpRight className="w-5 h-5" />
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
                     <p className="text-gray-400 font-medium max-w-xs uppercase text-[10px] tracking-widest leading-loose">Pilih salah satu pelanggan di samping untuk memulai percakapan atau membalas pesan.</p>
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
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pesanan:</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-black text-gray-600">{orders.length}</span>
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
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                        tickFormatter={(value) => `Rp${value/1000000}jt`}
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
                      <Bar dataKey="sales" radius={[10, 10, 0, 0]}>
                        {chartData.map((_entry, index) => (
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
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending:</span>
                   <span className="px-3 py-1 bg-orange-100 rounded-lg text-xs font-black text-orange-600">
                     {userTopUps.filter(t => t.status === 'Pending').length}
                   </span>
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
                                   onClick={() => handleRejectTopUp(topup.id)}
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
                  <tr className="border-b text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    <th className="pb-6 pl-2">Informasi Akun</th>
                    <th className="pb-6">Saldo Saat Ini</th>
                    <th className="pb-6 text-right pr-2">Aksi Top Up</th>
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
                                  onClick={() => {
                                    if(confirm(`Reset riwayat transaksi ${user.username}?`)) {
                                      onResetUserHistory?.(user.username);
                                    }
                                  }}
                                  className="p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors shadow-sm"
                                  title="Reset Riwayat Transaksi"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    if(confirm(`Hapus akun ${user.username}? Tindakan ini tidak dapat dibatalkan.`)) {
                                      onDeleteUser?.(user.username);
                                    }
                                  }}
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
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black text-gray-900">Katalog Produk</h2>
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
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Tambah Produk
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map(p => (
                  <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex gap-5 group hover:border-blue-200 transition-all hover:shadow-xl">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0">
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
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
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
                                            <span className="text-gray-700">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
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
