import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"];

function StatCard({ label, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function OverviewTab({ analytics }) {
  const { totalResponses, completedResponses, completionRate, averageRating, perQuestion } =
    analytics;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Responses" value={totalResponses} />
        <StatCard label="Completed" value={completedResponses} />
        <StatCard label="Completion Rate" value={`${completionRate}%`} />
        <StatCard label="Avg Rating" value={averageRating ?? "—"} />
      </div>

      {totalResponses === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-10">
          No responses yet — share your survey link to start collecting data.
        </p>
      ) : (
        <div className="space-y-8">
          {perQuestion.map((q) => (
            <div
              key={q.questionId}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
            >
              <h3 className="font-medium mb-4">{q.questionText}</h3>

              {q.optionCounts && (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(q.optionCounts).map(([name, count]) => ({
                        name,
                        count
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {q.type === "rating" && q.distribution && (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(q.distribution).map(([rating, count]) => ({
                        rating: `${rating}★`,
                        count
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-gray-500 mt-2">Average: {q.average} / 5</p>
                </div>
              )}

              {q.answerCount !== undefined && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {q.answerCount} text {q.answerCount === 1 ? "answer" : "answers"} collected —
                  see the AI Insights tab for a summary.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
