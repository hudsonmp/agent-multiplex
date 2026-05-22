import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";
import { Home } from "./routes/Home";
import { Session } from "./routes/Session";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sessions/:id" element={<Session />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
