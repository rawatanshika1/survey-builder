import api from "./api.js";

export function getSurveys(params = {}) {
  return api.get("/surveys", { params }).then((res) => res.data.surveys);
}

export function getSurveyById(id) {
  return api.get(`/surveys/${id}`).then((res) => res.data.survey);
}

export function createSurvey(payload) {
  return api.post("/surveys", payload).then((res) => res.data.survey);
}

export function updateSurvey(id, payload) {
  return api.put(`/surveys/${id}`, payload).then((res) => res.data.survey);
}

export function deleteSurvey(id) {
  return api.delete(`/surveys/${id}`).then((res) => res.data);
}

export function publishSurvey(id) {
  return api.patch(`/surveys/${id}/publish`).then((res) => res.data.survey);
}
