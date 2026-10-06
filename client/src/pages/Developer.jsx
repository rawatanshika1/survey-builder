import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, Table, Tabs } from "../components/ui.jsx";
import {
  createDeveloperKey,
  getDeveloperKeys,
  getDeveloperUsage,
  revokeDeveloperKey
} from "../services/developerService.js";

const tabs = [
  { key: "keys", label: "API Keys" },
  { key: "docs", label: "Documentation" },
  { key: "usage", label: "Usage" }
];

const scopesAvailable = [
  { id: "READ_SURVEYS", label: "Read surveys", description: "List surveys and view their questions." },
  { id: "READ_RESPONSES", label: "Read responses", description: "Read completed responses for workspace surveys." }
];

const apiBaseUrl = (import.meta.env.VITE_API_URL || `${window.location.origin}/api`).replace(/\/+$/, "");

function displayDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
}

function CodeBlock({ title, value, copyLabel = "Copy" }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${copyLabel} copied`);
    } catch (error) {
      console.error(`Failed to copy ${copyLabel.toLowerCase()}`, error);
      toast.error("Couldn't copy to clipboard. Check your browser permissions.");
    }
  }

  return (
    <div className="developer-code-block">
      <div><strong>{title}</strong><Button size="sm" onClick={copy}><Icon name="copy" size={14} /> Copy</Button></div>
      <pre><code>{value}</code></pre>
    </div>
  );
}

function Documentation() {
  const root = `${apiBaseUrl}/v1`;
  const headers = "Authorization: Bearer YOUR_API_KEY\nAccept: application/json";
  const endpoints = [
    {
      path: "GET /surveys",
      title: "List workspace surveys",
      details: "Requires READ_SURVEYS. Returns surveys in the API key's workspace.",
      params: "page (optional, 1-1000; default 1)\nlimit (optional, 1-100; default 50)"
    },
    {
      path: "GET /surveys/{surveyId}",
      title: "Get a survey",
      details: "Requires READ_SURVEYS. Includes question definitions, never internal fields or secrets.",
      params: "surveyId (required path parameter, MongoDB ObjectId)"
    },
    {
      path: "GET /surveys/{surveyId}/responses",
      title: "List completed responses",
      details: "Requires READ_RESPONSES. Only completed responses for a survey in the API key's workspace are returned.",
      params: "surveyId (required path parameter)\npage (optional, 1-1000; default 1)\nlimit (optional, 1-100; default 50)"
    }
  ];
  const sampleRequest = `curl "${root}/surveys?page=1&limit=50" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Accept: application/json"`;

  return (
    <div className="developer-docs">
      <Card className="developer-docs-intro">
        <span className="developer-docs-icon"><Icon name="code" size={20} /></span>
        <div><h2>Survey Builder API v1</h2><p>Read-only endpoints for connecting workspace survey data to your systems. All endpoints require an API key.</p></div>
      </Card>
      <Card className="developer-docs-auth">
        <h3>Authentication</h3>
        <p>Send your API key in the Authorization header. Keep it on a trusted server; never embed it in browser or mobile application code.</p>
        <CodeBlock title="Request headers" value={headers} copyLabel="Headers" />
        <p className="developer-note">Keys are scoped to one workspace, re-check membership on every request, and are limited to 120 requests per minute per key. Only the key hash is stored.</p>
      </Card>
      <div className="developer-endpoint-list">
        {endpoints.map((endpoint) => (
          <Card className="developer-endpoint" key={endpoint.path}>
            <div className="developer-endpoint__heading"><Badge tone="blue">{endpoint.path.split(" ")[0]}</Badge><code>{endpoint.path.split(" ")[1]}</code></div>
            <h3>{endpoint.title}</h3>
            <p>{endpoint.details}</p>
            <div className="developer-endpoint__params"><strong>Parameters</strong><pre>{endpoint.params}</pre></div>
            <CodeBlock title="Endpoint URL" value={`${root}${endpoint.path.split(" ")[1].replace("{surveyId}", "SURVEY_ID")}`} copyLabel="Endpoint" />
          </Card>
        ))}
      </div>
      <Card className="developer-docs-examples">
        <h3>Example request</h3>
        <CodeBlock title="List surveys with cURL" value={sampleRequest} copyLabel="Example request" />
        <h3>Success response</h3>
        <pre className="developer-json-example">{`{
  "success": true,
  "data": {
    "surveys": [{ "id": "…", "title": "Customer feedback", "status": "published" }],
    "pagination": { "page": 1, "limit": 50, "total": 1, "pages": 1 }
  },
  "error": null
}`}</pre>
        <h3>Error response</h3>
        <p>Errors use standard HTTP status codes and a stable error envelope. Common statuses: <code>400</code> invalid input, <code>401</code> missing/invalid key, <code>403</code> insufficient scope, <code>404</code> resource outside this workspace, <code>429</code> rate limit exceeded.</p>
        <pre className="developer-json-example">{`{
  "success": false,
  "data": null,
  "error": { "code": "INSUFFICIENT_SCOPE", "message": "This API key requires the READ_RESPONSES scope." }
}`}</pre>
      </Card>
    </div>
  );
}

