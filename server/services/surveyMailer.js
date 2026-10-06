const nodemailer = require("nodemailer");

let testTransport = null;

function getTransport() {
  if (testTransport) return testTransport;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass) {
    const error = new Error("Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass }
  });
}

function configureTransportForTests(transport) {
  testTransport = transport;
}

async function sendSurveyInvitation({ email, sender, surveyTitle, description, surveyUrl, openPixelUrl }) {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    const error = new Error("Email is not configured. Set EMAIL_FROM.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const safe = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
  const safeTitle = safe(surveyTitle);
  const safeDescription = safe(description);
  const safeSender = safe(sender);

  const result = await getTransport().sendMail({
    from,
    to: email,
    subject: `${surveyTitle} — survey invitation`,
    text: [
      `Hello,`,
      ``,
      `${sender} invited you to take "${surveyTitle}".`,
      description || "",
      ``,
      `Complete the survey: ${surveyUrl}`,
      ``,
      `If you did not expect this invitation, you can ignore this email.`
    ].filter(Boolean).join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:Arial,sans-serif;color:#25283a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e8e9ef;border-radius:14px;padding:32px"><tr><td><p style="margin:0 0 8px;color:#6b60d8;font-size:12px;font-weight:bold">${safeSender}</p><h1 style="font-size:24px;margin:0 0 12px">${safeTitle}</h1><p style="font-size:15px;line-height:1.6;color:#626579;margin:0 0 24px">${safeDescription || "We would value your feedback."}</p><p style="margin:0 0 24px"><a href="${safe(surveyUrl)}" style="display:inline-block;background:#665bd9;color:#fff;text-decoration:none;font-weight:bold;padding:13px 21px;border-radius:8px">Take the survey</a></p><p style="font-size:12px;line-height:1.5;color:#87899a">If the button does not work, copy this link into your browser:<br><a href="${safe(surveyUrl)}" style="color:#665bd9;word-break:break-all">${safe(surveyUrl)}</a></p><p style="border-top:1px solid #eeeef3;margin:24px 0 0;padding-top:16px;font-size:11px;color:#999aaa">You received this invitation from ${safeSender}. If you did not expect it, you can ignore this email.</p></td></tr></table></td></tr></table><img src="${safe(openPixelUrl)}" width="1" height="1" alt="" style="display:none" /></body></html>`
  });
  return result.messageId;
}

module.exports = { sendSurveyInvitation, configureTransportForTests };
