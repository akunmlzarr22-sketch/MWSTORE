
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { getAiRecommendation } from '@/services/geminiService';
import { MOCK_PRODUCTS } from '@/constants';

const AiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'bot' | 'user', content: string}[]>([
    { role: 'bot', content: 'Halo! Saya asisten pintar MWSTORE. Ada yang bisa saya bantu cari hari ini?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    const response = await getAiRecommendation(userMsg, MOCK_PRODUCTS);
    
    setMessages(prev => [...prev, { role: 'bot', content: response || 'Maaf, saya tidak mengerti.' }]);
    setIsLoading(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all z-50 hover:scale-110 active:scale-95"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] bg-white rounded-3xl shadow-2xl z-50 flex flex-col border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">Asisten MWSTORE</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-blue-600" /> : <Bot className="w-4 h-4 text-gray-600" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 items-center text-gray-400 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  Sedang berpikir...
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t">
            <div className="flex gap-2">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Tanya sesuatu..."
                className="flex-1 bg-gray-100 border-none focus:ring-2 focus:ring-blue-500 rounded-xl px-4 py-2 text-sm outline-none"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiAssistant;
