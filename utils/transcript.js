// utils/transcript.js
export const downloadTranscript = (messages) => {
  const transcript = messages
    .map((msg) => `${msg.source === 'user' ? 'User' : 'AI'}: ${msg.message}`)
    .join('\n\n')

  const blob = new Blob([transcript], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conversation-transcript-${new Date().toISOString()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
