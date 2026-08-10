import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { getSurveys, createSurvey, deleteSurvey } from "../services/surveyService.js";
import SurveyCard from "../components/SurveyCard.jsx";
import { CardSkeletonGrid } from "../components/Skeleton.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  async function loadSurveys() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (status) params.status = status;
      const data = await getSurveys(params);
      setSurveys(data);
    } catch (err) {
      console.error("Failed to load surveys", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, status]);

  async function handleCreateSurvey() {
    setCreating(true);
    try {
      const survey = await createSurvey({ title: "Untitled survey", questions: [] });
      navigate(`/builder/${survey._id}`);
    } catch (err) {
      console.error("Failed to create survey", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this survey? This cannot be undone.")) return;
    try {
      await deleteSurvey(id);
      setSurveys((prev) => prev.filter((s) => s._id !== id));
      toast.success("Survey deleted");
    } catch (err) {
      console.error("Failed to delete survey", err);
      toast.error(err.response?.data?.message || "Failed to delete survey");
    }
  }

  const categories = [...new Set(surveys.map((s) => s.category).filter(Boolean))];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Manage and analyze your surveys
          </p>
        </div>
        <button
          onClick={handleCreateSurvey}
          disabled={creating}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2 text-sm"
        >
          {creating ? "Creating..." : "+ New Survey"}
        </button>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      {loading ? (
        <CardSkeletonGrid />
      ) : surveys.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400 mb-3">No surveys yet</p>
          <button
            onClick={handleCreateSurvey}
            className="text-sm font-medium text-blue-600 dark:text-blue-400"
          >
            Create your first survey
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => (
            <SurveyCard key={survey._id} survey={survey} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
