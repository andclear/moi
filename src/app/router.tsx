import { Navigate, createBrowserRouter } from "react-router";

import { AppShell } from "@/shared/layout/AppShell";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { LandingGate } from "@/pages/landing/LandingGate";
import { LibraryPage } from "@/pages/library/LibraryPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { WorkspacePage } from "@/pages/workspace/WorkspacePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingGate /> },
  {
    element: <AppShell />,
    children: [
      { path: "workspace/:projectId?/:step?", element: <WorkspacePage /> },
      { path: "library", element: <LibraryPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "admin", element: <AdminLoginPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/workspace" replace /> },
]);
