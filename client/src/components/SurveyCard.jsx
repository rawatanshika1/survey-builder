import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Dropdown, Icon, Modal } from "./ui.jsx";

function formatDate(value) {
  if (!value) return "Not updated";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not updated"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function SurveyCard({ survey, responseCount, owner, accessRole, onDelete, onDuplicate, onShare }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const published = survey.status === "published";
  const questionCount = survey.questions?.length || 0;
  const updatedDate = formatDate(survey.updatedAt || survey.createdAt);
  const canEdit = ["OWNER", "EDITOR"].includes(accessRole);
  const canDelete = accessRole === "OWNER";
  const canManageAccess = survey.canManageAccess || accessRole === "OWNER";

  return (
    <>
      <article className="survey-card">
        <div className="survey-card__top">
          <span className="survey-card__type"><Icon name="clipboard" size={16} /> Survey</span>
          <Dropdown
            label={<Icon name="more" size={20} />}
            labelClassName="survey-card__more"
          >
            <Link to={`/builder/${survey._id}`}><Icon name={canEdit ? "edit" : "eye"} size={16} /> {canEdit ? "Edit" : "View"}</Link>
            {survey.slug ? (
              <Link to={`/survey/${survey.slug}`} target="_blank" rel="noreferrer"><Icon name="eye" size={16} /> Preview</Link>
            ) : (
              <span className="dropdown-disabled" title="Publish this survey before previewing"><Icon name="eye" size={16} /> Preview</span>
            )}
            {canEdit && <button type="button" onClick={() => onDuplicate(survey)}><Icon name="copy" size={16} /> Duplicate</button>}
            <Link to={`/analytics/${survey._id}`}><Icon name="chart" size={16} /> Results</Link>
            {canEdit && <Link to={`/distribution/${survey._id}`}><Icon name="send" size={16} /> Distribution</Link>}
            <button type="button" onClick={() => onShare(survey)}><Icon name="share" size={16} /> Share</button>
            {canManageAccess && <Link to={`/builder/${survey._id}?access=1`}><Icon name="users" size={16} /> Manage access</Link>}
            {canDelete && <button type="button" className="dropdown-danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Delete</button>}
          </Dropdown>
        </div>

        <div className="survey-card__body">
          <div className="survey-card__title-row">
            <h3 title={survey.title || "Untitled survey"}>{survey.title || "Untitled survey"}</h3>
            <Badge tone={published ? "success" : "neutral"}>
              <span className="badge-dot" />{published ? "Published" : "Draft"}
            </Badge>
          </div>
          <p className="survey-card__description">{survey.description || "Add a description to help people understand what this survey is about."}</p>
        </div>

        <div className="survey-card__metrics">
          <div><strong>{responseCount === null || responseCount === undefined ? "—" : responseCount.toLocaleString()}</strong><span>Responses</span></div>
          <div><strong>{questionCount}</strong><span>Questions</span></div>
          <div><strong>{updatedDate}</strong><span>Last updated</span></div>
        </div>

        <div className="survey-card__footer">
          <div className="survey-owner">
            <span className="owner-avatar">{(owner || "Y").charAt(0).toUpperCase()}</span>
            <span className="survey-owner__name"><small>Owner</small>{owner || "You"}</span>
          </div>
          <Link to={`/builder/${survey._id}`} className="survey-card__edit">{canEdit ? "Open survey" : "View survey"} <span aria-hidden="true">→</span></Link>
        </div>
      </article>

      <Modal
        open={confirmDelete}
        title="Delete survey?"
        description={`“${survey.title || "Untitled survey"}” will be permanently removed. This can't be undone.`}
        onClose={() => setConfirmDelete(false)}
        footer={<>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setConfirmDelete(false); onDelete(survey._id); }}>Delete survey</Button>
        </>}
      >
        <p className="modal-warning"><Icon name="trash" size={17} /> This survey will be removed from your workspace and can't be restored.</p>
      </Modal>
    </>
  );
}
