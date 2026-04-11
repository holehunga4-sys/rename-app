import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquareOff, MessageSquare } from 'lucide-react';
import { MascotState } from '../lib/mascot';

const PHRASES = {
  idle: [
    "Ê sếp, uống miếng nước đi cho đỡ khô họng. 💧",
    "Ngồi lâu đau lưng đó, đứng lên vươn vai cái coi! 🧘‍♂️",
    "Mắt chớp chớp đi sếp, nhìn màn hình quài lòi con mắt giờ. 👀",
    "Ê, nay có tập thể dục chưa đó? 🏃‍♂️",
    "Ngựa em đứng mỏi chân quá, sếp có task gì quăng lẹ đi. 🐴",
    "Thở sâu vào... 😮‍💨 thở ra... rồi làm tiếp.",
    "Làm việc hăng say, vận may sẽ đến! (Chắc vậy) 🍀",
    "Sếp ơi, đừng quên chớp mắt nha. ✨"
  ],
  special: [
    "🤫 Đừng cho thằng Đít Bự nó thấy source code nha sếp!",
    "Đứng dậy thể dục đi sếp, tiện tay vả mông thằng Đít Bự một cái! 🍑👋"
  ],
  click: [
    "Á à, chọt em hả? Chờ xíu em phi ngay. 🐎💨",
    "Đã nhận lệnh! Ngựa em đang lên số. 🚀",
    "Ok sếp, để em trổ tài cho xem. 😎",
    "Đang phi nước đại đây, từ từ! 🏇"
  ],
  spam: [
    "Á á á! Chọt gì chọt quài vậy cha nội! 😵‍💫",
    "Ê ê, hỏng chuột bây giờ! Em đang làm mà! 🖱️🔥",
    "Sếp bị lag hả? Bấm 1 lần thôi! 🛑",
    "Bấm nữa em đình công luôn á nha! 😤"
  ],
  loading: [
    "Đang hì hục cày cuốc đây... ⛏️",
    "Chờ xíu, mạng đang đi bộ... 🐢",
    "Đang vắt chân lên cổ chạy đây sếp! 💦",
    "Bình tĩnh, ngựa em đang load... ⏳"
  ],
  success: [
    "Xong! Quá đỉnh, quá xuất sắc! 🎉",
    "Ngon lành cành đào! 🍑✨",
    "Dễ như ăn kẹo! Còn gì nữa không sếp? 🍬",
    "Đã hoàn thành nhiệm vụ xuất sắc! 🏆"
  ],
  error: [
    "Toang! Vấp cục đá té rồi sếp ơi. 🪨🐴",
    "Lỗi mẹ nó rồi, sếp check lại coi. 🐛",
    "Khoan, hình như có gì đó sai sai... 🤔",
    "Cứu cứu, ngựa em bị kẹt bug rồi! 🆘"
  ]
};

