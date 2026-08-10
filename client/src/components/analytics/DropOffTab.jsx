import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function DropOffTab({ analytics }) {
  const { dropOff, totalResponses } = analytics;

  if (totalResponses === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center py-10">
        No responses yet — drop-off data will appear once people start taking your survey.
      </p>
    );
  }

  const maxDropOff = Math.max(...dropOff.map((d) => d.dropOffCount), 1);
  const worst = dropOff.reduce(
    (worst, d) => (d.dropOffCount > worst.dropOffCount ? d : worst),
    dropOff[0]
  );

  return (
    <div className="space-y-6">
      {worst && worst.dropOffCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">
            <span className="font-semibold">Biggest drop-off:</span> "{worst.questionText}" — {" "}
            {worst.dropOffCount} {worst.dropOffCount === 1 ? "respondent" : "respondents"} quit
            here ({worst.dropOffRate}% of all starts).
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="font-medium mb-4">Drop-off by question</h3>
        <div style={{ height: Math.max(dropOff.length * 60, 200) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dropOff.map((d, i) => ({
                name: `Q${i + 1}`,
                fullText: d.questionText,
                dropOffCount: d.dropOffCount,
                dropOffRate: d.dropOffRate
              }))}
              layout="vertical"
              margin={{ left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [value, name === "dropOffCount" ? "Drop-offs" : name]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullText || label}
              />
              <Bar dataKey="dropOffCount" radius={[0, 4, 4, 0]}>
                {dropOff.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.dropOffCount === maxDropOff && d.dropOffCount > 0 ? "#dc2626" : "#2563eb"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-left">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Question</th>
              <th className="px-4 py-2">Drop-offs</th>
              <th className="px-4 py-2">Rate</th>
            </tr>
          </thead>
          <tbody>
            {dropOff.map((d, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-4 py-2">{i + 1}</td>
                <td className="px-4 py-2">{d.questionText}</td>
                <td className="px-4 py-2">{d.dropOffCount}</td>
                <td className="px-4 py-2">{d.dropOffRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
