import { NextResponse } from "next/server"
import { CHATGPT_FUNCTION_SCHEMA, OPENAI_ASSISTANT_INSTRUCTIONS, SUB_AGENTS } from "@/lib/orchestrator"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const baseUrl = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"

  // Return everything needed to set up a ChatGPT Custom GPT or OpenAI Assistant
  return NextResponse.json({
    // Paste this into your ChatGPT GPT instructions
    chatgpt_instructions: OPENAI_ASSISTANT_INSTRUCTIONS,

    // Add this as an Action in your ChatGPT GPT
    chatgpt_action: {
      openapi_schema: {
        openapi: "3.1.0",
        info: { title: "Agent Zero Orchestrator", description: "Orchestrate Agent Zero sub-agents in parallel", version: "1.0.0" },
        servers: [{ url: baseUrl }],
        paths: {
          "/api/orchestrate": {
            post: {
              operationId: "orchestrateAgents",
              summary: "Fan out a task to Agent Zero sub-agents in parallel",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["task"],
                      properties: {
                        task: { type: "string", description: "The task to delegate" },
                        agents: { type: "array", items: { type: "string" }, description: "Specific agents (optional)" },
                      },
                    },
                  },
                },
              },
              responses: { "200": { description: "Orchestration result with synthesized response" } },
            },
          },
          "/api/aria": {
            post: {
              operationId: "chatWithARIA",
              summary: "Chat directly with ARIA — Agent Zero\'s primary intelligence agent",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["message"],
                      properties: {
                        message: { type: "string" },
                        channel: { type: "string", default: "web" },
                        session_id: { type: "string" },
                      },
                    },
                  },
                },
              },
              responses: { "200": { description: "ARIA response" } },
            },
          },
        },
      },
    },

    // OpenAI Assistants API setup
    openai_assistant_setup: {
      name: "Agent Zero Orchestrator",
      instructions: OPENAI_ASSISTANT_INSTRUCTIONS,
      model: "gpt-4o",
      tools: [
        { type: "function", function: CHATGPT_FUNCTION_SCHEMA },
        { type: "code_interpreter" },
        { type: "file_search" },
      ],
    },

    // All 8 sub-agents
    agents: SUB_AGENTS.map(a => ({ id: a.id, name: a.name, role: a.role, endpoint: baseUrl + a.endpoint })),
  })
}
