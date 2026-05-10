import { Navigate } from "react-router";

import { LandingPage } from "@/pages/landing/LandingPage";

const INTRO_STORAGE_KEY = "echo.hasEntered";

export function LandingGate() {
  const hasEntered =
    typeof window !== "undefined" && window.localStorage.getItem(INTRO_STORAGE_KEY) === "true";

  if (hasEntered) {
    return <Navigate to="/workspace" replace />;
  }

  return <LandingPage />;
}
