// Zentrale Konfiguration aller UI-Elemente, Farben, Texte, Agentenbilder, Aktionsbuttons, Datenschutz, Animationen etc.
// Alle Anpassungen für Branding, Layout und Verhalten erfolgen hier
// Wird von allen Komponenten für einheitliches Design und Verhalten verwendet

// Zentrale Konfiguration für verschiedene Use Cases
export const APP_CONFIG = {
  // --- Branding & Agent ---
  appName: 'Anna', // Name des Assistenten, wird für Branding und UI verwendet
  agentSticker: 'Anna', // Sticker-Text, erscheint am Agentenbild
  agentImage: "/public-pics/Anna-Avatar-final.jpg", // Pfad zum Agentenbild

  // --- Header & Einleitung ---
  headerTitle: "Hey – Schön dass Du da bist!", // Hauptüberschrift im Header
  headerDescription: `Ich bin <b style="color:#df242c">Anna</b>, eure <b style="color:#df242c">KI-Azubiberaterin</b> – die digitale Schwester unserer Personalreferentin & Ausbildungsleiterin.<br />
Seit 2019 bin ich bei Mölders eure <b style="color:#df242c">Ansprechpartnerin</b> rund um <b style="color:#df242c">Ausbildung</b> & <b style="color:#df242c">Karriere</b>.<br />
<b style="color:#222">Sprecht mich einfach an</b> – direkt & unkompliziert oder nutz die Kontaktmöglichkeiten unten.`, // Beschreibungstext im Header, HTML erlaubt für Hervorhebungen

  // --- Hauptbutton & Gespräch ---
  buttonTextInactive: 'Gespräch mit KI-Anna starten', // Text auf Hauptbutton, wenn Gespräch nicht aktiv
  startConversationButtonText: 'Sprich mit Anna', // Text auf Hauptbutton, wenn Gespräch aktiv
  conversationButtonTexts: [ // Texte, die im Gespräch rotieren (Animation)
    "Gespräch läuft...",
    "Stell deine Fragen zum Arbeiten bei uns...",
    "Zum Beenden klicken..."
  ],

  // --- Chatbereich ---
  chatToggleShow: "Chatverlauf anzeigen", // Buttontext zum Öffnen des Chatverlaufs
  chatToggleHide: "Chatverlauf zuklappen", // Buttontext zum Schließen des Chatverlaufs
  inputPlaceholder: "Schreib deine Nachricht hier rein ...", // Placeholder im Eingabefeld
  chatEmptyText: 'Hier erscheint dein Chatverlauf mit KI-Anna.', // Text, wenn noch keine Nachrichten vorhanden sind

  // --- E-Mail & Aktionen ---
  emailButtonText: "E-Mail senden", // Text auf E-Mail-Button unten im Chat
  mailUrl: "mailto:azubianfragen@moelders.de?subject=Anfrage%20Azubiberatung", // E-Mail-Link für Aktionsbutton

  // --- Aktionsbuttons unten im Chat ---
  actionButtons: [
    {
      label: "E-Mail senden", // Buttontext
      icon: "mail", // Icon-Typ (wird in UI gemappt)
      url: "mailto:azubianfragen@moelders.de?subject=Anfrage%20Azubiberatung", // Linkziel
      visible: true // Sichtbarkeit des Buttons
    },
    {
      label: "WhatsApp",
      icon: "whatsapp",
      url: "https://api.whatsapp.com/send/?phone=4915123206142&text=„Hallo+Mölders+Holding+GmbH.+Ich+möchte+gerne+per+WhatsApp+mit+Ihnen+zur+Beantwortung+meiner+Anfragen+kommunizieren.+Ich+bin+damit+einverstanden%2C+dass+hierzu+sowie+zur+Erbringung+des+Dienstes+meine+Daten+%28Daten+aus+meinem+WhatsApp-Profil+und+zu+meinen+genutzten+Endgeräten+sowie+von+mir+mitgeteilte+Daten%29+von+Ihnen+mithilfe+Ihrer+beauftragten+Dienstleister%2C+auch+in+den+USA%2C+verarbeitet+werden.+Mein+Einverständnis+kann+ich+mit+Wirkung+für+die+Zukunft+jederzeit+widerrufen.+Hierfür+sende+ich+ganz+einfach+via+WhatsApp+eine+kurze+Nachricht+mit+„STOP“.+Weitere+Informationen+zum+Datenschutz+finde+ich+hier%3A+https%3A%2F%2Fwww.moelders.de%2Fdatenschutz.+Andere+Kommunikationskanäle+kann+ich+natürlich+weiterhin+nutzen.“&type=phone_number&app_absent=0",
      visible: true // Sichtbarkeit des Buttons
    },
    {
      label: "Jobbörse",
      icon: "briefcase",
      url: "https://www.moelders.de/unternehmen/jobboerse",
      visible: true // Sichtbarkeit des Buttons
    }
  ],

  // --- Datenschutz ---
  privacyLabel: "Ich akzeptiere die Datenschutzrichtlinie", // Labeltext bei Datenschutz-Checkbox
  privacyLink: "https://www.moelders.de/datenschutz", // Link zur Datenschutzseite
  privacyModalText: `Mit dem Klick auf <b>„Zustimmen“</b> und bei jeder weiteren Interaktion mit diesem KI-Agenten erklärst Du Dich damit einverstanden, dass Deine Kommunikation aufgezeichnet, gespeichert und mit Drittanbietern geteilt wird – wie in der <a href=\"https://www.moelders.de/datenschutz\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"underline text-[#df242c]\">Datenschutzrichtlinie</a> beschrieben.<br /><br />Wenn Du nicht möchtest, dass Deine Gespräche aufgezeichnet werden, verzichte bitte auf die Nutzung dieses Dienstes.<br /><br /><b>Hinweis für Jugendliche:</b> Wenn Du 14 Jahre alt bist oder jünger, bitte hole Deine Eltern dazu, damit sie Dich beraten können.`, // Text im Datenschutz-Modal, HTML erlaubt
  privacyModalAccept: "Zustimmen", // Text auf Modal-Button zum Akzeptieren
  privacyModalDecline: "Ablehnen", // Text auf Modal-Button zum Ablehnen

  // --- Hintergrund & Branding ---
  backgroundImage: "/public-pics/Leuchtturm.png", // Hintergrundbild für die App
  primaryColor: "#df242c", // Hauptfarbe für Buttons, Agent etc.
  secondaryColor: "#b81c24", // Sekundärfarbe

  // --- Tab & Favicon ---
  tabTitle: "Mölders KI Azubiberater", // Browser-Tab-Titel
  tabDescription: "Azubiberater von Mölders", // Browser-Tab-Beschreibung
  favicon: "/favicon-Moelders.ico", // Favicon-Pfad

  // --- Chat Bubble Styles ---
  agentBubbleClass: 'bg-[#df242c] text-white', // CSS-Klassen für Agenten-Bubble
  userBubbleClass: 'bg-[#ededed] text-[#252422]', // CSS-Klassen für User-Bubble

  // --- UI Farben & Styles ---
  mainButtonColor: '#df242c', // Hauptbutton-Farbe
  mainButtonHoverColor: '#b81c24', // Hover-Farbe Hauptbutton
  mainButtonTextColor: 'white', // Textfarbe Hauptbutton
  mainButtonBorderColor: '#df242c', // Rahmenfarbe Hauptbutton
  mainButtonDisabledOpacity: 0.5, // Opazität bei deaktiviertem Button

  muteButtonColor: '#ededed', // Mikrofon-Button Standardfarbe
  muteButtonMutedColor: 'orange', // Mikrofon-Button Farbe wenn gemutet
  muteButtonMutedBg: 'bg-orange-400', // Mikrofon-Button Hintergrund gemutet
  muteButtonMutedText: 'text-white', // Mikrofon-Button Textfarbe gemutet
  muteButtonMutedBorder: 'border-orange-400', // Mikrofon-Button Rahmen gemutet
  muteButtonUnmutedBg: 'bg-[#ededed]', // Mikrofon-Button Hintergrund unmuted
  muteButtonUnmutedText: 'text-[#252422]', // Mikrofon-Button Textfarbe unmuted
  muteButtonUnmutedBorder: 'border-gray-300', // Mikrofon-Button Rahmen unmuted
  muteButtonHoverBg: 'hover:bg-[#df242c]', // Mikrofon-Button Hover Hintergrund
  muteButtonHoverText: 'hover:text-white', // Mikrofon-Button Hover Text

  inputFocusColor: '#df242c', // Farbe beim Fokus auf Eingabefeld

  chatLinkColor: 'text-blue-600', // Linkfarbe im Chat
  chatLinkHoverColor: 'hover:text-blue-800', // Linkfarbe im Chat bei Hover

  privacyAcceptBg: 'bg-[#df242c]', // Datenschutz-Modal: Hintergrund Annehmen-Button
  privacyAcceptText: 'text-white', // Datenschutz-Modal: Textfarbe Annehmen-Button
  privacyAcceptHoverBg: 'hover:bg-[#b81c24]', // Datenschutz-Modal: Hover Hintergrund Annehmen-Button
  privacyDeclineBg: 'bg-gray-200', // Datenschutz-Modal: Hintergrund Ablehnen-Button
  privacyDeclineText: 'text-gray-700', // Datenschutz-Modal: Textfarbe Ablehnen-Button
  privacyDeclineHoverBg: 'hover:bg-gray-300', // Datenschutz-Modal: Hover Hintergrund Ablehnen-Button
  privacyModalBorder: 'border-[#eee]', // Datenschutz-Modal: Rahmenfarbe

  agentImageBorder: 'border-[#df242c]', // Rahmenfarbe um Agentenbild

  // --- SVG Farben ---
  svgCheckColor: '#fff', // Farbe für Check-Icon
  svgBarColor: '#222', // Farbe für Balken-Icons

  // --- Animationen ---
  animationProfilePulse: 'profile-pulse 1.6s cubic-bezier(0.4,0,0.2,1) infinite', // Puls-Animation Agentenbild
  animationPulseSpinSlow: 'pulse-spin-slow 2.5s linear infinite', // Glow-Effekt langsam
  animationPulseSpinRev: 'pulse-spin-rev 2.2s linear infinite', // Glow-Effekt reverse
  animationPulseScale: 'pulse-scale 2.8s ease-in-out infinite', // Glow-Effekt scale
  animationMarquee: 'marquee 8s linear infinite', // Marquee-Text Animation

  // --- Card & Badge Styles ---
  cardBg: 'bg-card', // Card Hintergrundfarbe
  cardText: 'text-card-foreground', // Card Textfarbe
  badgeBg: 'bg-primary', // Badge Hintergrundfarbe
  badgeText: 'text-primary-foreground' // Badge Textfarbe
}
// --- Ende APP_CONFIG ---
