import { Answer, DiagnosisResult, FollowupDecision, FollowupQuestion, FollowupTrigger } from "@/data/types";

// =====================================================
// 追加質問の候補プール
// =====================================================
// 各質問は中立的な2択。選択肢の文言は対称的にし、
// 特定の工務店や結論に誘導しない。
// delta値は 0.03-0.04 に抑え、型の逆転を防ぐ。

const FOLLOWUP_QUESTIONS: (FollowupQuestion & { triggers: FollowupTrigger[] })[] = [
  {
    id: "FQ1",
    triggers: ["score_tie"],
    text: "今のあなたにより近いのはどちらですか？",
    options: [
      { value: "appearance", label: "外観や内装の好みを重視したい" },
      { value: "livability", label: "断熱や耐震などの性能を重視したい" },
    ],
    adjustments: {
      appearance: { axis: "design", delta: 0.04 },
      livability: { axis: "performance", delta: 0.04 },
    },
  },
  {
    id: "FQ2",
    triggers: ["score_tie", "anxiety_ambiguous"],
    text: "家づくりで特に避けたいのはどちらですか？",
    options: [
      { value: "over_budget", label: "予算が想定より膨らむこと" },
      { value: "regret", label: "住み始めてから不満が出ること" },
    ],
    adjustments: {
      over_budget: { axis: "cost", delta: 0.04 },
      regret: { axis: "performance", delta: 0.03 },
    },
  },
  {
    id: "FQ3",
    triggers: ["score_tie", "reason_abstract"],
    text: "住宅会社に求めるものとして、より強いのはどちらですか？",
    options: [
      { value: "proposal", label: "プロとして積極的に提案してくれること" },
      { value: "listen", label: "こちらの希望をじっくり聞いてくれること" },
    ],
    adjustments: {
      proposal: { axis: "design", delta: 0.03 },
      listen: { axis: "trust", delta: 0.03 },
    },
  },
  {
    id: "FQ4",
    triggers: ["discovery_weak"],
    text: "もし2社で迷ったとき、決め手にしたいのはどちらですか？",
    options: [
      { value: "track_record", label: "これまでの施工実績や評判" },
      { value: "flexibility", label: "間取りや設計の自由度" },
    ],
    adjustments: {
      track_record: { axis: "trust", delta: 0.04 },
      flexibility: { axis: "design", delta: 0.04 },
    },
  },
  {
    id: "FQ5",
    triggers: ["score_tie", "reason_abstract"],
    text: "家に求めるものとして、より強いのはどちらですか？",
    options: [
      { value: "individuality", label: "自分らしいこだわりを形にできること" },
      { value: "efficiency", label: "日々の家事や暮らしがラクになること" },
    ],
    adjustments: {
      individuality: { axis: "design", delta: 0.03 },
      efficiency: { axis: "lifestyle", delta: 0.03 },
    },
  },
];

// =====================================================
// 判定: 追加質問が必要か？
// =====================================================
// トリガーは厳しめに設定し、全体の20-30%程度でのみ発火を目指す。
// 複数トリガーが同時に成立した場合のみ質問を出す。

export function shouldAskFollowup(result: DiagnosisResult): FollowupDecision {
  const triggers: FollowupTrigger[] = [];

  // 条件1: 上位2候補のマッチ率差が極めて小さい（≤2%）
  if (result.recommendations.length >= 2) {
    const [first, second] = result.recommendations;
    const gap = first.displayMatchRate - second.displayMatchRate;
    if (gap <= 2) {
      triggers.push("score_tie");
    }
  }

  // 条件2: typeScoresの上位2タイプの差が小さい（タイプ判定が曖昧）
  const scores = Object.entries(result.typeScores)
    .filter(([k]) => k !== "totalBalance")
    .map(([, v]) => v)
    .sort((a, b) => b - a);
  if (scores.length >= 2 && scores[0] - scores[1] <= 3) {
    triggers.push("weight_balanced");
  }

  // 条件3: 発見枠のスコアが本命と大きく離れている
  if (result.recommendations.length === 3) {
    const best = result.recommendations[0];
    const discovery = result.recommendations.find((r) => r.role === "discovery");
    if (discovery && best.displayMatchRate - discovery.displayMatchRate >= 18) {
      triggers.push("discovery_weak");
    }
  }

  // 条件4: 推薦理由が短い（抽象的になりがち）
  const shortReasonCount = result.recommendations.filter((r) => r.reasonText.length < 30).length;
  if (shortReasonCount >= 2) {
    triggers.push("reason_abstract");
  }

  // 単一トリガーでは質問しない。複数条件が重なったときのみ。
  // ただし score_tie は単独でも発火（最も影響が大きい）
  if (triggers.length === 0) {
    return { shouldAsk: false };
  }
  if (triggers.length === 1 && triggers[0] !== "score_tie") {
    return { shouldAsk: false };
  }

  const question = selectFollowupQuestion(triggers);
  if (!question) {
    return { shouldAsk: false };
  }

  return {
    shouldAsk: true,
    trigger: triggers[0],
    question,
  };
}

// =====================================================
// 選択: どの追加質問を出すか
// =====================================================

function selectFollowupQuestion(triggers: FollowupTrigger[]): FollowupQuestion | undefined {
  // トリガーとの一致数でスコアリングし、同点なら候補からランダム選択
  let bestScore = 0;
  let candidates: (typeof FOLLOWUP_QUESTIONS)[number][] = [];

  for (const q of FOLLOWUP_QUESTIONS) {
    const matchCount = q.triggers.filter((t) => triggers.includes(t)).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      candidates = [q];
    } else if (matchCount === bestScore && matchCount > 0) {
      candidates.push(q);
    }
  }

  if (candidates.length === 0) return undefined;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const { triggers: _, ...question } = picked;
  return question;
}

// =====================================================
// 反映: 追加質問の回答を元の回答に追加
// =====================================================

export function applyFollowupAnswer(
  answers: Answer[],
  question: FollowupQuestion,
  selectedValue: string
): Answer[] {
  return [
    ...answers,
    { questionId: question.id, value: selectedValue },
  ];
}

export function getScoreAdjustment(
  question: FollowupQuestion,
  selectedValue: string
): { axis: string; delta: number } | null {
  const adj = question.adjustments[selectedValue];
  return adj || null;
}

// フォローアップ回答からスコアボーナスマップを生成する。
// diagnose() の第2引数に渡して、元スコアに加算させる。
// prevResultには依存しない。
const AXIS_TO_TYPE: Record<string, string> = {
  design: "designFirst",
  performance: "performanceExpert",
  cost: "costBalance",
  lifestyle: "lifestyleDesign",
  trust: "trustPartner",
};

// delta (0.03-0.04) → 固定2ポイント加算。
// Q17の最大加算が8ポイントなので、2ポイントは全体の25%程度の微調整。
export function buildScoreBonus(
  axis: string,
  delta: number
): Record<string, number> {
  const typeName = AXIS_TO_TYPE[axis];
  if (!typeName) return {};
  return { [typeName]: Math.round(50 * delta) };
}
