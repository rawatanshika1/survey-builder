import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { getSurveys, createSurvey, deleteSurvey } from "../services/surveyService.js";
import { getAnalytics } from "../services/analyticsService.js";
import SurveyCard from "../components/SurveyCard.jsx";
import { CardSkeletonGrid } from "../components/Skeleton.jsx";
import { Button, EmptyState, Icon, Input, Select } from "../components/ui.jsx";

export default function Dashboard({ search, onSearchChange, workspaceId, workspaceLoading, workspaceError }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState([]);
  const [responseCounts, setResponseCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const surveyRequestId = useRef(0);

  const loadSurveys = useCallback(async () => {
    if (!workspaceId) {
      if (!workspaceLoading) {
        setLoading(false);
        setLoadError(workspaceError || "");
      }
      return;
    }
    const requestId = ++surveyRequestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (status) params.status = status;
      params.workspaceId = workspaceId;
      const data = await getSurveys(params);
      if (requestId !== surveyRequestId.current) return;
      setSurveys(data);
    } catch (error) {
      if (requestId !== surveyRequestId.current) return;
      console.error("Failed to load surveys", error);
      setLoadError("We couldn't load your surveys. Please try again.");
    } finally {
      if (requestId === surveyRequestId.current) setLoading(false);
    }
  }, [search, category, status, workspaceId, workspaceLoading, workspaceError]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  useEffect(() => {
    let active = true;
    const missingCounts = surveys.filter((survey) => !Object.prototype.hasOwnProperty.call(responseCounts, survey._id));
    if (!missingCounts.length) return undefined;

    Promise.all(missingCounts.map(async (survey) => {
      try {
        const analytics = await getAnalytics(survey._id);
        return [survey._id, analytics.totalResponses];
      } catch (error) {
        console.error(`Failed to load response count for survey ${survey._id}`, error);
        return [survey._id, null];
      }
    })).then((results) => {
      if (!active) return;
      setResponseCounts((previous) => ({
        ...previous,
        ...Object.fromEntries(results)
      }));
      if (results.some(([, count]) => count === null)) {
        toast.error("Some response counts couldn't be loaded.");
      }
    });

    return () => { active = false; };
  }, [surveys, responseCounts]);

  async function handleCreateSurvey() {
    setCreating(true);
    try {
      const survey = await createSurvey({ title: "Untitled survey", questions: [], workspaceId });
      navigate(`/builder/${survey._id}`);
    } catch (error) {
      console.error("Failed to create survey", error);
      toast.error(error.response?.data?.message || "Failed to create survey");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSurvey(id);
      setSurveys((prev) => prev.filter((survey) => survey._id !== id));
      setResponseCounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Survey deleted");
    } catch (error) {
      console.error("Failed to delete survey", error);
      toast.error(error.response?.data?.message || "Failed to delete survey");
    }
  }

  async function handleDuplicate(survey) {
    try {
      const copy = await createSurvey({
        title: `${survey.title || "Untitled survey"} (copy)`,
        description: survey.description || "",
        category: survey.category,
        mode: survey.mode,
        questions: survey.questions || [],
        logicRules: survey.logicRules || [],
        workspaceId
      });
      toast.success("Survey duplicated");
      navigate(`/builder/${copy._id}`);
    } catch (error) {
      console.error("Failed to duplicate survey", error);
      toast.error(error.response?.data?.message || "Failed to duplicate survey");
    }
  }

  async function handleShare(survey) {
    if (!survey.slug) {
      toast.error("Publish this survey before sharing it.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/survey/${survey.slug}`);
      toast.success("Survey link copied");
    } catch (error) {
      console.error("Failed to copy survey link", error);
      toast.error("Couldn't copy the survey link. Check your browser permissions.");
    }
  }

  const categories = useMemo(
    () => [...new Set(surveys.map((survey) => survey.category).filter(Boolean))],
    [surveys]
  );
  const publishedCount = surveys.filter((survey) => survey.status === "published").length;
  const visibleCounts = surveys.map((survey) => responseCounts[survey._id]);
  const totalResponses = visibleCounts.reduce((sum, count) => sum + (count || 0), 0);
  const ownerName = user?.name || "You";
  const canCreate = activeWorkspace?.role === "OWNER" || activeWorkspace?.role === "EDITOR";

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR WORKSPACE</div>
          <h1>Good to see you, {ownerName.split(" ")[0]}</h1>
          <p>Pick up where you left off and keep your research moving.</p>
        </div>
        {canCreate && <Button variant="primary" onClick={handleCreateSurvey} disabled={creating}>
          <Icon name="plus" size={17} /> {creating ? "Creating..." : "New survey"}
        </Button>}
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat"><span className="dashboard-stat__icon stat-violet"><Icon name="clipboard" /></span><div><span>All surveys</span><strong>{surveys.length}</strong></div></div>
        <div className="dashboard-stat"><span className="dashboard-stat__icon stat-green"><Icon name="chart" /></span><div><span>Published</span><strong>{publishedCount}</strong></div></div>
        <div className="dashboard-stat"><span className="dashboard-stat__icon stat-blue"><Icon name="inbox" /></span><div><span>Responses</span><strong>{visibleCounts.some((count) => count === null) ? "—" : totalResponses.toLocaleString()}</strong></div></div>
      </div>

      <section className="surveys-section" id="surveys">
        <div className="section-heading">
          <div>
            <h2>My surveys</h2>
            <p>Your forms, all in one place.</p>
          </div>
          <Link to="/dashboard#surveys" className="text-link">View all <span aria-hidden="true">→</span></Link>
        </div>

        <div className="survey-toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <Input
              type="search"
              aria-label="Search surveys"
              placeholder="Search surveys..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <Select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Any status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </div>

        {loading ? (
          <CardSkeletonGrid />
        ) : loadError ? (
          <EmptyState
            icon="inbox"
            title="Surveys didn't load"
            description={loadError}
            action={<Button onClick={loadSurveys}>Try again</Button>}
          />
        ) : surveys.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title={search || category || status ? "No matching surveys" : "Your first survey starts here"}
            description={search || category || status ? "Try changing your search or filters." : "Create a survey to collect feedback, ideas, and insights."}
            action={search || category || status
              ? <Button onClick={() => { onSearchChange(""); setCategory(""); setStatus(""); }}>Clear filters</Button>
              : canCreate
                ? <Button variant="primary" onClick={handleCreateSurvey} disabled={creating}><Icon name="plus" size={16} /> Create a survey</Button>
                : null}
          />
        ) : (
          <div className="survey-grid">
            {surveys.map((survey) => (
              <SurveyCard
                key={survey._id}
                survey={survey}
                responseCount={responseCounts[survey._id]}
                owner={survey.createdBy?.name || ownerName}
                accessRole={survey.role}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onShare={handleShare}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
