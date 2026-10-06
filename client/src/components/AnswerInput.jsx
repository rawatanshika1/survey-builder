export default function AnswerInput({ question, value, onChange }) {
  switch (question.type) {
    case "short-answer":
      return (
        <input
          type="text"
          aria-label={question.questionText}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
          placeholder="Your answer"
        />
      );

    case "long-answer":
      return (
        <textarea
          aria-label={question.questionText}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
          placeholder="Your answer"
        />
      );

    case "multiple-choice":
      return (
        <div className="space-y-2" role="radiogroup" aria-label={question.questionText}>
          {question.options.map((opt, i) => (
            <label
              key={i}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 cursor-pointer hover:border-[#0D9488]"
            >
              <input
                type="radio"
                aria-label={`${question.questionText}: ${opt}`}
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
        <div className="space-y-2" role="group" aria-label={question.questionText}>
          {question.options.map((opt, i) => (
            <label
              key={i}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 cursor-pointer hover:border-[#0D9488]"
            >
              <input type="checkbox" aria-label={`${question.questionText}: ${opt}`} checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    case "dropdown":
      return (
        <select
          aria-label={question.questionText}
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
              aria-label={`${question.questionText}: ${n} out of 5`}
              aria-pressed={value === n}
              onClick={() => onChange(n)}
              className={`w-10 h-10 rounded-full text-sm font-medium border ${
                value === n
                  ? "bg-[#0f766e] text-white border-[#0f766e]"
                  : "border-gray-300 dark:border-gray-600 hover:border-[#0D9488]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      );

    case "nps":
      return (
        <fieldset className="nps-selector" aria-label={question.questionText}>
          <div className="nps-selector__scale" role="radiogroup" aria-label="Recommendation score from 0 to 10">
            {Array.from({ length: 11 }, (_, score) => (
              <label
                className={`nps-selector__option ${Number(value) === score ? "is-selected" : ""}`}
                key={score}
              >
                <input
                  type="radio"
                  name={question._id || question.id}
                  value={score}
                  checked={value === score}
                  aria-label={`${score}${score === 0 ? ", not at all likely" : score === 10 ? ", extremely likely" : ""}`}
                  onChange={() => onChange(score)}
                />
                <span>{score}</span>
              </label>
            ))}
          </div>
          <div className="nps-selector__labels">
            <span>0 = Not at all likely</span>
            <span>10 = Extremely likely</span>
          </div>
        </fieldset>
      );

    case "number":
      return (
        <input
          type="number"
          aria-label={question.questionText}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
          placeholder="Enter a number"
        />
      );

    case "yes-no":
      return (
        <div className="flex gap-3">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              aria-label={`${question.questionText}: ${opt}`}
              aria-pressed={value === opt}
              onClick={() => onChange(opt)}
              className={`px-5 py-2 rounded-md text-sm font-medium border ${
                value === opt
                  ? "bg-[#0f766e] text-white border-[#0f766e]"
                  : "border-gray-300 dark:border-gray-600 hover:border-[#0D9488]"
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
