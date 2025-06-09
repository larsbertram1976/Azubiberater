// app/actions/getSignedUrl.js
'use server'

export async function getSignedUrl() {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${process.env.NEXT_PUBLIC_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': process.env.ELEVEN_LABS_API_KEY,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get signed URL')
    }

    const data = await response.json()
    return { signedUrl: data.signed_url }
  } catch (error) {
    console.error('Server Action Error:', error)
    throw new Error('Failed to get signed URL')
  }
}
