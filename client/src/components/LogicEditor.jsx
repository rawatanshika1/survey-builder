import { Button, Icon, Modal, Select } from "./ui.jsx";
import { defaultCondition, getQuestionId } from "../utils/surveyLogic.js";

const OPERATORS = [
  ["equals", "Equals"],
  ["notEquals", "Does not equal"],
  ["contains", "Contains"],
  ["greaterThan", "Greater than"],
  ["lessThan", "Less than"]
];

function supportedOperators(question) {
  return OPERATORS.filter(([value]) => {
    if (["greaterThan", "lessThan"].includes(value)) return ["rating", "number", "nps"].includes(question.type);
    if (value === "contains") return ["short-answer", "long-answer", "multiple-choice", "checkboxes", "dropdown"].includes(question.type);
    return true;
  });
}

function answerOptions(question) {
  if (question.type === "yes-no") return ["Yes", "No"];
  if (question.type === "rating") return [1, 2, 3, 4, 5];
  if (question.type === "nps") return Array.from({ length: 11 }, (_, value) => value);
  if (["multiple-choice", "dropdown", "checkboxes"].includes(question.type)) return question.options || [];
  return null;
}

export default function LogicEditor({
  open,
  sourceQuestion,
  questions,
  rules,
  onChange,
  onClose
}) {
  if (!sourceQuestion) return null;
  const sourceId = getQuestionId(sourceQuestion);
  const sourceIndex = questions.findIndex((question) => getQuestionId(question) === sourceId);
  const eligibleQuestions = questions.slice(0, sourceIndex + 1);
  const destinations = questions.slice(sourceIndex + 1);
  const sourceRules = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => String(rule.sourceQuestionId) === sourceId);

  function updateRule(ruleIndex, transform) {
    onChange(rules.map((rule, index) => index === ruleIndex ? transform(rule) : rule));
  }

  function addRule() {
    const order = Math.max(-1, ...sourceRules.map(({ rule }) => rule.order)) + 1;
    const condition = defaultCondition(sourceQuestion);
    onChange([...rules, {
      sourceQuestionId: sourceId,
      match: "all",
      conditions: [condition],
      action: destinations.length ? "goto" : "end",
      destinationQuestionId: destinations.length ? getQuestionId(destinations[0]) : null,
      order
    }]);
  }

  function conditionAnswer(question, condition, updateCondition) {
    const options = answerOptions(question);
    if (options) {
      return (
        <Select
          aria-label="Answer"
          value={condition.value ?? ""}
          onChange={(event) => updateCondition({ ...condition, value: event.target.value })}
        >
          <option value="">Select answer</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
      );
    }
    return (
      <input
        aria-label="Answer"
        className="ui-input logic-answer-input"
        type={["rating", "number", "nps"].includes(question.type) ? "number" : "text"}
        min={question.type === "rating" ? 1 : question.type === "nps" ? 0 : undefined}
        max={question.type === "rating" ? 5 : question.type === "nps" ? 10 : undefined}
        value={condition.value ?? ""}
        placeholder="Enter answer"
        onChange={(event) => updateCondition({
          ...condition,
          value: ["rating", "number", "nps"].includes(question.type) && event.target.value !== "" ? Number(event.target.value) : event.target.value
        })}
      />
    );
  }

  return (
    <Modal
      open={open}
      title={`Logic for Question ${sourceIndex + 1}`}
      description="Rules run from top to bottom after this question. The first matching rule wins; otherwise the survey continues to the next question."
      onClose={onClose}
      className="ui-modal--wide"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <div className="logic-editor">
        {sourceRules.length === 0 && (
          <div className="logic-empty">
            <Icon name="chart" size={20} />
            <strong>No branching rules yet</strong>
            <span>When no rule matches, respondents continue to the next question.</span>
          </div>
        )}

        {sourceRules.map(({ rule, index: ruleIndex }, displayIndex) => (
          <section className="logic-rule-card" key={`${sourceId}-${ruleIndex}`}>
            <div className="logic-rule-heading">
              <strong>Rule {displayIndex + 1}</strong>
              <Button size="sm" variant="ghost" onClick={() => onChange(rules.filter((_, index) => index !== ruleIndex))} aria-label={`Delete rule ${displayIndex + 1}`}>
                <Icon name="trash" size={15} />
              </Button>
            </div>
            <div className="logic-rule-label">IF</div>
            <div className="logic-match-row">
              <span>Match</span>
              <Select
                aria-label="Condition matching"
                value={rule.match}
                onChange={(event) => updateRule(ruleIndex, (current) => ({ ...current, match: event.target.value }))}
              >
                <option value="all">ALL conditions (AND)</option>
                <option value="any">ANY condition (OR)</option>
              </Select>
            </div>
            {(rule.conditions || []).map((condition, conditionIndex) => {
              const conditionQuestion = questions.find((question) => getQuestionId(question) === String(condition.questionId));
              const allowed = eligibleQuestions;
              return (
                <div className="logic-condition" key={`${ruleIndex}-${conditionIndex}`}>
                  <Select
                    aria-label="Condition question"
                    value={condition.questionId}
                    onChange={(event) => {
                      const selected = questions.find((question) => getQuestionId(question) === event.target.value);
                      if (!selected) return;
                      updateRule(ruleIndex, (current) => ({
                        ...current,
                        conditions: current.conditions.map((item, itemIndex) =>
                          itemIndex === conditionIndex ? defaultCondition(selected) : item)
                      }));
                    }}
                  >
                    {allowed.map((question) => (
                      <option key={getQuestionId(question)} value={getQuestionId(question)}>
                        Q{questions.indexOf(question) + 1}: {question.questionText || "Untitled question"}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Condition"
                    value={condition.operator}
                    onChange={(event) => updateRule(ruleIndex, (current) => ({
                      ...current,
                      conditions: current.conditions.map((item, itemIndex) =>
                        itemIndex === conditionIndex ? { ...item, operator: event.target.value } : item)
                    }))}
                  >
                    {supportedOperators(conditionQuestion || sourceQuestion).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </Select>
                  {conditionQuestion && conditionAnswer(conditionQuestion, condition, (updated) =>
                    updateRule(ruleIndex, (current) => ({
                      ...current,
                      conditions: current.conditions.map((item, itemIndex) => itemIndex === conditionIndex ? updated : item)
                    })))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateRule(ruleIndex, (current) => ({
                      ...current,
                      conditions: current.conditions.filter((_, itemIndex) => itemIndex !== conditionIndex)
                    }))}
                    aria-label={`Remove condition ${conditionIndex + 1}`}
                  >
                    <Icon name="close" size={15} />
                  </Button>
                </div>
              );
            })}
            <Button
              size="sm"
              onClick={() => updateRule(ruleIndex, (current) => ({
                ...current,
                conditions: [...current.conditions, defaultCondition(sourceQuestion)]
              }))}
            >
              <Icon name="plus" size={14} /> Add Condition
            </Button>
            <div className="logic-rule-label">THEN</div>
            <div className="logic-action-row">
              <Select
                aria-label="Action"
                value={rule.action}
                onChange={(event) => updateRule(ruleIndex, (current) => ({
                  ...current,
                  action: event.target.value,
                  destinationQuestionId: event.target.value === "end"
                    ? null
                    : current.destinationQuestionId || (destinations[0] ? getQuestionId(destinations[0]) : null)
                }))}
              >
                <option value="goto" disabled={!destinations.length}>Go to question</option>
                <option value="end">End survey</option>
              </Select>
              {rule.action === "goto" && (
                <Select
                  aria-label="Destination question"
                  value={rule.destinationQuestionId || ""}
                  onChange={(event) => updateRule(ruleIndex, (current) => ({ ...current, destinationQuestionId: event.target.value }))}
                >
                  <option value="">Select destination</option>
                  {destinations.map((question) => (
                    <option key={getQuestionId(question)} value={getQuestionId(question)}>
                      Q{questions.indexOf(question) + 1}: {question.questionText || "Untitled question"}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </section>
        ))}
        <Button variant="primary" onClick={addRule}><Icon name="plus" size={15} /> Add Rule</Button>
      </div>
    </Modal>
  );
}
