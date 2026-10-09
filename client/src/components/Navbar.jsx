import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import DarkModeToggle from "./DarkModeToggle.jsx";

function ChatMark() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M4 10.5A5.5 5.5 0 0 1 9.5 5h15a5.5 5.5 0 0 1 5.5 5.5v9a5.5 5.5 0 0 1-5.5 5.5h-9l-7 5v-6.1A5.5 5.5 0 0 1 4 18.5v-8Z" fill="#14b8c4" />
      <path d="M14 19.5A5.5 5.5 0 0 1 19.5 14h11a5.5 5.5 0 0 1 5.5 5.5v8a5.5 5.5 0 0 1-5.5 5.5h-2l-6 4v-4h-3a5.5 5.5 0 0 1-5.5-5.5v-8Z" fill="#0f2a43" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <nav className="site-navbar" aria-label="Main navigation">
      <Link to="/" className="site-navbar__brand" onClick={closeMenu}>
        <ChatMark />
        <span>AskFlow</span>
      </Link>
      <button
        type="button"
        className="site-navbar__toggle"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>
      <div className={`site-navbar__content ${menuOpen ? "is-open" : ""}`}>
        <div className="site-navbar__links">
          {[
            ["Home", "/"],
            ["Features", "/#features"],
            ["How it works", "/#how"],
            ["Contact", "/#contact"]
          ].map(([label, to]) => (
            <Link
              key={label}
              to={to}
              onClick={closeMenu}
              className={`site-navbar__link ${label === "Home" && location.pathname === "/" ? "is-active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="site-navbar__actions">
          <DarkModeToggle />
          {user ? (
            <>
              <Link to="/dashboard" className="site-navbar__login" onClick={closeMenu}>Dashboard</Link>
              <span className="site-navbar__user">{user.name}</span>
              <button type="button" onClick={handleLogout} className="site-navbar__logout">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="site-navbar__login" onClick={closeMenu}>Login</Link>
              <Link to="/register" className="site-navbar__register" onClick={closeMenu}>Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
