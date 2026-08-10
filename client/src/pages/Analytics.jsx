import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSurveyById } from "../services/surveyService.js";
import { getAnalytics } from "../services/analyticsService.js";
import OverviewTab from "../components/analytics/OverviewTab.jsx";
import DropOffTab from "../components/analytics/DropOffTab.jsx";
import InsightsTab from "../components/analytics/InsightsTab.jsx";
import RawResponsesTab from "../components/analytics/RawResponsesTab.jsx";
import { BlockSkeleton } from "../components/Skeleton.jsx";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "dropoff", label: "Drop-off Funnel" },
  { key: "insights", label: "AI Insights" },
  { key: "raw", label: "Raw Responses" }
];

export default function Analytics() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    Promise.all([getSurveyById(id), getAnalytics(id)])
      .then(([surveyData, analyticsData]) => {
        setSurvey(surveyData);
        setAnalytics(analyticsData);
      })
      .catch((err) => {
        console.error("Failed to load analytics", err);
        setError("Failed to load analytics for this survey");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
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
      <p className="text-center py-20 text-gray-500 dark:text-gray-400">
        {error || "Survey not found"}
      </p>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate("/dashboard")}
        className="text-sm text-gray-500 dark:text-gray-400 mb-4"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-1">{survey.title}</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Analytics & Insights</p>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab analytics={analytics} />}
      {activeTab === "dropoff" && <DropOffTab analytics={analytics} />}
      {activeTab === "insights" && (
        <InsightsTab survey={survey} analytics={analytics} onSurveyUpdate={setSurvey} />
      )}
      {activeTab === "raw" && <RawResponsesTab survey={survey} analytics={analytics} />}
    </div>
  );
}
