import TranscriberWrapper from "./components/TranscriberWrapper";
import ServerStatusWrapper from "./components/ServerStatusWrapper";

export default function Home() {
  return (
    <div className="min-h-screen p-8 sm:p-12">
      <main className="max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">
          Real-time Estonian → English Transcription
        </h1>
        <p className="text-sm text-gray-600">
          Connects to wss://tekstiks.ee/asr/ws/asr and streams 16 kHz PCM.
        </p>
        <ServerStatusWrapper />
        <TranscriberWrapper />
      </main>
    </div>
  );
}
