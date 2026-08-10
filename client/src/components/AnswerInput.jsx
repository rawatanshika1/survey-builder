export default function AnswerInput({ question, value, onChange }) {
  switch (question.type) {
    case "short-answer":
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your answer"
        />
      );

    case "long-answer":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your answer"
        />
      );

    case "multiple-choice":
      return (
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label
              key={i}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 cursor-pointer hover:border-blue-400"
            >
              <input
                type="radio"
                name={question._id || question.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );

    case "checkboxes": {
      const selected = Array.isArray(value) ? value : [];
      function toggle(opt) {
        if (selected.includes(opt)) {
          onChange(selected.filter((o) => o !== opt));
        } else {
          onChange([...selected, opt]);
        }
      }
      return (
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label
              key={i}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 cursor-pointer hover:border-blue-400"
            >
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    case "dropdown":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
        >
          <option value="">Select an option</option>
          {question.options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "rating":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-10 h-10 rounded-full text-sm font-medium border ${
                value === n
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      );

    case "yes-no":
      return (
        <div className="flex gap-3">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-5 py-2 rounded-md text-sm font-medium border ${
                value === opt
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    default:
      return null;
  }
}
