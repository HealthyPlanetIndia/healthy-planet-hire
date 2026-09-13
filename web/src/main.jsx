import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import Shell from "./components/Shell.jsx";
import Login from "./pages/Login.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Roles from "./pages/Roles.jsx";
import FollowUps from "./pages/FollowUps.jsx";
import Pool from "./pages/Pool.jsx";
import Settings from "./pages/Settings.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CandidateInterview from "./pages/CandidateInterview.jsx";
import Analytics from "./pages/Analytics.jsx";
import PanelScore from "./pages/PanelScore.jsx";
import Book from "./pages/Book.jsx";
import VideoInterview from "./pages/VideoInterview.jsx";
import Apply from "./pages/Apply.jsx";
import Reset from "./pages/Reset.jsx";
import SharedReport from "./pages/SharedReport.jsx";
import Automation from "./pages/Automation.jsx";
import Setup from "./pages/Setup.jsx";
import { me } from "./api.js";

const Private = ({ children }) => (me() ? children : <Navigate to="/login" replace />);

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/interview/:token" element={<CandidateInterview />} />
      <Route path="/video/:token" element={<VideoInterview />} />
      <Route path="/score/:token" element={<PanelScore />} />
      <Route path="/book/:token" element={<Book />} />
      <Route path="/apply/:roleId?" element={<Apply />} />
      <Route path="/reset/:token" element={<Reset />} />
      <Route path="/report/:token" element={<SharedReport />} />
      <Route path="/" element={<Private><Shell /></Private>}>
        <Route index element={<Dashboard />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="roles" element={<Roles />} />
        <Route path="followups" element={<FollowUps />} />
        <Route path="pool" element={<Pool />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="automation" element={<Automation />} />
        <Route path="setup" element={<Setup />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
