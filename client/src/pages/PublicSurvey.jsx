import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getPublicSurvey, startResponse, submitResponse } from "../services/responseService.js";
import ClassicSurveyForm from "../components/ClassicSurveyForm.jsx";
import ConversationalSurveyForm from "../components/ConversationalSurveyForm.jsx";

export default function PublicSurvey() {
  const { slug } = useParams();

  const [survey, setSurvey] = useState(null);
  const [responseId, setResponseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;

    getPublicSurvey(slug)
      .then(async (data) => {
        if (!mounted) return;
        setSurvey(data);
        try {
          const id = await startResponse(data._id);
          if (mounted) setResponseId(id);
        } catch {
          // Non-fatal - respondent can still fill out the survey even if
          // the start-tracking call fails
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err.response?.status === 410
            ? "This survey has expired."
            : "This survey is not available."
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  async function handleSubmit(answers) {
    setSubmitting(true);
    try {
      if (responseId) {
        await submitResponse(responseId, answers);
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit response", err);
      toast.error("Something went wrong submitting your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading survey...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-500 dark:text-gray-400 text-center">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      >
        <h1 className="text-2xl font-bold mb-2">Thank you! 🎉</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Your response has been recorded.
        </p>
      </motion.div>
    );
  }

  if (survey.mode === "conversational") {
    return (
      <ConversationalSurveyForm
        survey={survey}
        responseId={responseId}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    );
  }

  return (
    <ClassicSurveyForm survey={survey} onSubmit={handleSubmit} submitting={submitting} />
  );
}