export default function Developer() {
  const { activeWorkspace, activeWorkspaceId, loading: workspaceLoading } = useWorkspace();
  const [activeTab, setActiveTab] = useState("keys");
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState(["READ_SURVEYS"]);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const canManageKeys = ["OWNER", "EDITOR"].includes(activeWorkspace?.role);
  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) {
      setKeys([]);
      setUsage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [nextKeys, nextUsage] = await Promise.all([
        getDeveloperKeys(activeWorkspaceId),
        getDeveloperUsage(activeWorkspaceId)
      ]);
      setKeys(nextKeys);
      setUsage(nextUsage);
    } catch (error) {
      console.error("Failed to load developer tools", error);
      setLoadError(error.response?.data?.message || "Couldn't load developer tools.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!workspaceLoading) refresh();
  }, [workspaceLoading, refresh]);

  function toggleScope(scope) {
    setSelectedScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  }

  async function submitCreate(event) {
    event.preventDefault();
    setCreating(true);
    try {
      const result = await createDeveloperKey(activeWorkspaceId, name, selectedScopes);
      setNewKey(result.apiKey);
      setKeys((current) => [result.key, ...current]);
      setUsage((current) => current ? {
        ...current,
        activeKeys: current.activeKeys + 1,
        totalKeys: current.totalKeys + 1
      } : current);
      setCreateOpen(false);
      setName("");
      setSelectedScopes(["READ_SURVEYS"]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't create API key.");
    } finally {
      setCreating(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeDeveloperKey(activeWorkspaceId, revokeTarget.id);
      toast.success("API key revoked");
      setRevokeTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't revoke API key.");
    } finally {
      setRevoking(false);
    }
  }

  async function copyNewKey() {
    try {
      await navigator.clipboard.writeText(newKey);
      toast.success("API key copied");
    } catch (error) {
      console.error("Failed to copy new API key", error);
      toast.error("Couldn't copy the key. Select and copy it manually.");
    }
  }

  function dismissNewKey() {
    setNewKey(null);
    refresh();
  }

  if (workspaceLoading || loading) {
    return <div className="developer-page"><div className="ui-skeleton h-8 w-1/3" /><div className="ui-skeleton h-40" /></div>;
  }
  if (loadError) {
    return <div className="developer-page"><EmptyState icon="code" title="Developer tools unavailable" description={loadError} action={<Button onClick={refresh}>Try again</Button>} /></div>;
  }

  return (
    <div className="developer-page">
      <div className="developer-heading">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> DEVELOPER PLATFORM</div><h1>Developer / API</h1><p>Connect {activeWorkspace?.name || "your workspace"} to your internal tools and workflows.</p></div>
        {activeWorkspace && <Badge tone="neutral">{activeWorkspace.name}</Badge>}
      </div>

      <div className="developer-overview">
        <Card><span><Icon name="code" size={17} /></span><small>Active keys</small><strong>{usage?.activeKeys ?? keys.filter((key) => key.status === "active").length}</strong></Card>
        <Card><span><Icon name="chart" size={17} /></span><small>API requests</small><strong>{usage?.requests ?? 0}</strong></Card>
        <Card><span><Icon name="clock" size={17} /></span><small>Last used</small><strong>{displayDate(usage?.lastUsedAt)}</strong></Card>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === "keys" && (
        <section className="developer-panel">
          <div className="workspace-panel-heading">
            <div><h2>API keys <span className="member-count">{keys.length}</span></h2><p>Keys grant scoped, read-only access to this workspace.</p></div>
            {canManageKeys && <Button variant="primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} /> Create API key</Button>}
          </div>
          {keys.length ? (
            <Table className="developer-key-table">
              <thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Created</th><th>Last used</th><th>Requests</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{keys.map((key) => {
                const canRevoke = canManageKeys && (activeWorkspace.role === "OWNER" || key.createdByCurrentUser);
                return <tr key={key.id}>
                  <td><strong>{key.name}</strong></td>
                  <td><code>{key.prefix}••••••••</code></td>
                  <td><div className="developer-scope-list">{key.scopes.map((scope) => <Badge key={scope} tone="neutral">{scope}</Badge>)}</div></td>
                  <td>{displayDate(key.createdAt)}</td>
                  <td>{displayDate(key.lastUsedAt)}</td>
                  <td>{key.requestCount}</td>
                  <td><Badge tone={key.status === "active" ? "success" : "neutral"}>{key.status}</Badge></td>
                  <td>{key.status === "active" && canRevoke && <Button size="sm" variant="ghost" onClick={() => setRevokeTarget(key)}><Icon name="trash" size={14} /> Revoke</Button>}</td>
                </tr>;
              })}</tbody>
            </Table>
          ) : (
            <EmptyState icon="code" title="No API keys yet" description="Create a scoped key to start connecting your workspace to other systems." action={canManageKeys && <Button variant="primary" onClick={() => setCreateOpen(true)}>Create API key</Button>} />
          )}
          {!canManageKeys && <p className="developer-note">Only workspace owners and editors can create keys. Workspace members can view key status and usage.</p>}
        </section>
      )}
      {activeTab === "docs" && <Documentation />}
      {activeTab === "usage" && (
        <section className="developer-panel">
          <div className="workspace-panel-heading"><div><h2>Usage overview</h2><p>Request totals are tracked per API key since it was created.</p></div><Button onClick={refresh}><Icon name="clock" size={14} /> Refresh</Button></div>
          {keys.length ? (
            <Table className="developer-key-table">
              <thead><tr><th>Key</th><th>Status</th><th>Requests</th><th>Last used</th></tr></thead>
              <tbody>{keys.map((key) => <tr key={key.id}><td><strong>{key.name}</strong><br /><code>{key.prefix}••••••••</code></td><td><Badge tone={key.status === "active" ? "success" : "neutral"}>{key.status}</Badge></td><td>{key.requestCount}</td><td>{displayDate(key.lastUsedAt)}</td></tr>)}</tbody>
            </Table>
          ) : <EmptyState icon="chart" title="No API usage yet" description="Create a key and make a versioned API request to see usage here." />}
          <p className="developer-note">Usage counts authenticated requests within the rate limit, including requests denied for insufficient scope. Limits reset every minute; rate-limit windows are held in server memory.</p>
        </section>
      )}

      <Modal
        open={createOpen}
        title="Create API key"
        description="Choose a name and the minimum access scopes the integration needs."
        onClose={() => !creating && setCreateOpen(false)}
        footer={<><Button onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button><Button variant="primary" type="submit" form="developer-create-key" disabled={creating || !selectedScopes.length}>{creating ? "Creating..." : "Create key"}</Button></>}
      >
        <form id="developer-create-key" className="developer-key-form" onSubmit={submitCreate}>
          <label><span>Key name</span><Input autoFocus maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Warehouse sync" /></label>
          <fieldset><legend>Permissions</legend>{scopesAvailable.map((scope) => <label className="developer-scope-choice" key={scope.id}><input type="checkbox" checked={selectedScopes.includes(scope.id)} onChange={() => toggleScope(scope.id)} /><span><strong>{scope.label}</strong><small>{scope.description}</small></span></label>)}</fieldset>
        </form>
      </Modal>
      <Modal
        open={Boolean(newKey)}
        title="Copy your API key"
        description="This is the only time the complete key will be shown. Store it in a secret manager."
        onClose={dismissNewKey}
        footer={<Button variant="primary" onClick={dismissNewKey}>Done</Button>}
      >
        <div className="developer-key-reveal" role="alert">
          <code>{newKey}</code>
          <Button onClick={copyNewKey}><Icon name="copy" size={15} /> Copy key</Button>
        </div>
        <p className="developer-note">The API stores only a one-way SHA-256 hash. If you lose the key, revoke it and create another one.</p>
      </Modal>
      <Modal
        open={Boolean(revokeTarget)}
        title="Revoke API key?"
        description={`“${revokeTarget?.name || ""}” will stop authenticating immediately. This cannot be undone.`}
        onClose={() => !revoking && setRevokeTarget(null)}
        footer={<><Button onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</Button><Button variant="danger" onClick={confirmRevoke} disabled={revoking}>{revoking ? "Revoking..." : "Revoke key"}</Button></>}
      >
        <p>Applications using this key will receive an authentication error. Create a replacement key if the integration must continue.</p>
      </Modal>
    </div>
  );
}
