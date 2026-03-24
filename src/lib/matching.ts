import { Answer, Builder } from "@/data/types";

function getAnswerValue(answers: Answer[], qId: string): string | undefined {
  const a = answers.find((a) => a.questionId === qId);
  if (!a) return undefined;
  return Array.isArray(a.value) ? a.value[0] : a.value;
}

function getAnswerArray(answers: Answer[], qId: string): string[] {
  const a = answers.find((a) => a.questionId === qId);
  if (!a) return [];
  return Array.isArray(a.value) ? a.value : [a.value];
}

function getRank(answers: Answer[], qId: string): string[] {
  const a = answers.find((a) => a.questionId === qId);
  return a?.rank || [];
}

// ===== 第1段階: 必須フィルタ =====
function filterBuilders(answers: Answer[], allBuilders: Builder[]): Builder[] {
  return allBuilders.filter((b) => {
    const userArea = getAnswerValue(answers, "Q7");
    if (userArea && !b.b1_areas.includes(userArea)) return false;

    const userBudget = getAnswerValue(answers, "Q4");
    if (userBudget && userBudget !== "undecided" && !b.b2_priceRanges.includes(userBudget)) return false;

    return true;
  });
}

// ===== デザイン適合: 外観 (18点) =====
function calcExteriorScore(userStyles: string[], builder: Builder): number {
  let score = 0;
  if (userStyles.length > 0) {
    if (userStyles[0] === builder.b3_bestStyle) score += 10;
    else if (builder.b3_exteriorStyles.includes(userStyles[0])) score += 7;
  }
  for (let i = 1; i < userStyles.length; i++) {
    if (builder.b3_exteriorStyles.includes(userStyles[i])) score += 4;
  }
  return Math.min(score, 18);
}

// ===== デザイン適合: 内装 (12点) =====
function calcInteriorScore(userStyles: string[], builder: Builder): number {
  const matchCount = userStyles.filter((s) => builder.b3_interiorStyles.includes(s)).length;
  return Math.min(matchCount * 4, 12);
}

// ===== 価値観適合: 会社選びの軸 (18点) =====
function calcValuesScore(userRank: string[], builder: Builder): number {
  let score = 0;
  if (userRank.length > 0) {
    if (builder.b7_topStrengths[0] === userRank[0]) score += 10;
    else if (builder.b7_topStrengths.includes(userRank[0])) score += 7;
  }
  if (userRank.length > 1 && builder.b7_topStrengths.includes(userRank[1])) score += 5;
  if (userRank.length > 2 && builder.b7_topStrengths.includes(userRank[2])) score += 3;
  return Math.min(score, 18);
}

// ===== 価値観適合: 接客スタイル (12点) =====
function calcStyleScore(q19: string | undefined, builder: Builder): number {
  const styleMap: Record<string, string> = {
    listening: "nurturing",
    proposal: "proactive",
    response: "speedy",
    honest: "honest",
    expertise: "expert",
  };
  if (!q19) return 0;
  const mapped = styleMap[q19];
  if (!mapped) return 0;
  const matchCount = builder.b6_styles.filter((s) => s === mapped).length;
  return Math.min(matchCount * 6, 12);
}

// ===== 性能適合: 重視性能 (14点) =====
function calcPerformanceScore(rank: string[], builder: Builder): number {
  if (rank.includes("none")) return 7;
  let score = 0;
  if (rank.length > 0 && builder.b4_strengths.includes(rank[0])) score += 6;
  if (rank.length > 1 && builder.b4_strengths.includes(rank[1])) score += 4;
  if (rank.length > 2 && builder.b4_strengths.includes(rank[2])) score += 4;
  return Math.min(score, 14);
}

// ===== 性能適合: 仕様テーマ (6点) =====
function calcSpecScore(userSpecs: string[], builder: Builder): number {
  if (userSpecs.includes("none")) return 3;
  const matchCount = userSpecs.filter((s) => builder.b4_specs.includes(s)).length;
  return Math.min(matchCount * 2, 6);
}

// ===== サービス適合: 土地サポート (6点) =====
function calcLandSupportScore(answers: Answer[], builder: Builder): number {
  const q8 = getAnswerValue(answers, "Q8");
  const q9 = getAnswerValue(answers, "Q9");
  if ((q8 === "searching" || q8 === "not_started") && builder.b5_services.includes("land_support")) {
    if (q9 === "yes_please") return 6;
    if (q9 === "both") return 4;
  }
  return 0;
}

