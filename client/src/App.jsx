import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Navbar from "./components/Navbar.jsx";
import WorkspaceLayout from "./components/WorkspaceLayout.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const SurveyBuilder = lazy(() => import("./pages/SurveyBuilder.jsx"));
const PublicSurvey = lazy(() => import("./pages/PublicSurvey.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const WorkspacePage = lazy(() => import("./pages/Workspace.jsx"));
const InvitationPage = lazy(() => import("./pages/Invitation.jsx"));
const Distribution = lazy(() => import("./pages/Distribution.jsx"));
const Developer = lazy(() => import("./pages/Developer.jsx"));

function Layout() {
  const location = useLocation();
  // Hide the app navbar on the public survey-taking page for a clean,
  // distraction-free respondent experience.
  const isPublicSurveyPage = location.pathname.startsWith("/survey/");
  const isWorkspacePage =
    location.pathname === "/dashboard" ||
    location.pathname === "/workspace" ||
    location.pathname === "/developer" ||
    location.pathname.startsWith("/builder/") ||
    location.pathname.startsWith("/analytics/") ||
    location.pathname.startsWith("/distribution/");

  return (
    <>
      {!isPublicSurveyPage && !isWorkspacePage && <Navbar />}
      <Suspense fallback={<div className="route-loading" role="status">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invite/:token" element={<InvitationPage />} />
          <Route path="/survey/:slug" element={<PublicSurvey />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <WorkspaceLayout>
                  {({ search, onSearchChange, workspaceId, workspaceLoading, workspaceError }) => (
                    <Dashboard
                      search={search}
                      onSearchChange={onSearchChange}
                      workspaceId={workspaceId}
                      workspaceLoading={workspaceLoading}
                      workspaceError={workspaceError}
                    />
                  )}
                </WorkspaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <WorkspaceLayout>
                  <WorkspacePage />
                </WorkspaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/developer"
            element={
              <ProtectedRoute>
                <WorkspaceLayout>
                  <Developer />
                </WorkspaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/builder/:id"
            element={
              <ProtectedRoute>
                <WorkspaceLayout>
                  <SurveyBuilder />
                </WorkspaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics/:id"
            element={
              <ProtectedRoute>
                <WorkspaceLayout>
                  <Analytics />
                </WorkspaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/distribution/:id"
            element={
              <ProtectedRoute>
                <WorkspaceLayout>
                  <Distribution />
                </WorkspaceLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Layout />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
