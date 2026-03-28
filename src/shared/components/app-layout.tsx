import { AGENT_COLORS } from "@/shared/lib/agent-colors";
import { cn } from "@/shared/lib/utils";
import {
  Activity,
  BookOpenText,
  FolderKanban,
  LayoutDashboard,
  Settings,
  UsersRound,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/docs", label: "Docs", icon: BookOpenText },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(77,212,172,0.17),transparent_28%),radial-gradient(circle_at_top_right,rgba(142,164,255,0.16),transparent_24%),linear-gradient(180deg,#080b14,#05070d_38%,#04060c)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 md:px-6 lg:px-8">
        <aside className="hidden w-[260px] shrink-0 flex-col rounded-[28px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-xl lg:flex">
          <div className="mb-10 flex items-center gap-3 px-3 pt-2">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/6 ring-1 ring-white/10">
              <div className="relative size-6 rounded-full bg-emerald-300/20">
                <span className="absolute inset-1 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(77,212,172,0.65)]" />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Atlas</p>
              <h1 className="text-lg font-semibold text-white">Command Center</h1>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    isActive
                      ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-slate-400 hover:bg-white/6 hover:text-white",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>

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
            <p className="mt-4 text-sm text-slate-400">
              Mission control for autonomous delivery, docs, and operations signals.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 mb-4 rounded-[28px] border border-white/8 bg-[#090d16]/80 px-5 py-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Operations mode</p>
                <p className="text-sm text-slate-300">Coordinated execution across projects, docs, and live agent telemetry.</p>
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
                        isActive
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-white/5 text-slate-400",
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
