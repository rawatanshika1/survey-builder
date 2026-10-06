import api from "./api.js";

export function getWorkspaces() {
  return api.get("/workspaces").then((res) => res.data.workspaces);
}

export function createWorkspace(name) {
  return api.post("/workspaces", { name }).then((res) => res.data.workspace);
}

export function getWorkspace(id) {
  return api.get(`/workspaces/${id}`).then((res) => res.data.workspace);
}

export function updateWorkspace(id, name) {
  return api.patch(`/workspaces/${id}`, { name }).then((res) => res.data.workspace);
}

export function inviteWorkspaceMember(id, email, role) {
  return api.post(`/workspaces/${id}/invitations`, { email, role }).then((res) => res.data.invitation);
}

export function updateWorkspaceMember(id, userId, role) {
  return api.patch(`/workspaces/${id}/members/${userId}`, { role }).then((res) => res.data.member);
}

export function removeWorkspaceMember(id, userId) {
  return api.delete(`/workspaces/${id}/members/${userId}`).then((res) => res.data);
}

export function getInvitation(token) {
  return api.get(`/invitations/${token}`).then((res) => res.data.invitation);
}

export function acceptInvitation(token) {
  return api.post(`/invitations/${token}/accept`).then((res) => res.data);
}

export function getSurveyPermissions(id) {
  return api.get(`/surveys/${id}/permissions`).then((res) => res.data);
}

export function setSurveyPermission(id, userId, role) {
  return api.put(`/surveys/${id}/permissions/${userId}`, { role }).then((res) => res.data.permission);
}

export function removeSurveyPermission(id, userId) {
  return api.delete(`/surveys/${id}/permissions/${userId}`).then((res) => res.data);
}
