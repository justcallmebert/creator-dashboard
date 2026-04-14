import { NextResponse } from 'next/server'

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

const STAGE_LABELS: Record<string, string> = {
  ideation: 'Ideation',
  recorded: 'Recorded',
  edit1: '1st Edit',
  edit2: '2nd Edit',
  edit3: 'Final Edit',
  captions: 'Captions',
  posted: 'Posted',
}

const STAGE_EMOJI: Record<string, string> = {
  ideation: '💡',
  recorded: '🎬',
  edit1: '✂️',
  edit2: '✂️',
  edit3: '✅',
  captions: '💬',
  posted: '🚀',
}

export async function POST(request: Request) {
  if (!WEBHOOK_URL) {
    return NextResponse.json({ error: 'SLACK_WEBHOOK_URL not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { type, title, stage, dueDate, assignedTo } = body

    let text = ''

    if (type === 'stage_change') {
      const emoji = STAGE_EMOJI[stage] ?? '📋'
      const label = STAGE_LABELS[stage] ?? stage
      text = `${emoji} *${title}* moved to *${label}*`
      if (assignedTo) text += ` — assigned to ${assignedTo}`
    } else if (type === 'video_added') {
      const due = dueDate ? ` · due ${new Date(dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''
      text = `✨ New video added: *${title}*${due}`
    } else if (type === 'due_date_changed') {
      const due = dueDate ? new Date(dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unset'
      text = `📅 *${title}* due date changed to *${due}*`
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text },
          },
        ],
      }),
    })

    if (!res.ok) throw new Error(`Slack returned ${res.status}`)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Slack notify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
