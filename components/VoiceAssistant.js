// components/VoiceAssistant.jsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, MessageCircle, Bot, User, Download, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { downloadTranscript } from '@/utils/transcript'
import { Conversation } from '@11labs/client'
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
      const conv = await Conversation.startSession({
        signedUrl,
        onMessage: (message) => {
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
          alert('Agentenfehler: ' + error.message)
          setConnectionStatus('disconnected')
        },
        onStatusChange: (status) => {
          setConnectionStatus(
            status.status === 'connected' ? 'connected' : 'disconnected'
          )
        },
        onModeChange: (mode) => {
          setIsSpeaking(mode.mode === 'speaking')
          if (mode.mode === 'speaking') setPendingAgentMessage(true)
        },
      })
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

  // Text abschicken (an Agenten senden) – SDK-konform, ohne Status-Check und Fehlerausgabe
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !conversation) return;
    setMessages((prev) => [
      ...prev,
      { source: "user", message: text },
    ]);
    setInputValue("");
    try {
      if (typeof conversation.input === 'function') {
        if (connectionStatus !== 'connected') {
          // Agent nicht verbunden, Textinput wird ignoriert!
          return;
        }
        await conversation.input({ text });
      } else {
        // conversation.input ist keine Funktion! Conversation: conversation
      }
    } catch (err) {
      // Fehler beim Senden an das SDK: err
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

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-white p-4'>
      <div className='w-full max-w-sm mx-auto flex flex-col items-center'>
        {/* Firmenlogo oben auf der Seite - noch weiter nach oben */}
        <div className="w-full flex justify-center mb-0" style={{ marginTop: '-32px', marginBottom: '-8px' }}>
          <img
            src="/public-pics/moelders-logo.png"
            alt="Mölders Firmenlogo"
            className="h-28 object-contain"
            style={{ maxWidth: 600 }}
          />
        </div>
        {/* Begrüßungstext und Einleitung */}
        <div className="w-full flex flex-col items-center text-center mb-3 px-2">
          <h2 className="text-lg font-semibold text-[#252422] mb-1">Willkommen beim Mölders Job & Azubiberater!</h2>
          <p className="text-sm text-gray-700 max-w-md leading-snug mb-2">
            Du hast Fragen zu Ausbildung, Jobs oder möchtest mehr über Mölders als Arbeitgeber wissen?
          </p>
          <p className="text-sm text-gray-700 max-w-md leading-snug mb-2">
            Wähle deinen Berater: Anna oder Joshua beantworten dir gerne alle Fragen rund um offene Stellen, den Bewerbungsprozess und unsere Ausbildungsangebote.
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
          .animate-pulse-spin-slow { animation: pulse-spin-slow 2.5s linear infinite; }
          .animate-pulse-spin-rev { animation: pulse-spin-rev 2.2s linear infinite; }
          .animate-pulse-scale { animation: pulse-scale 2.8s ease-in-out infinite; }

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
          <span className="text-sm text-gray-700 font-medium mb-1">Mit wem möchtest du sprechen?</span>
          <div className="flex flex-row items-center justify-center gap-8 relative">
            {/* Anna */}
            <div className="relative flex flex-col items-center justify-center" style={{minWidth: '8rem', minHeight: '8rem'}}>
              {selectedAgent === 'anna' && isSpeaking && (
                <>
                  <span className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                    <span className="block w-52 h-52 rounded-full bg-gradient-to-tr from-[#dd232d] via-[#ff6f61] to-[#dd232d] opacity-20 animate-pulse-spin-slow blur-[4px]" style={{position:'absolute'}}></span>
                    <span className="block w-40 h-40 rounded-full bg-gradient-to-br from-[#ff6f61] via-[#dd232d] to-[#ffb199] opacity-20 animate-pulse-spin-rev blur-[6px]" style={{position:'absolute'}}></span>
                    <span className="block w-32 h-32 rounded-full bg-gradient-to-br from-[#ffb199] via-[#ff6f61] to-[#dd232d] opacity-30 animate-pulse-scale blur-[8px]" style={{position:'absolute'}}></span>
                  </span>
                  {/* Modern Voice Bars, leicht nach unten verschoben und immer zentriert */}
                  <span className="voice-bars" style={{top: '62%', left: '50%', transform: 'translate(-50%, 0)'}}>
                    <span className="voice-bar" />
                    <span className="voice-bar" />
                    <span className="voice-bar" />
                    <span className="voice-bar" />
                    <span className="voice-bar" />
                  </span>
                </>
              )}
              <button
                onClick={() => {
                  if (isActive) {
                    setShowAgentSwitchHint('anna')
                  } else {
                    setSelectedAgent('anna')
                  }
                }}
                className={`flex flex-col items-center focus:outline-none transition-all duration-200 relative z-10`}
                aria-label="Anna auswählen"
                type="button"
                style={{ background: 'none', border: 'none', padding: 0 }}
                disabled={false}
              >
                <img
                  src="/public-pics/anna.jpg"
                  alt="Anna, Azubiberaterin"
                  className={`object-cover shadow rounded-full border-4 border-[#dd232d] transition-all duration-300 relative ${selectedAgent === 'anna' ? 'w-32 h-32 z-10' : 'w-20 h-20 opacity-60 grayscale'}`}
                />
                <span className="text-xs font-medium text-[#252422] mt-2">Anna</span>
              </button>
              {/* Dezent eingeblendeter Hinweis nur einmal anzeigen */}
              {showAgentSwitchHint === 'anna' && isActive && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#252422] text-white text-xs rounded-lg px-3 py-1 shadow-lg opacity-90 z-30 transition-all duration-200 whitespace-nowrap pointer-events-none">
                  Du bist gerade im Gespräch. Bitte beende das aktuelle Gespräch, um den Assistenten zu wechseln.
                </div>
              )}
            </div>
            {/* Joshua */}
            <div className="relative flex flex-col items-center justify-center" style={{minWidth: '8rem', minHeight: '8rem'}}>
              {selectedAgent === 'joshua' && isSpeaking && (
                <>
                  <span className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                    <span className="block w-52 h-52 rounded-full bg-gradient-to-tl from-[#028e4a] via-[#4be585] to-[#028e4a] opacity-20 animate-pulse-spin-rev blur-[4px]" style={{position:'absolute'}}></span>
                    <span className="block w-40 h-40 rounded-full bg-gradient-to-br from-[#4be585] via-[#028e4a] to-[#baffc9] opacity-20 animate-pulse-spin-slow blur-[6px]" style={{position:'absolute'}}></span>
                    <span className="block w-32 h-32 rounded-full bg-gradient-to-br from-[#baffc9] via-[#4be585] to-[#028e4a] opacity-30 animate-pulse-scale blur-[8px]" style={{position:'absolute'}}></span>
                  </span>
                  {/* Modern Voice Bars, leicht nach unten verschoben und immer zentriert */}
                  <span className="voice-bars" style={{top: '62%', left: '50%', transform: 'translate(-50%, 0)'}}>
                    <span className="voice-bar joshua1" />
                    <span className="voice-bar joshua2" />
                    <span className="voice-bar joshua3" />
                    <span className="voice-bar joshua4" />
                    <span className="voice-bar joshua5" />
                  </span>
                </>
              )}
              <button
                onClick={() => {
                  if (isActive) {
                    setShowAgentSwitchHint('joshua')
                  } else {
                    setSelectedAgent('joshua')
                  }
                }}
                className={`flex flex-col items-center focus:outline-none transition-all duration-200 relative z-10`}
                aria-label="Joshua auswählen"
                type="button"
                style={{ background: 'none', border: 'none', padding: 0 }}
                disabled={false}
              >
                <img
                  src="/public-pics/joshua.jpg"
                  alt="Joshua, Azubiberater"
                  className={`object-cover shadow rounded-full border-4 border-[#028e4a] transition-all duration-300 relative ${selectedAgent === 'joshua' ? 'w-32 h-32 z-10' : 'w-20 h-20 opacity-60 grayscale'}`}
                />
                <span className="text-xs font-medium text-[#252422] mt-2">Joshua</span>
              </button>
              {/* Dezent eingeblendeter Hinweis nur einmal anzeigen */}
              {showAgentSwitchHint === 'joshua' && isActive && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#252422] text-white text-xs rounded-lg px-3 py-1 shadow-lg opacity-90 z-30 transition-all duration-200 whitespace-nowrap pointer-events-none">
                  Du bist gerade im Gespräch. Bitte beende das aktuelle Gespräch, um den Assistenten zu wechseln.
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Voice Assistant Circle entfernt, Button bleibt */}
        <div className='flex flex-col items-center mb-8'>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={isActive ? endConversation : startConversation}
            className={`mb-2 px-6 py-2 rounded-2xl text-base font-semibold shadow-md transition-all duration-200 focus:outline-none
              ${isActive ? 'bg-gray-200 text-[#dd232d] hover:bg-gray-300' : selectedAgent === 'anna' ? 'bg-[#dd232d] text-white hover:bg-[#b81c24]' : 'bg-[#028e4a] text-white hover:bg-[#026c39]'}
              ${!privacyChecked && !isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={isActive ? 'Gespräch beenden' : 'Gespräch starten'}
            disabled={!privacyChecked && !isActive}
          >
            {isActive ? 'Gespräch beenden' : `Gespräch mit ${selectedAgent === 'anna' ? 'Anna' : 'Joshua'} starten`}
          </motion.button>
        </div>
        {/* Datenschutz-Checkbox kompakt und direkt unter dem Button, Abstand nach unten vergrößert */}
        <div className="flex w-full justify-center" style={{ marginTop: '-14px', marginBottom: '18px' }}>
          <div className="flex items-center">
            <input
              id="privacy-check"
              type="checkbox"
              checked={privacyChecked}
              onChange={e => {
                if (!privacyAccepted) {
                  setShowPrivacyModal(true)
                } else {
                  setPrivacyChecked(e.target.checked)
                }
              }}
              className="mr-1 accent-[#dd232d]"
              style={{ width: '14px', height: '14px' }}
              disabled={isActive}
            />
            <label htmlFor="privacy-check" className="text-[11px] text-gray-700 select-none cursor-pointer" style={{lineHeight:1.1}}>
              Ich akzeptiere die <span className="underline text-[#dd232d] cursor-pointer" onClick={e => {e.preventDefault(); window.open('https://www.moelders.de/datenschutz', '_blank', 'noopener,noreferrer')}}>Datenschutzrichtlinie</span>
            </label>
          </div>
        </div>
        {/* Action Buttons: Chat, Mail, Jobs in einer Zeile */}
        {/* Zeige Chat Button: eigene Zeile, volle Breite, max wie Chatfenster */}
        <div className="flex w-full justify-center mb-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowChat(!showChat)}
            className='w-full max-w-[420px] px-2 py-2 rounded-xl bg-gray-100 text-[#252422] text-xs font-semibold flex flex-row items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-200 transition-colors h-11 mb-2'
            type="button"
            style={{lineHeight: 1.1}}
          >
            <MessageCircle className='w-4 h-4 mr-2' />
            <span className='leading-tight'>{showChat ? 'Chat verbergen' : 'Zeige Chat'}</span>
          </motion.button>
        </div>
        <div className="flex flex-row gap-3 mb-2 w-full justify-center max-w-[420px] mx-auto">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.location.href = 'mailto:personalabteilung@moelders.de'}
            className='flex-1 px-2 py-1.5 rounded-xl bg-[#dd232d] text-white text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 shadow-sm border border-[#dd232d] hover:bg-[#b81c24] transition-colors h-10 min-w-0'
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
            className='flex-1 px-2 py-1.5 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 shadow-sm border border-[#25D366] hover:bg-[#1ebe57] transition-colors h-10 min-w-0'
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
            className='flex-1 px-2 py-1.5 rounded-xl bg-[#252422] text-white text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 shadow-sm border border-[#252422] hover:bg-[#444] transition-colors h-10 min-w-0'
            type="button"
            style={{lineHeight: 1.1}}
          >
            <Bot className='w-4 h-4 mb-0.5' />
            <span className='leading-tight'>Stellen</span>
          </motion.button>
        </div>
        {/* Chat area */}
        <AnimatePresence>
          {showChat && (
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
                  src={selectedAgent === 'anna' ? '/public-pics/anna.jpg' : '/public-pics/joshua.jpg'}
                  alt={selectedAgent === 'anna' ? 'Anna, Azubiberaterin' : 'Joshua, Azubiberater'}
                  className='w-8 h-8 rounded-full border border-[#dd232d] object-cover shadow'
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
                        src={selectedAgent === 'anna' ? '/public-pics/anna.jpg' : '/public-pics/joshua.jpg'}
                        alt={selectedAgent === 'anna' ? 'Anna, Azubiberaterin' : 'Joshua, Azubiberater'}
                        className='w-7 h-7 rounded-full border border-[#dd232d] object-cover mr-2'
                      />
                    )}
                    <div
                      className={
                        message.source === 'user'
                          ? 'bg-gradient-to-br from-[#dd232d] to-[#b81c24] text-white border border-[#dd232d] text-right px-5 py-2 max-w-[75%] shadow-lg relative user-bubble'
                          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-[#252422] border border-gray-200 text-left px-5 py-2 max-w-[75%] shadow-lg relative agent-bubble'
                      }
                      style={{ fontSize: 13, lineHeight: 1.45, minWidth: 60, borderRadius: message.source === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px' }}
                    >
                      {message.message}
                      {/* Sprechblasen-Pfeil wie im Beispielbild */}
                      {message.source === 'user' ? (
                        <span style={{ position: 'absolute', right: -8, bottom: 0, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '12px solid #b81c24' }} />
                      ) : (
                        <span style={{ position: 'absolute', left: -8, bottom: 0, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '12px solid #e5e7eb' }} />
                      )}
                    </div>
                  </div>
                ))}
                {/* Ladeindikator für Agenten-Nachricht, wenn Anna spricht aber noch keine neue Nachricht */}
                {pendingAgentMessage && (
                  <div className="flex justify-start items-end w-full">
                    <img
                      src={selectedAgent === 'anna' ? '/public-pics/anna.jpg' : '/public-pics/joshua.jpg'}
                      alt={selectedAgent === 'anna' ? 'Anna, Azubiberaterin' : 'Joshua, Azubiberater'}
                      className='w-7 h-7 rounded-full border border-[#dd232d] object-cover mr-2'
                    />
                    <div className='bg-gradient-to-br from-gray-100 to-gray-200 text-[#252422] border border-gray-200 text-left px-5 py-2 max-w-[75%] shadow-lg relative agent-bubble flex items-center gap-2' style={{ fontSize: 13, lineHeight: 1.45, minWidth: 60, borderRadius: '18px 18px 18px 4px' }}>
                      <span className="animate-pulse">Anna schreibt...</span>
                      <span className="ml-1 w-2 h-2 rounded-full bg-[#dd232d] animate-pulse"></span>
                      <span style={{ position: 'absolute', left: -8, bottom: 0, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '12px solid #e5e7eb' }} />
                    </div>
                  </div>
                )}
              </div>
              {/* Inputbereich entfernt, Download Button hinzugefügt */}
              <div className='flex items-center justify-end gap-2 px-4 pb-3 pt-1 border-t border-[#eee] bg-white'>
                <button
                  className='p-1.5 rounded-lg border border-[#dd232d] text-[#dd232d] hover:bg-[#dd232d] hover:text-white transition-colors flex items-center gap-1 text-xs'
                  onClick={() => downloadTranscript(messages)}
                  aria-label='Chat herunterladen'
                  type='button'
                >
                  <Download className='w-4 h-4' />
                  <span className='font-medium'>Lade dir unser Gespräch runter</span>
                </button>
              </div>
              {/* Status-Badge jetzt am Ende des Chatfensters */}
              <div className='flex justify-center mt-2 mb-2'>
                {connectionStatus === 'connected' && (
                  <div className="inline-flex items-center bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>Verbunden
                  </div>
                )}
                {connectionStatus === 'connecting' && (
                  <div className="inline-flex items-center bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></span>Verbinde…
                  </div>
                )}
                {connectionStatus === 'disconnected' && (
                  <div className="inline-flex items-center bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Nicht verbunden
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status-Badge am Seitenende, wenn Chat zu */}
        {!showChat && (
          <div className='flex justify-center mt-3 mb-1'>
            {connectionStatus === 'connected' && (
              <div className="inline-flex items-center bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>Verbunden
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div className="inline-flex items-center bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></span>Verbinde…
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="inline-flex items-center bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Nicht verbunden
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}