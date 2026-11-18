// Questions page data logic: answer → fact, release waiting jobs.
import type { Fact, FactCategory, Job, Question, WithId } from "@shared/types";
import { addDocument, logActivity, nowIso, updateDocument } from "@/lib/db";

export const NOT_APPLICABLE = "No / not applicable";

export function shortText(s: string, n = 80): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Readable fact sentence saved for the agent. */
export function factText(question: string, answer: string): string {
  return `Q: ${question.trim()} A: ${answer.trim()}`;
}

/** Guess a fact category from the question wording. */
export function guessCategory(text: string, negative = false): FactCategory {
  if (negative) return "negative";
  const t = text.toLowerCase();
  if (/(notice|authori[sz]|sponsor|visa|start date|when can you start|available to start|availability|citizen|permit|right to work|clearance)/.test(t)) return "logistics";
  if (/(salary|compensation|pay|rate|location|remote|relocat|hybrid|on-?site|office|contract|full-?time|part-?time|employment type|job type|type of (role|work|job)|travel|timezone|time zone)/.test(t)) return "preference";
  if (/(experience|years|skill|code|coding|programming|framework|language|stack|tool|proficien|familiar|have you (used|built|led|owned|worked|designed|managed)|design system|certif|degree)/.test(t)) return "skill";
  if (/(job titles?|roles?|seniority|level|title)/.test(t)) return "preference";
  return "other";
}

/** Jobs from `question` that are waiting on input and have no other open question → back to "new". */
async function releaseJobs(question: WithId<Question>, jobs: WithId<Job>[], questions: WithId<Question>[]) {
  const otherOpen = questions.filter((q) => q.id !== question.id && q.status === "open");
  const ts = nowIso();
  const updates = (question.jobIds ?? []).map((jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "waiting_input") return null;
    const stillBlocked = otherOpen.some((q) => (q.jobIds ?? []).includes(jobId) || (job.questionIds ?? []).includes(q.id));
    if (stillBlocked) return null;
    return updateDocument("jobs", jobId, { status: "new", updatedAt: ts });
  });
  await Promise.all(updates.filter(Boolean));
}

export async function submitAnswer(opts: {
  question: WithId<Question>;
  answer: string;
  saveAsFact: boolean;
  negative?: boolean;
  jobs: WithId<Job>[];
  questions: WithId<Question>[];
}) {
  const { question, answer, saveAsFact, negative, jobs, questions } = opts;
  const ts = nowIso();
  const keepFact = saveAsFact || !!negative;
  await updateDocument("questions", question.id, { status: "answered", answer, saveAsFact: keepFact, answeredAt: ts });
  if (keepFact) {
    await addDocument("facts", {
      text: factText(question.text, answer),
      category: guessCategory(question.text, negative),
      source: "answer",
      questionId: question.id,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  await logActivity("success", "answer", `Answered: ${shortText(question.text)}`);
  await releaseJobs(question, jobs, questions);
}

/** Edit an already answered question; keeps its linked fact in sync (or creates it). */
export async function editAnswer(question: WithId<Question>, answer: string, facts: WithId<Fact>[]) {
  const ts = nowIso();
  const negative = answer === NOT_APPLICABLE;
  await updateDocument("questions", question.id, { answer, answeredAt: ts });
  const existing = facts.find((f) => f.questionId === question.id);
  const text = factText(question.text, answer);
  if (existing) {
    await updateDocument("facts", existing.id, {
      text,
      updatedAt: ts,
      ...(negative ? { category: "negative" as FactCategory } : existing.category === "negative" ? { category: guessCategory(question.text) } : {}),
    });
  } else {
    await addDocument("facts", {
      text,
      category: guessCategory(question.text, negative),
      source: "answer",
      questionId: question.id,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  await logActivity("info", "answer", `Updated answer: ${shortText(question.text)}`);
}

export function dismissQuestion(question: WithId<Question>) {
  return updateDocument("questions", question.id, { status: "dismissed" });
}

export function reopenQuestion(question: WithId<Question>) {
  return updateDocument("questions", question.id, { status: "open" });
}
