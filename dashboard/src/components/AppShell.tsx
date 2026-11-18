import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  Briefcase, LayoutGrid, LogOut, Menu, MessageCircleQuestion, Monitor, Moon, PanelLeftClose,
  PanelLeftOpen, Search, Send, Settings as SettingsIcon, Sun, UserRound, X,
} from "lucide-react";
import { useCollection, useDoc, updateDocument, backend } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { signOut } from "@/lib/firebase";
import { applyTheme, getTheme, type Theme } from "@/lib/theme";
import { isOnline } from "@/lib/format";
import { Switch, cx } from "./ui";
import { SetupBanner } from "./SetupBanner";

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-7 place-items-center rounded-md bg-primary">
        <span className="size-3.5 rounded-full border-[3px] border-accent" />
      </span>
      {!collapsed && <span className="text-[17px] font-bold tracking-tight">Job Agent</span>}
    </div>
  );
}

function NavItem({ to, icon, label, count, collapsed, onClick }: { to: string; icon: ReactNode; label: string; count?: number; collapsed: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cx(
          "group flex items-center gap-3 rounded-md px-3 h-9 text-[14px] font-medium transition-colors",
          isActive ? "bg-nav-active text-text [&_svg]:text-accent-strong" : "text-muted hover:text-text hover:bg-nav-active/60",
          collapsed && "justify-center px-0",
        )
      }
    >
      <span className="[&_svg]:size-[18px]">{icon}</span>
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && !!count && <span className="rounded-full bg-warning px-1.5 min-w-5 text-center text-[11px] font-semibold text-white leading-5">{count}</span>}
      {collapsed && !!count && <span className="absolute ml-6 -mt-5 size-2 rounded-full bg-warning" />}
    </NavLink>
  );
}

function Sidebar({ collapsed, setCollapsed, onNavigate }: { collapsed: boolean; setCollapsed: (v: boolean) => void; onNavigate?: () => void }) {
  const { data: openQs } = useCollection("questions");
  const openCount = openQs.filter((q) => q.status === "open").length;
  const { data: worker } = useDoc("workerStatus", "main");
  const online = isOnline(worker?.heartbeatAt);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const cycleTheme = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
  };
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <div className="flex h-full flex-col bg-bg-subtle">
      <div className={cx("flex h-16 items-center", collapsed ? "justify-center" : "px-5")}>
        <Logo collapsed={collapsed} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {!collapsed && <div className="px-3 pt-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Agent</div>}
        <NavItem to="/" icon={<LayoutGrid />} label="Overview" collapsed={collapsed} onClick={onNavigate} />
        <NavItem to="/jobs" icon={<Briefcase />} label="Jobs" collapsed={collapsed} onClick={onNavigate} />
        <NavItem to="/questions" icon={<MessageCircleQuestion />} label="Questions" count={openCount} collapsed={collapsed} onClick={onNavigate} />
        <NavItem to="/applications" icon={<Send />} label="Applications" collapsed={collapsed} onClick={onNavigate} />
        {!collapsed && <div className="px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Account</div>}
        {collapsed && <div className="my-3 border-t border-border" />}
        <NavItem to="/profile" icon={<UserRound />} label="Profile & Resume" collapsed={collapsed} onClick={onNavigate} />
        <NavItem to="/settings" icon={<SettingsIcon />} label="Settings" collapsed={collapsed} onClick={onNavigate} />
      </nav>
      <div className="px-3 pb-3 space-y-0.5">
        <div className={cx("flex items-center gap-3 px-3 h-9 text-[13px] text-muted", collapsed && "justify-center px-0")} title={online ? "Agent service online" : "Agent service offline"}>
          <span className={cx("size-2 rounded-full", online ? "bg-accent" : "bg-border-strong")} />
          {!collapsed && <span>Agent service {online ? "online" : "offline"}</span>}
        </div>
        <button onClick={cycleTheme} className={cx("flex w-full items-center gap-3 rounded-md px-3 h-9 text-[14px] text-muted hover:text-text hover:bg-nav-active/60 cursor-pointer", collapsed && "justify-center px-0")}>
          <ThemeIcon className="size-[18px]" />
          {!collapsed && <span className="capitalize">Theme: {theme}</span>}
        </button>
        <div className="border-t border-border my-2" />
        <button onClick={() => setCollapsed(!collapsed)} className={cx("hidden lg:flex w-full items-center gap-3 rounded-md px-3 h-9 text-[14px] text-muted hover:text-text hover:bg-nav-active/60 cursor-pointer", collapsed && "justify-center px-0")}>
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && <span>Collapse menu</span>}
        </button>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useDoc("settings", "main");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const running = settings ? !settings.paused : false;
  const initial = (user?.email ?? "?")[0].toUpperCase();

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-bg px-4 lg:px-8">
      <button className="lg:hidden p-1.5 -ml-1 rounded text-muted hover:text-text cursor-pointer" onClick={onMenu} aria-label="Open menu"><Menu className="size-5" /></button>
      <form
        className="relative w-full max-w-md lg:mx-auto"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/jobs?q=${encodeURIComponent(q)}`);
        }}
      >
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          id="global-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs, companies..."
          className="h-9 w-full rounded-md border border-border-strong bg-surface pl-9 pr-14 text-sm placeholder:text-faint focus:outline-none focus:border-text"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint font-sans">Ctrl K</kbd>
      </form>
      <div className="ml-auto flex items-center gap-3">
        {settings && (
          <div className="hidden sm:flex items-center gap-2 rounded-md border border-border-strong px-3 h-9">
            <Switch checked={running} onChange={(v) => updateDocument("settings", "main", { paused: !v })} />
            <span className="text-sm font-medium">{running ? "Agent running" : "Agent paused"}</span>
          </div>
        )}
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-md px-1.5 h-9 hover:bg-surface-2 cursor-pointer">
            <span className="grid size-7 place-items-center rounded-full bg-accent text-[13px] font-semibold text-[#0c0d0d]">{initial}</span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-11 z-40 w-60 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
                <div className="px-3 py-2 text-sm">
                  <div className="font-medium truncate">{user?.email}</div>
                  <div className="text-xs text-faint">{backend.kind === "local" ? "Local dev data" : "Firebase"}</div>
                </div>
                {backend.kind === "firebase" && (
                  <button onClick={() => signOut()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:text-text hover:bg-surface-2 cursor-pointer">
                    <LogOut className="size-4" /> Sign out
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-full">
      <aside className={cx("hidden lg:block shrink-0 border-r border-border transition-[width]", collapsed ? "w-[68px]" : "w-[248px]")}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[260px] border-r border-border">
            <button className="absolute right-3 top-5 p-1 text-muted cursor-pointer" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
            <Sidebar collapsed={false} setCollapsed={() => {}} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1180px] px-4 py-8 lg:px-10">
            <SetupBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
