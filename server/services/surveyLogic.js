const OPERATORS = new Set(["equals", "notEquals", "contains", "greaterThan", "lessThan"]);

function questionId(question) {
  return String(question._id || question.id);
}

function hasAnswer(value) {
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

function validateLogicRules(questions, rules) {
  const errors = [];
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const indexes = new Map(ordered.map((question, index) => [questionId(question), index]));
  const questionById = new Map(ordered.map((question) => [questionId(question), question]));

  if (!Array.isArray(rules)) return ["Logic rules must be a list."];

  rules.forEach((rule, ruleIndex) => {
    const prefix = `Rule ${ruleIndex + 1}`;
    const sourceIndex = indexes.get(String(rule.sourceQuestionId));
    if (sourceIndex === undefined) {
      errors.push(`${prefix}: its source question no longer exists.`);
      return;
    }
    if (!["all", "any"].includes(rule.match)) errors.push(`${prefix}: choose AND or OR for its conditions.`);
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      errors.push(`${prefix}: add at least one condition.`);
    } else {
      rule.conditions.forEach((condition, conditionIndex) => {
        const questionIndex = indexes.get(String(condition.questionId));
        const conditionPrefix = `${prefix}, condition ${conditionIndex + 1}`;
        if (questionIndex === undefined) {
          errors.push(`${conditionPrefix}: the referenced question no longer exists.`);
          return;
        }
        if (questionIndex > sourceIndex) {
          errors.push(`${conditionPrefix}: conditions can only use questions answered at or before the rule's question.`);
        }
        if (!OPERATORS.has(condition.operator)) {
          errors.push(`${conditionPrefix}: choose a valid comparison.`);
          return;
        }
        if (!hasAnswer(condition.value)) errors.push(`${conditionPrefix}: choose or enter an answer.`);
        const question = questionById.get(String(condition.questionId));
        if (["greaterThan", "lessThan"].includes(condition.operator) &&
            !["rating", "number", "nps"].includes(question.type)) {
          errors.push(`${conditionPrefix}: greater than and less than require a numeric question.`);
        }
        if (["greaterThan", "lessThan"].includes(condition.operator) &&
            (!Number.isFinite(Number(condition.value)) ||
              (question.type === "rating" && (Number(condition.value) < 1 || Number(condition.value) > 5)) ||
              (question.type === "nps" && (Number(condition.value) < 0 || Number(condition.value) > 10)))) {
          errors.push(question.type === "rating"
            ? `${conditionPrefix}: enter a rating value from 1 to 5.`
            : question.type === "nps"
              ? `${conditionPrefix}: enter an NPS value from 0 to 10.`
              : `${conditionPrefix}: enter a numeric comparison value.`);
        }
        if (question.type === "nps" && ["equals", "notEquals", "contains"].includes(condition.operator) &&
            (!Number.isInteger(Number(condition.value)) || Number(condition.value) < 0 || Number(condition.value) > 10)) {
          errors.push(`${conditionPrefix}: enter an NPS value from 0 to 10.`);
        }
        if (condition.operator === "contains" &&
            !["short-answer", "long-answer", "multiple-choice", "checkboxes", "dropdown"].includes(question.type)) {
          errors.push(`${conditionPrefix}: contains is not supported for this answer type.`);
        }
        if (["multiple-choice", "checkboxes", "dropdown", "yes-no"].includes(question.type) &&
            ["equals", "notEquals", "contains"].includes(condition.operator) &&
            !question.options?.includes(condition.value) &&
            !(question.type === "yes-no" && ["Yes", "No"].includes(condition.value))) {
          errors.push(`${conditionPrefix}: choose an answer option that exists on the question.`);
        }
      });
    }

    if (!["goto", "end"].includes(rule.action)) {
      errors.push(`${prefix}: choose a destination action.`);
    } else if (rule.action === "end") {
      if (rule.destinationQuestionId) errors.push(`${prefix}: an end-survey rule cannot have a destination question.`);
    } else {
      const destinationIndex = indexes.get(String(rule.destinationQuestionId));
      if (destinationIndex === undefined) {
        errors.push(`${prefix}: its destination question no longer exists.`);
      } else if (destinationIndex <= sourceIndex) {
        errors.push(`${prefix}: the destination must come after the rule's question. Earlier destinations could create a loop.`);
      }
    }
  });

  return [...new Set(errors)];
}

function evaluateSurveyPath(questions, rules, answerMap) {
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const ids = ordered.map(questionId);
  const indexes = new Map(ids.map((id, index) => [id, index]));
  const reachedQuestionIds = [];
  const skippedQuestionIds = [];
  const reached = new Set();
  let cursor = 0;
  let ended = false;

  while (cursor < ordered.length) {
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
        const value = answerMap.get(conditionId);
        return reached.has(conditionId) && hasAnswer(value) &&
          compareAnswer(value, condition.operator, condition.value, ordered[indexes.get(conditionId)]?.type);
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

module.exports = { evaluateSurveyPath, validateLogicRules, hasAnswer };
