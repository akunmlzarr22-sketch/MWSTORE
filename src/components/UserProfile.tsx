
import React, { useState, useEffect } from 'react';
import { User, Mail, Smartphone, Lock, Save, ArrowLeft, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { UserAccount } from '../types';
import { ApiService } from '../services/apiService';

import { auth as firebaseAuth } from '../lib/firebase';

interface UserProfileProps {
  username: string;
  onBack: () => void;
  onUpdate: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ username, onBack, onUpdate }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const uid = firebaseAuth.currentUser?.uid;
      if (uid) {
        const currentUser = await ApiService.getUser(uid);
        if (currentUser) {
          setUser(currentUser);
          setEmail(currentUser.email || '');
          setPhone(currentUser.phone || '');
        }
      }
    };
    fetchUser();
  }, [username]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const uid = firebaseAuth.currentUser?.uid;
      if (uid && user) {
        const updatedUser: UserAccount = {
          ...user,
          email,
          phone
        };
        await ApiService.saveUser(updatedUser, uid);
        setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' });
        onUpdate();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal memperbarui profil.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-bold mb-8 transition-colors group"
      >
        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm group-hover:bg-blue-50">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Kembali ke Beranda
      </button>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 text-white relative overflow-hidden">
           {/* Decorative circles */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
           <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>
           
           <div className="relative z-10 flex items-center gap-6">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2rem] border border-white/30 flex items-center justify-center">
                 <User className="w-10 h-10 text-white" />
              </div>
              <div>
                 <h2 className="text-3xl font-black tracking-tight">{user.username}</h2>
                 <p className="text-blue-100/80 font-bold uppercase tracking-widest text-[10px] mt-1 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-green-400" />
                    Akun {user.role === 'admin' ? 'Administrator' : 'Terverifikasi'}
                 </p>
              </div>
           </div>
        </div>

        <div className="p-10 space-y-8">
           {message && (
             <motion.div 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider ${
                 message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
               }`}
             >
                {message.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                {message.text}
             </motion.div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Alamat Email</label>
                 <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                       type="email"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       placeholder="email@anda.com"
                       className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
                 <div className="relative group">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                       type="tel"
                       value={phone}
                       onChange={(e) => setPhone(e.target.value)}
                       placeholder="08123456789"
                       className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900"
                    />
                 </div>
              </div>
           </div>

           <div className="pt-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-blue-600 text-white rounded-[1.5rem] py-5 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Menyimpan Perubahan...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Simpan Perubahan Profile
                  </>
                )}
              </button>
           </div>
        </div>

        <div className="bg-gray-50 p-6 flex items-center justify-center gap-8 border-t border-gray-100">
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Terakhir Update</span>
              <span className="text-[10px] font-bold text-gray-600 italic">Hari ini</span>
           </div>
           <div className="w-px h-8 bg-gray-200"></div>
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Keamanan</span>
              <span className="text-[10px] font-bold text-green-600 uppercase">Enskripsi AES</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
