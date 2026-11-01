// Content types for Ask (spec 005): suggestion chips (`ask.json`, FR-410) and the about corpus
// (`about.json`, FR-435). Pure types; the rules live in `validate/ask.ts`.

export const ASK_TOPICS = ['work', 'process', 'experience', 'personal'] as const;
export type AskTopic = (typeof ASK_TOPICS)[number];

/** One suggested question with Eric's written answer (FR-410, FR-411). */
export interface AskChip {
  readonly id: string;
  readonly label: string;
  readonly topic: AskTopic;
  /** Paragraphs, rendered with `textContent`. */
  readonly answer: readonly string[];
  /** Non-draft project slugs, rendered as "Open: <title>" buttons. */
  readonly related: readonly string[];
  /** Chip ids shown after this answer. */
  readonly followups: readonly string[];
}

export interface AskChips {
  readonly chips: readonly AskChip[];
}

/** One section of the about corpus. Only what is here is answerable as "personal" (FR-435, AQ4). */
export interface AboutSection {
  readonly id: string;
  readonly topic: AskTopic;
  readonly title: string;
  readonly text: string;
}

export interface About {
  readonly sections: readonly AboutSection[];
}
