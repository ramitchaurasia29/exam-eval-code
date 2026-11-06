import type { Criterion, Question, QType, Variant } from "./types";

// Helpers to keep the content readable
const c = (id: string, label: string, marks: number): Criterion => ({ id, label, marks });
const v = (
  text: string,
  hit: string[],
  confidence: number,
  feedback: string,
  explanation: string,
  flag?: Variant["flag"],
): Variant => ({ text, hit, confidence, feedback, explanation, flag });

interface QInput {
  id: string;
  number: string;
  text: string;
  type: QType;
  marks: number;
  page: number;
  answer: string;
  keyPoints?: string[];
  alternatives?: string[];
  steps?: string[];
  aiNote?: string;
  criteria: Criterion[];
  variants?: Variant[];
  extractionIssue?: string;
  answerApproved?: boolean;
}
const q = (i: QInput): Question => ({
  keyPoints: [],
  alternatives: [],
  variants: [],
  answerApproved: true,
  ...i,
});

/* ------------------------------------------------------------------ */
/* Class 10 Science Midterm, 40 marks                                 */
/* ------------------------------------------------------------------ */
export const SCIENCE_10_QUESTIONS: Question[] = [
  q({
    id: "sci-q01", number: "1", type: "mcq", marks: 1, page: 1,
    text: "Which gas is released during photosynthesis? (a) Carbon dioxide (b) Oxygen (c) Nitrogen (d) Hydrogen",
    answer: "(b) Oxygen",
    criteria: [c("c1", "Correct option", 1)],
    variants: [
      v("(b) Oxygen", ["c1"], 0.99, "Correct.", "Option (b) matches the answer key."),
      v("b", ["c1"], 0.97, "Correct.", "Option letter b matches the answer key."),
      v("(a) Carbon dioxide", [], 0.98, "Carbon dioxide is taken in, not released. The correct answer is oxygen.", "Option (a) does not match the key (b)."),
    ],
  }),
  q({
    id: "sci-q02", number: "2", type: "mcq", marks: 1, page: 1,
    text: "The pH of pure water at 25 °C is (a) 0 (b) 5 (c) 7 (d) 14",
    answer: "(c) 7",
    criteria: [c("c1", "Correct option", 1)],
    variants: [
      v("(c) 7", ["c1"], 0.99, "Correct.", "Option (c) matches the answer key."),
      v("c", ["c1"], 0.96, "Correct.", "Option letter c matches the answer key."),
      v("(d) 14", [], 0.97, "Pure water is neutral, so its pH is 7.", "Option (d) does not match the key (c)."),
    ],
  }),
  q({
    id: "sci-q03", number: "3", type: "fill", marks: 1, page: 1,
    text: "The functional unit of the kidney is the ______.",
    answer: "Nephron",
    alternatives: ["Nephrons", "Uriniferous tubule"],
    criteria: [c("c1", "Correct term", 1)],
    variants: [
      v("nephron", ["c1"], 0.96, "Correct.", "Normalised answer 'nephron' matches the key."),
      v("Nephrone", ["c1"], 0.78, "Correct term. Check the spelling: nephron.", "Minor spelling variation accepted as equivalent to 'nephron'.", "low_confidence"),
      v("neuron", [], 0.91, "A neuron is the unit of the nervous system. The kidney's unit is the nephron.", "'neuron' is a different term and does not match the key."),
    ],
  }),
  q({
    id: "sci-q04", number: "4", type: "truefalse", marks: 1, page: 1,
    text: "Rusting of iron is a physical change. (True / False)",
    answer: "False",
    criteria: [c("c1", "Correct choice", 1)],
    variants: [
      v("False", ["c1"], 0.99, "Correct.", "Matches the key: False."),
      v("F", ["c1"], 0.93, "Correct.", "'F' read as False; matches the key."),
      v("True", [], 0.98, "Rusting forms a new substance (iron oxide), so it is a chemical change.", "'True' does not match the key."),
    ],
  }),
  q({
    id: "sci-q05", number: "5", type: "short", marks: 3, page: 2,
    text: "Write the balanced chemical equation for the reaction of zinc with dilute hydrochloric acid. Name the gas evolved.",
    answer: "Zn + 2HCl → ZnCl₂ + H₂. Hydrogen gas is evolved.",
    keyPoints: ["Reactants Zn and HCl, products ZnCl₂ and H₂", "Coefficient 2 on HCl", "Gas evolved is hydrogen"],
    criteria: [c("c1", "Correct reactants and products", 1), c("c2", "Equation balanced", 1), c("c3", "Names hydrogen gas", 1)],
    variants: [
      v("Zn + 2HCl → ZnCl2 + H2↑\nThe gas evolved is hydrogen.", ["c1", "c2", "c3"], 0.93, "Well balanced and the gas is correctly named.", "Reactants and products correct; HCl coefficient 2 balances the equation; hydrogen named."),
      v("Zn + HCl → ZnCl2 + H2\nHydrogen gas comes out", ["c1", "c3"], 0.9, "Balance the equation: zinc needs 2HCl.", "Species correct and hydrogen named, but HCl coefficient missing so the equation is unbalanced."),
      v("Zn + HCl → ZnCl + H\nGas is chlorine", ["c1"], 0.74, "Zinc chloride is ZnCl₂ and the gas evolved is hydrogen, not chlorine.", "Reactants identified; product formulas incorrect; gas misidentified.", "low_confidence"),
    ],
  }),
  q({
    id: "sci-q06", number: "6", type: "long", marks: 5, page: 3,
    text: "Describe the process of photosynthesis. Mention the raw materials required and the products formed.",
    answer: "Photosynthesis is the process by which green plants make glucose from carbon dioxide and water using sunlight absorbed by chlorophyll, releasing oxygen. 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (in presence of sunlight and chlorophyll).",
    keyPoints: ["Definition: green plants prepare food", "Sunlight provides energy", "Chlorophyll absorbs light", "Raw materials: CO₂ and water", "Products: glucose and oxygen"],
    criteria: [c("c1", "Definition", 1), c("c2", "Role of sunlight", 1), c("c3", "Chlorophyll", 1), c("c4", "Raw materials (CO₂, water)", 1), c("c5", "Products (glucose, oxygen)", 1)],
    variants: [
      v("Photosynthesis is the process in which green plants make their own food. Chlorophyll in leaves absorbs sunlight energy. Carbon dioxide from air and water from soil are used to make glucose and oxygen is released.\n6CO2 + 6H2O → C6H12O6 + 6O2", ["c1", "c2", "c3", "c4", "c5"], 0.88, "Complete answer covering every stage. Good use of the equation.", "All five rubric points present: definition, sunlight, chlorophyll, both raw materials and both products."),
      v("Plants make food using sunlight. They take carbon dioxide and water and make glucose. Oxygen goes out from leaves.", ["c1", "c2", "c4", "c5"], 0.84, "Mention the role of chlorophyll in absorbing light.", "Definition, sunlight, raw materials and products present. Chlorophyll not mentioned."),
      v("Plants make food in leaves with the help of sun... [smudged] ...gives oxygen", ["c2"], 0.41, "Write more clearly and include the raw materials, chlorophyll and products.", "Large part of the answer is smudged and unreadable. Only the role of sunlight could be confirmed.", "unreadable"),
    ],
  }),
  q({
    id: "sci-q07", number: "7", type: "numerical", marks: 4, page: 4,
    text: "A wire of resistance 10 Ω is stretched to twice its original length. Assuming its volume stays constant, find its new resistance.",
    answer: "40 Ω",
    steps: ["R = ρl/A", "Volume constant: l' = 2l, so A' = A/2", "R' = ρ(2l)/(A/2) = 4ρl/A = 4R", "R' = 4 × 10 Ω = 40 Ω"],
    criteria: [c("c1", "Uses R = ρl/A", 1), c("c2", "New length and area", 1), c("c3", "Working shows R' = 4R", 1), c("c4", "Final answer with unit", 1)],
    variants: [
      v("R = ρl/A\nl' = 2l, A' = A/2\nR' = ρ(2l)/(A/2) = 4R\nR' = 4 × 10 = 40 Ω", ["c1", "c2", "c3", "c4"], 0.92, "Clear working and correct answer with unit.", "Formula, changed dimensions, ratio working and final answer all present."),
      v("R ∝ l\nlength doubles so R' = 2 × 10 = 20 Ω", ["c1"], 0.89, "When the wire is stretched its area also halves, so resistance becomes 4 times.", "Proportionality used, but the change in area was ignored, giving 20 Ω."),
      v("R' = 4R because l doubles and A halves\n= 40 ohm", ["c2", "c3", "c4"], 0.86, "Correct result. Write the formula R = ρl/A first.", "Valid reasoning and answer; formula not stated explicitly."),
    ],
  }),
  q({
    id: "sci-q08", number: "8", type: "diagram", marks: 5, page: 5,
    text: "Draw a neat, labelled diagram of the human heart showing its four chambers.",
    answer: "Diagram with right atrium, right ventricle, left atrium, left ventricle, aorta, pulmonary artery, vena cava and arrows showing blood flow.",
    keyPoints: ["Correct outline", "Four chambers labelled", "Major vessels labelled", "Direction of blood flow"],
    criteria: [c("c1", "Correct outline", 1), c("c2", "Four chambers labelled", 2), c("c3", "Major vessels labelled", 1), c("c4", "Direction of blood flow", 1)],
    variants: [
      v("[Diagram] Labels: Right atrium, Left atrium, Right ventricle, Left ventricle, Aorta, Vena cava, Pulmonary artery. Arrows shown.", ["c1", "c2", "c3", "c4"], 0.81, "Neat diagram with all labels and flow arrows.", "Outline correct; four chambers and major vessels labelled; arrows show circulation."),
      v("[Diagram] Labels: Right atrium, Left atrium, Right ventricle, Left ventricle", ["c1", "c2"], 0.77, "Label the major blood vessels and show the direction of blood flow.", "Outline and chambers correct; vessels and flow arrows missing."),
      v("[Diagram] Labels unclear: 'atrium', 'ventrical', one arrow", ["c1"], 0.58, "Labels are hard to read. Name each chamber clearly.", "Outline recognisable but labels are partly illegible, so chamber labelling could not be confirmed.", "low_confidence"),
    ],
  }),
  q({
    id: "sci-q09", number: "9", type: "short", marks: 3, page: 6,
    text: "State Ohm's law. Write the SI unit of resistance.",
    answer: "At constant temperature, the current through a conductor is directly proportional to the potential difference across its ends (V = IR). SI unit of resistance: ohm (Ω).",
    criteria: [c("c1", "Statement with constant temperature", 2), c("c2", "SI unit ohm", 1)],
    variants: [
      v("At constant temperature, current I flowing through a conductor is directly proportional to potential difference V. V = IR. Unit of resistance is ohm (Ω).", ["c1", "c2"], 0.94, "Precise statement and correct unit.", "Statement includes the constant temperature condition; unit correct."),
      v("V = IR. Current is proportional to voltage. Unit is ohm.", ["c2"], 0.87, "State the condition of constant temperature in Ohm's law.", "Relation given but the statement lacks the constant temperature condition; awarded the unit mark only."),
      v("Ohm's law says resistance is voltage into current. Unit is volt.", [], 0.9, "Resistance is V/I, not V × I, and its unit is the ohm.", "Statement incorrect and unit incorrect."),
    ],
  }),
  q({
    id: "sci-q10", number: "10", type: "long", marks: 5, page: 6,
    text: "With the help of a ray diagram, explain the refraction of light through a rectangular glass slab.",
    answer: "Light bends towards the normal when entering glass and away from the normal when leaving. The emergent ray is parallel to the incident ray but laterally displaced.",
    criteria: [c("c1", "Ray diagram", 2), c("c2", "Bends towards normal on entry", 1), c("c3", "Bends away on emergence", 1), c("c4", "Emergent ray parallel, lateral displacement", 1)],
    variants: [
      v("[Ray diagram] When light enters glass slab it bends towards the normal. When it comes out into air it bends away from normal. Emergent ray is parallel to incident ray and is shifted sideways (lateral displacement).", ["c1", "c2", "c3", "c4"], 0.86, "Excellent. Diagram and explanation are both complete.", "Diagram present; both bends explained; lateral displacement named."),
      v("[Ray diagram] Light bends towards normal in glass and away from normal in air.", ["c1", "c2", "c3"], 0.83, "Mention that the emergent ray is parallel to the incident ray.", "Diagram and both bends present; no mention of parallel emergent ray or lateral displacement."),
      v("Light bends when it goes from air to glass because speed changes.", ["c2"], 0.8, "Draw the ray diagram and explain the bend at both surfaces.", "No diagram; only refraction at entry described."),
    ],
  }),
  q({
    id: "sci-q11", number: "11", type: "numerical", marks: 4, page: 7,
    text: "An object is placed 20 cm in front of a concave mirror of focal length 15 cm. Find the position of the image.",
    answer: "v = −60 cm (image is real, inverted, 60 cm in front of the mirror)",
    steps: ["1/v + 1/u = 1/f", "u = −20 cm, f = −15 cm", "1/v = −1/15 + 1/20 = −1/60", "v = −60 cm"],
    criteria: [c("c1", "Mirror formula", 1), c("c2", "Correct sign convention", 1), c("c3", "Calculation", 1), c("c4", "Final answer with nature of image", 1)],
    variants: [
      v("1/v + 1/u = 1/f\nu = −20, f = −15\n1/v = −1/15 + 1/20 = −1/60\nv = −60 cm. Image is real and inverted.", ["c1", "c2", "c3", "c4"], 0.91, "Correct formula, signs and answer.", "All steps and the nature of image present."),
      v("1/v = 1/f − 1/u = 1/15 − 1/20 = 1/60\nv = 60 cm", ["c1", "c3"], 0.85, "Use the sign convention: u and f are negative for a concave mirror, so v = −60 cm.", "Formula and arithmetic correct but sign convention ignored; final answer sign incorrect."),
      v("v = −60 cm (written next to Q10)", ["c4"], 0.52, "Show the formula and working for the mirror problem.", "Final value found on the page but placed beside Question 10, so mapping is uncertain and no working is visible.", "ambiguous_mapping"),
    ],
  }),
  q({
    id: "sci-q12", number: "12", type: "passage", marks: 3, page: 8,
    text: "Read the passage on waste management. Classify banana peel and polythene bag as biodegradable or non-biodegradable, giving one reason.",
    answer: "Banana peel: biodegradable. Polythene bag: non-biodegradable. Reason: microorganisms can break down banana peel but not polythene.",
    criteria: [c("c1", "Banana peel classified", 1), c("c2", "Polythene classified", 1), c("c3", "Reason linked to the passage", 1)],
    variants: [
      v("Banana peel: biodegradable. Polythene: non-biodegradable because bacteria cannot decompose it.", ["c1", "c2", "c3"], 0.93, "Correct and well reasoned.", "Both classifications and a valid reason present."),
      v("Banana peel is biodegradable, polythene is non biodegradable.", ["c1", "c2"], 0.92, "Give a reason from the passage for your classification.", "Both classifications correct; no reason given."),
      v("Both are biodegradable as they come from nature.", [], 0.88, "Polythene is non-biodegradable: microorganisms cannot break it down.", "Polythene misclassified; reason does not match the passage."),
    ],
  }),
  q({
    id: "sci-q13", number: "13", type: "short", marks: 4, page: 8,
    text: "Why is double circulation necessary in human beings? Explain briefly.",
    answer: "It keeps oxygenated and deoxygenated blood separate, giving an efficient oxygen supply needed for high energy needs of warm-blooded humans. Blood passes through the heart twice: pulmonary and systemic circulation.",
    keyPoints: ["Separation of oxygenated and deoxygenated blood", "Efficient oxygen supply", "High energy needs, constant body temperature", "Pulmonary and systemic pathways"],
    criteria: [c("c1", "Separates oxygenated and deoxygenated blood", 1), c("c2", "Efficient oxygen supply", 1), c("c3", "High energy needs / warm-blooded", 1), c("c4", "Pulmonary and systemic pathways", 1)],
    variants: [
      v("In double circulation blood goes through heart twice: heart to lungs (pulmonary) and heart to body (systemic). Oxygenated and deoxygenated blood do not mix, so body gets efficient oxygen supply. Humans need a lot of energy to keep body temperature constant.", ["c1", "c2", "c3", "c4"], 0.9, "Thorough explanation with both pathways.", "All four rubric points present."),
      v("Oxygenated and deoxygenated blood do not mix so more oxygen reaches the body.", ["c1", "c2"], 0.88, "Explain why humans need this and name the two circulation pathways.", "Separation and efficiency present; energy needs and pathways absent."),
      v("Fish have single circulation but we have double. Mammals and birds need energy for flight and warmth so their heart has 4 chambers.", ["c3"], 0.63, "Answer the question for humans and explain the separation of blood.", "Comparison with fish and birds goes beyond the question; energy need noted. Out-of-syllabus content flagged for teacher judgement.", "out_of_syllabus"),
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Class 10 English Unit Test 1, 20 marks (completed)                 */
/* ------------------------------------------------------------------ */
export const ENGLISH_10_QUESTIONS: Question[] = [
  q({
    id: "eng-q01", number: "1", type: "short", marks: 3, page: 1,
    text: "Why did Lencho write a letter to God? (A Letter to God)",
    answer: "A hailstorm destroyed his crop. He had faith in God and asked for 100 pesos to sow his field again and survive until the next harvest.",
    criteria: [c("c1", "Hailstorm destroyed crop", 1), c("c2", "Faith in God", 1), c("c3", "Asked for 100 pesos", 1)],
    variants: [
      v("Hailstorm destroyed Lencho's crops. He had firm faith in God so he wrote asking for 100 pesos.", ["c1", "c2", "c3"], 0.92, "Complete answer.", "All three points present."),
      v("His crops were destroyed by hail so he wrote to God for help.", ["c1", "c2"], 0.9, "Mention what Lencho asked for.", "Cause and faith present; request amount missing."),
      v("Lencho wanted money from the postmaster.", [], 0.85, "Lencho wrote to God, not the postmaster, after the hailstorm.", "Answer misreads the story."),
    ],
  }),
  q({
    id: "eng-q02", number: "2", type: "fill", marks: 2, page: 1,
    text: "Fill in the blanks with the correct form of the verb: She ____ (go) to school every day. They ____ (play) cricket yesterday.",
    answer: "goes; played",
    criteria: [c("c1", "goes", 1), c("c2", "played", 1)],
    variants: [
      v("goes, played", ["c1", "c2"], 0.97, "Correct.", "Both verb forms correct."),
      v("go, played", ["c2"], 0.95, "Use 'goes' with she in the simple present.", "Subject-verb agreement error in the first blank."),
      v("goes, plays", ["c1"], 0.95, "'Yesterday' needs the past tense: played.", "Tense error in the second blank."),
    ],
  }),
  q({
    id: "eng-q03", number: "3", type: "long", marks: 6, page: 2,
    text: "What were Nelson Mandela's views on courage? (Long Walk to Freedom)",
    answer: "Courage is not the absence of fear but the triumph over it. The brave man is not one who does not feel afraid, but one who conquers that fear.",
    criteria: [c("c1", "Courage is triumph over fear", 2), c("c2", "Brave man conquers fear", 2), c("c3", "Link to his struggle", 2)],
    variants: [
      v("Mandela learnt that courage was not the absence of fear but triumph over it. A brave man conquers fear. He saw this in comrades who risked their lives for freedom.", ["c1", "c2", "c3"], 0.87, "Insightful answer linked to the text.", "All points present."),
      v("Courage means not being afraid. Mandela was brave.", [], 0.82, "Mandela said courage is the triumph over fear, not its absence.", "Contradicts the text."),
      v("Courage is triumph over fear. Brave people conquer their fear.", ["c1", "c2"], 0.86, "Link his views to his own struggle.", "Core view stated; no link to his life."),
    ],
  }),
  q({
    id: "eng-q04", number: "4", type: "passage", marks: 4, page: 3,
    text: "Read the unseen passage on monsoon farming and answer the four questions that follow.",
    answer: "(a) June (b) Paddy (c) Erratic rainfall (d) Rainwater harvesting",
    criteria: [c("c1", "(a)", 1), c("c2", "(b)", 1), c("c3", "(c)", 1), c("c4", "(d)", 1)],
    variants: [
      v("(a) June (b) Paddy (c) Erratic rain (d) Rainwater harvesting", ["c1", "c2", "c3", "c4"], 0.94, "All correct.", "Four of four correct."),
      v("(a) June (b) Wheat (c) Erratic rain (d) Canals", ["c1", "c3"], 0.92, "Re-read paragraphs 2 and 4 for (b) and (d).", "Two of four correct."),
      v("(a) July (b) Paddy (c) Floods (d) Rainwater harvesting", ["c2", "c4"], 0.91, "Check the month and the problem named in the passage.", "Two of four correct."),
    ],
  }),
  q({
    id: "eng-q05", number: "5", type: "long", marks: 5, page: 4,
    text: "Write a letter to the editor of a newspaper about the problem of stray animals in your locality.",
    answer: "Formal letter format, clear description of the problem, effects, and suggestions; appropriate tone and expression.",
    criteria: [c("c1", "Format", 1), c("c2", "Content", 3), c("c3", "Expression", 1)],
    variants: [
      v("[Formal letter] Sender's address, date, editor's address, subject, salutation... describes accidents, suggests shelters and sterilisation drives.", ["c1", "c2", "c3"], 0.79, "Well organised letter with practical suggestions.", "Format, content and expression meet the rubric."),
      v("[Letter] Missing subject line; content describes the problem, two suggestions.", ["c2", "c3"], 0.76, "Include the subject line and full format.", "Content and expression fine; format incomplete."),
      v("[Letter] Informal tone, short content.", ["c1"], 0.72, "Use a formal tone and develop the content with causes and solutions.", "Format present; content thin; informal expression."),
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Class 10 Mathematics Unit Test 2, 25 marks (ready for upload)       */
/* ------------------------------------------------------------------ */
export const MATHS_10_QUESTIONS: Question[] = [
  q({
    id: "mat-q01", number: "1", type: "mcq", marks: 1, page: 1,
    text: "The HCF of 96 and 404 is (a) 4 (b) 12 (c) 8 (d) 16",
    answer: "(a) 4",
    criteria: [c("c1", "Correct option", 1)],
    variants: [
      v("(a) 4", ["c1"], 0.99, "Correct.", "Matches the key."),
      v("a", ["c1"], 0.96, "Correct.", "Matches the key."),
      v("(b) 12", [], 0.97, "Use prime factorisation: 96 = 2⁵ × 3, 404 = 2² × 101, so HCF = 4.", "Does not match the key."),
    ],
  }),
  q({
    id: "mat-q02", number: "2", type: "fill", marks: 1, page: 1,
    text: "The sum of the zeroes of x² − 5x + 6 is ______.",
    answer: "5",
    criteria: [c("c1", "Correct value", 1)],
    variants: [
      v("5", ["c1"], 0.98, "Correct.", "Matches the key."),
      v("−b/a = 5", ["c1"], 0.95, "Correct.", "Equivalent to the key."),
      v("6", [], 0.96, "6 is the product of zeroes. The sum is −b/a = 5.", "Does not match the key."),
    ],
  }),
  q({
    id: "mat-q03", number: "3", type: "short", marks: 3, page: 2,
    text: "Find the roots of 2x² − 7x + 3 = 0 by factorisation.",
    answer: "x = 3, x = 1/2",
    steps: ["2x² − 6x − x + 3 = 0", "2x(x − 3) − 1(x − 3) = 0", "(2x − 1)(x − 3) = 0 → x = 1/2, 3"],
    criteria: [c("c1", "Splits the middle term", 1), c("c2", "Factorises", 1), c("c3", "Both roots", 1)],
    variants: [
      v("2x² − 6x − x + 3 = 0\n(2x − 1)(x − 3) = 0\nx = 1/2, 3", ["c1", "c2", "c3"], 0.93, "Correct.", "All steps present."),
      v("(2x − 1)(x − 3) = 0\nx = 3", ["c2"], 0.88, "Find both roots and show the middle-term split.", "Factorised correctly but only one root stated."),
      v("Using formula x = [7 ± √(49 − 24)]/4 = 3, 1/2", ["c3"], 0.84, "The question asks for factorisation.", "Correct roots by a different method; flagged for teacher judgement on method.", "out_of_syllabus"),
    ],
  }),
  q({
    id: "mat-q04", number: "4", type: "numerical", marks: 4, page: 3,
    text: "Find the 20th term of the AP 3, 8, 13, …",
    answer: "98",
    steps: ["aₙ = a + (n − 1)d", "a = 3, d = 5", "a₂₀ = 3 + 19 × 5", "= 98"],
    criteria: [c("c1", "Formula", 1), c("c2", "a and d", 1), c("c3", "Substitution", 1), c("c4", "Answer", 1)],
    variants: [
      v("an = a + (n−1)d, a = 3, d = 5\na20 = 3 + 19(5) = 98", ["c1", "c2", "c3", "c4"], 0.95, "Correct.", "All steps present."),
      v("a20 = 3 + 20 × 5 = 103", ["c2"], 0.9, "Use (n − 1)d, not nd.", "Formula misapplied."),
      v("d = 5, a20 = 98", ["c2", "c4"], 0.86, "Show the formula and substitution.", "Correct answer without working."),
    ],
  }),
  q({
    id: "mat-q05", number: "5", type: "long", marks: 5, page: 4,
    text: "A 10 m ladder reaches a window 8 m above the ground. Find the distance of its foot from the wall. State the theorem used.",
    answer: "6 m, using Pythagoras theorem",
    criteria: [c("c1", "States Pythagoras theorem", 2), c("c2", "Sets up the triangle", 1), c("c3", "Calculation", 1), c("c4", "Answer with unit", 1)],
    variants: [
      v("By Pythagoras theorem, in a right triangle, hyp² = base² + perp².\n10² = 8² + x², x² = 36, x = 6 m", ["c1", "c2", "c3", "c4"], 0.93, "Correct.", "All steps present."),
      v("x² = 100 − 64 = 36, x = 6", ["c2", "c3"], 0.88, "State the theorem and write the unit.", "Calculation correct; theorem and unit missing."),
      v("x = 10 − 8 = 2 m", [], 0.92, "Use Pythagoras theorem for the right triangle.", "Incorrect method."),
    ],
  }),
  q({
    id: "mat-q06", number: "6", type: "numerical", marks: 4, page: 5,
    text: "Find the area of a sector of a circle with radius 7 cm and angle 90°.",
    answer: "38.5 cm²",
    criteria: [c("c1", "Formula", 1), c("c2", "Substitution", 1), c("c3", "Calculation", 1), c("c4", "Answer with unit", 1)],
    variants: [
      v("A = θ/360 × πr² = 90/360 × 22/7 × 49 = 38.5 cm²", ["c1", "c2", "c3", "c4"], 0.95, "Correct.", "All steps present."),
      v("A = 1/4 × 22/7 × 7 × 7 = 38.5", ["c1", "c2", "c3"], 0.9, "Write the unit cm².", "Unit missing."),
      v("A = 90/360 × 2πr = 11 cm", ["c2"], 0.87, "That is the arc length. Area uses πr².", "Wrong formula."),
    ],
  }),
  q({
    id: "mat-q07", number: "7", type: "long", marks: 7, page: 6,
    text: "Prove that the lengths of tangents drawn from an external point to a circle are equal.",
    answer: "Join OP, OQ, OR. Triangles OQP and ORP are congruent (RHS), so PQ = PR.",
    criteria: [c("c1", "Figure", 2), c("c2", "Given and to prove", 1), c("c3", "Construction", 1), c("c4", "Proof steps", 2), c("c5", "Conclusion", 1)],
    variants: [
      v("[Figure] Given, To prove, Construction: join OP, OQ, OR. ∠OQP = ∠ORP = 90°, OQ = OR, OP common. ΔOQP ≅ ΔORP (RHS). PQ = PR.", ["c1", "c2", "c3", "c4", "c5"], 0.84, "Complete proof.", "All parts present."),
      v("[Figure] OQ = OR radii, OP common, so triangles congruent and PQ = PR.", ["c1", "c4", "c5"], 0.8, "Write the given, to prove and construction.", "Proof skeleton present; given/construction missing."),
      v("[Figure only]", ["c1"], 0.66, "Write the proof steps.", "Figure only.", "low_confidence"),
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Class 9 Mathematics Midterm (rubric pending: AI draft has a mismatch)*/
/* ------------------------------------------------------------------ */
export const MATHS_9_QUESTIONS: Question[] = [
  q({
    id: "m9-q01", number: "1", type: "mcq", marks: 1, page: 1,
    text: "Every rational number is (a) a natural number (b) an integer (c) a real number (d) a whole number",
    answer: "(c) a real number",
    criteria: [c("c1", "Correct option", 1)],
  }),
  q({
    id: "m9-q02", number: "2", type: "short", marks: 3, page: 1,
    text: "Find three rational numbers between 3/5 and 4/5.",
    answer: "Any three, for example 31/50, 32/50, 33/50",
    alternatives: ["13/20, 7/10, 3/4", "Any three valid rationals in the interval"],
    criteria: [c("c1", "Method (equivalent fractions or averaging)", 1), c("c2", "Three correct numbers", 2)],
  }),
  q({
    id: "m9-q03", number: "3", type: "numerical", marks: 4, page: 2,
    text: "Find the area of a triangle with sides 8 cm, 11 cm and 13 cm using Heron's formula.",
    answer: "≈ 43.82 cm² (s = 16, Area = √(16 × 8 × 5 × 3) = √1920 ≈ 43.82 cm²)",
    steps: ["s = (8 + 11 + 13)/2 = 16", "Area = √[s(s − a)(s − b)(s − c)]", "= √(16 × 8 × 5 × 3) = √1920", "≈ 43.82 cm²"],
    criteria: [c("c1", "Semi-perimeter", 1), c("c2", "Heron's formula", 1), c("c3", "Substitution and simplification", 1), c("c4", "Answer with unit", 2)],
  }),
  q({
    id: "m9-q04", number: "4", type: "long", marks: 5, page: 3,
    text: "Prove that the angles opposite to equal sides of an isosceles triangle are equal.",
    answer: "Draw the bisector of ∠A meeting BC at D. ΔBAD ≅ ΔCAD (SAS), so ∠B = ∠C.",
    criteria: [c("c1", "Figure", 1), c("c2", "Given, to prove, construction", 1), c("c3", "Congruence with rule", 2), c("c4", "Conclusion", 1)],
  }),
];

/* ------------------------------------------------------------------ */
/* Class 9 Science Unit Test 2 (answer key pending)                    */
/* ------------------------------------------------------------------ */
export const SCIENCE_9_QUESTIONS: Question[] = [
  q({ id: "s9-q01", number: "1", type: "mcq", marks: 1, page: 1, text: "The SI unit of force is (a) joule (b) newton (c) watt (d) pascal", answer: "", answerApproved: false, criteria: [] }),
  q({ id: "s9-q02", number: "2", type: "short", marks: 2, page: 1, text: "State Newton's second law of motion.", answer: "", answerApproved: false, criteria: [] }),
  q({ id: "s9-q03", number: "3", type: "numerical", marks: 3, page: 1, text: "A car accelerates uniformly from 18 km/h to 36 km/h in 5 s. Find its acceleration.", answer: "", answerApproved: false, criteria: [] }),
  q({ id: "s9-q04", number: "4", type: "long", marks: 5, page: 2, text: "Explain why an athlete runs some distance before taking a long jump. Relate your answer to inertia.", answer: "", answerApproved: false, criteria: [] }),
  q({ id: "s9-q05", number: "5", type: "diagram", marks: 4, page: 2, text: "Draw a labelled diagram of a plant cell.", answer: "", answerApproved: false, criteria: [] }),
];

/** AI-generated drafts for the Class 9 Science key; used by generateAnswerKey */
export const SCIENCE_9_AI_KEY: Record<string, Pick<Question, "answer" | "keyPoints" | "steps" | "aiNote" | "alternatives">> = {
  "s9-q01": { answer: "(b) newton", keyPoints: [], alternatives: [] },
  "s9-q02": { answer: "The rate of change of momentum of an object is proportional to the applied force and takes place in the direction of the force. F = ma.", keyPoints: ["Rate of change of momentum", "Proportional to applied force", "Direction of force", "F = ma"], alternatives: [] },
  "s9-q03": { answer: "1 m/s²", steps: ["u = 18 km/h = 5 m/s, v = 36 km/h = 10 m/s", "a = (v − u)/t", "a = (10 − 5)/5 = 1 m/s²"], keyPoints: [], alternatives: [] },
  "s9-q04": { answer: "Running builds up speed. Due to inertia of motion the athlete's body tends to keep moving forward after take-off, helping him jump farther.", keyPoints: ["Gains speed by running", "Inertia of motion", "Body continues forward", "Longer jump"], alternatives: [], aiNote: "The question could also expect momentum. Consider accepting answers that explain it through momentum." },
  "s9-q05": { answer: "Cell wall, cell membrane, nucleus, cytoplasm, vacuole, chloroplast, mitochondria.", keyPoints: ["Cell wall", "Large central vacuole", "Chloroplasts", "Nucleus", "Labels"], alternatives: [] },
};

/* ------------------------------------------------------------------ */
/* Class 8 Social Science Unit Test 2 (draft, extraction review)       */
/* ------------------------------------------------------------------ */
export const SST_8_QUESTIONS: Question[] = [
  q({ id: "sst-q01", number: "1", type: "mcq", marks: 1, page: 1, text: "The Battle of Plassey was fought in (a) 1757 (b) 1764 (c) 1857 (d) 1772", answer: "", answerApproved: false, criteria: [] }),
  q({ id: "sst-q02", number: "2", type: "short", marks: 3, page: 1, text: "What was the subsidiary alliance? Name two states that accepted it.", answer: "", answerApproved: false, criteria: [] }),
  q({ id: "sst-q03", number: "3", type: "short", marks: 3, page: 1, text: "Explain the term 'resource'. Give two examples of human-made resources.", answer: "", answerApproved: false, criteria: [], extractionIssue: "Marks not found next to the question. AI assumed 3 from the section heading." }),
  q({ id: "sst-q04", number: "?", type: "long", marks: 5, page: 2, text: "Describe the main features of the Permanent Settlement of 1793.", answer: "", answerApproved: false, criteria: [], extractionIssue: "Question number unreadable on page 2. Confirm or change the number." }),
  q({ id: "sst-q05", number: "5", type: "passage", marks: 4, page: 2, text: "Read the source on the revolt of 1857 and answer the questions that follow.", answer: "", answerApproved: false, criteria: [] }),
];
