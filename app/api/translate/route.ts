import { NextRequest, NextResponse } from "next/server";

// Environment configuration
const API_BASE = process.env.HF_TRANSLATE_API_BASE?.replace(/\/$/, "");
const API_KEY = process.env.HF_TRANSLATE_API_KEY || "";
const MODEL =
  process.env.HF_TRANSLATE_MODEL || "meta-llama/Llama-3.2-3B-Instruct";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ProxyRequest = {
  messages: ChatMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
};

type LlmResponse = {
  choices: Array<{
    message: { content?: string };
  }>;
};

export async function POST(request: NextRequest) {
  try {
    if (!API_BASE) {
      return NextResponse.json(
        { error: "HF_TRANSLATE_API_BASE is not configured" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ProxyRequest;
    const { messages, model, max_tokens, temperature } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const payload = {
      model: model || MODEL,
      messages,
      max_tokens: typeof max_tokens === "number" ? max_tokens : 256,
      temperature: typeof temperature === "number" ? temperature : 0.0,
      stream: false,
    };

    const resp = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (resp.status === 503) {
      return NextResponse.json(
        {
          error: "Translation service starting up",
          status: "starting_up",
        },
        { status: 503 }
      );
    }

    if (!resp.ok) {
      const details = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: "Translation service error", details },
        { status: 502 }
      );
    }

    const data = (await resp.json()) as LlmResponse;
    const translation = data?.choices?.[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      translated_text: translation,
      status: "success",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
