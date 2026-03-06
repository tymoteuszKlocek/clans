import { useState } from "react";
import GraphView from "./components/GraphView";
import AdminPanel from "./components/AdminPanel";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<"graph" | "admin">("graph");

  return (
    <div className="app">
      <nav className="navbar">
        <button
          className={activeTab === "graph" ? "active" : ""}
          onClick={() => setActiveTab("graph")}
        >
          Social Network
        </button>
        <button
          className={activeTab === "admin" ? "active" : ""}
          onClick={() => setActiveTab("admin")}
        >
          Admin Panel
        </button>
      </nav>
      <main className={activeTab === "graph" ? "content" : "content-scrollable"}>
        {activeTab === "graph" ? <GraphView /> : <AdminPanel />}
      </main>
    </div>
  );
}

export default App;