import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { getSurveyById, updateSurvey, publishSurvey } from "../services/surveyService.js";
import { getSurveyPermissions, removeSurveyPermission, setSurveyPermission } from "../services/workspaceService.js";
import QuestionEditor from "../components/QuestionEditor.jsx";
import LogicEditor from "../components/LogicEditor.jsx";
import { Badge, Button, Icon, Modal, Select } from "../components/ui.jsx";
import { getQuestionId, validateSurveyLogic } from "../utils/surveyLogic.js";

function newQuestionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newQuestion(order) {
  return {
    _id: newQuestionId(),
    type: "short-answer",
    questionText: "",
    options: [],
    required: false,
    order
  };
}

export default function SurveyBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [logicQuestionId, setLogicQuestionId] = useState("");

  useEffect(() => {
    getSurveyById(id)
      .then((data) => setSurvey(data))
      .catch((err) => console.error("Failed to load survey", err))
      .finally(() => setLoading(false));
  }, [id]);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    try {
      const result = await getSurveyPermissions(id);
      setPermissions(result.members);
      setCanManageAccess(result.access.canManageAccess);
    } catch (err) {
      console.error("Failed to load survey permissions", err);
      toast.error(err.response?.data?.message || "Failed to load survey permissions");
    } finally {
      setPermissionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (survey?.canManageAccess && searchParams.get("access") === "1") {
      setPermissionsOpen(true);
      loadPermissions();
      setSearchParams({}, { replace: true });
    }
  }, [survey, searchParams, setSearchParams, loadPermissions]);

  function updateField(field, value) {
    setSurvey((prev) => ({ ...prev, [field]: value }));
  }

  function updateQuestion(index, updatedQuestion) {
    const questions = [...survey.questions];
    questions[index] = updatedQuestion;
    updateField("questions", questions);
  }

  function addQuestion() {
    const questions = [...(survey.questions || []), newQuestion(survey.questions?.length || 0)];
    updateField("questions", questions);
  }

  function duplicateQuestion(index) {
    const source = survey.questions[index];
    const duplicate = { ...source, _id: newQuestionId(), questionText: `${source.questionText} (copy)` };
    const questions = [...survey.questions];
    questions.splice(index + 1, 0, duplicate);
    updateField("questions", questions.map((question, order) => ({ ...question, order })));
  }

  function deleteQuestion(index) {
    const deletedQuestionId = getQuestionId(survey.questions[index]);
    const questions = survey.questions.filter((_, i) => i !== index);
    updateField("questions", questions.map((question, order) => ({ ...question, order })));
    updateField(
      "logicRules",
      (survey.logicRules || []).filter((rule) => String(rule.sourceQuestionId) !== deletedQuestionId)
    );
  }

  function moveQuestion(index, direction) {
    const questions = [...survey.questions];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
    updateField("questions", questions.map((question, order) => ({ ...question, order })));
  }

  async function handleSave() {
    if (!survey.canEdit) return false;
    const logicErrors = validateSurveyLogic(survey.questions || [], survey.logicRules || []);
    if (logicErrors.length) {
      toast.error(logicErrors[0]);
      return false;
    }
    setSaving(true);
    try {
      const saved = await updateSurvey(id, {
        title: survey.title,
        description: survey.description,
        category: survey.category,
        mode: survey.mode,
        expirationDate: survey.expirationDate,
        questions: survey.questions,
        logicRules: survey.logicRules || []
      });
      setSurvey(saved);
      toast.success("Draft saved");
      return true;
    } catch (err) {
      console.error("Failed to save survey", err);
      toast.error(err.response?.data?.message || "Failed to save survey");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!survey.canEdit) return;
    setPublishing(true);
    try {
      if (!await handleSave()) return;
      const published = await publishSurvey(id);
      setSurvey(published);
      setShareLink(`${window.location.origin}/survey/${published.slug}`);
      toast.success("Survey published!");
    } catch (err) {
      console.error("Failed to publish survey", err);
      toast.error(err.response?.data?.message || "Failed to publish survey");
    } finally {
      setPublishing(false);
    }
  }

  async function handlePermissionChange(member, role) {
    try {
      await setSurveyPermission(id, member.id, role);
      await loadPermissions();
      toast.success(`${member.name}'s survey access updated`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update survey access");
    }
  }

  async function handlePermissionReset(member) {
    try {
      await removeSurveyPermission(id, member.id);
      await loadPermissions();
      toast.success(`${member.name}'s workspace role restored`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove survey access");
    }
  }

  const readOnly = survey?.accessRole === "VIEWER";
  const roleLabel = survey?.accessRole ? `${survey.accessRole[0]}${survey.accessRole.slice(1).toLowerCase()}` : "";
  const logicQuestion = survey?.questions?.find((question) => getQuestionId(question) === logicQuestionId);

  if (loading) {
    return <p className="text-center py-20 text-gray-500 dark:text-gray-400">Loading survey...</p>;
  }

  if (!survey) {
    return <p className="text-center py-20 text-gray-500 dark:text-gray-400">Survey not found</p>;
  }

  return (
    <div className="survey-builder-page max-w-3xl mx-auto px-4 py-10">
      <div className="builder-page-top">
        <button onClick={() => navigate("/dashboard")} className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          ← Back to Dashboard
        </button>
        {survey.canManageAccess && (
          <Button onClick={() => { setPermissionsOpen(true); loadPermissions(); }}>
            <Icon name="users" size={16} /> Share / Manage Access
          </Button>
        )}
      </div>
      {survey.accessRole && <div className="builder-access-note"><Badge tone={survey.accessRole === "OWNER" ? "violet" : survey.accessRole === "EDITOR" ? "blue" : "neutral"}>{roleLabel}</Badge><span>{readOnly ? "You can view this survey, responses, and analytics." : "Your workspace access is active for this survey."}</span></div>}

      {/* Survey meta */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4 mb-6">
        <input
          type="text"
          value={survey.title}
          onChange={(e) => updateField("title", e.target.value)}
          readOnly={readOnly}
          placeholder="Survey Title"
          className="w-full text-xl font-bold bg-transparent focus:outline-none border-b border-gray-200 dark:border-gray-700 pb-2"
        />
        <textarea
          value={survey.description}
          onChange={(e) => updateField("description", e.target.value)}
          readOnly={readOnly}
          placeholder="Survey description"
          rows={2}
          className="w-full text-sm bg-transparent focus:outline-none border border-gray-200 dark:border-gray-700 rounded-md p-2"
        />

        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <input
              type="text"
              value={survey.category}
              onChange={(e) => updateField("category", e.target.value)}
              disabled={readOnly}
              className="text-sm rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Expiration Date</label>
            <input
              type="date"
              value={survey.expirationDate ? survey.expirationDate.slice(0, 10) : ""}
              onChange={(e) => updateField("expirationDate", e.target.value)}
              disabled={readOnly}
              className="text-sm rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Response Mode</label>
            <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 text-sm">
              <button
                type="button"
                onClick={() => updateField("mode", "classic")}
                disabled={readOnly}
                className={`px-3 py-1 ${
                  survey.mode === "classic"
                    ? "bg-[#003366] text-white"
                    : "bg-white dark:bg-gray-700"
                }`}
              >
                Classic
              </button>
              <button
                type="button"
                onClick={() => updateField("mode", "conversational")}
                disabled={readOnly}
                className={`px-3 py-1 ${
                  survey.mode === "conversational"
                    ? "bg-[#003366] text-white"
                    : "bg-white dark:bg-gray-700"
                }`}
              >
                Conversational
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4 mb-6">
        {(survey.questions || []).map((q, i) => (
          <QuestionEditor
            key={q._id || q.id || i}
            question={q}
            index={i}
            total={survey.questions.length}
            onChange={(updated) => updateQuestion(i, updated)}
            onDelete={() => deleteQuestion(i)}
            onMove={moveQuestion}
            onLogic={() => setLogicQuestionId(getQuestionId(q))}
            onDuplicate={() => duplicateQuestion(i)}
            readOnly={readOnly}
          />
        ))}

        {!readOnly && <button
          type="button"
          onClick={addQuestion}
          className="w-full text-sm font-medium py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#0D9488] hover:text-[#003366]"
        >
          + Add Question
        </button>}
      </div>

      {/* Actions */}
      {!readOnly && <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="px-4 py-2 text-sm font-medium rounded-md bg-[#003366] text-white hover:bg-[#1e3a5f] disabled:opacity-60 transition-colors"
        >
          {publishing ? "Publishing..." : "Publish Survey"}
        </button>
      </div>}

      {shareLink && (
        <div className="mt-4 p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400 mb-1">
            Survey published! Share this link:
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareLink}
              className="flex-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                toast.success("Link copied to clipboard");
              }}
              className="text-xs font-medium px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <Modal
        open={permissionsOpen}
        title="Share / Manage Access"
        description="Set survey-specific access for people in this workspace. Workspace owners always keep full access."
        onClose={() => setPermissionsOpen(false)}
      >
        {permissionsLoading ? (
          <div className="ui-skeleton h-32" aria-label="Loading survey access" />
        ) : !canManageAccess ? (
          <p className="text-sm text-gray-500">Only an owner can manage access for this survey.</p>
        ) : permissions.length === 0 ? (
          <p className="text-sm text-gray-500">There are no other workspace members to share this survey with yet.</p>
        ) : (
          <div className="survey-permission-list">
            {permissions.map((member) => (
              <div className="survey-permission-row" key={member.id}>
                <span className={`member-avatar member-avatar--${member.role.toLowerCase()}`}>{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                <div className="member-identity"><strong>{member.name}</strong><span>{member.email}</span></div>
                {member.role === "OWNER" ? (
                  <Badge tone="violet">Owner</Badge>
                ) : (
                  <>
                    <Select aria-label={`Permission for ${member.name}`} value={member.role} onChange={(event) => handlePermissionChange(member, event.target.value)}>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </Select>
                    {member.hasOverride && <Button size="sm" onClick={() => handlePermissionReset(member)}>Reset</Button>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
      <LogicEditor
        open={Boolean(logicQuestion)}
        sourceQuestion={logicQuestion}
        questions={survey.questions || []}
        rules={survey.logicRules || []}
        onChange={(logicRules) => updateField("logicRules", logicRules)}
        onClose={() => setLogicQuestionId("")}
      />
    </div>
  );
}
