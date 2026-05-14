import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, User, ShieldCheck, Clock, X, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { Message } from '@/types';
import { ApiService, safeParseDate } from '@/services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '@/lib/imageUtils';

interface CustomerServiceProps {
  username: string;
  onBack: () => void;
}

const CustomerService: React.FC<CustomerServiceProps> = ({ username, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const unsub = ApiService.listenToMessages(username, false, (fetchedMessages) => {
      // Filter for private messages only (where recipient is not community)
      // and sort oldest first for chat view
      const sorted = fetchedMessages
        .filter(m => m.recipient !== 'community')
        .sort((a, b) => {
          const timeA = safeParseDate(a.timestamp).getTime();
          const timeB = safeParseDate(b.timestamp).getTime();
          return timeA - timeB;
        });
      setMessages(sorted);
      
      // Mark admin messages to user as read
      const unreadAdminMessages = sorted
        .filter(m => m.sender === 'admin' && !m.read)
        .map(m => m.id as string);
      
      if (unreadAdminMessages.length > 0) {
        ApiService.markAsRead(unreadAdminMessages);
      }
    }, 'private');

    return () => unsub();
  }, [username]);

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !imageUrl) return;

    const message: Message = {
      id: Math.random().toString(36).substr(2, 9),
      sender: username,
      senderUid: username,
      recipient: 'admin',
      content: newMessage,
      imageUrl: imageUrl,
      timestamp: new Date().toISOString(),
      read: false
    };

    await ApiService.sendMessage(message, username);
    setNewMessage('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        await handleSendMessage(undefined, compressed);
      } catch (error) {
        console.error("Compression error:", error);
        alert("Gagal memproses gambar.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert("Gagal membaca file.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearChat = async () => {
    if (confirm("Hapus semua pesan dalam obrolan ini?")) {
      // Optimistic update
      setMessages([]);
      await ApiService.deleteChatByUsername(username);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (confirm("Hapus pesan ini?")) {
      // Optimistic update
      setMessages(prev => prev.filter(m => m.id !== messageId));
      await ApiService.deleteMessage(messageId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 animate-in fade-in duration-500 h-[calc(100vh-200px)] flex flex-col">
      <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
              <MessageCircle className="w-6 h-6" />
           </div>
           <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Customer Service</h2>
              <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                 <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Admin Online</span>
              </div>
           </div>
        </div>
        <div className="flex items-center gap-2">
           {messages.length > 0 && (
             <button 
               onClick={handleClearChat}
               className="p-2 text-gray-400 hover:text-red-500 transition-colors"
               title="Hapus Obrolan"
             >
               <X className="w-5 h-5 text-red-500" />
             </button>
           )}
           <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
           </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col mb-4">
         <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-600 mb-6 shadow-sm"
                  >
                     <MessageCircle className="w-12 h-12" />
                  </motion.div>
                  <h3 className="font-black text-xl text-gray-900 mb-2 uppercase tracking-tight">Butuh Bantuan?</h3>
                  <p className="text-sm font-bold text-gray-400 max-w-[280px] leading-relaxed">
                    Tanyakan apa saja kepada admin kami. Kami siap melayani keluhan atau pertanyaan Anda seputar produk.
                  </p>
                  <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm">
                    {['Cara Top Up?', 'Proses Order?', 'Gagal Bayar?', 'Lainnya'].map(q => (
                      <button 
                        key={q}
                        onClick={() => setNewMessage(q)}
                        className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all text-center"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
               </div>
            ) : (
               messages.map((m) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={m.id} 
                    className={`flex ${m.sender === username ? 'justify-end' : 'justify-start'}`}
                  >
                     <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm relative group ${
                        m.sender === username 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : (m.sender === 'admin' || m.sender === '2284400')
                            ? 'bg-indigo-600 text-white rounded-tl-none'
                            : 'bg-gray-50 text-gray-900 rounded-tl-none border border-gray-100'
                     }`}>
                        {m.sender === username && (
                          <button 
                            onClick={() => handleDeleteMessage(m.id!)}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-white border border-gray-100 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-all shadow-sm z-10"
                            title="Hapus untuk Semua"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="flex items-center gap-2 mb-1 opacity-60">
                           {(m.sender === 'admin' || m.sender === '2284400') ? (
                             <ShieldCheck className="w-3 h-3 text-blue-200" />
                           ) : (
                             <User className="w-3 h-3" />
                           )}
                           <span className="text-[9px] font-black uppercase tracking-widest">
                             {m.sender === username ? 'Saya' : (m.sender === 'admin' || m.sender === '2284400' ? 'Admin' : m.sender)}
                           </span>
                        </div>
                        {m.imageUrl && (
                          <div className="mb-2 rounded-xl overflow-hidden border border-white/20">
                            <img 
                              src={m.imageUrl} 
                              alt="Sent content" 
                              className="max-w-full max-h-80 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(m.imageUrl, '_blank')}
                            />
                          </div>
                        )}
                        {m.content && <p className="text-sm font-medium leading-relaxed">{m.content}</p>}
                        <div className={`text-[8px] font-black mt-2 text-right opacity-50 flex items-center justify-end gap-1 ${m.sender === username || m.sender === 'admin' || m.sender === '2284400' ? 'text-white' : 'text-gray-400'}`}>
                           <Clock className="w-2 h-2" />
                           {(() => {
                              const date = safeParseDate(m.timestamp);
                              return isNaN(date.getTime()) || date.getTime() === 0 
                                ? m.timestamp 
                                : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                           })()}
                        </div>
                     </div>
                  </motion.div>
               ))
            )}
            <div ref={messagesEndRef} />
         </div>

         <form onSubmit={handleSendMessage} className="p-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center gap-2">
               <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tulis pesan Anda..."
                    className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 pl-6 pr-14 focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900 shadow-sm"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() && !isUploading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                  >
                     <Send className="w-4.5 h-4.5" />
                  </button>
               </div>
               
               <input 
                 type="file" 
                 ref={fileInputRef}
                 onChange={handleImageUpload}
                 accept="image/*"
                 className="hidden"
               />
               
               <button 
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 disabled={isUploading}
                 className="w-14 h-14 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-500/20 transition-all shadow-sm disabled:opacity-50"
               >
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <ImageIcon className="w-6 h-6" />}
               </button>
            </div>
         </form>
      </div>
      <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">KAMI BIASANYA MEMBALAS DALAM BEBERAPA MENIT</p>
    </div>
  );
};

export default CustomerService;
