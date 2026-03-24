import { Answer, TypeName, DiagnosisResult } from "@/data/types";
import { builders } from "@/data/builders";
import { getTopRecommendations, AgentInsights } from "./matching-v2";
import { collectDiagnosisEvidence } from "./diagnosis-evidence";

type Scores = Record<TypeName, number>;

function initScores(): Scores {
  return {
    designFirst: 0,
    performanceExpert: 0,
    costBalance: 0,
    lifestyleDesign: 0,
    trustPartner: 0,
    totalBalance: 0,
  };
}

function getAnswer(answers: Answer[], qId: string): string | string[] | undefined {
  const a = answers.find((a) => a.questionId === qId);
  return a?.value;
}

function getRank(answers: Answer[], qId: string): string[] | undefined {
  const a = answers.find((a) => a.questionId === qId);
  return a?.rank;
}

function asArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function addScore(scores: Scores, type: TypeName, points: number) {
  scores[type] += points;
}

// ===== Q17: 最大ドライバー =====
function scoreQ17(scores: Scores, answers: Answer[]) {
  const rank = getRank(answers, "Q17");
  if (!rank || rank.length === 0) return;

  const mappings: Record<string, [TypeName, number][]> = {
    design: [["designFirst", 1]],
    cost: [["costBalance", 1]],
    performance: [["performanceExpert", 1]],
    personality: [["trustPartner", 1]],
    after_service: [["trustPartner", 1]],
    track_record: [["trustPartner", 1]],
    land_support: [["lifestyleDesign", 0.5], ["trustPartner", 0.5]],
    custom_design: [["lifestyleDesign", 0.75], ["designFirst", 0.25]],
  };

  const pointsByRank = [8, 4, 2];

  rank.forEach((val, idx) => {
    if (idx >= 3) return;
    const pts = pointsByRank[idx];
    const mapping = mappings[val];
    if (mapping) {
      mapping.forEach(([type, ratio]) => {
        addScore(scores, type, Math.round(pts * ratio));
      });
    }
  });
}

// ===== Q13: 外観テイスト =====
function scoreQ13(scores: Scores, answers: Answer[]) {
  const vals = asArray(getAnswer(answers, "Q13"));
  if (vals.length === 0) return;
  if (vals.length <= 2) {
    addScore(scores, "designFirst", 5);
  } else {
    addScore(scores, "designFirst", 3);
    addScore(scores, "totalBalance", 2);
  }
}

// ===== Q14: 内装テイスト =====
function scoreQ14(scores: Scores, answers: Answer[]) {
  const vals = asArray(getAnswer(answers, "Q14"));
  if (vals.length === 0) return;
  if (vals.length <= 2) {
    addScore(scores, "designFirst", 4);
  } else {
    addScore(scores, "designFirst", 2);
    addScore(scores, "totalBalance", 2);
  }
}

// ===== Q15: 重視性能 =====
function scoreQ15(scores: Scores, answers: Answer[]) {
  const rank = getRank(answers, "Q15");
  if (!rank || rank.length === 0) return;

  const energyPerf = ["insulation", "airtight", "energy"];
  const energyCount = rank.filter((v) => energyPerf.includes(v)).length;
  if (energyCount >= 2) addScore(scores, "performanceExpert", 6);
  else if (energyCount === 1) addScore(scores, "performanceExpert", 3);

  if (rank[0] === "seismic") {
    addScore(scores, "performanceExpert", 4);
    addScore(scores, "trustPartner", 2);
  }

  if (rank.includes("natural_material")) addScore(scores, "lifestyleDesign", 3);
  if (rank.includes("maintenance")) {
    addScore(scores, "costBalance", 2);
    addScore(scores, "trustPartner", 2);
  }
  if (rank.includes("none")) addScore(scores, "totalBalance", 3);
}

