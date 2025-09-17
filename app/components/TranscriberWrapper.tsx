"use client";

import dynamic from "next/dynamic";

const Transcriber = dynamic(() => import("./Transcriber"), {
  ssr: false,
});

export default function TranscriberWrapper() {
  return <Transcriber />;
}
