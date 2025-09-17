import TranscriberWrapper from "./components/TranscriberWrapper";
import ServerStatusWrapper from "./components/ServerStatusWrapper";

export default function Home() {
  return (
    <div className="min-h-screen">
      <ServerStatusWrapper />
      <TranscriberWrapper />
    </div>
  );
}
