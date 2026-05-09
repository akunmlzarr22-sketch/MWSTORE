import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, User, ShieldCheck, Clock, X } from 'lucide-react';
import { Message } from '@/types';
import { ApiService, safeParseDate } from '@/services/apiService';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerServiceProps {
  username: string;
  onBack: () => void;
}

const CustomerService: React.FC<CustomerServiceProps> = ({ username, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const unsub = ApiService.listenToMessages(username, false, (fetchedMessages) => {
      // Sort oldest first for chat view
      const sorted = [...fetchedMessages].sort((a, b) => {
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
    });

    return () => unsub();
  }, [username]);

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Math.random().toString(36).substr(2, 9),
      sender: username,
      senderUid: username,
      recipient: 'admin',
      content: newMessage,
      timestamp: new Date().toISOString(),
      read: false
    };

    ApiService.sendMessage(message, username);
    setNewMessage('');
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
        <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-600">
           <X className="w-6 h-6" />
        </button>
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
                     <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                        m.sender === username 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-gray-50 text-gray-900 rounded-tl-none border border-gray-100'
                     }`}>
                        <div className="flex items-center gap-2 mb-1 opacity-60">
                           {m.sender === 'admin' ? (
                             <ShieldCheck className="w-3 h-3 text-blue-500" />
                           ) : (
                             <User className="w-3 h-3" />
                           )}
                           <span className="text-[9px] font-black uppercase tracking-widest">{m.sender}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{m.content}</p>
                        <div className={`text-[8px] font-black mt-2 text-right opacity-50 flex items-center justify-end gap-1 ${m.sender === username ? 'text-white' : 'text-gray-400'}`}>
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
            <div className="relative">
               <input 
                 type="text" 
                 value={newMessage}
                 onChange={(e) => setNewMessage(e.target.value)}
                 placeholder="Tulis pesan Anda..."
                 className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 pl-6 pr-14 focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-gray-900 shadow-sm"
               />
               <button 
                 type="submit"
                 disabled={!newMessage.trim()}
                 className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
               >
                  <Send className="w-4.5 h-4.5" />
               </button>
            </div>
         </form>
      </div>
      <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">KAMI BIASANYA MEMBALAS DALAM BEBERAPA MENIT</p>
    </div>
  );
};

export default CustomerService;