export const HorseMascotAssistant = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [state, setState] = useState<MascotState>('idle');
  const [message, setMessage] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);

  useEffect(() => {
    const handleMascotAction = (e: CustomEvent<MascotState>) => {
      const newState = e.detail;
      
      // Don't override loading/success/error with a simple click
      if (newState === 'click' && ['loading', 'success', 'error', 'spam'].includes(state)) {
        return;
      }

      setState(newState);
      
      if (newState !== 'idle' && !isMuted) {
        const phrases = PHRASES[newState as keyof typeof PHRASES];
        if (phrases) {
          const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
          setMessage(randomPhrase);
          setShowBubble(true);
          
          if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
          bubbleTimeoutRef.current = setTimeout(() => {
            setShowBubble(false);
          }, 4000);
        }
      }

      // Reset back to idle after a while if it's a temporary state
      if (['click', 'spam', 'success', 'error'].includes(newState)) {
        if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current);
        stateTimeoutRef.current = setTimeout(() => {
          setState('idle');
        }, 5000);
      }
    };

    window.addEventListener('mascot-action', handleMascotAction as EventListener);
    return () => {
      window.removeEventListener('mascot-action', handleMascotAction as EventListener);
    };
  }, [isMuted, state]);

  const stateRef = useRef<MascotState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Random idle chatter
  useEffect(() => {
    if (state !== 'idle' || isMuted || !isVisible) return;

    const chatterInterval = setInterval(() => {
      // 30% chance to say something every 15 seconds when idle
      if (Math.random() < 0.3) {
        const phrases = PHRASES.idle;
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        setMessage(randomPhrase);
        setShowBubble(true);
        
        if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
        bubbleTimeoutRef.current = setTimeout(() => {
          setShowBubble(false);
        }, 5000);
      }
    }, 15000);

    return () => clearInterval(chatterInterval);
  }, [state, isMuted, isVisible]);

  // Random special chatter (5-10 minutes)
  useEffect(() => {
    if (isMuted || !isVisible) return;

    let specialTimeout: NodeJS.Timeout;

    const scheduleNextSpecial = () => {
      // Random time between 5 and 10 minutes (300,000 to 600,000 ms)
      const nextDelay = Math.floor(Math.random() * (600000 - 300000 + 1) + 300000);
      
      specialTimeout = setTimeout(() => {
        if (stateRef.current === 'idle') {
          const phrases = PHRASES.special;
          const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
          setMessage(randomPhrase);
          setShowBubble(true);
          
          if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
          bubbleTimeoutRef.current = setTimeout(() => {
            setShowBubble(false);
          }, 6000);
        }
        scheduleNextSpecial();
      }, nextDelay);
    };

    scheduleNextSpecial();

    return () => clearTimeout(specialTimeout);
  }, [isMuted, isVisible]);

  // Global click listener for generic clicks and spam detection
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only react to buttons or interactive elements
      if (target.closest('button') || target.closest('a') || target.closest('input[type="checkbox"]')) {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 400) {
          clickCountRef.current += 1;
        } else {
          clickCountRef.current = 1;
        }
        lastClickTimeRef.current = now;

        if (clickCountRef.current > 3) {
          window.dispatchEvent(new CustomEvent('mascot-action', { detail: 'spam' }));
          clickCountRef.current = 0; // reset after spam trigger
        } else if (state === 'idle') {
          // Trigger generic click if we are idle
          window.dispatchEvent(new CustomEvent('mascot-action', { detail: 'click' }));
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [state]);

  if (!isVisible) return null;

  // Animation variants
  const horseVariants = {
    idle: {
      y: [0, -5, 0],
      rotate: [0, 2, -2, 0],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    },
    loading: {
      y: [0, -10, 0],
      transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
    },
    success: {
      y: [0, -20, 0],
      rotate: [0, -10, 10, 0],
      transition: { duration: 0.6, ease: "easeOut" }
    },
    error: {
      x: [0, -5, 5, -5, 5, 0],
      transition: { duration: 0.5 }
    },
    spam: {
      scale: [1, 1.1, 1],
      rotate: [0, -5, 5, -5, 0],
      transition: { duration: 0.3, repeat: 3 }
    },
    click: {
      y: [0, -10, 0],
      transition: { duration: 0.3 }
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-end pointer-events-none">
      {/* Speech Bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-full right-16 mb-2 w-48 bg-white rounded-2xl rounded-br-none p-3 shadow-xl border border-slate-100 pointer-events-auto"
          >
            <p className="text-sm text-slate-700 font-medium">{message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mascot Container */}
      <div className="relative pointer-events-auto group">
        {/* Controls */}
        <div className="absolute -top-8 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 bg-white rounded-full shadow-md text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            title={isMuted ? "Bật tiếng" : "Tắt tiếng"}
          >
            {isMuted ? <MessageSquareOff size={14} /> : <MessageSquare size={14} />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1.5 bg-white rounded-full shadow-md text-slate-500 hover:text-red-500 hover:bg-slate-50"
            title="Ẩn linh vật"
          >
            <X size={14} />
          </button>
        </div>

        {/* The Horse */}
        <motion.div
          variants={horseVariants}
          animate={state}
          className="cursor-pointer"
          onClick={() => {
            // Poke the horse
            window.dispatchEvent(new CustomEvent('mascot-action', { detail: 'click' }));
          }}
        >
          <svg viewBox="0 0 100 100" className="w-32 h-32 drop-shadow-2xl">
            {/* Back Mane (Fluffy) */}
            <path d="M 25 35 C 15 50, 20 85, 50 95 C 80 85, 85 50, 75 35 C 85 15, 60 5, 50 15 C 40 5, 15 15, 25 35 Z" fill="#10b981" opacity="0.8"/>
            
            {/* Ears (Soft & Rounded) */}
            <path d="M 35 35 C 20 10, 5 25, 25 45 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2"/>
            <path d="M 32 32 C 22 18, 15 28, 26 40 Z" fill="#fbcfe8" />
            
            <path d="M 65 35 C 80 10, 95 25, 75 45 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2"/>
            <path d="M 68 32 C 78 18, 85 28, 74 40 Z" fill="#fbcfe8" />

            {/* Head Base (Big & Round) */}
            <path d="M 20 55 C 20 25, 80 25, 80 55 C 80 85, 65 95, 50 95 C 35 95, 20 85, 20 55 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2"/>
            
            {/* Front Bangs */}
            <path d="M 35 25 C 45 10, 65 15, 70 35 C 60 20, 45 20, 35 25 Z" fill="#059669"/>
            <path d="M 40 30 C 50 15, 60 20, 65 35 C 55 25, 45 25, 40 30 Z" fill="#10b981"/>

            {/* Snout (Small & Cute) */}
            <path d="M 30 65 C 30 55, 70 55, 70 65 C 70 80, 30 80, 30 65 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2"/>
            
            {/* Blush */}
            <circle cx="28" cy="60" r="5" fill="#fecdd3" opacity="0.7" />
            <circle cx="72" cy="60" r="5" fill="#fecdd3" opacity="0.7" />

            {/* Facial Features based on state */}
            {state === 'error' ? (
              <>
                {/* Dizzy Eyes */}
                <path d="M 32 45 L 42 55 M 42 45 L 32 55" stroke="#334155" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M 58 45 L 68 55 M 68 45 L 58 55" stroke="#334155" strokeWidth="2.5" strokeLinecap="round"/>
                {/* Sad Mouth */}
                <path d="M 42 78 Q 50 73 58 78" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none"/>
                {/* Nostrils */}
                <circle cx="42" cy="68" r="1.5" fill="#94a3b8" />
                <circle cx="58" cy="68" r="1.5" fill="#94a3b8" />
              </>
            ) : state === 'success' ? (
              <>
                {/* Happy Eyes */}
                <path d="M 32 52 Q 37 45 42 52" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M 58 52 Q 63 45 68 52" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                {/* Big Smile */}
                <path d="M 42 75 Q 50 85 58 75" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <path d="M 47 78 Q 50 85 53 78" fill="#fca5a5" />
                {/* Nostrils */}
                <circle cx="42" cy="66" r="1.5" fill="#94a3b8" />
                <circle cx="58" cy="66" r="1.5" fill="#94a3b8" />
                {/* Sparkles */}
                <path d="M 10 30 L 15 20 L 20 30 L 30 35 L 20 40 L 15 50 L 10 40 L 0 35 Z" fill="#fbbf24" />
                <path d="M 85 20 L 88 15 L 91 20 L 96 23 L 91 26 L 88 31 L 85 26 L 80 23 Z" fill="#fcd34d" />
              </>
            ) : state === 'loading' ? (
              <>
                {/* Big Eyes looking up */}
                <circle cx="37" cy="50" r="6" fill="#334155" />
                <circle cx="63" cy="50" r="6" fill="#334155" />
                <circle cx="39" cy="48" r="2" fill="#ffffff" />
                <circle cx="65" cy="48" r="2" fill="#ffffff" />
                {/* Neutral Mouth */}
                <path d="M 45 78 L 55 78" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none"/>
                {/* Nostrils */}
                <circle cx="42" cy="68" r="1.5" fill="#94a3b8" />
                <circle cx="58" cy="68" r="1.5" fill="#94a3b8" />
                {/* Sweat drop */}
                <path d="M 80 45 Q 85 55 80 60 Q 75 55 80 45 Z" fill="#bae6fd" />
              </>
            ) : state === 'spam' ? (
              <>
                {/* Angry Eyes */}
                <path d="M 32 45 L 42 50" stroke="#334155" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="37" cy="52" r="4" fill="#334155" />
                <path d="M 68 45 L 58 50" stroke="#334155" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="63" cy="52" r="4" fill="#334155" />
                {/* Angry Mouth */}
                <path d="M 45 80 Q 50 75 55 80" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none"/>
                {/* Nostrils */}
                <circle cx="42" cy="68" r="1.5" fill="#94a3b8" />
                <circle cx="58" cy="68" r="1.5" fill="#94a3b8" />
                {/* Angry mark */}
                <path d="M 75 25 L 85 35 M 85 25 L 75 35" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
              </>
            ) : (
              // Idle / Click
              <>
                {/* Big Cute Eyes */}
                <circle cx="37" cy="50" r="7" fill="#334155" />
                <circle cx="63" cy="50" r="7" fill="#334155" />
                {/* Eye Sparkles */}
                <circle cx="35" cy="48" r="2.5" fill="#ffffff" />
                <circle cx="40" cy="52" r="1" fill="#ffffff" />
                <circle cx="61" cy="48" r="2.5" fill="#ffffff" />
                <circle cx="66" cy="52" r="1" fill="#ffffff" />
                {/* Cute Smile */}
                <path d="M 45 75 Q 50 80 55 75" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none"/>
                {/* Nostrils */}
                <circle cx="42" cy="66" r="1.5" fill="#94a3b8" />
                <circle cx="58" cy="66" r="1.5" fill="#94a3b8" />
              </>
            )}
          </svg>
        </motion.div>
      </div>
    </div>
  );
};