// ===== Q16: 気になる仕様 =====
function scoreQ16(scores: Scores, answers: Answer[]) {
  const vals = asArray(getAnswer(answers, "Q16"));
  vals.forEach((v) => {
    switch (v) {
      case "zeh":
      case "passive":
        addScore(scores, "performanceExpert", 4);
        break;
      case "solar":
        addScore(scores, "performanceExpert", 2);
        addScore(scores, "costBalance", 2);
        break;
      case "whole_house_ac":
        addScore(scores, "performanceExpert", 2);
        addScore(scores, "lifestyleDesign", 2);
        break;
      case "smart_home":
        addScore(scores, "performanceExpert", 2);
        break;
      case "long_quality":
        addScore(scores, "trustPartner", 2);
        addScore(scores, "costBalance", 2);
        break;
      case "none":
        addScore(scores, "totalBalance", 2);
        break;
    }
  });
}

// ===== Q11: 暮らし方 =====
function scoreQ11(scores: Scores, answers: Answer[]) {
  const vals = asArray(getAnswer(answers, "Q11"));
  vals.forEach((v) => {
    switch (v) {
      case "cooking":
      case "family_living":
      case "remote_work":
      case "pet":
      case "storage":
        addScore(scores, "lifestyleDesign", 3);
        break;
      case "hobby_room":
        addScore(scores, "designFirst", 2);
        addScore(scores, "lifestyleDesign", 2);
        break;
      case "outdoor_living":
        addScore(scores, "designFirst", 3);
        addScore(scores, "lifestyleDesign", 2);
        break;
      case "housework":
        addScore(scores, "lifestyleDesign", 4);
        break;
    }
  });
}

// ===== Q12: 現住まいの不満 =====
function scoreQ12(scores: Scores, answers: Answer[]) {
  const vals = asArray(getAnswer(answers, "Q12"));
  vals.forEach((v) => {
    switch (v) {
      case "storage":
        addScore(scores, "lifestyleDesign", 2);
        break;
      case "layout":
        addScore(scores, "lifestyleDesign", 3);
        break;
      case "insulation":
        addScore(scores, "performanceExpert", 3);
        break;
      case "noise":
        addScore(scores, "performanceExpert", 2);
        break;
      case "aging":
        addScore(scores, "trustPartner", 2);
        break;
      case "sunlight":
        addScore(scores, "lifestyleDesign", 2);
        addScore(scores, "performanceExpert", 1);
        break;
      case "rent":
        addScore(scores, "costBalance", 3);
        break;
    }
  });
}

// ===== Q18: 不安なこと =====
function scoreQ18(scores: Scores, answers: Answer[]) {
  const val = getAnswer(answers, "Q18") as string | undefined;
  if (!val) return;
  switch (val) {
    case "money":
      addScore(scores, "costBalance", 3);
      break;
    case "company_choice":
      addScore(scores, "trustPartner", 3);
      addScore(scores, "totalBalance", 2);
      break;
    case "process":
      addScore(scores, "totalBalance", 3);
      addScore(scores, "trustPartner", 2);
      break;
    case "image":
      addScore(scores, "designFirst", 3);
      break;
    case "schedule":
      addScore(scores, "trustPartner", 2);
      break;
  }
}

// ===== Q19: 担当者への期待 =====
function scoreQ19(scores: Scores, answers: Answer[]) {
  const val = getAnswer(answers, "Q19") as string | undefined;
  if (!val) return;
  switch (val) {
    case "listening":
      addScore(scores, "trustPartner", 3);
      addScore(scores, "lifestyleDesign", 2);
      break;
    case "proposal":
      addScore(scores, "designFirst", 3);
      addScore(scores, "performanceExpert", 2);
      break;
    case "response":
      addScore(scores, "costBalance", 2);
      break;
    case "honest":
      addScore(scores, "trustPartner", 4);
      break;
    case "expertise":
      addScore(scores, "performanceExpert", 4);
      break;
  }
}

// ===== メイン/サブ判定 =====
function determineType(scores: Scores): { main: TypeName; sub: TypeName } {
  const entries = Object.entries(scores) as [TypeName, number][];
  const sorted = entries
    .filter(([k]) => k !== "totalBalance")
    .sort(([, a], [, b]) => b - a);

  const allEntries = entries.sort(([, a], [, b]) => b - a);
  const maxScore = allEntries[0][1];
  const minScore = allEntries[allEntries.length - 1][1];

  if (maxScore - minScore <= 8) {
    return { main: "totalBalance", sub: sorted[0][0] };
  }

  return { main: sorted[0][0], sub: sorted[1][0] };
}

