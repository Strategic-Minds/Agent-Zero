import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const { message, conversation_id } = await req.json().catch(() => ({})) as {
    message?: string; conversation_id?: string
  }
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const openai_key = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY
        const is_groq = !process.env.OPENAI_API_KEY && !!process.env.GROQ_API_KEY
        const base_url = is_groq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1"
        const model = is_groq ? "llama-3.1-8b-instant" : "gpt-4o-mini"

        const res = await fetch(`${base_url}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openai_key}` },
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              { role: "system", content: "You are ARIA, the AI core of Agent Zero — the XPS Business Factory intelligence system. Be sharp, concise, and actionable." },
              { role: "user", content: message },
            ],
            max_tokens: 1024,
          }),
        })

        if (!res.ok || !res.body) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "LLM unavailable" })}\n\n`))
          controller.close()
          return
        }

        const reader = res.body.getReader()
        const dec = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = dec.decode(value)
          const lines = chunk.split("\n").filter(l => l.startsWith("data: "))
          for (const line of lines) {
            const data = line.slice(6)
            if (data === "[DONE]") { controller.enqueue(encoder.encode("data: [DONE]\n\n")); break }
            try {
              const parsed = JSON.parse(data)
              const token = parsed.choices?.[0]?.delta?.content
              if (token) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, conversation_id })}\n\n`))
            } catch { /* skip malformed */ }
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`))
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
