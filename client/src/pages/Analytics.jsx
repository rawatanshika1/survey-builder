import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSurveyById } from "../services/surveyService.js";
import { getAnalytics, getResponses } from "../services/analyticsService.js";
import OverviewTab from "../components/analytics/OverviewTab.jsx";
import DropOffTab from "../components/analytics/DropOffTab.jsx";
import InsightsTab from "../components/analytics/InsightsTab.jsx";
import RawResponsesTab from "../components/analytics/RawResponsesTab.jsx";
import { BlockSkeleton } from "../components/Skeleton.jsx";
import { Button, EmptyState, Tabs } from "../components/ui.jsx";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "dropoff", label: "Drop-off Funnel" },
  { key: "insights", label: "AI Insights" },
  { key: "raw", label: "Raw Responses" }
];

export default function Analytics() {
  const { id } = useParams();

  const [survey, setSurvey] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    let active = true;
    Promise.all([getSurveyById(id), getAnalytics(id), getResponses(id)])
      .then(([surveyData, analyticsData, responseData]) => {
        if (!active) return;
        setSurvey(surveyData);
        setAnalytics(analyticsData);
        setResponses(responseData);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load analytics", err);
        setError("Failed to load analytics for this survey");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="analytics-page space-y-4">
        <BlockSkeleton height="h-8" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <BlockSkeleton height="h-20" />
          <BlockSkeleton height="h-20" />
          <BlockSkeleton height="h-20" />
          <BlockSkeleton height="h-20" />
        </div>
        <BlockSkeleton height="h-64" />
      </div>
    );
  }

  if (error || !survey || !analytics) {
    return (
      <div className="analytics-page">
        <EmptyState icon="chart" title="Analytics unavailable" description={error || "Survey not found"} action={<Link to="/dashboard"><Button>Back to dashboard</Button></Link>} />
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <Link to="/dashboard" className="analytics-back">← Back to surveys</Link>

      <div className="analytics-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> SURVEY REPORT</div>
          <h1>{survey.title}</h1>
          <p>Analytics and insights for this survey</p>
        </div>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && <OverviewTab analytics={analytics} survey={survey} responses={responses} />}
      {activeTab === "dropoff" && <DropOffTab analytics={analytics} />}
      {activeTab === "insights" && (
        <InsightsTab survey={survey} analytics={analytics} onSurveyUpdate={setSurvey} />
      )}
      {activeTab === "raw" && <RawResponsesTab survey={survey} analytics={analytics} responses={responses} />}
    </div>
  );
}
