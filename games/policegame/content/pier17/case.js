/** LAST WATCH: PIER 17 — deterministic, serializable case content. */
import { pier17Scene } from "./scene.js";
import routes from "./routes.js";
export const CASE_VERSION = 1;

const RULE_HOTSPOTS = [
  {
    id: "radio",
    area: "street",
    name: "Patrol radio",
    type: "procedure",
    description: "Dispatch, scene protection and documented authority.",
  },
  {
    id: "courier",
    area: "street",
    name: "Niko Vale · courier",
    type: "person",
    description:
      "An injured cyclist waits beside the curb. Care comes before questions.",
  },
  {
    id: "trace",
    area: "street",
    name: "Collision marks",
    type: "evidence",
    description:
      "A curved tire mark, blue paint and a torn cargo seal under the streetlamp.",
  },
  {
    id: "witness",
    area: "diner",
    name: "June Park · witness",
    type: "person",
    description: "The night-shift diner worker saw something through the rain.",
  },
  {
    id: "camera",
    area: "diner",
    name: "Security recorder",
    type: "evidence",
    description:
      "A grainy view of the crossing. The displayed time needs checking.",
  },
  {
    id: "van",
    area: "depot",
    name: "Harbor Transfer van",
    type: "evidence",
    description:
      "Unit HV-412 is parked in the loading bay, its engine still warm.",
  },
  {
    id: "manifest",
    area: "depot",
    name: "Dispatch records",
    type: "document",
    description:
      "The public dispatch window holds the cargo ledger and access terminal.",
  },
  {
    id: "suspect",
    area: "depot",
    name: "Ellis Reed · manager",
    type: "person",
    description:
      "The manager who reported a red coupe. His story should be tested fairly.",
  },
  {
    id: "report",
    area: "depot",
    name: "Case terminal",
    type: "procedure",
    description:
      "Reconstruct the timeline, review the evidence and close the case.",
  },
];

const EVIDENCE = {
  dispatch: {
    title: "01 · Original dispatch",
    type: "record",
    text: "22:19 — Ellis Reed reports that a red coupe hit a cyclist outside Pier 17. This is the time of the call, not independently the time of impact.",
  },
  courier: {
    title: "02 · Niko’s account",
    type: "statement",
    text: "After medical assessment, Niko describes a boxy vehicle turning out of the loading lane. He heard a diesel engine and saw two amber roof lamps. He cannot reliably name the driver.",
  },
  skid: {
    title: "03 · Curved tire mark",
    type: "observation",
    text: "A wet tire arc runs from the depot lane toward the fallen bicycle. It supports a turning vehicle, not Reed’s account of a coupe speeding straight down the waterfront.",
  },
  scenePhotos: {
    title: "04 · Scene photographs",
    type: "photograph",
    text: "Wide, midrange and close photographs record the tire arc, blue paint, and torn seal in their original positions. Scale and location references are included.",
  },
  paint: {
    title: "05 · Sealed paint exhibit P-01",
    type: "physical",
    text: "Blue paint collected with fresh gloves after photography, packaged separately and initialed. It is visually consistent with the damaged van; a laboratory comparison is still required.",
  },
  seal: {
    title: "06 · Sealed cargo exhibit S-01",
    type: "physical",
    text: "Torn tamper seal S-641, collected with fresh gloves after photography. The serial remains legible. The exhibit is separately packaged and its recovery location recorded.",
  },
  witness: {
    title: "07 · June’s statement",
    type: "statement",
    text: "June saw a blue delivery van with two amber roof lamps strike the bicycle while turning from the depot. She did not see the driver clearly. She heard impact shortly after her 22:13 till receipt.",
  },
  receipt: {
    title: "08 · Diner receipt",
    type: "record",
    text: "June’s till receipt is stamped 22:13. She had just handed over the order when she heard the collision. The till clock agrees with dispatch time.",
  },
  footage: {
    title: "09 · Original CCTV export",
    type: "digital",
    text: "June consented to export the original recording. At displayed 22:06, van HV-412 turns out, strikes the bicycle, and returns toward the depot. Rain obscures the driver. The original timestamp is preserved.",
  },
  correctedTime: {
    title: "10 · Authenticated CCTV time",
    type: "analysis",
    text: "The recorder reads 22:23 while dispatch and the diner till both read 22:31: it is eight minutes slow. Displayed 22:06 is therefore actual 22:14. The correction is documented separately from the original export.",
  },
  van: {
    title: "11 · Van exterior photographs",
    type: "photograph",
    text: "HV-412 has fresh damage on its front-left corner and a patch of missing blue paint at bicycle height. Two amber roof lamps match the accounts. Photographs preserve its condition before the search.",
  },
  registration: {
    title: "12 · Vehicle assignment",
    type: "record",
    text: "Harbor Transfer unit HV-412 was signed out to shift manager Ellis Reed. The fleet log records no other authorized driver tonight. Assignment is relevant, but alone does not prove who was driving.",
  },
  manifest: {
    title: "13 · Medical cargo ledger",
    type: "document",
    text: "Crate M-314 contains hospital diagnostic equipment. It was scheduled to leave at 22:30 with intact seal S-641. No early departure or sale was authorized.",
  },
  access: {
    title: "14 · Loading-bay access log",
    type: "record",
    text: "Reed’s personal credential opened the M-314 cage at 22:08. The supervisor confirms no emergency transfer. Together with the broken seal, this contradicts an ordinary authorized delivery.",
  },
  sealMatch: {
    title: "15 · Seal serial comparison",
    type: "analysis",
    text: "The scene exhibit reads S-641, exactly the seal assigned to medical crate M-314. A serial match links the crate to the collision scene; it does not by itself identify the driver.",
  },
  alibi: {
    title: "16 · Reed’s first account",
    type: "statement",
    text: "Before being detained, Reed said the van had not moved since 21:50. He claimed a red coupe struck the cyclist at 22:19. His words were recorded without treating a contradiction as a confession.",
  },
  timeline: {
    title: "17 · Corroborated timeline",
    type: "analysis",
    text: "22:08 — Reed’s credential opens the cargo cage. 22:14 — authenticated CCTV places HV-412 at the collision. 22:19 — Reed reports a red coupe. The report follows impact by five minutes.",
  },
  warrant: {
    title: "18 · Documented search authority",
    type: "procedure",
    text: "Dispatch records judicial authorization to search HV-412 for crate M-314 and associated cargo evidence, based on the authenticated recording, serial match, damage and access records.",
  },
  cargo: {
    title: "19 · Recovered crate M-314",
    type: "physical",
    text: "The authorized, photographed search finds M-314 under a tarpaulin in HV-412. Its seal is broken. The crate serial, contents and recovery location are recorded; custody transfers to the evidence officer.",
  },
  resolution: {
    title: "20 · Safe resolution",
    type: "procedure",
    text: "With backup present, Reed is informed of the grounds for detention and his rights. He sets down his keys and complies. No force is used, and an unrecorded confession is not needed to make the case.",
  },
  voluntary: {
    title: "21 · Reed’s volunteered words",
    type: "statement",
    text: "After detention and rights notification, Reed says without a further question: “I took the crate. I hit the bike on the turn. I thought the coupe story would buy me time.” He then asks for counsel; questioning stops. This statement is recorded separately from independently established facts.",
  },
};

const FLAGS = [
  "briefed",
  "sceneSecured",
  "medicsCalled",
  "aidGiven",
  "courierRoute",
  "courierImpact",
  "traceSurveyed",
  "tracePhotographed",
  "glovesOn",
  "paintBagged",
  "sealBagged",
  "witnessIntroduced",
  "witnessVehicle",
  "witnessTime",
  "witnessLimits",
  "cameraConsent",
  "footageViewed",
  "clockCompared",
  "timeCorrected",
  "vanInspected",
  "vanPhotographed",
  "registrationChecked",
  "manifestRead",
  "accessChecked",
  "sealMatched",
  "alibiRecorded",
  "timelineSolved",
  "backupCalled",
  "searchAuthorized",
  "cargoRecovered",
  "suspectCalm",
  "rightsExplained",
  "casePresented",
  "suspectDetained",
  "voluntaryRecorded",
  "chainReviewed",
  "reportTheory",
  "reportCharges",
  "reportDisposition",
  "reportSubmitted",
];

const MILESTONES = [
  ["briefed", 2],
  ["sceneSecured", 4],
  ["medicsCalled", 3],
  ["aidGiven", 5],
  ["courierImpact", 3],
  ["traceSurveyed", 3],
  ["tracePhotographed", 4],
  ["paintBagged", 4],
  ["sealBagged", 4],
  ["witnessVehicle", 3],
  ["witnessTime", 3],
  ["witnessLimits", 2],
  ["footageViewed", 3],
  ["timeCorrected", 5],
  ["vanPhotographed", 3],
  ["registrationChecked", 2],
  ["manifestRead", 3],
  ["accessChecked", 3],
  ["sealMatched", 4],
  ["alibiRecorded", 2],
  ["timelineSolved", 5],
  ["backupCalled", 2],
  ["searchAuthorized", 4],
  ["cargoRecovered", 5],
  ["suspectCalm", 3],
  ["rightsExplained", 3],
  ["casePresented", 3],
  ["suspectDetained", 4],
  ["chainReviewed", 2],
  ["reportTheory", 2],
  ["reportCharges", 2],
  ["reportDisposition", 2],
  ["reportSubmitted", 2],
];

function initialState() {
  return {
    version: CASE_VERSION,
    phase: 1,
    flags: Object.fromEntries(FLAGS.map((key) => [key, false])),
    evidence: [],
    inventory: ["Patrol radio", "Nitrile gloves", "Camera", "Evidence bags"],
    log: [
      {
        id: "arrival",
        title: "22:24 · Pier 17",
        text: "Your final call of the shift: a cyclist down outside the ferry terminal. Rain is washing the street clean. Keep the scene safe, help the injured, and let the evidence determine what happened.",
        kind: "story",
      },
    ],
    mistakes: [],
    completed: false,
  };
}

