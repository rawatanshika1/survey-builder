import { useState } from "react";
import AnswerInput from "./AnswerInput.jsx";

export default function ClassicSurveyForm({ survey, onSubmit, submitting }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");

  function setAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    for (const q of survey.questions) {
      const qid = q._id || q.id;
      if (q.required) {
        const val = answers[qid];
        const isEmpty =
          val === undefined ||
          val === "" ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          setError(`"${q.questionText}" is required`);
          return;
        }
      }
    }

    const formatted = survey.questions.map((q) => ({
      questionId: q._id || q.id,
      value: answers[q._id || q.id] ?? null
    }));

    onSubmit(formatted);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{survey.title}</h1>
        {survey.description && (
          <p className="text-gray-500 dark:text-gray-400 mt-1">{survey.description}</p>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {survey.questions.map((q) => {
        const qid = q._id || q.id;
        return (
          <div key={qid} className="space-y-2">
            <label className="block text-sm font-medium">
              {q.questionText}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <AnswerInput
              question={q}
              value={answers[qid]}
              onChange={(val) => setAnswer(qid, val)}
            />
          </div>
        );
      })}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-md py-3 text-sm"
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
