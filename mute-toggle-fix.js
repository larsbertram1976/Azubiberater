// Die grundlegende Idee ist eine stark vereinfachte Mikrofonsteuerung zu implementieren
// und diese in VoiceAssistant.js zu ersetzen

// Vereinfachte Version der Mikrofon-Mute/Unmute-Funktion:
const handleMuteToggle = useCallback(() => {
  console.log('Mikrofon-Button geklickt, aktueller Status:', isMuted);
  
  // Bei jeder Aktion neuen Status berechnen
  const newMuteState = !isMuted;
  
  // Sofort Status setzen für schnellere Benutzerreaktion
  setIsMuted(newMuteState);
  
  // Meldung ausgeben
  console.log(`Mikrofon wird ${newMuteState ? 'stummgeschaltet' : 'aktiviert'}`);
  
  // Wenn stummschalten:
  if (newMuteState) {
    // 1. Recognition stoppen
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('SpeechRecognition gestoppt');
      } catch (e) { 
        console.error('Fehler beim Stoppen von SpeechRecognition:', e);
      }
    }
    
    // 2. Mikrofon-Tracks deaktivieren
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
          console.log('Audio-Track deaktiviert:', track.label);
        });
      } catch (e) {
        console.error('Fehler beim Deaktivieren von Audio-Tracks:', e);
      }
    }
  }
  // Wenn aktivieren:
  else {
    // Mikrofon-Berechtigung prüfen
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Stream wieder freigeben, da wir ihn nur für die Berechtigung brauchen
        stream.getTracks().forEach(track => track.stop());
        
        // 1. Vorhandene Tracks aktivieren
        if (micStreamRef.current) {
          micStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = true;
            console.log('Audio-Track aktiviert:', track.label);
          });
        }
        
        // 2. SpeechRecognition neu starten
        if (recognitionRef.current && isActive) {
          try {
            recognitionRef.current.start();
            console.log('SpeechRecognition neu gestartet');
          } catch (e) {
            console.error('Fehler beim Neustart von SpeechRecognition:', e);
          }
        }
      })
      .catch(err => {
        console.error('Mikrofon-Zugriff verweigert:', err);
        alert(APP_CONFIG.microphoneLabels.permissionDenied);
        setIsMuted(true); // Auf stumm zurücksetzen, da keine Berechtigung
      });
  }
}, [isMuted, isActive]);
