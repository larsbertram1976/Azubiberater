// /app/api/sendText.js
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { conversationId, agentId, text } = await req.json();
    const apiKey = process.env.ELEVEN_LABS_API || process.env.NEXT_PUBLIC_ELEVEN_LABS_API;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key missing' }, { status: 400 });
    }
    if (!conversationId || !text) {
      return NextResponse.json({ error: 'conversationId and text required' }, { status: 400 });
    }
    const url = `https://api.elevenlabs.io/v1/conversations/${conversationId}/interact`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({ input: text })
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || data.message || 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json({ response: data.response || data.message || '' });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
