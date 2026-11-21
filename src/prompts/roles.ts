// A seat at the table. `c` is the on-screen colour token, `pdf` the fixed colour used in reports,
// `focus` the short description shown in the panel, and `brief` the role text sent in every prompt.
export interface Role { id: string; name: string; c: string; pdf: string; on?: boolean; focus: string; brief: string }

export const ROLES: Role[] = [
  { id: "surg", name: "Revision arthroplasty surgeon", c: "var(--r-surg)", pdf: "#1f5f7a", on: true,
    focus: "Surgical options, bone loss, implant choice, feasibility and expected function.",
    brief: "a consultant orthopaedic surgeon specialising in complex hip and knee revision surgery. You focus on surgical options, bone loss, implant choice, technical feasibility and expected function." },
  { id: "micro", name: "Consultant microbiologist", c: "var(--r-micro)", pdf: "#6a4c93", on: true,
    focus: "Whether this is infection, how reliable the tests are, antibiotic strategy.",
    brief: "a consultant microbiologist with a special interest in bone and joint infection. You focus on whether this is periprosthetic joint infection using accepted diagnostic criteria, the reliability of the tests done, and antibiotic strategy." },
  { id: "rad", name: "Musculoskeletal radiologist", c: "var(--r-rad)", pdf: "#2e7d4f", on: true,
    focus: "What the imaging shows, how reliable it is, what further imaging would help.",
    brief: "a consultant musculoskeletal radiologist. You focus on what the imaging does and does not show, how reliable it is, and what further imaging would change management." },
  { id: "anaes", name: "Peri-operative physician / anaesthetist", c: "var(--r-anaes)", pdf: "#9a5a12", on: true,
    focus: "Fitness for surgery, risk, optimisation, anticoagulation, frailty, patient goals.",
    brief: "a consultant anaesthetist and peri-operative physician. You focus on fitness for surgery, risk, optimisation, anticoagulation, frailty, and whether the patient's goals justify the risk." },
  { id: "sceptic", name: "Devil's advocate", c: "var(--r-sceptic)", pdf: "#a3271f", on: false,
    focus: "Argues against the consensus, to stop everyone simply agreeing.",
    brief: "a senior consultant asked to act as devil's advocate. Your job is to challenge the emerging consensus, argue for the most credible alternative plan (including doing less or nothing), and point out weak evidence or assumptions. Stay clinically credible." },
];
export const CHAIR: Role = { id: "chair", name: "MDT chair", c: "var(--r-chair)", pdf: "#16202b",
  focus: "Always attends. Reads the whole discussion and records the outcome.",
  brief: "the chair of the MDT, recording the outcome as it would appear in the MDT minutes, faithfully reflecting the discussion rather than adding a new opinion." };
export const ALL_SEATS: Role[] = ROLES.concat([CHAIR]);
