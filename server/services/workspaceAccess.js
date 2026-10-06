const mongoose = require("mongoose");
const Survey = require("../models/Survey");
const SurveyPermission = require("../models/SurveyPermission");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const WorkspaceMember = require("../models/WorkspaceMember");

async function ensurePersonalWorkspace(userId) {
  let workspace = await Workspace.findOne({ owner: userId, isPersonal: true });
  if (!workspace) {
    const user = await User.findById(userId).select("name");
    if (!user) {
      const error = new Error("Authenticated user not found");
      error.status = 401;
      throw error;
    }
    try {
      workspace = await Workspace.create({
        owner: userId,
        name: `${user.name}'s workspace`,
        isPersonal: true
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      workspace = await Workspace.findOne({ owner: userId, isPersonal: true });
      if (!workspace) throw error;
    }
  }

  await WorkspaceMember.updateOne(
    { workspace: workspace._id, user: userId },
    { $setOnInsert: { role: "OWNER", addedBy: userId } },
    { upsert: true }
  );
  await Survey.updateMany(
    {
      createdBy: userId,
      $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }]
    },
    { $set: { workspaceId: workspace._id } }
  );
  return workspace;
}

async function getWorkspaceMembership(workspaceId, userId) {
  if (!mongoose.isValidObjectId(workspaceId)) return null;
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return null;
  if (workspace.owner.toString() === userId.toString()) {
    return { workspace, role: "OWNER" };
  }
  const member = await WorkspaceMember.findOne({ workspace: workspaceId, user: userId });
  return member ? { workspace, role: member.role, member } : null;
}

async function getSurveyAccess(survey, userId) {
  if (!survey) return null;
  if (survey.workspaceId) {
    const membership = await getWorkspaceMembership(survey.workspaceId, userId);
    if (membership?.role === "OWNER") {
      return { role: "OWNER", canManageAccess: true };
    }
    const permission = await SurveyPermission.findOne({ survey: survey._id, user: userId });
    if (permission) {
      return {
        role: permission.role,
        canManageAccess: false
      };
    }
    if (membership) {
      return {
        role: membership.role,
        canManageAccess: membership.role === "OWNER"
      };
    }
    return null;
  }

  if (survey.createdBy.toString() === userId.toString()) {
    return { role: "OWNER", canManageAccess: true };
  }
  const permission = await SurveyPermission.findOne({ survey: survey._id, user: userId });
  return permission ? { role: permission.role, canManageAccess: false } : null;
}

async function requireSurveyAccess(survey, userId, allowedRoles) {
  const access = await getSurveyAccess(survey, userId);
  if (!access) {
    const error = new Error("You don't have access to this survey");
    error.status = 404;
    throw error;
  }
  if (!allowedRoles.includes(access.role)) {
    const error = new Error("You don't have permission to perform this action");
    error.status = 403;
    throw error;
  }
  return access;
}

function roleCapabilities(role) {
  return {
    role,
    canEdit: role === "OWNER" || role === "EDITOR",
    canDelete: role === "OWNER",
    canManageAccess: role === "OWNER"
  };
}

module.exports = {
  ensurePersonalWorkspace,
  getWorkspaceMembership,
  getSurveyAccess,
  requireSurveyAccess,
  roleCapabilities
};
