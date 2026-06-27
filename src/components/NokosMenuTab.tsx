import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, Wallet, ShoppingCart, History, RotateCw, Loader2, 
  ChevronDown, MessageSquareCode, CheckCircle2, AlertCircle, Sparkles,
  ArrowRight, Ban, Copy, Search
} from 'lucide-react';
import { formatIDR } from '@/constants';
import { ApiService } from '@/services/apiService';
import { Order, AuthState } from '@/types';
import { JasaOtpSmsRetriever } from './JasaOtpSmsRetriever';

// Price Markup helper
const getSellPrice = (originalCost: number | string): number => {
  const cost = Number(originalCost) || 0;
  // Apply admin or system markup: original JasaOTP price + Rp 4.500 profit margin, minimum Rp 6.000
  return Math.max(6000, cost + 4500);
};

interface Country {
  id: string;
  negara: string;
}

interface ServiceObj {
  id: string;
  layanan: string;
  harga: string;
}

interface OperatorObj {
  id: string;
  operator: string;
}

interface NokosMenuTabProps {
  auth: AuthState;
  onUpdateBalance: (newBalance: number) => void;
  setView: (view: any) => void;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

export const NokosMenuTab: React.FC<NokosMenuTabProps> = ({
  auth,
  onUpdateBalance,
  setView,
  setOrders
}) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [services, setServices] = useState<ServiceObj[]>([]);
  const [operators, setOperators] = useState<OperatorObj[]>([]);

  const [selectedCountry, setSelectedCountry] = useState<string>('6'); // Default ID set to '6' (Indonesia)
  const [selectedService, setSelectedService] = useState<ServiceObj | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string>('any');

