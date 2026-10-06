import { useState } from "react";
import AnswerInput from "./AnswerInput.jsx";
import { evaluateSurveyPath, getQuestionId, hasAnswer } from "../utils/surveyLogic.js";

export default function ClassicSurveyForm({ survey, onSubmit, submitting }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const path = evaluateSurveyPath(survey, answers);
  const questionsById = new Map(survey.questions.map((question) => [getQuestionId(question), question]));
  const activeQuestions = path.reachedQuestionIds.map((id) => questionsById.get(id)).filter(Boolean);

  function setAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    for (const q of activeQuestions) {
      const qid = getQuestionId(q);
      if (q.required && !hasAnswer(answers[qid])) {
        setError(`"${q.questionText}" is required`);
        return;
      }
    }

    const formatted = activeQuestions.map((q) => ({
      questionId: getQuestionId(q),
      value: answers[getQuestionId(q)] ?? null
    }));

    onSubmit(formatted, path);
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

      {activeQuestions.map((q) => {
        const qid = getQuestionId(q);
        return (
          <div key={qid} className="space-y-2">
            <label className="block text-sm font-medium">
              {q.questionText}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {q.description && <p className="text-sm text-gray-500 dark:text-gray-400">{q.description}</p>}
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
        className="w-full bg-[#003366] hover:bg-[#1e3a5f] disabled:opacity-60 text-white font-medium rounded-md py-3 text-sm transition-colors"
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
