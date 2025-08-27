// components/VoiceAssistant.jsx
'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, MessageCircle, Bot, User, Download, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { downloadTranscript } from '@/utils/transcript'
import { Conversation } from '@elevenlabs/client'
import getConfig from 'next/config'
import { getSignedUrl } from '@/app/actions/getSignedUrl'
import { useConversation } from '@elevenlabs/react'

const { publicRuntimeConfig } = getConfig?.() || {}

const AGENT_IDS = {
  moeldi: process.env.NEXT_PUBLIC_AGENT_ID_MOELDI,
}

let recognitionGlobal = null // global fallback for SpeechRecognition

// --- Konstanten für Kontakt-Links ---
const MAIL_URL = "mailto:azubianfragen@moelders.de?subject=Anfrage%20Azubiberatung";

export default function VoiceAssistant() {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [isActive, setIsActive] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [inputValue, setInputValue] = useState("")
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [pendingAgentMessage, setPendingAgentMessage] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('moeldi') // 'moeldi'
  const scrollAreaRef = useRef(null)
  const recognitionRef = useRef(null)

  // State für Audio-Feedback-Animation
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [signedUrl, setSignedUrl] = useState(null)
  const [conversationId, setConversationId] = useState(null) // State für conversationId
  const [isMuted, setIsMuted] = useState(false) // State für Mikrofon-Stummschaltung
  const micStreamRef = useRef(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Animation für nacheinander fade-in/fade-out Text, Endlosschleife
  const conversationButtonTexts = [
    'Gespräch läuft',
    'Nenn mir deine Ideen und Anregungen',
    'Zum Beenden klicken'
  ]
  const [conversationTextIndex, setConversationTextIndex] = useState(0)

  useEffect(() => {
    if (!isActive) {
      setConversationTextIndex(0)
      return
    }
    // Endlosschleife: alle 2.5s zum nächsten Text, dann wieder von vorne
    const t = setTimeout(() => {
      setConversationTextIndex(i => (i + 1) % conversationButtonTexts.length)
    }, 2500)
    return () => clearTimeout(t)
  }, [isActive, conversationTextIndex])

  // ElevenLabs Conversation Hook für Multimodalität
  const {
    startSession,
    endSession,
    sendUserMessage,
    sendUserActivity,
    status,
    isSpeaking,
    canSendFeedback,
    setVolume,
    muteMic,
    muteTTS,
    unmuteTTS,
  } = useConversation({
    agentId: AGENT_IDS[selectedAgent],
    onMessage: (message) => {
      setMessages((prev) => {
        // Streaming: Wenn Agent, hänge an letzte Agenten-Nachricht an
        // Streaming: Wenn Agent, hänge an letzte Agenten-Nachricht an
        if (message.source === 'agent') {
          if (prev.length > 0 && prev[prev.length-1].source === 'agent' && pendingAgentMessage) {
            // Stream: Update letzte Agenten-Nachricht
            const updated = [...prev]
            updated[updated.length-1].message += message.message
            return updated
          } else {
            // Neue Agenten-Nachricht
            return [...prev, { source: message.source, message: message.message }]
          }
        }
        // User-Nachricht wie gehabt
        return [...prev, { source: message.source, message: message.message }]
      })
      if (message.source !== 'user') setPendingAgentMessage(true)
    },
    onError: (error) => {
      alert('Agentenfehler: ' + error.message)
      setConnectionStatus('disconnected')
    },
    onStatusChange: (s) => setConnectionStatus(s),
    onModeChange: (mode) => {
      if (mode === 'speaking') {
        setPendingAgentMessage(true)
      }
    },
    tts: true, // TTS immer aktiv
  })

  // SpeechRecognition initialisieren (nur einmal beim Mount)
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'de-DE'
      recognitionRef.current = recognition
      recognitionGlobal = recognition
    }
  }, [])

  // Hilfsfunktion: Prüfen, ob Recognition läuft
  const isRecognitionActive = () => {
    return recognitionRef.current && recognitionRef.current._isStarted
  }

  // SpeechRecognition erzeugen (nur einmal pro Gespräch)
  const createRecognition = () => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'de-DE'
      recognitionRef.current = recognition
      recognitionGlobal = recognition
    }
  }

  // Mikrofon starten/stoppen (Instanz bleibt erhalten)
  const startMic = () => {
    if (recognitionRef.current && !isMuted) {
      try { recognitionRef.current.start() } catch (e) {}
    }
  }
  const stopMic = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
      try { recognitionRef.current.abort() } catch (e) {}
    }
  }

  // Mikrofon-Stream holen und verwalten
  useEffect(() => {
    if (!isActive) {
      // Gespräch beendet: Stream freigeben
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop())
        micStreamRef.current = null
      }
      return
    }
    // Nur holen, wenn noch kein Stream existiert
    if (!micStreamRef.current) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          micStreamRef.current = stream
          stream.getAudioTracks().forEach(track => { track.enabled = !isMuted }) // <-- Mute-Logik direkt anwenden
        })
        .catch(() => { micStreamRef.current = null })
    } else {
      // Immer Mute-Logik anwenden, falls sich isMuted geändert hat
      micStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !isMuted })
    }
  }, [isActive, isMuted]) // <-- isMuted als Dependency

  // Immer nach jedem neuen Stream und nach jeder Chat-Interaktion Mute-Logik anwenden
  useEffect(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !isMuted })
    }
  }, [micStreamRef.current, isMuted])

  // Mikrofon wirklich muten/unmuten (OS/Browser-Level, robust)
  useEffect(() => {
    if (!isActive || !micStreamRef.current) return
    micStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !isMuted
    })
  }, [isMuted, isActive])

  // Mikrofon-Mute-Logik: Wenn isMuted sich ändert, stoppe oder starte das Mic
  useEffect(() => {
    if (!isActive) return // Nur wenn Gespräch läuft
    if (isMuted) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) {}
        try { recognitionRef.current.abort() } catch (e) {}
      }
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.start() } catch (e) {}
      }
    }
  }, [isMuted, isActive])

  // Wenn Gespräch läuft, Instanz erzeugen und Mic starten/stoppen je nach Mute
  useEffect(() => {
    if (isActive) {
      if (!recognitionRef.current) createRecognition()
      startMic()
    } else {
      // Gespräch beendet: Instanz zerstören
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) {}
        recognitionRef.current = null
        recognitionGlobal = null
      }
    }
  }, [isActive])

  // Debug: Logge den Status der Tracks bei jedem Mute/Unmute
  useEffect(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
        console.log('MicTrack:', track.label, 'enabled:', track.enabled, 'muted:', isMuted);
      });
    }
  }, [isMuted])

  // Initialisiere Conversation
  const startConversation = useCallback(async () => {
    setConnectionStatus('connecting')
    await startSession()
    setIsActive(true)
    setConnectionStatus('connected')
  }, [startSession])

  // Beende Conversation und Recognition
  const endConversation = useCallback(async () => {
    await endSession()
    setIsActive(false)
    setConnectionStatus('disconnected')
  }, [endSession])

  // Text abschicken (an Agenten senden)
  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || status !== 'connected') return
    setMessages((prev) => [
      ...prev,
      { source: 'user', message: text },
    ])
    setInputValue('')
    setPendingAgentMessage(true)
    try {
      await sendUserMessage(text)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { source: 'agent', message: '[Fehler beim Senden: ' + (err?.message || err) + ']' },
      ])
    }
    setPendingAgentMessage(false)
  }, [inputValue, sendUserMessage, status])

  // Automatisches Scrollen zum unteren Ende des Chatverlaufs, wenn neue Nachrichten kommen
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // React State für Hinweistext
  const [showAgentSwitchHint, setShowAgentSwitchHint] = useState("")

  // Hinweis nach kurzer Zeit automatisch ausblenden
  useEffect(() => {
    if (showAgentSwitchHint) {
      const t = setTimeout(() => setShowAgentSwitchHint("") , 2600)
      return () => clearTimeout(t)
    }
  }, [showAgentSwitchHint])

  // iFrame-Erkennung
  const [isIframe, setIsIframe] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsIframe(window.self !== window.top)
    }
  }, [])

  // Audio-Feedback-Animation: Web Audio API + Canvas
  useEffect(() => {
    if (!isAudioPlaying || !audioRef.current) return
    let ctx, analyser, src, dataArray, rafId
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      analyser = ctx.createAnalyser()
      src = ctx.createMediaElementSource(audioRef.current)
      src.connect(analyser)
      analyser.connect(ctx.destination)
      analyser.fftSize = 64
      dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyserRef.current = analyser
      function draw() {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(avg)
        const canvas = canvasRef.current
        if (canvas) {
          // Korrekt quadratisch, immer an der kleineren Kante orientieren
          const size = Math.min(canvas.offsetWidth, canvas.offsetHeight)
          canvas.width = size
          canvas.height = size
          const ctx2 = canvas.getContext('2d')
          const w = size
          const h = size
          ctx2.clearRect(0, 0, w, h)
          // Mittelpunkt exakt mittig
          const cx = w/2
          const cy = h/2
          const maxR = w/2 * 0.98
          const minR = w/2 * 0.7
          const r = minR + (maxR-minR)*(avg/80)
          for (let i = 3; i >= 1; i--) {
            const factor = 1 + i*0.18 + 0.08*Math.sin(Date.now()/600 + i)
            const r2 = r * factor
            ctx2.beginPath()
            ctx2.arc(cx, cy, r2, 0, 2*Math.PI)
            ctx2.closePath()
            ctx2.fillStyle = `rgba(223,36,44,${0.10/i})`
            ctx2.shadowColor = '#df242c'
            ctx2.shadowBlur = 18/i
            ctx2.fill()
          }
          // Innerster, kräftiger Glow
          const g = ctx2.createRadialGradient(cx, cy, minR*0.7, cx, cy, r)
          g.addColorStop(0, 'rgba(223,36,44,0.18)')
          g.addColorStop(0.6, 'rgba(223,36,44,0.10)')
          g.addColorStop(1, 'rgba(223,36,44,0.01)')
          ctx2.beginPath()
          ctx2.arc(cx, cy, r, 0, 2*Math.PI)
          ctx2.closePath()
          ctx2.fillStyle = g
          ctx2.shadowBlur = 0
          ctx2.fill()
        }
        rafId = requestAnimationFrame(draw)
        animationFrameRef.current = rafId
      }
      draw()
    } catch(e) {}
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (ctx) ctx.close()
      analyserRef.current = null
    }
  }, [isAudioPlaying])

  // Audio-Element-Events verbinden
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => setIsAudioPlaying(true)
    const onPause = () => setIsAudioPlaying(false)
    const onEnded = () => setIsAudioPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  // Funktion zum Stummschalten/Entstummen des Mikrofons (nur SpeechRecognition, keine SDK muteMic)
  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => !prev)
  }, [])

  // --- Hilfskomponente für Aktionsbuttons (E-Mail) ---
  function ActionButtons({ size = 'sm' }) {
    // Nur E-Mail Button, volle Breite wie Chatfenster-Button
    const base = 'w-full flex items-center justify-center px-4 py-2 text-sm font-normal rounded-2xl h-12 whitespace-nowrap gap-2 bg-[#ededed] text-[#252422] shadow hover:bg-[#df242c] hover:text-white text-center transition-colors';
    return (
      <a href={MAIL_URL} target="_blank" rel="noopener noreferrer"
        className={base}
        style={{lineHeight:'1.1', maxWidth: '420px'}}>
        <Mail className="w-[18px] h-[18px] mr-2" strokeWidth={1.8} />
        <span className="leading-none">E-Mail senden</span>
      </a>
    );
  }

  // --- Text-Eingabe und Senden (aktiviert) ---
  function handleInputChange(e) {
    setInputValue(e.target.value);
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    handleSend();
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-white pt-2 pb-4 px-4 relative${isIframe ? ' min-h-0 h-full' : ''}`}
         style={isIframe ? { minHeight: '100vh', height: '100vh', padding: 0 } : { paddingLeft: 16, paddingRight: 16, minHeight: '100vh', paddingTop: 8, paddingBottom: 16 }}>
      {/* --- LEUCHTTURM Hintergrundbild: Position und Styling --- */}
      <img src="/public-pics/Leuchtturm.png" alt="Leuchtturm"
        className="absolute z-0 pointer-events-none select-none opacity-10"
        style={{
          width: '40vw',
          maxWidth: '300px',
          right: '380px', // Position: noch weiter nach links
          bottom: '220px', // Position: noch weiter nach oben
          userSelect: 'none',
        }}
      />
      <div className={`w-full mx-auto flex flex-col items-center ${isIframe ? 'max-w-full' : 'max-w-sm'} relative z-10`}
           style={isIframe ? { maxWidth: '100vw' } : { maxWidth: 420, width: '100%' }}>
        {/* Begrüßungstext und Einleitung */}
        <div className="w-full flex flex-col items-center text-center mb-3 px-2">
          <h2 className="text-2xl font-semibold text-[#df242c] mb-1">Hey – Deine Idee zählt!</h2>
          <div className="w-full max-w-md">
            <p className="text-sm text-[#252422] mb-2">
              Ich bin <span className="font-bold text-[#df242c]">Möldi</span>, euer digitaler Ideenassistent bei Mölders.<br />
              Teile mit mir, was dich im Alltag nervt oder wo du Potenzial für Verbesserung siehst – ob klein oder groß.<br />
              Auf Basis deines Inputs entwickeln wir mit KI passende Lösungsansätze – schnell und konkret.<br />
              Starte jetzt das Gespräch und mach Mölders gemeinsam mit uns smarter!
            </p>
          </div>
        </div>
        {/* Agenten-Auswahl: Möldi */}
        <style jsx global>{`
          @keyframes pulse-spin-slow {
            0% { transform: rotate(0deg) scale(1); opacity: 0.18; }
            50% { transform: rotate(180deg) scale(1.08); opacity: 0.28; }
            100% { transform: rotate(360deg) scale(1); opacity: 0.18; }
          }
          @keyframes pulse-spin-rev {
            0% { transform: rotate(0deg) scale(1); opacity: 0.18; }
            50% { transform: rotate(-180deg) scale(1.08); opacity: 0.28; }
            100% { transform: rotate(-360deg) scale(1); opacity: 0.18; }
          }
          @keyframes pulse-scale {
            0% { transform: scale(1); opacity: 0.18; }
            50% { transform: scale(1.13); opacity: 0.32; }
            100% { transform: scale(1); opacity: 0.18; }
          }
          @keyframes profile-pulse {
            0% { transform: scale(1); }
            40% { transform: scale(1.045); }
            60% { transform: scale(1.06); }
            100% { transform: scale(1); }
          }
          .animate-pulse-spin-slow { animation: pulse-spin-slow 2.5s linear infinite; }
          .animate-pulse-spin-rev { animation: pulse-spin-rev 2.2s linear infinite; }
          .animate-pulse-scale { animation: pulse-scale 2.8s ease-in-out infinite; }
          .animate-profile-pulse { animation: profile-pulse 1.6s cubic-bezier(0.4,0,0.2,1) infinite; }

          /* Modern Voice Bars Animation */
          .voice-bars {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 32px;
            display: flex;
            align-items: flex-end;
            gap: 3px;
            z-index: 20;
            pointer-events: none;
          }
          .voice-bar {
            width: 6px;
            border-radius: 3px;
            background: linear-gradient(180deg, var(--bar-color1), var(--bar-color2));
            opacity: 0.85;
            animation: bar-bounce 1.1s infinite ease-in-out;
          }
          .voice-bar:nth-child(1) { --bar-color1: #ffb199; --bar-color2: #dd232d; animation-delay: 0s; }
          .voice-bar:nth-child(2) { --bar-color1: #ff6f61; --bar-color2: #dd232d; animation-delay: 0.12s; }
          .voice-bar:nth-child(3) { --bar-color1: #dd232d; --bar-color2: #ff6f61; animation-delay: 0.22s; }
          .voice-bar:nth-child(4) { --bar-color1: #ff6f61; --bar-color2: #ffb199; animation-delay: 0.32s; }
          .voice-bar:nth-child(5) { --bar-color1: #ffb199; --bar-color2: #dd232d; animation-delay: 0.42s; }
          @keyframes bar-bounce {
            0%, 100% { height: 12px; }
            20% { height: 28px; }
            40% { height: 18px; }
            60% { height: 24px; }
            80% { height: 14px; }
          }
          @keyframes marquee {
            0% { transform: translateX(50%); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee {
            animation: marquee 8s linear infinite;
          }
        `}</style>
        <div className="flex flex-col items-center gap-2 mb-8 w-full">
          <div className="flex flex-row items-center justify-center gap-8 relative">
            {/* Möldi */}
            <div className="relative flex flex-col items-center justify-center" style={{minWidth: '8rem', minHeight: '8rem'}}>
              {/* Canvas Glow Effekt */}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  aspectRatio: '1/1',
                  zIndex: 1,
                  pointerEvents: 'none',
                  borderRadius: '50%',
                  opacity: isAudioPlaying ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
                width={160}
                height={160}
                aria-hidden="true"
              />
              {/* Audio-Element (hidden, wird von SDK gesteuert) */}
              <audio ref={audioRef} style={{display:'none'}} />
              {isSpeaking && (
                <>
                  <span className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                    <span className="block w-52 h-52 rounded-full bg-gradient-to-tr from-[#df242c] via-[#ff6f61] to-[#df242c] opacity-20 animate-pulse-spin-slow blur-[4px]" style={{position:'absolute'}}></span>
                    <span className="block w-40 h-40 rounded-full bg-gradient-to-br from-[#ff6f61] via-[#df242c] to-[#ffb199] opacity-20 animate-pulse-spin-rev blur-[6px]" style={{position:'absolute'}}></span>
                    <span className="block w-32 h-32 rounded-full bg-gradient-to-br from-[#ffb199] via-[#ff6f61] to-[#df242c] opacity-30 animate-pulse-scale blur-[8px]" style={{position:'absolute'}}></span>
                  </span>
                </>
              )}
              <button
                onClick={() => {
                  if (!isActive && privacyChecked) {
                    startConversation();
                  } else {
                    setSelectedAgent('moeldi');
                  }
                }}
                className={`flex flex-col items-center focus:outline-none transition-all duration-200 relative z-10 ${privacyChecked && !isActive ? 'cursor-pointer' : 'cursor-default'}`}
                aria-label="Möldi auswählen"
                type="button"
                style={{ background: 'none', border: 'none', padding: 0 }}
                disabled={false}
              >
                <img
                  src="/public-pics/Moeldi.png"
                  alt="Möldi, Azubiberaterin"
                  className={`object-cover shadow rounded-full border-4 border-[#df242c] transition-all duration-300 relative w-44 h-44 z-10${isSpeaking ? ' animate-profile-pulse' : ''}`}
                  style={{willChange: 'transform'}}
                />
                {/* Möldi-Sticker */}
                <span
                  className="absolute left-[99%] top-6 bg-[#df242c] text-white text-sm font-semibold px-5 py-1 rounded-full shadow-lg border-2 border-white z-20"
                  style={{
                    transform: 'translate(-50%, 0)',
                    minWidth: 60,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                  }}
                >
                  Möldi
                </span>
              </button>
            </div>
          </div>
        </div>
        {/* Datenschutz-Checkbox kompakt und direkt unter den Agenten-Bildern, Abstand nach oben und unten optimiert */}
        <div className="w-full flex justify-center items-center" style={{ marginTop: '-18px', marginBottom: '18px' }}>
          <div className="flex items-center justify-center w-full max-w-[320px] mx-auto">
            <input
              id="privacy-check"
              type="checkbox"
              checked={privacyChecked}
              onChange={e => {
                setPrivacyChecked(e.target.checked);
                if (!privacyAccepted) {
                  setShowPrivacyModal(true);
                }
              }}
              className="mr-1 accent-[#df242c] cursor-pointer"
              style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px' }}
              disabled={isActive}
              tabIndex={0}
            />
            <label htmlFor="privacy-check" className="text-[11px] text-gray-700 select-none cursor-pointer" style={{lineHeight:1.1}}>
              Ich akzeptiere die <span className="underline text-[#df242c] cursor-pointer" onClick={e => {e.preventDefault(); window.open('https://www.moelders.de/datenschutz', '_blank', 'noopener,noreferrer')}}>Datenschutzrichtlinie</span>
            </label>
          </div>
        </div>
        {/* Gespräch starten Button + Status-Kreis exakt wie Chatfenster, Status-Kreis zentriert */}
        <div className='flex flex-col items-center mb-8 relative w-full max-w-[420px]'>
          <div className="w-full max-w-[420px] flex flex-row items-center justify-end relative gap-2">
            {/* Main button: always full width, no layout shift when active */}
            <div className="relative flex items-center transition-all duration-200 w-full max-w-[420px]">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={isActive ? endConversation : startConversation}
                className={`pr-4 pl-6 py-2 rounded-2xl text-base font-semibold shadow-md transition-all duration-200 focus:outline-none flex-grow flex-shrink flex items-center justify-between relative w-full`
                  + (isActive
                    ? ' border border-[#df242c] bg-[#df242c] text-white hover:bg-[#b81c24]'
                    : ' bg-[#df242c] text-white hover:bg-[#b81c24]')
                  + (!privacyChecked && !isActive ? ' opacity-50 cursor-not-allowed' : '')}
                aria-label={isActive ? 'Gespräch beenden' : 'Gespräch starten'}
                disabled={!privacyChecked && !isActive}
                type="button"
                style={{height:'48px', minWidth:0, width: '100%', maxWidth: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position:'relative'}}
              >
                <span className="w-full text-center block" style={{marginRight: '40px', overflow:'hidden', whiteSpace:'nowrap', position:'relative'}}>
                  {isActive ? (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={conversationTextIndex}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.7 }}
                        style={{ display: 'inline-block', width: '100%' }}
                      >
                        {conversationButtonTexts[conversationTextIndex]}
                      </motion.span>
                    </AnimatePresence>
                  ) : 'Gespräch mit KI-Möldi starten'}
                </span>
                {/* Status-Kreis bündig am rechten Rand, IM BUTTON, NICHT ABSOLUT! */}
                <span
                  className="flex items-center justify-center ml-auto"
                  aria-label={connectionStatus === 'connected' ? 'Verbunden' : 'Nicht verbunden'}
                  style={{height:'40px', width:'40px', display:'flex', alignItems:'center', justifyContent:'center', marginLeft: 0}}
                >
                  <span
                    className={`block w-10 h-10 rounded-full border-4 ${connectionStatus === 'connected' ? 'border-white bg-green-600' : 'border-white bg-[#ededed]'}`}
                    style={{ boxShadow: '0 0 0 2px #fff', position: 'relative', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}
                  >
                    {connectionStatus === 'connected' ? (
                      <svg viewBox="0 0 20 20" width="18" height="18" style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)'}} aria-hidden="true" focusable="false">
                        <polyline points="5,11 9,15 15,7" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 32 32" width="22" height="22" style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)'}} aria-hidden="true" focusable="false">
                        {/* Drei unterschiedlich hohe, schwarze Balken, mittig */}
                        <rect x="9" y="13" width="2.5" height="6" rx="1.2" fill="#222" />
                        <rect x="15" y="9" width="2.5" height="14" rx="1.2" fill="#222" />
                        <rect x="21" y="13" width="2.5" height="6" rx="1.2" fill="#222" />
                      </svg>
                    )}
                  </span>
                </span>
              </motion.button>
            </div>
            {/* Mute/Unmute Icon-Button: entfernt! */}
          </div>
        </div>
        {/* Datenschutz-Modal */}
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full p-5 flex flex-col items-center border border-[#eee] relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl font-bold"
                aria-label="Schließen"
                onClick={() => setShowPrivacyModal(false)}
                style={{background:'none',border:'none',padding:0,lineHeight:1}}
              >×</button>
              <div className="text-xs text-gray-800 mb-4 text-center leading-snug">
                Mit dem Klick auf <b>„Zustimmen“</b> und bei jeder weiteren Interaktion mit diesem KI-Agenten erklärst Du Dich damit einverstanden, dass Deine Kommunikation aufgezeichnet, gespeichert und mit Drittanbietern geteilt wird – wie in der <a href="https://www.moelders.de/datenschutz" target="_blank" rel="noopener noreferrer" className="underline text-[#df242c]">Datenschutzrichtlinie</a> beschrieben.<br /><br />
                Wenn Du nicht möchtest, dass Deine Gespräche aufgezeichnet werden, verzichte bitte auf die Nutzung dieses Dienstes.<br /><br />
              </div>
              <div className="flex flex-row gap-3 w-full mt-2">
                <button
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#df242c] text-white text-xs font-semibold hover:bg-[#b81c24] transition-colors"
                  onClick={() => {
                    setPrivacyAccepted(true);
                    setPrivacyChecked(true);
                    setShowPrivacyModal(false);
                  }}
                >Zustimmen</button>
                <button
                  className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300 transition-colors"
                  onClick={() => {
                    setPrivacyAccepted(false);
                    setPrivacyChecked(false);
                    setShowPrivacyModal(false);
                  }}
                >Ablehnen</button>
              </div>
            </div>
          </div>
        )}
        {/* Chatfenster und Aktionsbuttons (klassisch gestapelt, Card-Look, klare Abstände) */}
        <div className="w-full max-w-[420px] flex flex-col items-center">
          {/* Chatbereich: Eingabe immer sichtbar, Verlauf ein-/ausklappbar */}
          <div id="chatbereich" className="w-full max-w-[420px] flex flex-col items-center">
            {/* Eingabefeld immer sichtbar */}
            <form className="w-full flex flex-row items-center gap-2 mb-2" onSubmit={handleFormSubmit} autoComplete="off">
              <input
                type="text"
                className="flex-grow rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#df242c] bg-white"
                placeholder="Deine Nachricht ..."
                value={inputValue}
                onChange={handleInputChange}
                disabled={connectionStatus !== 'connected'}
                style={{minWidth:0}}
              />
              <button
                type="submit"
                className="rounded-xl px-3 py-2 bg-[#df242c] text-white font-semibold text-sm shadow hover:bg-[#b81c24] transition-colors disabled:opacity-50"
                disabled={!inputValue.trim() || connectionStatus !== 'connected'}
                aria-label="Senden"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </form>
            {/* Button zum Auf-/Zuklappen des Chatverlaufs mit +/− Icon rechts und Hover-Effekt für das Icon */}
            <button
              className="w-full rounded-xl px-3 py-2 bg-[#ededed] text-[#252422] font-semibold text-sm shadow hover:bg-[#df242c] hover:text-white transition-colors mb-2 flex items-center justify-between group"
              style={{maxWidth:420}}
              onClick={() => setIsChatOpen(open => !open)}
              aria-label={isChatOpen ? 'Chatverlauf zuklappen' : 'Chatverlauf aufklappen'}
              type="button"
            >
              <span>{isChatOpen ? 'Chatverlauf zuklappen' : 'Chatverlauf anzeigen'}</span>
              <span
                style={{fontSize:'1.3em', marginLeft:'8px', fontWeight:600, transition:'color 0.2s'}}
                className="group-hover:text-white"
                aria-hidden="true"
              >{isChatOpen ? '−' : '+'}</span>
            </button>
            {/* Chatverlauf nur wenn offen, Schriftgröße noch kleiner für bessere Lesbarkeit */}
            {isChatOpen && (
              <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-4 mb-4 max-h-[320px] min-h-[120px] overflow-y-auto text-[0.78em] leading-relaxed" ref={scrollAreaRef} style={{minHeight:120, maxHeight:320}}>
                {messages.length === 0 ? (
                  <div className="text-gray-400 text-center py-8 select-none">Hier erscheint dein Chatverlauf mit Möldi.</div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`mb-2 flex ${msg.source === 'user' ? 'justify-end' : 'justify-start'}`}> 
                      <div className={`px-3 py-2 rounded-xl max-w-[80%] whitespace-pre-line break-words shadow-sm ${msg.source === 'user' ? 'bg-[#df242c] text-white' : 'bg-gray-100 text-[#252422]'}`}
                        style={{wordBreak:'break-word'}}>
                        {/* URLs automatisch erkennen und verlinken */}
                        {msg.message.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                          /^https?:\/\//.test(part) ? (
                            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all text-blue-600 hover:text-blue-800">{part}</a>
                          ) : part
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Aktionsbuttons */}
            <div className="w-full flex flex-row items-center justify-center mt-1 pb-1 pt-2 border-t border-gray-100 gap-1">
              <ActionButtons size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}