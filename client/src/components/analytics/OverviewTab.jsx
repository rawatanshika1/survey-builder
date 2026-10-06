import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge, Card, EmptyState, Icon, Input, Select, Tooltip as UiTooltip } from "../ui.jsx";

const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 };
const CHOICE_TYPES = ["multiple-choice", "dropdown", "yes-no"];
const COLORS = ["#003366", "#0D9488", "#2563EB", "#dc9b35", "#d35b68", "#329ab4", "#6b7280"];

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateInput(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function humanDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "No data available";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function hasAnswer(answer) {
  return answer && answer.status === "answered" &&
    answer.value !== null && answer.value !== undefined && answer.value !== "" &&
    !(Array.isArray(answer.value) && answer.value.length === 0);
}

function KpiCard({ icon, label, value, detail, tone, tooltip }) {
  return (
    <Card className="analytics-kpi">
      <div className={`analytics-kpi__icon analytics-kpi__icon--${tone}`}><Icon name={icon} size={17} /></div>
      <div className="analytics-kpi__copy">
        <div className="analytics-kpi__label"><span>{label}</span>{tooltip && <UiTooltip label={tooltip}><span className="analytics-info" tabIndex="0" aria-label={tooltip}>i</span></UiTooltip>}</div>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </Card>
  );
}

function SectionHeading({ eyebrow, title, description, trailing }) {
  return (
    <div className="analytics-section-heading">
      <div>
        {eyebrow && <span className="analytics-section-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {trailing}
    </div>
  );
}

function FilterBar({ period, setPeriod, fromDate, setFromDate, toDate, setToDate, questionId, setQuestionId, status, setStatus, questions, dateError }) {
  return (
    <section className="analytics-filters" aria-label="Analytics filters">
      <div className="analytics-filter-group analytics-period-filter">
        <span className="analytics-filter-label">Date range</span>
        <div className="analytics-period-options" role="group" aria-label="Response trend date range">
          {[["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["custom", "Custom"]].map(([key, label]) => (
            <button type="button" key={key} className={period === key ? "is-active" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>
          ))}
        </div>
      </div>
      {period === "custom" && (
        <div className="analytics-custom-dates">
          <label><span className="analytics-filter-label">From</span><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Analytics start date" /></label>
          <label><span className="analytics-filter-label">To</span><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Analytics end date" /></label>
        </div>
      )}
      <label className="analytics-filter-select"><span className="analytics-filter-label">Question</span>
        <Select value={questionId} onChange={(event) => setQuestionId(event.target.value)} aria-label="Filter by question">
          <option value="all">All questions</option>
          {questions.map((question, index) => <option key={question._id} value={String(question._id)}>Q{index + 1} · {question.questionText}</option>)}
        </Select>
      </label>
      <label className="analytics-filter-select"><span className="analytics-filter-label">Response status</span>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by response status">
          <option value="all">All responses</option>
          <option value="completed">Completed</option>
          <option value="incomplete">Incomplete</option>
        </Select>
      </label>
      {dateError && <p className="analytics-filter-error" role="alert">{dateError}</p>}
    </section>
  );
}

function DistributionChart({ question, responses, horizontal = false }) {
  const data = useMemo(() => {
    const counts = {};
    const options = question.options?.length ? question.options : question.type === "yes-no" ? ["Yes", "No"] : [];
    options.forEach((option) => { counts[option] = 0; });
    let answered = 0;
    responses.forEach((response) => {
      const answer = response.answers.find((item) => item.questionId === String(question._id));
      if (!hasAnswer(answer)) return;
      answered += 1;
      const values = Array.isArray(answer.value) ? answer.value : [answer.value];
      values.forEach((value) => {
        const key = String(value);
        if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
      });
    });
    return Object.entries(counts).map(([name, count], index) => ({
      name,
      count,
      percentage: answered ? Number(((count / answered) * 100).toFixed(1)) : 0,
      color: COLORS[index % COLORS.length]
    }));
  }, [question, responses]);
  const totalAnswered = responses.filter((response) => hasAnswer(response.answers.find((item) => item.questionId === String(question._id)))).length;

  if (!totalAnswered) return <p className="analytics-no-data">No data available for this question in the selected filters.</p>;
  if (horizontal) {
    return (
      <div className="analytics-chart analytics-chart--horizontal">
        <ResponsiveContainer width="100%" height={Math.max(190, data.length * 43)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
            <XAxis type="number" domain={[0, "dataMax"]} allowDecimals={false} hide />
            <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value, _name, item) => [`${value} · ${item.payload.percentage}%`, "Selections"]} />
            <Bar dataKey="count" radius={[0, 5, 5, 0]} label={{ position: "right", formatter: (_value, entry) => `${entry?.payload?.percentage ?? 0}%`, fontSize: 10, fill: "var(--muted)" }}>
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="analytics-chart">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value, _name, item) => [`${value} (${item.payload.percentage}%)`, "Responses"]} />
          <Bar dataKey="count" radius={[5, 5, 0, 0]}>
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="analytics-distribution-list">
        {data.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.count} <small>{item.percentage}%</small></strong></div>)}
      </div>
      <p className="analytics-chart-footnote">Percentages use {totalAnswered} response{totalAnswered === 1 ? "" : "s"} that answered this question.</p>
    </div>
  );
}

