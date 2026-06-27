import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, RotateCw, Loader2, ChevronDown, CheckCircle2, AlertCircle,
  ArrowRight, Search, Globe, Users, Play, Heart, ThumbsUp, Layers, HelpCircle, FileText
} from 'lucide-react';
import { formatIDR } from '@/constants';
import { ApiService } from '@/services/apiService';
import { Order, AuthState } from '@/types';

interface SmmService {
  service: string | number;
  name: string;
  category: string;
  rate: string; // Rate per 1000
  min: string;
  max: string;
  refill: boolean;
  cancel: boolean;
}

interface SmmOrderData {
  orderId: number | string;
  serviceId: string | number;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  price: number;
  status: string;
  charge?: string;
  remains?: string;
  lastChecked?: string;
}

interface SmmMenuTabProps {
  auth: AuthState;
  onUpdateBalance: (newBalance: number) => void;
  setView: (view: any) => void;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

// Dynamic Profit Markup for SMM Services from settings
const getSellPrice = (
  ratePer1000: string | number,
  qty: number,
  markupPercent: number = 50,
  markupFlat: number = 0
): number => {
  const rate = Number(ratePer1000) || 0;
  const cost = (rate / 1000) * qty;
  const percentAdded = cost * (markupPercent / 100);
  const flatAdded = (markupFlat / 1000) * qty;
  const total = cost + percentAdded + flatAdded;
  return Math.max(10, Math.round(total));
};

export const SmmMenuTab: React.FC<SmmMenuTabProps> = ({
  auth,
  onUpdateBalance,
  setView,
  setOrders
}) => {
  const [services, setServices] = useState<SmmService[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedService, setSelectedService] = useState<SmmService | null>(null);
  const [markupPercent, setMarkupPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('mwstore_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.smmSettings?.markupPercent !== undefined) {
          return Number(parsed.smmSettings.markupPercent);
        }
      }
    } catch (e) {}
    return 50;
  });
  const [markupFlat, setMarkupFlat] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('mwstore_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.smmSettings?.markupFlat !== undefined) {
          return Number(parsed.smmSettings.markupFlat);
        }
      }
    } catch (e) {}
    return 0;
  });
  
  // Fields
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  
  // Loading & states
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [providerBalance, setProviderBalance] = useState<string | null>(null);

  // Filter & Search SMM Services Dropdown
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  // SMM Orders tracker
  const [smmOrders, setSmmOrders] = useState<Order[]>([]);
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);

  // Fetch Provider Balance & Services list
  const fetchSmmData = async () => {
    setIsLoadingServices(true);
    setErrorMsg(null);
    try {
      // Fetch SMM Services
      const svcRes = await fetch('/api/smm/services', { method: 'POST' });
      const svcData = await svcRes.json();
      
      if (Array.isArray(svcData)) {
        setServices(svcData);
        // Extract unique categories
        const uniqueCategories = Array.from(new Set(svcData.map((s: SmmService) => s.category)));
        setCategories(uniqueCategories);
      }
      
      // Fetch SMM balance to display to admin/user status
      const balRes = await fetch('/api/smm/balance', { method: 'POST' });
      const balData = await balRes.json();
      if (balData && balData.balance) {
        setProviderBalance(balData.balance);
      }
    } catch (e: any) {
      console.error("[SMM Tab] Error fetching API values:", e);
      setErrorMsg("Koneksi gagal menghubungi gateway SMM. Mengaktifkan mode simulasi.");
    } finally {
      setIsLoadingServices(false);
    }
  };

  useEffect(() => {
    fetchSmmData();
    refreshSmmOrders();

    // Listen to global settings for dynamic SMM markup
    const unsubscribe = ApiService.listenToSettings((settings) => {
      if (settings && settings.smmSettings) {
        if (settings.smmSettings.markupPercent !== undefined) {
          setMarkupPercent(Number(settings.smmSettings.markupPercent));
        }
        if (settings.smmSettings.markupFlat !== undefined) {
          setMarkupFlat(Number(settings.smmSettings.markupFlat));
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch SMM orders placed by current user
  const refreshSmmOrders = () => {
    const allOrders = ApiService.getOrders();
    const userSmmOrders = allOrders.filter(o => {
      if (o.username !== auth.username) return false;
      const smmData = o.items[0]?.issuedData?.find(d => d.startsWith('SMM_ORDER:'));
      return !!smmData;
    });
    setSmmOrders(userSmmOrders);
  };

  // Check stats for SMM Order in Real-Time
  const handleCheckSmmStatus = async (orderId: string, smmProvId: string | number) => {
    setCheckingOrderId(orderId);
    try {
      const res = await fetch('/api/smm/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: smmProvId })
      });
      const data = await res.json();
      
      if (data && data.status) {
        // Let's retrieve original order to modify of status
        const ordersList = ApiService.getOrders();
        const foundIdx = ordersList.findIndex(o => o.id === orderId);
        if (foundIdx !== -1) {
          const original = ordersList[foundIdx];
          const smmRaw = original.items[0]?.issuedData?.find(d => d.startsWith('SMM_ORDER:'));
          if (smmRaw) {
            const parsedSmmObj = JSON.parse(smmRaw.replace('SMM_ORDER:', '')) as SmmOrderData;
            
            // Check status change for refund
            const prevStatus = parsedSmmObj.status.toLowerCase();
            const nextStatus = data.status.toLowerCase(); // Completed, Processing, Pending, Error, Partial, Canceled, Partial
            
            parsedSmmObj.status = data.status;
            parsedSmmObj.charge = data.charge;
            parsedSmmObj.remains = data.remains;
            parsedSmmObj.lastChecked = new Date().toLocaleString('id-ID');
            
            // Auto refund if status is partial, error or canceled and hasn't been refunded yet
            let refundAmount = 0;
            let needsRefundStatusUpdate = false;
            
            if (prevStatus !== 'completed' && prevStatus !== 'error' && prevStatus !== 'canceled' && prevStatus !== 'refunded') {
              if (nextStatus === 'error' || nextStatus === 'canceled' || nextStatus === 'dibatalkan' || nextStatus === 'gagal') {
                refundAmount = parsedSmmObj.price;
                parsedSmmObj.status = 'Refunded (Gagal)';
                needsRefundStatusUpdate = true;
              } else if (nextStatus === 'partial' || nextStatus === 'sebagian') {
                // Calculate refund proportional to remains
                const remainsCount = Number(data.remains) || 0;
                if (remainsCount > 0 && remainsCount < parsedSmmObj.quantity) {
                  const itemPrice = parsedSmmObj.price / parsedSmmObj.quantity;
                  refundAmount = Math.round(itemPrice * remainsCount);
                  parsedSmmObj.status = 'Refunded (Selesai Sebagian)';
                  needsRefundStatusUpdate = true;
                }
              }
            }

            const updatedIssued = [`SMM_ORDER:${JSON.stringify(parsedSmmObj)}`];
            const updatedOrder: Order = {
              ...original,
              status: needsRefundStatusUpdate 
                ? 'Dibatalkan' 
                : (nextStatus === 'completed' || nextStatus === 'success' ? 'Selesai' : 'Proses'),
              items: [
                {
                  ...original.items[0],
                  issuedData: updatedIssued
                }
              ]
            };

            // Refund logic process
            if (refundAmount > 0) {
              const users = ApiService.getUsers();
              const currentUser = users.find(u => u.username === auth.username);
              if (currentUser) {
                const updatedBalance = (currentUser.balance || 0) + refundAmount;
                await ApiService.updateBalanceByUsername(auth.username, updatedBalance);
                onUpdateBalance(updatedBalance);
                alert(`Pesanan SMM Anda bermasalah / selesai sebagian. Sistem mengembalikan dana Anda sebesar Rp ${refundAmount.toLocaleString('id-ID')} otomatis ke saldo akun.`);
              }
            }

            // Save order in memory / backend
            const dbRef = {
              users: ApiService.getUsers().reduce((acc, u) => ({ ...acc, [u.username]: u }), {}),
              products: ApiService.getProducts(),
              orders: ordersList.map((o, idx) => idx === foundIdx ? updatedOrder : o),
              topups: ApiService.getTopups(),
              messages: ApiService.getMessages(),
              vouchers: ApiService.getVouchers(),
              paymentSettings: await ApiService.getPaymentSettings()
            };
            
            // Save & sync
            localStorage.setItem('mwstore_orders', JSON.stringify(dbRef.orders));
            setOrders(dbRef.orders);
            refreshSmmOrders();
          }
        }
      }
    } catch (e) {
      console.error("[SMM] Status refresh failed:", e);
    } finally {
      setCheckingOrderId(null);
    }
  };

  // Submit Order to SMM provider via API proxy
  const handlePlaceSmmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedService) {
      setErrorMsg("Pilih layanan suntik sosmed terlebih dahulu.");
      return;
    }

    if (!targetLink.trim()) {
      setErrorMsg("Masukkan target pesanan (URL link atau username akun).");
      return;
    }

    const minLimit = Number(selectedService.min) || 50;
    const maxLimit = Number(selectedService.max) || 10000;

    if (quantity < minLimit || quantity > maxLimit) {
      setErrorMsg(`Jumlah pesanan untuk layanan ini harus di antara ${minLimit.toLocaleString('id-ID')} dan ${maxLimit.toLocaleString('id-ID')}.`);
      return;
    }

    const calculatedPrice = getSellPrice(selectedService.rate, quantity, markupPercent, markupFlat);
    if ((auth.balance || 0) < calculatedPrice) {
      setErrorMsg(`Saldo Anda tidak mencukupi. Anda membutuhkan ${formatIDR(calculatedPrice)} tetapi saldo Anda hanya ${formatIDR(auth.balance || 0)}.`);
      return;
    }

    setIsOrdering(true);
    try {
      // 1. Send Order to server proxy
      const payload = {
        service: selectedService.service,
        link: targetLink,
        quantity: quantity,
        comments: ''
      };

      const res = await fetch('/api/smm/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (data && data.order) {
        const smmOrderId = data.order; // Provider Order numerical ID
        const internalId = 'SMM-' + Date.now().toString().substring(6);

        // 2. Build SMM Order Object
        const smmOrderObj: SmmOrderData = {
          orderId: smmOrderId,
          serviceId: selectedService.service,
          serviceName: selectedService.name,
          category: selectedService.category,
          link: targetLink,
          quantity: quantity,
          price: calculatedPrice,
          status: 'Pending',
          lastChecked: new Date().toLocaleString('id-ID')
        };

        const listOrder: Order = {
          id: internalId,
          username: auth.username,
          items: [
            {
              id: `SMM_ITEM_${selectedService.service}`,
              name: `[SMM] ${selectedService.name}`,
              description: `Target: ${targetLink} | Qty: ${quantity}`,
              category: 'Suntik Sosmed',
              price: calculatedPrice,
              quantity: 1,
              rating: 5,
              image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=50&auto=format&fit=crop&q=60',
              stock: 9999,
              isNokosApi: false,
              issuedData: [`SMM_ORDER:${JSON.stringify(smmOrderObj)}`]
            }
          ],
          totalAmount: calculatedPrice,
          date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          status: 'Pending',
          paymentMethod: 'Saldo Akun'
        };

        // Save order and deduct user balance
        const successDeduction = await ApiService.updateBalanceByUsername(auth.username, (auth.balance || 0) - calculatedPrice);
        if (successDeduction) {
          onUpdateBalance((auth.balance || 0) - calculatedPrice);
          const currentOrders = ApiService.getOrders();
          const nextOrdersList = [listOrder, ...currentOrders];
          
          localStorage.setItem('mwstore_orders', JSON.stringify(nextOrdersList));
          setOrders(nextOrdersList);

          // Trigger server sync immediately
          await ApiService.syncFromServer();

          setSuccessMsg(`Pesanan SMM Anda berhasil diproses! ID Layanan: #${smmOrderId}. Status: Pending (Memproses).`);
          setTargetLink('');
          setQuantity(0);
          refreshSmmOrders();
        } else {
          setErrorMsg("Gagal melakukan pemotongan saldo. Silakan hubungi admin.");
        }
      } else {
        alert("Gagal menaruh order di server SMM: " + (data.error || "stok/koneksi habis"));
      }
    } catch (e: any) {
      console.error("[SMM Tab] Order failed:", e);
      setErrorMsg("Gagal menyelesaikan transaksi. Silakan coba kembali.");
    } finally {
      setIsOrdering(false);
    }
  };

  // Filter services by category & search query
  const filteredServices = services.filter(s => {
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch = s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) || 
                          s.service.toString().includes(serviceSearchQuery);
    return matchesCategory && matchesSearch;
  });

  // Category Icon helper
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('instagram') || cat.includes('ig')) return <Heart className="w-4 h-4 text-pink-500" />;
    if (cat.includes('tiktok')) return <Play className="w-4 h-4 text-black" />;
    if (cat.includes('youtube') || cat.includes('yt')) return <Play className="w-4 h-4 text-red-500" />;
    if (cat.includes('facebook') || cat.includes('fb')) return <ThumbsUp className="w-4 h-4 text-blue-600" />;
    if (cat.includes('follower')) return <Users className="w-4 h-4 text-indigo-500" />;
    return <Globe className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header section with brand and provider balance */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-black text-[8px] uppercase tracking-wider border border-indigo-100">
              Pipzpedia API Connected
            </span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            Suntik Sosmed Pro (SMM Panel)
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Tambah followers, views, likes, subscribers, jam tayang instan & aman.
          </p>
        </div>
        
        {auth.role === 'admin' && (
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100">
            <Layers className="w-4 h-4 text-indigo-600" />
            <div>
              <span className="text-[8px] uppercase font-black text-gray-400 tracking-wider block">Admin API Balance</span>
              <strong className="text-xs font-black text-indigo-600 font-mono">
                {providerBalance ? `$${Number(providerBalance).toFixed(2)} USD` : 'Memeriksa...'}
              </strong>
            </div>
            <button 
              onClick={fetchSmmData} 
              disabled={isLoadingServices}
              className="p-1 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingServices ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SMM Order placement Form (8 Columns) */}
        <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
          <form onSubmit={handlePlaceSmmOrder} className="space-y-6">
            
            {/* Category horizontal scrolls filter */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">
                Pilih Kategori Media Sosial
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedService(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${
                    selectedCategory === 'All' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' 
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  Semua Kategori
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedService(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                      selectedCategory === cat 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' 
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    {getCategoryIcon(cat)}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Interactive Services Select Box */}
            <div className="relative">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">
                Pilih Layanan Penambah
              </label>
              <div 
                onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-all cursor-pointer flex items-center justify-between"
              >
                {selectedService ? (
                  <div className="flex items-center gap-3">
                    {getCategoryIcon(selectedService.category)}
                    <div>
                      <span className="text-[9px] font-black text-indigo-600 uppercase block tracking-wider leading-none mb-1">
                        {selectedService.category}
                      </span>
                      <strong className="text-[11px] font-black text-gray-900 block leading-tight">
                        {selectedService.name}
                      </strong>
                      <span className="text-[9px] text-gray-400 font-bold block mt-0.5">
                        Min: {Number(selectedService.min).toLocaleString('id-ID')} | Max: {Number(selectedService.max).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 font-bold">Pilih Layanan Instagram, TikTok, YouTube dll...</span>
                )}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Advanced Interactive Dropdown with search */}
              <AnimatePresence>
                {isServiceDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute z-30 left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl max-h-72 overflow-y-auto"
                  >
                    <div className="p-3 border-b sticky top-0 bg-white">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          placeholder="Cari ID layanan atau nama media sosial..."
                          value={serviceSearchQuery}
                          onChange={(e) => setServiceSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full py-2 pl-9 pr-4 bg-gray-50 rounded-xl text-xs font-bold text-gray-800 placeholder-gray-400 border border-gray-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    
                    {filteredServices.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs font-bold">
                        Bukan layanan dari kategori ini.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {filteredServices.map(svc => (
                          <div
                            key={svc.service}
                            onClick={() => {
                              setSelectedService(svc);
                              setIsServiceDropdownOpen(false);
                            }}
                            className="p-3.5 hover:bg-indigo-50/40 cursor-pointer transition-all flex items-start justify-between gap-4"
                          >
                            <div className="flex gap-2.5 items-start">
                              <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[8px] font-mono font-black mt-0.5">
                                #{svc.service}
                              </span>
                              <div>
                                <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest block">{svc.category}</span>
                                <strong className="text-[11px] text-gray-800 font-extrabold block leading-tight">{svc.name}</strong>
                                <span className="text-[9px] text-gray-400 font-bold block mt-0.5">
                                  Min: {Number(svc.min).toLocaleString('id-ID')} | Max: {Number(svc.max).toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-right whitespace-nowrap">
                              <span className="text-indigo-600 text-xs font-black block">
                                {formatIDR(getSellPrice(svc.rate, 1000, markupPercent, markupFlat))}
                              </span>
                              <span className="text-[7.5px] text-gray-400 font-bold uppercase tracking-tighter">Per 1.000 Qty</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Target Link input */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">
                Target Pesanan (URL Link / Username Akun)
              </label>
              <input
                type="text"
                placeholder="Masukkan link contoh: https://instagram.com/p/xxx atau username"
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:outline-none focus:border-indigo-500 text-xs font-semibold text-gray-800 placeholder-gray-400 transition-colors"
                required
              />
              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-1 px-1">
                ⚠️ PERINGATAN: Pastikan akun media sosial atau postingan target disetting "PUBLIC" (Jangan Privat!)
              </p>
            </div>

            {/* Quantity Input slider and fields */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Jumlah Penambahan (Quantity)
                </label>
                {selectedService && (
                  <span className="text-[9px] font-black text-indigo-600 uppercase">
                    Minimal: {Number(selectedService.min).toLocaleString('id-ID')}
                  </span>
                )}
              </div>
              <input
                type="number"
                placeholder={selectedService ? `Min. ${selectedService.min} - Max. ${selectedService.max}` : "Masukkan jumlah item..."}
                value={quantity || ''}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:outline-none focus:border-indigo-500 text-xs font-mono font-bold text-gray-800 transition-colors"
                required
              />
            </div>

            {/* Real-time Order Summary details card */}
            {selectedService && quantity > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 grid grid-cols-2 gap-4"
              >
                <div>
                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-400 block mb-0.5">Layanan Terpilih</span>
                  <strong className="text-[10px] font-black text-gray-800 block line-clamp-1 leading-normal">{selectedService.name}</strong>
                  <span className="text-[9px] text-gray-400 font-mono">Rate: {formatIDR(getSellPrice(selectedService.rate, 1000, markupPercent, markupFlat))} / 1000</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-indigo-500 block mb-0.5">Total Bayar (Potong Saldo)</span>
                  <strong className="text-lg font-black text-indigo-600 font-mono leading-none">
                    {formatIDR(getSellPrice(selectedService.rate, quantity, markupPercent, markupFlat))}
                  </strong>
                  <span className="text-[8px] text-gray-400 block font-bold uppercase mt-0.5">Ppn (Sudah Termasuk Markup)</span>
                </div>
              </motion.div>
            )}

            {/* Error or Success notification blocks */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 text-xs font-semibold flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}

              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-green-50 rounded-2xl border border-green-100 text-green-600 text-xs font-semibold flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Buy submit Button */}
            <button
              type="submit"
              disabled={isOrdering || !selectedService || !targetLink || quantity <= 0}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
              {isOrdering ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Membuat Pesanan...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Beli Suntik Sosmed Sekarang
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Real-time Tracking and History Column (5 Columns) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-black text-gray-900 text-sm tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Lacak Pesanan Suntik Sosmed
          </h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 leading-relaxed">
            Klik tombol "Refresh Status" di bawah ini untuk memeriksa, melakukan refund otomatis bila gagal, atau sinkron riwayat suntik sosmed Anda.
          </p>

          {smmOrders.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center">
              <HelpCircle className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-[10px] text-gray-400 font-extrabold uppercase">Belum ada riwayat pesanan sosmed.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {smmOrders.map(order => {
                const item = order.items[0];
                const smmDataRaw = item?.issuedData?.find(d => d.startsWith('SMM_ORDER:'));
                if (!smmDataRaw) return null;
                const smmObj: SmmOrderData = JSON.parse(smmDataRaw.replace('SMM_ORDER:', ''));

                const statusColor = (status: string) => {
                  const s = status.toLowerCase();
                  if (s.includes('completed') || s.includes('success') || s.includes('selesai')) return 'bg-green-100 text-green-600 border-green-200';
                  if (s.includes('pending')) return 'bg-yellow-100 text-yellow-600 border-yellow-200';
                  if (s.includes('processing') || s.includes('proses')) return 'bg-blue-100 text-blue-600 border-blue-200';
                  if (s.includes('partial')) return 'bg-orange-100 text-orange-600 border-orange-200';
                  if (s.includes('refund')) return 'bg-purple-100 text-purple-600 border-purple-200';
                  return 'bg-red-100 text-red-600 border-red-200';
                };

                return (
                  <div key={order.id} className="p-4 rounded-2xl border border-gray-50 bg-gray-50/50 space-y-3 shadow-none">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black text-indigo-600 font-mono tracking-widest uppercase">
                        SMM ID #{smmObj.orderId}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[7.5px] font-extrabold uppercase tracking-wide border ${statusColor(smmObj.status)}`}>
                        {smmObj.status}
                      </span>
                    </div>

                    <div>
                      <strong className="text-[10.5px] font-black text-gray-800 line-clamp-1 leading-tight mb-0.5">
                        {smmObj.serviceName}
                      </strong>
                      <span className="text-[8px] text-gray-400 block font-bold uppercase truncate">
                        Link: {smmObj.link}
                      </span>
                      <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-gray-500 font-mono">
                        <span>Qty: {smmObj.quantity}</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-black font-sans">{formatIDR(smmObj.price)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-[8px] text-gray-400 font-bold block truncate max-w-[130px]">
                        Upd: {smmObj.lastChecked || 'Belum dicek'}
                      </span>
                      <button
                        onClick={() => handleCheckSmmStatus(order.id, smmObj.orderId)}
                        disabled={checkingOrderId === order.id}
                        className="px-2.5 py-1 bg-white hover:bg-gray-100 rounded-lg text-[8px] font-extrabold uppercase tracking-widest text-[#4f46e5] border border-gray-200 shadow-sm flex items-center gap-1 active:scale-95 disabled:opacity-50 transition-all"
                      >
                        {checkingOrderId === order.id ? (
                          <>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RotateCw className="w-2.5 h-2.5" />
                            Refresh Status
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
