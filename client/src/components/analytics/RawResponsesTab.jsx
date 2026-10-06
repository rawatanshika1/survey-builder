import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { downloadExport } from "../../services/analyticsService.js";
import { EmptyState, Table } from "../ui.jsx";

const PAGE_SIZE = 10;

export default function RawResponsesTab({ survey, analytics, responses = [] }) {
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [survey._id, responses.length]);

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
          className="text-sm font-medium px-4 py-2 rounded-md bg-[#003366] text-white hover:bg-[#1e3a5f] disabled:opacity-60 transition-colors"
        >
          {exporting ? "Exporting..." : "Export as CSV"}
        </button>
      </div>

      {responses.length === 0 ? (
        <EmptyState icon="inbox" title="No responses yet" description="Responses will appear here once someone completes your survey." />
      ) : (
        <>
          <Table>
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
                        {a.status === "skipped"
                          ? "Skipped (logic)"
                          : a.status === "not-reached"
                            ? "Not reached"
                            : Array.isArray(a.value) ? a.value.join(", ") : a.value ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
          </Table>

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
