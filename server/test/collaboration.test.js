const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/User");
const Survey = require("../models/Survey");
const Response = require("../models/Response");

process.env.JWT_SECRET = process.env.JWT_SECRET || "collaboration-test-secret";
const app = require("../app");

let mongo;
let server;
let baseUrl;

test.before(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { version: "8.2.6" },
    instance: { storageEngine: "wiredTiger" }
  });
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

async function request(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, data };
}

test("workspace roles enforce survey, response, invite, and settings permissions", async () => {
  const [owner, editor, viewer, unauthorized] = await User.create([
    { name: "Owner User", email: "owner@example.com", password: "hashed-password" },
    { name: "Editor User", email: "editor@example.com", password: "hashed-password" },
    { name: "Viewer User", email: "viewer@example.com", password: "hashed-password" },
    { name: "Outside User", email: "outside@example.com", password: "hashed-password" }
  ]);
  const ownerToken = tokenFor(owner);
  const editorToken = tokenFor(editor);
  const viewerToken = tokenFor(viewer);
  const outsiderToken = tokenFor(unauthorized);

  const legacySurvey = await Survey.create({ title: "Existing survey", createdBy: owner._id });
  const defaultWorkspaces = await request("GET", "/api/workspaces", ownerToken);
  assert.equal(defaultWorkspaces.status, 200);
  assert.equal(defaultWorkspaces.data.workspaces.length, 1);
  assert.equal((await Survey.findById(legacySurvey._id)).workspaceId.toString(), defaultWorkspaces.data.workspaces[0].id.toString());
  assert.equal((await request("GET", `/api/surveys/${legacySurvey._id}`, ownerToken)).status, 200);

  const createdWorkspace = await request("POST", "/api/workspaces", ownerToken, { name: "Research Team" });
  assert.equal(createdWorkspace.status, 201);
  const workspaceId = createdWorkspace.data.workspace.id;
  const editorInvite = await request("POST", `/api/workspaces/${workspaceId}/invitations`, ownerToken, {
    email: editor.email,
    role: "EDITOR"
  });
  const viewerInvite = await request("POST", `/api/workspaces/${workspaceId}/invitations`, ownerToken, {
    email: viewer.email,
    role: "VIEWER"
  });
  assert.equal(editorInvite.status, 201);
  assert.equal(viewerInvite.status, 201);

  for (const [invite, auth] of [[editorInvite, editorToken], [viewerInvite, viewerToken]]) {
    const token = invite.data.invitation.invitationPath.split("/").pop();
    const accepted = await request("POST", `/api/invitations/${token}/accept`, auth);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.workspaceId, workspaceId);
  }
  const wrongAccountAccept = await request(
    "POST",
    `/api/invitations/${editorInvite.data.invitation.invitationPath.split("/").pop()}/accept`,
    viewerToken
  );
  assert.equal(wrongAccountAccept.status, 409);
  const expiredInvite = await request("POST", `/api/workspaces/${workspaceId}/invitations`, ownerToken, {
    email: unauthorized.email,
    role: "VIEWER"
  });
  const Invitation = require("../models/Invitation");
  const expiredToken = expiredInvite.data.invitation.invitationPath.split("/").pop();
  assert.equal((await request("POST", `/api/invitations/${expiredToken}/accept`, viewerToken)).status, 403);
  await Invitation.updateOne({ _id: expiredInvite.data.invitation.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await request("GET", `/api/invitations/${expiredToken}`)).data.invitation.status, "expired");
  assert.equal((await request("POST", `/api/invitations/${expiredToken}/accept`, outsiderToken)).status, 410);

  const createdSurvey = await request("POST", "/api/surveys", ownerToken, {
    title: "Shared survey",
    workspaceId,
    questions: [{ type: "short-answer", questionText: "Feedback", order: 0 }]
  });
  assert.equal(createdSurvey.status, 201);
  const surveyId = createdSurvey.data.survey._id;
  const editorCreate = await request("POST", "/api/surveys", editorToken, { title: "Editor survey", workspaceId });
  const viewerCreate = await request("POST", "/api/surveys", viewerToken, { title: "Viewer survey", workspaceId });
  assert.equal(editorCreate.status, 201);
  assert.equal(viewerCreate.status, 403);
  assert.equal((await request("POST", "/api/surveys", outsiderToken, { title: "Outside survey", workspaceId })).status, 404);

  for (const auth of [ownerToken, editorToken, viewerToken]) {
    assert.equal((await request("GET", `/api/surveys/${surveyId}`, auth)).status, 200);
    assert.equal((await request("GET", `/api/surveys/${surveyId}/analytics`, auth)).status, 200);
    assert.equal((await request("GET", `/api/surveys/${surveyId}/responses`, auth)).status, 200);
  }
  assert.equal((await request("GET", `/api/surveys/${surveyId}`, outsiderToken)).status, 404);
  assert.equal((await request("GET", `/api/surveys/${surveyId}/analytics`, outsiderToken)).status, 404);
  assert.equal((await request("GET", `/api/surveys/${surveyId}/responses`, outsiderToken)).status, 404);
  assert.equal((await request("GET", `/api/surveys/${surveyId}`, null)).status, 401);

  const ownerEdit = await request("PUT", `/api/surveys/${surveyId}`, ownerToken, { title: "Owner edit" });
  const editorEdit = await request("PUT", `/api/surveys/${surveyId}`, editorToken, { title: "Editor edit" });
  const viewerEdit = await request("PUT", `/api/surveys/${surveyId}`, viewerToken, { title: "Viewer edit" });
  const outsiderEdit = await request("PUT", `/api/surveys/${surveyId}`, outsiderToken, { title: "Unauthorized edit" });
  assert.equal(ownerEdit.status, 200);
  assert.equal(editorEdit.status, 200);
  assert.equal(viewerEdit.status, 403);
  assert.equal(outsiderEdit.status, 404);

  const editorDelete = await request("DELETE", `/api/surveys/${surveyId}`, editorToken);
  const viewerDelete = await request("DELETE", `/api/surveys/${surveyId}`, viewerToken);
  assert.equal(editorDelete.status, 403);
  assert.equal(viewerDelete.status, 403);
  assert.equal((await request("DELETE", `/api/surveys/${surveyId}`, outsiderToken)).status, 404);

  const editorInviteBlocked = await request("POST", `/api/workspaces/${workspaceId}/invitations`, editorToken, {
    email: "another@example.com",
    role: "VIEWER"
  });
  assert.equal(editorInviteBlocked.status, 403);
  assert.equal((await request("PATCH", `/api/workspaces/${workspaceId}`, ownerToken, { name: "Renamed team" })).status, 200);
  assert.equal((await request("PATCH", `/api/workspaces/${workspaceId}`, editorToken, { name: "Not allowed" })).status, 403);
  assert.equal((await request("PATCH", `/api/workspaces/${workspaceId}`, viewerToken, { name: "Not allowed" })).status, 403);
  assert.equal((await request("PATCH", `/api/workspaces/${workspaceId}`, outsiderToken, { name: "Not allowed" })).status, 404);
  assert.equal((await request("GET", `/api/workspaces/${workspaceId}`, viewerToken)).status, 200);
  assert.equal((await request("GET", `/api/workspaces/${workspaceId}`, outsiderToken)).status, 404);
  assert.equal((await request("PATCH", `/api/workspaces/${workspaceId}/members/${owner._id}`, ownerToken, { role: "VIEWER" })).status, 404);
  assert.equal((await request("DELETE", `/api/workspaces/${workspaceId}/members/${owner._id}`, ownerToken)).status, 404);
  assert.equal((await request("PATCH", `/api/workspaces/${workspaceId}/members/${editor._id}`, ownerToken, { role: "VIEWER" })).status, 200);
  assert.equal((await request("PUT", `/api/surveys/${surveyId}`, editorToken, { title: "Role downgraded" })).status, 403);
  assert.equal((await request("PATCH", `/api/workspaces/${workspaceId}/members/${editor._id}`, ownerToken, { role: "EDITOR" })).status, 200);

  const permissions = await request("GET", `/api/surveys/${surveyId}/permissions`, ownerToken);
  assert.equal(permissions.status, 200);
  assert.equal((await request("PUT", `/api/surveys/${surveyId}/permissions/${viewer._id}`, ownerToken, { role: "EDITOR" })).status, 200);
  assert.equal((await request("PUT", `/api/surveys/${surveyId}/permissions/${viewer._id}`, editorToken, { role: "VIEWER" })).status, 403);
  assert.equal((await request("PUT", `/api/surveys/${surveyId}/permissions/${owner._id}`, ownerToken, { role: "VIEWER" })).status, 400);
  assert.equal((await request("PUT", `/api/surveys/${surveyId}/permissions/${unauthorized._id}`, ownerToken, { role: "VIEWER" })).status, 400);
  assert.equal((await request("PUT", `/api/surveys/${surveyId}/permissions/${editor._id}`, outsiderToken, { role: "VIEWER" })).status, 404);
  assert.equal((await request("PUT", `/api/surveys/${surveyId}`, viewerToken, { title: "Survey-specific editor" })).status, 200);
  assert.equal((await request("DELETE", `/api/workspaces/${workspaceId}/members/${editor._id}`, ownerToken)).status, 200);
  assert.equal((await request("GET", `/api/surveys/${surveyId}`, editorToken)).status, 404);
  assert.equal((await request("GET", `/api/surveys/${editorCreate.data.survey._id}`, editorToken)).status, 404);

  const removableSurvey = await request("POST", "/api/surveys", ownerToken, {
    title: "Owner deletion test",
    workspaceId
  });
  assert.equal(removableSurvey.status, 201);
  assert.equal((await request("DELETE", `/api/surveys/${removableSurvey.data.survey._id}`, ownerToken)).status, 200);
  assert.equal((await request("GET", `/api/surveys/${removableSurvey.data.survey._id}`, ownerToken)).status, 404);

  const workspaceMembers = await request("GET", `/api/workspaces/${workspaceId}`, ownerToken);
  assert.equal(workspaceMembers.status, 200);
  assert.equal(workspaceMembers.data.workspace.memberCount, 2);
  assert.ok(workspaceMembers.data.workspace.invitations.some((invite) => invite.status === "accepted"));
  assert.ok(workspaceMembers.data.workspace.invitations.some((invite) => invite.status === "expired"));
});

