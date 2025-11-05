// components/FirebaseApiSwitchComponent.tsx

"use client";

import React, { useState } from "react";
import QRCode from "react-qr-code";
import { useFirebase } from "../contexts/FirebaseContext";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
} from "@heroui/modal";
import { CastIcon } from "./ViewIcons";

declare global {
  interface Window {
    setFirebaseSettings?: (enabled: boolean, captionName: string) => void;
  }
}

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

export default function FirebaseApiSwitchComponent() {
  const [showQRCode, setShowQRCode] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [language] = useState<"en" | "et">("en");
  const { firebaseEnabled, captionURL, setFirebaseEnabled } = useFirebase();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

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
      {/* <button
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
      </button> */}

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="center"
        classNames={{
          wrapper: "z-[9999] !fixed !inset-0",
          backdrop: "z-[9998] bg-black/50 backdrop-blur-sm",
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
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-white">
                <h2 className="text-lg font-semibold uppercase tracking-widest font-mono">
                  {t.castCaptionsTitle}
                </h2>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
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

                  {captionURL && (
                    <div className="flex flex-col gap-3 bg-[#1a1f2e] rounded-lg p-4 border border-white/10">
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
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
