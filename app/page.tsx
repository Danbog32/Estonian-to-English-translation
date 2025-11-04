import Transcriber from "./components/Transcriber";
import ServerStatus from "./components/ServerStatus";

export default function Home() {
  return (
    <div className="min-h-screen">
      <ServerStatus />
      <Transcriber />
    </div>
  );
}
