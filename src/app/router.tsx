import { ActivityPage } from "@/features/activity/activity-page";
import { AutomationsPage } from "@/features/automations/automations-page";
import { DailyBriefsPage } from "@/features/briefs/daily-briefs-page";
import { CronPage } from "@/features/cron/cron-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { DocsPage } from "@/features/docs/docs-page";
import { MemoryPage } from "@/features/memory/memory-page";
import { ProjectsBoardPage } from "@/features/projects/projects-board-page";
import { ProjectsListPage } from "@/features/projects/projects-list-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { TeamPage } from "@/features/team/team-page";
import { MeetingSummariesPage } from "@/features/meetings/meeting-summaries-page";
import { MarketingPipelinePage } from "@/features/marketing/marketing-pipeline-page";
import { UsageCostsPage } from "@/features/usage/usage-costs-page";
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
      { path: "marketing", element: <MarketingPipelinePage /> },
      { path: "team", element: <TeamPage /> },
      { path: "docs", element: <DocsPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "briefs", element: <DailyBriefsPage /> },
      { path: "meetings", element: <MeetingSummariesPage /> },
      { path: "memory", element: <MemoryPage /> },
      { path: "cron", element: <CronPage /> },
      { path: "automations", element: <AutomationsPage /> },
      { path: "usage", element: <UsageCostsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
