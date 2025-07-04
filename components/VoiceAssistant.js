// components/VoiceAssistant.jsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, MessageCircle, Bot, User, Download, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { downloadTranscript } from '@/utils/transcript'
import { Conversation } from '@elevenlabs/client'
import { getSignedUrl } from '@/app/actions/getSignedUrl'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig?.() || {}

const AGENT_IDS = {
  anna: process.env.NEXT_PUBLIC_AGENT_ID_ANNA,
  joshua: process.env.NEXT_PUBLIC_AGENT_ID_JOSHUA,
}

let recognitionGlobal = null // global fallback for SpeechRecognition

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
  const [selectedAgent, setSelectedAgent] = useState('anna') // 'anna' oder 'joshua'
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
  const startConversation = async () => {
    try {
      setConnectionStatus('connecting')
      // Agenten-ID je nach Auswahl
      const agentId = AGENT_IDS[selectedAgent] || AGENT_IDS.anna
      const { signedUrl } = await getSignedUrl(agentId)
      if (!signedUrl) {
        alert('Fehler: Es konnte keine Verbindung zum Agenten hergestellt werden. Bitte prüfe deine API-Konfiguration.');
        setConnectionStatus('disconnected')
        return
      }
      setSignedUrl(signedUrl); // Save for REST fallback
      console.log('[DEBUG] Starte Conversation mit signedUrl:', signedUrl)
      const conv = await Conversation.startSession({
        signedUrl,
        input_mode: "text",
        conversation_config_override: {
          conversation: { text_only: true }
        },
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
          console.log('[DEBUG] Modewechsel:', mode)
          setIsSpeaking(mode.mode === 'speaking')
          if (mode.mode === 'speaking') setPendingAgentMessage(true)
        },
      })
      // Store conversationId from SDK instance if available
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
      console.log('[DEBUG] Conversation-Instanz nach Start:', conv)
      setConversation(conv)
      setIsActive(true)
      setConnectionStatus('connected')
      // Recognition erzeugen und ggf. starten
      if (!recognitionRef.current) createRecognition()
      startMic()
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setConnectionStatus('disconnected')
    }
  }

  // Beende Conversation und Recognition
  const endConversation = async () => {
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
  }

  // Text abschicken (an Agenten senden) – REST-konform für ElevenLabs Conversational API
  const handleSend = async () => {
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
    let sent = false;
    try {
      if (conversation.mode) {
        console.log('[DEBUG] Aktueller Conversation-Modus vor Senden:', conversation.mode)
      }
      if (typeof conversation.setMode === 'function') {
        try {
          await conversation.setMode('text')
          console.log('[DEBUG] setMode("text") erfolgreich ausgeführt')
        } catch (errSetMode) {
          console.warn('[DEBUG] setMode("text") fehlgeschlagen:', errSetMode)
        }
      } else if (typeof conversation.startTextInput === 'function') {
        try {
          await conversation.startTextInput()
          console.log('[DEBUG] startTextInput() erfolgreich ausgeführt')
        } catch (errStartText) {
          console.warn('[DEBUG] startTextInput() fehlgeschlagen:', errStartText)
        }
      }
      if (conversation.mode) {
        console.log('[DEBUG] Aktueller Conversation-Modus nach Umschalten:', conversation.mode)
      }
      if (typeof conversation.send === 'function') {
        console.log('[DEBUG] Sende Text an Agent (input):', text, conversation);
        // Zuerst mit { input: text }
        try {
          console.log('[DEBUG] Warte auf conversation.send({ input })...')
          const sendResult = await conversation.send({ input: text });
          sent = true;
          console.log('[DEBUG] conversation.send({ input }) erfolgreich', sendResult);
        } catch (err1) {
          console.warn('[DEBUG] conversation.send({ input }) fehlgeschlagen', err1);
          // Falls das nicht klappt, versuche { text: text }
          try {
            console.log('[DEBUG] Versuche Fallback mit { text }:', text);
            console.log('[DEBUG] Warte auf conversation.send({ text })...')
            const sendResult2 = await conversation.send({ text });
            sent = true;
            console.log('[DEBUG] conversation.send({ text }) erfolgreich', sendResult2);
          } catch (err2) {
            console.error('[DEBUG] conversation.send({ text }) fehlgeschlagen', err2);
            alert('Fehler: Die Nachricht konnte nicht an den Agenten gesendet werden.');
          }
        }
      } else if (signedUrl) {
        // REST fallback for text-only mode
        if (!conversationId) {
          setMessages((prev) => [
            ...prev,
            { source: 'agent', message: '[Fehler: conversation_id nicht verfügbar]' },
          ]);
          setPendingAgentMessage(false);
          return;
        }
        // Build correct REST endpoint
        const restUrl = `https://api.elevenlabs.io/v1/convai/conversation/${conversationId}/interact`;
        console.log('[DEBUG] REST-Fallback: Sende Text an REST-Endpoint:', restUrl, text);
        setPendingAgentMessage(true);
        try {
          const response = await fetch(restUrl, {
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
          console.log('[DEBUG] REST-Fallback: Antwort erhalten:', data);
          // Add agent response to chat
          if (data && data.response) {
            setMessages((prev) => [
              ...prev,
              { source: 'agent', message: data.response },
            ]);
          } else if (data && data.message) {
            setMessages((prev) => [
              ...prev,
              { source: 'agent', message: data.message },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { source: 'agent', message: '[Agenten-Antwort nicht lesbar]' },
            ]);
          }
          setPendingAgentMessage(false);
        } catch (errRest) {
          setPendingAgentMessage(false);
          console.error('[DEBUG] REST-Fallback Fehler:', errRest);
          setMessages((prev) => [
            ...prev,
            { source: 'agent', message: '[Fehler bei der Agenten-Antwort]' },
          ]);
        }
      } else {
        console.error('[DEBUG] conversation.send ist keine Funktion und kein signedUrl!', conversation)
      }
    } catch (err) {
      // Fehler beim Senden an das SDK: err
      console.error('[DEBUG] Fehler beim Senden an den Agenten:', err);
      alert('Fehler beim Senden an den Agenten: ' + (err?.message || err));
    }
  };

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

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-white p-4${isIframe ? ' min-h-0 h-full' : ''}`}
         style={isIframe ? { minHeight: '100vh', height: '100vh', padding: 0 } : { paddingLeft: 16, paddingRight: 16, minHeight: '100vh' }}>
      <div className={`w-full mx-auto flex flex-col items-center ${isIframe ? 'max-w-full' : 'max-w-sm'}`}
           style={isIframe ? { maxWidth: '100vw' } : { maxWidth: 420, width: '100%' }}>
        {/* Begrüßungstext und Einleitung */}
        <div className="w-full flex flex-col items-center text-center mb-3 px-2">
          <h2 className="text-lg font-semibold text-[#252422] mb-1">Willkommen beim Job & Azubiberater!</h2>
          <p className="text-sm text-gray-700 max-w-md leading-snug mb-2">
            Du hast Fragen zu Ausbildung, Jobs oder möchtest mehr über Mölders als Arbeitgeber wissen?
          </p>
          <p className="text-sm text-gray-700 max-w-md leading-snug mb-2">
            Anna beantwortet dir gerne alle Fragen rund um offene Stellen, den Bewerbungsprozess und unsere Ausbildungsangebote.
          </p>
          <p className="text-sm text-gray-700 max-w-md leading-snug">
            Starte das Gespräch oder nutze die Kontaktmöglichkeiten unten. Wir freuen uns auf dich!
          </p>
        </div>
        {/* Agenten-Auswahl: Anna oder Joshua */}
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
          .animate-profile-pulse {
            animation: profile-pulse 1.6s cubic-bezier(0.4,0,0.2,1) infinite;
          }

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
            {/* Anna (einziger Agent) */}
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
                onClick={() => setSelectedAgent('anna')}
                className={`flex flex-col items-center focus:outline-none transition-all duration-200 relative z-10`}
                aria-label="Anna auswählen"
                type="button"
                style={{ background: 'none', border: 'none', padding: 0 }}
                disabled={false}
              >
                <img
                  src="/public-pics/anna.jpg"
                  alt="Anna, Azubiberaterin"
                  className={`object-cover shadow rounded-full border-4 border-[#df242c] transition-all duration-300 relative w-36 h-36 z-10${isSpeaking ? ' animate-profile-pulse' : ''}`}
                  style={{willChange: 'transform'}}
                />
                <span className="text-xs font-medium text-[#252422] mt-2">Anna</span>
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
          <div className="w-full max-w-[420px] flex flex-row items-center justify-center relative">
            {/* Button + Status-Kreis als bündige Einheit, Kreis bleibt im Button! */}
            <div className="relative w-full max-w-[420px] flex items-center justify-center mx-auto">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={isActive ? endConversation : startConversation}
                className={`mb-2 pr-4 pl-6 py-2 rounded-2xl text-base font-semibold shadow-md transition-all duration-200 focus:outline-none flex-grow-0 flex-shrink-0 flex items-center justify-between relative w-full`
                  + (isActive ? ' bg-gray-200 text-[#df242c] hover:bg-gray-300' : selectedAgent === 'anna' ? ' bg-[#df242c] text-white hover:bg-[#b81c24]' : ' bg-[#028e4a] text-white hover:bg-[#026c39]')
                  + (!privacyChecked && !isActive ? ' opacity-50 cursor-not-allowed' : '')}
                aria-label={isActive ? 'Gespräch beenden' : 'Gespräch starten'}
                disabled={!privacyChecked && !isActive}
                style={{height:'48px', minWidth:0, width: '100%', maxWidth: '420px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position:'relative'}}
              >
                <span className="w-full text-center block" style={{marginRight: '40px'}}>
                  {isActive ? 'Gespräch beenden' : `Gespräch mit ${selectedAgent === 'anna' ? 'Anna' : 'Joshua'} starten`}
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
          </div>
        </div>
        {/* Zeige Chat Button: eigene Zeile, volle Breite, max wie Chatfenster */}
        <div className="flex w-full justify-center mb-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowChat(!showChat)}
            className={`w-full max-w-[420px] px-2 py-2 rounded-xl bg-[#f0f0f0] text-[#252422] text-xs font-semibold flex flex-row items-center justify-center shadow-sm border border-gray-200 transition-colors h-11 mb-2 ${showChat ? 'bg-[#df242c] text-[#5d6669] border-[#df242c]' : 'hover:bg-[#df242c] hover:text-white hover:border-[#df242c]'}`}
            type="button"
            style={{lineHeight: 1.1}}
          >
            <MessageCircle className={`w-4 h-4 mr-2${showChat ? ' text-[#5d6669]' : ''}`} />
            <span className='leading-tight'>{showChat ? 'Chat verbergen' : 'Zeige Chat'}</span>
          </motion.button>
        </div>
        {/* Action Buttons: E-Mail, WhatsApp, Stellen - Position je nach Chat-Status */}
        {!showChat && (
          <div className="flex flex-row gap-3 mb-2 w-full justify-center max-w-[420px] mx-auto">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => window.location.href = 'mailto:azubianfragen@moelders.de?subject=Anfrage%20%C3%BCber%20KI%20Anna%20zu%20Jobs%2C%20Ausbildung%20und%20Praktika'}
              className={`flex-1 px-2 py-1.5 rounded-xl bg-[#f0f0f0] text-[#252422] text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 shadow-sm border border-[#f0f0f0] transition-colors h-10 min-w-0 hover:bg-[#df242c] hover:text-white hover:border-[#df242c]`}
              type="button"
              style={{lineHeight: 1.1}}
            >
              <Mail className='w-4 h-4 mb-0.5' />
              <span className='leading-tight'>E-Mail</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => window.open('https://wa.me/4915123206142', '_blank')}
              className={`flex-1 px-2 py-1.5 rounded-xl bg-[#f0f0f0] text-[#252422] text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 shadow-sm border border-[#f0f0f0] transition-colors h-10 min-w-0 hover:bg-[#df242c] hover:text-white hover:border-[#df242c]`}
              type="button"
              style={{lineHeight: 1.1}}
            >
              {/* WhatsApp SVG Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4 mb-0.5"><path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.832 4.584 2.236 6.37L4.062 28.25a1 1 0 0 0 1.312 1.312l6.88-2.174A11.96 11.96 0 0 0 16 27c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10a9.96 9.96 0 0 1-5.09-1.39 1 1 0 0 0-.77-.09l-5.13 1.62 1.62-5.13a1 1 0 0 0-.09-.77A9.96 9.96 0 0 1 6 15c0-5.523 4.477-10 10-10zm-4.09 6.09c-.23-.52-.47-.53-.68-.54-.18-.01-.39-.01-.6-.01-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.63 0 1.55 1.13 3.05 1.29 3.26.16.21 2.21 3.37 5.44 4.59.76.29 1.36.46 1.83.59.77.2 1.47.17 2.02.1.62-.08 1.91-.78 2.18-1.54.27-.76.27-1.41.19-1.54-.08-.13-.29-.21-.6-.37-.31-.16-1.91-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.21.32-.82 1.05-1.01 1.27-.19.22-.37.24-.68.08-.31-.16-1.31-.48-2.5-1.53-.92-.77-1.54-1.72-1.72-2.03-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.56.16-.19.21-.32.32-.53.11-.21.06-.4-.02-.56z"/></svg>
              <span className='leading-tight'>WhatsApp</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => window.open('https://www.moelders.de/unternehmen/jobboerse', '_blank', 'noopener,noreferrer')}
              className={`flex-1 px-2 py-1.5 rounded-xl bg-[#f0f0f0] text-[#252422] text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 shadow-sm border border-[#f0f0f0] transition-colors h-10 min-w-0 hover:bg-[#df242c] hover:text-white hover:border-[#df242c]`}
              type="button"
              style={{lineHeight: 1.1}}
            >
              <Bot className='w-4 h-4 mb-0.5' />
              <span className='leading-tight'>Jobbörse</span>
            </motion.button>
          </div>
        )}
        {/* Chat area */}
        <AnimatePresence>
          {showChat && (
            <>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className='w-full bg-white rounded-2xl overflow-hidden shadow-xl mb-2 mt-6 border border-[#eee]'
                style={{ boxShadow: '0 4px 32px 0 rgba(34,34,34,0.10)', backdropFilter: 'blur(0.5px)' }}
              >
                {/* Header mit Avatar und Status */}
                <div className='flex items-center gap-2 px-4 pt-4 pb-1' style={{ background: '#f7f7f8', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}>
                  <img
                    src={'/public-pics/anna.jpg'}
                    alt={'Anna, Azubiberaterin'}
                    className='w-8 h-8 rounded-full border border-[#df242c] object-cover shadow'
                  />
                  <span className='text-gray-700 text-sm rounded-full px-3 py-0.5 font-medium'>Ich höre dir zu...</span>
                </div>
                {/* Chatverlauf */}
                <div
                  ref={scrollAreaRef}
                  className='h-80 overflow-y-auto px-4 py-3 space-y-5 scrollbar-thin scrollbar-thumb-[#eee] scrollbar-track-[#fafafa]'
                >
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.source === 'user'
                          ? 'justify-end'
                          : 'justify-start'
                      } items-end w-full`}
                    >
                      {message.source !== 'user' && (
                        <img
                          src={'/public-pics/anna.jpg'}
                          alt={'Anna, Azubiberaterin'}
                          className='w-9 h-9 rounded-full border border-[#df242c] object-cover shadow'
                        />
                      )}
                      <div
                        className={
                          message.source === 'user'
                            ? 'bg-gradient-to-br from-[#df242c] to-[#b81c24] text-white border border-[#df242c] text-right px-5 py-2 max-w-[75%] shadow-lg relative user-bubble break-words'
                            : 'bg-gradient-to-br from-gray-100 to-gray-200 text-[#252422] border border-gray-200 text-left px-5 py-2 max-w-[75%] shadow-lg relative agent-bubble break-words'
                        }
                        style={{ fontSize: 13, lineHeight: 1.45, minWidth: 60, borderRadius: message.source === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                      >
                        {/* URLs im Text automatisch verlinken, Zeilenumbrüche erhalten, Punkt/Komma am Ende nicht Teil des Links, Links immer eigene Zeile */}
                        {(() => {
                          const urlRegex = /((https?:\/\/|www\.)[\w\-]+(\.[\w\-]+)+(\/[\w\-.,@?^=%&:/~+#]*)?(#[\w\-]+)?)/gi;
                          // Splitte an URLs, aber behalte die Reihenfolge
                          const parts = [];
                          let lastIndex = 0;
                          let match;
                          while ((match = urlRegex.exec(message.message)) !== null) {
                            // Text vor der URL
                            if (match.index > lastIndex) {
                              parts.push({ text: message.message.slice(lastIndex, match.index), isLink: false });
                            }
                            let url = match[0];
                            // Entferne Punkt, Komma, Semikolon, Doppelpunkt am Ende
                            let trailing = '';
                            while (/[.,;:!?)]$/.test(url)) {
                              trailing = url.slice(-1) + trailing;
                              url = url.slice(0, -1);
                            }
                            let href = url;
                            if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
                            // Nur Links mit mindestens einem Punkt und ohne offensichtliche Fehler
                            if (/^https?:\/\/\.[a-zA-Z]/.test(url) || /\s/.test(url)) {
                              // Kein echter Link
                              parts.push({ text: match[0], isLink: false });
                            } else {
                              // Link immer in eigener Zeile mit <br /> davor und danach
                              parts.push({ text: url, isLink: true, href, trailing });
                            }
                            lastIndex = match.index + match[0].length;
                          }
                          // Restlicher Text nach der letzten URL
                          if (lastIndex < message.message.length) {
                            parts.push({ text: message.message.slice(lastIndex), isLink: false });
                          }
                          // Baue JSX mit Zeilenumbrüchen und Links in eigener Zeile
                          const jsx = [];
                          parts.forEach((part, i) => {
                            if (part.isLink) {
                              jsx.push(<br key={`br-before-${i}`} />);
                              jsx.push(
                                <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="underline text-[#df242c] break-all hover:text-[#b81c24]" style={{wordBreak:'break-all', display:'inline-block'}}>{part.text}</a>
                              );
                              jsx.push(<br key={`br-after-${i}`} />);
                              if (part.trailing) jsx.push(<span key={`trail-${i}`}>{part.trailing}</span>);
                            } else {
                              // Zeilenumbrüche im normalen Text erhalten
                              part.text.split(/(\n)/).forEach((t, j) => {
                                if (t === '\n') jsx.push(<br key={`nl-${i}-${j}`} />);
                                else if (t) jsx.push(<span key={`txt-${i}-${j}`}>{t}</span>);
                              });
                            }
                          });
                          return jsx;
                        })()}
                        {/* Sprechblasen-Pfeil wie im Beispielbild */}
                        {message.source === 'user' ? (
                          <span style={{ position: 'absolute', right: -8, bottom: 0, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '12px solid #b81c24' }} />
                        ) : (
                          <span style={{ position: 'absolute', left: -8, bottom: 0, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '12px solid #e5e7eb' }} />
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Ladeindikator für Agenten-Nachricht, neutral (drei Punkte) */}
                  {pendingAgentMessage && (
                    <div className="flex justify-start items-end w-full">
                      <img
                        src={'/public-pics/anna.jpg'}
                        alt={'Anna, Azubiberaterin'}
                        className='w-8 h-8 rounded-full border border-[#df242c] object-cover mr-2'
                      />
                      <div className='bg-gradient-to-br from-gray-100 to-gray-200 text-[#252422] border border-gray-200 text-left px-5 py-2 max-w-[75%] shadow-lg relative agent-bubble flex items-center gap-2' style={{ fontSize: 13, lineHeight: 1.45, minWidth: 60, borderRadius: '18px 18px 18px 4px' }}>
                        <span className="flex flex-row gap-1 items-center" aria-label="Agent tippt">
                          <span className={`w-2 h-2 rounded-full animate-bounce`} style={{backgroundColor: selectedAgent === 'anna' ? '#dd232d' : '#028e4a', animationDelay:'0s'}}></span>
                          <span className={`w-2 h-2 rounded-full animate-bounce`} style={{backgroundColor: selectedAgent === 'anna' ? '#dd232d' : '#028e4a', animationDelay:'0.18s'}}></span>
                          <span className={`w-2 h-2 rounded-full animate-bounce`} style={{backgroundColor: selectedAgent === 'anna' ? '#dd232d' : '#028e4a', animationDelay:'0.36s'}}></span>
                        </span>
                        <span style={{ position: 'absolute', left: -8, bottom: 0, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '12px solid #e5e7eb' }} />
                      </div>
                    </div>
                  )}
                </div>
                {/* Texteingabe und Senden-Button entfernt (keine Texteingabe mehr möglich) */}
                {/* <form>
                  className="flex flex-row items-center gap-2 px-4 pt-2 pb-1 border-t border-[#eee] bg-white"
                  style={{marginTop:0}}
                  onSubmit={e => {
                    e.preventDefault();
                    handleSend();
                  }}
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="Nachricht eingeben..."
                    className="flex-1 rounded-lg border border-[#df242c] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#df242c] bg-white shadow-sm"
                    disabled={!conversation || connectionStatus !== 'connected'}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#df242c] text-white font-semibold text-sm shadow hover:bg-[#b81c24] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!inputValue.trim() || !conversation || connectionStatus !== 'connected'}
                  >Senden</button>
                </form> */}
                {/* Footer: Kompakte Action Buttons in einer Zeile, darunter Download-Button über die ganze Breite */}
                <div className='flex flex-col gap-2 px-4 pb-3 pt-1 border-t border-[#eee] bg-white'>
                  <div className='flex flex-row justify-between items-center gap-2 w-full mb-1'>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => window.location.href = 'mailto:azubianfragen@moelders.de?subject=Anfrage%20%C3%BCber%20KI%20Anna%20zu%20Jobs%2C%20Ausbildung%20und%20Praktika'}
                      className='flex-1 px-1.5 py-1 rounded-lg bg-[#f0f0f0] text-[#252422] text-[10px] font-semibold flex flex-col items-center justify-center shadow-sm border border-[#f0f0f0] transition-colors h-8 min-w-0 text-center hover:bg-[#df242c] hover:text-white hover:border-[#df242c]'
                      type="button"
                      style={{lineHeight: 1.1}}
                    >
                      <Mail className='w-3.5 h-3.5 mb-0.5' />
                      <span className='leading-tight'>E-Mail</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => window.open('https://wa.me/4915123206142', '_blank')}
                      className='flex-1 px-1.5 py-1 rounded-lg bg-[#f0f0f0] text-[#252422] text-[10px] font-semibold flex flex-col items-center justify-center shadow-sm border border-[#f0f0f0] transition-colors h-8 min-w-0 text-center hover:bg-[#df242c] hover:text-white hover:border-[#df242c]'
                      type="button"
                      style={{lineHeight: 1.1}}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" className="w-3.5 h-3.5 mb-0.5"><path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.832 4.584 2.236 6.37L4.062 28.25a1 1 0 0 0 1.312 1.312l6.88-2.174A11.96 11.96 0 0 0 16 27c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10a9.96 9.96 0 0 1-5.09-1.39 1 1 0 0 0-.77-.09l-5.13 1.62 1.62-5.13a1 1 0 0 0-.09-.77A9.96 9.96 0 0 1 6 15c0-5.523 4.477-10 10-10zm-4.09 6.09c-.23-.52-.47-.53-.68-.54-.18-.01-.39-.01-.6-.01-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.63 0 1.55 1.13 3.05 1.29 3.26.16.21 2.21 3.37 5.44 4.59.76.29 1.36.46 1.83.59.77.2 1.47.17 2.02.1.62-.08 1.91-.78 2.18-1.54.27-.76.27-1.41.19-1.54-.08-.13-.29-.21-.6-.37-.31-.16-1.91-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.21.32-.82 1.05-1.01 1.27-.19.22-.37.24-.68.08-.31-.16-1.31-.48-2.5-1.53-.92-.77-1.54-1.72-1.72-2.03-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.56.16-.19.21-.32.32-.53.11-.21.06-.4-.02-.56z"/></svg>
                      <span className='leading-tight'>WhatsApp</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => window.open('https://www.moelders.de/unternehmen/jobboerse', '_blank', 'noopener,noreferrer')}
                      className='flex-1 px-1.5 py-1 rounded-lg bg-[#f0f0f0] text-[#252422] text-[10px] font-semibold flex flex-col items-center justify-center shadow-sm border border-[#f0f0f0] transition-colors h-8 min-w-0 text-center hover:bg-[#df242c] hover:text-white hover:border-[#df242c]'
                      type="button"
                      style={{lineHeight: 1.1}}
                    >
                      <Bot className='w-3.5 h-3.5 mb-0.5' />
                      <span className='leading-tight'>Jobbörse</span>
                    </motion.button>
                  </div>
                  <button
                    className='w-full mt-1 p-1.5 rounded-lg border border-[#df242c] text-[#df242c] hover:bg-[#df242c] hover:text-white transition-colors flex items-center justify-center gap-1 text-xs min-w-0 h-8'
                    onClick={() => downloadTranscript(messages)}
                    aria-label='Chat herunterladen'
                    type='button'
                  >
                    <Download className='w-4 h-4' />
                    <span className='font-medium'>Gespräch herunterladen</span>
                  </button>
                  {/* Status-Badge: Immer am unteren Rand des Chatfensters (unsichtbar gemacht) */}
                  <div className="w-full flex justify-center pt-2" style={{display:'none'}}>
                    {connectionStatus === 'connected' && (
                      <div className="inline-flex items-center bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full shadow-md">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>Verbunden
                      </div>
                    )}
                    {connectionStatus === 'connecting' && (
                      <div className="inline-flex items-center bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full shadow-md">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></span>Verbinde…
                      </div>
                    )}
                    {connectionStatus === 'disconnected' && (
                      <div className="inline-flex items-center bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full shadow-md">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Nicht verbunden
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        {/* Status-Badge: Unter den Action-Buttons, wenn Chat geschlossen */}
        {!showChat && (
          <div className="w-full flex justify-center mb-2" style={{ display: 'none' }}>
            {/* Status-Badge ist jetzt unsichtbar, da Status am Button angezeigt wird */}
            {connectionStatus === 'connected' && (
              <div className="inline-flex items-center bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full shadow-md">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>Verbunden
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div className="inline-flex items-center bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full shadow-md">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></span>Verbinde…
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="inline-flex items-center bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full shadow-md">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Nicht verbunden
              </div>
            )}
          </div>
        )}
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
              Mit dem Klick auf <b>„Zustimmen“</b> und bei jeder weiteren Interaktion mit diesem KI-Agenten erklärst <b>du</b> dich damit einverstanden, dass <b>deine</b> Kommunikation aufgezeichnet, gespeichert und mit Drittanbietern geteilt wird – wie in der <a href="https://www.moelders.de/datenschutz" target="_blank" rel="noopener noreferrer" className="underline text-[#df242c]">Datenschutzrichtlinie</a> beschrieben.<br /><br />
              Wenn <b>du</b> nicht möchtest, dass <b>deine</b> Gespräche aufgezeichnet werden, verzichte bitte auf die Nutzung dieses Dienstes.
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
    </div>
  )
}