// ===== 表示ラベル =====
const subLabels: Record<TypeName, Record<TypeName, string>> = {
  designFirst: {
    designFirst: "",
    performanceExpert: "性能にも妥協しない",
    costBalance: "コスパ意識も高い",
    lifestyleDesign: "暮らしやすさも追求する",
    trustPartner: "信頼も大切にする",
    totalBalance: "総合力も求める",
  },
  performanceExpert: {
    designFirst: "デザインにもこだわる",
    performanceExpert: "",
    costBalance: "コスパ意識も高い",
    lifestyleDesign: "暮らしやすさも追求する",
    trustPartner: "信頼も大切にする",
    totalBalance: "総合力も求める",
  },
  costBalance: {
    designFirst: "デザインにもこだわる",
    performanceExpert: "性能にも妥協しない",
    costBalance: "",
    lifestyleDesign: "暮らしやすさも追求する",
    trustPartner: "信頼も大切にする",
    totalBalance: "総合力も求める",
  },
  lifestyleDesign: {
    designFirst: "デザインにもこだわる",
    performanceExpert: "性能にも妥協しない",
    costBalance: "コスパ意識も高い",
    lifestyleDesign: "",
    trustPartner: "信頼も大切にする",
    totalBalance: "総合力も求める",
  },
  trustPartner: {
    designFirst: "デザインにもこだわる",
    performanceExpert: "性能にも妥協しない",
    costBalance: "コスパ意識も高い",
    lifestyleDesign: "暮らしやすさも追求する",
    trustPartner: "",
    totalBalance: "総合力も求める",
  },
  totalBalance: {
    designFirst: "デザイン寄りの",
    performanceExpert: "性能重視寄りの",
    costBalance: "コスパ重視寄りの",
    lifestyleDesign: "暮らし重視寄りの",
    trustPartner: "安心重視寄りの",
    totalBalance: "",
  },
};

const typeNames: Record<TypeName, string> = {
  designFirst: "デザインファースト型",
  performanceExpert: "性能エキスパート型",
  costBalance: "コストバランス型",
  lifestyleDesign: "暮らしデザイン型",
  trustPartner: "安心パートナー型",
  totalBalance: "トータルバランス型",
};

export const typeCatchCopies: Record<TypeName, string> = {
  designFirst: "暮らしを、美しく設計する人",
  performanceExpert: "数値で納得、快適を追求する人",
  costBalance: "賢く選んで、満足度を最大化する人",
  lifestyleDesign: "間取りと動線に、理想の毎日を描く人",
  trustPartner: "信頼できるプロと、一緒につくりたい人",
  totalBalance: "すべてを見渡して、最適解を見つける人",
};

