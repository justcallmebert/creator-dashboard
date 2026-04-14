import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

    // Fetch the image and convert to base64
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error('Failed to fetch image')
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = res.headers.get('content-type') ?? 'image/jpeg'

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as any, data: base64 },
            },
            {
              type: 'text',
              text: 'This is a photo of a planning whiteboard. Please extract all the text and content you can read from it. Organize it clearly — preserve any dates, titles, tasks, or lists you see. Output plain text only, no commentary.',
            },
          ],
        },
      ],
    })

    const extracted = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ extracted })
  } catch (error: any) {
    console.error('Whiteboard extraction error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