function validateLegacyShape(value) {
  if (!value || typeof value !== "object" || value.version !== CASE_VERSION)
    return false;
  if (
    !Number.isInteger(value.phase) ||
    value.phase < 1 ||
    value.phase > 6 ||
    typeof value.completed !== "boolean"
  )
    return false;
  if (
    !value.flags ||
    FLAGS.some((key) => typeof value.flags[key] !== "boolean")
  )
    return false;
  if (
    !Array.isArray(value.evidence) ||
    value.evidence.some((id) => !Object.hasOwn(EVIDENCE, id)) ||
    new Set(value.evidence).size !== value.evidence.length
  )
    return false;
  if (
    !Array.isArray(value.inventory) ||
    value.inventory.some((item) => typeof item !== "string")
  )
    return false;
  if (
    !Array.isArray(value.log) ||
    value.log.length > 500 ||
    value.log.some(
      (entry) =>
        !entry ||
        ["id", "title", "text", "kind"].some(
          (key) => typeof entry[key] !== "string",
        ),
    )
  )
    return false;
  if (
    !Array.isArray(value.mistakes) ||
    value.mistakes.length > 30 ||
    value.mistakes.some(
      (entry) =>
        !entry ||
        typeof entry.id !== "string" ||
        typeof entry.text !== "string" ||
        !Number.isFinite(entry.penalty) ||
        entry.penalty < 0 ||
        entry.penalty > 20,
    )
  )
    return false;
  if (
    value.completed !== value.flags.reportSubmitted ||
    (value.completed && value.phase !== 6)
  )
    return false;
  return true;
}

const has = (state, ...keys) => keys.every((key) => state.flags[key]);
const cared = (state) => has(state, "sceneSecured", "medicsCalled", "aidGiven");
const foundation = (state) =>
  has(
    state,
    "paintBagged",
    "sealBagged",
    "witnessVehicle",
    "witnessTime",
    "witnessLimits",
    "timeCorrected",
    "vanPhotographed",
    "registrationChecked",
    "manifestRead",
    "accessChecked",
    "sealMatched",
    "alibiRecorded",
    "courierImpact",
  );
const reportReady = (state) =>
  has(
    state,
    "suspectDetained",
    "chainReviewed",
    "reportTheory",
    "reportCharges",
    "reportDisposition",
  );

function refreshPhase(state) {
  state.phase = state.completed
    ? 6
    : !cared(state)
      ? 1
      : !foundation(state)
        ? 2
        : !has(state, "timelineSolved", "cargoRecovered")
          ? 3
          : !state.flags.suspectDetained
            ? 4
            : 5;
}

function objective(state) {
  const f = state.flags;
  if (state.completed)
    return {
      chapter: "CASE CLOSED",
      title: "The last call is complete",
      detail:
        "Review your debrief and evidence. Your final report preserves facts, uncertainty and the chain of custody.",
    };
  if (!f.briefed)
    return {
      chapter: "01 · FIRST RESPONSE",
      title: "Answer the dispatch",
      detail: "Use your patrol radio to hear the call and begin the scene log.",
    };
  if (!f.sceneSecured || !f.medicsCalled)
    return {
      chapter: "01 · FIRST RESPONSE",
      title: "Protect the scene",
      detail:
        "Use the radio to close the lane and request medical assistance before approaching the cyclist.",
    };
  if (!f.aidGiven)
    return {
      chapter: "01 · FIRST RESPONSE",
      title: "Care before questions",
      detail:
        "Assess Niko at the curb and hand him over to the arriving medics.",
    };
  if (!foundation(state)) {
    const pending = [];
    if (!f.courierImpact) pending.push("take Niko’s account");
    if (!f.paintBagged || !f.sealBagged)
      pending.push("photograph and bag the street traces");
    if (!has(state, "witnessVehicle", "witnessTime", "witnessLimits"))
      pending.push("take June’s complete statement");
    if (!f.timeCorrected)
      pending.push("authenticate the diner recording’s time");
    if (!f.vanPhotographed || !f.registrationChecked)
      pending.push("document the van");
    if (!has(state, "manifestRead", "accessChecked", "sealMatched"))
      pending.push("check the dispatch records");
    if (!f.alibiRecorded) pending.push("record Reed’s account");
    return {
      chapter: "02 · FOLLOW THE FACTS",
      title: "Build an independent account",
      detail:
        pending
          .map((item, index) =>
            index === 0 ? item[0].toUpperCase() + item.slice(1) : item,
          )
          .join(" · ") + ".",
    };
  }
  if (!f.timelineSolved)
    return {
      chapter: "03 · RECONSTRUCTION",
      title: "Put the events in order",
      detail:
        "Use the case terminal in the depot. Compare the cage access, corrected camera time, and original dispatch call.",
    };
  if (!f.searchAuthorized)
    return {
      chapter: "03 · RECONSTRUCTION",
      title: "Document search authority",
      detail:
        "Your evidence now supports a search request. Contact dispatch on the street radio before opening the van.",
    };
  if (!f.cargoRecovered)
    return {
      chapter: "03 · RECONSTRUCTION",
      title: "Account for the missing crate",
      detail:
        "Search HV-412 under the recorded authorization. Photograph and inventory anything recovered.",
    };
  if (!f.suspectDetained)
    return {
      chapter: "04 · A SAFE RESOLUTION",
      title: "Bring Reed in safely",
      detail: !f.backupCalled
        ? "Request backup on the patrol radio before confronting Reed."
        : "Keep Reed calm, explain his rights and the evidence, then give him a clear next step. A confession is not required.",
    };
  return {
    chapter: "05 · THE FINAL REPORT",
    title: "Close the case properly",
    detail:
      "At the case terminal: audit custody, identify the supported account and offenses, and arrange care and cargo transfer. Then submit.",
  };
}

function score(state) {
  const total = MILESTONES.reduce((sum, [, points]) => sum + points, 0);
  const earned = MILESTONES.reduce(
    (sum, [flag, points]) => sum + (state.flags[flag] ? points : 0),
    0,
  );
  const penalties = state.mistakes.reduce((sum, item) => sum + item.penalty, 0);
  return Math.max(
    0,
    Math.min(100, Math.round((earned * 100) / total) - penalties),
  );
}

function summary(state) {
  const value = score(state);
  const rating = !state.completed
    ? "Investigation in progress"
    : value >= 95
      ? "Exemplary procedure"
      : value >= 85
        ? "Strong casework"
        : value >= 70
          ? "Case solved · review procedure"
          : "Case solved · training recommended";
  return {
    title: "Last Watch: Pier 17",
    completed: state.completed,
    score: value,
    rating,
    evidenceCount: state.evidence.length,
    findings: [
      ...(state.flags.timelineSolved
        ? [
            "Reed’s credential opened the cage at 22:08; HV-412 struck the cyclist at 22:14; the red-coupe report followed at 22:19.",
          ]
        : []),
      ...(state.flags.cargoRecovered
        ? [
            "Medical crate M-314 was recovered under documented search authority; its broken seal matched scene exhibit S-01.",
          ]
        : []),
      ...(state.flags.suspectDetained
        ? [
            "Reed complied after a calm, supported approach. No force or compelled confession was required.",
          ]
        : []),
      ...(state.completed
        ? [
            "The report refers theft, dangerous driving causing injury and a false report, while preserving witness limits and the pending paint comparison.",
          ]
        : []),
    ],
    nextSteps: state.completed
      ? [
          "Laboratory comparison of paint exhibit P-01.",
          "Prosecutor review and follow-up with Niko and June.",
          "Documented release of equipment to the hospital.",
        ]
      : [objective(state).detail],
    mistakes: state.mistakes.map((item) => ({ ...item })),
    ending: state.completed
      ? "Niko receives care. The hospital equipment is recovered. Reed is detained safely. Your report preserves both the evidence and its limits."
      : "The case remains open. Every procedural mistake is recoverable; deductions are recorded only once per error type.",
  };
}


// One record owns each action’s availability, effects and response.
const puzzles = [
  {
    "id": "recorder-clock",
    "type": "clock",
    "title": "Authenticate the recorder time",
    "text": "At the same moment, dispatch and the diner till show 22:31. The recorder shows 22:23. Its clock is eight minutes slow.\n\nThe collision clip is stamped 22:06. Add eight minutes to recover the real time. Keep the original timestamp and the correction together in the case record.",
    "hint": "The recorder is eight minutes slow. Add eight minutes to its displayed time.",
    "displayed": "22:06",
    "offsetMinutes": 8,
    "choices": [
      {
        "id": "time-2214",
        "label": "Actual impact: 22:14",
        "value": "22:14"
      },
      {
        "id": "time-2206",
        "label": "Actual impact: 22:06",
        "value": "22:06"
      },
      {
        "id": "time-2158",
        "label": "Actual impact: 21:58",
        "value": "21:58"
      }
    ],
    "onSuccess": [
      {
        "type": "flag",
        "id": "timeCorrected",
        "value": true
      },
      {
        "type": "evidence",
        "id": "correctedTime"
      }
    ],
    "onFailure": [
      {
        "type": "mistake",
        "id": "clock-correction",
        "text": "The clock correction needs another look",
        "penalty": 3
      }
    ]
  },
  {
    "id": "incident-timeline",
    "type": "timeline",
    "title": "Reconstruct the incident",
    "text": "Three anchors are independently documented:\n\n• Reed’s credential opened the cargo cage at 22:08.\n• The camera shows impact at displayed 22:06, with an eight-minute slow clock.\n• Dispatch logged Reed’s call at 22:19.\n\nChoose the sequence supported by those records. Do not substitute the caller’s description for an observed fact.",
    "hint": "Use corrected impact time; dispatch records the later report, not the collision.",
    "answer": [
      "cage",
      "impact",
      "call"
    ],
    "choices": [
      {
        "id": "timeline-correct",
        "label": "22:08 cage → 22:14 impact → 22:19 call",
        "value": [
          "cage",
          "impact",
          "call"
        ]
      },
      {
        "id": "timeline-camera",
        "label": "22:06 impact → 22:08 cage → 22:19 call",
        "value": [
          "impact",
          "cage",
          "call"
        ]
      },
      {
        "id": "timeline-call",
        "label": "22:08 cage → 22:19 impact and call",
        "value": [
          "cage",
          "call",
          "impact"
        ]
      }
    ],
    "onSuccess": [
      {
        "type": "flag",
        "id": "timelineSolved",
        "value": true
      },
      {
        "type": "evidence",
        "id": "timeline"
      }
    ],
    "onFailure": [
      {
        "type": "mistake",
        "id": "timeline-error",
        "text": "One timestamp has the wrong meaning",
        "penalty": 3
      }
    ]
  }
];