test("conditional branching validates destinations and records skipped and not-reached questions", async () => {
  const owner = await User.create({
    name: "Branch Owner",
    email: "branch-owner@example.com",
    password: "hashed-password"
  });
  const ownerToken = tokenFor(owner);
  const created = await request("POST", "/api/surveys", ownerToken, {
    title: "Branching scenarios",
    questions: [
      { type: "yes-no", questionText: "Do you use our product?", order: 0 },
      { type: "short-answer", questionText: "What do you use?", order: 1 },
      { type: "number", questionText: "How many days have you used it?", order: 2 },
      { type: "short-answer", questionText: "What should we improve?", order: 3 },
      { type: "short-answer", questionText: "Anything else?", order: 4 }
    ]
  });
  assert.equal(created.status, 201);
  const surveyId = created.data.survey._id;
  const [useQuestion, followupQuestion, ratingQuestion, improvementQuestion, finalQuestion] = created.data.survey.questions;
  const useId = useQuestion._id;
  const followupId = followupQuestion._id;
  const ratingId = ratingQuestion._id;
  const improvementId = improvementQuestion._id;
  const finalId = finalQuestion._id;

  const rules = [
    {
      sourceQuestionId: useId,
      match: "all",
      conditions: [{ questionId: useId, operator: "equals", value: "No" }],
      action: "goto",
      destinationQuestionId: ratingId,
      order: 0
    },
    {
      sourceQuestionId: ratingId,
      match: "all",
      conditions: [
        { questionId: useId, operator: "equals", value: "Yes" },
        { questionId: ratingId, operator: "greaterThan", value: 5 }
      ],
      action: "end",
      destinationQuestionId: null,
      order: 0
    },
    {
      sourceQuestionId: ratingId,
      match: "any",
      conditions: [
        { questionId: useId, operator: "equals", value: "No" },
        { questionId: ratingId, operator: "greaterThan", value: 5 }
      ],
      action: "goto",
      destinationQuestionId: finalId,
      order: 1
    },
    {
      sourceQuestionId: ratingId,
      match: "all",
      conditions: [
        { questionId: useId, operator: "notEquals", value: "No" },
        { questionId: ratingId, operator: "lessThan", value: 2 }
      ],
      action: "end",
      destinationQuestionId: null,
      order: 2
    },
    {
      sourceQuestionId: improvementId,
      match: "all",
      conditions: [{ questionId: improvementId, operator: "contains", value: "docs" }],
      action: "end",
      destinationQuestionId: null,
      order: 0
    }
  ];
  const invalidSelfRoute = await request("PUT", `/api/surveys/${surveyId}`, ownerToken, {
    logicRules: [{ ...rules[0], destinationQuestionId: useId }]
  });
  assert.equal(invalidSelfRoute.status, 400);
  assert.match(invalidSelfRoute.data.message, /destination must come after/i);
  const invalidReference = await request("PUT", `/api/surveys/${surveyId}`, ownerToken, {
    logicRules: [{ ...rules[0], conditions: [{ ...rules[0].conditions[0], questionId: "507f1f77bcf86cd799439011" }] }]
  });
  assert.equal(invalidReference.status, 400);
  assert.match(invalidReference.data.message, /referenced question no longer exists/i);
  const invalidDestination = await request("PUT", `/api/surveys/${surveyId}`, ownerToken, {
    logicRules: [{ ...rules[0], destinationQuestionId: "507f1f77bcf86cd799439011" }]
  });
  assert.equal(invalidDestination.status, 400);
  assert.match(invalidDestination.data.message, /destination question no longer exists/i);
  const circularRoute = await request("PUT", `/api/surveys/${surveyId}`, ownerToken, {
    logicRules: [
      rules[0],
      {
        sourceQuestionId: ratingId,
        match: "all",
        conditions: [{ questionId: ratingId, operator: "greaterThan", value: 5 }],
        action: "goto",
        destinationQuestionId: useId,
        order: 0
      }
    ]
  });
  assert.equal(circularRoute.status, 400);
  assert.match(circularRoute.data.message, /destination must come after/i);

  assert.equal((await request("PUT", `/api/surveys/${surveyId}`, ownerToken, { logicRules: rules })).status, 200);
  assert.equal((await request("PATCH", `/api/surveys/${surveyId}/publish`, ownerToken)).status, 200);

  async function submitScenario(answers) {
    const started = await request("POST", "/api/responses/start", null, { surveyId });
    assert.equal(started.status, 201);
    return request("POST", `/api/responses/${started.data.responseId}/submit`, null, { answers });
  }

  const noProductRoute = await submitScenario([
    { questionId: useId, value: "No" },
    { questionId: ratingId, value: 2 },
    { questionId: finalId, value: "Focus on onboarding" }
  ]);
  assert.equal(noProductRoute.status, 200);
  assert.deepEqual(noProductRoute.data.response.skippedQuestionIds, [followupId, improvementId]);
  assert.deepEqual(noProductRoute.data.response.notReachedQuestionIds, []);
  assert.deepEqual(noProductRoute.data.response.reachedQuestionIds, [useId, ratingId, finalId]);
  assert.equal(noProductRoute.data.response.answers.some((answer) => answer.questionId === followupId), false);

  const allConditionsTrue = await submitScenario([
    { questionId: useId, value: "Yes" },
    { questionId: followupId, value: "Mobile app" },
    { questionId: ratingId, value: 6 }
  ]);
  assert.equal(allConditionsTrue.status, 200);
  assert.deepEqual(allConditionsTrue.data.response.skippedQuestionIds, []);
  assert.deepEqual(allConditionsTrue.data.response.notReachedQuestionIds, [improvementId, finalId]);

  const noRuleMatches = await submitScenario([
    { questionId: useId, value: "Yes" },
    { questionId: followupId, value: "Mobile app" },
    { questionId: ratingId, value: 3 },
    { questionId: improvementId, value: "More templates" },
    { questionId: finalId, value: "No further notes" }
  ]);
  assert.deepEqual(noRuleMatches.data.response.reachedQuestionIds, [useId, followupId, ratingId, improvementId, finalId]);
  assert.deepEqual(noRuleMatches.data.response.skippedQuestionIds, []);
  assert.deepEqual(noRuleMatches.data.response.notReachedQuestionIds, []);

  const lessThanAndNotEquals = await submitScenario([
    { questionId: useId, value: "Yes" },
    { questionId: followupId, value: "Mobile app" },
    { questionId: ratingId, value: 1 }
  ]);
  assert.deepEqual(lessThanAndNotEquals.data.response.notReachedQuestionIds, [improvementId, finalId]);

  const containsRule = await submitScenario([
    { questionId: useId, value: "Yes" },
    { questionId: followupId, value: "Mobile app" },
    { questionId: ratingId, value: 3 },
    { questionId: improvementId, value: "Need better docs" }
  ]);
  assert.deepEqual(containsRule.data.response.notReachedQuestionIds, [finalId]);

  const analytics = await request("GET", `/api/surveys/${surveyId}/analytics`, ownerToken);
  assert.equal(analytics.status, 200);
  const improvementStats = analytics.data.perQuestion.find((question) => question.questionId === improvementId);
  assert.equal(improvementStats.skippedCount, 1);
  assert.equal(improvementStats.notReachedCount, 2);
  assert.equal(improvementStats.unansweredCount, 0);
  const numberStats = analytics.data.perQuestion.find((question) => question.questionId === ratingId);
  assert.equal(numberStats.numericAverage, 3);
  const responseList = await request("GET", `/api/surveys/${surveyId}/responses`, ownerToken);
  assert.equal(responseList.status, 200);
  const skippedAnswer = responseList.data.responses
    .flatMap((response) => response.answers)
    .find((answer) => answer.questionId === followupId && answer.status === "skipped");
  assert.ok(skippedAnswer);

  const noLogicSurvey = await request("POST", "/api/surveys", ownerToken, {
    title: "No branching",
    questions: [{ type: "short-answer", questionText: "Feedback", order: 0 }]
  });
  assert.equal(noLogicSurvey.status, 201);
  assert.equal((await request("PATCH", `/api/surveys/${noLogicSurvey.data.survey._id}/publish`, ownerToken)).status, 200);
  const noLogicStart = await request("POST", "/api/responses/start", null, { surveyId: noLogicSurvey.data.survey._id });
  const noLogicSubmit = await request("POST", `/api/responses/${noLogicStart.data.responseId}/submit`, null, {
    answers: [{ questionId: noLogicSurvey.data.survey.questions[0]._id, value: "Works as before" }]
  });
  assert.deepEqual(noLogicSubmit.data.response.skippedQuestionIds, []);
  assert.deepEqual(noLogicSubmit.data.response.notReachedQuestionIds, []);
  assert.deepEqual(noLogicSubmit.data.response.reachedQuestionIds, [noLogicSurvey.data.survey.questions[0]._id]);
});

