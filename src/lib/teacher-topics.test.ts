import { describe, expect, it } from "vitest";
import {
  computeTopicStats,
  MIN_TOPIC_ANSWERS,
  strongTopics,
  weakTopics,
  type TopicAnswerRow,
} from "./teacher-topics";

function rows(topic: string, correct: number, wrong: number): TopicAnswerRow[] {
  return [
    ...Array.from({ length: correct }, () => ({ topic, correct: true })),
    ...Array.from({ length: wrong }, () => ({ topic, correct: false })),
  ];
}

describe("computeTopicStats", () => {
  it("computes accuracy per topic and orders weakest first", () => {
    const stats = computeTopicStats([
      ...rows("Fractions", 2, 8),
      ...rows("Algebra", 9, 1),
    ]);
    expect(stats.map((s) => s.topic)).toEqual(["Fractions", "Algebra"]);
    expect(stats[0]).toEqual({ topic: "Fractions", average: 20, answers: 10 });
    expect(stats[1]).toEqual({ topic: "Algebra", average: 90, answers: 10 });
  });

  it("drops topics with too few answers to be meaningful", () => {
    const stats = computeTopicStats([
      ...rows("Fractions", 0, MIN_TOPIC_ANSWERS - 1),
      ...rows("Algebra", 0, MIN_TOPIC_ANSWERS),
    ]);
    expect(stats.map((s) => s.topic)).toEqual(["Algebra"]);
  });

  it("ignores rows without a topic", () => {
    const stats = computeTopicStats([
      ...rows("Fractions", 0, 6),
      { topic: null, correct: false },
      { topic: "   ", correct: false },
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0].answers).toBe(6);
  });

  it("returns nothing when there are no answers", () => {
    expect(computeTopicStats([])).toEqual([]);
  });
});

describe("weakTopics / strongTopics", () => {
  it("returns weakest first and strongest first respectively", () => {
    const stats = computeTopicStats([
      ...rows("Weak", 1, 9),
      ...rows("Middle", 5, 5),
      ...rows("Strong", 9, 1),
    ]);
    expect(weakTopics(stats)[0].topic).toBe("Weak");
    expect(strongTopics(stats)[0].topic).toBe("Strong");
  });

  it("caps the list length", () => {
    const many = computeTopicStats(
      Array.from({ length: 8 }, (_, i) => rows(`Topic ${i}`, i, 9 - i)).flat(),
    );
    expect(weakTopics(many).length).toBeLessThanOrEqual(5);
    expect(strongTopics(many).length).toBeLessThanOrEqual(5);
  });
});
