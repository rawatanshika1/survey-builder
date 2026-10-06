import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getPublicSurvey, startResponse, submitResponse } from "../services/responseService.js";
import ClassicSurveyForm from "../components/ClassicSurveyForm.jsx";
import ConversationalSurveyForm from "../components/ConversationalSurveyForm.jsx";
import { Button } from "../components/ui.jsx";

export default function PublicSurvey() {
  const { slug } = useParams();

  const [survey, setSurvey] = useState(null);
  const [responseId, setResponseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");
  const [startingResponse, setStartingResponse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;

    getPublicSurvey(slug)
      .then(async (data) => {
        if (!mounted) return;
        setSurvey(data);
        try {
          const id = await startSurveyResponse(data);
          if (mounted) {
            setResponseId(id);
            setStartError("");
          }
        } catch (startRequestError) {
          if (mounted) {
            setStartError(startRequestError.response?.data?.message || "We couldn't start response tracking. Please try again.");
          }
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

  async function startSurveyResponse(currentSurvey = survey) {
    if (!currentSurvey) throw new Error("Survey is not loaded");
    setStartingResponse(true);
    setStartError("");
    try {
      const distributionToken = new URLSearchParams(window.location.search).get("distribution");
      return await startResponse(currentSurvey._id, distributionToken || undefined);
    } finally {
      setStartingResponse(false);
    }
  }

  async function retryStartResponse() {
    try {
      const id = await startSurveyResponse();
      setResponseId(id);
      setStartError("");
    } catch (startRequestError) {
      setStartError(startRequestError.response?.data?.message || "We couldn't start response tracking. Please try again.");
    }
  }

  async function handleSubmit(answers) {
    setSubmitting(true);
    try {
      if (!responseId) throw new Error("Your response could not be started. Please retry before submitting.");
      await submitResponse(responseId, answers);
      setSubmitted(true);
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Something went wrong submitting your response. Please try again.";
      toast.error(message);
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

  if (startError || !responseId) {
    return (
      <div className="public-survey-tracking-error" role="alert">
        <h1>We couldn't start your response</h1>
        <p>{startError || "Response tracking is unavailable. Your answers have not been submitted."}</p>
        <Button variant="primary" onClick={retryStartResponse} disabled={startingResponse}>
          {startingResponse ? "Retrying..." : "Try again"}
        </Button>
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