test("NPS answers validate and calculate analytics independently for each NPS question", async () => {
  const owner = await User.create({
    name: "NPS Owner",
    email: "nps-owner@example.com",
    password: "hashed-password"
  });
  const ownerToken = tokenFor(owner);
  const created = await request("POST", "/api/surveys", ownerToken, {
    title: "NPS survey",
    questions: [
      {
        type: "nps",
        questionText: "Recommend us?",
        description: "Think about your overall experience.",
        required: true,
        order: 0
      },
      { type: "nps", questionText: "Recommend support?", required: false, order: 1 }
    ]
  });
  assert.equal(created.status, 201);
  const surveyId = created.data.survey._id;
  const [recommendQuestion, supportQuestion] = created.data.survey.questions;
  assert.equal(recommendQuestion.description, "Think about your overall experience.");
  assert.equal((await request("PATCH", `/api/surveys/${surveyId}/publish`, ownerToken)).status, 200);

  async function submit(answers, targetSurveyId = surveyId) {
    const started = await request("POST", "/api/responses/start", null, { surveyId: targetSurveyId });
    assert.equal(started.status, 201);
    return request("POST", `/api/responses/${started.data.responseId}/submit`, null, { answers });
  }

  const missingRequired = await submit([]);
  assert.equal(missingRequired.status, 400);
  assert.match(missingRequired.data.message, /Recommend us.*required/);

  for (const invalidScore of [-1, 11, 4.5, "5"]) {
    const invalid = await submit([{ questionId: recommendQuestion._id, value: invalidScore }]);
    assert.equal(invalid.status, 400);
    assert.match(invalid.data.message, /whole number from 0 to 10/);
  }

  const samples = [
    [10, 0],
    [8, 4],
    [6, null],
    [9, 10]
  ];
  for (const [recommend, support] of samples) {
    const answers = [{ questionId: recommendQuestion._id, value: recommend }];
    if (support !== null) answers.push({ questionId: supportQuestion._id, value: support });
    const submitted = await submit(answers);
    assert.equal(submitted.status, 200);
  }

  const analytics = await request("GET", `/api/surveys/${surveyId}/analytics`, ownerToken);
  assert.equal(analytics.status, 200);
  const recommendStats = analytics.data.perQuestion.find((question) => question.questionId === recommendQuestion._id);
  assert.deepEqual(recommendStats.nps, {
    score: 25,
    promoters: 2,
    passives: 1,
    detractors: 1,
    totalResponses: 4,
    promoterPercentage: 50,
    passivePercentage: 25,
    detractorPercentage: 25,
    distribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 0, 8: 1, 9: 1, 10: 1 }
  });
  const supportStats = analytics.data.perQuestion.find((question) => question.questionId === supportQuestion._id);
  assert.equal(supportStats.nps.score, -33);
  assert.equal(supportStats.nps.promoters, 1);
  assert.equal(supportStats.nps.passives, 0);
  assert.equal(supportStats.nps.detractors, 2);
  assert.equal(supportStats.nps.totalResponses, 3);
  assert.equal(supportStats.unansweredCount, 1);

  const emptySurvey = await request("POST", "/api/surveys", ownerToken, {
    title: "Empty NPS",
    questions: [{ type: "nps", questionText: "Recommend?", required: false, order: 0 }]
  });
  const emptyId = emptySurvey.data.survey._id;
  await request("PATCH", `/api/surveys/${emptyId}/publish`, ownerToken);
  const emptyStart = await request("POST", "/api/responses/start", null, { surveyId: emptyId });
  assert.equal(emptyStart.status, 201);
  assert.equal((await request("POST", `/api/responses/${emptyStart.data.responseId}/submit`, null, { answers: [] })).status, 200);
  const emptyAnalytics = await request("GET", `/api/surveys/${emptyId}/analytics`, ownerToken);
  assert.equal(emptyAnalytics.data.perQuestion[0].nps.score, null);
  assert.equal(emptyAnalytics.data.perQuestion[0].nps.totalResponses, 0);
});

