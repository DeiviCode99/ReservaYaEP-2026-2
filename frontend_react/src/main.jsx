import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Login, Recover, Register } from "./auth-pages";
import { Client, Locations } from "./client-pages";
import { Admin } from "./admin-pages";

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/login") return <Login />;
  if (path === "/recuperar") return <Recover />;
  if (path === "/cliente") return <Client />;
  if (path === "/sedes") return <Locations />;
  if (path === "/admin") return <Admin />;
  return <Register />;
}
createRoot(document.getElementById("root")).render(<App />);
