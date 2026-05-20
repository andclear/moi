import { Navigate, createBrowserRouter } from "react-router";

import { AppShell } from "@/shared/layout/AppShell";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { LandingGate } from "@/pages/landing/LandingGate";
import { LibraryPage } from "@/pages/library/LibraryPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { TestDebugPage } from "@/pages/debug/TestDebugPage";
import { StepQuestionnaire } from "@/pages/workspace/StepQuestionnaire";
import { StepQuestionnaireLoading } from "@/pages/workspace/StepQuestionnaireLoading";
import { WorkspacePage } from "@/pages/workspace/WorkspacePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingGate /> },
  { path: "questionnaire-loading/:projectId?", element: <StepQuestionnaireLoading /> },
  { path: "questionnaire/:projectId?", element: <StepQuestionnaire /> },
  {
    element: <AppShell />,
    children: [
      { path: "workspace/:projectId?/:step?", element: <WorkspacePage /> },
      { path: "test", element: <TestDebugPage /> },
      { path: "library", element: <LibraryPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "admin", element: <AdminLoginPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/workspace" replace /> },
]);
