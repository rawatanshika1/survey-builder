const crypto = require("crypto");
const mongoose = require("mongoose");
const Invitation = require("../models/Invitation");
const SurveyPermission = require("../models/SurveyPermission");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const WorkspaceMember = require("../models/WorkspaceMember");
const Survey = require("../models/Survey");
const {
  ensurePersonalWorkspace,
  getWorkspaceMembership,
  requireSurveyAccess
} = require("../services/workspaceAccess");

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function respondWithError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === "CastError") return res.status(404).json({ message: "Resource not found" });
  console.error(fallback, error.message);
  return res.status(500).json({ message: fallback });
}

function invitationStatus(invitation) {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.expiresAt <= new Date()) return "expired";
  return "pending";
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function listWorkspaces(req, res) {
  try {
    await ensurePersonalWorkspace(req.userId);
    const memberships = await WorkspaceMember.find({ user: req.userId })
      .populate("workspace", "name owner createdAt")
      .sort({ createdAt: 1 });
    res.json({
      workspaces: memberships.filter((item) => item.workspace).map((item) => ({
        id: item.workspace._id,
        name: item.workspace.name,
        role: item.role,
        ownerId: item.workspace.owner,
        createdAt: item.workspace.createdAt
      }))
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to load workspaces");
  }
}

async function createWorkspace(req, res) {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 80) {
      return res.status(400).json({ message: "Workspace name must be between 1 and 80 characters" });
    }
    const workspace = await Workspace.create({ name, owner: req.userId });
    await WorkspaceMember.create({
      workspace: workspace._id,
      user: req.userId,
      role: "OWNER",
      addedBy: req.userId
    });
    res.status(201).json({
      workspace: { id: workspace._id, name: workspace.name, role: "OWNER", ownerId: workspace.owner }
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to create workspace");
  }
}

async function getWorkspace(req, res) {
  try {
    const access = await getWorkspaceMembership(req.params.id, req.userId);
    if (!access) return res.status(404).json({ message: "Workspace not found" });

    const members = await WorkspaceMember.find({ workspace: access.workspace._id })
      .populate("user", "name email")
      .sort({ role: 1, createdAt: 1 });
    const normalizedMembers = members.filter((member) => member.user).map((member) => ({
      id: member.user._id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      joinedAt: member.createdAt
    }));
    if (!normalizedMembers.some((member) => member.id.toString() === access.workspace.owner.toString())) {
      const owner = await User.findById(access.workspace.owner).select("name email");
      if (owner) {
        normalizedMembers.unshift({
          id: owner._id,
          name: owner.name,
          email: owner.email,
          role: "OWNER",
          joinedAt: access.workspace.createdAt
        });
      }
    }

    const invitations = access.role === "OWNER"
      ? await Invitation.find({ workspace: access.workspace._id }).sort({ createdAt: -1 })
      : [];
    res.json({
      workspace: {
        id: access.workspace._id,
        name: access.workspace.name,
        ownerId: access.workspace.owner,
        role: access.role,
        members: normalizedMembers,
        memberCount: normalizedMembers.length,
        invitations: invitations.map((invitation) => ({
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          status: invitationStatus(invitation),
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt
        }))
      }
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to load workspace");
  }
}

async function updateWorkspace(req, res) {
  try {
    const access = await getWorkspaceMembership(req.params.id, req.userId);
    if (!access) return res.status(404).json({ message: "Workspace not found" });
    if (access.role !== "OWNER") return res.status(403).json({ message: "Only workspace owners can change workspace settings" });
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 80) {
      return res.status(400).json({ message: "Workspace name must be between 1 and 80 characters" });
    }
    access.workspace.name = name;
    await access.workspace.save();
    res.json({ workspace: { id: access.workspace._id, name: access.workspace.name, role: access.role } });
  } catch (error) {
    return respondWithError(res, error, "Failed to update workspace");
  }
}

async function inviteMember(req, res) {
  try {
    const access = await getWorkspaceMembership(req.params.id, req.userId);
    if (!access) return res.status(404).json({ message: "Workspace not found" });
    if (access.role !== "OWNER") return res.status(403).json({ message: "Only workspace owners can invite members" });

    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const role = req.body.role;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (!["EDITOR", "VIEWER"].includes(role)) {
      return res.status(400).json({ message: "Invited members can be editors or viewers" });
    }
    const user = await User.findOne({ email }).select("_id");
    if (user && await WorkspaceMember.exists({ workspace: access.workspace._id, user: user._id })) {
      return res.status(409).json({ message: "This person is already a workspace member" });
    }

    await Invitation.deleteMany({
      workspace: access.workspace._id,
      email,
      acceptedAt: null
    });
    const token = crypto.randomBytes(32).toString("hex");
    const invitation = await Invitation.create({
      workspace: access.workspace._id,
      email,
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
      invitedBy: req.userId
    });
    res.status(201).json({
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        status: "pending",
        expiresAt: invitation.expiresAt,
        invitationPath: `/invite/${token}`
      }
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to send invitation");
  }
}

async function updateMemberRole(req, res) {
  try {
    const access = await getWorkspaceMembership(req.params.id, req.userId);
    if (!access) return res.status(404).json({ message: "Workspace not found" });
    if (access.role !== "OWNER") return res.status(403).json({ message: "Only workspace owners can change member roles" });
    if (!["EDITOR", "VIEWER"].includes(req.body.role)) {
      return res.status(400).json({ message: "Member roles must be editor or viewer" });
    }
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Member not found" });
    const member = await WorkspaceMember.findOneAndUpdate(
      { workspace: access.workspace._id, user: req.params.userId, role: { $ne: "OWNER" } },
      { $set: { role: req.body.role } },
      { new: true, runValidators: true }
    );
    if (!member) return res.status(404).json({ message: "Member not found" });
    res.json({ member: { userId: member.user, role: member.role } });
  } catch (error) {
    return respondWithError(res, error, "Failed to update member role");
  }
}

async function removeMember(req, res) {
  try {
    const access = await getWorkspaceMembership(req.params.id, req.userId);
    if (!access) return res.status(404).json({ message: "Workspace not found" });
    if (access.role !== "OWNER") return res.status(403).json({ message: "Only workspace owners can remove members" });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Member not found" });
    const member = await WorkspaceMember.findOne({
      workspace: access.workspace._id,
      user: req.params.userId,
      role: { $ne: "OWNER" }
    });
    if (!member) return res.status(404).json({ message: "Member not found" });
    await Promise.all([
      WorkspaceMember.deleteOne({ _id: member._id }),
      SurveyPermission.deleteMany({ user: member.user, survey: { $in: await Survey.distinct("_id", { workspaceId: access.workspace._id }) } })
    ]);
    res.json({ message: "Member removed" });
  } catch (error) {
    return respondWithError(res, error, "Failed to remove member");
  }
}

async function getInvitation(req, res) {
  try {
    const invitation = await Invitation.findOne({ tokenHash: hashToken(req.params.token) });
    if (!invitation) return res.status(404).json({ message: "Invitation not found" });
    const workspace = await Workspace.findById(invitation.workspace).select("name");
    if (!workspace) return res.status(404).json({ message: "Invitation workspace no longer exists" });
    res.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        workspaceName: workspace.name,
        status: invitationStatus(invitation),
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to load invitation");
  }
}

async function acceptInvitation(req, res) {
  try {
    const invitation = await Invitation.findOne({ tokenHash: hashToken(req.params.token) });
    if (!invitation) return res.status(404).json({ message: "Invitation not found" });
    if (invitation.acceptedAt) return res.status(409).json({ message: "This invitation has already been accepted" });
    if (invitation.expiresAt <= new Date()) return res.status(410).json({ message: "This invitation has expired" });
    const user = await User.findById(req.userId).select("email");
    if (!user) return res.status(401).json({ message: "Authenticated user not found" });
    if (user.email.toLowerCase() !== invitation.email) {
      return res.status(403).json({ message: "Sign in with the email address this invitation was sent to" });
    }
    if (!await Workspace.exists({ _id: invitation.workspace })) {
      return res.status(404).json({ message: "Invitation workspace no longer exists" });
    }

    await WorkspaceMember.create({
      workspace: invitation.workspace,
      user: req.userId,
      role: invitation.role,
      addedBy: invitation.invitedBy
    });
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = req.userId;
    await invitation.save();
    res.json({ message: "Invitation accepted", workspaceId: invitation.workspace });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This account is already a workspace member" });
    return respondWithError(res, error, "Failed to accept invitation");
  }
}

async function getSurveyPermissions(req, res) {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: "Survey not found" });
    const access = await requireSurveyAccess(survey, req.userId, ["OWNER", "EDITOR", "VIEWER"]);
    const members = survey.workspaceId
      ? await WorkspaceMember.find({ workspace: survey.workspaceId }).populate("user", "name email")
      : [];
    const roleByUser = new Map(members.filter((member) => member.user).map((member) => [member.user._id.toString(), member.role]));
    const explicit = await SurveyPermission.find({ survey: survey._id }).populate("user", "name email");
    const users = new Map();
    members.forEach((member) => {
      if (member.user) users.set(member.user._id.toString(), {
        id: member.user._id,
        name: member.user.name,
        email: member.user.email,
        workspaceRole: member.role,
        role: member.role === "OWNER" ? "OWNER" : (explicit.find((item) => item.user?._id.toString() === member.user._id.toString())?.role || member.role),
        hasOverride: member.role !== "OWNER" && explicit.some((item) => item.user?._id.toString() === member.user._id.toString())
      });
    });
    explicit.forEach((permission) => {
      if (permission.user && !users.has(permission.user._id.toString())) {
        users.set(permission.user._id.toString(), {
          id: permission.user._id,
          name: permission.user.name,
          email: permission.user.email,
          workspaceRole: roleByUser.get(permission.user._id.toString()) || null,
          role: permission.role
        });
      }
    });
    res.json({
      access: { role: access.role, canManageAccess: access.canManageAccess },
      members: [...users.values()]
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to load survey permissions");
  }
}

async function setSurveyPermission(req, res) {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: "Survey not found" });
    const access = await requireSurveyAccess(survey, req.userId, ["OWNER"]);
    if (!access.canManageAccess) return res.status(403).json({ message: "Only survey owners can manage access" });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Member not found" });
    if (!["EDITOR", "VIEWER"].includes(req.body.role)) {
      return res.status(400).json({ message: "Survey access must be editor or viewer" });
    }
    if (survey.workspaceId && !await WorkspaceMember.exists({ workspace: survey.workspaceId, user: req.params.userId })) {
      return res.status(400).json({ message: "Survey access can only be granted to workspace members" });
    }
    if (survey.workspaceId && await WorkspaceMember.exists({ workspace: survey.workspaceId, user: req.params.userId, role: "OWNER" })) {
      return res.status(400).json({ message: "Workspace owners already have full survey access" });
    }
    if (req.params.userId === survey.createdBy.toString()) {
      return res.status(400).json({ message: "The survey owner already has full access" });
    }
    const permission = await SurveyPermission.findOneAndUpdate(
      { survey: survey._id, user: req.params.userId },
      { $set: { role: req.body.role, grantedBy: req.userId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ permission: { userId: permission.user, role: permission.role } });
  } catch (error) {
    return respondWithError(res, error, "Failed to update survey permission");
  }
}

async function removeSurveyPermission(req, res) {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: "Survey not found" });
    const access = await requireSurveyAccess(survey, req.userId, ["OWNER"]);
    if (!access.canManageAccess) return res.status(403).json({ message: "Only survey owners can manage access" });
    const result = await SurveyPermission.deleteOne({ survey: survey._id, user: req.params.userId });
    if (!result.deletedCount) return res.status(404).json({ message: "Survey permission not found" });
    res.json({ message: "Survey access removed" });
  } catch (error) {
    return respondWithError(res, error, "Failed to remove survey permission");
  }
}

module.exports = {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  inviteMember,
  updateMemberRole,
  removeMember,
  getInvitation,
  acceptInvitation,
  getSurveyPermissions,
  setSurveyPermission,
  removeSurveyPermission
};
