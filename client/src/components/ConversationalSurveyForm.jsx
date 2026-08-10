import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AnswerInput from "./AnswerInput.jsx";
import { updateProgress } from "../services/responseService.js";

export default function ConversationalSurveyForm({ survey, responseId, onSubmit, submitting }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState("");

  const questions = survey.questions;
  const total = questions.length;
  const question = questions[currentIndex];
  const qid = question._id || question.id;
  const progressPct = Math.round(((currentIndex + 1) / total) * 100);

  function setAnswer(value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function isCurrentAnswerValid() {
    if (!question.required) return true;
    const val = answers[qid];
    if (val === undefined || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }

  async function goNext() {
    if (!isCurrentAnswerValid()) {
      setError("This question is required");
      return;
    }
    setError("");

    const nextIndex = currentIndex + 1;

    if (responseId) {
      updateProgress(responseId, nextIndex).catch(() => {});
    }

    if (nextIndex >= total) {
      const formatted = questions.map((q) => ({
        questionId: q._id || q.id,
        value: answers[q._id || q.id] ?? null
      }));
      onSubmit(formatted);
      return;
    }

    setDirection(1);
    setCurrentIndex(nextIndex);
  }

  function goBack() {
    if (currentIndex === 0) return;
    setError("");
    setDirection(-1);
    setCurrentIndex(currentIndex - 1);
  }

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 })
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700">
        <motion.div
          className="h-full bg-blue-600"
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
                Question {currentIndex + 1} of {total}
              </p>
              <h2 className="text-xl font-semibold mb-4">
                {question.questionText}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </h2>

              <AnswerInput question={question} value={answers[qid]} onChange={setAnswer} />

              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

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
                  className="px-5 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting
                    ? "Submitting..."
                    : currentIndex === total - 1
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
