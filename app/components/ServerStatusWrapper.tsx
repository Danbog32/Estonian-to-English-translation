"use client";

import dynamic from "next/dynamic";

const ServerStatus = dynamic(() => import("./ServerStatus"), {
  ssr: false,
});

export default function ServerStatusWrapper() {
  return <ServerStatus />;
}
