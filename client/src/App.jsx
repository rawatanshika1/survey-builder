import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import SurveyBuilder from "./pages/SurveyBuilder.jsx";
import PublicSurvey from "./pages/PublicSurvey.jsx";
import Analytics from "./pages/Analytics.jsx";

function Layout() {
  const location = useLocation();
  // Hide the app navbar on the public survey-taking page for a clean,
  // distraction-free respondent experience.
  const isPublicSurveyPage = location.pathname.startsWith("/survey/");

  return (
    <>
      {!isPublicSurveyPage && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/survey/:slug" element={<PublicSurvey />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/builder/:id"
          element={
            <ProtectedRoute>
              <SurveyBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/:id"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <Layout />
    </AuthProvider>
  );
}
