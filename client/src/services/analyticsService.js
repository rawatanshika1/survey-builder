import api from "./api.js";

export function getAnalytics(surveyId) {
  return api.get(`/surveys/${surveyId}/analytics`).then((res) => res.data);
}

export function refreshInsights(surveyId, questionId) {
  return api
    .post(`/surveys/${surveyId}/insights/${questionId}`)
    .then((res) => res.data.insights);
}

export function getResponses(surveyId) {
  return api.get(`/surveys/${surveyId}/responses`).then((res) => res.data.responses);
}

export async function downloadExport(surveyId, filename = "responses.csv") {
  const res = await api.get(`/surveys/${surveyId}/export`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
