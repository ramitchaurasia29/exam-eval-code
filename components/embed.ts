/** Passed to the setup screens when they render as a step inside the create-assessment wizard. */
export type Embed = {
  id: string;
  onNext: () => void;
  goStep: (step: "paper" | "answer-key" | "rubric") => void;
};
