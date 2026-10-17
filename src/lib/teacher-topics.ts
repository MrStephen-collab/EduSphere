// Topic-level weak/strong spot detection for a teacher's classes (spec 75).
//
// An examination answer is tied to a question, and a question carries a topic.
// Rolling those answers up by topic tells a teacher which topics their class is
// actually getting wrong — the actionable view a raw percentage per exam hides.
// Kept pure so it can be unit-tested without a database.

/** A topic needs at least this many answers before it is reported. */
export const MIN_TOPIC_ANSWERS = 5;

/** How many topics to surface at each end. */
export const TOP_TOPIC_LIMIT = 5;

export type TeacherTopicStat = {
  topic: string;
  /** Percentage of answers correct on this topic (lower = weaker). */
  average: number;
  answers: number;
};

export type TopicAnswerRow = {
  topic: string | null;
  correct: boolean;
};

/**
 * Groups answered questions by topic and returns them ordered weakest first.
 * Topics with fewer than {@link MIN_TOPIC_ANSWERS} answers are dropped so a
 * single wrong answer never reads as a weakness.
 */
export function computeTopicStats(rows: TopicAnswerRow[]): TeacherTopicStat[] {
  const buckets = new Map<string, { answers: number; correct: number }>();
  for (const row of rows) {
    const topic = row.topic?.trim();
    if (!topic) continue;
    const bucket = buckets.get(topic) ?? { answers: 0, correct: 0 };
    bucket.answers += 1;
    if (row.correct) bucket.correct += 1;
    buckets.set(topic, bucket);
  }

  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.answers >= MIN_TOPIC_ANSWERS)
    .map(([topic, bucket]) => ({
      topic,
      average: Math.round((bucket.correct / bucket.answers) * 100),
      answers: bucket.answers,
    }))
    .sort((a, b) => a.average - b.average);
}

/** The weakest topics (lowest accuracy), most in need of reteaching. */
export function weakTopics(stats: TeacherTopicStat[]): TeacherTopicStat[] {
  return stats.slice(0, TOP_TOPIC_LIMIT);
}

/** The strongest topics (highest accuracy), for reassurance and contrast. */
export function strongTopics(stats: TeacherTopicStat[]): TeacherTopicStat[] {
  return [...stats].reverse().slice(0, TOP_TOPIC_LIMIT);
}
