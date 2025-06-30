// components/VoiceAssistant.jsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, MessageCircle, Bot, User, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { downloadTranscript } from '@/utils/transcript'
import { Conversation } from '@11labs/client'
import { getSignedUrl } from '@/app/actions/getSignedUrl'
export default function VoiceAssistant() {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isMuted, setIsMuted] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const scrollAreaRef = useRef(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const startConversation = async () => {
    try {
      setConnectionStatus('connecting')
      // Get signed URL using server action
      const { signedUrl } = await getSignedUrl()
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
        },
      })
      setConversation(conv)
      setIsActive(true)
      setConnectionStatus('connected')
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setConnectionStatus('disconnected')
    }
  }

  const endConversation = async () => {
    if (conversation) {
      await conversation.endSession()
      setConversation(null)
      setIsSpeaking(false)
      setIsActive(false)
      setConnectionStatus('disconnected')
    }
  }

  // Mute/unmute microphone without ending conversation
  const handleMuteToggle = () => {
    setIsMuted((prev) => !prev)
    if (conversation && conversation.setMuted) {
      conversation.setMuted(!isMuted)
    }
  }

  // Text abschicken (an Agenten senden) – ElevenLabs SDK-konform, ohne Status-Check und Fehlerausgabe
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
      // Fehler beim Senden an ElevenLabs SDK: err
    }
  };

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-white p-4'>
      <div className='w-full max-w-sm mx-auto flex flex-col items-center'>
        {/* Firmenlogo oben auf der Seite - noch weiter nach oben */}
        <div className="w-full flex justify-center mb-2 mt-0">
          <img
            src="/public-pics/moelders-logo.png"
            alt="Mölders Firmenlogo"
            className="h-32 object-contain"
            style={{ maxWidth: 600 }}
          />
        </div>

        {/* Voice Assistant Circle */}
        <div className='relative flex flex-col items-center mb-8'>
          {/* Pulsierende Ringe: subtil, nach rechts oben versetzt */}
          <div className="absolute top-1/2 left-1/2 pointer-events-none z-0">
            {isSpeaking && (
              <>
                <div className="w-44 h-44 rounded-full bg-[#dd232d] opacity-20 animate-ping-slow absolute" style={{ top: '-20%', left: '20%' }} />
                <div className="w-56 h-56 rounded-full bg-[#dd232d] opacity-10 animate-ping-slow absolute" style={{ top: '-30%', left: '30%', animationDelay: '1.2s' }} />
              </>
            )}
          </div>
          <div className='w-40 h-40 rounded-full border-8 border-[#dd232d] bg-gray-100 flex items-center justify-center shadow-md overflow-hidden relative z-10'>
            <img
              src='/public-pics/anna.jpg'
              alt='Anna, Azubiberaterin'
              className='w-full h-full object-cover rounded-full'
            />
          </div>
          {/* Start/End Conversation Button klar darunter */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={isActive ? endConversation : startConversation}
            className={`mt-4 mb-2 px-6 py-2 rounded-full text-base font-semibold shadow-md transition-all duration-200 focus:outline-none
              ${isActive ? 'bg-gray-200 text-[#dd232d] hover:bg-gray-300' : 'bg-[#dd232d] text-white hover:bg-[#b81c24]'}
            `}
            aria-label={isActive ? 'Gespräch beenden' : 'Gespräch starten'}
          >
            {isActive ? 'Gespräch beenden' : 'Gespräch starten'}
          </motion.button>
        </div>

        {/* Show/Hide chat button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowChat(!showChat)}
          className='mb-4 px-6 py-2 rounded-full bg-gray-100 text-[#252422] text-base font-medium flex items-center justify-center space-x-2 shadow-sm border border-gray-200 hover:bg-gray-200 transition-colors'
        >
          <MessageCircle className='w-5 h-5' />
          <span>{showChat ? 'Chat verbergen' : 'Zeige Chat'}</span>
        </motion.button>

        {/* Chat area */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className='w-full bg-white rounded-3xl overflow-hidden shadow-xl mb-2 mt-6 border border-[#eee]'
              style={{ boxShadow: '0 4px 32px 0 rgba(34,34,34,0.10)', backdropFilter: 'blur(0.5px)' }}
            >
              {/* Header mit Avatar und Status */}
              <div className='flex items-center gap-3 px-6 pt-6 pb-2'>
                <img
                  src='/public-pics/anna.jpg'
                  alt='Anna, Azubiberaterin'
                  className='w-10 h-10 rounded-full border-2 border-[#dd232d] object-cover shadow'
                />
                <span className='bg-gray-100 text-gray-500 text-base rounded-full px-4 py-1 font-medium'>Ich höre Dir zu...</span>
              </div>
              {/* Chatverlauf */}
              <div
                ref={scrollAreaRef}
                className='h-80 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-[#eee] scrollbar-track-[#fafafa]'
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
                        src='/public-pics/anna.jpg'
                        alt='Anna, Azubiberaterin'
                        className='w-8 h-8 rounded-full border border-[#dd232d] object-cover mr-2'
                      />
                    )}
                    <div
                      className={`rounded-2xl px-5 py-3 text-base font-normal max-w-[80%] shadow-sm border transition-all ${
                        message.source === 'user'
                          ? 'bg-[#dd232d] text-white border-[#dd232d] text-right rounded-br-3xl rounded-tl-3xl rounded-bl-3xl'
                          : 'bg-gray-100 text-[#252422] border-gray-200 text-left rounded-bl-3xl rounded-tr-3xl rounded-tl-3xl'
                      }`}
                    >
                      {message.message}
                    </div>
                  </div>
                ))}
              </div>
              {/* Inputbereich entfernt, Download Button hinzugefügt */}
              <div className='flex items-center justify-end gap-2 px-4 pb-3 pt-1 border-t border-[#eee] bg-white'>
                <button
                  className='p-1.5 rounded-lg border border-[#dd232d] text-[#dd232d] hover:bg-[#dd232d] hover:text-white transition-colors flex items-center gap-1'
                  onClick={() => downloadTranscript(messages)}
                  aria-label='Chat herunterladen'
                  type='button'
                >
                  <Download className='w-4 h-4' />
                  <span className='text-sm font-medium'>Download</span>
                </button>
              </div>
              {/* Status-Badge jetzt am Ende des Chatfensters */}
              <div className='flex justify-center mt-4 mb-2'>
                {connectionStatus === 'connected' && (
                  <div className="inline-flex items-center bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>Verbunden
                  </div>
                )}
                {connectionStatus === 'connecting' && (
                  <div className="inline-flex items-center bg-yellow-100 text-yellow-700 text-sm px-3 py-1 rounded-full">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>Verbinde…
                  </div>
                )}
                {connectionStatus === 'disconnected' && (
                  <div className="inline-flex items-center bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>Nicht verbunden
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status-Badge am Seitenende, wenn Chat zu */}
        {!showChat && (
          <div className='flex justify-center mt-4 mb-2'>
            {connectionStatus === 'connected' && (
              <div className="inline-flex items-center bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>Verbunden
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div className="inline-flex items-center bg-yellow-100 text-yellow-700 text-sm px-3 py-1 rounded-full">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>Verbinde…
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="inline-flex items-center bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>Nicht verbunden
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}