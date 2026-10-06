import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "./AuthContext.jsx";
import { createWorkspace as createWorkspaceRequest, getWorkspaces } from "../services/workspaceService.js";

const WorkspaceContext = createContext(null);
const STORAGE_KEY = "activeWorkspaceId";

export function WorkspaceProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceId("");
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return [];
    }
    setLoading(true);
    setError("");
    try {
      const next = await getWorkspaces();
      setWorkspaces(next);
      const preferred = next.find((workspace) => workspace.id === localStorage.getItem(STORAGE_KEY)) || next[0];
      const nextId = preferred?.id || "";
      setActiveWorkspaceId(nextId);
      if (nextId) localStorage.setItem(STORAGE_KEY, nextId);
      else localStorage.removeItem(STORAGE_KEY);
      return next;
    } catch (requestError) {
      console.error("Failed to load workspaces", requestError);
      setError(requestError.response?.data?.message || "Failed to load workspaces");
      setLoading(false);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refreshWorkspaces().catch(() => {});
  }, [authLoading, refreshWorkspaces]);

  function selectWorkspace(id) {
    setActiveWorkspaceId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const createWorkspace = useCallback(async (name) => {
    const created = await createWorkspaceRequest(name);
    await refreshWorkspaces();
    setActiveWorkspaceId(created.id);
    localStorage.setItem(STORAGE_KEY, created.id);
    toast.success("Workspace created");
    return created;
  }, [refreshWorkspaces]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  const value = useMemo(() => ({
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading: authLoading || loading,
    error,
    selectWorkspace,
    createWorkspace,
    refreshWorkspaces
  }), [workspaces, activeWorkspace, activeWorkspaceId, authLoading, loading, error, createWorkspace, refreshWorkspaces]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  return context;
}
