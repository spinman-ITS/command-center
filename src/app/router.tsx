import { ActivityPage } from "@/features/activity/activity-page";
import { DailyBriefsPage } from "@/features/briefs/daily-briefs-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { DocsPage } from "@/features/docs/docs-page";
import { MemoryPage } from "@/features/memory/memory-page";
import { ProjectsBoardPage } from "@/features/projects/projects-board-page";
import { ProjectsListPage } from "@/features/projects/projects-list-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { TeamPage } from "@/features/team/team-page";
import { MeetingSummariesPage } from "@/features/meetings/meeting-summaries-page";
import { AppLayout } from "@/shared/components/app-layout";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "projects", element: <ProjectsListPage /> },
      { path: "projects/:name", element: <ProjectsBoardPage /> },
      { path: "team", element: <TeamPage /> },
      { path: "docs", element: <DocsPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "briefs", element: <DailyBriefsPage /> },
      { path: "meetings", element: <MeetingSummariesPage /> },
      { path: "memory", element: <MemoryPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
