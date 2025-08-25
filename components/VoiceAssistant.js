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

const { publicRuntimeConfig } = getConfig?.() || {}

const AGENT_IDS = {
  moeldi: process.env.NEXT_PUBLIC_AGENT_ID_MOELDI,
  joshua: process.env.NEXT_PUBLIC_AGENT_ID_JOSHUA,
}

let recognitionGlobal = null // global fallback for SpeechRecognition

// --- Konstanten für Kontakt-Links ---
const MAIL_URL = "mailto:azubianfragen@moelders.de?subject=Anfrage%20Azubiberatung";
const WHATSAPP_URL = "https://wa.me/4915123456789";
const JOB_URL = "https://www.moelders.de/unternehmen/jobboerse";

export default function VoiceAssistant() {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [inputValue, setInputValue] = useState("")
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [pendingAgentMessage, setPendingAgentMessage] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('moeldi') // 'moeldi' oder 'joshua'
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
    if (recognitionRef.current) {
      try { recognitionRef.current.start() } catch (e) {}
    }
  }
  const stopMic = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
    }
  }

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

  // Initialisiere Conversation
  const startConversation = useCallback(async () => {
    try {
      setConnectionStatus('connecting')
      console.log('[DEBUG] Datenschutz:', privacyChecked, privacyAccepted)
      // Agenten-ID je nach Auswahl
      const agentId = AGENT_IDS[selectedAgent] || AGENT_IDS.moeldi
      console.log('[DEBUG] AgentId:', agentId)
      // Ursprünglicher Aufruf der Server-Action
      const { signedUrl } = await getSignedUrl(agentId)
      console.log('[DEBUG] getSignedUrl result:', signedUrl)
      if (!signedUrl) {
        alert('Fehler: Es konnte keine Verbindung zum Agenten hergestellt werden. Bitte prüfe deine API-Konfiguration.');
        setConnectionStatus('disconnected')
        return
      }
      setSignedUrl(signedUrl); // Save for REST fallback
      console.log('[DEBUG] Starte Conversation mit signedUrl:', signedUrl)
      // Determine if agent is text-only (future: dynamic, for now hardcoded)
      const isTextOnlyAgent = false; // Set to true if you have a text-only agent
      // Only set text_only if agent is truly text-only
      const sessionOptions = {
        signedUrl,
        ...(isTextOnlyAgent ? {
          input_mode: 'text',
          conversation_config_override: { conversation: { text_only: true } }
        } : {}),
        onMessage: (message) => {
          console.log('[DEBUG] onMessage empfangen:', message)
          setMessages((prev) => [
            ...prev,
            {
              source: message.source,
              message: message.message,
            },
          ])
          if (message.source !== 'user') setPendingAgentMessage(false)
        },
        onError: (error) => {
          console.error('[DEBUG] Agentenfehler:', error)
          alert('Agentenfehler: ' + error.message)
          setConnectionStatus('disconnected')
        },
        onStatusChange: (status) => {
          console.log('[DEBUG] Statuswechsel:', status)
          setConnectionStatus(
            status.status === 'connected' ? 'connected' : 'disconnected'
          )
        },
        onModeChange: (mode) => {
          console.log('[DEBUG] onModeChange event received:', mode);
          let modeValue = mode && typeof mode === 'object' ? mode.mode : mode;
          if (modeValue === 'speaking') {
            setIsSpeaking(true);
            setPendingAgentMessage(true);
          } else {
            setIsSpeaking(false);
          }
        },
      }
      const conv = await Conversation.startSession(sessionOptions)
      console.log('[DEBUG] Conversation.startSession result:', conv)
      let cid = null;
      if (conv) {
        if (conv.conversationId) cid = conv.conversationId;
        else if (conv.id) cid = conv.id;
        else if (conv.connection && conv.connection.conversationId) cid = conv.connection.conversationId;
        else if (conv.connection && conv.connection.conversation_id) cid = conv.connection.conversation_id;
      }
      console.log('[DEBUG] Conversation-Objekt:', conv);
      console.log('[DEBUG] Erkannte conversationId:', cid);
      if (cid) {
        setConversationId(cid);
      } else {
        setConversationId(null);
        console.warn('[DEBUG] Keine conversationId im Conversation-Objekt gefunden:', conv)
      }
      setConversation(conv)
      setIsActive(true)
      setConnectionStatus('connected')
      if (!recognitionRef.current) createRecognition()
      startMic()
    } catch (error) {
      console.error('Failed to start conversation:', error)
      alert('Fehler beim Starten des Gesprächs: ' + (error?.message || error))
      setConnectionStatus('disconnected')
    }
  }, [selectedAgent, privacyChecked, privacyAccepted])

  // Beende Conversation und Recognition
  const endConversation = useCallback(async () => {
    if (conversation) {
      await conversation.endSession()
      setConversation(null)
      setIsSpeaking(false)
      setIsActive(false)
      setConnectionStatus('disconnected')
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
      recognitionRef.current = null
      recognitionGlobal = null
    }
  }, [conversation])

  // Text abschicken (an Agenten senden) – gemäß ElevenLabs Conversational API
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !conversation || connectionStatus !== 'connected') {
      console.warn('[DEBUG] handleSend: Kein Text, keine Conversation oder nicht verbunden', {text, conversation, connectionStatus});
      return;
    }
    setMessages((prev) => [
      ...prev,
      { source: "user", message: text },
    ]);
    setInputValue("");
    setPendingAgentMessage(true);
    try {
      // Versuche immer zuerst das SDK (Conversation-Objekt)
      if (typeof conversation.send === 'function') {
        try {
          console.log('[DEBUG] conversation object:', conversation);
          console.log('[DEBUG] conversation.send exists:', typeof conversation.send);
          console.log('[DEBUG] Sende an conversation.send:', { input: text });
          const sendResult = await conversation.send({ input: text });
          console.log('[DEBUG] conversation.send result:', sendResult);
          // Die Antwort wird über onMessage verarbeitet
        } catch (err) {
          console.error('[DEBUG] conversation.send({ input }) fehlgeschlagen', err);
          alert('Fehler: Die Nachricht konnte nicht an den Agenten gesendet werden.');
          setPendingAgentMessage(false);
        }
      } else if (signedUrl && conversationId) {
        // REST fallback (korrekter Endpoint!)
        const fallbackUrl = `https://api.elevenlabs.io/v1/conversations/${conversationId}/interact`;
        try {
          const response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || '',
            },
            body: JSON.stringify({ input: text })
          });
          if (!response.ok) {
            throw new Error('REST-Fallback: Antwort nicht OK: ' + response.status);
          }
          const data = await response.json();
          console.log('[DEBUG] REST-Fallback Antwort:', data);
          if (data && (data.response || data.message)) {
            setMessages((prev) => [
              ...prev,
              { source: 'agent', message: data.response || data.message },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { source: 'agent', message: '[Agenten-Antwort nicht lesbar]' },
            ]);
          }
        } catch (errRest) {
          setMessages((prev) => [
            ...prev,
            { source: 'agent', message: '[Fehler bei der Agenten-Antwort]' },
          ]);
        }
        setPendingAgentMessage(false);
      } else {
        setMessages((prev) => [
          ...prev,
          { source: 'agent', message: '[Fehler: conversation/send nicht verfügbar]' },
        ]);
        setPendingAgentMessage(false);
      }
    } catch (err) {
      setPendingAgentMessage(false);
      console.error('[DEBUG] Fehler beim Senden an den Agenten:', err);
      alert('Fehler beim Senden an den Agenten: ' + (err?.message || err));
    }
  }, [inputValue, conversation, connectionStatus, signedUrl, conversationId])

  // Automatisches Scrollen zum unteren Ende des Chatverlaufs, wenn neue Nachrichten kommen
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, showChat]);

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

  // Funktion zum Stummschalten/Entstummen des Mikrofons (nutzt ElevenLabs SDK)
  const handleMuteToggle = useCallback(() => {
    if (!conversation) return;
    if (isMuted) {
      conversation.setMicMuted(false);
      setIsMuted(false);
    } else {
      conversation.setMicMuted(true);
      setIsMuted(true);
    }
  }, [conversation, isMuted])

  // --- Hilfskomponente für Aktionsbuttons (E-Mail, WhatsApp, Jobbörse) ---
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
        {/* Agenten-Auswahl: Möldi oder Joshua */}
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
          /* Joshua Farben */
          .voice-bar.joshua1 { --bar-color1: #baffc9; --bar-color2: #028e4a; }
          .voice-bar.joshua2 { --bar-color1: #4be585; --bar-color2: #028e4a; }
          .voice-bar.joshua3 { --bar-color1: #028e4a; --bar-color2: #4be585; }
          .voice-bar.joshua4 { --bar-color1: #4be585; --bar-color2: #baffc9; }
          .voice-bar.joshua5 { --bar-color1: #baffc9; --bar-color2: #028e4a; }
        `}</style>
        <div className="flex flex-col items-center gap-2 mb-8 w-full">
          <div className="flex flex-row items-center justify-center gap-8 relative">
            {/* Möldi (einziger Agent) */}
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
                  {/* Vertikale Balken entfernt! */}
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
                {/* Möldi-Sticker noch weiter nach rechts (fast am Rand), größere Schrift */}
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
            {/* Main button: left-aligned, right edge moves left when active to make space for mute button */}
            <div className={`relative flex items-center transition-all duration-200 ${isActive ? 'flex-grow' : 'w-full'} max-w-[420px]`} style={{flexGrow: isActive ? 1 : undefined, width: isActive ? 'calc(100% - 64px)' : '100%'}}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={isActive ? endConversation : startConversation}
                className={`pr-4 pl-6 py-2 rounded-2xl text-base font-semibold shadow-md transition-all duration-200 focus:outline-none flex-grow flex-shrink flex items-center justify-between relative w-full`
                  + (isActive ? ' border border-[#df242c] text-[#df242c] bg-white hover:bg-[#df242c] hover:text-white' : selectedAgent === 'moeldi' ? ' bg-[#df242c] text-white hover:bg-[#b81c24]' : ' bg-[#028e4a] text-white hover:bg-[#026c39]')
                  + (!privacyChecked && !isActive ? ' opacity-50 cursor-not-allowed' : '')}
                aria-label={isActive ? 'Gespräch beenden' : 'Gespräch starten'}
                disabled={!privacyChecked && !isActive}
                type="button"
                style={{height:'48px', minWidth:0, width: '100%', maxWidth: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position:'relative'}}
              >
                <span className="w-full text-center block" style={{marginRight: '40px'}}>
                  {isActive ? 'Gespräch beenden' : `Gespräch mit KI-Möldi starten`}
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
                    {connectionStatus === 'connected' && (
                      <svg viewBox="0 0 20 20" width="18" height="18" style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)'}} aria-hidden="true" focusable="false">
                        <polyline points="5,11 9,15 15,7" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {connectionStatus !== 'connected' && (
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
            {/* Mute/Unmute Icon-Button: Nur sichtbar, wenn Gespräch aktiv ist, rechts daneben */}
            {isActive && (
              <button
                onClick={handleMuteToggle}
                className={
                  `flex items-center justify-center rounded-full transition-colors w-12 h-12 shadow-md border-4 focus:outline-none ml-2 ` +
                  (isMuted
                    ? 'bg-[#fff] border-[#f39c12]' // Orange Ring wenn gemutet
                    : 'bg-[#fff] border-[#28b463]') // Neutraler grüner Ring wenn aktiv
                }
                type="button"
                aria-label={isMuted ? 'Mikrofon einschalten' : 'Mikrofon stummschalten'}
                title={isMuted ? 'Mikrofon einschalten' : 'Mikrofon stummschalten'}
                style={{minHeight:'48px', minWidth:'48px', borderWidth: '4px'}}
              >
                {/* Mikrofon-Icon in dezentem Grau #7c7c7c */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c7c7c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                  {isMuted && (
                    <line x1="4" y1="4" x2="20" y2="20" stroke="#f39c12" strokeWidth="2.8" strokeLinecap="round" opacity="0.95" />
                  )}
                </svg>
              </button>
            )}
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
                Mit dem Klick auf <b>„Zustimmen“</b> erklärst Du Dich damit einverstanden, dass Deine Eingaben aufgezeichnet und durch KI-Technologie ausgewertet werden.<br /><br />
                Die Inhalte werden ausschließlich intern verwendet, um passende Lösungsideen zu entwickeln – wie in der <a href="https://www.moelders.de/datenschutz" target="_blank" rel="noopener noreferrer" className="underline text-[#df242c]">Datenschutzrichtlinie</a> beschrieben.<br /><br />
                Wenn Du nicht möchtest, dass Deine Eingaben verarbeitet werden, verzichte bitte auf die Nutzung dieses Dienstes.
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
          {/* Zeige Chat Button unter Gespräch starten/beenden */}
          <div className="w-full flex flex-col items-center mb-2">
            <button
              className="rounded-2xl px-4 py-2 bg-[#ededed] text-[#252422] text-sm shadow hover:bg-[#df242c] hover:text-white transition-colors focus:outline-none w-full max-w-[420px] flex items-center justify-center gap-2 relative"
              type="button"
              onClick={() => setShowChat((prev) => !prev)}
              aria-expanded={showChat}
              aria-controls="chatbereich"
              style={{width:'100%', maxWidth:'420px'}}>
              {/* Speech bubble icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline-block mr-1 -mt-0.5" aria-hidden="true"><path d="M21 11.5C21 16 16.97 19 12 19c-.97 0-1.91-.09-2.8-.27-.37-.07-.75-.01-1.07.17l-2.13 1.19c-.76.43-1.68-.23-1.54-1.09l.37-2.19c.06-.37-.03-.75-.25-1.05C3.53 14.13 3 12.87 3 11.5 3 7 7.03 4 12 4s9 3 9 7.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              {showChat ? 'Chat ausblenden' : 'Zeige Chat'}
              {/* Plus/Minus Symbol ganz rechts mit Abstand */}
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg select-none" aria-hidden="true" style={{paddingLeft:'8px'}}>{showChat ? '−' : '+'}</span>
            </button>
            {/* Aktionsbuttons: nur im zugeklappten Modus unter dem Button sichtbar */}
            {!showChat && (
              <div className="w-full flex flex-row items-center justify-between mt-2 max-w-[420px] gap-2">
                <ActionButtons size="md" />
              </div>
            )}
          </div>
          {/* Chatbereich: nur sichtbar, wenn showChat true */}
          {showChat && (
            <div id="chatbereich" className="w-full max-w-[420px] flex flex-col items-center">
              {/* Chatfenster */}
              <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-4 mb-4 max-h-[320px] min-h-[120px] overflow-y-auto text-sm" ref={scrollAreaRef} style={{minHeight:120, maxHeight:320}}>
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
                {pendingAgentMessage && (
                  <div className="flex justify-start mb-2">
                    <div className="px-3 py-2 rounded-xl bg-gray-100 text-[#252422] max-w-[80%] animate-pulse">Möldi schreibt ...</div>
                  </div>
                )}
              </div>
              {/* Text-Eingabe und Senden (deaktiviert) */}
              {/*
              <form className="w-full flex flex-row items-center gap-2 mb-2" onSubmit={e => {e.preventDefault(); handleSend();}} autoComplete="off">
                <input
                  type="text"
                  className="flex-grow rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#df242c] bg-white"
                  placeholder="Deine Nachricht ..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled
                  style={{minWidth:0}}
                />
                <button
                  type="submit"
                  className="rounded-xl px-3 py-2 bg-[#df242c] text-white font-semibold text-sm shadow hover:bg-[#b81c24] transition-colors disabled:opacity-50"
                  disabled
                  aria-label="Senden"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </form>
              */}
              {/* Download Button: jetzt volle Breite unterhalb der Aktionsbuttons */}
              <div className="w-full flex flex-row justify-center mb-3 mt-2">
                <button
                  type="button"
                  className="rounded-2xl px-2 py-1.5 bg-[#ededed] text-[#252422] text-xs shadow hover:bg-[#df242c] hover:text-white transition-colors w-full flex items-center justify-center"
                  onClick={() => downloadTranscript(messages)}
                  aria-label="Gespräch runterladen"
                  disabled={messages.length === 0}
                >
                  <Download className="w-4 h-4 mr-1 inline-block align-middle" /> Gespräch runterladen
                </button>
              </div>
              {/* Aktionsbuttons: im ausgeklappten Modus verkleinert im Footerbereich */}
              {showChat && (
                <div className="w-full flex flex-row items-center justify-center mt-1 pb-1 pt-2 border-t border-gray-100 gap-1">
                  <ActionButtons size="sm" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}