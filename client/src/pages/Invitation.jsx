import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { acceptInvitation, getInvitation } from "../services/workspaceService.js";
import { Badge, Button, EmptyState, Icon } from "../components/ui.jsx";

function roleLabel(role) {
  return role ? `${role.charAt(0)}${role.slice(1).toLowerCase()}` : "";
}

export default function InvitationPage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { refreshWorkspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getInvitation(token)
      .then((data) => { if (active) setInvitation(data); })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "This invitation couldn't be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      const result = await acceptInvitation(token);
      await refreshWorkspaces();
      selectWorkspace(result.workspaceId);
      toast.success("You've joined the workspace");
      navigate("/workspace", { replace: true });
    } catch (requestError) {
      const message = requestError.response?.data?.message || "Couldn't accept this invitation.";
      setError(message);
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  }

  if (authLoading || loading) {
    return <div className="invitation-page"><div className="ui-skeleton h-52 w-full" /></div>;
  }

  if (error && !invitation) {
    return <div className="invitation-page"><EmptyState icon="users" title="Invitation unavailable" description={error} action={<Link to="/dashboard"><Button>Go to dashboard</Button></Link>} /></div>;
  }

  const expired = invitation.status === "expired";
  const accepted = invitation.status === "accepted";
  const correctAccount = user?.email?.toLowerCase() === invitation.email.toLowerCase();
  const returnTo = `/invite/${token}`;

  return (
    <div className="invitation-page">
      <section className="invitation-card">
        <span className="invitation-icon"><Icon name="users" size={22} /></span>
        <div className="eyebrow"><span className="eyebrow-dot" /> WORKSPACE INVITATION</div>
        <h1>{expired ? "This invitation expired" : accepted ? "Invitation already accepted" : "Join your team"}</h1>
        <p className="invitation-intro">
          {expired
            ? "Ask the workspace owner to send you a new invitation."
            : accepted
              ? "This invitation has already been used."
              : <>You've been invited to join <strong>{invitation.workspaceName}</strong>.</>}
        </p>
        {!expired && (
          <div className="invitation-details">
            <span>Invited email</span><strong>{invitation.email}</strong>
            <span>Workspace role</span><Badge tone={invitation.role === "EDITOR" ? "blue" : "neutral"}>{roleLabel(invitation.role)}</Badge>
          </div>
        )}
        {error && <p className="invitation-error" role="alert">{error}</p>}
        {!user && !expired && !accepted && (
          <div className="invitation-actions">
            <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}><Button variant="primary">Log in to accept</Button></Link>
            <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`} className="invitation-secondary-link">Create account</Link>
          </div>
        )}
        {user && !expired && !accepted && !correctAccount && (
          <div className="invitation-account-warning">
            <p>You're signed in as <strong>{user.email}</strong>. Log in using <strong>{invitation.email}</strong> to accept this invite.</p>
            <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}><Button>Switch account</Button></Link>
          </div>
        )}
        {user && correctAccount && !expired && !accepted && (
          <Button variant="primary" onClick={handleAccept} disabled={accepting}>{accepting ? "Joining..." : "Accept invitation"}</Button>
        )}
        {(expired || accepted) && <Link to="/dashboard"><Button>Go to dashboard</Button></Link>}
      </section>
    </div>
  );
}
