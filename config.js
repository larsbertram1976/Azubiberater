// Zentrale Konfiguration für verschiedene Use Cases
export const APP_CONFIG = {
  // --- Branding & Agent ---
  appName: 'Möldi', // Name des Assistenten
  agentSticker: 'Möldi', // Sticker-Text beim Agentenbild
  agentImage: "/public-pics/Moeldi.png", // Agentenbild

  // --- Header & Einleitung ---
  headerTitle: "Hey – Deine Idee zählt!", // Hauptüberschrift
  headerDescription: `Ich bin <span style=\"font-style:italic;\">Möldi</span>, dein <span style=\"color:#df242c;font-weight:bold;\">KI Ideenassistent</span> bei Mölders.<br />\nTeile mit mir, was dich im Alltag nervt oder wo du Potenzial für Verbesserung siehst.<br />\nAuf Basis deines Inputs entwickeln wir mit KI passende Lösungsansätze – schnell und konkret.<br />\nStarte jetzt das Gespräch und mach uns gemeinsam smarter!`, // Beschreibungstext

  // --- Hauptbutton & Gespräch ---
  buttonTextInactive: 'Gespräch mit KI-Möldi starten', // Text, wenn Gespräch nicht aktiv
  startConversationButtonText: 'Sprich mit Möldi', // Text, wenn Gespräch aktiv
  conversationButtonTexts: [ // Texte, die im Gespräch rotieren
    "Gespräch läuft...",
    "Nenn mir deine Ideen und Anregungen...",
    "Zum Beenden klicken..."
  ],

  // --- Chatbereich ---
  chatToggleShow: "Chatverlauf anzeigen", // Button zum Öffnen des Chatverlaufs
  chatToggleHide: "Chatverlauf zuklappen", // Button zum Schließen des Chatverlaufs
  inputPlaceholder: "Schreib deine Nachricht hier rein ...", // Placeholder im Eingabefeld
  chatEmptyText: 'Hier erscheint dein Chatverlauf mit Möldi.', // Text, wenn noch keine Nachrichten

  // --- E-Mail & Aktionen ---
  emailButtonText: "E-Mail senden", // Text auf E-Mail-Button
  mailUrl: "mailto:azubianfragen@moelders.de?subject=Anfrage%20Azubiberatung", // E-Mail-Link

  // --- Aktionsbuttons unten im Chat ---
  actionButtons: [
    {
      label: "E-Mail senden",
      icon: "mail", // z.B. React-Icon-Komponente oder String
      url: "mailto:azubianfragen@moelders.de?subject=Anfrage%20Azubiberatung",
      visible: false
    },
    {
      label: "WhatsApp",
      icon: "whatsapp",
      url: "https://wa.me/49123456789",
      visible: false // auf true setzen, wenn anzeigen
    },
    {
      label: "Jobbörse",
      icon: "briefcase",
      url: "https://jobboerse.example.com",
      visible: false
    }
  ],

  // --- Datenschutz ---
  privacyLabel: "Ich akzeptiere die Datenschutzrichtlinie", // Label bei Checkbox
  privacyLink: "https://www.moelders.de/datenschutz", // Link zur Datenschutzseite
  privacyModalText: `Mit dem Klick auf <b>„Zustimmen“</b> und bei jeder weiteren Interaktion mit diesem KI-Agenten erklärst Du Dich damit einverstanden, dass Deine Kommunikation aufgezeichnet, gespeichert und mit Drittanbietern geteilt wird – wie in der <a href=\"https://www.moelders.de/datenschutz\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"underline text-[#df242c]\">Datenschutzrichtlinie</a> beschrieben.<br /><br />Wenn Du nicht möchtest, dass Deine Gespräche aufgezeichnet werden, verzichte bitte auf die Nutzung dieses Dienstes.<br /><br />`, // Text im Datenschutz-Modal
  privacyModalAccept: "Annehmen", // Button im Modal
  privacyModalDecline: "Ablehnen", // Button im Modal

  // --- Hintergrund & Branding ---
  backgroundImage: "/public-pics/Leuchtturm.png", // Hintergrundbild
  primaryColor: "#df242c", // Hauptfarbe (z.B. Buttons, Agent)
  secondaryColor: "#b81c24", // Sekundärfarbe

  // --- Tab & Favicon ---
  tabTitle: "Mölders Ideenmanager", // Browser-Tab-Titel
  tabDescription: "Ideenmanager für Mölders", // Browser-Tab-Beschreibung
  favicon: "/favicon-Moelders.ico", // Favicon

  // --- Chat Bubble Styles ---
  agentBubbleClass: 'bg-[#df242c] text-white', // Agenten-Bubble: Hintergrund/Text
  userBubbleClass: 'bg-[#ededed] text-[#252422]', // User-Bubble: Hintergrund/Text

  // --- UI Farben & Styles ---
  mainButtonColor: '#df242c', // Hauptbutton-Farbe
  mainButtonHoverColor: '#b81c24', // Hover-Farbe Hauptbutton
  mainButtonTextColor: 'white', // Textfarbe Hauptbutton
  mainButtonBorderColor: '#df242c', // Rahmenfarbe Hauptbutton
  mainButtonDisabledOpacity: 0.5, // Opazität bei deaktiviertem Button

  muteButtonColor: '#ededed', // Mikrofon-Button Standard
  muteButtonMutedColor: 'orange', // Mikrofon-Button wenn gemutet
  muteButtonMutedBg: 'bg-orange-400', // Mikrofon-Button gemutet Hintergrund
  muteButtonMutedText: 'text-white', // Mikrofon-Button gemutet Text
  muteButtonMutedBorder: 'border-orange-400', // Mikrofon-Button gemutet Rahmen
  muteButtonUnmutedBg: 'bg-[#ededed]', // Mikrofon-Button unmuted Hintergrund
  muteButtonUnmutedText: 'text-[#252422]', // Mikrofon-Button unmuted Text
  muteButtonUnmutedBorder: 'border-gray-300', // Mikrofon-Button unmuted Rahmen
  muteButtonHoverBg: 'hover:bg-[#df242c]', // Mikrofon-Button Hover Hintergrund
  muteButtonHoverText: 'hover:text-white', // Mikrofon-Button Hover Text

  inputFocusColor: '#df242c', // Farbe beim Fokus auf Eingabefeld

  chatLinkColor: 'text-blue-600', // Linkfarbe im Chat
  chatLinkHoverColor: 'hover:text-blue-800', // Linkfarbe im Chat bei Hover

  privacyAcceptBg: 'bg-[#df242c]', // Datenschutz-Modal: Annehmen Button Hintergrund
  privacyAcceptText: 'text-white', // Datenschutz-Modal: Annehmen Button Text
  privacyAcceptHoverBg: 'hover:bg-[#b81c24]', // Datenschutz-Modal: Annehmen Button Hover
  privacyDeclineBg: 'bg-gray-200', // Datenschutz-Modal: Ablehnen Button Hintergrund
  privacyDeclineText: 'text-gray-700', // Datenschutz-Modal: Ablehnen Button Text
  privacyDeclineHoverBg: 'hover:bg-gray-300', // Datenschutz-Modal: Ablehnen Button Hover
  privacyModalBorder: 'border-[#eee]', // Datenschutz-Modal: Rahmen

  agentImageBorder: 'border-[#df242c]', // Rahmen um Agentenbild

  // --- SVG Farben ---
  svgCheckColor: '#fff', // Farbe für Check-Icon
  svgBarColor: '#222', // Farbe für Balken-Icons

  // --- Animationen ---
  animationProfilePulse: 'profile-pulse 1.6s cubic-bezier(0.4,0,0.2,1) infinite', // Agentenbild-Puls
  animationPulseSpinSlow: 'pulse-spin-slow 2.5s linear infinite', // Glow-Effekt langsam
  animationPulseSpinRev: 'pulse-spin-rev 2.2s linear infinite', // Glow-Effekt reverse
  animationPulseScale: 'pulse-scale 2.8s ease-in-out infinite', // Glow-Effekt scale
  animationMarquee: 'marquee 8s linear infinite', // Marquee-Text

  // --- Card & Badge Styles ---
  cardBg: 'bg-card', // Card Hintergrund
  cardText: 'text-card-foreground', // Card Text
  badgeBg: 'bg-primary', // Badge Hintergrund
  badgeText: 'text-primary-foreground' // Badge Text
}
// --- Ende APP_CONFIG ---