const actions = [
  {
    "id": "briefing",
    "hotspot": "radio",
    "label": "Receive the dispatch briefing",
    "once": "briefed",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "effects": [
      {
        "type": "flag",
        "id": "briefed",
        "value": true
      },
      {
        "type": "evidence",
        "id": "dispatch"
      }
    ],
    "result": {
      "title": "A late call in the rain",
      "text": "“Unit Seven, cyclist down at Pier 17. Caller Ellis Reed, shipping manager. He reports a red coupe leaving northbound. Call logged at 22:19. You arrived at 22:24.”\n\nThe waterfront is still open to traffic. Secure the lane and request medics. A caller’s account is a lead, not a conclusion.",
      "kind": "story",
      "speaker": "DISPATCH"
    }
  },
  {
    "id": "secure-road",
    "hotspot": "radio",
    "label": "Close the lane · protect the scene",
    "once": "sceneSecured",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "briefed"
    },
    "reason": "Receive the dispatch briefing first.",
    "effects": [
      {
        "type": "flag",
        "id": "sceneSecured",
        "value": true
      }
    ],
    "result": {
      "title": "A protected scene",
      "text": "You close the waterfront lane and place warning lights before the bend. A ferry attendant keeps pedestrians behind the cordon. You mark a clear path for the ambulance.\n\nThe tire arc and loose fragments are now protected from passing vehicles. Rain continues to soften the edges: document them before handling anything.",
      "kind": "success"
    }
  },
  {
    "id": "call-medics",
    "hotspot": "radio",
    "label": "Request medical assistance",
    "once": "medicsCalled",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "briefed"
    },
    "reason": "Receive the dispatch briefing first.",
    "effects": [
      {
        "type": "flag",
        "id": "medicsCalled",
        "value": true
      }
    ],
    "result": {
      "title": "Medical help is on the way",
      "text": "“Adult cyclist, conscious, leg injury, possible head impact. Scene protected at the ferry crossing.”\n\nDispatch sends an ambulance through the cleared lane. Stay with Niko, assess immediate needs, and avoid moving him unnecessarily. His interview can wait.",
      "kind": "success",
      "speaker": "DISPATCH"
    }
  },
  {
    "id": "request-backup",
    "hotspot": "radio",
    "label": "Request a second unit",
    "once": "backupCalled",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "sceneSecured"
        },
        {
          "flag": "medicsCalled"
        },
        {
          "flag": "aidGiven"
        }
      ]
    },
    "reason": "Complete the first response first.",
    "effects": [
      {
        "type": "flag",
        "id": "backupCalled",
        "value": true
      }
    ],
    "result": {
      "title": "Another unit at the pier",
      "text": "Officer Salazar arrives quietly and takes a position near the depot exit. You agree on a calm approach, clear space, and no sudden move toward Reed.\n\nBackup is support for a safe conversation. It does not turn a disputed story into proof.",
      "kind": "success",
      "speaker": "OFFICER SALAZAR"
    }
  },
  {
    "id": "search-authority",
    "hotspot": "radio",
    "label": "Request documented search authority",
    "once": "searchAuthorized",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "all": [
            {
              "flag": "paintBagged"
            },
            {
              "flag": "sealBagged"
            },
            {
              "flag": "witnessVehicle"
            },
            {
              "flag": "witnessTime"
            },
            {
              "flag": "witnessLimits"
            },
            {
              "flag": "timeCorrected"
            },
            {
              "flag": "vanPhotographed"
            },
            {
              "flag": "registrationChecked"
            },
            {
              "flag": "manifestRead"
            },
            {
              "flag": "accessChecked"
            },
            {
              "flag": "sealMatched"
            },
            {
              "flag": "alibiRecorded"
            },
            {
              "flag": "courierImpact"
            }
          ]
        },
        {
          "flag": "timelineSolved"
        }
      ]
    },
    "reason": "Finish the evidence checks and reconstruct the timeline at the case terminal.",
    "effects": [
      {
        "type": "flag",
        "id": "searchAuthorized",
        "value": true
      },
      {
        "type": "evidence",
        "id": "warrant"
      }
    ],
    "result": {
      "title": "Search authority recorded",
      "text": "You relay the authenticated video, van damage, seal serial, unauthorized cargo access and reconstructed times. Dispatch records judicial authorization to search HV-412 for M-314 and related cargo evidence.\n\nThe authorization and its limits enter the case log. Photograph, inventory and preserve everything recovered.",
      "kind": "success",
      "speaker": "DISPATCH"
    }
  },
  {
    "id": "review-dispatch",
    "hotspot": "radio",
    "label": "Review the original 22:19 call",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "flag": "briefed"
        }
      ]
    },
    "effects": [],
    "result": {
      "title": "The call is not the collision",
      "text": "22:19 — Ellis Reed reports that a red coupe hit a cyclist outside Pier 17. This is the time of the call, not independently the time of impact.\n\nReed is both the caller and the van’s assigned driver. His stated time and vehicle description need independent checking.",
      "kind": "story",
      "speaker": "DISPATCH"
    }
  },
  {
    "id": "assess-injuries",
    "hotspot": "courier",
    "label": "Assess Niko · assist the medics",
    "once": "aidGiven",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "sceneSecured"
        },
        {
          "flag": "medicsCalled"
        }
      ]
    },
    "reason": "Secure the lane and call medical assistance on the radio.",
    "effects": [
      {
        "type": "flag",
        "id": "aidGiven",
        "value": true
      }
    ],
    "result": {
      "title": "Care before questions",
      "text": "You kneel where Niko can see you, ask him to stay still, and keep him warm while checking that he can respond and breathe normally. You leave his helmet in place for the medics.\n\nThe ambulance team takes over. Niko is stable and agrees to a short conversation before transport. Medical care will continue regardless of what he remembers.",
      "kind": "success"
    }
  },
  {
    "id": "ask-route",
    "hotspot": "courier",
    "label": "“Tell me where you were heading.”",
    "once": "courierRoute",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "aidGiven"
    },
    "reason": "Medical care comes before an interview.",
    "effects": [
      {
        "type": "flag",
        "id": "courierRoute",
        "value": true
      }
    ],
    "result": {
      "title": "A familiar crossing",
      "text": "“I was delivering the ferry office keys. Same route every night. I checked the lane, then this engine came up on my left.”\n\nNiko pauses while a medic adjusts the blanket. You let him finish in his own time. His bicycle was crossing the depot exit, not riding along the main waterfront lane.",
      "kind": "story",
      "speaker": "NIKO VALE"
    }
  },
  {
    "id": "ask-impact",
    "hotspot": "courier",
    "label": "“What do you remember of the vehicle?”",
    "once": "courierImpact",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "courierRoute"
    },
    "reason": "Begin with Niko’s route and let him set the pace.",
    "effects": [
      {
        "type": "flag",
        "id": "courierImpact",
        "value": true
      },
      {
        "type": "evidence",
        "id": "courier"
      }
    ],
    "result": {
      "title": "Shape, sound, light",
      "text": "“Boxy. Diesel engine. Two little amber lights above me. I saw the corner, then the road.”\n\n“Could you see who was driving?”\n\n“No. I’m sorry.”\n\nYou record both the details and the limit. Niko’s memory supports a van turning from the depot, but he cannot identify a driver.",
      "kind": "evidence",
      "speaker": "NIKO VALE"
    }
  },
  {
    "id": "review-condition",
    "hotspot": "courier",
    "label": "Check Niko’s condition",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "flag": "aidGiven"
        }
      ]
    },
    "effects": [],
    "result": {
      "title": "Niko is in good hands",
      "text": "The medics report that Niko is stable and being transferred for examination. His contact details and consent to follow-up are recorded.\n\nHe asks you to keep his bicycle safe. Salazar arranges secure storage and leaves the reference with the medical team.",
      "kind": "story",
      "speaker": "MEDIC"
    }
  },
  {
    "id": "survey",
    "hotspot": "trace",
    "label": "Read the tire arc and loose traces",
    "once": "traceSurveyed",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "sceneSecured"
    },
    "reason": "Secure the road before entering the collision scene.",
    "effects": [
      {
        "type": "flag",
        "id": "traceSurveyed",
        "value": true
      },
      {
        "type": "evidence",
        "id": "skid"
      }
    ],
    "result": {
      "title": "A turn out of the loading lane",
      "text": "The tire arc bends from the depot exit toward the bicycle. It does not run straight down the waterfront as the caller described.\n\nNear the curb: a flake of blue paint and half of a numbered cargo seal. Their positions may connect the collision to a load in transit. Photograph the wide view, then the details, before collecting either exhibit.",
      "kind": "evidence"
    }
  },
  {
    "id": "photograph",
    "hotspot": "trace",
    "label": "Photograph traces in place",
    "once": "tracePhotographed",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "traceSurveyed"
    },
    "reason": "Survey the scene to locate the traces first.",
    "effects": [
      {
        "type": "flag",
        "id": "tracePhotographed",
        "value": true
      },
      {
        "type": "evidence",
        "id": "scenePhotos"
      }
    ],
    "result": {
      "title": "The original positions are preserved",
      "text": "You take wide, midrange and close photographs with location markers and a scale. The tire arc, blue paint and torn seal remain undisturbed.\n\nThe seal reads S-641. Your photographs preserve that detail even if the paper softens in the rain. Collection comes next: clean gloves, separate bags, clear labels.",
      "kind": "evidence"
    }
  },
  {
    "id": "wear-gloves",
    "hotspot": "trace",
    "label": "Put on clean evidence gloves",
    "once": "glovesOn",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "traceSurveyed"
    },
    "reason": "Locate the evidence first.",
    "effects": [
      {
        "type": "flag",
        "id": "glovesOn",
        "value": true
      }
    ],
    "result": {
      "title": "Ready to collect",
      "text": "You put on clean nitrile gloves and prepare separate labeled bags. You will change gloves between exhibits and record each handover.\n\nPhotography must still come before collection: a bag preserves an object, but only the scene record preserves where it was found.",
      "kind": "success"
    }
  },
  {
    "id": "collect-paint",
    "hotspot": "trace",
    "label": "Bag the blue paint · exhibit P-01",
    "once": "paintBagged",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "traceSurveyed"
    },
    "reason": "Survey the scene first. Photograph and wear gloves before collection.",
    "effects": [
      {
        "when": {
          "all": [
            {
              "flag": "tracePhotographed"
            },
            {
              "flag": "glovesOn"
            }
          ]
        },
        "then": [
          {
            "type": "flag",
            "id": "paintBagged",
            "value": true
          },
          {
            "type": "evidence",
            "id": "paint"
          }
        ],
        "else": [
          {
            "type": "mistake",
            "id": "collection-order",
            "text": "Pause: preserve the trace first",
            "penalty": 4
          }
        ]
      }
    ],
    "result": {
      "custom": "collectionFeedback",
      "good": {
        "title": "P-01 · Paint sealed",
        "text": "With clean gloves, you lift the blue fragment into its own evidence bag, seal and initial it, and log the exact recovery position.\n\nA visual color match can guide the investigation. The final report must still request a laboratory comparison rather than call it a conclusive match.",
        "kind": "evidence"
      },
      "bad": {
        "title": "Pause: preserve the trace first",
        "text": "Your collection sequence is incomplete. Photograph the original position and put on clean gloves before handling the exhibit.\n\nYou stop before contact, so the evidence remains recoverable. This procedural lapse lowers your maximum quality once; you can still complete the case.",
        "kind": "warning"
      }
    }
  },
  {
    "id": "collect-seal",
    "hotspot": "trace",
    "label": "Bag the torn cargo seal · exhibit S-01",
    "once": "sealBagged",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "traceSurveyed"
    },
    "reason": "Survey the scene first. Photograph and wear gloves before collection.",
    "effects": [
      {
        "when": {
          "all": [
            {
              "flag": "tracePhotographed"
            },
            {
              "flag": "glovesOn"
            }
          ]
        },
        "then": [
          {
            "type": "flag",
            "id": "sealBagged",
            "value": true
          },
          {
            "type": "evidence",
            "id": "seal"
          }
        ],
        "else": [
          {
            "type": "mistake",
            "id": "collection-order",
            "text": "Pause: preserve the trace first",
            "penalty": 4
          }
        ]
      }
    ],
    "result": {
      "custom": "collectionFeedback",
      "good": {
        "title": "S-01 · Cargo seal sealed",
        "text": "You change gloves, place the torn seal in its own bag, and record serial S-641 without altering the exhibit. The seal and its photographed location are linked in the evidence register.\n\nThe depot manifest should identify the shipment that carried this serial.",
        "kind": "evidence"
      },
      "bad": {
        "title": "Pause: preserve the trace first",
        "text": "Your collection sequence is incomplete. Photograph the original position and put on clean gloves before handling the exhibit.\n\nYou stop before contact, so the evidence remains recoverable. This procedural lapse lowers your maximum quality once; you can still complete the case.",
        "kind": "warning"
      }
    }
  },
  {
    "id": "review-traces",
    "hotspot": "trace",
    "label": "Review the sealed street exhibits",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "paintBagged"
            },
            {
              "flag": "sealBagged"
            }
          ]
        }
      ]
    },
    "effects": [],
    "result": {
      "title": "Two exhibits, separate custody",
      "text": "Blue paint collected with fresh gloves after photography, packaged separately and initialed. It is visually consistent with the damaged van; a laboratory comparison is still required.\n\nTorn tamper seal S-641, collected with fresh gloves after photography. The serial remains legible. The exhibit is separately packaged and its recovery location recorded.",
      "kind": "evidence"
    }
  },
  {
    "id": "introduce",
    "hotspot": "witness",
    "label": "Introduce yourself · ask permission to talk",
    "once": "witnessIntroduced",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "sceneSecured"
        },
        {
          "flag": "medicsCalled"
        },
        {
          "flag": "aidGiven"
        }
      ]
    },
    "reason": "Attend to the injured cyclist first.",
    "effects": [
      {
        "type": "flag",
        "id": "witnessIntroduced",
        "value": true
      }
    ],
    "result": {
      "title": "A witness, not a script",
      "text": "“June Park. I’m closing up. Is the cyclist all right?”\n\nYou tell her he is receiving care and ask whether she can describe what she saw. She agrees. You keep the caller’s red-coupe story to yourself so it cannot shape her first account.",
      "kind": "story",
      "speaker": "JUNE PARK"
    }
  },
  {
    "id": "ask-vehicle",
    "hotspot": "witness",
    "label": "“Describe what you saw, in your own words.”",
    "once": "witnessVehicle",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "witnessIntroduced"
    },
    "reason": "Introduce yourself first.",
    "effects": [
      {
        "type": "flag",
        "id": "witnessVehicle",
        "value": true
      }
    ],
    "result": {
      "title": "Two amber lamps",
      "text": "“A blue van came out of the loading lane. Two amber lights on the roof. It took the turn too tight and hit him. Then it went back toward the depot.”\n\nShe points to the doorway where she stood. Rain streaked the glass, but the diner’s awning left that section clear. You preserve her words before asking follow-up questions.",
      "kind": "story",
      "speaker": "JUNE PARK"
    }
  },
  {
    "id": "ask-time",
    "hotspot": "witness",
    "label": "“What helps you remember the time?”",
    "once": "witnessTime",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "witnessVehicle"
    },
    "reason": "Take the initial account before testing its timing.",
    "effects": [
      {
        "type": "flag",
        "id": "witnessTime",
        "value": true
      },
      {
        "type": "evidence",
        "id": "receipt"
      }
    ],
    "result": {
      "title": "Something better than a guess",
      "text": "“I’d just handed a driver his coffee. The till printed this.”\n\nThe receipt reads 22:13. June heard the impact moments later. You check the till against dispatch: their clocks agree.\n\n“The camera sees that crossing too,” she adds. “The recorder clock’s always been strange.”",
      "kind": "evidence",
      "speaker": "JUNE PARK"
    }
  },
  {
    "id": "ask-certainty",
    "hotspot": "witness",
    "label": "“What could you see clearly—and what couldn’t you?”",
    "once": "witnessLimits",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "witnessVehicle"
    },
    "reason": "Hear June’s account first.",
    "effects": [
      {
        "type": "flag",
        "id": "witnessLimits",
        "value": true
      }
    ],
    "result": {
      "title": "Record the limits",
      "text": "“The van, the lights, the turn—I saw those. The driver? No. Too dark. I won’t say I saw someone when I didn’t.”\n\nYou thank her and record that distinction. Reliable testimony includes uncertainty. When her timing and observations are both recorded, you read back the statement for her to confirm.",
      "kind": "evidence",
      "speaker": "JUNE PARK"
    }
  },
  {
    "id": "lead-witness",
    "hotspot": "witness",
    "label": "“You saw the red coupe, correct?”",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "witnessIntroduced"
            },
            {
              "not": {
                "flag": "witnessVehicle"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "mistake",
        "id": "leading-question",
        "text": "The question supplies the answer",
        "penalty": 4
      }
    ],
    "result": {
      "title": "The question supplies the answer",
      "text": "June frowns. “A coupe? That isn’t what I said.”\n\nYou acknowledge the leading question and restart with an open invitation to describe the vehicle. Her account is still available. The interview lapse is recorded once.",
      "kind": "warning"
    }
  },
  {
    "id": "review-statement",
    "hotspot": "witness",
    "label": "Read back June’s recorded statement",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "witnessVehicle"
            },
            {
              "flag": "witnessTime"
            },
            {
              "flag": "witnessLimits"
            }
          ]
        }
      ]
    },
    "effects": [],
    "result": {
      "title": "June confirms her account",
      "text": "June saw a blue delivery van with two amber roof lamps strike the bicycle while turning from the depot. She did not see the driver clearly. She heard impact shortly after her 22:13 till receipt.\n\n“I can stand by that. Just don’t put a face in it that I didn’t see.”",
      "kind": "evidence",
      "speaker": "JUNE PARK"
    }
  },
  {
    "id": "request-access",
    "hotspot": "camera",
    "label": "Ask June to export the recording",
    "once": "cameraConsent",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "witnessIntroduced"
    },
    "reason": "Speak to June before accessing her recorder.",
    "effects": [
      {
        "type": "flag",
        "id": "cameraConsent",
        "value": true
      }
    ],
    "result": {
      "title": "An original export",
      "text": "June gives permission to view and export the relevant recording. You preserve the original file, its displayed timestamp and the export details.\n\nYou work from a copy. Any clock correction will be a separate note, never an alteration to the original recording.",
      "kind": "success",
      "speaker": "JUNE PARK"
    }
  },
  {
    "id": "play-footage",
    "hotspot": "camera",
    "label": "Play the original collision clip",
    "once": "footageViewed",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "cameraConsent"
    },
    "reason": "Obtain June’s permission and an original export.",
    "effects": [
      {
        "type": "flag",
        "id": "footageViewed",
        "value": true
      },
      {
        "type": "evidence",
        "id": "footage"
      }
    ],
    "result": {
      "title": "The van crosses the frame",
      "text": "Displayed time: 22:06. A blue van with two amber roof lamps turns from the depot. Its front corner catches the bicycle; it stops briefly and returns toward the loading bay. The side marking is HV-412. No red coupe appears.\n\nThe driver’s face is lost in rain and reflection. The timestamp conflicts with June’s receipt, so check the recorder clock before drawing a timeline.",
      "kind": "evidence"
    }
  },
  {
    "id": "compare-clock",
    "hotspot": "camera",
    "label": "Compare recorder, till and dispatch clocks",
    "once": "clockCompared",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "footageViewed"
    },
    "reason": "Inspect the original clip first.",
    "effects": [
      {
        "type": "flag",
        "id": "clockCompared",
        "value": true
      }
    ],
    "result": {
      "title": "Eight minutes slow",
      "text": "At the same moment, dispatch and the diner till show 22:31. The recorder shows 22:23. Its clock is eight minutes slow.\n\nThe collision clip is stamped 22:06. Add eight minutes to recover the real time. Keep the original timestamp and the correction together in the case record.",
      "kind": "story"
    }
  },
  {
    "id": "time-2214",
    "hotspot": "camera",
    "label": "Record actual impact: 22:14",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "clockCompared"
            },
            {
              "not": {
                "flag": "timeCorrected"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "solvePuzzle",
        "id": "recorder-clock",
        "answer": "22:14"
      }
    ],
    "result": {
      "title": "Actual impact: 22:14",
      "text": "22:06 + eight minutes = 22:14. That agrees with June hearing the collision shortly after her 22:13 receipt.\n\nReed’s report was logged at 22:19—five minutes later. His call time cannot stand in for the time of impact. The authenticated correction is attached to the original export.",
      "kind": "evidence"
    }
  },
  {
    "id": "time-2206",
    "hotspot": "camera",
    "label": "Record actual impact: 22:06",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "clockCompared"
            },
            {
              "not": {
                "flag": "timeCorrected"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "solvePuzzle",
        "id": "recorder-clock",
        "answer": "22:06"
      }
    ],
    "result": {
      "title": "The clock correction needs another look",
      "text": "The recorder is eight minutes behind the correct clock. To convert its displayed 22:06 to the actual time, add eight minutes.\n\nThe original remains intact. Choose the corrected time again; this analysis error is counted only once.",
      "kind": "warning"
    }
  },
  {
    "id": "time-2158",
    "hotspot": "camera",
    "label": "Record actual impact: 21:58",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "clockCompared"
            },
            {
              "not": {
                "flag": "timeCorrected"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "solvePuzzle",
        "id": "recorder-clock",
        "answer": "21:58"
      }
    ],
    "result": {
      "title": "The clock correction needs another look",
      "text": "The recorder is eight minutes behind the correct clock. To convert its displayed 22:06 to the actual time, add eight minutes.\n\nThe original remains intact. Choose the corrected time again; this analysis error is counted only once.",
      "kind": "warning"
    }
  },
  {
    "id": "review-footage",
    "hotspot": "camera",
    "label": "Review the authenticated recording",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "flag": "timeCorrected"
        }
      ]
    },
    "effects": [],
    "result": {
      "title": "Original plus correction",
      "text": "June consented to export the original recording. At displayed 22:06, van HV-412 turns out, strikes the bicycle, and returns toward the depot. Rain obscures the driver. The original timestamp is preserved.\n\nThe recorder reads 22:23 while dispatch and the diner till both read 22:31: it is eight minutes slow. Displayed 22:06 is therefore actual 22:14. The correction is documented separately from the original export.",
      "kind": "evidence"
    }
  },
  {
    "id": "inspect-exterior",
    "hotspot": "van",
    "label": "Inspect the van from the loading lane",
    "once": "vanInspected",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "sceneSecured"
        },
        {
          "flag": "medicsCalled"
        },
        {
          "flag": "aidGiven"
        }
      ]
    },
    "reason": "Complete the first response first.",
    "effects": [
      {
        "type": "flag",
        "id": "vanInspected",
        "value": true
      }
    ],
    "result": {
      "title": "Fresh damage in plain view",
      "text": "From the open loading lane you can see a fresh scrape on the front-left corner, a patch of missing blue paint at bicycle height, and two amber lamps on the roof. The side marking reads HV-412.\n\nThe cargo doors are shut. An exterior observation is not permission to open them. Document what is visible and check who was assigned the van.",
      "kind": "story"
    }
  },
  {
    "id": "photograph-van",
    "hotspot": "van",
    "label": "Photograph damage, lamps and plate",
    "once": "vanPhotographed",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "vanInspected"
    },
    "reason": "Inspect the visible exterior first.",
    "effects": [
      {
        "type": "flag",
        "id": "vanPhotographed",
        "value": true
      },
      {
        "type": "evidence",
        "id": "van"
      }
    ],
    "result": {
      "title": "Damage, plate, context",
      "text": "You photograph the whole van, its location, registration, amber lamps and damaged corner with a scale. Nothing is moved.\n\nThe color and damage height are consistent with the street trace, but no laboratory result exists yet. You record “consistent with,” preserving the distinction between observation and proof.",
      "kind": "evidence"
    }
  },
  {
    "id": "check-registration",
    "hotspot": "van",
    "label": "Check the vehicle assignment",
    "once": "registrationChecked",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "vanInspected"
    },
    "reason": "Read the unit number from the exterior first.",
    "effects": [
      {
        "type": "flag",
        "id": "registrationChecked",
        "value": true
      },
      {
        "type": "evidence",
        "id": "registration"
      }
    ],
    "result": {
      "title": "Assigned to Ellis Reed",
      "text": "The fleet desk confirms HV-412 was signed out to Ellis Reed for this shift. No second driver or transfer is entered.\n\nAssignment narrows the inquiry; it does not prove identity by itself. Compare Reed’s account with the cargo access record and the independent recording.",
      "kind": "evidence",
      "speaker": "FLEET DESK"
    }
  },
  {
    "id": "search-van",
    "hotspot": "van",
    "label": "Open and inventory the cargo bay",
    "once": "cargoRecovered",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "searchAuthorized"
        },
        {
          "flag": "vanPhotographed"
        }
      ]
    },
    "reason": "Get documented search authority from dispatch and photograph the exterior.",
    "effects": [
      {
        "type": "flag",
        "id": "cargoRecovered",
        "value": true
      },
      {
        "type": "evidence",
        "id": "cargo"
      }
    ],
    "result": {
      "title": "M-314 · Recovered",
      "text": "Within the recorded search authority, you photograph the cargo bay before moving anything. Beneath a tarpaulin is crate M-314. The listed hospital equipment is inside, its seal broken.\n\nYou inventory the contents, record the crate serial and location, and transfer custody to the evidence officer. The recovered load corroborates the physical seal and access records. Reed’s story can now be addressed with facts.",
      "kind": "evidence"
    }
  },
  {
    "id": "review-cargo",
    "hotspot": "van",
    "label": "Review the recovered crate inventory",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "flag": "cargoRecovered"
        }
      ]
    },
    "effects": [],
    "result": {
      "title": "The missing shipment is accounted for",
      "text": "The authorized, photographed search finds M-314 under a tarpaulin in HV-412. Its seal is broken. The crate serial, contents and recovery location are recorded; custody transfers to the evidence officer.\n\nHospital logistics has been notified. Release will follow documentation and the receiving officer’s authorization.",
      "kind": "evidence"
    }
  },
  {
    "id": "read-ledger",
    "hotspot": "manifest",
    "label": "Read the authorized cargo manifest",
    "once": "manifestRead",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "sceneSecured"
        },
        {
          "flag": "medicsCalled"
        },
        {
          "flag": "aidGiven"
        }
      ]
    },
    "reason": "Complete the first response first.",
    "effects": [
      {
        "type": "flag",
        "id": "manifestRead",
        "value": true
      },
      {
        "type": "evidence",
        "id": "manifest"
      }
    ],
    "result": {
      "title": "A shipment that should still be secured",
      "text": "The authorized manifest lists crate M-314: diagnostic equipment for Northbank Hospital, scheduled departure 22:30. Tamper seal S-641 was checked intact at the shift handover.\n\nNo sale, early delivery or emergency transfer is listed. The cage should have remained locked until the scheduled collection.",
      "kind": "evidence"
    }
  },
  {
    "id": "check-access",
    "hotspot": "manifest",
    "label": "Verify the cage access and dispatch records",
    "once": "accessChecked",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "manifestRead"
    },
    "reason": "Identify the missing crate in the manifest first.",
    "effects": [
      {
        "type": "flag",
        "id": "accessChecked",
        "value": true
      },
      {
        "type": "evidence",
        "id": "access"
      }
    ],
    "result": {
      "title": "22:08 · Reed’s credential",
      "text": "The cargo cage audit records Ellis Reed’s personal credential at 22:08. The remote supervisor confirms there was no authorized early movement of M-314. You preserve the original access export and the supervisor’s confirmation.\n\nThat is six minutes before the independently timed collision, if the camera correction is right.",
      "kind": "evidence"
    }
  },
  {
    "id": "compare-seal",
    "hotspot": "manifest",
    "label": "Compare exhibit S-01 with the manifest",
    "once": "sealMatched",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "manifestRead"
        },
        {
          "flag": "sealBagged"
        }
      ]
    },
    "reason": "Read the manifest and properly collect the street seal.",
    "effects": [
      {
        "type": "flag",
        "id": "sealMatched",
        "value": true
      },
      {
        "type": "evidence",
        "id": "sealMatch"
      }
    ],
    "result": {
      "title": "S-641 identifies the load",
      "text": "The photographed street seal is S-641. The ledger assigns that exact serial to M-314. You record a direct serial comparison, without opening the evidence bag.\n\nThe torn seal places material from the missing crate at the collision scene. Together with the van’s movements, it supports a request to search the cargo bay.",
      "kind": "evidence"
    }
  },
  {
    "id": "review-records",
    "hotspot": "manifest",
    "label": "Review the verified cargo records",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "manifestRead"
            },
            {
              "flag": "accessChecked"
            },
            {
              "flag": "sealMatched"
            }
          ]
        }
      ]
    },
    "effects": [],
    "result": {
      "title": "Departure, access, seal",
      "text": "Crate M-314 contains hospital diagnostic equipment. It was scheduled to leave at 22:30 with intact seal S-641. No early departure or sale was authorized.\n\nReed’s personal credential opened the M-314 cage at 22:08. The supervisor confirms no emergency transfer. Together with the broken seal, this contradicts an ordinary authorized delivery.\n\nThe scene exhibit reads S-641, exactly the seal assigned to medical crate M-314. A serial match links the crate to the collision scene; it does not by itself identify the driver.",
      "kind": "evidence"
    }
  },
  {
    "id": "ask-alibi",
    "hotspot": "suspect",
    "label": "“Walk me through what happened tonight.”",
    "once": "alibiRecorded",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "sceneSecured"
        },
        {
          "flag": "medicsCalled"
        },
        {
          "flag": "aidGiven"
        }
      ]
    },
    "reason": "Attend to scene safety and medical care first.",
    "effects": [
      {
        "type": "flag",
        "id": "alibiRecorded",
        "value": true
      },
      {
        "type": "evidence",
        "id": "alibi"
      }
    ],
    "result": {
      "title": "A precise story",
      "text": "“Red coupe. Flying north. Hit the kid at 22:19. I called straight away. Our van? Parked here since ten to ten. Hasn’t moved.”\n\nYou record Reed’s account without accusing him. He volunteers a time and a vehicle description that can be independently checked. His hands keep turning a ring of van keys.",
      "kind": "story",
      "speaker": "ELLIS REED"
    }
  },
  {
    "id": "calm-approach",
    "hotspot": "suspect",
    "label": "Keep distance · speak calmly · explain the next step",
    "once": "suspectCalm",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "not": {
            "flag": "suspectDetained"
          }
        }
      ]
    },
    "when": {
      "all": [
        {
          "flag": "cargoRecovered"
        },
        {
          "flag": "backupCalled"
        }
      ]
    },
    "reason": "Recover the cargo under authority and request backup first.",
    "effects": [
      {
        "type": "flag",
        "id": "suspectCalm",
        "value": true
      }
    ],
    "result": {
      "title": "Give the moment room",
      "text": "With Salazar present, you leave Reed a clear view and a comfortable distance.\n\n“Ellis, keep your hands where we can see them. We have recovered the crate. I’ll explain what happens next. Nobody needs to rush.”\n\nHis shoulders lower. You keep your voice level and allow him time to respond.",
      "kind": "success"
    }
  },
  {
    "id": "explain-rights",
    "hotspot": "suspect",
    "label": "Explain the grounds and advise Reed of his rights",
    "once": "rightsExplained",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "not": {
            "flag": "suspectDetained"
          }
        }
      ]
    },
    "when": {
      "flag": "suspectCalm"
    },
    "reason": "Establish a calm, safe approach with backup present.",
    "effects": [
      {
        "type": "flag",
        "id": "rightsExplained",
        "value": true
      }
    ],
    "result": {
      "title": "Grounds and rights, clearly stated",
      "text": "You explain that he is being detained in connection with the unauthorized cargo removal and collision, state the independent grounds, and advise him of his rights to silence and counsel under the city’s procedure.\n\nYou check that he understands. You do not make care, release or leniency conditional on an admission.",
      "kind": "success"
    }
  },
  {
    "id": "present-evidence",
    "hotspot": "suspect",
    "label": "Present the corrected time, serial link and recovered crate",
    "once": "casePresented",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "not": {
            "flag": "suspectDetained"
          }
        }
      ]
    },
    "when": {
      "flag": "rightsExplained"
    },
    "reason": "Explain the grounds and rights before the evidential account.",
    "effects": [
      {
        "type": "flag",
        "id": "casePresented",
        "value": true
      }
    ],
    "result": {
      "title": "Facts without a demand",
      "text": "“Your credential opened the cage at 22:08. The corrected recording places your assigned van at the impact at 22:14. The numbered seal was on the street, and M-314 was recovered in the van under search authority. Your 22:19 call described a coupe.”\n\nYou do not claim the camera shows his face or that the paint has a laboratory match. Reed looks toward the van, then puts the keys on the desk.",
      "kind": "success"
    }
  },
  {
    "id": "peaceful-custody",
    "hotspot": "suspect",
    "label": "“Set down the keys. We’ll walk to the patrol car.”",
    "once": "suspectDetained",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "not": {
            "flag": "suspectDetained"
          }
        }
      ]
    },
    "when": {
      "flag": "casePresented"
    },
    "reason": "Present the independent evidence without demanding a confession.",
    "effects": [
      {
        "type": "flag",
        "id": "suspectDetained",
        "value": true
      },
      {
        "type": "evidence",
        "id": "resolution"
      }
    ],
    "result": {
      "title": "No force required",
      "text": "“Set down the keys. We’ll walk to the patrol car. Officer Salazar will explain transport and arrange access to counsel.”\n\nReed complies. Salazar records the detention and searches him under the applicable custody procedure. You confirm the scene is secure. The case rests on corroborated evidence, not on forcing him to speak.",
      "kind": "success"
    }
  },
  {
    "id": "demand-confession",
    "hotspot": "suspect",
    "label": "Pressure Reed to confess immediately",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "alibiRecorded"
            },
            {
              "not": {
                "flag": "casePresented"
              }
            },
            {
              "not": {
                "flag": "suspectDetained"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "mistake",
        "id": "coercive-interview",
        "text": "Pressure makes the contact worse",
        "penalty": 8
      }
    ],
    "result": {
      "title": "Pressure makes the contact worse",
      "text": "Reed stiffens and backs toward the desk. Salazar gives you space to reset. A demand for an admission does not establish any fact and makes a safe resolution harder.\n\nReturn to the evidence, request backup if needed, and approach calmly. Independent proof is enough; you do not need a confession.",
      "kind": "warning"
    }
  },
  {
    "id": "record-voluntary",
    "hotspot": "suspect",
    "label": "Record Reed’s volunteered words · stop questioning",
    "once": "voluntaryRecorded",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "flag": "suspectDetained"
        }
      ]
    },
    "effects": [
      {
        "type": "flag",
        "id": "voluntaryRecorded",
        "value": true
      },
      {
        "type": "evidence",
        "id": "voluntary"
      }
    ],
    "result": {
      "title": "A statement—and a clear stopping point",
      "text": "Without a further question, Reed says, “I took the crate. I hit the bike on the turn. I thought the coupe story would buy me time.” Then: “I want a lawyer.”\n\nYou record the volunteered words, the circumstances and the request. Questioning stops. The independent evidence remains the foundation of the report.",
      "kind": "evidence",
      "speaker": "ELLIS REED"
    }
  },
  {
    "id": "review-resolution",
    "hotspot": "suspect",
    "label": "Review the detention record",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "flag": "suspectDetained"
        }
      ]
    },
    "effects": [],
    "result": {
      "custom": "reviewResolution"
    }
  },
  {
    "id": "timeline-open",
    "hotspot": "report",
    "label": "Read the reconstruction worksheet",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "not": {
            "flag": "timelineSolved"
          }
        }
      ]
    },
    "when": {
      "all": [
        {
          "flag": "paintBagged"
        },
        {
          "flag": "sealBagged"
        },
        {
          "flag": "witnessVehicle"
        },
        {
          "flag": "witnessTime"
        },
        {
          "flag": "witnessLimits"
        },
        {
          "flag": "timeCorrected"
        },
        {
          "flag": "vanPhotographed"
        },
        {
          "flag": "registrationChecked"
        },
        {
          "flag": "manifestRead"
        },
        {
          "flag": "accessChecked"
        },
        {
          "flag": "sealMatched"
        },
        {
          "flag": "alibiRecorded"
        },
        {
          "flag": "courierImpact"
        }
      ]
    },
    "reason": "Gather the independently checked statements, traces and records first.",
    "effects": [],
    "result": {
      "title": "Reconstruction worksheet",
      "text": "Three anchors are independently documented:\n\n• Reed’s credential opened the cargo cage at 22:08.\n• The camera shows impact at displayed 22:06, with an eight-minute slow clock.\n• Dispatch logged Reed’s call at 22:19.\n\nChoose the sequence supported by those records. Do not substitute the caller’s description for an observed fact.",
      "kind": "story"
    }
  },
  {
    "id": "timeline-correct",
    "hotspot": "report",
    "label": "22:08 cage → 22:14 impact → 22:19 call",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "not": {
                "flag": "timelineSolved"
              }
            },
            {
              "all": [
                {
                  "flag": "paintBagged"
                },
                {
                  "flag": "sealBagged"
                },
                {
                  "flag": "witnessVehicle"
                },
                {
                  "flag": "witnessTime"
                },
                {
                  "flag": "witnessLimits"
                },
                {
                  "flag": "timeCorrected"
                },
                {
                  "flag": "vanPhotographed"
                },
                {
                  "flag": "registrationChecked"
                },
                {
                  "flag": "manifestRead"
                },
                {
                  "flag": "accessChecked"
                },
                {
                  "flag": "sealMatched"
                },
                {
                  "flag": "alibiRecorded"
                },
                {
                  "flag": "courierImpact"
                }
              ]
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "solvePuzzle",
        "id": "incident-timeline",
        "answer": [
          "cage",
          "impact",
          "call"
        ]
      }
    ],
    "result": {
      "title": "The five-minute gap",
      "text": "22:08 cage access → 22:14 collision → 22:19 false vehicle report.\n\nThe van’s movement and the crate’s seal undermine the parked-van story. The five-minute gap gave Reed time to return to the bay before calling. This is a supported reconstruction, not proof of a deliberate intent to injure. Request search authority to establish where the cargo went.",
      "kind": "evidence"
    }
  },
  {
    "id": "timeline-camera",
    "hotspot": "report",
    "label": "22:06 impact → 22:08 cage → 22:19 call",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "not": {
                "flag": "timelineSolved"
              }
            },
            {
              "all": [
                {
                  "flag": "paintBagged"
                },
                {
                  "flag": "sealBagged"
                },
                {
                  "flag": "witnessVehicle"
                },
                {
                  "flag": "witnessTime"
                },
                {
                  "flag": "witnessLimits"
                },
                {
                  "flag": "timeCorrected"
                },
                {
                  "flag": "vanPhotographed"
                },
                {
                  "flag": "registrationChecked"
                },
                {
                  "flag": "manifestRead"
                },
                {
                  "flag": "accessChecked"
                },
                {
                  "flag": "sealMatched"
                },
                {
                  "flag": "alibiRecorded"
                },
                {
                  "flag": "courierImpact"
                }
              ]
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "solvePuzzle",
        "id": "incident-timeline",
        "answer": [
          "impact",
          "cage",
          "call"
        ]
      }
    ],
    "result": {
      "title": "One timestamp has the wrong meaning",
      "text": "Use actual times and distinguish an event from its report. The recorder is eight minutes slow: its 22:06 impact occurred at 22:14. Dispatch’s 22:19 is the call, five minutes afterward.\n\nThe worksheet remains open. Correct the sequence; the error is counted only once.",
      "kind": "warning"
    }
  },
  {
    "id": "timeline-call",
    "hotspot": "report",
    "label": "22:08 cage → 22:19 impact and call",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "not": {
                "flag": "timelineSolved"
              }
            },
            {
              "all": [
                {
                  "flag": "paintBagged"
                },
                {
                  "flag": "sealBagged"
                },
                {
                  "flag": "witnessVehicle"
                },
                {
                  "flag": "witnessTime"
                },
                {
                  "flag": "witnessLimits"
                },
                {
                  "flag": "timeCorrected"
                },
                {
                  "flag": "vanPhotographed"
                },
                {
                  "flag": "registrationChecked"
                },
                {
                  "flag": "manifestRead"
                },
                {
                  "flag": "accessChecked"
                },
                {
                  "flag": "sealMatched"
                },
                {
                  "flag": "alibiRecorded"
                },
                {
                  "flag": "courierImpact"
                }
              ]
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "solvePuzzle",
        "id": "incident-timeline",
        "answer": [
          "cage",
          "call",
          "impact"
        ]
      }
    ],
    "result": {
      "title": "One timestamp has the wrong meaning",
      "text": "Use actual times and distinguish an event from its report. The recorder is eight minutes slow: its 22:06 impact occurred at 22:14. Dispatch’s 22:19 is the call, five minutes afterward.\n\nThe worksheet remains open. Correct the sequence; the error is counted only once.",
      "kind": "warning"
    }
  },
  {
    "id": "review-custody",
    "hotspot": "report",
    "label": "Audit photographs, exhibit seals and custody",
    "once": "chainReviewed",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "suspectDetained"
    },
    "reason": "Resolve the contact safely before the final report.",
    "effects": [
      {
        "type": "flag",
        "id": "chainReviewed",
        "value": true
      }
    ],
    "result": {
      "title": "A record another officer can follow",
      "text": "You audit P-01 and S-01: photographed in place, collected with clean gloves, separately sealed, labeled and transferred. You confirm the original CCTV export and separate time correction, records provenance, search authorization, cargo inventory and custody receipts.\n\nThe paint goes for laboratory comparison. Its visual similarity is not entered as a completed forensic match.",
      "kind": "success"
    }
  },
  {
    "id": "theory-supported",
    "hotspot": "report",
    "label": "Finding: cargo theft, van collision, invented coupe",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "suspectDetained"
            },
            {
              "not": {
                "flag": "reportTheory"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "flag",
        "id": "reportTheory",
        "value": true
      }
    ],
    "result": {
      "title": "Finding recorded",
      "text": "The evidence supports unauthorized removal of M-314, a collision involving Reed’s assigned van, and a later false account involving a red coupe. The access record, authenticated recording, physical serial link and recovered cargo corroborate one another.\n\nThe report explicitly records that neither witness identified a face and the available evidence does not establish intent to kill.",
      "kind": "success"
    }
  },
  {
    "id": "theory-intent",
    "hotspot": "report",
    "label": "Finding: a proven deliberate attempt to kill Niko",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "suspectDetained"
            },
            {
              "not": {
                "flag": "reportTheory"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "mistake",
        "id": "unsupported-intent",
        "text": "Intent must not be invented",
        "penalty": 5
      }
    ],
    "result": {
      "title": "Intent must not be invented",
      "text": "The collision, theft and false report are corroborated. A deliberate attempt to kill Niko is not. Damage and paint cannot tell you someone’s intention.\n\nRecord the supported facts and refer the supported offenses. The draft is still editable, and this overstatement is counted once.",
      "kind": "warning"
    }
  },
  {
    "id": "theory-coupe",
    "hotspot": "report",
    "label": "Finding: an unidentified red coupe caused the collision",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "suspectDetained"
            },
            {
              "not": {
                "flag": "reportTheory"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "mistake",
        "id": "unsupported-coupe",
        "text": "The caller’s story failed its checks",
        "penalty": 4
      }
    ],
    "result": {
      "title": "The caller’s story failed its checks",
      "text": "The independent recording, two accounts, van damage and cargo traces contradict the red-coupe claim. A report must explain that contradiction, not repeat the earliest story as fact.\n\nSelect the finding supported by the checked evidence.",
      "kind": "warning"
    }
  },
  {
    "id": "charges-supported",
    "hotspot": "report",
    "label": "Refer: cargo theft, dangerous driving, false report",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "reportTheory"
            },
            {
              "not": {
                "flag": "reportCharges"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "flag",
        "id": "reportCharges",
        "value": true
      }
    ],
    "result": {
      "title": "Referral, with its limits",
      "text": "You refer the supported allegations of cargo theft, dangerous driving causing injury, and a false report for the prosecutor’s review. Charging decisions remain subject to that review and the full record.\n\nYou distinguish the independent evidence from any volunteered statement and request follow-up laboratory work.",
      "kind": "success"
    }
  },
  {
    "id": "charges-murder",
    "hotspot": "report",
    "label": "Refer: attempted murder, based on the paint alone",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "reportTheory"
            },
            {
              "not": {
                "flag": "reportCharges"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "mistake",
        "id": "unsupported-intent",
        "text": "Intent must not be invented",
        "penalty": 5
      }
    ],
    "result": {
      "title": "Intent must not be invented",
      "text": "The collision, theft and false report are corroborated. A deliberate attempt to kill Niko is not. Damage and paint cannot tell you someone’s intention.\n\nRecord the supported facts and refer the supported offenses. The draft is still editable, and this overstatement is counted once.",
      "kind": "warning"
    }
  },
  {
    "id": "charges-release",
    "hotspot": "report",
    "label": "Close without referral because nobody saw the driver’s face",
    "visibleWhen": {
      "all": [
        {
          "not": {
            "flag": "reportSubmitted"
          }
        },
        {
          "all": [
            {
              "flag": "reportTheory"
            },
            {
              "not": {
                "flag": "reportCharges"
              }
            }
          ]
        }
      ]
    },
    "effects": [
      {
        "type": "mistake",
        "id": "ignored-corroboration",
        "text": "A face is not the only kind of evidence",
        "penalty": 4
      }
    ],
    "result": {
      "title": "A face is not the only kind of evidence",
      "text": "Neither witness can identify the driver’s face, and that limit belongs in the report. It does not erase the combined access, assignment, authenticated movement, recovered cargo and serial evidence.\n\nRefer the supported allegations with the uncertainties intact.",
      "kind": "warning"
    }
  },
  {
    "id": "arrange-transfer",
    "hotspot": "report",
    "label": "Document medical care, cargo custody and lab referral",
    "once": "reportDisposition",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "flag": "suspectDetained"
    },
    "reason": "Complete the safe resolution first.",
    "effects": [
      {
        "type": "flag",
        "id": "reportDisposition",
        "value": true
      }
    ],
    "result": {
      "title": "Leave nobody between systems",
      "text": "Niko’s medical transfer and bicycle storage reference are logged. June receives the case reference and a follow-up contact. Cargo custody and the hospital’s recovery contact are documented. P-01 is referred for comparison, and the original digital records are preserved.\n\nSalazar confirms Reed’s transport and access-to-counsel arrangements. The lane can reopen after the scene officer clears it.",
      "kind": "success"
    }
  },
  {
    "id": "submit-report",
    "hotspot": "report",
    "label": "Sign and submit the final report",
    "visibleWhen": {
      "not": {
        "flag": "reportSubmitted"
      }
    },
    "when": {
      "all": [
        {
          "flag": "suspectDetained"
        },
        {
          "flag": "chainReviewed"
        },
        {
          "flag": "reportTheory"
        },
        {
          "flag": "reportCharges"
        },
        {
          "flag": "reportDisposition"
        }
      ]
    },
    "reason": "Complete the custody audit, factual account, referral and follow-up arrangements.",
    "effects": [
      {
        "type": "flag",
        "id": "reportSubmitted",
        "value": true
      },
      {
        "type": "complete",
        "outcome": "case-closed"
      }
    ],
    "result": {
      "title": "LAST WATCH · Case closed",
      "text": "Your signed report reaches the duty sergeant before the ferry’s first departure. Niko is receiving care. The hospital’s missing equipment is accounted for. Reed is in custody without a use of force, and the independent evidence can be checked by someone who was not there.\n\nThe rain is still falling. This time, it is no longer washing the story away.",
      "kind": "complete",
      "speaker": "DUTY SERGEANT"
    }
  },
  {
    "id": "review",
    "hotspot": "radio",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "courier",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "trace",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "witness",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "camera",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "van",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "manifest",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "suspect",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  },
  {
    "id": "review",
    "hotspot": "report",
    "label": "Review case record",
    "visibleWhen": {
      "flag": "reportSubmitted"
    },
    "effects": [],
    "result": {
      "custom": "reviewCase"
    },
    "readOnly": true
  }
];


