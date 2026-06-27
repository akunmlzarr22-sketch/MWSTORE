import React, { useState, useEffect } from 'react';
import { Copy, RotateCw, Loader2, Sparkles, AlertCircle, CheckCircle2, Clock, PlayCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { ApiService } from '../services/apiService';

export interface SmmOrderData {
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

interface SmmOrderTrackerProps {
  orderId: string;
  rawStr: string;
  username: string;
  onUpdateOrderData: (newRawStr: string, updatedStoreStatus?: 'Pending' | 'Proses' | 'Selesai' | 'Dibatalkan') => void;
  onUpdateBalance: (newBalance: number) => void;
}

const formatIDR = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num);
};

export const SmmOrderTracker: React.FC<SmmOrderTrackerProps> = ({
  orderId,
  rawStr,
  username,
  onUpdateOrderData,
  onUpdateBalance
}) => {
  const [smmObj, setSmmObj] = useState<SmmOrderData | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const jsonStr = rawStr.replace('SMM_ORDER:', '');
      const parsed = JSON.parse(jsonStr) as SmmOrderData;
      setSmmObj(parsed);
    } catch (e) {
      console.error("Failed to parse SmmOrderData object:", e);
    }
  }, [rawStr]);

  const handleCopyLink = () => {
    if (!smmObj) return;
    navigator.clipboard.writeText(smmObj.link);
    alert('Link target berhasil disalin!');
  };

  const handleRefreshStatus = async () => {
    if (!smmObj) return;
    setIsChecking(true);
    setErrorMsg(null);

    const smmProvId = smmObj.orderId;

    try {
      const res = await fetch('/api/smm/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: smmProvId })
      });
      const data = await res.json();

      if (data && data.status) {
        const prevStatus = smmObj.status.toLowerCase();
        const nextStatus = data.status.toLowerCase(); // Completed, Processing, Pending, Error, Partial, Canceled, Partial

        const updatedSmmObj: SmmOrderData = {
          ...smmObj,
          status: data.status,
          charge: data.charge !== undefined ? String(data.charge) : smmObj.charge,
          remains: data.remains !== undefined ? String(data.remains) : smmObj.remains,
          lastChecked: new Date().toLocaleString('id-ID')
        };

        // Determine if refund is needed (automatic refund if status is partial, error or canceled and hasn't been refunded yet)
        let refundAmount = 0;
        let needsRefundStatusUpdate = false;

        const isAlreadyProcessed = prevStatus.includes('refund') || prevStatus === 'completed' || prevStatus === 'canceled' || prevStatus === 'error';
        
        if (!isAlreadyProcessed) {
          if (nextStatus === 'error' || nextStatus === 'canceled' || nextStatus === 'dibatalkan' || nextStatus === 'gagal') {
            refundAmount = smmObj.price;
            updatedSmmObj.status = 'Refunded (Gagal)';
            needsRefundStatusUpdate = true;
          } else if (nextStatus === 'partial' || nextStatus === 'sebagian') {
            const remainsCount = Number(data.remains) || 0;
            if (remainsCount > 0 && remainsCount < smmObj.quantity) {
              const itemPrice = smmObj.price / smmObj.quantity;
              refundAmount = Math.round(itemPrice * remainsCount);
              updatedSmmObj.status = 'Refunded (Selesai Sebagian)';
              needsRefundStatusUpdate = true;
            }
          }
        }

        // Apply Refund
        if (refundAmount > 0) {
          // Fetch latest user details or fallback to auth
          const userBalanceRes = await fetch(`/api/users/profile?username=${username}`);
          const userProfile = await userBalanceRes.json();
          const currentAuth = JSON.parse(localStorage.getItem('mwstore_auth') || '{}');
          
          const currentBalance = userProfile?.balance || currentAuth?.balance || 0;
          const refundedBalance = currentBalance + refundAmount;

          await ApiService.updateBalanceByUsername(username, refundedBalance);
          
          // If logged in, sync current user's session auth
          if (currentAuth.username === username) {
            currentAuth.balance = refundedBalance;
            localStorage.setItem('mwstore_auth', JSON.stringify(currentAuth));
          }

          onUpdateBalance(refundedBalance);
          alert(`Pesanan SMM Anda selesai sebagian/gagal. Dana pengembalian Rp ${refundAmount.toLocaleString('id-ID')} telah dikembalikan otomatis ke Saldo Akun!`);
        }

        const nextStoreStatus = needsRefundStatusUpdate 
          ? 'Dibatalkan' 
          : (nextStatus === 'completed' || nextStatus === 'success' || nextStatus === 'selesai' ? 'Selesai' : 'Proses');

        // Update parent
        onUpdateOrderData(`SMM_ORDER:${JSON.stringify(updatedSmmObj)}`, nextStoreStatus);
        
        if (refundAmount > 0) {
          // Slight delay and then window reload to reconcile UI display
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }
      } else {
        setErrorMsg(data.error || "Gagal mendapatkan respon status terbaru dari server SMM.");
      }
    } catch (err: any) {
      console.error("[SmmOrderTracker] Error checking status:", err);
      setErrorMsg("Koneksi gagal. Silakan coba kembali beberapa saat lagi.");
    } finally {
      setIsChecking(false);
    }
  };

  if (!smmObj) return null;

  const statusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('completed') || s.includes('success') || s.includes('selesai')) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    }
    if (s.includes('pending')) {
      return { bg: 'bg-yellow-50 text-yellow-700 border-yellow-105', icon: <Clock className="w-3.5 h-3.5 animate-pulse" /> };
    }
    if (s.includes('processing') || s.includes('proses') || s.includes('progress')) {
      return { bg: 'bg-blue-50 text-blue-700 border-blue-100', icon: <PlayCircle className="w-3.5 h-3.5 animate-spin" /> };
    }
    if (s.includes('partial')) {
      return { bg: 'bg-orange-50 text-orange-700 border-orange-100', icon: <AlertCircle className="w-3.5 h-3.5" /> };
    }
    if (s.includes('refund')) {
      return { bg: 'bg-purple-50 text-purple-700 border-purple-100', icon: <RefreshCw className="w-3.5 h-3.5" /> };
    }
    return { bg: 'bg-rose-50 text-rose-700 border-rose-100', icon: <AlertCircle className="w-3.5 h-3.5" /> };
  };

  const style = statusStyle(smmObj.status);

  return (
    <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/40 p-5 rounded-2xl border border-indigo-100/60 space-y-4 max-w-sm mt-3 animate-in fade-in duration-300">
      <div className="flex justify-between items-center border-b border-indigo-100/50 pb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          Suntik Sosmed ID #{smmObj.orderId}
        </span>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight border flex items-center gap-1 ${style.bg}`}>
          {style.icon}
          {smmObj.status}
        </span>
      </div>

      <div className="space-y-1">
        <span className="text-[9px] text-gray-400 font-bold uppercase block">Target Link Sosmed</span>
        <div className="flex items-center justify-between bg-white px-3 py-2 border border-gray-100 rounded-xl shadow-xs">
          <span className="text-xs font-bold text-gray-700 truncate max-w-[200px]" title={smmObj.link}>
            {smmObj.link}
          </span>
          <button
            onClick={handleCopyLink}
            className="p-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-all"
          >
            <Copy className="w-3 h-3" />
            Salin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold text-gray-500 bg-white/70 p-2.5 rounded-xl border border-indigo-50">
        <div className="border-r border-indigo-50/80">
          <span className="text-gray-400 uppercase text-[8px] font-black leading-none block mb-1">Jumlah Pesanan</span>
          <span className="font-mono text-gray-800">{smmObj.quantity.toLocaleString('id-ID')} Qty</span>
        </div>
        <div>
          <span className="text-gray-400 uppercase text-[8px] font-black leading-none block mb-1">Sisa Target SMM</span>
          <span className="font-mono text-indigo-600 font-extrabold">
            {smmObj.remains !== undefined ? `${Number(smmObj.remains).toLocaleString('id-ID')} Qty` : 'Memproses...'}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        <div className="flex justify-between items-center text-[10px] text-gray-450 font-bold px-1 text-left">
          <span>Terakhir Diperiksa:</span>
          <span className="font-bold text-gray-600">{smmObj.lastChecked || 'Belum diperbarui'}</span>
        </div>

        <button
          onClick={handleRefreshStatus}
          disabled={isChecking}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-150 disabled:opacity-50"
        >
          {isChecking ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Memeriksa Status...
            </>
          ) : (
            <>
              <RotateCw className="w-3.5 h-3.5" />
              Lacak & Perbarui Status
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="text-[10px] text-rose-600 bg-rose-50/50 p-3 rounded-xl font-bold italic text-left leading-normal border border-rose-100/50 border-dashed animate-in fade-in duration-200">
          ⚠️ Gagal: {errorMsg}
        </div>
      )}
    </div>
  );
};
