import { NextRequest, NextResponse } from 'next/server';
import { ai } from '../../../lib/ai';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const sysMsg = {
      role: 'system' as const,
      content: 'You are ARIA (Advanced Real-time Intelligence Assistant) built into the XPS Intelligence Platform. You are conversational, sharp, and highly technical. Assist users with epoxy flooring, concrete polishing, and Lead Generation Operations.'
    };

    const response = await ai([sysMsg, ...messages]);
    return NextResponse.json({
      role: 'assistant',
      content: response.content,
      provider: response.provider,
      model: response.model
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
