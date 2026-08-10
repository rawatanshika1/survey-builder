import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getSurveyById, updateSurvey, publishSurvey } from "../services/surveyService.js";
import QuestionEditor from "../components/QuestionEditor.jsx";

function newQuestion(order) {
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shareLink, setShareLink] = useState("");

  useEffect(() => {
    getSurveyById(id)
      .then((data) => setSurvey(data))
      .catch((err) => console.error("Failed to load survey", err))
      .finally(() => setLoading(false));
  }, [id]);

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

  function deleteQuestion(index) {
    const questions = survey.questions.filter((_, i) => i !== index);
    updateField("questions", questions);
  }

  function moveQuestion(index, direction) {
    const questions = [...survey.questions];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
    updateField("questions", questions);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await updateSurvey(id, {
        title: survey.title,
        description: survey.description,
        category: survey.category,
        mode: survey.mode,
        expirationDate: survey.expirationDate,
        questions: survey.questions
      });
      setSurvey(saved);
      toast.success("Draft saved");
    } catch (err) {
      console.error("Failed to save survey", err);
      toast.error(err.response?.data?.message || "Failed to save survey");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await handleSave();
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

  if (loading) {
    return <p className="text-center py-20 text-gray-500 dark:text-gray-400">Loading survey...</p>;
  }

  if (!survey) {
    return <p className="text-center py-20 text-gray-500 dark:text-gray-400">Survey not found</p>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate("/dashboard")}
        className="text-sm text-gray-500 dark:text-gray-400 mb-4"
      >
        ← Back to Dashboard
      </button>

      {/* Survey meta */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4 mb-6">
        <input
          type="text"
          value={survey.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Survey Title"
          className="w-full text-xl font-bold bg-transparent focus:outline-none border-b border-gray-200 dark:border-gray-700 pb-2"
        />
        <textarea
          value={survey.description}
          onChange={(e) => updateField("description", e.target.value)}
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
              className="text-sm rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Expiration Date</label>
            <input
              type="date"
              value={survey.expirationDate ? survey.expirationDate.slice(0, 10) : ""}
              onChange={(e) => updateField("expirationDate", e.target.value)}
              className="text-sm rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Response Mode</label>
            <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 text-sm">
              <button
                type="button"
                onClick={() => updateField("mode", "classic")}
                className={`px-3 py-1 ${
                  survey.mode === "classic"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-700"
                }`}
              >
                Classic
              </button>
              <button
                type="button"
                onClick={() => updateField("mode", "conversational")}
                className={`px-3 py-1 ${
                  survey.mode === "conversational"
                    ? "bg-blue-600 text-white"
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
          />
        ))}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full text-sm font-medium py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600"
        >
          + Add Question
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
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
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {publishing ? "Publishing..." : "Publish Survey"}
        </button>
      </div>

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
    </div>
  );
}