function refresh(state) {
  if (has(state, "witnessVehicle", "witnessTime", "witnessLimits") && !state.evidence.includes("witness")) state.evidence.push("witness");
  // Original v1 saves predate generic puzzle records. Preserve their solved facts
  // without inventing an attempt count; all newly played answers have real counts.
  state.puzzles ||= {};
  if (state.flags.timeCorrected && !state.puzzles["recorder-clock"]) state.puzzles["recorder-clock"] = { solved: true, attempts: 0, answer: "22:14" };
  if (state.flags.timelineSolved && !state.puzzles["incident-timeline"]) state.puzzles["incident-timeline"] = { solved: true, attempts: 0, answer: ["cage", "impact", "call"] };
  if (state.completed && !state.outcome) state.outcome = "case-closed";
  refreshPhase(state);
}

const extensions = {
  results: {
    collectionFeedback(state, context) {
      const response = context.action.result;
      return { ...(has(state, "tracePhotographed", "glovesOn") ? response.good : response.bad) };
    },
    reviewResolution(state) {
      return { title: "A safe, documented detention", text: EVIDENCE.resolution.text + (state.flags.voluntaryRecorded ? "\n\n" + EVIDENCE.voluntary.text : "\n\nYou may document any volunteered words, but an admission is not required to close this case."), kind: "story" };
    },
    reviewCase(state) {
      const caseSummary = summary(state);
      return { title: "Case closed · " + caseSummary.rating, text: caseSummary.ending + "\n\n" + caseSummary.findings.join("\n\n"), kind: "complete" };
    },
  },
};

