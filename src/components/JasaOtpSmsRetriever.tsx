import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, Ban, MessageSquareCode, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ApiService } from '../services/apiService';

interface JasaOtpData {
  id: number | string;
  number: string;
  country: string;
  service: string;
  operator: string;
  status: 'Aktif' | 'Selesai' | 'Batal';
  createdAt: number;
}

interface JasaOtpSmsRetrieverProps {
  orderId: string;
  rawStr: string;
  username: string;
  onUpdateOrderData: (newRawStr: string) => void;
  refundAmount: number;
}

export const JasaOtpSmsRetriever: React.FC<JasaOtpSmsRetrieverProps> = ({
  orderId,
  rawStr,
  username,
  onUpdateOrderData,
  refundAmount
}) => {
  const [data, setData] = useState<JasaOtpData | null>(null);
  const [smsText, setSmsText] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(1200); // 20 minutes in seconds

  useEffect(() => {
    try {
      const jsonStr = rawStr.replace('JASAOTP_ORDER:', '');
      const parsed = JSON.parse(jsonStr) as JasaOtpData;
      setData(parsed);

      // Hitung sisa waktu (JasaOTP nomor berumur 20 menit)
      const elapsedSeconds = Math.floor((Date.now() - parsed.createdAt) / 1000);
      const remaining = Math.max(0, 1200 - elapsedSeconds);
      setTimeLeft(remaining);
    } catch (e) {
      console.error("Failed to parse JasaOTP object:", e);
    }
  }, [rawStr]);

  // Timer countdown
  useEffect(() => {
    if (!data || data.status !== 'Aktif' || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto cancel if expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyNumber = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.number);
    alert('Nomor HP berhasil disalin!');
  };

  const handleCopySms = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('OTP berhasil disalin!');
  };

  // 1. Ambil SMS / OTP
  const handleCheckSms = async () => {
    if (!data) return;
    setIsChecking(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/nokos/sms?id=${data.id}`);
      const resJson = await res.json();

      console.log("[JasaOTP] Check SMS response:", resJson);

      if (resJson && resJson.success) {
        if (resJson.data && resJson.data.sms) {
          setSmsText(resJson.data.sms);
          
          // Tandai selesai
          const updated: JasaOtpData = {
            ...data,
            status: 'Selesai'
          };
          onUpdateOrderData(`JASAOTP_ORDER:${JSON.stringify(updated)}`);
          alert('SMS OTP Berhasil Masuk!');
        } else {
          // Status masih menunggu
          setErrorMsg("SMS OTP belum masuk. Silakan tunggu dan periksa berkala.");
        }
      } else {
        setErrorMsg(resJson.message || "SMS OTP belum dikirim oleh provider.");
      }
    } catch (err: any) {
      console.error("Check SMS error:", err);
      setErrorMsg("Koneksi gagal saat memeriksa SMS.");
    } finally {
      setIsChecking(false);
    }
  };

  // 2. Batalkan nomor virtual (REFUND SALDO)
  const handleCancelNumber = async () => {
    if (!data) return;
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan nomor virtual ini? Saldo belanja Anda akan segera dikembalikan.')) return;

    setIsCanceling(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/nokos/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id })
      });
      const resJson = await res.json();

      console.log("[JasaOTP] Cancel response:", resJson);

      if (resJson && resJson.success) {
        // Balikkan saldo toko user
        const currentAuth = JSON.parse(localStorage.getItem('mwstore_auth') || '{}');
        const userBalanceRes = await fetch(`/api/users/profile?username=${username}`);
        const userProfile = await userBalanceRes.json();
        
        const currentBalance = userProfile?.balance || currentAuth?.balance || 0;
        const refundedBalance = currentBalance + refundAmount;

        // Save balance refund
        await ApiService.updateBalanceByUsername(username, refundedBalance);
        
        // Update local session auth if same user
        if (currentAuth.username === username) {
          currentAuth.balance = refundedBalance;
          localStorage.setItem('mwstore_auth', JSON.stringify(currentAuth));
        }

        // Simpan perubahan status dibatalkan
        const updated: JasaOtpData = {
          ...data,
          status: 'Batal'
        };
        onUpdateOrderData(`JASAOTP_ORDER:${JSON.stringify(updated)}`);
        alert(`Pesanan nomor dibatalkan. Saldo belanja sebesar Rp ${refundAmount.toLocaleString('id-ID')} telah dikembalikan ke akun Anda!`);
        window.location.reload(); // Refresh to update visual balances
      } else {
        setErrorMsg(resJson.message || "Gagal membatalkan nomor HP. Mungkin nomor sudah menerima SMS / OTP.");
      }
    } catch (err: any) {
      console.error("Cancel number error:", err);
      setErrorMsg("Koneksi gagal saat membatalkan nomor JasaOTP.");
    } finally {
      setIsCanceling(false);
    }
  };

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-50/75 to-purple-50/75 p-5 rounded-2xl border border-indigo-100/80 space-y-4 max-w-sm mt-3 animate-in fade-in duration-300">
      <div className="flex justify-between items-center border-b border-indigo-100/60 pb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#6366f1] flex items-center gap-1.5">
          <MessageSquareCode className="w-3.5 h-3.5" />
          Virtual Number Controller
        </span>
        <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-tight ${
          data.status === 'Aktif' ? 'bg-indigo-100 text-indigo-700 animate-pulse' :
          data.status === 'Selesai' ? 'bg-green-100 text-green-700' :
          'bg-gray-200 text-gray-500'
        }`}>
          {data.status}
        </span>
      </div>

      <div className="space-y-1">
        <span className="text-[9px] text-gray-400 font-bold uppercase block">Nomor Ponsel Virtual</span>
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-indigo-100/50 shadow-sm">
          <span className="text-sm font-black text-indigo-950 tracking-wider font-mono">
            {data.number}
          </span>
          <button
            onClick={handleCopyNumber}
            className="p-1 px-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all"
          >
            <Copy className="w-3 h-3" />
            Salin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-gray-500 bg-white/60 p-2.5 rounded-xl border border-indigo-100/30">
        <div>
          <span className="text-gray-400 uppercase text-[8px] font-black leading-none block mb-1">Negara ID</span>
          <span className="font-mono text-gray-800">{data.country}</span>
        </div>
        <div>
          <span className="text-gray-400 uppercase text-[8px] font-black leading-none block mb-1">Layanan</span>
          <span className="font-mono text-gray-800 uppercase">{data.service}</span>
        </div>
        <div>
          <span className="text-gray-400 uppercase text-[8px] font-black leading-none block mb-1">Operator</span>
          <span className="font-mono text-gray-800 uppercase">{data.operator}</span>
        </div>
      </div>

      {/* TAMPILAN JIKA SMS MASUK */}
      {smsText && (
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-2 animate-in zoom-in-95 duration-200">
          <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            SMS OTP DITERIMA!
          </span>
          <div className="p-3 bg-white rounded-lg border border-emerald-100 flex items-center justify-between gap-2">
            <p className="text-sm font-black font-mono text-emerald-950 break-all select-all">
              {smsText}
            </p>
            <button
              onClick={() => handleCopySms(smsText)}
              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ACTION CONTROLLER JIKA AKTIF */}
      {data.status === 'Aktif' && (
        <div className="space-y-3">
          {timeLeft > 0 ? (
            <div className="flex items-center justify-between text-[10px] text-indigo-500 font-bold px-1">
              <span>Sisa durasi nomor aktif:</span>
              <span className="font-mono font-black tracking-widest text-[#6366f1]">{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <p className="text-[9px] text-red-500 font-bold ml-1 italic">* Masa aktif nomor telah berakhir. Silakan batalkan.</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCheckSms}
              disabled={isChecking || isCanceling}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-150 disabled:opacity-50"
            >
              {isChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Periksa SMS
            </button>

            <button
              onClick={handleCancelNumber}
              disabled={isChecking || isCanceling}
              className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black uppercase tracking-widest text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all disabled:opacity-50"
              title="Batalkan OTP & Ambil Refund Saldo"
            >
              {isCanceling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              Batal
            </button>
          </div>
        </div>
      )}

      {data.status === 'Batal' && (
        <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex items-center gap-2 text-[10px] text-rose-700 font-bold">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          Nomor ponsel ini telah dibatalkan dan saldo belanja Anda telah dikembalikan.
        </div>
      )}

      {errorMsg && (
        <div className="text-[10px] text-indigo-600 bg-indigo-50/50 p-3 rounded-xl font-bold italic text-left leading-normal border border-indigo-100/50 border-dashed animate-in fade-in duration-200">
          💡 Info: {errorMsg}
        </div>
      )}
    </div>
  );
};
