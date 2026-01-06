// components/FirebaseApiSwitchComponent.tsx

"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import OBSWebSocket from "obs-websocket-js";
import { useFirebase } from "../contexts/FirebaseContext";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
} from "@heroui/modal";
import { CastIcon } from "./ViewIcons";
import type { ObsStreamingStatus } from "../hooks/useObsCaptionPublisher";

declare global {
  interface Window {
    setFirebaseSettings?: (enabled: boolean, captionName: string) => void;
  }
}

type ObsTransport = "direct" | "server";

export type ObsConnectionSettings = {
  host: string;
  port: string;
  password: string;
  captionSource: string;
  transport?: ObsTransport;
};

type ObsProps = {
  obsEnabled: boolean;
  obsStatus: ObsStreamingStatus;
  obsError: string | null;
  obsSettings: ObsConnectionSettings;
  onObsEnabledChange: (enabled: boolean) => void;
  onObsSettingsChange: (settings: ObsConnectionSettings) => void;
};

// Simple QR Code Icon Component
function QRCodeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="5" height="5" />
      <rect x="16" y="3" width="5" height="5" />
      <rect x="3" y="16" width="5" height="5" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h.01" />
      <path d="M21 12v.01" />
      <path d="M12 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

// Simple Switch Component
function Switch({
  isSelected,
  onChange,
  classNames,
  children,
  style,
}: {
  isSelected: boolean;
  onChange: (e: { target: { checked: boolean } }) => void;
  classNames?: {
    base?: string;
    wrapper?: string;
    thumb?: string;
  };
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label
      className={`inline-flex flex-row-reverse w-full items-center justify-between cursor-pointer rounded-lg gap-3 p-4 border transition-colors  ${
        isSelected
          ? "bg-[#1a1f2e] border-white/20"
          : "bg-[#1a1f2e] border-white/10 hover:border-white/20"
      } ${classNames?.base || ""}`}
      style={style}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onChange({ target: { checked: e.target.checked } })}
        className="sr-only"
      />
      <div
        className={`relative inline-flex h-5 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          isSelected ? "bg-emerald-500" : "bg-white/20"
        } ${classNames?.wrapper || ""}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white border-2 shadow-lg transition-transform absolute ${
            isSelected
              ? "translate-x-6 border-emerald-500"
              : "translate-x-0.5 border-white/30"
          } ${classNames?.thumb || ""}`}
        />
      </div>
      {children}
    </label>
  );
}

function buildObsAddress(host: string, port: string): string {
  const trimmed = host.trim();
  if (!trimmed) {
    return `ws://localhost:${port}`;
  }
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  return `ws://${trimmed}:${port}`;
}

function normalizeObsHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  const withoutProtocol = trimmed
    .replace(/^wss?:\/\//, "")
    .replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  return withoutPath.split(":")[0] ?? "";
}

