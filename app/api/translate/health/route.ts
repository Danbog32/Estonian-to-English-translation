import { NextResponse } from "next/server";

const API_BASE = process.env.HF_TRANSLATE_API_BASE?.replace(/\/$/, "");
const API_KEY = process.env.HF_TRANSLATE_API_KEY || "";
const MODEL =
  process.env.HF_TRANSLATE_MODEL || "meta-llama/Llama-3.2-3B-Instruct";

export async function GET() {
  try {
    if (!API_BASE) {
      return NextResponse.json(
        { status: "unconfigured", message: "HF_TRANSLATE_API_BASE is not set" },
        { status: 500 }
      );
    }

    const payload = {
      model: MODEL,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ],
      max_tokens: 5,
      temperature: 0.0,
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
          status: "starting_up",
          message: "Translation backend is starting up.",
          http_status: 503,
        },
        { status: 200 }
      );
    }

    if (!resp.ok) {
      return NextResponse.json(
        {
          status: "unhealthy",
          message: `Upstream responded with ${resp.status}`,
          http_status: resp.status,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { status: "healthy", message: "Translation backend is responsive." },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { status: "unreachable", message: "Failed to contact backend." },
      { status: 200 }
    );
  }
}
