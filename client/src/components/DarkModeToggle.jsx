import { useEffect, useState } from "react";

function getInitialDarkMode() {
  const stored = localStorage.getItem("darkMode");
  if (stored !== null) return stored === "true";
  return false;
}

export default function DarkModeToggle() {
  const [dark, setDark] = useState(getInitialDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("darkMode", String(dark));
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="dark-mode-toggle"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
