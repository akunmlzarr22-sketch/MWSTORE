
import React, { useState } from 'react';
import { ShoppingBag, Lock, User, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff, Smartphone, Mail, Hash, LogIn } from 'lucide-react';
import { UserRole, UserAccount } from '@/types';
import { ApiService } from '@/services/apiService';
import { APP_CONFIG } from '@/config';
import { auth as firebaseAuth } from '@/lib/firebase';

interface LoginProps {
  onLogin: (role: UserRole, username: string) => void;
  onRegister: (account: UserAccount) => boolean;
  registeredUsers: UserAccount[];
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegister, registeredUsers }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(async () => {
      if (mode === 'login') {
        let user: UserAccount | null = null;
        
        // Try direct username lookup first
        user = await ApiService.getUser(username);
        
        // If not found, check registeredUsers (which might be populated if admin or if they were already in memory)
        if (!user) {
          user = registeredUsers.find(u => 
            (u.username.toLowerCase() === username.toLowerCase() || 
             (u.phone && u.phone === username) || 
             (u.email && u.email.toLowerCase() === username.toLowerCase()))
          ) || null;
        }

        const isPasswordCorrect = user && user.password === password;

        if (role === 'admin') {
          // Check registered users first if they are admin
          if (isPasswordCorrect && user?.role === 'admin') {
            const currentUser = await ApiService.ensureAuth();
            if (currentUser) {
              await ApiService.updateUserSession(user.username, { uid: currentUser.uid, lastLogin: new Date().toISOString() });
              await ApiService.promoteToAdmin(currentUser.uid, user.email || 'admin@mwstore.com');
            }
            onLogin('admin', user.username);
          } else if (username === '2284400' && password === 'EL1W8') {
            // Fallback hardcoded admin
            try {
              const firebaseUser = await ApiService.ensureAuth(true); // Force auth
              if (firebaseUser) {
                await ApiService.promoteToAdmin(firebaseUser.uid, 'hardcoded-admin@mwstore.com');
                // Use updateUserSession for fallback admin too if they already exist, else saveUser
                const existingAdmin = await ApiService.getUser('admin');
                if (existingAdmin) {
                   await ApiService.updateUserSession('admin', { uid: firebaseUser.uid, lastLogin: new Date().toISOString() });
                } else {
                  await ApiService.saveUser({ 
                    username: 'admin', 
                    password: 'EL1W8', 
                    role: 'admin', 
                    balance: 0, 
                    uid: firebaseUser.uid,
                    lastLogin: new Date().toISOString()
                  }, 'admin');
                }
                onLogin('admin', 'admin');
              } else {
                setError('Sistem Gagal: Tidak dapat menghubungkan ke server Firebase Auth.');
              }
            } catch (err: any) {
              setError('Sistem Error: ' + err.message);
            }
          } else {
            setError('Kredensial Admin Salah!');
          }
        } else {
          // User login
          if (isPasswordCorrect && user) {
            // Update UID in Firestore to current session UID if it changed
            // This allows the user to 'own' the account in the new session
            const currentUser = await ApiService.ensureAuth();
            if (currentUser && user.uid !== currentUser.uid) {
              await ApiService.updateUserSession(user.username, { uid: currentUser.uid, lastLogin: new Date().toISOString() });
            }
            onLogin('user', user.username);
          } else {
            setError('Username/Email/Nomor WA atau Password salah!');
          }
        }
      } else if (mode === 'register') {
        const existingUser = await ApiService.getUser(username);
        if (existingUser) {
          setError('Username sudah terdaftar!');
          setIsLoading(false);
          return;
        }
        const success = onRegister({ username, email, password, phone, role: 'user', balance: 0 });
        if (success) {
          setMode('login');
          setRole('user');
          setPhone('');
          setEmail('');
          alert('Pendaftaran Berhasil! Silakan Login.');
        } else {
          setError('Username sudah terdaftar!');
        }
      } else if (mode === 'forgot') {
        const user = registeredUsers.find(u => 
          u.phone === phone || 
          (u.email && u.email.toLowerCase() === phone.toLowerCase())
        );
        
        if (!isOtpSent) {
          if (user) {
            // Generate OTP
            const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 menit
            
            // Save OTP to user record
            const updatedUser = { ...user, currentOtp: newOtp, otpExpiry: expiry };
            await ApiService.saveUser(updatedUser, user.username);
            
            // Redirect to WhatsApp
            const message = window.encodeURIComponent(`Halo Admin, saya ingin meminta kode OTP untuk reset password.\n\nUsername: ${user.username}\nWA/Email: ${phone}`);
            window.open(`https://wa.me/${APP_CONFIG.admin.whatsapp}?text=${message}`, '_blank');
            
            setIsOtpSent(true);
            setError('');
          } else {
            setError('Nomor WhatsApp atau Email tidak ditemukan!');
          }
        } else {
          // Verify OTP phase
          if (user && user.currentOtp === otp) {
            const now = new Date();
            const expiry = user.otpExpiry ? new Date(user.otpExpiry) : new Date(0);
            
            if (now < expiry) {
              // Explicitly set OTP fields to null to ensure they are cleared in Firestore with merge:true
              const finalUser = { 
                ...user, 
                password: newPassword,
                currentOtp: null,
                otpExpiry: null
              };
              
              await ApiService.saveUser(finalUser, user.username);
              
              alert('Password berhasil diperbarui! Silakan login kembali.');
              setMode('login');
              setPhone('');
              setOtp('');
              setIsOtpSent(false);
              setNewPassword('');
            } else {
              setError('Kode OTP sudah kadaluarsa (5 menit). Silakan minta lagi.');
              setIsOtpSent(false);
            }
          } else {
            setError('Kode OTP salah!');
          }
        }
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <img src="https://i.imgur.com/oR61kTA.png" className="w-16 h-16 object-contain" alt="MWSTORE Logo" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">MWSTORE</h1>
          <p className="text-gray-500 mt-2 font-medium">
            {mode === 'login' ? 'Masuk ke akun Anda' : mode === 'register' ? 'Daftar sebagai pelanggan baru' : 'Atur Ulang Kata Sandi'}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {mode === 'login' && (
            <div className="flex p-1 bg-gray-100 m-6 rounded-xl">
              <button
                onClick={() => { setRole('user'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${
                  role === 'user' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="w-4 h-4" />
                Pelanggan
              </button>
              <button
                onClick={() => { setRole('admin'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${
                  role === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className={`p-6 ${mode !== 'login' ? 'pt-6' : 'pt-0'} space-y-5`}>
            {error && <div className="p-4 bg-red-50 text-red-600 text-xs rounded-xl font-bold border border-red-100 text-center animate-pulse">{error}</div>}
            
            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  {mode === 'login' ? 'Username / Email / Nomor WA' : 'Username'}
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={role === 'admin' ? 'ID Admin' : (mode === 'login' ? 'Username / Email / Nomor WA' : 'Username')}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-3.5 pl-12 pr-4 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900"
                  />
                </div>
              </div>
            )}

            {(mode === 'register' || mode === 'forgot') && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  {mode === 'forgot' ? 'Nomor WA / Email' : 'Nomor WhatsApp'}
                </label>
                <div className="relative group">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    required
                    disabled={isOtpSent && mode === 'forgot'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={mode === 'forgot' ? '08xxx atau email@anda.com' : '08xxx...'}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-3.5 pl-12 pr-4 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900 disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {mode === 'forgot' && isOtpSent && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Kode OTP (Cek WA Admin)</label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Masukkan 6 digit kode"
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-3.5 pl-12 pr-4 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-3.5 pl-12 pr-4 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900"
                  />
                </div>
              </div>
            )}

            {(mode !== 'forgot' || isOtpSent) && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  {mode === 'forgot' ? 'Kata Sandi Baru' : 'Kata Sandi'}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={mode === 'forgot' ? newPassword : password}
                    onChange={(e) => mode === 'forgot' ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-3.5 pl-12 pr-12 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end pr-1">
                <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-tighter">
                  Lupa Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all mt-8 active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Masuk Sekarang' : mode === 'register' ? 'Daftar Akun' : (isOtpSent ? 'Atur Ulang Password' : 'Minta Kode OTP via WhatsApp')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="p-6 bg-gray-50 border-t text-center">
            {mode === 'login' ? (
              role === 'user' && (
                <p className="text-sm text-gray-500 font-medium">
                  Belum punya akun?{' '}
                  <button onClick={() => { setMode('register'); setError(''); }} className="text-blue-600 font-black hover:underline">DAFTAR BARU</button>
                </p>
              )
            ) : (
              <p className="text-sm text-gray-500 font-medium">
                Sudah punya akun?{' '}
                <button onClick={() => { setMode('login'); setError(''); setIsOtpSent(false); }} className="text-blue-600 font-black hover:underline">LOGIN DISINI</button>
              </p>
            )}
          </div>
        </div>

        {mode === 'login' && role === 'admin' && (
          <div className="mt-8 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-orange-600 shrink-0" />
            <p className="text-[10px] text-orange-700 font-black uppercase tracking-tight">
              Sistem Admin Terproteksi. Masukkan kredensial khusus administrator untuk mengakses panel kendali.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
