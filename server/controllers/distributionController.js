const crypto = require("crypto");
const mongoose = require("mongoose");
const Survey = require("../models/Survey");
const SurveyRecipient = require("../models/SurveyRecipient");
const Workspace = require("../models/Workspace");
const { requireSurveyAccess } = require("../services/workspaceAccess");
const { sendSurveyInvitation } = require("../services/surveyMailer");

const MAX_RECIPIENTS_PER_REQUEST = 500;
const MAX_SENDS_PER_REQUEST = 100;
const TRACKING_PIXEL = Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenForRecipient(recipientId) {
  const secret = process.env.DISTRIBUTION_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error("Set DISTRIBUTION_TOKEN_SECRET or JWT_SECRET before creating email recipients.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  return crypto.createHmac("sha256", secret).update(String(recipientId)).digest("base64url");
}

function publicBaseUrl() {
  const value = process.env.APP_BASE_URL;
  if (!value) {
    const error = new Error("Email distribution requires APP_BASE_URL to be configured.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  return value.replace(/\/+$/, "");
}

function emailApiBaseUrl() {
  const frontendUrl = publicBaseUrl();
  return (process.env.EMAIL_PUBLIC_API_URL || `${frontendUrl}/api`).replace(/\/+$/, "");
}

function responseError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === "CastError") return res.status(404).json({ message: "Survey not found" });
  if (error.code === "EMAIL_NOT_CONFIGURED") return res.status(503).json({ message: error.message });
  console.error(fallback, error.message);
  return res.status(500).json({ message: fallback });
}

async function getSurveyForDistribution(surveyId, userId, requirePublished = false) {
  if (!mongoose.isValidObjectId(surveyId)) {
    const error = new Error("Survey not found");
    error.status = 404;
    throw error;
  }
  const survey = await Survey.findById(surveyId);
  if (!survey) {
    const error = new Error("Survey not found");
    error.status = 404;
    throw error;
  }
  const access = await requireSurveyAccess(survey, userId, ["OWNER", "EDITOR"]);
  if (requirePublished && (!survey.slug || survey.status !== "published")) {
    const error = new Error("Publish this survey before sending email invitations.");
    error.status = 400;
    throw error;
  }
  return { survey, access };
}

function recipientDto(recipient) {
  return {
    id: recipient._id,
    email: recipient.email,
    status: recipient.respondedAt ? "responded" : recipient.emailStatus,
    sentAt: recipient.sentAt,
    sendCount: recipient.sendCount,
    reminderCount: recipient.reminderCount,
    opened: Boolean(recipient.openedAt),
    openCount: recipient.openCount,
    openedAt: recipient.openedAt,
    clicked: Boolean(recipient.clickedAt),
    clickCount: recipient.clickCount,
    clickedAt: recipient.clickedAt,
    respondedAt: recipient.respondedAt,
    lastActivityAt: recipient.lastActivityAt,
    lastError: recipient.lastError
  };
}

async function getDistribution(req, res) {
  try {
    const { survey } = await getSurveyForDistribution(req.params.id, req.userId);
    const recipients = await SurveyRecipient.find({ survey: survey._id }).sort({ createdAt: -1 });
    const deliveredCount = null;
    res.json({
      survey: {
        id: survey._id,
        title: survey.title,
        description: survey.description,
        slug: survey.slug || null,
        status: survey.status,
        workspaceName: survey.workspaceId
          ? (await Workspace.findById(survey.workspaceId).select("name"))?.name || "Your workspace"
          : "Your workspace"
      },
      tracking: {
        sentMeans: "Accepted by the configured SMTP server",
        deliveredAvailable: deliveredCount !== null,
        openedReliable: false
      },
      summary: {
        recipients: recipients.length,
        sent: recipients.filter((recipient) => recipient.sentAt).length,
        opened: recipients.filter((recipient) => recipient.openedAt).length,
        clicked: recipients.filter((recipient) => recipient.clickedAt).length,
        responded: recipients.filter((recipient) => recipient.respondedAt).length,
        delivered: deliveredCount
      },
      recipients: recipients.map(recipientDto)
    });
  } catch (error) {
    return responseError(res, error, "Failed to load survey distribution");
  }
}

async function addRecipients(req, res) {
  try {
    const { survey } = await getSurveyForDistribution(req.params.id, req.userId);
    const supplied = Array.isArray(req.body.emails) ? req.body.emails : [req.body.email];
    const normalizedEmails = supplied
      .filter((email) => typeof email === "string")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const emails = [...new Set(normalizedEmails)];
    if (!emails.length) return res.status(400).json({ message: "Add at least one email address." });
    if (emails.length > MAX_RECIPIENTS_PER_REQUEST) {
      return res.status(400).json({ message: `Add no more than ${MAX_RECIPIENTS_PER_REQUEST} addresses at a time.` });
    }
    const invalidEmail = emails.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254);
    if (invalidEmail) return res.status(400).json({ message: `Enter a valid email address: ${invalidEmail}` });

    const existing = await SurveyRecipient.find({ survey: survey._id, email: { $in: emails } }).select("email");
    const existingEmails = new Set(existing.map((recipient) => recipient.email));
    const created = [];
    for (const email of emails) {
      if (existingEmails.has(email)) continue;
      const recipient = new SurveyRecipient({
        survey: survey._id,
        email
      });
      recipient.tokenHash = hashToken(tokenForRecipient(recipient._id));
      await recipient.save();
      created.push(recipientDto(recipient));
    }
    res.status(201).json({
      recipients: created,
      added: created.length,
      duplicates: normalizedEmails.length - created.length
    });
  } catch (error) {
    return responseError(res, error, "Failed to add recipients");
  }
}