export const definition = {
  ...pier17Scene,
  id: "pier17",
  version: CASE_VERSION,
  schemaVersion: 1,
  contentVersion: 1,
  title: "Last Watch: Pier 17",
  startArea: "street",
  startHotspot: "radio",
  flags: Object.fromEntries(FLAGS.map(id => [id, false])),
  initialState,
  initialInventory: ["Patrol radio", "Nitrile gloves", "Camera", "Evidence bags"],
  items: [
    { id: "Patrol radio", name: "Radio", icon: "▥", tool: true, defaultTarget: "radio", persistent: true, description: "Contact dispatch at the patrol radio.", uses: [
      { id: "briefing", target: "radio", action: "briefing", when: { not: { flag: "briefed" } } },
      { id: "review", target: "radio", action: "review-dispatch", when: { flag: "briefed" } },
    ] },
    { id: "Camera", name: "Camera", icon: "▣", tool: true, persistent: true, description: "Photograph visible scene traces and the van before collection or search.", uses: [
      { id: "scene", target: "trace", action: "photograph", when: { not: { flag: "tracePhotographed" } } },
      { id: "vehicle", target: "van", action: "photograph-van", when: { not: { flag: "vanPhotographed" } } },
    ] },
    { id: "Nitrile gloves", name: "Gloves", icon: "♧", tool: true, persistent: true, description: "Put on clean gloves before collecting trace evidence.", uses: [
      { id: "wear", target: "trace", action: "wear-gloves", when: { not: { flag: "glovesOn" } } },
    ] },
    { id: "Evidence bags", name: "Evidence bags", icon: "▱", tool: true, persistent: true, description: "Package photographed evidence separately after putting on gloves.", uses: [
      { id: "paint", target: "trace", action: "collect-paint", when: { not: { flag: "paintBagged" } } },
      { id: "seal", target: "trace", action: "collect-seal", when: { not: { flag: "sealBagged" } } },
    ] },
  ],
  evidence: Object.entries(EVIDENCE).map(([id, record]) => ({ id, ...record })),
  hotspots: RULE_HOTSPOTS.map(hotspot => ({
    ...pier17Scene.hotspots.find(sceneHotspot => sceneHotspot.id === hotspot.id),
    ...hotspot,
  })),
  actions,
  routes,
  puzzles,
  extensions: { ...pier17Scene.extensions, ...extensions },
  refresh,
  validate: validateLegacyShape,
  objective,
  score,
  summary,
  scoring: {
    milestones: MILESTONES.map(([flag, points]) => ({ flag, points })),
    ratings: [{ min: 95, label: "Exemplary procedure" }, { min: 85, label: "Strong casework" }, { min: 70, label: "Case solved · review procedure" }, { min: 0, label: "Case solved · training recommended" }],
  },
  stages: [
    { id: "response", title: "First response" }, { id: "facts", title: "Follow the facts" },
    { id: "reconstruction", title: "Reconstruction" }, { id: "resolution", title: "A safe resolution" },
    { id: "report", title: "The final report" }, { id: "closed", title: "Case closed" },
  ],
  objectives: [
    { id: "response", phase: 1, when: {"all":[{"not":{"flag":"reportSubmitted"}},{"not":{"all":[{"flag":"sceneSecured"},{"flag":"medicsCalled"},{"flag":"aidGiven"}]}}]}, chapter: "01 · FIRST RESPONSE", title: "Protect the scene", detail: "Answer dispatch, secure the lane, request medics and assist Niko." },
    { id: "facts", phase: 2, when: {"all":[{"not":{"flag":"reportSubmitted"}},{"all":[{"all":[{"flag":"sceneSecured"},{"flag":"medicsCalled"},{"flag":"aidGiven"}]},{"not":{"all":[{"flag":"paintBagged"},{"flag":"sealBagged"},{"flag":"witnessVehicle"},{"flag":"witnessTime"},{"flag":"witnessLimits"},{"flag":"timeCorrected"},{"flag":"vanPhotographed"},{"flag":"registrationChecked"},{"flag":"manifestRead"},{"flag":"accessChecked"},{"flag":"sealMatched"},{"flag":"alibiRecorded"},{"flag":"courierImpact"}]}}]}]}, chapter: "02 · FOLLOW THE FACTS", title: "Build an independent account", detail: "Check the accounts, street traces, van and records." },
    { id: "reconstruction", phase: 3, when: {"all":[{"not":{"flag":"reportSubmitted"}},{"all":[{"all":[{"flag":"paintBagged"},{"flag":"sealBagged"},{"flag":"witnessVehicle"},{"flag":"witnessTime"},{"flag":"witnessLimits"},{"flag":"timeCorrected"},{"flag":"vanPhotographed"},{"flag":"registrationChecked"},{"flag":"manifestRead"},{"flag":"accessChecked"},{"flag":"sealMatched"},{"flag":"alibiRecorded"},{"flag":"courierImpact"}]},{"not":{"all":[{"flag":"timelineSolved"},{"flag":"cargoRecovered"}]}}]}]}, chapter: "03 · RECONSTRUCTION", title: "Account for the missing crate", detail: "Reconstruct the timeline, obtain search authority and recover the cargo." },
    { id: "resolution", phase: 4, when: {"all":[{"not":{"flag":"reportSubmitted"}},{"all":[{"all":[{"flag":"paintBagged"},{"flag":"sealBagged"},{"flag":"witnessVehicle"},{"flag":"witnessTime"},{"flag":"witnessLimits"},{"flag":"timeCorrected"},{"flag":"vanPhotographed"},{"flag":"registrationChecked"},{"flag":"manifestRead"},{"flag":"accessChecked"},{"flag":"sealMatched"},{"flag":"alibiRecorded"},{"flag":"courierImpact"}]},{"all":[{"flag":"timelineSolved"},{"flag":"cargoRecovered"}]},{"not":{"flag":"suspectDetained"}}]}]}, chapter: "04 · A SAFE RESOLUTION", title: "Bring Reed in safely", detail: "Use backup, a calm approach, clear rights and independently corroborated evidence." },
    { id: "report", phase: 5, when: {"all":[{"not":{"flag":"reportSubmitted"}},{"flag":"suspectDetained"}]}, chapter: "05 · THE FINAL REPORT", title: "Close the case properly", detail: "Audit custody, record supported findings and arrange the follow-up." },
    { id: "closed", phase: 6, when: { flag: "reportSubmitted" }, chapter: "CASE CLOSED", title: "The last call is complete", detail: "Review the completed case record." },
  ],
  outcomes: [{ id: "case-closed", when: { flag: "reportSubmitted" }, title: "Case closed", ending: "Niko receives care. The hospital equipment is recovered. Reed is detained safely. Your report preserves both the evidence and its limits." }],
  saves: {
    legacy: {
      stateKey: "lastwatch-case-v1", areaKey: "lastwatch-area", begunKey: "lastwatch-begun",
      migrate(bundle, adventure) {
        if (!adventure.validateCase(bundle.state)) throw new Error("Invalid legacy progression");
        return { ...bundle, state: adventure.restoreCase(bundle.state) };
      },
    },
  },
  ui: {
    caseNumber: "CASE 01", incident: "INCIDENT 26–1013", title: "The last delivery.",
    subtitle: "A collision. A missing shipment. A story that does not add up.",
    introTitle: "Your watch starts here.",
    introText: "You are Officer Alex Mercer. A courier is down at the waterfront. Rain is erasing the evidence. Look closely, listen carefully, and build a case that holds.",
    startLabel: "Begin shift", assignmentTitle: "Answer the call.",
    assignmentDetail: "Dispatch has a report of a collision at Pier 17. Begin your shift to receive the briefing.",
    notebookIntro: "Incident 26–1013 · Pier 17\nObservations become evidence. Evidence becomes a story.",
    notebookEmpty: "No evidence logged yet. Make the scene safe, then inspect the waterfront.",
    officerLabel: "OFFICER A. MERCER", department: "BELLWETHER / LOWER HARBOR", endingTitle: "The morning has a chance.",
    weather: "12° ╱ RAIN", sceneStatus: "PATROL UNIT 04 · ON SCENE",
    procedure: [
      { title: "01 / People before property", text: "Establish a safe scene and request medical support. Listen without leading the witness." },
      { title: "02 / Preserve the original", text: "Inspect, photograph, then put on gloves before collecting trace evidence. Labels and collection records protect the chain of custody." },
      { title: "03 / Corroborate the story", text: "A statement is a lead. Use physical evidence, camera footage, and shipment records to test it. File exhibits before reconstructing the timeline." },
      { title: "04 / Slow the moment down", text: "Call for backup. Explain the evidence calmly and give the person room to cooperate. Finish by filing a supported report." },
    ],
  },
};

export const pier17Definition = definition;
export default definition;
