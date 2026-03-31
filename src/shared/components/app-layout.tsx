import { AGENT_COLORS } from "@/shared/lib/agent-colors";
import { cn } from "@/shared/lib/utils";
import { ChevronLeft, ChevronRight, Activity, BarChart3, BookOpenText, Brain, FolderKanban, LayoutDashboard, Megaphone, Newspaper, Settings, TimerReset, UsersRound, Video, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/automations", label: "Automations", icon: Workflow },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/marketing", label: "Marketing", icon: Megaphone },
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/docs", label: "Docs", icon: BookOpenText },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/briefs", label: "Daily Briefs", icon: Newspaper },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/cron", label: "Scheduled Tasks", icon: TimerReset },
  { to: "/usage", label: "Usage & Costs", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const SIDEBAR_STORAGE_KEY = "command-center.sidebar-collapsed";

export function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(77,212,172,0.17),transparent_28%),radial-gradient(circle_at_top_right,rgba(142,164,255,0.16),transparent_24%),linear-gradient(180deg,#080b14,#05070d_38%,#04060c)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="flex min-h-screen w-full gap-4 px-3 py-3 md:px-4 lg:gap-5 lg:px-5">
        <aside
          className={cn(
            "hidden shrink-0 flex-col rounded-[28px] border border-white/8 bg-white/[0.03] p-3 backdrop-blur-xl transition-[width,padding] duration-200 lg:flex",
            isSidebarCollapsed ? "w-[64px]" : "w-[260px] p-4",
          )}
        >
          <div className={cn("mb-8 flex items-center", isSidebarCollapsed ? "justify-center" : "gap-3 px-3 pt-2")}>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/6 ring-1 ring-white/10">
              <div className="relative size-6 rounded-full bg-emerald-300/20">
                <span className="absolute inset-1 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(77,212,172,0.65)]" />
              </div>
            </div>
            {!isSidebarCollapsed ? (
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Atlas</p>
                <h1 className="text-lg font-semibold text-white">Command Center</h1>
              </div>
            ) : null}
          </div>

          <div className={cn("mb-4 flex", isSidebarCollapsed ? "justify-center" : "justify-end px-1")}>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                title={isSidebarCollapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-2xl text-sm transition",
                    isSidebarCollapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
                    isActive
                      ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-slate-400 hover:bg-white/6 hover:text-white",
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {!isSidebarCollapsed ? label : null}
              </NavLink>
            ))}
          </nav>

          {!isSidebarCollapsed ? (
            <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Core Agents</p>
              <div className="mt-4 flex items-center gap-2">
                {Object.entries(AGENT_COLORS).map(([key, color]) => (
                  <div
                    key={key}
                    className="flex size-9 items-center justify-center rounded-full border border-white/10 text-[10px] font-semibold uppercase text-slate-900"
                    style={{ backgroundColor: color }}
                  >
                    {key.slice(0, 1)}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-400">Mission control for real tasks, live activity, synced docs, and memory.</p>
            </div>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 mb-4 rounded-[28px] border border-white/8 bg-[#090d16]/80 px-5 py-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Operations mode</p>
                <p className="text-sm text-slate-300">Real Supabase data only. No mocks, no vanity metrics, no fake controls.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {navItems.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition lg:hidden",
                        isActive ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/5 text-slate-400",
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          </header>
          <main className="flex-1 pb-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
