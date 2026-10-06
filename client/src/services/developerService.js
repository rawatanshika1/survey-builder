import api from "./api.js";

export function getDeveloperKeys(workspaceId) {
  return api.get(`/developer/workspaces/${workspaceId}/keys`).then((response) => response.data.keys);
}

export function createDeveloperKey(workspaceId, name, scopes) {
  return api.post(`/developer/workspaces/${workspaceId}/keys`, { name, scopes }).then((response) => response.data);
}

export function revokeDeveloperKey(workspaceId, keyId) {
  return api.delete(`/developer/workspaces/${workspaceId}/keys/${keyId}`).then((response) => response.data.key);
}

export function getDeveloperUsage(workspaceId) {
  return api.get(`/developer/workspaces/${workspaceId}/usage`).then((response) => response.data.usage);
}
