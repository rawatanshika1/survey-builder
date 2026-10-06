const OPERATORS = ["equals", "notEquals", "contains", "greaterThan", "lessThan"];

export function getQuestionId(question) {
  return String(question?._id || question?.id || "");
}

export function hasAnswer(value) {
  return value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);
}

function compareAnswer(actual, operator, expected, questionType) {
  if (operator === "contains") {
    if (Array.isArray(actual)) return actual.some((value) => String(value) === String(expected));
    if (["multiple-choice", "dropdown"].includes(questionType)) return String(actual) === String(expected);
    return typeof actual === "string" && actual.toLowerCase().includes(String(expected).toLowerCase());
  }
  if (operator === "greaterThan" || operator === "lessThan") {
    const left = Number(actual);
    const right = Number(expected);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return operator === "greaterThan" ? left > right : left < right;
  }
  const equal = Array.isArray(actual)
    ? actual.length === 1 && String(actual[0]) === String(expected)
    : String(actual) === String(expected);
  return operator === "equals" ? equal : !equal;
}

export function evaluateSurveyPath(survey, answers) {
  const questions = [...(survey.questions || [])].sort((a, b) => a.order - b.order);
  const ids = questions.map(getQuestionId);
  const indexes = new Map(ids.map((id, index) => [id, index]));
  const rules = survey.logicRules || [];
  const reachedQuestionIds = [];
  const skippedQuestionIds = [];
  const reached = new Set();
  let cursor = 0;
  let ended = false;

  while (cursor < questions.length) {
    const sourceId = ids[cursor];
    reachedQuestionIds.push(sourceId);
    reached.add(sourceId);
    const sourceRules = rules
      .filter((rule) => String(rule.sourceQuestionId) === sourceId)
      .sort((a, b) => a.order - b.order);
    const matchingRule = sourceRules.find((rule) => {
      if (!Array.isArray(rule.conditions) || !rule.conditions.length) return false;
      const results = rule.conditions.map((condition) => {
        const conditionId = String(condition.questionId);
        return reached.has(conditionId) &&
          hasAnswer(answers[conditionId]) &&
          compareAnswer(
            answers[conditionId],
            condition.operator,
            condition.value,
            questions[indexes.get(conditionId)]?.type
          );
      });
      return rule.match === "any" ? results.some(Boolean) : results.every(Boolean);
    });

    if (matchingRule?.action === "end") {
      ended = true;
      break;
    }
    if (matchingRule?.action === "goto") {
      const destination = indexes.get(String(matchingRule.destinationQuestionId));
      if (destination !== undefined && destination > cursor) {
        for (let index = cursor + 1; index < destination; index += 1) {
          skippedQuestionIds.push(ids[index]);
        }
        cursor = destination;
        continue;
      }
    }
    cursor += 1;
  }

  const reachedSet = new Set(reachedQuestionIds);
  const skippedSet = new Set(skippedQuestionIds);
  const notReachedQuestionIds = ended
    ? ids.filter((id) => !reachedSet.has(id) && !skippedSet.has(id))
    : [];
  return { reachedQuestionIds, skippedQuestionIds, notReachedQuestionIds, ended };
}

export function validateSurveyLogic(questions, rules) {
  const errors = [];
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const indexes = new Map(ordered.map((question, index) => [getQuestionId(question), index]));
  const questionById = new Map(ordered.map((question) => [getQuestionId(question), question]));

  (rules || []).forEach((rule, ruleIndex) => {
    const prefix = `Rule ${ruleIndex + 1}`;
    const sourceIndex = indexes.get(String(rule.sourceQuestionId));
    if (sourceIndex === undefined) {
      errors.push(`${prefix}: its source question no longer exists.`);
      return;
    }
    if (!["all", "any"].includes(rule.match)) errors.push(`${prefix}: choose AND or OR for its conditions.`);
    if (!Array.isArray(rule.conditions) || !rule.conditions.length) {
      errors.push(`${prefix}: add at least one condition.`);
    } else {
      rule.conditions.forEach((condition, conditionIndex) => {
        const conditionIndexInSurvey = indexes.get(String(condition.questionId));
        const label = `${prefix}, condition ${conditionIndex + 1}`;
        if (conditionIndexInSurvey === undefined) {
          errors.push(`${label}: the referenced question no longer exists.`);
          return;
        }
        if (conditionIndexInSurvey > sourceIndex) {
          errors.push(`${label}: conditions can only use questions answered at or before the rule's question.`);
        }
        if (!OPERATORS.includes(condition.operator)) errors.push(`${label}: choose a valid comparison.`);
        if (!hasAnswer(condition.value)) errors.push(`${label}: choose or enter an answer.`);
        const question = questionById.get(String(condition.questionId));
        if (["greaterThan", "lessThan"].includes(condition.operator) &&
            !["rating", "number", "nps"].includes(question.type)) {
          errors.push(`${label}: greater than and less than require a numeric question.`);
        }
        if (["greaterThan", "lessThan"].includes(condition.operator) &&
            (!Number.isFinite(Number(condition.value)) ||
              (question.type === "rating" && (Number(condition.value) < 1 || Number(condition.value) > 5)) ||
              (question.type === "nps" && (Number(condition.value) < 0 || Number(condition.value) > 10)))) {
          errors.push(question.type === "rating"
            ? `${label}: enter a rating value from 1 to 5.`
            : question.type === "nps"
              ? `${label}: enter an NPS value from 0 to 10.`
              : `${label}: enter a numeric comparison value.`);
        }
        if (question.type === "nps" && ["equals", "notEquals", "contains"].includes(condition.operator) &&
            (!Number.isInteger(Number(condition.value)) || Number(condition.value) < 0 || Number(condition.value) > 10)) {
          errors.push(`${label}: enter an NPS value from 0 to 10.`);
        }
        if (condition.operator === "contains" &&
            !["short-answer", "long-answer", "multiple-choice", "checkboxes", "dropdown"].includes(question.type)) {
          errors.push(`${label}: contains is not supported for this answer type.`);
        }
        const options = question.type === "yes-no" ? ["Yes", "No"] : question.options || [];
        if (["multiple-choice", "checkboxes", "dropdown", "yes-no"].includes(question.type) &&
            ["equals", "notEquals", "contains"].includes(condition.operator) &&
            !options.includes(condition.value)) {
          errors.push(`${label}: choose an answer option that exists on the question.`);
        }
      });
    }
    if (rule.action === "end") {
      if (rule.destinationQuestionId) errors.push(`${prefix}: an end-survey rule cannot have a destination question.`);
    } else if (rule.action === "goto") {
      const destinationIndex = indexes.get(String(rule.destinationQuestionId));
      if (destinationIndex === undefined) errors.push(`${prefix}: its destination question no longer exists.`);
      else if (destinationIndex <= sourceIndex) errors.push(`${prefix}: the destination must come after the rule's question. Earlier destinations could create a loop.`);
    } else {
      errors.push(`${prefix}: choose a destination action.`);
    }
  });
  return [...new Set(errors)];
}

export function defaultCondition(question) {
  const options = question.type === "yes-no" ? ["Yes", "No"] : question.options || [];
  const value = options[0] || (question.type === "rating" ? 1 : question.type === "nps" ? 0 : "");
  return { questionId: getQuestionId(question), operator: "equals", value };
}
