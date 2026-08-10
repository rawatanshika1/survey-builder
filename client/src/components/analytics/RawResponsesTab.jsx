import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getResponses, downloadExport } from "../../services/analyticsService.js";

const PAGE_SIZE = 10;

export default function RawResponsesTab({ survey, analytics }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getResponses(survey._id)
      .then(setResponses)
      .catch((err) => console.error("Failed to load responses", err))
      .finally(() => setLoading(false));
  }, [survey._id]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadExport(survey._id, `${survey.title || "survey"}-responses.csv`);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to export responses");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(responses.length / PAGE_SIZE));
  const pageResponses = responses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {analytics.totalResponses} total {analytics.totalResponses === 1 ? "response" : "responses"}
        </p>
        <button
          onClick={handleExport}
          disabled={exporting || responses.length === 0}
          className="text-sm font-medium px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {exporting ? "Exporting..." : "Export as CSV"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading responses...</p>
      ) : responses.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-10">No responses yet.</p>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-gray-900 text-left">
                <tr>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Started</th>
                  {pageResponses[0]?.answers.map((a, i) => (
                    <th key={i} className="px-4 py-2 whitespace-nowrap">
                      {a.questionText}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageResponses.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          r.completed
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-700"
                        }`}
                      >
                        {r.completed ? "Completed" : "Incomplete"}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    {r.answers.map((a, i) => (
                      <td key={i} className="px-4 py-2">
                        {Array.isArray(a.value) ? a.value.join(", ") : a.value ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
