import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AnswerInput from "./AnswerInput.jsx";
import { updateProgress } from "../services/responseService.js";
import { evaluateSurveyPath, getQuestionId, hasAnswer } from "../utils/surveyLogic.js";

export default function ConversationalSurveyForm({ survey, responseId, onSubmit, submitting }) {
  const initialQuestionId = getQuestionId([...survey.questions].sort((a, b) => a.order - b.order)[0]);
  const [history, setHistory] = useState([initialQuestionId]);
  const [answers, setAnswers] = useState({});
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState("");

  const questions = [...survey.questions].sort((a, b) => a.order - b.order);
  const path = evaluateSurveyPath(survey, answers);
  const currentQuestionId = history[history.length - 1];
  const question = questions.find((candidate) => getQuestionId(candidate) === currentQuestionId);
  const qid = getQuestionId(question);
  const currentIndex = path.reachedQuestionIds.indexOf(qid);
  const progressPct = Math.round((path.reachedQuestionIds.length / questions.length) * 100);

  function setAnswer(value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function isCurrentAnswerValid() {
    if (!question.required) return true;
    return hasAnswer(answers[qid]);
  }

  async function goNext() {
    if (!isCurrentAnswerValid()) {
      setError("This question is required");
      return;
    }
    setError("");

    const nextAnswers = { ...answers };
    const nextPath = evaluateSurveyPath(survey, nextAnswers);
    const pathIndex = nextPath.reachedQuestionIds.indexOf(qid);
    const nextQuestionId = nextPath.reachedQuestionIds[pathIndex + 1];

    if (responseId) {
      const progressIndex = nextQuestionId
        ? questions.findIndex((candidate) => getQuestionId(candidate) === nextQuestionId)
        : questions.findIndex((candidate) => getQuestionId(candidate) === qid) + 1;
      updateProgress(responseId, progressIndex).catch(() => {});
    }

    if (!nextQuestionId) {
      const formatted = nextPath.reachedQuestionIds.map((questionId) => ({
        questionId,
        value: nextAnswers[questionId] ?? null
      }));
      onSubmit(formatted, nextPath);
      return;
    }

    setDirection(1);
    setHistory((previous) => [...previous, nextQuestionId]);
  }

  function goBack() {
    if (history.length <= 1) return;
    setError("");
    setDirection(-1);
    setHistory((previous) => previous.slice(0, -1));
  }

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 })
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-label="Survey progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
        <motion.div
          className="h-full bg-[#0D9488]"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={qid}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <p className="text-xs text-gray-400 mb-2">
                Question {currentIndex + 1} of {path.reachedQuestionIds.length}
              </p>
              <h2 className="text-xl font-semibold mb-4">
                {question.questionText}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </h2>
              {question.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{question.description}</p>}

              <AnswerInput question={question} value={answers[qid]} onChange={setAnswer} />

              {error && <p className="text-sm text-red-600 mt-3" role="alert">{error}</p>}

              <div className="flex items-center gap-3 mt-6">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={goNext}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium rounded-md bg-[#0f766e] text-white hover:bg-[#115e59] disabled:opacity-60 transition-colors"
                >
                  {submitting
                    ? "Submitting..."
                    : !path.reachedQuestionIds[currentIndex + 1]
                    ? "Submit"
                    : "Next"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
