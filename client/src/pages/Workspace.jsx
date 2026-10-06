import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import {
  getWorkspace,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMember
} from "../services/workspaceService.js";
import { Badge, Button, EmptyState, Icon, Input, Modal, Select } from "../components/ui.jsx";

function titleCase(value) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function RoleBadge({ role }) {
  const tone = role === "OWNER" ? "violet" : role === "EDITOR" ? "blue" : "neutral";
  return <Badge tone={tone}>{titleCase(role)}</Badge>;
}

function InvitationStatus({ status }) {
  const tone = status === "accepted" ? "success" : status === "expired" ? "danger" : "warning";
  return <Badge tone={tone}><span className="badge-dot" />{titleCase(status)}</Badge>;
}

export default function WorkspacePage() {
  const { activeWorkspace, activeWorkspaceId, createWorkspace, refreshWorkspaces, loading: workspacesLoading, error: workspacesError } = useWorkspace();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EDITOR");
  const [workspaceName, setWorkspaceName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [invitationLink, setInvitationLink] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!activeWorkspaceId) {
      setLoading(false);
      setWorkspace(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getWorkspace(activeWorkspaceId);
      setWorkspace(data);
      setWorkspaceName(data.name);
    } catch (requestError) {
      console.error("Failed to load workspace members", requestError);
      setError(requestError.response?.data?.message || "Couldn't load this workspace.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  async function handleInvite(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const invitation = await inviteWorkspaceMember(activeWorkspaceId, inviteEmail, inviteRole);
      const link = `${window.location.origin}${invitation.invitationPath}`;
      setInvitationLink(link);
      setInviteEmail("");
      setInviteRole("EDITOR");
      setInviteOpen(false);
      await loadWorkspace();
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Invite created and link copied");
      } catch (clipboardError) {
        console.error("Failed to copy invitation link", clipboardError);
        toast.success("Invite created");
      }
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Couldn't create the invitation");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member, role) {
    try {
      await updateWorkspaceMember(activeWorkspaceId, member.id, role);
      toast.success(`${member.name}'s role updated`);
      await loadWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Couldn't update member role");
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await removeWorkspaceMember(activeWorkspaceId, removeTarget.id);
      setRemoveTarget(null);
      toast.success("Member removed");
      await loadWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Couldn't remove member");
    }
  }

  async function handleSaveName(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateWorkspace(activeWorkspaceId, workspaceName);
      await refreshWorkspaces();
      await loadWorkspace();
      toast.success("Workspace name saved");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Couldn't save workspace name");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateWorkspace(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await createWorkspace(newWorkspaceName);
      setNewWorkspaceName("");
      setCreateOpen(false);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Couldn't create workspace");
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(invitationLink);
      toast.success("Invitation link copied");
    } catch (copyError) {
      console.error("Failed to copy invitation link", copyError);
      toast.error("Couldn't copy the invitation link");
    }
  }

  if (loading || workspacesLoading) return <div className="workspace-loading"><div className="ui-skeleton h-8 w-1/3" /><div className="ui-skeleton h-48" /></div>;
  if (workspacesError && !activeWorkspace) return <EmptyState icon="users" title="Workspaces unavailable" description={workspacesError} action={<Button onClick={() => refreshWorkspaces().catch((requestError) => toast.error(requestError.response?.data?.message || "Couldn't load workspaces"))}>Try again</Button>} />;
  if (error) return <EmptyState icon="users" title="Workspace unavailable" description={error} action={<Button onClick={loadWorkspace}>Try again</Button>} />;
  if (!workspace) return <EmptyState icon="users" title="No workspace selected" description="Create a workspace or choose one from the workspace switcher." action={<Button variant="primary" onClick={() => setCreateOpen(true)}>Create workspace</Button>} />;

  const canManage = workspace.role === "OWNER";
  const ownerCount = workspace.memberCount;

  return (
    <div className="workspace-page">
      <div className="workspace-page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> TEAM SETTINGS</div>
          <h1>Workspace members</h1>
          <p>Manage who can access surveys in <strong>{workspace.name}</strong>.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> New workspace</Button>
      </div>

      <div className="workspace-page-stats">
        <div><span className="workspace-page-stat-icon"><Icon name="users" /></span><span><small>Members</small><strong>{ownerCount}</strong></span></div>
        <div><span className="workspace-page-stat-icon workspace-page-stat-icon--purple"><Icon name="clipboard" /></span><span><small>Your role</small><strong>{titleCase(workspace.role)}</strong></span></div>
        <div><span className="workspace-page-stat-icon workspace-page-stat-icon--green"><Icon name="clock" /></span><span><small>Pending invites</small><strong>{workspace.invitations.filter((item) => item.status === "pending").length}</strong></span></div>
      </div>

      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div><h2>Workspace details</h2><p>Choose a name your team will recognize.</p></div>
        </div>
        <form className="workspace-name-form" onSubmit={handleSaveName}>
          <label><span>Workspace name</span><Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={80} disabled={!canManage} /></label>
          {canManage && <Button type="submit" disabled={saving || workspaceName.trim() === workspace.name}>{saving ? "Saving..." : "Save changes"}</Button>}
        </form>
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div><h2>Members <span className="member-count">{workspace.memberCount}</span></h2><p>People who can access workspace surveys.</p></div>
          {canManage && <Button variant="primary" onClick={() => setInviteOpen(true)}><Icon name="plus" size={16} /> Invite member</Button>}
        </div>
        <div className="member-list">
          {workspace.members.map((member) => (
            <div className="member-row" key={member.id}>
              <span className={`member-avatar member-avatar--${member.role.toLowerCase()}`}>{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div className="member-identity"><strong>{member.name}</strong><span>{member.email}</span></div>
              <RoleBadge role={member.role} />
              {canManage && member.role !== "OWNER" ? (
                <div className="member-actions">
                  <Select aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => handleRoleChange(member, event.target.value)}>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </Select>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${member.name}`} onClick={() => setRemoveTarget(member)}><Icon name="trash" size={16} /></Button>
                </div>
              ) : (
                <span className="member-joined">{member.role === "OWNER" ? "Workspace owner" : "Member"}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {canManage && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div><h2>Invitations <span className="member-count">{workspace.invitations.length}</span></h2><p>Invitation links are valid for 7 days and can only be accepted by the invited email.</p></div>
          </div>
          {workspace.invitations.length === 0 ? (
            <div className="workspace-invite-empty"><Icon name="send" size={17} /> No invitations yet.</div>
          ) : (
            <div className="invitation-list">
              {workspace.invitations.map((invitation) => (
                <div className="invitation-row" key={invitation.id}>
                  <div><strong>{invitation.email}</strong><span>{titleCase(invitation.role)} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span></div>
                  <InvitationStatus status={invitation.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        open={inviteOpen}
        title="Invite a teammate"
        description={`Invite someone to join ${workspace.name}. They'll need an account with this email to accept.`}
        onClose={() => setInviteOpen(false)}
        footer={<><Button onClick={() => setInviteOpen(false)}>Cancel</Button><Button variant="primary" type="submit" form="invite-member-form" disabled={saving}>{saving ? "Creating invite..." : "Send invitation"}</Button></>}
      >
        <form id="invite-member-form" className="workspace-modal-form" onSubmit={handleInvite}>
          <label><span>Email address</span><Input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" autoFocus /></label>
          <label><span>Workspace role</span><Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="EDITOR">Editor — edit surveys and view results</option><option value="VIEWER">Viewer — view surveys and results</option></Select></label>
        </form>
      </Modal>

      <Modal
        open={Boolean(invitationLink)}
        title="Invitation link ready"
        description="Share this secure link with the invited person. It expires in 7 days and can only be accepted by the invited email."
        onClose={() => setInvitationLink("")}
        footer={<><Button onClick={() => setInvitationLink("")}>Done</Button><Button variant="primary" onClick={copyInviteLink}><Icon name="copy" size={15} /> Copy link</Button></>}
      >
        <Input readOnly value={invitationLink} onFocus={(event) => event.target.select()} />
      </Modal>

      <Modal
        open={Boolean(removeTarget)}
        title="Remove workspace member?"
        description={`${removeTarget?.name || "This member"} will lose access to workspace surveys immediately.`}
        onClose={() => setRemoveTarget(null)}
        footer={<><Button onClick={() => setRemoveTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleRemove}>Remove member</Button></>}
      >
        <p className="modal-warning"><Icon name="users" size={17} /> Their individual survey permissions in this workspace will also be removed.</p>
      </Modal>

      <Modal
        open={createOpen}
        title="Create a workspace"
        description="Start a separate space for another team or project."
        onClose={() => setCreateOpen(false)}
        footer={<><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" type="submit" form="create-workspace-form" disabled={saving}>{saving ? "Creating..." : "Create workspace"}</Button></>}
      >
        <form id="create-workspace-form" className="workspace-modal-form" onSubmit={handleCreateWorkspace}>
          <label><span>Workspace name</span><Input value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} placeholder="e.g. Product research" maxLength={80} required autoFocus /></label>
        </form>
      </Modal>
    </div>
  );
}
