import Transcriber from "./components/Transcriber";
import ServerStatus from "./components/ServerStatus";
import FirebaseApiSwitchComponent from "./components/FirebaseApiSwitchComponent";

export default function Home() {
  return (
    <div className="min-h-screen">
      <ServerStatus />
      <div className="p-4">
        <FirebaseApiSwitchComponent />
      </div>
      <Transcriber />
    </div>
  );
}
