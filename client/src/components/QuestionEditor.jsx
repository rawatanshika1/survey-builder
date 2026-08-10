const QUESTION_TYPES = [
  { value: "short-answer", label: "Short Answer" },
  { value: "long-answer", label: "Long Answer" },
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "rating", label: "Rating (1-5)" },
  { value: "yes-no", label: "Yes / No" }
];

const CHOICE_TYPES = ["multiple-choice", "checkboxes", "dropdown"];

export default function QuestionEditor({ question, index, total, onChange, onDelete, onMove }) {
  function update(field, value) {
    onChange({ ...question, [field]: value });
  }

  function updateOption(i, value) {
    const newOptions = [...question.options];
    newOptions[i] = value;
    update("options", newOptions);
  }

  function addOption() {
    update("options", [...(question.options || []), ""]);
  }

  function removeOption(i) {
    update(
      "options",
      question.options.filter((_, idx) => idx !== i)
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <input
          type="text"
          value={question.questionText}
          onChange={(e) => update("questionText", e.target.value)}
          placeholder={`Question ${index + 1}`}
          className="flex-1 font-medium bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-blue-500 py-1"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="text-xs px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="text-xs px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={question.type}
          onChange={(e) => update("type", e.target.value)}
          className="text-sm rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => update("required", e.target.checked)}
          />
          Required
        </label>
      </div>

      {CHOICE_TYPES.includes(question.type) && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          {(question.options || []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-xs text-red-600 px-1"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            + Add option
          </button>
        </div>
      )}
    </div>
  );
}

export { QUESTION_TYPES };
