import { Link } from "react-router-dom";

export default function SurveyCard({ survey, onDelete }) {
  const createdDate = new Date(survey.createdAt).toLocaleDateString();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-lg">{survey.title || "Untitled survey"}</h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            survey.status === "published"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {survey.status}
        </span>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
        {survey.description || "No description"}
      </p>

      <div className="text-xs text-gray-400 flex gap-3">
        <span>{survey.questions?.length || 0} questions</span>
        <span>Created {createdDate}</span>
      </div>

      <div className="flex gap-2 mt-2">
        <Link
          to={`/builder/${survey._id}`}
          className="flex-1 text-center text-sm font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Edit
        </Link>
        <Link
          to={`/analytics/${survey._id}`}
          className="flex-1 text-center text-sm font-medium px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Analytics
        </Link>
        <button
          onClick={() => onDelete(survey._id)}
          className="text-sm font-medium px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