function isPrivateHost(host: string): boolean {
  const hostname = normalizeObsHost(host);
  if (!hostname) return false;
  if (hostname === "localhost" || hostname.endsWith(".local")) return true;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;

  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

const DEFAULT_OBS_SETTINGS: ObsConnectionSettings = {
  host: "localhost",
  port: "4455",
  password: "",
  captionSource: "LiveCaptions",
  transport: "direct",
};

export function getStoredObsSettings(): ObsConnectionSettings {
  if (typeof window === "undefined") return DEFAULT_OBS_SETTINGS;
  try {
    const stored = localStorage.getItem("obs-settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      const transport: ObsTransport =
        parsed?.transport === "server" ? "server" : "direct";
      return { ...DEFAULT_OBS_SETTINGS, ...parsed, transport };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_OBS_SETTINGS;
}

export function storeObsSettings(settings: ObsConnectionSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("obs-settings", JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export default function FirebaseApiSwitchComponent({
  obsEnabled = false,
  obsStatus = "idle",
  obsError = null,
  obsSettings = DEFAULT_OBS_SETTINGS,
  onObsEnabledChange,
  onObsSettingsChange,
}: Partial<ObsProps> = {}) {
  const [showQRCode, setShowQRCode] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [language] = useState<"en" | "et">("en");
  const { firebaseEnabled, captionURL, setFirebaseEnabled } = useFirebase();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // OBS local state
  const [localObsSettings, setLocalObsSettings] =
    useState<ObsConnectionSettings>(obsSettings);
  const [showPassword, setShowPassword] = useState(false);
  const [obsTestStatus, setObsTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [obsTestError, setObsTestError] = useState<string | null>(null);
  const transport: ObsTransport = localObsSettings.transport ?? "direct";
  const hostForAddress = localObsSettings.host || "localhost";
  const portForAddress = localObsSettings.port || "4455";
  const obsAddress = buildObsAddress(hostForAddress, portForAddress);
  const isSecurePage =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const isHostedPage =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";
  const showHttpsWarning =
    transport === "direct" && isSecurePage && obsAddress.startsWith("ws://");
  const showServerPrivateWarning =
    transport === "server" &&
    isHostedPage &&
    isPrivateHost(localObsSettings.host);

  // Sync local OBS settings when props change
  useEffect(() => {
    setLocalObsSettings(obsSettings);
  }, [obsSettings]);

  // Reset test status when modal opens
  useEffect(() => {
    if (isOpen) {
      setObsTestStatus("idle");
      setObsTestError(null);
    }
  }, [isOpen]);

  const handleObsInputChange = useCallback(
    (field: keyof ObsConnectionSettings, value: string) => {
      setLocalObsSettings((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleObsSave = useCallback(() => {
    onObsSettingsChange?.(localObsSettings);
    storeObsSettings(localObsSettings);
  }, [localObsSettings, onObsSettingsChange]);

  // Ref for test connection OBS instance
  const testObsRef = useRef<OBSWebSocket | null>(null);

  const handleObsTestConnection = useCallback(async () => {
    setObsTestStatus("testing");
    setObsTestError(null);

    const host = localObsSettings.host || "localhost";
    const port = localObsSettings.port || "4455";
    const transport: ObsTransport = localObsSettings.transport ?? "direct";
    const address = buildObsAddress(host, port);
    const isSecurePage =
      typeof window !== "undefined" && window.location.protocol === "https:";
    const isInsecureObsAddress = address.startsWith("ws://");

    if (transport === "direct" && isSecurePage && isInsecureObsAddress) {
      setObsTestStatus("error");
      setObsTestError(
        "Browser blocked ws:// because this page is HTTPS. " +
          "Run the app locally over http, use a WSS proxy, or switch to Server Relay."
      );
      return;
    }

    // Clean up previous test connection
    if (testObsRef.current) {
      try {
        testObsRef.current.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      testObsRef.current = null;
    }

    if (transport === "server") {
      try {
        const response = await fetch("/api/obs/captions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Connection test successful!",
            settings: {
              host,
              port,
              password: localObsSettings.password || "",
              captionSource: localObsSettings.captionSource || "LiveCaptions",
            },
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : `Server relay failed (${response.status})`;
          throw new Error(message);
        }

        setObsTestStatus("success");
        handleObsSave();
        setTimeout(() => {
          setObsTestStatus("idle");
        }, 3000);
      } catch (err) {
        console.error("[obs-test] Server relay failed:", err);
        setObsTestStatus("error");
        const message = err instanceof Error ? err.message : String(err);
        setObsTestError(message);
      }
      return;
    }

    const obs = new OBSWebSocket();
    testObsRef.current = obs;

    try {
      console.log(`[obs-test] Testing connection to ${address}...`);

      // Connect to OBS (client-side, from the browser)
      await obs.connect(address, localObsSettings.password || undefined, {
        rpcVersion: 1,
      });

      console.log(`[obs-test] Connected! Testing caption source...`);

      // Test sending a caption to verify the source exists
      await obs.call("SetInputSettings", {
        inputName: localObsSettings.captionSource || "LiveCaptions",
        inputSettings: { text: "🔗 Connection test successful!" },
        overlay: true,
      });

      setObsTestStatus("success");
      // Auto-save on successful test
      handleObsSave();

      // Clear success message and disconnect after 3 seconds
      setTimeout(() => {
        setObsTestStatus("idle");
        if (testObsRef.current === obs) {
          try {
            obs.disconnect();
          } catch {
            // Ignore
          }
          testObsRef.current = null;
        }
      }, 3000);
    } catch (err) {
      console.error("[obs-test] Connection failed:", err);
      setObsTestStatus("error");

      const message = err instanceof Error ? err.message : String(err);
      // Provide more helpful error messages
      if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
        setObsTestError(
          `Cannot reach OBS at ${localObsSettings.host}:${localObsSettings.port}. ` +
            "Make sure OBS is running and WebSocket server is enabled (Tools → WebSocket Server Settings)."
        );
      } else if (message.includes("Authentication")) {
        setObsTestError(
          "Authentication failed. Check your password in OBS WebSocket settings."
        );
      } else if (
        message.includes("No input") ||
        message.includes("not found")
      ) {
        setObsTestError(
          `Text source "${localObsSettings.captionSource}" not found in OBS. ` +
            "Create a Text (GDI+) source with this exact name."
        );
      } else {
        setObsTestError(message);
      }

      // Clean up
      try {
        obs.disconnect();
      } catch {
        // Ignore
      }
      if (testObsRef.current === obs) {
        testObsRef.current = null;
      }
    }
  }, [localObsSettings, handleObsSave]);

  const handleObsToggle = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        // Save settings before enabling
        handleObsSave();
      }
      onObsEnabledChange?.(enabled);
    },
    [handleObsSave, onObsEnabledChange]
  );

  const translations = {
    en: {
      castCaptions: "Cast captions",
      castCaptionsTitle: "Cast captions to multiple people",
      captionsWillBeSent:
        "Captions will be sent to multiple people who have the link.",
      yourLiveCaptions: "Your live captions are available at:",
      hideQRCode: "Hide QR Code",
      showQRCode: "Show QR Code",
      linkCopied: "Link copied to clipboard!",
      failedToCopy: "Failed to copy link",
      clickToCopy: "Click to copy the link",
    },
    et: {
      castCaptions: "Saada subtiitrid",
      castCaptionsTitle: "Saada subtiitrid mitmele inimesele",
      captionsWillBeSent:
        "Subtiitrid saadetakse mitmele inimesele, kellel on link.",
      yourLiveCaptions: "Teie otse subtiitrid on saadaval aadressil:",
      hideQRCode: "Peida QR-kood",
      showQRCode: "Näita QR-koodi",
      linkCopied: "Link kopeeritud lõikelauale!",
      failedToCopy: "Lingi kopeerimine ebaõnnestus",
      clickToCopy: "Klõpsake lingi kopeerimiseks",
    },
  };

  const t =
    translations[language as keyof typeof translations] || translations.en;

  // Function to handle QR code click
  const handleQRCodeClick = () => {
    if (navigator.clipboard && window.isSecureContext) {
      // Use navigator.clipboard API
      navigator.clipboard.writeText(captionURL).then(
        () => {
          setCopyMessage(t.linkCopied);
          setTimeout(() => setCopyMessage(""), 2000);
        },
        () => {
          setCopyMessage(t.failedToCopy);
          setTimeout(() => setCopyMessage(""), 2000);
        }
      );
    } else {
      // Fallback method using a temporary textarea
      const textArea = document.createElement("textarea");
      textArea.value = captionURL;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        setCopyMessage(t.linkCopied);
      } catch {
        setCopyMessage(t.failedToCopy);
      } finally {
        textArea.remove();
        setTimeout(() => setCopyMessage(""), 2000);
      }
    }
  };

  // Functions to handle tooltip visibility for non-touch devices
  const handleQRCodeMouseEnter = () => {
    setShowTooltip(true);
  };

  const handleQRCodeMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={` inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 cursor-pointer font-mono ${
          firebaseEnabled ? "text-white bg-white/10" : ""
        }`}
        aria-label="Cast captions"
      >
        <CastIcon className={firebaseEnabled ? "opacity-100" : "opacity-60"} />
        <span className="tracking-widest uppercase text-[10px] sm:text-xs text-white/40 font-mono">
          {t.castCaptions}
        </span>
      </button>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="center"
        classNames={{
          wrapper: "z-[9999] !fixed !inset-0",
          backdrop: "z-[9998] bg-black/50",
          base: "bg-[#0f1419] border border-white/10 z-[9999] relative font-mono max-w-md",
          header: "border-b border-white/10 px-6 pt-6 pb-4",
          body: "px-6 py-6",
          footer: "border-t border-white/10",
        }}
        backdrop="opaque"
        size="lg"
        portalContainer={
          typeof document !== "undefined" ? document.body : undefined
        }
        motionProps={{
          variants: {
            enter: {
              y: 0,
              opacity: 1,
              transition: {
                duration: 0.3,
                ease: "easeOut",
              },
            },
            exit: {
              y: -20,
              opacity: 0,
              transition: {
                duration: 0.2,
                ease: "easeIn",
              },
            },
          },
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-white">
                <h2 className="text-lg font-semibold uppercase tracking-widest font-mono">
                  {t.castCaptionsTitle}
                </h2>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4 max-h-[80vh] overflow-auto hide-scrollbar">
                  {/* Firebase/Web Casting Section */}
                  <Switch
                    style={{ touchAction: "pan-y" }}
                    isSelected={firebaseEnabled}
                    onChange={(e) => setFirebaseEnabled(e.target.checked)}
                    classNames={{
                      wrapper: "p-0 h-5 overflow-visible flex-shrink-0",
                      thumb: "w-5 h-5 border-2 shadow-lg",
                    }}
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-sm font-medium text-white font-mono uppercase tracking-wider">
                        {t.castCaptionsTitle}
                      </p>
                      <p className="text-xs text-white/60 font-mono">
                        {t.captionsWillBeSent}
                      </p>
                    </div>
                  </Switch>

                  {captionURL && firebaseEnabled && (
                    <div className="flex flex-col gap-3 bg-[#1a1f2e] rounded-lg p-4 border border-white/10 ml-0">
                      <p className="text-sm text-white/80 font-mono uppercase tracking-wider">
                        {t.yourLiveCaptions}
                      </p>
                      <a
                        href={captionURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 break-all text-sm transition-colors font-mono"
                      >
                        {captionURL}
                      </a>
                      <div className="mt-2">
                        <button
                          onClick={() => setShowQRCode(!showQRCode)}
                          className="text-white/80 hover:text-white flex items-center gap-2 transition-colors text-sm font-mono uppercase tracking-wider"
                        >
                          <QRCodeIcon />
                          {showQRCode ? t.hideQRCode : t.showQRCode}
                        </button>
                      </div>
                      {showQRCode && (
                        <div
                          className="mt-3 flex flex-col items-center bg-white p-4 rounded-lg cursor-pointer relative transition-transform hover:scale-105"
                          style={{ touchAction: "pan-y" }}
                          onClick={handleQRCodeClick}
                          onMouseEnter={handleQRCodeMouseEnter}
                          onMouseLeave={handleQRCodeMouseLeave}
                        >
                          {showTooltip && !copyMessage && (
                            <div className="absolute bottom-full mb-2 text-xs bg-black/90 text-white py-2 px-3 rounded-md hidden md:block whitespace-nowrap font-mono uppercase tracking-wider">
                              {t.clickToCopy}
                            </div>
                          )}
                          <QRCode value={captionURL} size={200} />
                          {copyMessage && (
                            <div className="absolute bottom-full mb-2 bg-emerald-500 text-white py-2 px-3 rounded-md text-xs font-medium whitespace-nowrap font-mono uppercase tracking-wider">
                              {copyMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t border-white/10 my-1" />

                  {/* OBS Studio Section */}
                  {onObsEnabledChange && (
                    <>
                      <Switch
                        style={{ touchAction: "pan-y" }}
                        isSelected={obsEnabled}
                        onChange={(e) => handleObsToggle(e.target.checked)}
                        classNames={{
                          wrapper: "p-0 h-5 overflow-visible flex-shrink-0",
                          thumb: "w-5 h-5 border-2 shadow-lg",
                        }}
                      >
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white font-mono uppercase tracking-wider">
                              OBS Studio
                            </p>
                            {obsEnabled && (
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  obsStatus === "error"
                                    ? "bg-red-400"
                                    : obsStatus === "connecting"
                                      ? "bg-amber-300 animate-pulse"
                                      : obsStatus === "sending"
                                        ? "bg-amber-300"
                                        : obsStatus === "connected"
                                          ? "bg-emerald-400"
                                          : "bg-white/40"
                                }`}
                              />
                            )}
                          </div>
                          <p className="text-xs text-white/60 font-mono">
                            Stream live captions to OBS via WebSocket
                          </p>
                        </div>
                      </Switch>

                      {obsEnabled && (
                        <div className="flex flex-col gap-4 bg-[#1a1f2e] rounded-lg p-4 border border-white/10">
                          {/* Host & Port */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                              <label
                                htmlFor="obs-host"
                                className="mb-1.5 block text-xs font-medium text-white/60 font-mono uppercase tracking-wider"
                              >
                                Host / IP
                              </label>
                              <input
                                id="obs-host"
                                type="text"
                                value={localObsSettings.host}
                                onChange={(e) =>
                                  handleObsInputChange("host", e.target.value)
                                }
                                placeholder="localhost"
                                className="w-full rounded-lg border border-white/10 bg-[#0f1419] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 font-mono"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="obs-port"
                                className="mb-1.5 block text-xs font-medium text-white/60 font-mono uppercase tracking-wider"
                              >
                                Port
                              </label>
                              <input
                                id="obs-port"
                                type="text"
                                value={localObsSettings.port}
                                onChange={(e) =>
                                  handleObsInputChange("port", e.target.value)
                                }
                                placeholder="4455"
                                className="w-full rounded-lg border border-white/10 bg-[#0f1419] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 font-mono"
                              />
                            </div>
                          </div>

                          {/* Connection Mode */}
                          <div>
                            <label
                              htmlFor="obs-transport"
                              className="mb-1.5 block text-xs font-medium text-white/60 font-mono uppercase tracking-wider"
                            >
                              Connection Mode
                            </label>
                            <select
                              id="obs-transport"
                              value={transport}
                              onChange={(e) =>
                                handleObsInputChange(
                                  "transport",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-white/10 bg-[#0f1419] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 font-mono"
                            >
                              <option value="direct">
                                Direct (browser WebSocket)
                              </option>
                              <option value="server">
                                Server relay (Next.js API)
                              </option>
                            </select>
                            <p className="mt-1.5 text-xs text-white/40 font-mono">
                              Direct connects from your browser. Server relay
                              requires OBS to be reachable from the server.
                            </p>
                          </div>

                          {showHttpsWarning && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                              <p className="text-xs text-amber-100/80 font-mono">
                                HTTPS pages cannot connect to ws://. Run the app
                                locally over http, use a WSS proxy and set host
                                to wss://, or switch to Server Relay. For hosted
                                use, add the Cast Captions link as an OBS
                                Browser Source.
                              </p>
                            </div>
                          )}

                          {showServerPrivateWarning && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                              <p className="text-xs text-amber-100/80 font-mono">
                                Server relay cannot reach private IPs from a
                                hosted deployment. Run the app locally or expose
                                OBS with a public address.
                              </p>
                            </div>
                          )}

                          {/* Password */}
                          <div>
                            <label
                              htmlFor="obs-password"
                              className="mb-1.5 block text-xs font-medium text-white/60 font-mono uppercase tracking-wider"
                            >
                              Password
                            </label>
                            <div className="relative">
                              <input
                                id="obs-password"
                                type={showPassword ? "text" : "password"}
                                value={localObsSettings.password}
                                onChange={(e) =>
                                  handleObsInputChange(
                                    "password",
                                    e.target.value
                                  )
                                }
                                placeholder="Leave empty if not set"
                                className="w-full rounded-lg border border-white/10 bg-[#0f1419] px-3 py-2.5 pr-10 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/70"
                                aria-label={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                              >
                                {showPassword ? (
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Caption Source */}
                          <div>
                            <label
                              htmlFor="obs-source"
                              className="mb-1.5 block text-xs font-medium text-white/60 font-mono uppercase tracking-wider"
                            >
                              Text Source Name
                            </label>
                            <input
                              id="obs-source"
                              type="text"
                              value={localObsSettings.captionSource}
                              onChange={(e) =>
                                handleObsInputChange(
                                  "captionSource",
                                  e.target.value
                                )
                              }
                              placeholder="LiveCaptions"
                              className="w-full rounded-lg border border-white/10 bg-[#0f1419] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 font-mono"
                            />
                            <p className="mt-1.5 text-xs text-white/40 font-mono">
                              The name of the Text (GDI+) source in OBS
                            </p>
                          </div>

                          {/* Test Connection Button */}
                          <button
                            onClick={handleObsTestConnection}
                            disabled={obsTestStatus === "testing"}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0f1419] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 font-mono uppercase tracking-wider"
                          >
                            {obsTestStatus === "testing" ? (
                              <>
                                <svg
                                  className="h-4 w-4 animate-spin"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                                <span>Testing...</span>
                              </>
                            ) : obsTestStatus === "success" ? (
                              <>
                                <svg
                                  className="h-4 w-4 text-emerald-400"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                                <span className="text-emerald-400">
                                  Connected!
                                </span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
                                </svg>
                                <span>Test Connection</span>
                              </>
                            )}
                          </button>

                          {/* Error Message */}
                          {(obsTestStatus === "error" || obsError) && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                              <div className="flex items-start gap-2">
                                <svg
                                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <p className="text-xs text-red-200/80 font-mono">
                                  {obsTestError || obsError}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Info footer */}
                          <p className="text-xs text-white/30 font-mono">
                            Requires OBS WebSocket 5.0+
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
