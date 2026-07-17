import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, ChevronDown } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ErnstChatProps {
  agentName?: string;
}

// ── Custom Ernst AI avatar ────────────────────────────────────────────────────
function ErnstAvatar({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ernst-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0A3D91" />
        </linearGradient>
        <linearGradient id="ernst-glow" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Background circle */}
      <circle cx="20" cy="20" r="20" fill="url(#ernst-bg)" />
      {/* Inner glow ring */}
      <circle cx="20" cy="20" r="17" stroke="url(#ernst-glow)" strokeWidth="1.5" fill="none" />
      {/* Brain / circuit nodes */}
      {/* Central core */}
      <circle cx="20" cy="20" r="4.5" fill="#93c5fd" opacity="0.9" />
      <circle cx="20" cy="20" r="2.5" fill="white" />
      {/* Orbital dots with connecting lines */}
      {/* Top */}
      <line x1="20" y1="15.5" x2="20" y2="11" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="20" cy="9.5" r="2" fill="#60a5fa" />
      {/* Top-right */}
      <line x1="23.2" y1="17" x2="27" y2="13.5" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="28.5" cy="12.5" r="1.8" fill="#93c5fd" />
      {/* Right */}
      <line x1="24.5" y1="20" x2="29" y2="20" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="30.5" cy="20" r="2" fill="#60a5fa" />
      {/* Bottom-right */}
      <line x1="23.2" y1="23" x2="27" y2="26.5" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="28.5" cy="27.5" r="1.8" fill="#93c5fd" />
      {/* Bottom */}
      <line x1="20" y1="24.5" x2="20" y2="29" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="20" cy="30.5" r="2" fill="#60a5fa" />
      {/* Bottom-left */}
      <line x1="16.8" y1="23" x2="13" y2="26.5" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="11.5" cy="27.5" r="1.8" fill="#93c5fd" />
      {/* Left */}
      <line x1="15.5" y1="20" x2="11" y2="20" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="9.5" cy="20" r="2" fill="#60a5fa" />
      {/* Top-left */}
      <line x1="16.8" y1="17" x2="13" y2="13.5" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="11.5" cy="12.5" r="1.8" fill="#93c5fd" />
    </svg>
  );
}

// ── Small inline avatar for messages ─────────────────────────────────────────
function ErnstAvatarSmall() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 mt-0.5 mr-2"
    >
      <defs>
        <linearGradient id="ernst-bg-sm" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0A3D91" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#ernst-bg-sm)" />
      <circle cx="20" cy="20" r="4.5" fill="#93c5fd" opacity="0.9" />
      <circle cx="20" cy="20" r="2.5" fill="white" />
      <line x1="20" y1="15.5" x2="20" y2="11" stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.8" />
      <circle cx="20" cy="9.5" r="2" fill="#60a5fa" />
      <line x1="23.2" y1="17" x2="27" y2="13.5" stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.8" />
      <circle cx="28.5" cy="12.5" r="1.8" fill="#93c5fd" />
      <line x1="24.5" y1="20" x2="29" y2="20" stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.8" />
      <circle cx="30.5" cy="20" r="2" fill="#60a5fa" />
      <line x1="16.8" y1="17" x2="13" y2="13.5" stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.8" />
      <circle cx="11.5" cy="12.5" r="1.8" fill="#93c5fd" />
      <line x1="15.5" y1="20" x2="11" y2="20" stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.8" />
      <circle cx="9.5" cy="20" r="2" fill="#60a5fa" />
    </svg>
  );
}

function formatMessage(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-blue-50 text-blue-700 rounded px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

export default function ErnstChat({ agentName }: ErnstChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Bonjour${agentName ? ` **${agentName}**` : ''} ! Je suis **Ernst**, votre assistant IA. Je suis là pour vous aider dans vos opérations — dépôts, retraits, gestion clients, commissions. Que puis-je faire pour vous ?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // apiFetch already parses and returns the JSON body directly
      const data = await apiFetch<{ reply: string }>('/api/agent/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      }, 30_000);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || "Je n'ai pas pu générer une réponse. Réessayez.",
      }]);
    } catch (err: any) {
      setError(err?.message || 'Erreur inattendue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* ── Floating button ── */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-24 right-4 z-[300] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center"
        style={{ filter: 'drop-shadow(0 4px 16px rgba(10,61,145,0.45))' }}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.08 }}
        aria-label="Assistant Ernst"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0A3D91 100%)' }}
            >
              <ChevronDown className="h-6 w-6 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="avatar"
              initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18 }}
            >
              <ErnstAvatar size={56} />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Online dot */}
        {!open && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow" />
        )}
      </motion.button>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="ernst-panel"
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="fixed bottom-44 right-4 z-[299] w-[calc(100vw-2rem)] max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            style={{ maxHeight: '72vh', boxShadow: '0 24px 64px rgba(10,61,145,0.25), 0 4px 16px rgba(0,0,0,0.12)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3.5 shrink-0"
              style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0A3D91 100%)' }}
            >
              <div className="flex items-center gap-3">
                <ErnstAvatar size={40} />
                <div>
                  <p className="text-white font-black text-[15px] leading-tight tracking-tight">Ernst</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <p className="text-blue-200 text-[10px] font-semibold tracking-wide uppercase">Assistant IA · Actif</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#f0f4ff' }}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-start'}`}
                >
                  {msg.role === 'assistant' && <ErnstAvatarSmall />}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-sm shadow-md'
                        : 'text-gray-800 bg-white rounded-bl-sm shadow-sm border border-blue-100/60'
                    }`}
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, #1d4ed8, #0A3D91)' }
                        : {}
                    }
                  >
                    {msg.role === 'assistant'
                      ? msg.content.split('\n').map((line, li) => (
                          <span key={li}>{li > 0 && <br />}{formatMessage(line)}</span>
                        ))
                      : msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start items-start"
                >
                  <ErnstAvatarSmall />
                  <div className="bg-white border border-blue-100/60 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 150, 300].map(delay => (
                      <span
                        key={delay}
                        className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Error banner */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"
                >
                  <span className="text-red-500 text-lg shrink-0">⚠</span>
                  <p className="text-red-600 text-xs flex-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div
              className="px-3 py-3 shrink-0 border-t border-white/10"
              style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0A3D91 100%)' }}
            >
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/20">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Posez votre question…"
                  className="flex-1 bg-transparent text-white placeholder-white/50 text-sm outline-none"
                  disabled={loading}
                  maxLength={500}
                />
                <motion.button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.25)' }}
                  whileTap={{ scale: 0.88 }}
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                    : <Send className="h-4 w-4 text-white" />
                  }
                </motion.button>
              </div>
              <p className="text-center text-white/30 text-[10px] mt-1.5 tracking-wide">Ernst · Propulsé par Groq AI</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
