import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./app/styles.css";
import { useGameStore } from "./game/state/store";

declare global {
  interface Window {
    advanceTime: (ms: number) => void;
    render_game_to_text: () => string;
  }
}

window.advanceTime = (ms: number) => {
  useGameStore.getState().advanceTime(ms);
};

window.render_game_to_text = () => useGameStore.getState().renderToText();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
