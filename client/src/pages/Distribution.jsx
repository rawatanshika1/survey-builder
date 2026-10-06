import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  addSurveyRecipients,
  getDistribution,
  retrySurveyInvitation,
  sendSurveyInvitations
} from "../services/distributionService.js";
import { Badge, Button, EmptyState, Icon, Input, Table } from "../components/ui.jsx";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function DistributionStatus({ recipient }) {
  if (recipient.status === "responded") return <Badge tone="success"><span className="badge-dot" />Responded</Badge>;
  if (recipient.status === "failed") return <Badge tone="danger"><span className="badge-dot" />Failed</Badge>;
  if (recipient.status === "sending") return <Badge tone="warning"><span className="badge-dot" />Sending...</Badge>;
  if (recipient.status === "sent") return <Badge tone="blue"><span className="badge-dot" />Sent</Badge>;
  return <Badge tone="neutral">Pending</Badge>;
}

function OverviewCard({ icon, label, value, tone }) {
  return (
    <div className="distribution-stat">
      <span className={`distribution-stat__icon distribution-stat__icon--${tone}`}><Icon name={icon} size={18} /></span>
      <span><small>{label}</small><strong>{value}</strong></span>
    </div>
  );
}

export default function Distribution() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [retryingId, setRetryingId] = useState("");

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      setData(await getDistribution(id));
    } catch (error) {
      console.error("Failed to load survey distribution", error);
      setLoadError(error.response?.data?.message || "Couldn't load survey distribution.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const surveyLink = useMemo(
    () => data?.survey.slug ? `${window.location.origin}/survey/${data.survey.slug}` : "",
    [data]
  );
  const unsentCount = (data?.recipients || []).filter((recipient) =>
    !recipient.respondedAt && ["pending", "failed"].includes(recipient.status)
  ).length;
  const reminderCount = (data?.recipients || []).filter((recipient) =>
    recipient.sentAt && !recipient.respondedAt
  ).length;

  async function copySurveyLink() {
    try {
      await navigator.clipboard.writeText(surveyLink);
      toast.success("Survey link copied");
    } catch (error) {
      console.error("Failed to copy survey link", error);
      toast.error("Couldn't copy the survey link. Check your browser permissions.");
    }
  }

  async function handleAddRecipients(event) {
    event.preventDefault();
    const emails = [...new Set(emailsText.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean))];
    if (!emails.length) {
      toast.error("Enter at least one email address.");
      return;
    }
    setAdding(true);
    try {
      const result = await addSurveyRecipients(id, emails);
      setEmailsText("");
      toast.success(`${result.added} recipient${result.added === 1 ? "" : "s"} added${result.duplicates ? ` · ${result.duplicates} already on the list` : ""}`);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't add recipients.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSend(reminder) {
    setSending(true);
    try {
      const result = await sendSurveyInvitations(id, reminder);
      if (result.failed) toast.error(`${result.sent} sent · ${result.failed} failed. Failed recipients can be retried.`);
      else toast.success(result.sent ? `${result.sent} invitation${result.sent === 1 ? "" : "s"} ${reminder ? "reminded" : "sent"}` : result.message);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't send invitations.");
      await refresh();
    } finally {
      setSending(false);
    }
  }

  async function handleRetry(recipient, reminder = false) {
    setRetryingId(recipient.id);
    try {
      await retrySurveyInvitation(id, recipient.id, reminder);
      toast.success(`${reminder ? "Reminder sent to" : "Invitation sent to"} ${recipient.email}`);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || `Couldn't send to ${recipient.email}`);
      await refresh();
    } finally {
      setRetryingId("");
    }
  }

  if (loading) return <div className="distribution-page"><div className="ui-skeleton h-8 w-1/3" /><div className="ui-skeleton h-40" /></div>;
  if (loadError || !data) {
    return <div className="distribution-page"><EmptyState icon="send" title="Distribution unavailable" description={loadError || "Survey not found."} action={<Button onClick={refresh}>Try again</Button>} /></div>;
  }

  const published = data.survey.status === "published" && Boolean(data.survey.slug);

  return (
    <div className="distribution-page">
      <div className="distribution-heading">
        <div>
          <Link to="/dashboard#surveys" className="distribution-back">← Back to surveys</Link>
          <div className="eyebrow"><span className="eyebrow-dot" /> SURVEY DISTRIBUTION</div>
          <h1>{data.survey.title}</h1>
          <p>Share the public link or email invitations to your recipients.</p>
        </div>
        <Badge tone={published ? "success" : "neutral"}><span className="badge-dot" />{published ? "Published" : "Draft"}</Badge>
      </div>

      <div className="distribution-stats">
        <OverviewCard icon="users" tone="blue" label="Recipients" value={data.summary.recipients} />
        <OverviewCard icon="send" tone="violet" label="Sent" value={data.summary.sent} />
        <OverviewCard icon="eye" tone="amber" label="Opened*" value={data.summary.opened} />
        <OverviewCard icon="share" tone="green" label="Clicked" value={data.summary.clicked} />
        <OverviewCard icon="check" tone="green" label="Responses" value={data.summary.responded} />
      </div>

      <section className="distribution-panel">
        <div className="distribution-panel-heading">
          <div><h2>Survey link</h2><p>The regular public link keeps working; no account is required to respond.</p></div>
          {surveyLink && <Button onClick={copySurveyLink}><Icon name="copy" size={15} /> Copy Link</Button>}
        </div>
        {published ? (
          <div className="distribution-link-box">
            <Input aria-label="Survey link" readOnly value={surveyLink} />
            <Link to={`/survey/${data.survey.slug}`} target="_blank" rel="noreferrer"><Icon name="eye" size={15} /> Preview</Link>
          </div>
        ) : (
          <p className="distribution-notice">Publish this survey before copying its public link or sending email invitations.</p>
        )}
      </section>

      <section className="distribution-panel">
        <div className="distribution-panel-heading">
          <div><h2>Email Distribution</h2><p>Add individual addresses or paste a list separated by commas, spaces, or new lines.</p></div>
        </div>
        <form className="distribution-add-form" onSubmit={handleAddRecipients}>
          <label>
            <span>Recipient emails</span>
            <textarea
              value={emailsText}
              onChange={(event) => setEmailsText(event.target.value)}
              placeholder={"alex@example.com\nsam@example.com"}
              rows={3}
              aria-label="Recipient emails"
            />
          </label>
          <Button variant="primary" type="submit" disabled={adding}>
            <Icon name="plus" size={15} /> {adding ? "Adding..." : "Add recipients"}
          </Button>
        </form>
        <div className="distribution-send-actions">
          <Button variant="primary" onClick={() => handleSend(false)} disabled={!published || !unsentCount || sending}>
            <Icon name="send" size={15} /> {sending ? "Sending..." : "Send Survey"}
          </Button>
          <Button onClick={() => handleSend(true)} disabled={!published || !reminderCount || sending}>
            {sending ? "Sending..." : "Send reminder now"}
          </Button>
          <span>{unsentCount} pending · {reminderCount} sent and not responded</span>
        </div>
        <div className="distribution-tracking-note" role="note">
          <strong>Tracking details:</strong> Sent means the SMTP server accepted the email; delivery confirmation is unavailable without a provider webhook.
          Opens are approximate and can be blocked or prefetched by email clients. Clicks and completed responses are recorded by this app.
        </div>
      </section>

      <section className="distribution-panel">
        <div className="distribution-panel-heading">
          <div><h2>Recipients <span className="member-count">{data.recipients.length}</span></h2><p>Invitation activity is private to survey editors and owners.</p></div>
        </div>
        {data.recipients.length === 0 ? (
          <EmptyState icon="inbox" title="No recipients yet" description="Add email addresses above to begin a distribution list." />
        ) : (
          <Table className="distribution-table">
            <thead><tr><th>Email</th><th>Status</th><th>Sent</th><th>Opened*</th><th>Clicked</th><th>Responded</th><th>Last Activity</th><th>Action</th></tr></thead>
            <tbody>
              {data.recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td className="distribution-email">{recipient.email}</td>
                  <td><DistributionStatus recipient={recipient} />{recipient.lastError && <small className="distribution-row-error">{recipient.lastError}</small>}</td>
                  <td>{recipient.sentAt ? formatDate(recipient.sentAt) : recipient.status === "sending" ? "Sending..." : "—"}</td>
                  <td>{recipient.opened ? `Yes${recipient.openCount > 1 ? ` (${recipient.openCount})` : ""}` : "—"}</td>
                  <td>{recipient.clicked ? `Yes${recipient.clickCount > 1 ? ` (${recipient.clickCount})` : ""}` : "—"}</td>
                  <td>{recipient.respondedAt ? formatDate(recipient.respondedAt) : "—"}</td>
                  <td>{formatDate(recipient.lastActivityAt)}</td>
                  <td>
                    {recipient.status === "failed" && !recipient.respondedAt && (
                      <Button size="sm" onClick={() => handleRetry(recipient)} disabled={retryingId === recipient.id || sending}>
                        {retryingId === recipient.id ? "Sending..." : "Retry"}
                      </Button>
                    )}
                    {recipient.sentAt && !recipient.respondedAt && (
                      <Button size="sm" variant="ghost" onClick={() => handleRetry(recipient, true)} disabled={retryingId === recipient.id || sending}>
                        Send reminder
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
      <p className="distribution-footnote">* Open tracking is an estimate and may be blocked or triggered by email-client privacy features. “Delivered” is not reported because generic SMTP does not provide delivery receipts.</p>
    </div>
  );
}
