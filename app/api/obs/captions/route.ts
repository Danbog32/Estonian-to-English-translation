import { NextRequest, NextResponse } from "next/server";
import OBSWebSocket, { EventSubscription } from "obs-websocket-js";

/**
 * IMPORTANT: This server-side route only works in LOCAL DEVELOPMENT.
 * 
 * In production, the Next.js server runs in the cloud and CANNOT reach
 * private/local network IPs (e.g., 10.x.x.x, 192.168.x.x, localhost).
 * 
 * For production use, the client-side hook (useObsCaptionPublisher) 
 * connects directly from the browser, which runs on the user's local
 * machine and CAN reach local OBS instances.
 * 
 * This route is kept for backwards compatibility and local testing.
 */

// Default env var fallbacks
const DEFAULT_HOST = process.env.OBS_HOST ?? "localhost";
const DEFAULT_PORT = process.env.OBS_PORT ?? "4455";
const DEFAULT_PASSWORD = process.env.OBS_PASSWORD ?? "";
const DEFAULT_CAPTION_SOURCE = process.env.OBS_CAPTION_SOURCE ?? "LiveCaptions";

type ConnectionSettings = {
  host: string;
  port: string;
  password: string;
  captionSource: string;
};

// Connection pool keyed by address
const obsPool = new Map<
  string,
  {
    obs: OBSWebSocket;
    connectionPromise: Promise<void> | null;
  }
>();

function getConnectionKey(settings: ConnectionSettings): string {
  return `${settings.host}:${settings.port}`;
}

function buildObsAddress(host: string, port: string): string {
  const hasProtocol = host.startsWith("ws://") || host.startsWith("wss://");
  if (hasProtocol) {
    return host;
  }
  return `ws://${host}:${port}`;
}

function getOrCreateConnection(settings: ConnectionSettings) {
  const key = getConnectionKey(settings);
  let entry = obsPool.get(key);

  if (!entry) {
    const obs = new OBSWebSocket();
    entry = { obs, connectionPromise: null };
    obsPool.set(key, entry);

    // Clean up on disconnect
    const resetPromise = () => {
      const e = obsPool.get(key);
      if (e) e.connectionPromise = null;
    };
    obs.on("ConnectionClosed", resetPromise);
    obs.on("ConnectionError", resetPromise);
  }

  return entry;
}

async function ensureObsConnected(settings: ConnectionSettings) {
  const entry = getOrCreateConnection(settings);
  const { obs } = entry;

  if (obs.identified) {
    return obs;
  }

  if (!entry.connectionPromise) {
    const address = buildObsAddress(settings.host, settings.port);
    console.log(`[obs] Attempting to connect to ${address}`);
    entry.connectionPromise = obs
      .connect(address, settings.password || undefined, {
        rpcVersion: 1,
        eventSubscriptions: EventSubscription.None,
      })
      .then(() => {
        console.log(`[obs] Successfully connected to OBS at ${address}`);
      })
      .catch((error) => {
        entry.connectionPromise = null;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`[obs] Connection failed: ${errorMessage}`);
        throw error;
      });
  }

  await entry.connectionPromise;
  return obs;
}

async function updateObsText(text: string, settings: ConnectionSettings) {
  let obs: OBSWebSocket;
  const address = buildObsAddress(settings.host, settings.port);

  try {
    obs = await ensureObsConnected(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach OBS";
    throw new Error(
      `OBS connection error: ${message}. Check if OBS WebSocket server is running at ${address}`
    );
  }

  try {
    await obs.call("SetInputSettings", {
      inputName: settings.captionSource,
      inputSettings: { text },
      overlay: true,
    });
    console.log(`[obs] Updated caption source "${settings.captionSource}"`);
  } catch (error) {
    // Reset connection promise on failure
    const entry = obsPool.get(getConnectionKey(settings));
    if (entry) entry.connectionPromise = null;

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[obs] Failed to update input "${settings.captionSource}": ${errorMessage}`
    );
    throw new Error(
      `Failed to update OBS input "${settings.captionSource}": ${errorMessage}. Make sure the input source exists in OBS.`
    );
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  let payload: {
    text?: unknown;
    settings?: {
      host?: string;
      port?: string;
      password?: string;
      captionSource?: string;
    };
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const text = typeof payload.text === "string" ? payload.text : "";
  const normalized = text.trim();

  // Use request settings if provided, otherwise fall back to env vars/defaults
  const settings: ConnectionSettings = {
    host: payload.settings?.host || DEFAULT_HOST,
    port: payload.settings?.port || DEFAULT_PORT,
    password: payload.settings?.password ?? DEFAULT_PASSWORD,
    captionSource: payload.settings?.captionSource || DEFAULT_CAPTION_SOURCE,
  };

  try {
    await updateObsText(normalized, settings);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update OBS captions";
    const errorDetails = {
      error: message,
      obsHost: settings.host,
      obsPort: settings.port,
      obsCaptionSource: settings.captionSource,
    };
    console.error("[obs] caption update failed", errorDetails);
    return NextResponse.json(errorDetails, { status: 502 });
  }
}
