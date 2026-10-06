import api from "./api.js";

export function getDistribution(surveyId) {
  return api.get(`/surveys/${surveyId}/distribution`).then((response) => response.data);
}

export function addSurveyRecipients(surveyId, emails) {
  return api.post(`/surveys/${surveyId}/distribution/recipients`, { emails }).then((response) => response.data);
}

export function sendSurveyInvitations(surveyId, reminder = false) {
  return api.post(`/surveys/${surveyId}/distribution/send`, { reminder }).then((response) => response.data);
}

export function retrySurveyInvitation(surveyId, recipientId, reminder = false) {
  return api.post(`/surveys/${surveyId}/distribution/recipients/${recipientId}/send`, { reminder }).then((response) => response.data);
}
