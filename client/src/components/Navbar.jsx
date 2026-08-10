import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import DarkModeToggle from "./DarkModeToggle.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
      <Link to="/" className="font-bold text-lg">
        Smart Survey Builder
      </Link>

      <div className="flex items-center gap-4">
        <DarkModeToggle />
        {user ? (
          <>
            <Link
              to="/dashboard"
              className="text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400"
            >
              Dashboard
            </Link>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
