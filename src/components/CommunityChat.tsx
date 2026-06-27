import React, { useState, useEffect, useRef } from 'react';
import { Users, Send, User, ShieldCheck, Clock, X, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { Message } from '@/types';
import { ApiService, safeParseDate } from '@/services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage, uploadToFirebaseStorage } from '@/lib/imageUtils';

interface CommunityChatProps {
  username: string;
  onBack: () => void;
  isAdmin?: boolean;
}

const CommunityChat: React.FC<CommunityChatProps> = ({ username, onBack, isAdmin }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (isAdmin) {
        setUserCreatedAt('2000-01-01T00:00:00.000Z'); // Admin sees everything
        return;
      }
      try {
        const user = await ApiService.getUser(username);
        if (user && user.createdAt) {
          setUserCreatedAt(user.createdAt);
        } else {
          // If no createdAt, assume they can see messages from now on
          const now = new Date().toISOString();
          setUserCreatedAt(now);
        }
      } catch (err) {
        console.error("Error fetching user for chat filter:", err);
      }
    };
    fetchUser();
  }, [username, isAdmin]);

  useEffect(() => {
    if (!userCreatedAt) return;

    const unsubscribe = ApiService.listenToMessages(username, isAdmin || false, (allMessages) => {
      const userJoinTime = new Date(userCreatedAt).getTime();
      
      // Filter for community messages, sort by time, and filter by join time
      const communityMsgs = allMessages
        .filter(m => {
           if (m.recipient !== 'community') return false;
           // New users don't see messages from before they joined
           return new Date(m.timestamp).getTime() >= userJoinTime;
        })
        .sort((a, b) => {
           const timeA = safeParseDate(a.timestamp).getTime();
           const timeB = safeParseDate(b.timestamp).getTime();
           return timeA - timeB;
        });
      setMessages(communityMsgs);
    }, 'community');

    return () => unsubscribe();
  }, [username, userCreatedAt, isAdmin]);

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !imageUrl) return;

    const message: Message = {
      id: Math.random().toString(36).substr(2, 9),
      sender: username,
      senderUid: username,
      recipient: 'community',
      content: newMessage,
      imageUrl: imageUrl,
      timestamp: new Date().toISOString(),
      read: true // Community messages are auto-read usually
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
        const storageUrl = await uploadToFirebaseStorage(compressed, 'community-chats');
        await handleSendMessage(undefined, storageUrl);
      } catch (error) {
        console.error("Compression/Upload error:", error);
        alert("Gagal memproses atau mengunggah gambar.");
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

   const handleDeleteMessage = async (messageId: string) => {
    if (confirm("Hapus pesan ini untuk semua?")) {
      // Optimistic update
      setMessages(prev => prev.filter(m => m.id !== messageId));
      await ApiService.deleteMessage(messageId);
    }
  };

  const handleClearAllMessages = async () => {
    if (confirm("Hapus SEMUA pesan di komunitas? Tindakan ini tidak bisa dibatalkan.")) {
      // Optimistic update
      setMessages([]);
      await ApiService.clearCommunityChat();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[600px] border border-gray-100"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-6 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm shadow-inner">
               <Users className="w-6 h-6 text-white" />
            </div>
            <div>
               <h2 className="text-white font-black uppercase tracking-tight">Obrolan Komunitas</h2>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <p className="text-orange-100 text-[10px] font-black uppercase tracking-widest">Grup Terbuka</p>
               </div>
            </div>
         </div>
         <div className="flex items-center gap-2">
           {isAdmin && (
             <button 
               onClick={handleClearAllMessages}
               className="bg-white/10 hover:bg-red-500/20 p-3 rounded-2xl text-white transition-all active:scale-95 border border-white/5 shadow-sm group"
               title="Kosongkan Obrolan"
             >
                <Trash2 className="w-5 h-5 group-hover:text-red-200 transition-colors" />
             </button>
           )}
           <button 
             onClick={onBack}
             className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-white transition-all active:scale-95 border border-white/5 shadow-sm"
           >
              <X className="w-5 h-5" />
           </button>
         </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
         {messages.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                 <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-gray-500">Belum ada obrolan komunitas</p>
              <p className="text-xs font-bold text-gray-400 mt-1">Jadilah yang pertama mengirim pesan!</p>
           </div>
         ) : (
           messages.map((m) => (
             <div 
               key={m.id} 
               className={`flex flex-col group relative ${m.sender === username ? 'items-end' : 'items-start'}`}
             >
                <div className={`max-w-[85%] px-5 py-4 rounded-[1.5rem] shadow-sm relative ${
                  m.sender === username 
                    ? 'bg-orange-600 text-white rounded-tr-none' 
                    : (m.sender === 'admin' || m.sender === '2284400')
                      ? 'bg-indigo-600 text-white rounded-tl-none'
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                }`}>
                   {(m.sender === username || isAdmin) && (
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
                        <ShieldCheck className="w-3 h-3" />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {m.sender === username ? 'Saya' : (m.sender === 'admin' || m.sender === '2284400' ? 'Admin' : m.sender)}
                      </span>
                   </div>

                   {m.imageUrl && (
                     <div className="mb-2 rounded-xl overflow-hidden border border-white/20 bg-black/5">
                       <img 
                         src={m.imageUrl} 
                         alt="Community content" 
                         className="max-w-full max-h-80 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                         onClick={() => window.open(m.imageUrl, '_blank')}
                       />
                     </div>
                   )}
                   {m.content && <p className="text-sm font-medium leading-relaxed">{m.content}</p>}
                   
                   <div className={`text-[8px] font-black mt-2 text-right opacity-50 flex items-center justify-end gap-1 ${
                     m.sender === username || m.sender === 'admin' || m.sender === '2284400' ? 'text-white' : 'text-gray-400'
                   }`}>
                      <Clock className="w-2 h-2" />
                      {(() => {
                        const date = safeParseDate(m.timestamp);
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      })()}
                   </div>
                </div>
             </div>
           ))
         )}
         <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100">
         <div className="flex items-center gap-2">
            <div className="relative flex-1">
               <input 
                 type="text" 
                 value={newMessage}
                 onChange={(e) => setNewMessage(e.target.value)}
                 placeholder="Bagikan ke komunitas..."
                 className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-4 pl-6 pr-14 focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none font-bold text-gray-900"
               />
               <button 
                 type="submit"
                 disabled={!newMessage.trim() && !isUploading}
                 className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50"
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
              className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-orange-600 border-2 border-transparent hover:border-orange-100 transition-all disabled:opacity-50"
            >
               {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-orange-600" /> : <ImageIcon className="w-6 h-6" />}
            </button>
         </div>
      </form>
    </motion.div>
  );
};

export default CommunityChat;
