import { useState } from "react";
import toast from "react-hot-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { refreshInsights } from "../../services/analyticsService.js";

const SENTIMENT_COLORS = { positive: "#059669", neutral: "#d97706", negative: "#dc2626" };

function InsightCard({ survey, question, cachedInsight, onRefreshed }) {
  const [insight, setInsight] = useState(cachedInsight || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRefresh() {
    setLoading(true);
    setError("");
    try {
      const result = await refreshInsights(survey._id, question.questionId);
      setInsight(result);
      onRefreshed(question.questionId, result);
      toast.success("Insights generated");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  }

  const sentimentData = insight
    ? Object.entries(insight.sentiment || {}).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{question.questionText}</h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60"
        >
          {loading ? "Analyzing..." : insight ? "Refresh Insights" : "Generate Insights"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!insight && !loading && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {question.answerCount || 0} text answers collected. Click "Generate Insights" to
          summarize themes and sentiment.
        </p>
      )}

      {insight && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Key Themes</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(insight.themes || []).map((theme, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                >
                  {theme}
                </span>
              ))}
            </div>

            <p className="text-xs font-medium text-gray-500 mb-2">Example Quotes</p>
            <ul className="space-y-1">
              {(insight.quotes || []).map((q, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-600 dark:text-gray-300 italic border-l-2 border-gray-200 dark:border-gray-600 pl-2"
                >
                  "{q}"
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Sentiment</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={35}
                    outerRadius={60}
                  >
                    {sentimentData.map((entry, i) => (
                      <Cell key={i} fill={SENTIMENT_COLORS[entry.name] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 text-xs mt-1">
              {sentimentData.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: SENTIMENT_COLORS[s.name] || "#94a3b8" }}
                  />
                  {s.name} {s.value}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsightsTab({ survey, analytics, onSurveyUpdate }) {
  const textQuestions = analytics.perQuestion.filter((q) => q.answerCount !== undefined);

  function handleRefreshed(questionId, insight) {
    const cache = { ...(survey.insightsCache || {}), [questionId]: insight };
    onSurveyUpdate({ ...survey, insightsCache: cache });
  }

  if (textQuestions.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center py-10">
        This survey has no short-answer or long-answer questions, so there's nothing to
        summarize here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {textQuestions.map((q) => (
        <InsightCard
          key={q.questionId}
          survey={survey}
          question={q}
          cachedInsight={survey.insightsCache?.[q.questionId]}
          onRefreshed={handleRefreshed}
        />
      ))}
    </div>
  );
}