  const [isLoadingCountries, setIsLoadingCountries] = useState<boolean>(false);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
  const [isLoadingOperators, setIsLoadingOperators] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOrdering, setIsOrdering] = useState<boolean>(false);

  // Dropdown UI states
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isOperatorOpen, setIsOperatorOpen] = useState(false);

  // Dropdown Search states
  const [countrySearch, setCountrySearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  // Active / History Orders State on the Same Page
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [providerBalance, setProviderBalance] = useState<number | null>(null);

  // 1. Fetch Countries on Mount
  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/nokos/countries');
        const data = await res.json();
        
        let rawList: any[] = [];
        if (Array.isArray(data)) {
          rawList = data;
        } else if (data && Array.isArray(data.data)) {
          rawList = data.data;
        } else if (data && typeof data === 'object' && data !== null) {
          rawList = Object.entries(data).map(([id, val]: any) => {
            const negaraVal = (val && typeof val === 'object') 
              ? (val.negara || val.name || val.country || id)
              : (val || id);
            return { id, negara: negaraVal };
          });
        }

        // Normalize raw list to strongly-typed array of Country
        const list: Country[] = rawList
          .filter(Boolean)
          .map((item: any) => {
            const id = String(item.id_negara !== undefined ? item.id_negara : (item.id || item.country_id || '')).trim();
            const namaNegaraRaw = item.nama_negara || item.negara || item.country_name || item.name || item.country || id || 'Unknown Negara';
            const countryFormatted = String(namaNegaraRaw)
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            return { id: countryFormatted === 'Indonesia' ? '6' : id, negara: countryFormatted };
          });

        // Deduplicate countries by ID to avoid duplicate key errors
        const seenCountries = new Set<string>();
        const uniqueList = list.filter(c => {
          if (!c.id || seenCountries.has(c.id)) return false;
          seenCountries.add(c.id);
          return true;
        });

        // Keep Indonesia first if present
        uniqueList.sort((a, b) => {
          const nameA = a.negara.toLowerCase();
          const nameB = b.negara.toLowerCase();
          if (a.id === '6' || nameA.includes('indon')) return -1;
          if (b.id === '6' || nameB.includes('indon')) return 1;
          return nameA.localeCompare(nameB);
        });

        setCountries(uniqueList);

        // Fetch JasaOTP API Balance
        try {
          const balanceRes = await fetch('/api/nokos/balance');
          const balanceData = await balanceRes.json();
          if (balanceData && (balanceData.success === true || balanceData.code === 200) && balanceData.data) {
            setProviderBalance(Number(balanceData.data.saldo));
          }
        } catch (bErr) {
          console.error("Failed to fetch provider balance:", bErr);
        }

      } catch (err: any) {
        console.error("Error fetching JasaOTP countries:", err);
        setErrorMsg("Gagal memuat daftar negara ponsel.");
      } finally {
        setIsLoadingCountries(false);
      }
    };

    fetchCountries();
  }, []);

  // 2. Fetch Services & Operators when Country Changes
  useEffect(() => {
    if (!selectedCountry) return;

    const fetchCountryDetails = async () => {
      setIsLoadingServices(true);
      setIsLoadingOperators(true);
      setSelectedService(null);
      setErrorMsg(null);

      try {
        // Fetch Services
        const resServices = await fetch(`/api/nokos/services?negara=${selectedCountry}`);
        const dataServices = await resServices.json();
        
        let rawSList: any[] = [];
        if (dataServices) {
          const dataObj = (dataServices.success === true || dataServices.code === 200 || dataServices.data !== undefined)
            ? dataServices.data
            : dataServices;

          if (dataObj) {
            // Check if there is a nested object for the selected country (e.g., { "6": { "wa": ... } })
            const countryServices = dataObj[selectedCountry] || dataObj[String(selectedCountry)];
            
            if (countryServices && typeof countryServices === 'object' && !Array.isArray(countryServices)) {
              rawSList = Object.entries(countryServices).map(([srvId, srvVal]: any) => {
                const isValObj = srvVal && typeof srvVal === 'object';
                return {
                  id: srvId,
                  layanan: isValObj ? (srvVal.layanan || srvVal.name || srvId) : (srvVal || srvId),
                  harga: isValObj ? String(srvVal.harga || srvVal.price || '1500') : '1500'
                };
              });
            } else if (Array.isArray(dataObj)) {
              rawSList = dataObj;
            } else if (typeof dataObj === 'object' && dataObj !== null) {
              // Directly nested inside dataObj or other formats
              rawSList = Object.entries(dataObj)
                .filter(([key]) => !['success', 'code', 'message', 'data'].includes(key))
                .map(([id, val]: any) => {
                  const isValObj = val && typeof val === 'object';
                  return {
                    id,
                    layanan: isValObj ? (val.layanan || val.name || id) : (val || id),
                    harga: isValObj ? String(val.harga || val.price || '1500') : '1500'
                  };
                });
            }
          }
        }

        const sList: ServiceObj[] = rawSList
          .filter(Boolean)
          .map((item: any) => {
            const id = String(item.id || item.service_id || '').trim();
            const layanan = String(item.layanan || item.name || id || 'Unknown Service').trim();
            const harga = String(item.harga || item.price || '1500').trim();
            return { id, layanan, harga };
          });

        // Deduplicate services by ID
        const seenServices = new Set<string>();
        const uniqueServices = sList.filter(s => {
          if (!s.id || seenServices.has(s.id)) return false;
          seenServices.add(s.id);
          return true;
        });

        const finalServices = uniqueServices.length > 0 ? uniqueServices : [
          { id: 'wa', layanan: 'WhatsApp', harga: '3500' },
          { id: 'tg', layanan: 'Telegram', harga: '3000' },
          { id: 'google', layanan: 'Google / Gmail', harga: '2500' },
          { id: 'gojek', layanan: 'Gojek', harga: '1500' },
          { id: 'grab', layanan: 'Grab', harga: '1500' },
          { id: 'shopee', layanan: 'Shopee', harga: '1500' },
          { id: 'dana', layanan: 'Dana', harga: '3500' },
          { id: 'ovo', layanan: 'OVO', harga: '3500' },
          { id: 'tiktok', layanan: 'TikTok', harga: '2000' },
          { id: 'facebook', layanan: 'Facebook', harga: '1500' },
          { id: 'instagram', layanan: 'Instagram', harga: '1500' },
          { id: 'twitter', layanan: 'X / Twitter', harga: '2000' }
        ];

        setServices(finalServices);

        // Fetch Operators
        let uniqueOperators: OperatorObj[] = [];
        try {
          const resOperators = await fetch(`/api/nokos/operators?negara=${selectedCountry}`);
          const dataOperators = await resOperators.json();
          
          let rawOList: any[] = [];
          
          if (dataOperators && (dataOperators.success === false || dataOperators.success === 'false' || (dataOperators.code && dataOperators.code >= 400))) {
            console.warn("[Nokos] Received error response from operator API, using fallback.");
          } else if (dataOperators) {
            // Check if there is data wrapper
            const dataObj = (dataOperators.success === true || dataOperators.code === 200 || dataOperators.data !== undefined) 
              ? dataOperators.data 
              : dataOperators;

            if (dataObj) {
              if (dataObj[selectedCountry] && Array.isArray(dataObj[selectedCountry])) {
                rawOList = dataObj[selectedCountry].map((op: any) => {
                  const id = String(op).toLowerCase();
                  let display = String(op);
                  if (id === 'any') display = 'Otomatis / Sembarang (Rekomendasi)';
                  else if (id === 'byu') display = 'by.U';
                  else if (id === 'three') display = 'Tri (Three)';
                  else display = id.charAt(0).toUpperCase() + id.slice(1);
                  return { id, operator: display };
                });
              } else if (Array.isArray(dataObj)) {
                rawOList = dataObj.map((item: any) => {
                  if (typeof item === 'string') {
                    const id = item.toLowerCase();
                    let display = item;
                    if (id === 'any') display = 'Otomatis / Sembarang (Rekomendasi)';
                    else if (id === 'byu') display = 'by.U';
                    else if (id === 'three') display = 'Tri (Three)';
                    else display = id.charAt(0).toUpperCase() + id.slice(1);
                    return { id, operator: display };
                  }
                  const opId = String(item.id || item.operator_id || '').trim();
                  const opName = String(item.operator || item.name || opId || 'Unknown Operator').trim();
                  return { id: opId, operator: opName };
                });
              } else if (typeof dataObj === 'object' && dataObj !== null) {
                const firstArrayKey = Object.keys(dataObj).find(k => Array.isArray(dataObj[k]));
                if (firstArrayKey && Array.isArray(dataObj[firstArrayKey])) {
                  rawOList = dataObj[firstArrayKey].map((op: any) => {
                    const id = String(op).toLowerCase();
                    let display = String(op);
                    if (id === 'any') display = 'Otomatis / Sembarang (Rekomendasi)';
                    else if (id === 'byu') display = 'by.U';
                    else if (id === 'three') display = 'Tri (Three)';
                    else display = id.charAt(0).toUpperCase() + id.slice(1);
                    return { id, operator: display };
                  });
                } else {
                  rawOList = Object.entries(dataObj)
                    .filter(([key]) => !['success', 'code', 'message', 'data'].includes(key))
                    .map(([id, val]: any) => {
                      const oVal = val && typeof val === 'object' ? (val.operator || val.name || id) : (val || id);
                      return { id, operator: oVal };
                    });
                }
              }
            }
          }

          const oList: OperatorObj[] = rawOList
            .filter(Boolean)
            .map((item: any) => {
              const id = String(item.id || item.operator_id || '').trim();
              const operator = String(item.operator || item.name || id || 'Unknown Operator').trim();
              return { id, operator };
            });

          // Deduplicate operators by ID
          const seenOperators = new Set<string>();
          uniqueOperators = oList.filter(o => {
            if (!o.id || seenOperators.has(o.id.toLowerCase())) return false;
            seenOperators.add(o.id.toLowerCase());
            return true;
          });
        } catch (opErr) {
          console.warn("[Nokos] Operator fetch error, using fallback:", opErr);
        }

        const finalOperators = uniqueOperators.length > 0 ? uniqueOperators : [
          { id: 'any', operator: 'Otomatis / Sembarang (Rekomendasi)' },
          { id: 'indosat', operator: 'Indosat' },
          { id: 'telkomsel', operator: 'Telkomsel' },
          { id: 'axis', operator: 'Axis' },
          { id: 'three', operator: 'Tri (Three)' },
          { id: 'smartfren', operator: 'Smartfren' },
          { id: 'byu', operator: 'by.U' }
        ];
        
        // Ensure "Any" operator exists
        const hasAnyOperator = finalOperators.some(o => {
          if (!o || !o.operator) return false;
          const opLower = o.operator.toLowerCase();
          return o.id === 'any' || opLower.includes('any') || opLower.includes('random');
        });

        if (!hasAnyOperator) {
          finalOperators.unshift({ id: 'any', operator: 'Otomatis / Sembarang (Rekomendasi)' });
        }
        setOperators(finalOperators);

      } catch (err: any) {
        console.error("Error fetching country services/operators:", err);
        setErrorMsg("Gagal memuat daftar layanan atau operator negara terpilih.");
      } finally {
        setIsLoadingServices(false);
        setIsLoadingOperators(false);
      }
    };

    fetchCountryDetails();
  }, [selectedCountry]);

  // 3. Listen to Active Orders on same page reactively
  useEffect(() => {
    if (auth.username) {
      const unsubscribe = ApiService.listenToOrders(auth.username, auth.role === 'admin', (ordersList) => {
        // Filter for JasaOTP/Nokos orders
        const nokosOrders = ordersList.filter(o => 
          o.items.some(item => 
            item.category === 'Nokos' || 
            item.id.includes('nokos') || 
            item.name.toLowerCase().includes('otp') || 
            item.name.toLowerCase().includes('virtual') ||
            item.issuedData?.some(d => d.startsWith('JASAOTP_ORDER:'))
          )
        );
        setLocalOrders(nokosOrders);
      });
      return () => unsubscribe();
    }
  }, [auth.username, auth.role]);

  // Handle Order virtual number
  const handlePlaceOrder = async () => {
    if (!auth.isLoggedIn) {
      alert("Silakan login terlebih dahulu untuk memesan nomor virtual.");
      setView('profile');
      return;
    }

    if (!selectedService) {
      alert("Pilih layanan aplikasi/OTP terlebih dahulu.");
      return;
    }

    const price = getSellPrice(selectedService.harga);
    if ((auth.balance || 0) < price) {
      alert("Sisa saldo Anda tidak cukup untuk pembelian ini. Silakan top up.");
      setView('topup');
      return;
    }

    const countryName = countries.find(c => c.id === selectedCountry)?.negara || selectedCountry;
    if (!confirm(`Konfirmasi pembelian nomor virtual:\n- Aplikasi: ${selectedService.layanan}\n- Negara: ${countryName}\n- Harga: ${formatIDR(price)}\n\nLanjutkan pemesanan? Saldo Anda akan dikurangi.`)) {
      return;
    }

    setIsOrdering(true);
    setErrorMsg(null);

    try {
      // Send Order to server JasaOTP proxy
      const reqBody = {
        negara: selectedCountry,
        layanan: selectedService.id,
        operator: selectedOperator
      };

      console.log("[JasaOTP Client] Requesting Order:", reqBody);
      const res = await fetch('/api/nokos/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });

      const resJson = await res.json();
      console.log("[JasaOTP Client] Order Response:", resJson);

      const isSuccess = resJson && (resJson.status === "success" || resJson.success === true || resJson.status === "processing" || resJson.id);
      
      if (isSuccess) {
        const orderIdJasaOtp = resJson.id || (resJson.data && resJson.data.id) || 'NKS-' + Date.now();
        const virtualNumber = resJson.nomor || resJson.number || (resJson.data && (resJson.data.nomor || resJson.data.number || resJson.data.number_virtual)) || 'Unknown-Nokos';
        const finalCost = price;

        // Deduct user balance
        const newBalance = (auth.balance || 0) - finalCost;
        await ApiService.updateBalanceByUsername(auth.username || '', newBalance);
        onUpdateBalance(newBalance);

        // Add dynamic order to our store orders database
        const localOrderId = Math.floor(100000 + Math.random() * 900000).toString();
        const operatorName = operators.find(o => o.id === selectedOperator)?.operator || selectedOperator;

        const newOrder: Order = {
          id: localOrderId,
          items: [{
            id: 'nokos-virtual-' + Date.now(),
            name: `OTP Virtual ${selectedService.layanan} (${countryName})`,
            price: finalCost,
            quantity: 1,
            category: 'Nokos',
            image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=600&h=400&auto=format&fit=crop',
            stock: 1,
            issuedData: [`JASAOTP_ORDER:${JSON.stringify({
              id: orderIdJasaOtp,
              number: virtualNumber,
              country: countryName,
              service: selectedService.layanan,
              operator: operatorName,
              status: 'Aktif',
              createdAt: Date.now()
            })}`]
          }],
          totalAmount: finalCost,
          date: new Date().toLocaleString('id-ID'),
          status: 'Selesai',
          paymentMethod: 'Saldo Akun',
          username: auth.username || 'guest'
        };

        // Complete save locally
        await ApiService.createOrder(newOrder, auth.username || 'guest');
        setOrders(prev => [newOrder, ...prev]);

        alert(`Pemesanan Berhasil!\nNomor Virtual Anda: ${virtualNumber}\nSilakan tunggu SMS OTP masuk di menu Riwayat Pesanan di bawah.`);
        
        // Reset selections
        setSelectedService(null);
      } else {
        const errorDetail = resJson.message || resJson.error || resJson.info || "Saldo JasaOTP habis, atau stok nomor virtual untuk operator tersebut sedang kosong.";
        setErrorMsg(errorDetail);
        alert(`Gagal Memesan Nomor: ${errorDetail}`);
      }
    } catch (err: any) {
      console.error("[JasaOTP Client] Fatal purchase error:", err);
      setErrorMsg("Koneksi gagal saat menghubungi server JasaOTP. Silakan coba sebentar lagi.");
    } finally {
      setIsOrdering(false);
    }
  };

  // Render list of active/historic Nokos orders
  const renderOrdersList = () => {
    const filtered = localOrders.filter(o => {
      if (statusFilter === 'all') return true;
      const jData = o.items[0]?.issuedData?.find(d => d.startsWith('JASAOTP_ORDER:'));
      if (!jData) return false;
      try {
        const parsed = JSON.parse(jData.replace('JASAOTP_ORDER:', ''));
        return parsed.status.toLowerCase() === statusFilter.toLowerCase();
      } catch {
        return false;
      }
    });

    if (filtered.length === 0) {
      return (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[220px]">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-3 border border-gray-100/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Belum ada order</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filtered.map(order => {
          const jData = order.items[0]?.issuedData?.find(d => d.startsWith('JASAOTP_ORDER:'));
          if (!jData) return null;

          return (
            <div key={order.id} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-xs space-y-4">
              <div className="flex justify-between items-start border-b border-gray-50 pb-3">
                <div>
                  <span className="text-[9px] font-black text-gray-400 uppercase block tracking-wider leading-none mb-1">ID Transaksi</span>
                  <span className="text-xs font-black text-gray-800 font-mono">#{order.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-gray-400 uppercase block tracking-wider leading-none mb-1">Waktu Transaksi</span>
                  <span className="text-[10px] font-bold text-gray-500 font-mono">{order.date}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-400 font-bold block mb-0.5">Produk</span>
                  <span className="font-black text-teal-700 uppercase tracking-tight">{order.items[0]?.name || 'Nokos Virtual'}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 font-bold block mb-0.5">Biaya</span>
                  <span className="font-black text-blue-600 font-mono">{formatIDR(order.totalAmount)}</span>
                </div>
              </div>

              <JasaOtpSmsRetriever 
                orderId={order.id}
                rawStr={jData}
                username={auth.username || 'guest'}
                refundAmount={order.totalAmount}
                onUpdateOrderData={async (newStr) => {
                  const updatedItems = order.items.map(item => ({
                    ...item,
                    issuedData: item.issuedData?.map(d => d.startsWith('JASAOTP_ORDER:') ? newStr : d) || [newStr]
                  }));
                  const updatedOrder = { ...order, items: updatedItems };
                  
                  // Read the database, replace the order, and call save
                  try {
                    const res = await fetch('/api/db');
                    const db = await res.json();
                    if (db && db.orders) {
                      db.orders = db.orders.map((o: any) => o.id === order.id ? updatedOrder : o);
                      await fetch('/api/db', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(db)
                      });
                    }
                    setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
                  } catch (e) {
                    console.error("Failed to update Nokos order state:", e);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const selectedCountryName = countries.find(c => c.id === selectedCountry)?.negara || 'Pilih Negara';
  const selectedCountryFlag = selectedCountry === '6' || selectedCountryName.toLowerCase().includes('indo') ? '🇮🇩' : '🌐';

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* 1. SEAMLESS TOP BAR MATCHING MOCKUP */}
      <div className="bg-white border-b border-[#f1f5f9] py-4 px-5 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3b82f6] rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
            <Smartphone className="w-5.5 h-5.5 text-white" />
          </div>
          <h1 className="text-lg font-black text-[#1e293b] tracking-tight">Beli Nomor</h1>
        </div>

        <div className="bg-[#3b82f6] hover:bg-blue-600 transition-all text-white py-2 px-5 rounded-full font-black text-xs flex items-center gap-2 shadow-sm">
          <svg className="w-3.5 h-3.5 text-blue-150" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 18H3c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2h18c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2zM3 8v8h18V8H3z" />
          </svg>
          <span className="font-mono tracking-tight">{formatIDR(auth.balance || 0)}</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 space-y-6">
        
        {/* API STATUS & BALANCE INFO */}
        <div className="bg-white rounded-[2rem] border border-[#f1f5f9] p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Gateway JasaOTP.id</span>
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Terhubung (Online)</span>
            </div>
          </div>
          <div className="flex justify-between items-center border-t border-[#f8fafc] pt-2.5">
            <span className="text-gray-500 font-bold text-xs">Saldo Supplier API Server</span>
            <span className="font-mono font-black text-blue-600">
              {providerBalance !== null ? formatIDR(providerBalance) : 'Memuat...'}
            </span>
          </div>

          {providerBalance !== null && providerBalance < 3500 && (
            <div className="mt-2 text-xs bg-red-50/80 border border-red-100 p-4 rounded-2xl text-red-700 space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>Peringatan: Saldo API Sangat Kritis ({formatIDR(providerBalance)})!</span>
              </div>
              <p className="leading-relaxed text-[11px] text-red-800/90 font-normal">
                Sisa saldo API JasaOTP Anda adalah <strong className="font-black">{formatIDR(providerBalance)}</strong>, yang tidak mencukupi untuk melakukan transaksi nomor baru. Ini adalah alasan mengapa sistem JasaOTP mengembalikan respon <strong className="font-black">"ID negara tidak valid"</strong> atau <strong className="font-black">"Gagal mendapatkan daftar operator"</strong> saat Anda mencoba membeli nomor virtual.
              </p>
              <p className="text-[11px] font-bold text-red-800/90 bg-white/40 p-2 rounded-xl border border-red-100/50">
                💡 Cara Atasi: Lakukan pengisian saldo (top up) pada akun JasaOTP Anda atau ganti dengan API Key baru Anda yang bersaldo melalui Pengaturan Admin.
              </p>
            </div>
          )}
        </div>

        {/* 2. PESAN NOMOR VIRTUAL CARD */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#f1f5f9] shadow-md space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#f8fafc]">
            <ShoppingCart className="w-5 h-5 text-[#3b82f6]" />
            <h2 className="text-base font-black text-[#1e293b] tracking-tight">Pesan Nomor Virtual</h2>
          </div>

          <div className="space-y-4">
            
            {/* PILIH NEGARA DROPDOWN */}
            <div className="relative">
              <label className="block text-[10px] font-black tracking-widest text-[#94a3b8] uppercase mb-1.5">Pilih Negara</label>
              
              <button
                type="button"
                onClick={() => {
                  setIsCountryOpen(!isCountryOpen);
                  setIsServiceOpen(false);
                  setIsOperatorOpen(false);
                }}
                className="w-full flex items-center justify-between bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-4 py-3.5 text-sm text-gray-800 font-bold hover:bg-gray-50 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none">{selectedCountryFlag}</span>
                  <span className="text-gray-900 uppercase font-black tracking-tight">{selectedCountryName}</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isCountryOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCountryOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3 bg-gray-50 border-b border-gray-100">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cari negara ponsel..."
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 pl-8 text-xs font-bold placeholder-gray-400 text-gray-800 focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/20 outline-none"
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {countries.filter(c => c.negara.toLowerCase().includes(countrySearch.toLowerCase())).map(c => {
                      let flag = '🌐';
                      if (c.negara.toLowerCase().includes('indo')) flag = '🇮🇩';
                      else if (c.negara.toLowerCase().includes('rus')) flag = '🇷🇺';
                      else if (c.negara.toLowerCase().includes('amer') || c.negara.toLowerCase().includes('usa')) flag = '🇺🇸';
                      else if (c.negara.toLowerCase().includes('ingg') || c.negara.toLowerCase().includes('uk')) flag = '🇬🇧';
                      else if (c.negara.toLowerCase().includes('viet')) flag = '🇻🇳';
                      else if (c.negara.toLowerCase().includes('thail')) flag = '🇹🇭';
                      else if (c.negara.toLowerCase().includes('malay')) flag = '🇲🇾';
                      else if (c.negara.toLowerCase().includes('filip')) flag = '🇵🇭';
                      else if (c.negara.toLowerCase().includes('india')) flag = '🇮🇳';

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(c.id);
                            setIsCountryOpen(false);
                            setCountrySearch('');
                          }}
                          className={`w-full text-left px-4 py-3 text-xs font-black text-[#475569] uppercase hover:bg-blue-50/50 flex items-center gap-3 transition-colors ${selectedCountry === c.id ? 'bg-blue-50/20 text-[#3b82f6]' : ''}`}
                        >
                          <span className="text-lg">{flag}</span>
                          <span>{c.negara}</span>
                        </button>
                      );
                    })}
                    {countries.length === 0 && (
                      <div className="p-4 text-center text-xs text-red-500 font-black uppercase">Negara gagal dimuat. Harap periksa Kunci API Anda.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PILIH LAYANAN DROPDOWN */}
            <div className="relative">
              <label className="block text-[10px] font-black tracking-widest text-[#94a3b8] uppercase mb-1.5">Pilih Layanan</label>

              <button
                type="button"
                onClick={() => {
                  setIsServiceOpen(!isServiceOpen);
                  setIsCountryOpen(false);
                  setIsOperatorOpen(false);
                }}
                disabled={isLoadingServices}
                className="w-full flex items-center justify-between bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-4 py-3.5 text-sm text-gray-800 font-bold hover:bg-gray-50 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">📱</span>
                  <span className="text-gray-900 uppercase font-black tracking-tight">
                    {selectedService ? selectedService.layanan : 'Pilih Layanan'}
                  </span>
                </div>
                {isLoadingServices ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isServiceOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {isServiceOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3 bg-gray-50 border-b border-gray-100">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cari WA, Telegram, Google, Gojek, dll..."
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 pl-8 text-xs font-bold placeholder-gray-400 text-gray-800 focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/20 outline-none"
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {services.filter(s => s.layanan.toLowerCase().includes(serviceSearch.toLowerCase())).map(s => {
                      const sellPrice = getSellPrice(s.harga);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedService(s);
                            setIsServiceOpen(false);
                            setServiceSearch('');
                          }}
                          className={`w-full text-left px-4 py-3 text-xs font-black text-[#475569] uppercase hover:bg-teal-50/30 flex items-center justify-between gap-3 transition-colors ${selectedService?.id === s.id ? 'bg-teal-50/10 text-teal-700' : ''}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span>📱</span>
                            <span>{s.layanan}</span>
                          </div>
                          <span className="text-blue-600 font-mono">{formatIDR(sellPrice)}</span>
                        </button>
                      );
                    })}
                    {services.length === 0 && (
                      <div className="py-4 text-center text-xs text-gray-400 font-bold uppercase">Layanan kosong atau negara belum didukung.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PILIH OPERATOR DROPDOWN (PRESERVED) */}
            <div className="relative">
              <label className="block text-[10px] font-black tracking-widest text-[#94a3b8] uppercase mb-1.5">Pilih Operator</label>

              <button
                type="button"
                onClick={() => {
                  setIsOperatorOpen(!isOperatorOpen);
                  setIsCountryOpen(false);
                  setIsServiceOpen(false);
                }}
                disabled={isLoadingOperators}
                className="w-full flex items-center justify-between bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-4 py-3.5 text-sm text-gray-800 font-bold hover:bg-gray-50 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">📶</span>
                  <span className="text-gray-900 uppercase font-black tracking-tight">
                    {operators.find(o => o.id === selectedOperator)?.operator || 'Otomatis / Sembarang'}
                  </span>
                </div>
                {isLoadingOperators ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOperatorOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {isOperatorOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {operators.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedOperator(o.id);
                          setIsOperatorOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-xs font-black text-[#475569] uppercase hover:bg-pink-50/20 flex items-center gap-2.5 transition-colors ${selectedOperator === o.id ? 'bg-pink-50/10 text-pink-700' : ''}`}
                      >
                        <span>📶</span>
                        <span>{o.operator}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DYNAMIC PRICE TAG MODULE */}
            <div className="bg-[#f8fafc] border border-[#f1f5f9] rounded-2xl py-3.5 px-4 text-center flex items-center justify-center gap-1">
              <span className="text-sm font-black text-[#475569]">🏷️ Harga:</span>
              <span className="text-sm font-black text-gray-900">
                {selectedService ? `${formatIDR(getSellPrice(selectedService.harga))} / OTP` : '-- / OTP'}
              </span>
            </div>

            {/* ACTION BUTTON */}
            <button
              onClick={handlePlaceOrder}
              disabled={isOrdering}
              className="w-full py-4 bg-[#2563eb] hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[#ffffff] text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-blue-500/15 disabled:opacity-50"
            >
              {isOrdering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses Virtual Nomor...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Pesan Sekarang
                </>
              )}
            </button>

          </div>
        </div>

        {/* 3. RIWAYAT ORDER MODULE BELOW HEADER */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#1e293b]" />
              <h3 className="text-sm font-black text-[#1e293b] tracking-tight">Riwayat Order</h3>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-[#e2e8f0] text-[10px] font-black text-gray-600 rounded-xl px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500/20"
              >
                <option value="all">All Status</option>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
                <option value="batal">Batal</option>
              </select>

              <button
                onClick={async () => {
                  setIsLoadingCountries(true);
                  await ApiService.syncFromServer();
                  setIsLoadingCountries(false);
                }}
                className="bg-white hover:bg-gray-50 border border-[#e2e8f0] text-[10px] font-black text-gray-600 rounded-xl px-2.5 py-1.5 flex items-center gap-1 transition-all"
              >
                <RotateCw className="w-3 h-3 text-gray-500" />
                Refresh
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {renderOrdersList()}
          </div>
        </div>

      </div>
    </div>
  );
};
