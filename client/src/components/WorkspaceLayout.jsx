import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import DarkModeToggle from "./DarkModeToggle.jsx";
import { Icon, Dropdown, Input, Tooltip } from "./ui.jsx";

const NAV_GROUPS = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Dashboard", icon: "grid", to: "/dashboard", active: (path) => path === "/dashboard" },
      { label: "Surveys", icon: "clipboard", to: "/dashboard#surveys", active: (path, hash) => path === "/dashboard" && hash === "#surveys" },
      { label: "Analytics", icon: "chart", to: "/dashboard#surveys", active: (path) => path.startsWith("/analytics/") }
    ]
  },
  {
    label: "COLLABORATION",
    items: [
      { label: "Team & Members", icon: "users", to: "/workspace", active: (path) => path === "/workspace" }
    ]
  },
  {
    label: "DISTRIBUTION",
    items: [
      { label: "Email Campaigns", icon: "send", to: "/dashboard#surveys", active: (path) => path.startsWith("/distribution/") }
    ]
  },
  {
    label: "DEVELOPER",
    items: [
      { label: "Developer / API", icon: "code", to: "/developer", active: (path) => path === "/developer" }
    ]
  }
];

export default function WorkspaceLayout({ children }) {
  const { user, logout } = useAuth();
  const { workspaces, activeWorkspace, activeWorkspaceId, selectWorkspace, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const mobileMenuButtonRef = useRef(null);
  const previousMobileOpen = useRef(false);
  const isAnalytics = location.pathname.startsWith("/analytics/");
  const isDashboard = location.pathname === "/dashboard";
  const pageTitle = isAnalytics ? "Analytics" : location.pathname === "/developer" ? "Developer / API" : location.pathname === "/workspace" ? "Team / Workspace" : location.pathname.startsWith("/builder/") ? "Survey builder" : location.pathname.startsWith("/distribution/") ? "Email distribution" : "Dashboard";
  const initials = (user?.name || "User").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  function closeMobile() {
    setMobileOpen(false);
  }

  useEffect(() => {
    if (mobileOpen) {
      requestAnimationFrame(() => document.querySelector(".workspace-sidebar.is-open .workspace-nav a")?.focus());
      previousMobileOpen.current = true;
      return;
    }
    if (previousMobileOpen.current) mobileMenuButtonRef.current?.focus();
    previousMobileOpen.current = false;
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") closeMobile();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className="workspace-app">
      {mobileOpen && <button className="workspace-overlay" aria-label="Close navigation" onClick={closeMobile} />}
      <aside id="workspace-sidebar" className={`workspace-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link to="/dashboard" className="brand-mark" onClick={closeMobile}>
          <span className="brand-mark__icon"><Icon name="sparkles" size={19} /></span>
          <span>Smart Survey Builder</span>
        </Link>

        <Dropdown
          label={<><span className="workspace-avatar">{(activeWorkspace?.name || "W").charAt(0).toUpperCase()}</span><span className="workspace-select__copy"><strong>{activeWorkspace?.name || "Loading workspace..."}</strong><small>{activeWorkspace?.role || "Workspace"}</small></span><Icon name="chevron" size={15} /></>}
          labelClassName="workspace-select"
        >
          {workspaces.map((workspace) => (
            <button
              type="button"
              className="workspace-picker-option"
              key={workspace.id}
              onClick={() => selectWorkspace(workspace.id)}
            >
              <span className="workspace-avatar">{workspace.name.charAt(0).toUpperCase()}</span>
              <span><strong>{workspace.name}</strong><small>{workspace.role}</small></span>
              {workspace.id === activeWorkspaceId && <span className="workspace-picker-check">✓</span>}
            </button>
          ))}
          <Link className="workspace-picker-manage" to="/workspace">Manage workspaces</Link>
        </Dropdown>

        <nav className="workspace-nav" aria-label="Workspace navigation">
          {NAV_GROUPS.map((group) => (
            <div className="workspace-nav-group" key={group.label}>
              <div className="sidebar-section-label">{group.label}</div>
              {group.items.map((item) => {
                const active = item.active?.(location.pathname, location.hash);
                return (
                  <Link key={item.label} to={item.to} onClick={closeMobile} className={`workspace-nav__item ${active ? "is-active" : ""}`}>
                    <Icon name={item.icon} size={18} /><span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-help">
          <span className="sidebar-help__icon"><Icon name="sparkles" size={16} /></span>
          <strong>Make better surveys</strong>
          <p>Build clear, thoughtful forms your audience loves.</p>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-topbar__left">
            <button ref={mobileMenuButtonRef} className="mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-sidebar" onClick={() => setMobileOpen(true)}>
              <Icon name="menu" />
            </button>
            <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{pageTitle}</strong></div>
            {isDashboard && (
              <label className="topbar-search">
                <Icon name="search" size={17} />
                <Input
                  type="search"
                  aria-label="Search surveys"
                  placeholder="Search surveys..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            )}
          </div>
          <div className="workspace-topbar__right">
            <DarkModeToggle />
            <Dropdown
              label={<><span className="workspace-avatar">{(activeWorkspace?.name || "W").charAt(0).toUpperCase()}</span><span className="topbar-workspace-name">{activeWorkspace?.name || "Workspace"}</span><Icon name="chevron" size={14} /></>}
              labelClassName="topbar-workspace"
            >
              {workspaces.map((workspace) => (
                <button
                  type="button"
                  className="workspace-picker-option"
                  key={workspace.id}
                  onClick={() => selectWorkspace(workspace.id)}
                >
                  <span className="workspace-avatar">{workspace.name.charAt(0).toUpperCase()}</span>
                  <span><strong>{workspace.name}</strong><small>{workspace.role}</small></span>
                  {workspace.id === activeWorkspaceId && <span className="workspace-picker-check">✓</span>}
                </button>
              ))}
            </Dropdown>
            <Tooltip label="You're all caught up">
              <button className="icon-button" aria-label="Notifications" disabled><Icon name="bell" size={18} /></button>
            </Tooltip>
            <Dropdown
              label={<><span className="profile-avatar">{initials}</span><span className="topbar-profile-name">{user?.name || "Your account"}</span><Icon name="chevron" size={14} /></>}
              labelClassName="profile-menu-trigger"
            >
              <div className="profile-menu">
                <strong>{user?.name}</strong>
                <small>{user?.email}</small>
                <button type="button" onClick={logout}>Log out</button>
              </div>
            </Dropdown>
          </div>
        </header>
        <main className="workspace-content">
          {typeof children === "function"
            ? children({
              search,
              onSearchChange: setSearch,
              workspaceId: activeWorkspaceId,
              activeWorkspace,
              workspaces,
              selectWorkspace,
              workspaceLoading,
              workspaceError
            })
            : children}
        </main>
      </div>
    </div>
  );
}