function RatingChart({ question, responses }) {
  const data = useMemo(() => {
    const counts = Object.fromEntries([1, 2, 3, 4, 5].map((value) => [value, 0]));
    const scores = [];
    responses.forEach((response) => {
      const answer = response.answers.find((item) => item.questionId === String(question._id));
      const score = Number(answer?.value);
      if (!hasAnswer(answer) || !Number.isFinite(score) || !Object.hasOwn(counts, score)) return;
      counts[score] += 1;
      scores.push(score);
    });
    return { distribution: Object.entries(counts).map(([rating, count]) => ({ rating: `${rating}★`, count })), average: scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2) : null, count: scores.length };
  }, [question, responses]);
  if (!data.count) return <p className="analytics-no-data">No data available for this question in the selected filters.</p>;
  return (
    <div>
      <div className="analytics-question-stat"><span>Average rating</span><strong>{data.average} <small>/ 5</small></strong><span>{data.count} responses</span></div>
      <div className="analytics-chart"><ResponsiveContainer width="100%" height={215}>
        <BarChart data={data.distribution} margin={{ top: 10, right: 12, left: -16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
          <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" name="Responses" fill="#2e9b76" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer></div>
    </div>
  );
}

function NpsQuestionChart({ question, responses }) {
  const result = useMemo(() => {
    const scores = responses.flatMap((response) => {
      const answer = response.answers.find((item) => item.questionId === String(question._id));
      return hasAnswer(answer) && Number.isInteger(answer.value) && answer.value >= 0 && answer.value <= 10 ? [answer.value] : [];
    });
    const promoters = scores.filter((score) => score >= 9).length;
    const passives = scores.filter((score) => score >= 7 && score <= 8).length;
    const detractors = scores.filter((score) => score <= 6).length;
    const total = scores.length;
    return {
      score: total ? Math.round(((promoters - detractors) / total) * 100) : null,
      promoters,
      passives,
      detractors,
      total,
      promoterPct: total ? (promoters / total) * 100 : 0,
      passivePct: total ? (passives / total) * 100 : 0,
      detractorPct: total ? (detractors / total) * 100 : 0,
      distribution: Array.from({ length: 11 }, (_, value) => ({ value: String(value), count: scores.filter((score) => score === value).length }))
    };
  }, [question, responses]);
  if (!result.total) return <p className="analytics-no-data">No data available for this question in the selected filters.</p>;
  return (
    <div className="analytics-nps">
      <div className="analytics-nps__summary">
        <div className="analytics-nps__score"><strong>{result.score > 0 ? `+${result.score}` : result.score}</strong><span>NPS score</span></div>
        <div><strong>{result.promoters}</strong><span>Promoters <small>{result.promoterPct.toFixed(1)}%</small></span></div>
        <div><strong>{result.passives}</strong><span>Passives <small>{result.passivePct.toFixed(1)}%</small></span></div>
        <div><strong>{result.detractors}</strong><span>Detractors <small>{result.detractorPct.toFixed(1)}%</small></span></div>
        <div><strong>{result.total}</strong><span>Valid responses</span></div>
      </div>
      <div className="analytics-nps__stack" aria-label={`Promoters ${result.promoterPct.toFixed(1)}%, passives ${result.passivePct.toFixed(1)}%, detractors ${result.detractorPct.toFixed(1)}%`}>
        <span className="is-promoter" style={{ width: `${result.promoterPct}%` }} />
        <span className="is-passive" style={{ width: `${result.passivePct}%` }} />
        <span className="is-detractor" style={{ width: `${result.detractorPct}%` }} />
      </div>
      <div className="analytics-chart analytics-chart--nps">
        <ResponsiveContainer width="100%" height={155}>
          <BarChart data={result.distribution} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
            <XAxis dataKey="value" tick={{ fontSize: 9 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
            <Tooltip />
            <Bar dataKey="count" name="Scores" radius={[3, 3, 0, 0]}>
              {result.distribution.map((entry) => <Cell key={entry.value} fill={Number(entry.value) >= 9 ? "#2e9b76" : Number(entry.value) >= 7 ? "#dc9b35" : "#d35b68"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TextResponses({ question, responses }) {
  const [search, setSearch] = useState("");
  const recent = useMemo(() => responses
    .map((response) => ({
      response,
      answer: response.answers.find((item) => item.questionId === String(question._id))
    }))
    .filter(({ answer }) => hasAnswer(answer) && typeof answer.value === "string")
    .filter(({ answer }) => answer.value.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => new Date(b.response.completedAt || b.response.startedAt) - new Date(a.response.completedAt || a.response.startedAt)), [question, responses, search]);
  if (!recent.length && !search.trim()) return <p className="analytics-no-data">No data available for this question in the selected filters.</p>;
  return (
    <div className="analytics-text-responses">
      <div className="analytics-text-toolbar"><Badge tone="blue">{recent.length} matching response{recent.length === 1 ? "" : "s"}</Badge><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search responses..." aria-label={`Search responses to ${question.questionText}`} /></div>
      {recent.length ? <ul>{recent.slice(0, 8).map(({ response, answer }) => <li key={response.id}><p>{answer.value}</p><time>{new Date(response.completedAt || response.startedAt).toLocaleString()}</time></li>)}</ul> : <p className="analytics-no-data">No responses match your search.</p>}
    </div>
  );
}

function QuestionAnalytics({ question, index, responses }) {
  const answeredCount = responses.filter((response) => hasAnswer(response.answers.find((answer) => answer.questionId === String(question._id)))).length;
  return (
    <Card className="analytics-question-card">
      <div className="analytics-question-heading">
        <div><span className="analytics-question-number">Q{index + 1}</span><h3>{question.questionText}</h3></div>
        <Badge tone="neutral">{answeredCount} answered</Badge>
      </div>
      <p className="analytics-question-meta">{question.type.replaceAll("-", " ")} · {answeredCount} answered · {responses.length - answeredCount} without an answer in the filtered set</p>
      {question.type === "nps" && <NpsQuestionChart question={question} responses={responses} />}
      {question.type === "rating" && <RatingChart question={question} responses={responses} />}
      {CHOICE_TYPES.includes(question.type) && <DistributionChart question={question} responses={responses} />}
      {question.type === "checkboxes" && <DistributionChart question={question} responses={responses} horizontal />}
      {["short-answer", "long-answer"].includes(question.type) && <TextResponses question={question} responses={responses} />}
      {question.type === "number" && (() => {
        const values = responses.flatMap((response) => {
          const answer = response.answers.find((item) => item.questionId === String(question._id));
          const number = Number(answer?.value);
          return hasAnswer(answer) && Number.isFinite(number) ? [number] : [];
        });
        return values.length
          ? <div className="analytics-question-stat"><span>Numeric answers</span><strong>{values.length}</strong><span>Average { (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) }</span></div>
          : <p className="analytics-no-data">No data available for this question in the selected filters.</p>;
      })()}
    </Card>
  );
}

export default function OverviewTab({ analytics, survey, responses = [] }) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const [period, setPeriod] = useState("30d");
  const [fromDate, setFromDate] = useState(dateInputValue(thirtyDaysAgo));
  const [toDate, setToDate] = useState(dateInputValue(now));
  const [questionId, setQuestionId] = useState("all");
  const [status, setStatus] = useState("all");

  const range = useMemo(() => {
    if (period === "custom") {
      const from = parseDateInput(fromDate);
      const to = parseDateInput(toDate, true);
      const error = fromDate && toDate && from && to
        ? from > to
          ? "Start date must be on or before the end date."
          : to - from > 366 * 24 * 60 * 60 * 1000
            ? "Custom date ranges are limited to 366 days."
            : ""
        : "";
      return { from, to, error };
    }
    const days = PERIOD_DAYS[period];
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    return { from: start, to: end, error: "" };
  }, [period, fromDate, toDate]);

  const filteredResponses = useMemo(() => {
    if (range.error) return [];
    return responses.filter((response) => {
      if (status === "completed" && !response.completed) return false;
      if (status === "incomplete" && response.completed) return false;
      const startedAt = new Date(response.startedAt);
      if (Number.isNaN(startedAt.getTime())) return false;
      if (range.from && startedAt < range.from) return false;
      if (range.to && startedAt > range.to) return false;
      return true;
    });
  }, [responses, status, range]);

  const questions = survey.questions || [];
  const filteredQuestions = questionId === "all"
    ? questions
    : questions.filter((question) => String(question._id) === questionId);
  const completed = filteredResponses.filter((response) => response.completed);
  const completionRate = filteredResponses.length ? (completed.length / filteredResponses.length) * 100 : null;
  const durations = completed.flatMap((response) => {
    const started = new Date(response.startedAt).getTime();
    const finished = new Date(response.completedAt).getTime();
    return Number.isFinite(started) && Number.isFinite(finished) && finished >= started ? [finished - started] : [];
  });
  const averageCompletionTime = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) / durations.length
    : null;
  const npsQuestions = questions.filter((question) => question.type === "nps");
  const singleNps = npsQuestions.length === 1 ? npsQuestions[0] : null;
  const npsScores = singleNps ? completed.flatMap((response) => {
    const answer = response.answers.find((item) => item.questionId === String(singleNps._id));
    return hasAnswer(answer) && Number.isInteger(answer.value) && answer.value >= 0 && answer.value <= 10 ? [answer.value] : [];
  }) : [];
  const npsScore = npsScores.length
    ? Math.round(((npsScores.filter((score) => score >= 9).length - npsScores.filter((score) => score <= 6).length) / npsScores.length) * 100)
    : null;
  const trend = useMemo(() => {
    if (range.error || !range.from || !range.to) return [];
    const days = [];
    const cursor = new Date(range.from);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(range.to);
    last.setHours(0, 0, 0, 0);
    while (cursor <= last && days.length < 366) {
      days.push({ key: dayKey(cursor), date: new Date(cursor), responses: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    const byDay = new Map(days.map((day) => [day.key, day]));
    filteredResponses.forEach((response) => {
      const key = dayKey(new Date(response.startedAt));
      const day = byDay.get(key);
      if (day) day.responses += 1;
    });
    return days.map((day) => ({
      ...day,
      label: day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    }));
  }, [filteredResponses, range]);

  const rangeDescription = period === "custom"
    ? (fromDate && toDate ? `${fromDate} to ${toDate}` : "Choose both dates to view the trend")
    : `Last ${PERIOD_DAYS[period]} days`;

  return (
    <div className="analytics-overview">
      <FilterBar
        period={period}
        setPeriod={setPeriod}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        questionId={questionId}
        setQuestionId={setQuestionId}
        status={status}
        setStatus={setStatus}
        questions={questions}
        dateError={range.error}
      />

      <section className="analytics-kpi-grid" aria-label="Survey performance metrics">
        <KpiCard icon="inbox" label="Total Responses" value={filteredResponses.length} detail={`${completed.length} completed`} tone="blue" tooltip="Responses started during the selected date range and status." />
        <KpiCard icon="check" label="Completion Rate" value={completionRate === null ? "No data available" : `${completionRate.toFixed(1)}%`} detail={filteredResponses.length ? `${completed.length} of ${filteredResponses.length} starts` : ""} tone="green" tooltip="Completed responses divided by response starts in the filtered set." />
        <KpiCard icon="clock" label="Avg. Completion Time" value={averageCompletionTime === null ? "No data available" : humanDuration(averageCompletionTime)} detail={durations.length ? `Based on ${durations.length} completed responses` : ""} tone="violet" tooltip="Mean elapsed time between a response's stored start and completion timestamps." />
        {singleNps && <KpiCard icon="chart" label="NPS" value={npsScore === null ? "No data available" : `${npsScore > 0 ? "+" : ""}${npsScore}`} detail={npsScores.length ? `${npsScores.length} valid scores · ${singleNps.questionText}` : singleNps.questionText} tone="amber" tooltip="NPS is calculated only from valid 0–10 scores for the survey's single NPS question." />}
        <KpiCard icon="share" label="Response Rate" value="No data available" detail="No invitation or audience denominator is recorded for all survey links." tone="blue" tooltip="A response rate requires a known audience or delivered-invitation count; that denominator is not available for every survey." />
      </section>

      <Card className="analytics-trend-card">
        <SectionHeading eyebrow="PERFORMANCE" title="Response trends" description={`Response starts by day · ${rangeDescription}`} trailing={<Badge tone="neutral">{filteredResponses.length} in range</Badge>} />
        {range.error ? <p className="analytics-filter-error">{range.error}</p> : period === "custom" && (!range.from || !range.to) ? (
          <p className="analytics-no-data">Select a start and end date to view response trends.</p>
        ) : trend.length ? (
          <div className="analytics-trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 18, left: -12, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={18} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(_label, payload) => payload?.[0]?.payload?.date?.toLocaleDateString()} />
                <Line type="monotone" dataKey="responses" name="Response starts" stroke="#003366" strokeWidth={2.5} dot={{ r: 3, fill: "#003366" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="analytics-no-data">No data available for this date range.</p>}
      </Card>

      <section className="analytics-question-section">
        <SectionHeading eyebrow="QUESTION BREAKDOWN" title="Question analytics" description="Charts use the responses matching the current date and status filters." trailing={<Badge tone="neutral">{filteredQuestions.length} question{filteredQuestions.length === 1 ? "" : "s"}</Badge>} />
        {filteredQuestions.length ? (
          <div className="analytics-question-grid">
            {filteredQuestions.map((question) => <QuestionAnalytics key={question._id} question={question} index={questions.findIndex((item) => String(item._id) === String(question._id))} responses={filteredResponses} />)}
          </div>
        ) : <EmptyState icon="chart" title="No questions found" description="The selected question is not available in this survey." />}
      </section>
      {analytics.totalResponses === 0 && <p className="analytics-no-data analytics-no-data--center">No responses have been recorded for this survey yet.</p>}
    </div>
  );
}
