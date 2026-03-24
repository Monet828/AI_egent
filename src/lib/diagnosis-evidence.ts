import { Answer, TypeName } from "@/data/types";
import {
  PRIORITY_LABELS, EXTERIOR_LABELS, PERF_LABELS,
  LIFESTYLE_LABELS, ANXIETY_LABELS,
} from "./matching-v2";

export type DiagnosisEvidence = {
  questionId: string;
  questionText: string;
  answerLabel: string;
  contributedType: TypeName;
  points: number;
  explanation: string;
};

const TYPE_DISPLAY: Record<TypeName, string> = {
  designFirst: "デザインファースト型",
  performanceExpert: "性能エキスパート型",
  costBalance: "コストバランス型",
  lifestyleDesign: "暮らしデザイン型",
  trustPartner: "安心パートナー型",
  totalBalance: "トータルバランス型",
};

const CONTACT_LABELS: Record<string, string> = {
  listening: "じっくり話を聞いてくれる",
  proposal: "プロとして積極的に提案してくれる",
  response: "レスポンスが早い",
  honest: "正直にデメリットも教えてくれる",
  expertise: "専門知識が豊富",
};

const CONTACT_TYPE_MAP: Record<string, TypeName> = {
  listening: "trustPartner",
  proposal: "designFirst",
  response: "costBalance",
  honest: "trustPartner",
  expertise: "performanceExpert",
};

function getVal(answers: Answer[], qId: string): string {
  const a = answers.find((a) => a.questionId === qId);
  if (!a) return "";
  return Array.isArray(a.value) ? a.value[0] : a.value;
}

function getArr(answers: Answer[], qId: string): string[] {
  const a = answers.find((a) => a.questionId === qId);
  if (!a) return [];
  return Array.isArray(a.value) ? a.value : [a.value];
}

function getRank(answers: Answer[], qId: string): string[] {
  const a = answers.find((a) => a.questionId === qId);
  return a?.rank || [];
}

export function collectDiagnosisEvidence(
  answers: Answer[],
  mainType: TypeName,
): DiagnosisEvidence[] {
  const evidences: DiagnosisEvidence[] = [];

  // Q17: 最大ドライバー
  const q17rank = getRank(answers, "Q17");
  if (q17rank.length > 0) {
    const label = PRIORITY_LABELS[q17rank[0]] || q17rank[0];
    evidences.push({
      questionId: "Q17",
      questionText: "住宅会社を選ぶとき最も重視すること",
      answerLabel: label,
      contributedType: mainType,
      points: 8,
      explanation: `「${label}」を最重視 → ${TYPE_DISPLAY[mainType]}の傾向を強く示しています`,
    });
  }

  // Q15: 重視性能
  const q15rank = getRank(answers, "Q15");
  if (q15rank.length > 0 && !q15rank.includes("none")) {
    const labels = q15rank.slice(0, 2).map((v) => PERF_LABELS[v] || v).join("・");
    const energyPerf = ["insulation", "airtight", "energy"];
    const hasEnergy = q15rank.some((p) => energyPerf.includes(p));
    evidences.push({
      questionId: "Q15",
      questionText: "住宅性能で重視したいもの",
      answerLabel: labels,
      contributedType: hasEnergy ? "performanceExpert" : mainType,
      points: 6,
      explanation: `「${labels}」を重視 → 性能へのこだわりが表れています`,
    });
  }

  // Q13: 外観テイスト
  const q13 = getArr(answers, "Q13");
  if (q13.length > 0) {
    const labels = q13.map((v) => EXTERIOR_LABELS[v] || v).join("・");
    evidences.push({
      questionId: "Q13",
      questionText: "好みの外観テイスト",
      answerLabel: labels,
      contributedType: "designFirst",
      points: q13.length <= 2 ? 5 : 3,
      explanation: q13.length <= 2
        ? "明確なテイスト選択 → デザインへの意識の高さが出ています"
        : "幅広いテイストに関心 → バランス志向も見えます",
    });
  }

  // Q11: 暮らし方
  const q11 = getArr(answers, "Q11");
  if (q11.length > 0) {
    const labels = q11.slice(0, 2).map((v) => LIFESTYLE_LABELS[v] || v).join("、");
    evidences.push({
      questionId: "Q11",
      questionText: "家での過ごし方",
      answerLabel: labels,
      contributedType: "lifestyleDesign",
      points: 4,
      explanation: `具体的な暮らしのイメージ → 暮らしデザイン型の要素が含まれています`,
    });
  }

  // Q19: 担当者への期待
  const q19 = getVal(answers, "Q19");
  if (q19) {
    const label = CONTACT_LABELS[q19] || q19;
    const type = CONTACT_TYPE_MAP[q19] || mainType;
    evidences.push({
      questionId: "Q19",
      questionText: "担当者に最も期待すること",
      answerLabel: label,
      contributedType: type,
      points: 4,
      explanation: `「${label}」を期待 → ${TYPE_DISPLAY[type]}の価値観と一致しています`,
    });
  }

  // Q18: 不安
  const q18 = getVal(answers, "Q18");
  if (q18) {
    const label = ANXIETY_LABELS[q18] || q18;
    evidences.push({
      questionId: "Q18",
      questionText: "最も不安に感じていること",
      answerLabel: label,
      contributedType: mainType,
      points: 3,
      explanation: `「${label}」が不安 → この不安を解消できる会社選びが重要です`,
    });
  }

  // メインタイプ寄与 > ポイント順でソート、上位3つ
  return evidences
    .sort((a, b) => {
      const aMain = a.contributedType === mainType ? 1 : 0;
      const bMain = b.contributedType === mainType ? 1 : 0;
      if (aMain !== bMain) return bMain - aMain;
      return b.points - a.points;
    })
    .slice(0, 3);
}
