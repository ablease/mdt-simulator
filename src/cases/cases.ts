export interface Case { id: string; title: string; text: string }

export const CASES: Case[] = [
  { id: "pji-hip", title: "Painful hip, possible infection", text:
`FICTIONAL TEST CASE 1 (invented for prototype testing)

74-year-old woman. Primary uncemented total hip replacement (right) 9 years ago.
Presenting complaint: 4 months of increasing groin pain, worse on weight-bearing. No wound problems. Was given a 1-week course of oral antibiotics by GP for a "chest infection" 3 weeks before aspiration.

PMH: Type 2 diabetes (HbA1c 64 mmol/mol), BMI 34, hypertension. Independent, walks with one stick, lives with husband.

Bloods: CRP 38 mg/L, ESR 52 mm/hr, WCC 9.1.
Hip aspirate: synovial WCC 2,400 cells/µL, 78% neutrophils. Cultures x2: no growth at 14 days. Alpha-defensin: not done.

Imaging: radiolucent lines around acetabular component in all three zones with superomedial migration; femoral stem appears well fixed. Acetabular defect estimated Paprosky 2B on CT.

Question for MDT: Septic or aseptic loosening? Single-stage, two-stage, or aseptic acetabular revision?` },
  { id: "stiff-tkr", title: "Stiff, painful knee replacement", text:
`FICTIONAL TEST CASE 2 (invented for prototype testing)

68-year-old man. Primary cemented total knee replacement (left) 18 months ago.
Presenting complaint: persistent anterior and medial knee pain since surgery, stiffness. Never felt the knee was "right". Completed 12 weeks of physiotherapy.

PMH: Hypercholesterolaemia. Ex-smoker. Retired electrician, keen walker.

Examination: well-healed wound, small effusion, ROM 10°–85°, stable to varus/valgus stress. Patellar maltracking noted.

Bloods: CRP 3 mg/L, ESR 11 mm/hr.
Aspirate: synovial WCC 450 cells/µL, 30% neutrophils, cultures negative.

Imaging: rotational CT shows femoral component internally rotated 6° relative to the transepicondylar axis and tibial component internally rotated 8°. No loosening. Bone scan: non-specific uptake.

Oxford Knee Score: 19/48.

Question for MDT: Is revision for component malrotation indicated, or should this be managed non-operatively?` },
  { id: "ppf-frail", title: "Fracture around a hip stem, frail patient", text:
`FICTIONAL TEST CASE 3 (invented for prototype testing)

86-year-old woman. Cemented total hip replacement (left) 14 years ago.
Presenting complaint: mechanical fall at home yesterday, unable to weight-bear.

PMH: Atrial fibrillation on apixaban (last dose 18 hours ago), CKD stage 3b (eGFR 38), moderate aortic stenosis (valve area 1.1 cm²), mild cognitive impairment. Clinical Frailty Scale 6. Lives alone with carers twice daily, walks with a frame indoors.

Imaging: spiral periprosthetic femoral fracture around the stem tip; cement mantle fractured and stem appears loose. Classified Vancouver B2. Bone stock reasonable for age.

Question for MDT: Revision with a long stem, fixation (ORIF), or non-operative management? Timing and peri-operative plan?` },
  { id: "dislocate", title: "Repeated hip dislocations", text:
`FICTIONAL TEST CASE 4 (invented for prototype testing)

61-year-old man. Primary total hip replacement (right) 8 months ago via posterior approach, 32 mm head.
Presenting complaint: 3 dislocations in the last 6 months, all closed-reduced in ED, all in flexion and internal rotation (e.g. getting out of a low car).

PMH: Previous L3–S1 spinal fusion (stiff spine), BMI 29, otherwise well. Works as a plumber, wants to return to work.

Bloods: CRP 4 mg/L. No signs of infection.

Imaging: CT shows acetabular inclination 52°, anteversion 5°. Femoral stem anteversion 12°. Leg lengths equal. Abductor muscles intact on MRI.

Question for MDT: Which revision strategy: acetabular revision to correct orientation, dual mobility, constrained liner, or a combination?` },
  { id: "blank", title: "Blank case (write your own)", text:
`ANONYMISED CASE

Age / sex:
Index operation and date:
Presenting complaint:

PMH and function:

Bloods:
Aspirate / microbiology:

Imaging:

Question for MDT:` },
];