async function sendToRecipient(survey, recipient, senderName, reminder) {
  const token = tokenForRecipient(recipient._id);
  recipient.emailStatus = "sending";
  recipient.lastError = "";
  recipient.lastActivityAt = new Date();
  await recipient.save();

  try {
    const trackingApiUrl = emailApiBaseUrl();
    const surveyUrl = `${trackingApiUrl}/distribution/click/${token}`;
    const openPixelUrl = `${trackingApiUrl}/distribution/open/${token}.gif`;
    await sendSurveyInvitation({
      email: recipient.email,
      sender: senderName,
      surveyTitle: reminder ? `Reminder: ${survey.title}` : survey.title,
      description: survey.description,
      surveyUrl,
      openPixelUrl
    });
    recipient.emailStatus = "sent";
    recipient.sentAt = new Date();
    recipient.sendCount += 1;
    if (reminder) recipient.reminderCount += 1;
    recipient.lastActivityAt = recipient.sentAt;
    await recipient.save();
    return { ok: true, recipient: recipientDto(recipient) };
  } catch (error) {
    recipient.emailStatus = "failed";
    recipient.lastError = error.message.slice(0, 500);
    recipient.lastActivityAt = new Date();
    await recipient.save();
    return { ok: false, recipient: recipientDto(recipient), error: recipient.lastError };
  }
}

async function sendDistribution(req, res) {
  try {
    const { survey } = await getSurveyForDistribution(req.params.id, req.userId, true);
    const reminder = req.body.reminder === true;
    const query = { survey: survey._id, respondedAt: null };
    if (reminder) query.sentAt = { $ne: null };
    else query.$or = [{ emailStatus: "pending" }, { emailStatus: "failed" }];

    const recipients = await SurveyRecipient.find(query).sort({ createdAt: 1 }).limit(MAX_SENDS_PER_REQUEST);
    if (!recipients.length) {
      return res.json({
        sent: 0,
        failed: 0,
        message: reminder ? "There are no sent invitations awaiting a response." : "There are no pending invitations to send."
      });
    }
    const user = await require("../models/User").findById(req.userId).select("name");
    const workspace = survey.workspaceId ? await Workspace.findById(survey.workspaceId).select("name") : null;
    const senderName = workspace?.name || user?.name || "Your survey team";

    const results = [];
    for (const recipient of recipients) {
      results.push(await sendToRecipient(survey, recipient, senderName, reminder));
    }
    res.json({
      sent: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results: results.map((result) => result.ok
        ? { ...result.recipient, error: "" }
        : { ...result.recipient, error: result.error })
    });
  } catch (error) {
    return responseError(res, error, "Failed to send survey invitations");
  }
}

async function sendOne(req, res) {
  try {
    const { survey } = await getSurveyForDistribution(req.params.id, req.userId, true);
    if (!mongoose.isValidObjectId(req.params.recipientId)) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    const recipient = await SurveyRecipient.findOne({ _id: req.params.recipientId, survey: survey._id });
    if (!recipient) return res.status(404).json({ message: "Recipient not found" });
    if (recipient.respondedAt) return res.status(409).json({ message: "This recipient has already responded." });
    const reminder = req.body.reminder === true;
    if (reminder && !recipient.sentAt) {
      return res.status(409).json({ message: "A reminder can only be sent after the initial invitation." });
    }
    const user = await require("../models/User").findById(req.userId).select("name");
    const workspace = survey.workspaceId ? await Workspace.findById(survey.workspaceId).select("name") : null;
    const result = await sendToRecipient(survey, recipient, workspace?.name || user?.name || "Your survey team", reminder);
    if (!result.ok) return res.status(502).json({ message: result.error, recipient: result.recipient });
    res.json({ recipient: result.recipient });
  } catch (error) {
    return responseError(res, error, "Failed to retry invitation");
  }
}

async function trackOpen(req, res) {
  try {
    const recipient = await SurveyRecipient.findOne({ tokenHash: hashToken(req.params.token) }).select("+tokenHash");
    if (recipient) {
      const now = new Date();
      recipient.openCount += 1;
      recipient.openedAt ||= now;
      recipient.lastActivityAt = now;
      await recipient.save();
    }
  } catch (error) {
    console.error("Unable to record invitation open", error.message);
  }
  res.set({
    "Content-Type": "image/gif",
    "Content-Length": TRACKING_PIXEL.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache"
  });
  res.status(200).send(TRACKING_PIXEL);
}

async function trackClick(req, res) {
  try {
    const recipient = await SurveyRecipient.findOne({ tokenHash: hashToken(req.params.token) }).select("+tokenHash");
    if (!recipient) return res.status(404).send("Invitation link is not available.");
    const survey = await Survey.findById(recipient.survey).select("slug status");
    if (!survey || !survey.slug || survey.status !== "published") {
      return res.status(404).send("Survey is not available.");
    }
    const now = new Date();
    recipient.clickCount += 1;
    recipient.clickedAt ||= now;
    recipient.lastActivityAt = now;
    await recipient.save();
    res.redirect(302, `${publicBaseUrl()}/survey/${encodeURIComponent(survey.slug)}?distribution=${encodeURIComponent(req.params.token)}`);
  } catch (error) {
    return responseError(res, error, "Failed to open survey invitation");
  }
}

module.exports = {
  getDistribution,
  addRecipients,
  sendDistribution,
  sendOne,
  trackOpen,
  trackClick
};
