import api from "./api.js";

export function getPublicSurvey(slug) {
  return api.get(`/surveys/public/${slug}`).then((res) => res.data.survey);
}

export function startResponse(surveyId) {
  return api.post("/responses/start", { surveyId }).then((res) => res.data.responseId);
}

export function updateProgress(responseId, questionIndex) {
  return api.patch(`/responses/${responseId}/progress`, { questionIndex });
}

export function submitResponse(responseId, answers) {
  return api.post(`/responses/${responseId}/submit`, { answers }).then((res) => res.data);
}
