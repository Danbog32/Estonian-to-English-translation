// [captionName]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "../../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import { useAutoScroll } from "../hooks/useAutoScroll";

export default function LiveCaptionsPage() {
  const params = useParams();
  const captionName = params.captionName as string;
  const [captionText, setCaptionText] = useState("");
  const { scrollRef, isScrolledUp, scrollToBottom } =
    useAutoScroll<HTMLDivElement>({
      content: captionText,
      threshold: 50,
      buttonThreshold: 200,
      enabled: true,
    });

  useEffect(() => {
    if (!captionName) return;

    const captionDoc = doc(db, "captions", captionName);
    const unsubscribe = onSnapshot(captionDoc, (doc) => {
      if (doc.exists()) {
        setCaptionText(doc.data().text);
      } else {
        setCaptionText("No captions available.");
      }
    });

    return () => unsubscribe();
  }, [captionName]);

  return (
    <div className="relative h-screen w-full bg-[radial-gradient(1200px_600px_at_-10%_-10%,#0f172a_0%,#0b0f12_40%,#050607_80%)] text-neutral-100 overflow-hidden">
      <div className="relative h-full flex flex-col items-center justify-center w-full max-w-[1200px] mx-auto px-4 md:px-8 pt-safe pb-safe">
        {/* Header Section */}
        <div className="w-full flex items-center justify-center mb-6 md:mb-8">
          {/* Logo */}
          <Image
            src="/TalTech_logo.png"
            alt="TalTech Logo"
            width={100}
            height={70}
            className="mr-4"
            priority
          />
          {/* Title */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-white/90 font-mono uppercase tracking-[0.06em]">
            Live Captions
          </h1>
        </div>

        {/* Caption Text */}
        <div className="relative w-full flex-1 flex flex-col bg-white/[0.01] border border-white/10 rounded-lg backdrop-blur-sm shadow-lg overflow-hidden">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar"
          >
            {captionText ? (
              <pre className="whitespace-pre-wrap break-words font-mono font-semibold uppercase tracking-[0.06em] leading-[1.08] text-[clamp(20px,5.2vw,42px)] md:text-[clamp(22px,5.6vw,42px)] text-white/90">
                {captionText}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-white/30 font-mono uppercase tracking-[0.06em] text-lg">
                  Waiting for captions…
                </span>
              </div>
            )}
          </div>
          {isScrolledUp && (
            <button
              onClick={scrollToBottom}
              className="absolute cursor-pointer bottom-20 md:bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-full bg-emerald-500/90 hover:bg-emerald-400 active:bg-emerald-500 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
              aria-label="Scroll to bottom"
            >
              <svg
                className="w-6 h-6 md:w-5 md:h-5 text-black"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