test("email distribution protects recipients and tracks SMTP sends, clicks, responses, retries and reminders", async () => {
  const { configureTransportForTests } = require("../services/surveyMailer");
  const SurveyPermission = require("../models/SurveyPermission");
  const SurveyRecipient = require("../models/SurveyRecipient");
  const owner = await User.create({
    name: "Mail Owner",
    email: "mail-owner@example.test",
    password: "hashed-password"
  });
  const viewer = await User.create({
    name: "Mail Viewer",
    email: "mail-viewer@example.test",
    password: "hashed-password"
  });
  const outsider = await User.create({
    name: "Mail Outsider",
    email: "mail-outsider@example.test",
    password: "hashed-password"
  });
  const ownerToken = tokenFor(owner);
  const viewerToken = tokenFor(viewer);
  const outsiderToken = tokenFor(outsider);
  const survey = await Survey.create({
    title: "Product research",
    description: "Help us improve <the product>.",
    status: "published",
    slug: "distribution-test",
    createdBy: owner._id,
    questions: [{ type: "short-answer", questionText: "Any feedback?", order: 0 }]
  });
  await SurveyPermission.create({ survey: survey._id, user: viewer._id, role: "VIEWER", grantedBy: owner._id });

  process.env.APP_BASE_URL = "https://surveys.example.test";
  process.env.EMAIL_PUBLIC_API_URL = "https://api.example.test/api";
  process.env.EMAIL_FROM = "Surveys <surveys@example.test>";
  process.env.SMTP_HOST = "smtp.example.test";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "development-user";
  process.env.SMTP_PASS = "development-password";
  process.env.DISTRIBUTION_TOKEN_SECRET = "distribution-integration-test-secret";
  let rejectFailureAddress = true;
  const sentMessages = [];
  configureTransportForTests({
    async sendMail(message) {
      sentMessages.push(message);
      if (rejectFailureAddress && message.to === "dev+fail@example.test") {
        throw new Error("Development SMTP rejected this address");
      }
      return { messageId: `test-${sentMessages.length}` };
    }
  });

  test("versioned API keys are workspace-scoped, hashed, permission-limited, tracked and revocable", async () => {
    const crypto = require("crypto");
    const ApiKey = require("../models/ApiKey");
    const WorkspaceMember = require("../models/WorkspaceMember");
    const [owner, editor, viewer, outsider] = await User.create([
      { name: "Developer Owner", email: "developer-owner@example.test", password: "hashed-password" },
      { name: "Developer Editor", email: "developer-editor@example.test", password: "hashed-password" },
      { name: "Developer Viewer", email: "developer-viewer@example.test", password: "hashed-password" },
      { name: "Developer Outsider", email: "developer-outsider@example.test", password: "hashed-password" }
    ]);
    const ownerToken = tokenFor(owner);
    const editorToken = tokenFor(editor);
    const viewerToken = tokenFor(viewer);
    const outsiderToken = tokenFor(outsider);
    const workspaceResult = await request("POST", "/api/workspaces", ownerToken, { name: "API Research" });
    assert.equal(workspaceResult.status, 201);
    const workspaceId = workspaceResult.data.workspace.id;
    await WorkspaceMember.create([
      { workspace: workspaceId, user: editor._id, role: "EDITOR", addedBy: owner._id },
      { workspace: workspaceId, user: viewer._id, role: "VIEWER", addedBy: owner._id }
    ]);
    const secondWorkspaceResult = await request("POST", "/api/workspaces", ownerToken, { name: "Other Workspace" });
    const secondWorkspaceId = secondWorkspaceResult.data.workspace.id;

    const surveyResult = await request("POST", "/api/surveys", ownerToken, {
      title: "API customer survey",
      description: "Integration-safe survey data",
      workspaceId,
      questions: [{ type: "short-answer", questionText: "What should we improve?", order: 0 }]
    });
    assert.equal(surveyResult.status, 201);
    const surveyId = surveyResult.data.survey._id;
    await request("PATCH", `/api/surveys/${surveyId}/publish`, ownerToken);
    const outsideSurveyResult = await request("POST", "/api/surveys", ownerToken, {
      title: "Outside workspace survey",
      workspaceId: secondWorkspaceId,
      questions: [{ type: "short-answer", questionText: "Outside?", order: 0 }]
    });
    assert.equal(outsideSurveyResult.status, 201);
    const outsideSurveyId = outsideSurveyResult.data.survey._id;

    const responseStart = await request("POST", "/api/responses/start", null, { surveyId });
    assert.equal(responseStart.status, 201);
    assert.equal((await request("POST", `/api/responses/${responseStart.data.responseId}/submit`, null, {
      answers: [{ questionId: surveyResult.data.survey.questions[0]._id, value: "More integrations" }]
    })).status, 200);

    const managementPath = `/api/developer/workspaces/${workspaceId}`;
    const deniedCreate = await request("POST", `${managementPath}/keys`, viewerToken, {
      name: "Viewer key",
      scopes: ["READ_SURVEYS"]
    });
    assert.equal(deniedCreate.status, 403);
    const invalidScope = await request("POST", `${managementPath}/keys`, ownerToken, {
      name: "Invalid key",
      scopes: ["DELETE_SURVEYS"]
    });
    assert.equal(invalidScope.status, 400);

    const readOnlyKeyResult = await request("POST", `${managementPath}/keys`, ownerToken, {
      name: "Survey list integration",
      scopes: ["READ_SURVEYS"]
    });
    assert.equal(readOnlyKeyResult.status, 201);
    const readOnlyKey = readOnlyKeyResult.data.apiKey;
    assert.match(readOnlyKey, /^sb_live_[a-f0-9]{64}$/);
    const readOnlyRecord = await ApiKey.findById(readOnlyKeyResult.data.key.id).select("+keyHash +keyPrefix");
    assert.equal(readOnlyRecord.keyHash, crypto.createHash("sha256").update(readOnlyKey).digest("hex"));
    assert.notEqual(readOnlyRecord.keyHash, readOnlyKey);
    assert.equal(readOnlyRecord.keyPrefix, readOnlyKey.slice(0, 24));
    const visibleKeys = await request("GET", `${managementPath}/keys`, ownerToken);
    assert.equal("apiKey" in visibleKeys.data.keys[0], false);
    assert.equal("keyHash" in visibleKeys.data.keys[0], false);

    async function publicRequest(path, key = readOnlyKey) {
      const response = await fetch(`${baseUrl}/api/v1${path}`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {}
      });
      return { status: response.status, data: await response.json() };
    }

    assert.equal((await publicRequest("/surveys", null)).status, 401);
    assert.equal((await publicRequest("/surveys", "sb_live_invalid")).data.error.code, "UNAUTHENTICATED");
    assert.equal((await publicRequest("/not-an-endpoint")).data.error.code, "NOT_FOUND");
    const malformedResponse = await fetch(`${baseUrl}/api/v1/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });
    assert.equal(malformedResponse.status, 400);
    assert.equal((await malformedResponse.json()).error.code, "INVALID_REQUEST");
    const surveyList = await publicRequest("/surveys?page=1&limit=10");
    assert.equal(surveyList.status, 200);
    assert.equal(surveyList.data.success, true);
    assert.equal(surveyList.data.error, null);
    assert.equal(surveyList.data.data.surveys.length, 1);
    assert.equal(surveyList.data.data.surveys[0].id, surveyId);
    assert.equal((await publicRequest("/surveys?page=0")).status, 400);
    assert.equal((await publicRequest("/surveys/not-an-object-id")).data.error.code, "INVALID_SURVEY_ID");
    const detail = await publicRequest(`/surveys/${surveyId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.data.survey.questions[0].questionText, "What should we improve?");
    assert.equal("createdBy" in detail.data.data.survey, false);
    assert.equal("workspaceId" in detail.data.data.survey, false);
    assert.equal("insightsCache" in detail.data.data.survey, false);
    assert.equal((await publicRequest(`/surveys/${outsideSurveyId}`)).status, 404);
    assert.equal((await publicRequest(`/surveys/${surveyId}/responses`)).status, 403);

    const fullKeyResult = await request("POST", `${managementPath}/keys`, editorToken, {
      name: "Response export integration",
      scopes: ["READ_SURVEYS", "READ_RESPONSES"]
    });
    assert.equal(fullKeyResult.status, 201);
    const fullKey = fullKeyResult.data.apiKey;
    const responses = await publicRequest(`/surveys/${surveyId}/responses?limit=5`, fullKey);
    assert.equal(responses.status, 200);
    assert.equal(responses.data.data.responses.length, 1);
    assert.equal(responses.data.data.responses[0].answers[0].value, "More integrations");
    assert.equal("distributionRecipient" in responses.data.data.responses[0], false);
    assert.equal((await publicRequest(`/surveys/${outsideSurveyId}/responses`, fullKey)).status, 404);

    const listForViewer = await request("GET", `${managementPath}/keys`, viewerToken);
    assert.equal(listForViewer.status, 200);
    assert.equal(listForViewer.data.keys.length, 2);
    assert.equal(listForViewer.data.keys.some((key) => key.apiKey), false);
    const usage = await request("GET", `${managementPath}/usage`, ownerToken);
    assert.equal(usage.status, 200);
    assert.equal(usage.data.usage.activeKeys, 2);
    assert.ok(usage.data.usage.requests >= 4);

    const editorKeyId = fullKeyResult.data.key.id;
    assert.equal((await request("DELETE", `${managementPath}/keys/${readOnlyKeyResult.data.key.id}`, editorToken)).status, 403);
    assert.equal((await request("DELETE", `${managementPath}/keys/${readOnlyKeyResult.data.key.id}`, viewerToken)).status, 403);
    await WorkspaceMember.deleteOne({ workspace: workspaceId, user: editor._id });
    const removedMemberKey = await publicRequest("/surveys", fullKey);
    assert.equal(removedMemberKey.status, 403);
    assert.equal(removedMemberKey.data.error.code, "FORBIDDEN");

    const revoke = await request("DELETE", `${managementPath}/keys/${readOnlyKeyResult.data.key.id}`, ownerToken);
    assert.equal(revoke.status, 200);
    assert.equal(revoke.data.key.status, "revoked");
    assert.equal((await publicRequest("/surveys", readOnlyKey)).status, 401);
    assert.equal((await request("DELETE", `${managementPath}/keys/${editorKeyId}`, outsiderToken)).status, 404);
  });

  test("email distribution tracks sends, clicks, responses, retries and reminders", async () => {
  const surveyId = survey._id.toString();
  assert.equal((await request("GET", `/api/surveys/${surveyId}/distribution`, viewerToken)).status, 403);
  assert.equal((await request("GET", `/api/surveys/${surveyId}/distribution`, outsiderToken)).status, 404);
  const add = await request("POST", `/api/surveys/${surveyId}/distribution/recipients`, ownerToken, {
    emails: ["DEV+FIRST@example.test", "dev+fail@example.test", "dev+first@example.test", "dev+second@example.test"]
  });
  assert.equal(add.status, 201);
  assert.equal(add.data.added, 3);
  assert.equal(add.data.duplicates, 1);
  assert.ok(add.data.recipients.every((recipient) => !("tokenHash" in recipient) && !("token" in recipient)));
  assert.equal((await request("POST", `/api/surveys/${surveyId}/distribution/recipients`, outsiderToken, {
    emails: ["private@example.test"]
  })).status, 404);

  const publicSurvey = await request("GET", "/api/surveys/public/distribution-test", null);
  assert.equal(publicSurvey.status, 200);
  assert.equal("recipients" in publicSurvey.data.survey, false);
  assert.equal("email" in publicSurvey.data.survey, false);

  const firstSend = await request("POST", `/api/surveys/${surveyId}/distribution/send`, ownerToken, {});
  assert.equal(firstSend.status, 200);
  assert.equal(firstSend.data.sent, 2);
  assert.equal(firstSend.data.failed, 1);
  assert.equal(sentMessages[0].from, "Surveys <surveys@example.test>");
  assert.match(sentMessages[0].html, /Help us improve &lt;the product&gt;/);
  assert.match(sentMessages[0].html, /Take the survey/);
  assert.match(sentMessages[0].html, /workspace|Mail Owner/i);

  const firstInvitation = sentMessages.find((message) => message.to === "dev+first@example.test");
  const clickToken = firstInvitation.html.match(/\/distribution\/click\/([A-Za-z0-9_-]+)/)[1];
  const pixelToken = firstInvitation.html.match(/\/distribution\/open\/([A-Za-z0-9_-]+)\.gif/)[1];
  assert.equal(clickToken, pixelToken);
  const clickResponse = await fetch(`${baseUrl}/api/distribution/click/${clickToken}`, { redirect: "manual" });
  assert.equal(clickResponse.status, 302);
  assert.match(clickResponse.headers.get("location"), /\/survey\/distribution-test\?distribution=/);
  assert.equal((await request("GET", `/api/distribution/open/${pixelToken}.gif`, null)).status, 200);

  const start = await request("POST", "/api/responses/start", null, {
    surveyId,
    distributionToken: clickToken
  });
  assert.equal(start.status, 201);
  assert.equal((await request("POST", `/api/responses/${start.data.responseId}/submit`, null, {
    answers: [{ questionId: survey.questions[0]._id.toString(), value: "Useful research" }]
  })).status, 200);
  assert.equal((await request("POST", "/api/responses/start", null, {
    surveyId,
    distributionToken: clickToken
  })).status, 409);

  const failedRecipient = firstSend.data.results.find((recipient) => recipient.status === "failed");
  assert.ok(failedRecipient);
  rejectFailureAddress = false;
  assert.equal((await request("POST", `/api/surveys/${surveyId}/distribution/recipients/${failedRecipient.id}/send`, ownerToken, {})).status, 200);
  const respondedRecipient = add.data.recipients.find((recipient) => recipient.email === "dev+first@example.test");
  assert.equal((await request("POST", `/api/surveys/${surveyId}/distribution/recipients/${respondedRecipient.id}/send`, ownerToken, { reminder: true })).status, 409);

  const beforeReminders = sentMessages.length;
  const reminders = await request("POST", `/api/surveys/${surveyId}/distribution/send`, ownerToken, { reminder: true });
  assert.equal(reminders.status, 200);
  assert.equal(reminders.data.sent, 2);
  assert.ok(sentMessages.slice(beforeReminders).every((message) => message.to !== "dev+first@example.test"));

  const distribution = await request("GET", `/api/surveys/${surveyId}/distribution`, ownerToken);
  assert.equal(distribution.status, 200);
  assert.deepEqual(distribution.data.summary, {
    recipients: 3,
    sent: 3,
    opened: 1,
    clicked: 1,
    responded: 1,
    delivered: null
  });
  const responded = distribution.data.recipients.find((recipient) => recipient.email === "dev+first@example.test");
  assert.equal(responded.status, "responded");
  assert.equal(responded.opened, true);
  assert.equal(responded.clicked, true);
  assert.equal(responded.reminderCount, 0);

  configureTransportForTests(null);
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  const missingConfigSurvey = await Survey.create({
    title: "SMTP unavailable",
    status: "published",
    slug: "smtp-unavailable",
    createdBy: owner._id,
    questions: [{ type: "short-answer", questionText: "Feedback", order: 0 }]
  });
  const missingConfigRecipient = await request("POST", `/api/surveys/${missingConfigSurvey._id}/distribution/recipients`, ownerToken, {
    emails: ["dev+config@example.test"]
  });
  const missingConfigSend = await request("POST", `/api/surveys/${missingConfigSurvey._id}/distribution/send`, ownerToken, {});
  assert.equal(missingConfigSend.status, 200);
  assert.equal(missingConfigSend.data.failed, 1);
  assert.match(missingConfigSend.data.results[0].lastError, /Email is not configured/);
  assert.ok(missingConfigRecipient.data.recipients[0].id);

  const missingBaseUrlSurvey = await Survey.create({
    title: "Public URL unavailable",
    status: "published",
    slug: "missing-public-url",
    createdBy: owner._id,
    questions: [{ type: "short-answer", questionText: "Feedback", order: 0 }]
  });
  await request("POST", `/api/surveys/${missingBaseUrlSurvey._id}/distribution/recipients`, ownerToken, {
    emails: ["dev+url@example.test"]
  });
  delete process.env.APP_BASE_URL;
  const missingBaseUrlSend = await request("POST", `/api/surveys/${missingBaseUrlSurvey._id}/distribution/send`, ownerToken, {});
  assert.equal(missingBaseUrlSend.status, 200);
  assert.equal(missingBaseUrlSend.data.failed, 1);
  assert.match(missingBaseUrlSend.data.results[0].lastError, /APP_BASE_URL/);
  assert.equal((await SurveyRecipient.findOne({ survey: missingBaseUrlSurvey._id })).emailStatus, "failed");

  assert.equal((await request("DELETE", `/api/surveys/${surveyId}`, ownerToken)).status, 200);
  assert.equal(await SurveyRecipient.countDocuments({ survey: survey._id }), 0);
  assert.equal((await request("GET", `/api/distribution/click/${clickToken}`, null)).status, 404);

  for (const key of ["APP_BASE_URL", "EMAIL_PUBLIC_API_URL", "EMAIL_FROM", "SMTP_PORT", "SMTP_SECURE", "DISTRIBUTION_TOKEN_SECRET"]) {
    delete process.env[key];
  }
  });
});
