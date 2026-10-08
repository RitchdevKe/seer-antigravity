import * as React from "react";
import {
  BarChart3,
  PlayCircle,
  History,
  Cpu,
  BrainCircuit,
  BarChart2,
  Eye,
  LogOut,
  Shield,
  RefreshCw,
  Menu,
  X,
  Sparkles,
  Database,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

/** All view modes exposed by MatchAnalysis. Kept in sync with its union. */
export type ShellView =
  | "analysis"
  | "live"
  | "archive"
  | "nerdy"
  | "ai"
  | "sub_pattern_audit"
  | "seer"
  | "perf"
  | "ml"
  | "opw_comp";

interface NavItem {
  id: ShellView;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  hint?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { id: "analysis", label: "Analysis Board", icon: BarChart3, hint: "Historical patterns" },
  { id: "live", label: "Live Analysis", icon: PlayCircle, hint: "Daily & jackpot" },
  { id: "seer", label: "SEER", icon: Eye, hint: "Self-learning algo" },
  { id: "ai", label: "AI Analyst", icon: BrainCircuit, hint: "Gemini studio" },
  { id: "ml", label: "SEER Intelligence", icon: Database, hint: "Machine Learning" },
];
const SECONDARY_NAV: NavItem[] = [
  { id: "nerdy", label: "Nerdy Tips", icon: Cpu },
  { id: "sub_pattern_audit", label: "Pattern Audit", icon: BarChart2 },
  { id: "archive", label: "Archives", icon: History },
];

interface AppShellProps {
  activeView: ShellView;
  onNavigate: (view: ShellView) => void;
  currentUser?: { username?: string; name?: string; role?: string } | null;
  onLogout?: () => void;
  onNavigateAdmin?: () => void;
  onSyncCloud?: () => void;
  syncing?: boolean;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Dashboard shell: collapsible sidebar nav + sticky top bar + content slot.
 * Owns *only* presentation — every action bubbles up via callbacks so the
 * underlying view logic in MatchAnalysis remains the single source of truth.
 */
export const AppShell: React.FC<AppShellProps> = ({
  activeView,
  onNavigate,
  currentUser,
  onLogout,
  onNavigateAdmin,
  onSyncCloud,
  syncing,
  banner,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // Desktop sidebar collapse — persisted so the layout doesn't jump on reload.
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try { return localStorage.getItem("prm_sidebar_collapsed") === "1"; } catch { return false; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("prm_sidebar_collapsed", collapsed ? "1" : "0"); } catch { /* quota */ }
  }, [collapsed]);


  const NavList = ({ items, label }: { items: NavItem[]; label: string }) => (
    <div className="flex flex-col gap-1">
      <div className="px-3 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
        {label}
      </div>
      {items.map((item) => {
        const active = activeView === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => {
              setMobileOpen(false);
              onNavigate(item.id);
            }}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
              active
                ? "bg-[var(--color-primary)]/12 text-[var(--color-primary)] font-semibold"
                : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--color-primary)]" />
            )}
            <Icon size={17} className="shrink-0" />
            <span className="flex-1 text-left leading-tight">
              <span className="block">{item.label}</span>
              {item.hint && (
                <span className="block text-[10px] font-normal text-[var(--color-muted-foreground)]/80">
                  {item.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );

  const SidebarInner = (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-[var(--color-border)]">
        <div className="grid h-9 w-9 place-items-center rounded-lg gradient-primary shadow-[0_0_24px_hsl(45_55%_54%_/_0.45)]">
          <Sparkles size={18} className="text-[var(--color-primary-foreground)]" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base font-bold tracking-tight text-[var(--color-foreground)]">
            SEER<span className="text-gradient-primary">.AI</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">
            Prediction Suite
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <NavList items={PRIMARY_NAV} label="Workspaces" />
        <NavList items={SECONDARY_NAV} label="Insights" />
      </nav>

      {currentUser && (
        <div className="border-t border-[var(--color-border)] p-3">
          <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-secondary)] text-sm font-bold text-[var(--color-primary-glow)]">
              {(currentUser.name || currentUser.username || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                {currentUser.name || currentUser.username}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {currentUser.role || "User"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full">
      {/* Fixed sidebar (desktop). Slides off-canvas when collapsed. */}
      <aside
        className={cn(
          "hidden md:flex fixed inset-y-0 left-0 z-40 w-44 flex-col",
          "glass border-r border-[var(--color-border)] transition-transform duration-300",
          collapsed && "-translate-x-full",
        )}
        aria-hidden={collapsed}
      >
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 md:hidden glass border-r border-[var(--color-border)] animate-fade-in">
            {SidebarInner}
          </aside>
        </>
      )}

      {/* Main column — reflows when the desktop sidebar collapses. */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300",
          collapsed ? "md:pl-0" : "md:pl-44",
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/70 px-4 md:px-6 backdrop-blur-xl">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>

          {/* Desktop sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <Menu size={20} />
          </Button>


          <div className="flex items-center gap-2">
            <ViewTitle view={activeView} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {syncing && (
              <Badge variant="info" className="hidden sm:inline-flex">
                <RefreshCw size={12} className="animate-spin" /> Syncing
              </Badge>
            )}

            {onSyncCloud && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => React.startTransition(() => onSyncCloud())}
                disabled={syncing}
                title="Refresh from cloud"
              >
                <RefreshCw size={14} className={cn(syncing && "animate-spin")} />
                <span className="hidden sm:inline">Sync</span>
              </Button>
            )}

            {currentUser?.role === "Super Admin" && onNavigateAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => React.startTransition(() => onNavigateAdmin())}
                title="Admin panel"
              >
                <Shield size={14} />
                <span className="hidden md:inline">Admin</span>
              </Button>
            )}

            {onLogout && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => React.startTransition(() => onLogout())}
                aria-label="Log out"
                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
              >
                <LogOut size={18} />
              </Button>
            )}
          </div>
        </header>

        {banner && <div className="px-4 md:px-6 pt-4">{banner}</div>}

        <main className={cn("flex-1 pt-4 pb-10 md:pt-6", activeView === "seer" ? "px-0 md:px-0.5 pt-2 pb-8 md:pt-3" : "px-3 md:px-6")}>{children}</main>
      </div>
    </div>
  );
};

const VIEW_META: Record<ShellView, { title: string; sub: string }> = {
  analysis: { title: "Analysis Board", sub: "Historical pattern analysis" },
  live: { title: "Live Analysis", sub: "Daily & jackpot predictions" },
  archive: { title: "Archives", sub: "Archived sessions" },
  nerdy: { title: "Nerdy Tips", sub: "Extract & analyze matches" },
  ai: { title: "AI Analyst", sub: "Gemini-powered studio" },
  sub_pattern_audit: { title: "Pattern Audit", sub: "Sub-pattern accuracy" },
  seer: { title: "SEER Analysis", sub: "Self-learning algorithm" },
  perf: { title: "Live Performance", sub: "Live analysis performance" },
  ml: { title: "SEER Intelligence", sub: "ML Engine & Pattern Studies" },
  opw_comp: { title: "OPW Comparison", sub: "Bonus and penalty accuracy breakdown" },
};

const ViewTitle: React.FC<{ view: ShellView }> = ({ view }) => {
  const meta = VIEW_META[view] ?? VIEW_META.analysis;
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[15px] font-semibold tracking-tight text-[var(--color-foreground)]">
        {meta.title}
      </span>
      <span className="hidden sm:block text-[11px] text-[var(--color-muted-foreground)]">
        {meta.sub}
      </span>
    </div>
  );
};

export default AppShell;
