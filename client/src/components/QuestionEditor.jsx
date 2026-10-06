const QUESTION_TYPES = [
  { value: "short-answer", label: "Short Answer" },
  { value: "long-answer", label: "Long Answer" },
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "rating", label: "Rating (1-5)" },
  { value: "number", label: "Number" },
  { value: "nps", label: "NPS (0-10)" },
  { value: "yes-no", label: "Yes / No" }
];

const CHOICE_TYPES = ["multiple-choice", "checkboxes", "dropdown"];

export default function QuestionEditor({ question, index, total, onChange, onDelete, onMove, onLogic, onDuplicate, readOnly = false }) {
  function update(field, value) {
    onChange({ ...question, [field]: value });
  }

  function updateType(type) {
    onChange({
      ...question,
      type,
      questionText: type === "nps" && !question.questionText.trim()
        ? "How likely are you to recommend our product to a friend or colleague?"
        : question.questionText
    });
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
          aria-label={`Question ${index + 1} text`}
          value={question.questionText}
          onChange={(e) => update("questionText", e.target.value)}
          readOnly={readOnly}
          placeholder={`Question ${index + 1}`}
          className="flex-1 font-medium bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[#003366] py-1"
        />

        {!readOnly && <div className="flex items-center gap-1 question-editor-actions">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Move question ${index + 1} up`}
            className="text-xs px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label={`Move question ${index + 1} down`}
            className="text-xs px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`Duplicate question ${index + 1}`}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onLogic}
            aria-label={`Edit logic for question ${index + 1}`}
            className="text-xs px-2 py-1 rounded hover:bg-[#eaf1f7] dark:hover:bg-blue-900/20 text-[#003366] dark:text-blue-400"
          >
            Logic
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete question ${index + 1}`}
            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>}
      </div>

      <textarea
        aria-label={`Description for question ${index + 1}`}
        value={question.description || ""}
        onChange={(event) => update("description", event.target.value)}
        readOnly={readOnly}
        placeholder="Description (optional)"
        rows={2}
        className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label={`Type for question ${index + 1}`}
          value={question.type}
          onChange={(e) => updateType(e.target.value)}
          disabled={readOnly}
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
            disabled={readOnly}
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
                aria-label={`Option ${i + 1} for question ${index + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                readOnly={readOnly}
                placeholder={`Option ${i + 1}`}
                className="flex-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1"
              />
              {!readOnly && <button
                type="button"
                onClick={() => removeOption(i)}
                aria-label={`Remove option ${i + 1} from question ${index + 1}`}
                className="text-xs text-red-600 px-1"
              >
                ✕
              </button>}
            </div>
          ))}
          {!readOnly && <button
            type="button"
            onClick={addOption}
            className="text-xs font-medium text-[#003366] dark:text-blue-400"
          >
            + Add option
          </button>}
        </div>
      )}
    </div>
  );
}

export { QUESTION_TYPES };