export const typeAdvice: Record<TypeName, { strengths: string; cautions: string; nextStep: string }> = {
  designFirst: {
    strengths: "こだわりのデザインで、毎日の暮らしに喜びを感じられる住まいを実現できます。外観・内装のイメージが明確なので、理想を共有しやすいタイプです。",
    cautions: "デザインに集中しすぎて、性能やコストとのバランスを見失わないよう注意しましょう。実際の住み心地も大切です。",
    nextStep: "デザイン力の高い工務店の施工事例を見比べて、自分のイメージに近い会社を見つけましょう。",
  },
  performanceExpert: {
    strengths: "断熱・気密・耐震などの性能数値を重視し、長期的に快適でコスト効率の良い住まいを実現できます。",
    cautions: "数値だけでなく、実際の体感も大切にしましょう。モデルハウスや完成見学会で体感することをおすすめします。",
    nextStep: "性能に自信のある工務店のUA値やC値を比較し、具体的な数値で検討しましょう。",
  },
  costBalance: {
    strengths: "限られた予算の中で最大限の満足を引き出す力があります。必要な性能と不要な装飾を見極められるタイプです。",
    cautions: "安さだけで判断すると、後々のメンテナンス費用が高くつくことも。ライフサイクルコストで考えましょう。",
    nextStep: "標準仕様で高品質な工務店を比較し、コストの内訳を確認しましょう。",
  },
  lifestyleDesign: {
    strengths: "日々の暮らしを具体的にイメージできるので、使い勝手の良い間取りや動線を実現しやすいタイプです。",
    cautions: "あれもこれもと盛り込みすぎると、予算オーバーや使いにくさにつながることも。優先順位をつけましょう。",
    nextStep: "暮らし提案力の高い工務店と、具体的な生活シーンについて話してみましょう。",
  },
  trustPartner: {
    strengths: "信頼できるパートナーと一緒に進めることで、安心して家づくりができます。アフターサポートまで見据えた選択ができるタイプです。",
    cautions: "担当者の印象だけでなく、会社としての体制や実績も確認しましょう。",
    nextStep: "工務店の実績やアフターサービス体制を確認し、実際に担当者と話してみましょう。",
  },
  totalBalance: {
    strengths: "デザイン・性能・コスト・暮らし・信頼のすべてをバランスよく評価できます。偏りのない判断ができるタイプです。",
    cautions: "すべてを求めると決め手に欠けることも。最終的には「ここだけは譲れない」ポイントを見つけましょう。",
    nextStep: "総合力の高い工務店を複数比較し、実際に話を聞いて相性を確かめましょう。",
  },
};

// ===== レーダーチャート =====
function calcRadar(scores: Scores) {
  const total =
    scores.designFirst +
    scores.performanceExpert +
    scores.costBalance +
    scores.lifestyleDesign +
    scores.trustPartner;

  if (total === 0) {
    return { design: 20, performance: 20, cost: 20, lifestyle: 20, trust: 20 };
  }

  return {
    design: Math.round((scores.designFirst / total) * 100),
    performance: Math.round((scores.performanceExpert / total) * 100),
    cost: Math.round((scores.costBalance / total) * 100),
    lifestyle: Math.round((scores.lifestyleDesign / total) * 100),
    trust: Math.round((scores.trustPartner / total) * 100),
  };
}

// ===== メイン関数 =====
export function diagnose(
  answers: Answer[],
  scoreBonus?: Partial<Record<TypeName, number>>,
  agentInsights?: AgentInsights
): DiagnosisResult {
  const scores = initScores();

  scoreQ17(scores, answers);
  scoreQ13(scores, answers);
  scoreQ14(scores, answers);
  scoreQ15(scores, answers);
  scoreQ16(scores, answers);
  scoreQ11(scores, answers);
  scoreQ12(scores, answers);
  scoreQ18(scores, answers);
  scoreQ19(scores, answers);

  // フォローアップ回答による微調整（固定ポイント加算）
  if (scoreBonus) {
    for (const [key, bonus] of Object.entries(scoreBonus)) {
      if (key in scores) {
        scores[key as TypeName] += bonus as number;
      }
    }
  }

  const { main, sub } = determineType(scores);
  const label = subLabels[main][sub];
  const displayLabel = label ? `${label}、${typeNames[main]}` : typeNames[main];

  const recSet = getTopRecommendations(answers, scores, main, sub, builders, agentInsights);
  const evidences = collectDiagnosisEvidence(answers, main);

  return {
    mainType: main,
    subType: sub,
    typeScores: scores,
    displayLabel,
    radarValues: calcRadar(scores),
    evidences: evidences.map((e) => ({
      questionId: e.questionId,
      questionText: e.questionText,
      answerLabel: e.answerLabel,
      explanation: e.explanation,
    })),
    recommendations: recSet.recommendations.map((r) => ({
      role: r.role,
      roleLabel: r.roleLabel,
      roleIntro: r.roleIntro,
      builderId: r.builderId,
      rawScore: r.rawScore,
      displayMatchRate: r.displayMatchRate,
      reasonText: r.reasonText,
      highlightAxis: r.highlightAxis,
    })),
    setExplanation: recSet.setExplanation,
    comparisonTip: recSet.comparisonTip,
  };
}

export { typeNames };
