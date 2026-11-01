import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  initialAnswers,
  isAnswered,
  type Paper,
  type PaperQuestion,
} from "./examPaper";

const base: PaperQuestion = {
  id: "q",
  type: "multiple_choice",
  content: "",
  image_path: null,
  points: 1,
  options: [],
  lefts: [],
  rights: [],
  subs: [],
  answer: null,
};

describe("isAnswered", () => {
  it("PG/BS: opsi dipilih", () => {
    expect(isAnswered(base, {})).toBe(false);
    expect(isAnswered(base, { q: { selected_option_id: "o1" } })).toBe(true);
  });

  it("isian/essay: teks tidak kosong", () => {
    const q = { ...base, type: "essay" as const };
    expect(isAnswered(q, { q: { answer_text: "   " } })).toBe(false);
    expect(isAnswered(q, { q: { answer_text: "ya" } })).toBe(true);
  });

  it("menjodohkan: semua kiri terisi", () => {
    const q = {
      ...base,
      type: "matching" as const,
      lefts: [
        { id: "l1", text: "a" },
        { id: "l2", text: "b" },
      ],
    };
    expect(isAnswered(q, { q: { answer_json: { l1: "k1" } } })).toBe(false);
    expect(isAnswered(q, { q: { answer_json: { l1: "k1", l2: "k2" } } })).toBe(
      true,
    );
  });

  it("multi essay: semua sub-soal terisi", () => {
    const q = {
      ...base,
      type: "multi_essay" as const,
      subs: [
        { id: "s1", content: "", points: 1, answer: null },
        { id: "s2", content: "", points: 1, answer: null },
      ],
    };
    expect(isAnswered(q, { s1: { answer_text: "x" } })).toBe(false);
    expect(
      isAnswered(q, { s1: { answer_text: "x" }, s2: { answer_text: "y" } }),
    ).toBe(true);
  });
});

it("initialAnswers: jawaban soal & sub-soal dari server", () => {
  const paper = {
    questions: [
      { ...base, answer: { selected_option_id: "o1" } },
      {
        ...base,
        id: "m",
        type: "multi_essay",
        subs: [
          { id: "s1", content: "", points: 1, answer: { answer_text: "x" } },
        ],
      },
    ],
  } as Paper;
  expect(initialAnswers(paper)).toEqual({
    q: { selected_option_id: "o1" },
    s1: { answer_text: "x" },
  });
});

it("formatCountdown", () => {
  expect(formatCountdown(-5000)).toBe("00:00");
  expect(formatCountdown(65_000)).toBe("01:05");
  expect(formatCountdown(3_725_000)).toBe("1:02:05");
});