// ===== サービス適合: ライフスタイル (4点) =====
function calcLifestyleServiceScore(q11: string[], builder: Builder): number {
  let score = 0;
  if (q11.includes("pet") && builder.b5_services.includes("pet")) score += 2;
  if (q11.includes("hobby_room") && builder.b5_services.includes("hobby_room")) score += 2;
  return Math.min(score, 4);
}

// ===== ボーナス (10点) =====
function calcBonusScore(answers: Answer[], builder: Builder): number {
  let score = 0;
  const userBudget = getAnswerValue(answers, "Q4");
  if (userBudget && userBudget === builder.b2_mainPriceRange) score += 4;

  const userExterior = getAnswerArray(answers, "Q13");
  if (userExterior.length > 0 && userExterior[0] === builder.b3_bestStyle) score += 3;

  const userQ17Rank = getRank(answers, "Q17");
  if (userQ17Rank.length > 0 && builder.b7_topStrengths[0] === userQ17Rank[0]) score += 3;

  return Math.min(score, 10);
}

// ===== マッチ度変換 =====
function toDisplayRate(rawScore: number, hasLandQuestion: boolean): number {
  const maxScore = hasLandQuestion ? 100 : 94;
  const rawRate = (rawScore / maxScore) * 100;
  const displayRate = 60 + rawRate * 0.4;
  return Math.round(displayRate);
}

// ===== おすすめ理由生成 =====
function generateReasonText(answers: Answer[], builder: Builder): string {
  const parts: string[] = [];

  const q17rank = getRank(answers, "Q17");
  const priorityLabels: Record<string, string> = {
    design: "デザイン力",
    cost: "コストパフォーマンス",
    performance: "住宅性能",
    personality: "担当者の人柄",
    after_service: "アフターサービス",
    track_record: "施工実績",
    land_support: "土地探しサポート",
    custom_design: "設計自由度",
  };
  if (q17rank.length > 0 && builder.b7_topStrengths.includes(q17rank[0])) {
    parts.push(`あなたが重視する「${priorityLabels[q17rank[0]] || q17rank[0]}」に強みを持つ会社です`);
  }

  const userExterior = getAnswerArray(answers, "Q13");
  const matchedStyles = userExterior.filter((s) => builder.b3_exteriorStyles.includes(s));
  if (matchedStyles.length > 0) {
    parts.push("お好みのデザインテイストを得意としています");
  }

  const q15rank = getRank(answers, "Q15");
  const matchedPerf = q15rank.filter((p) => builder.b4_strengths.includes(p));
  if (matchedPerf.length >= 2) {
    parts.push("重視する住宅性能の多くをカバーしています");
  }

  if (builder.b6_features.length > 0) {
    parts.push(`${builder.b6_features[0]}が特徴です`);
  }

  if (parts.length === 0) {
    parts.push("あなたの家づくりの条件にバランスよくマッチしています");
  }

  return parts.join("。") + "。";
}

// ===== メイン =====
export function calcMatchingScores(
  answers: Answer[],
  allBuilders: Builder[]
): { builderId: string; rawScore: number; displayMatchRate: number; reasonText: string }[] {
  const filtered = filterBuilders(answers, allBuilders);

  const q8 = getAnswerValue(answers, "Q8");
  const hasLandQuestion = q8 === "searching" || q8 === "not_started";

  const scored = filtered.map((builder) => {
    const userExterior = getAnswerArray(answers, "Q13");
    const userInterior = getAnswerArray(answers, "Q14");
    const q17rank = getRank(answers, "Q17");
    const q19 = getAnswerValue(answers, "Q19");
    const q15rank = getRank(answers, "Q15");
    const userSpecs = getAnswerArray(answers, "Q16");
    const q11 = getAnswerArray(answers, "Q11");

    const exterior = calcExteriorScore(userExterior, builder);
    const interior = calcInteriorScore(userInterior, builder);
    const values = calcValuesScore(q17rank, builder);
    const style = calcStyleScore(q19, builder);
    const perf = calcPerformanceScore(q15rank, builder);
    const spec = calcSpecScore(userSpecs, builder);
    const land = calcLandSupportScore(answers, builder);
    const lifestyle = calcLifestyleServiceScore(q11, builder);
    const bonus = calcBonusScore(answers, builder);

    const rawScore = exterior + interior + values + style + perf + spec + land + lifestyle + bonus;
    const displayMatchRate = toDisplayRate(rawScore, hasLandQuestion);

    return {
      builderId: builder.id,
      rawScore,
      displayMatchRate,
      reasonText: generateReasonText(answers, builder),
    };
  });

  return scored
    .filter((s) => s.displayMatchRate >= 70)
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 3);
}
