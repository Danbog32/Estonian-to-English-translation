import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

const API_BASE = process.env.HF_TRANSLATE_API_BASE?.replace(/\/$/, "");
const API_KEY = process.env.HF_TRANSLATE_API_KEY || "";
const MODEL =
  process.env.HF_TRANSLATE_MODEL || "meta-llama/Llama-3.2-3B-Instruct";
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const TURNSTILE_SESSION_SECRET =
  process.env.TURNSTILE_SESSION_SECRET || TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_SESSION_COOKIE = "turnstile_verified";
const TURNSTILE_SESSION_TTL_SECONDS = 12 * 60 * 60;

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return request.headers.get("x-real-ip")?.trim() || "";
}

function getIpFingerprint(ip: string): string {
  const normalized = ip || "unknown";
  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("base64url")
    .slice(0, 16);
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function signSessionPayload(payload: string): string {
  return crypto
    .createHmac("sha256", TURNSTILE_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
}

function createSessionCookieValue(clientIp: string): string {
  const expiresAt =
    Math.floor(Date.now() / 1000) + TURNSTILE_SESSION_TTL_SECONDS;
  const payload = `${expiresAt}.${getIpFingerprint(clientIp)}`;
  const signature = signSessionPayload(payload);
  return `${payload}.${signature}`;
}

function hasValidTurnstileSession(
  sessionCookie: string,
  clientIp: string
): boolean {
  if (!TURNSTILE_SESSION_SECRET || !sessionCookie) return false;

  const parts = sessionCookie.split(".");
  if (parts.length !== 3) return false;

  const [expRaw, ipHash, signature] = parts;
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedPayload = `${expRaw}.${ipHash}`;
  const expectedSignature = signSessionPayload(expectedPayload);
  if (!timingSafeEqual(signature, expectedSignature)) return false;

  return timingSafeEqual(ipHash, getIpFingerprint(clientIp));
}

async function verifyTurnstileToken(token: string, clientIp: string) {
  const body = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (clientIp) {
    body.set("remoteip", clientIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    return { ok: false, errors: ["turnstile-unreachable"] };
  }

  const result = (await response.json()) as TurnstileVerifyResponse;
  return {
    ok: result.success,
    errors: result["error-codes"] || [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const hasVerifiedSession = hasValidTurnstileSession(
      request.cookies.get(TURNSTILE_SESSION_COOKIE)?.value || "",
      clientIp
    );
    let shouldSetVerifiedSession = false;

    const respond = (body: Record<string, unknown>, status = 200) => {
      const response = NextResponse.json(body, { status });
      if (shouldSetVerifiedSession && TURNSTILE_SESSION_SECRET) {
        response.cookies.set({
          name: TURNSTILE_SESSION_COOKIE,
          value: createSessionCookieValue(clientIp),
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: TURNSTILE_SESSION_TTL_SECONDS,
          path: "/",
        });
      }
      return response;
    };

    const providedTurnstileToken =
      request.nextUrl.searchParams.get("turnstileToken") ||
      request.headers.get("x-turnstile-token") ||
      "";

    if (TURNSTILE_SECRET_KEY && !hasVerifiedSession) {
      if (!providedTurnstileToken) {
        return respond(
          {
            status: "unreachable",
            message: "Turnstile verification required before health checks.",
            code: "turnstile_required",
          },
          403
        );
      }

      const verification = await verifyTurnstileToken(
        providedTurnstileToken,
        clientIp
      );
      if (!verification.ok) {
        return respond(
          {
            status: "unreachable",
            message: "Turnstile verification failed for health check.",
            code: "turnstile_failed",
            details: verification.errors,
          },
          403
        );
      }

      shouldSetVerifiedSession = true;
    }

    if (!API_BASE) {
      return respond(
        { status: "unconfigured", message: "HF_TRANSLATE_API_BASE is not set" },
        500
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
      return respond(
        {
          status: "starting_up",
          message: "Translation backend is starting up.",
          http_status: 503,
        },
        200
      );
    }

    if (!resp.ok) {
      return respond(
        {
          status: "unhealthy",
          message: `Upstream responded with ${resp.status}`,
          http_status: resp.status,
        },
        200
      );
    }

    return respond(
      { status: "healthy", message: "Translation backend is responsive." },
      200
    );
  } catch {
    return NextResponse.json(
      { status: "unreachable", message: "Failed to contact backend." },
      { status: 200 }
    );
  }
}
