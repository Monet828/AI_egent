import { Answer, Builder, TypeName } from "@/data/types";

// =====================================================
// 型定義
// =====================================================

export type PreferenceWeights = {
  design: number;
  performance: number;
  cost: number;
  lifestyle: number;
  trust: number;
};

export type AgentInsights = {
  hiddenNeeds: string[];    // AIが検出した潜在ニーズ
  anxieties: string[];      // AIが検出した潜在不安
  values: string[];         // AIが検出した価値観
  agentDecisionStyle: string; // AIによる決断スタイル判定
};

export type UserPreferenceProfile = {
  // 制約
  area: string;
  budget: string;
  // 直接選好
  exteriorStyles: string[];
  interiorStyles: string[];
  performancePriorities: string[];
  specs: string[];
  valuePriorities: string[];
  desiredContactStyle: string;
  anxietyPoint: string;
  lifestyleNeeds: string[];
  currentPains: string[];
  landNeed: { searching: boolean; wantSupport: boolean };
  // タイプ由来
  mainType: TypeName;
  subType: TypeName;
  weights: PreferenceWeights;
  // 潜在属性
  focusIntensity: number;
  decisionStyle: "cautious" | "action" | "balanced";
  // エージェント由来（Geminiプロファイラーが蓄積した情報）
  agentInsights?: AgentInsights;
};

export type BuilderAxisScores = {
  // スペック軸
  insulationLevel: number;
  airtightLevel: number;
  seismicLevel: number;
  energyEfficiency: number;
  priceFit: number;
  scaleIndicator: number;
  designFreedom: number;
  // 相性軸
  designAffinity: number;
  lifestyleSupport: number;
  styleCompatibility: number;
  valueAlignment: number;
  anxietyRelief: number;
  trustSignal: number;
};

export type RecommendationRole = "bestMatch" | "contrastive" | "discovery";

export type ScoredBuilder = {
  builder: Builder;
  axisScores: BuilderAxisScores;
  weightedScore: number;
  finalScore: number;
  topAxis: keyof BuilderAxisScores;
};

export type RecommendationItem = {
  role: RecommendationRole;
  roleLabel: string;
  roleIntro: string;
  builderId: string;
  displayMatchRate: number;
  reasonText: string;
  highlightAxis: string;
  rawScore: number;
};

export type RecommendationSet = {
  recommendations: RecommendationItem[];
  setExplanation: string;
  comparisonTip: string;
};

// =====================================================
// 1. ユーザー選好プロファイル構築
// =====================================================

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

export function buildUserPreferenceProfile(
  answers: Answer[],
  typeScores: Record<TypeName, number>,
  mainType: TypeName,
  subType: TypeName,
  agentInsights?: AgentInsights
): UserPreferenceProfile {
  // タイプスコア → 重みベクトル（totalBalance除く5タイプで正規化）
  const fiveTotal =
    typeScores.designFirst +
    typeScores.performanceExpert +
    typeScores.costBalance +
    typeScores.lifestyleDesign +
    typeScores.trustPartner;

  const safeTotal = Math.max(fiveTotal, 1);
  const weights: PreferenceWeights = {
    design: typeScores.designFirst / safeTotal,
    performance: typeScores.performanceExpert / safeTotal,
    cost: typeScores.costBalance / safeTotal,
    lifestyle: typeScores.lifestyleDesign / safeTotal,
    trust: typeScores.trustPartner / safeTotal,
  };

  // こだわり集中度: 重みの標準偏差（高いほど集中）
  const mean = 0.2; // 均等なら0.2
  const variance =
    Object.values(weights).reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / 5;
  const focusIntensity = Math.min(Math.sqrt(variance) * 5, 1); // 0〜1に正規化

  // 決断スタイル
  const q1 = getVal(answers, "Q1");
  const q3 = getVal(answers, "Q3");
  const q18 = getVal(answers, "Q18");
  let decisionStyle: "cautious" | "action" | "balanced" = "balanced";
  if (
    (q1 === "info_gathering" || q1 === "researching") &&
    q3 === "none" &&
    (q18 === "process" || q18 === "company_choice")
  ) {
    decisionStyle = "cautious";
  } else if (
    (q1 === "talking" || q1 === "land_searching") &&
    (q3 === "3_5" || q3 === "over_6")
  ) {
    decisionStyle = "action";
  }

  const q8 = getVal(answers, "Q8");
  const q9 = getVal(answers, "Q9");

  // エージェントのdecisionStyleがあればルールベースを上書き
  if (agentInsights?.agentDecisionStyle) {
    const styleMap: Record<string, "cautious" | "action" | "balanced"> = {
      "慎重派": "cautious",
      "行動派": "action",
      "バランス派": "balanced",
    };
    const mapped = styleMap[agentInsights.agentDecisionStyle];
    if (mapped) decisionStyle = mapped;
  }

  return {
    area: getVal(answers, "Q7"),
    budget: getVal(answers, "Q4"),
    exteriorStyles: getArr(answers, "Q13"),
    interiorStyles: getArr(answers, "Q14"),
    performancePriorities: getRank(answers, "Q15"),
    specs: getArr(answers, "Q16"),
    valuePriorities: getRank(answers, "Q17"),
    desiredContactStyle: getVal(answers, "Q19"),
    anxietyPoint: q18,
    lifestyleNeeds: getArr(answers, "Q11"),
    currentPains: getArr(answers, "Q12"),
    landNeed: {
      searching: q8 === "searching" || q8 === "not_started",
      wantSupport: q9 === "yes_please" || q9 === "both",
    },
    mainType,
    subType,
    weights,
    focusIntensity,
    decisionStyle,
    agentInsights,
  };
}

// =====================================================
// 2. 制約フィルタ（フォールバック付き）
// =====================================================

export function filterBuildersByConstraints(
  profile: UserPreferenceProfile,
  builders: Builder[]
): { passed: Builder[]; relaxReason?: string } {
  // 厳密フィルタ
  const strict = builders.filter((b) => {
    if (profile.area && !b.b1_areas.includes(profile.area)) return false;
    if (profile.budget && profile.budget !== "undecided" && !b.b2_priceRanges.includes(profile.budget))
      return false;
    return true;
  });

  if (strict.length >= 3) return { passed: strict };

  // エリアのみでフィルタ（予算緩和）
  const areaOnly = builders.filter((b) => {
    if (profile.area && !b.b1_areas.includes(profile.area)) return false;
    return true;
  });

  if (areaOnly.length >= 3) {
    return { passed: areaOnly, relaxReason: "予算条件を広げておすすめしています" };
  }

  // 全緩和
  return { passed: builders, relaxReason: "エリア・予算条件を広げておすすめしています" };
}

// =====================================================
// 3. 基本スコア算出（13軸, 各0〜1）
// =====================================================

export function calcBuilderBaseScore(
  profile: UserPreferenceProfile,
  builder: Builder
): BuilderAxisScores {
  return {
    // --- スペック軸 ---
    insulationLevel: normalizeUA(builder.b4_values.ua),
    airtightLevel: normalizeC(builder.b4_values.c),
    seismicLevel: (builder.b4_values.seismicGrade ?? 1) / 3,
    energyEfficiency: normalizeZEH(builder.b4_values.zehCount, builder.b5_annualBuilds),
    priceFit: calcPriceFit(profile.budget, builder.b2_priceRanges, builder.b2_mainPriceRange),
    scaleIndicator: Math.min(builder.b5_annualBuilds / 100, 1),
    designFreedom: builder.b5_designFreedom === "full_custom" ? 1.0 : 0.5,

    // --- 相性軸 ---
    designAffinity: calcDesignAffinity(profile, builder),
    lifestyleSupport: calcLifestyleSupport(profile, builder),
    styleCompatibility: calcStyleCompatibility(profile.desiredContactStyle, builder.b6_styles),
    valueAlignment: calcValueAlignment(profile.valuePriorities, builder.b7_topStrengths),
    anxietyRelief: calcAnxietyRelief(profile.anxietyPoint, builder, profile.agentInsights),
    trustSignal: calcTrustSignal(builder),
  };
}

// --- 正規化ヘルパー ---
function normalizeUA(ua?: number): number {
  if (ua === undefined) return 0.3;
  // UA値: 0.2(最高) 〜 0.87(基準) → 0〜1に反転マッピング
  return Math.max(0, Math.min(1, (0.87 - ua) / 0.67));
}

function normalizeC(c?: number): number {
  if (c === undefined) return 0.3;
  // C値: 0.1(最高) 〜 2.0(基準) → 0〜1に反転マッピング
  return Math.max(0, Math.min(1, (2.0 - c) / 1.9));
}

function normalizeZEH(zehCount?: number, annualBuilds?: number): number {
  if (!zehCount || !annualBuilds || annualBuilds === 0) return 0.2;
  return Math.min(zehCount / annualBuilds, 1);
}

function calcPriceFit(
  userBudget: string,
  builderRanges: string[],
  mainRange: string
): number {
  if (!userBudget || userBudget === "undecided") return 0.7; // 未決定は中立
  if (userBudget === mainRange) return 1.0; // 最多帯と完全一致
  if (builderRanges.includes(userBudget)) return 0.7; // 対応範囲内
  // 隣接チェック
  const order = ["under_2500", "2500_3500", "3500_4500", "4500_5500", "over_5500"];
  const userIdx = order.indexOf(userBudget);
  const mainIdx = order.indexOf(mainRange);
  if (userIdx >= 0 && mainIdx >= 0 && Math.abs(userIdx - mainIdx) === 1) return 0.4;
  return 0.1;
}

// --- 相性軸ヘルパー ---
function calcDesignAffinity(profile: UserPreferenceProfile, builder: Builder): number {
  let score = 0;
  const ext = profile.exteriorStyles;
  const int = profile.interiorStyles;

  // 外観: 第1選択が最得意 → 高スコア
  if (ext.length > 0) {
    if (ext[0] === builder.b3_bestStyle) score += 0.4;
    else if (builder.b3_exteriorStyles.includes(ext[0])) score += 0.25;
  }
  // 外観: 2番目以降の一致
  for (let i = 1; i < ext.length; i++) {
    if (builder.b3_exteriorStyles.includes(ext[i])) score += 0.1;
  }
  // 内装の一致
  const intMatch = int.filter((s) => builder.b3_interiorStyles.includes(s)).length;
  score += Math.min(intMatch * 0.15, 0.3);

  return Math.min(score, 1);
}

function calcLifestyleSupport(profile: UserPreferenceProfile, builder: Builder): number {
  let score = 0;
  const needs = profile.lifestyleNeeds;

  // 土地サポート
  if (profile.landNeed.searching && profile.landNeed.wantSupport) {
    score += builder.b5_services.includes("land_support") ? 0.3 : 0;
  }

  // ライフスタイル対応
  if (needs.includes("pet") && builder.b5_services.includes("pet")) score += 0.2;
  if (needs.includes("hobby_room") && builder.b5_services.includes("hobby_room")) score += 0.15;

  // 暮らし系ニーズ全般（多いほど暮らし重視 → フルカスタムが有利）
  const lifestyleIntensity = needs.length / 8;
  if (builder.b5_designFreedom === "full_custom") score += lifestyleIntensity * 0.2;

  // 不満からの逆引き
  if (profile.currentPains.includes("layout") && builder.b5_designFreedom === "full_custom")
    score += 0.1;
  if (profile.currentPains.includes("storage") && builder.b5_services.includes("hobby_room"))
    score += 0.05;

  // --- エージェント由来: hiddenNeedsの反映 ---
  if (profile.agentInsights?.hiddenNeeds) {
    const hn = profile.agentInsights.hiddenNeeds;
    // 潜在ニーズのキーワードと工務店属性のマッチング
    const needsMap: [string[], (b: Builder) => boolean][] = [
      [["在宅", "リモート", "ワーク", "仕事"], (b) => b.b5_designFreedom === "full_custom" || b.b5_services.includes("hobby_room")],
      [["収納", "片付け", "整理"], (b) => b.b5_designFreedom === "full_custom"],
      [["ペット", "犬", "猫", "動物"], (b) => b.b5_services.includes("pet")],
      [["庭", "アウトドア", "BBQ", "テラス"], (b) => b.b5_services.includes("hobby_room") || b.b5_designFreedom === "full_custom"],
      [["老後", "バリアフリー", "将来"], (b) => b.b3_exteriorStyles.includes("hiraya") || b.b4_specs.includes("long_quality")],
      [["自然素材", "木", "無垢"], (b) => b.b4_strengths.includes("natural_material")],
      [["防音", "音", "楽器"], (b) => b.b4_strengths.includes("soundproof")],
    ];

    for (const [keywords, check] of needsMap) {
      const matched = hn.some((need) => keywords.some((kw) => need.includes(kw)));
      if (matched && check(builder)) {
        score += 0.1;
        break; // 最大1回のボーナス
      }
    }
  }

  return Math.min(score, 1);
}

function calcStyleCompatibility(desired: string, builderStyles: string[]): number {
  const map: Record<string, string> = {
    listening: "nurturing",
    proposal: "proactive",
    response: "speedy",
    honest: "honest",
    expertise: "expert",
  };
  const mapped = map[desired];
  if (!mapped) return 0.3;

  if (builderStyles[0] === mapped) return 1.0;  // 第一スタイルが一致
  if (builderStyles.includes(mapped)) return 0.7; // 第二スタイルが一致

  // 近いスタイルのマッピング（完全不一致でも0にしない）
  const proximity: Record<string, string[]> = {
    nurturing: ["honest"],
    proactive: ["expert"],
    speedy: ["proactive"],
    honest: ["nurturing"],
    expert: ["proactive"],
  };
  if (proximity[mapped]?.some((p) => builderStyles.includes(p))) return 0.4;

  return 0.2;
}

function calcValueAlignment(userRank: string[], builderTop: string[]): number {
  if (userRank.length === 0) return 0.3;
  let score = 0;

  // 1位完全一致
  if (userRank[0] === builderTop[0]) score += 0.5;
  else if (builderTop.includes(userRank[0])) score += 0.3;

  // 2位
  if (userRank.length > 1 && builderTop.includes(userRank[1])) score += 0.25;

  // 3位
  if (userRank.length > 2 && builderTop.includes(userRank[2])) score += 0.15;

  // 方向性の近さ（1つも一致しなくても、関連するタグがあれば）
  if (score === 0) score = 0.1;

  return Math.min(score, 1);
}

function calcAnxietyRelief(anxiety: string, builder: Builder, agentInsights?: AgentInsights): number {
  let baseScore = 0;
  switch (anxiety) {
    case "money":
      baseScore = builder.b7_topStrengths.includes("cost") ? 0.8
        : builder.b2_mainPriceRange.includes("2500") ? 0.5 : 0.2;
      break;
    case "company_choice":
      baseScore = (builder.awards.length > 0 ? 0.3 : 0) +
        (builder.reviews.length > 0 ? 0.2 : 0) +
        (builder.b5_annualBuilds > 40 ? 0.3 : 0.1);
      break;
    case "image":
      baseScore = builder.b7_topStrengths.includes("design") ? 0.8
        : builder.b5_designFreedom === "full_custom" ? 0.5 : 0.2;
      break;
    case "process":
      baseScore = builder.b6_styles.includes("nurturing") ? 0.7
        : builder.b6_styles.includes("honest") ? 0.5 : 0.2;
      break;
    case "schedule":
      baseScore = builder.b6_styles.includes("speedy") ? 0.8 : 0.3;
      break;
    case "land":
      baseScore = builder.b5_services.includes("land_support") ? 0.8 : 0.1;
      break;
    default:
      baseScore = 0.3;
  }

  // --- エージェント由来: 潜在不安の追加反映 ---
  if (agentInsights?.anxieties) {
    let bonus = 0;
    const ax = agentInsights.anxieties;
    // AIが検出した不安キーワードと工務店の強みをマッチ
    if (ax.some((a) => a.includes("予算") || a.includes("コスト") || a.includes("お金"))) {
      if (builder.b7_topStrengths.includes("cost")) bonus += 0.05;
    }
    if (ax.some((a) => a.includes("失敗") || a.includes("後悔") || a.includes("不安"))) {
      if (builder.awards.length >= 2 || builder.b5_annualBuilds >= 40) bonus += 0.05;
    }
    if (ax.some((a) => a.includes("営業") || a.includes("押し売り") || a.includes("しつこい"))) {
      if (builder.b6_styles.includes("honest") || builder.b6_styles.includes("nurturing")) bonus += 0.05;
    }
    baseScore += bonus;
  }

  return Math.min(baseScore, 1);
}

function calcTrustSignal(builder: Builder): number {
  let score = 0;
  // 受賞歴
  score += Math.min(builder.awards.length * 0.15, 0.3);
  // レビュー
  score += Math.min(builder.reviews.length * 0.1, 0.2);
  // 施工実績
  score += Math.min(builder.b5_annualBuilds / 100, 0.3);
  // キャンペーン（営業活動の証）
  if (builder.campaign) score += 0.1;
  // 特徴的なサービス
  score += Math.min(builder.b6_features.length * 0.05, 0.1);

  return Math.min(score, 1);
}

// =====================================================
// 4. タイプ補正（重みベクトル適用）
// =====================================================

// 各軸と重みキーの対応
const AXIS_WEIGHT_MAP: Record<keyof BuilderAxisScores, keyof PreferenceWeights> = {
  insulationLevel: "performance",
  airtightLevel: "performance",
  seismicLevel: "performance",
  energyEfficiency: "performance",
  priceFit: "cost",
  scaleIndicator: "trust",
  designFreedom: "lifestyle",
  designAffinity: "design",
  lifestyleSupport: "lifestyle",
  styleCompatibility: "trust",
  valueAlignment: "trust",
  anxietyRelief: "trust",
  trustSignal: "trust",
};

export function applyTypeAdjustment(
  axisScores: BuilderAxisScores,
  weights: PreferenceWeights
): number {
  let total = 0;
  let weightSum = 0;

  for (const [axis, score] of Object.entries(axisScores) as [keyof BuilderAxisScores, number][]) {
    const weightKey = AXIS_WEIGHT_MAP[axis];
    const w = weights[weightKey];
    // 重みに最低値を設定（完全に0にしない）
    const effectiveWeight = Math.max(w, 0.05);
    total += score * effectiveWeight;
    weightSum += effectiveWeight;
  }

  return weightSum > 0 ? total / weightSum : 0;
}

// =====================================================
// 5. 相性補正
// =====================================================

export function applyAffinityAdjustment(
  baseScore: number,
  profile: UserPreferenceProfile,
  builder: Builder
): number {
  let bonus = 0;

  // サブタイプ方向の隠れた適合
  const subTypeAffinityMap: Partial<Record<TypeName, (b: Builder) => boolean>> = {
    designFirst: (b) => b.b5_designFreedom === "full_custom" || b.b7_topStrengths.includes("design"),
    performanceExpert: (b) => (b.b4_values.ua ?? 1) < 0.35,
    costBalance: (b) => b.b7_topStrengths.includes("cost"),
    lifestyleDesign: (b) => b.b5_services.length >= 2,
    trustPartner: (b) => b.awards.length >= 2 || b.b5_annualBuilds >= 50,
  };

  const subCheck = subTypeAffinityMap[profile.subType];
  if (subCheck && subCheck(builder)) bonus += 0.06;

  // 決断スタイル × 接客スタイルの相性
  if (profile.decisionStyle === "cautious" && builder.b6_styles.includes("nurturing")) bonus += 0.04;
  if (profile.decisionStyle === "action" && builder.b6_styles.includes("speedy")) bonus += 0.04;

  // こだわり集中度が高いユーザーにフルカスタムをブースト
  if (profile.focusIntensity > 0.6 && builder.b5_designFreedom === "full_custom") bonus += 0.03;

  return Math.min(baseScore + bonus, 1);
}

// =====================================================
// 6. 3社の役割ベース出し分け
// =====================================================

function getTopAxis(scores: BuilderAxisScores): keyof BuilderAxisScores {
  let topKey: keyof BuilderAxisScores = "designAffinity";
  let topVal = -1;
  for (const [key, val] of Object.entries(scores) as [keyof BuilderAxisScores, number][]) {
    if (val > topVal) {
      topVal = val;
      topKey = key;
    }
  }
  return topKey;
}

function diversityBonus(candidate: ScoredBuilder, selected: ScoredBuilder[]): number {
  let bonus = 0;
  for (const s of selected) {
    if (candidate.builder.b3_bestStyle !== s.builder.b3_bestStyle) bonus += 0.03;
    if (candidate.builder.b2_mainPriceRange !== s.builder.b2_mainPriceRange) bonus += 0.02;
    if (Math.abs(candidate.builder.b5_annualBuilds - s.builder.b5_annualBuilds) > 20) bonus += 0.02;
  }
  return bonus;
}

// サブタイプ用の重みを生成
function generateSubTypeWeights(subType: TypeName): PreferenceWeights {
  const base: PreferenceWeights = { design: 0.2, performance: 0.2, cost: 0.2, lifestyle: 0.2, trust: 0.2 };
  const boostMap: Record<string, keyof PreferenceWeights> = {
    designFirst: "design",
    performanceExpert: "performance",
    costBalance: "cost",
    lifestyleDesign: "lifestyle",
    trustPartner: "trust",
    totalBalance: "design", // フォールバック
  };
  const boostKey = boostMap[subType] || "design";
  base[boostKey] += 0.3;
  // 再正規化
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(base) as (keyof PreferenceWeights)[]) {
    base[k] /= total;
  }
  return base;
}

export function diversifyRecommendations(
  scored: ScoredBuilder[],
  profile: UserPreferenceProfile
): RecommendationSet {
  if (scored.length === 0) {
    return {
      recommendations: [],
      setExplanation: "条件に合う工務店が見つかりませんでした。",
      comparisonTip: "",
    };
  }

  const results: RecommendationItem[] = [];

  // --- 本命 ---
  const best = scored[0];
  results.push({
    role: "bestMatch",
    roleLabel: "ベストマッチ",
    roleIntro: "", // 後で設定
    builderId: best.builder.id,
    displayMatchRate: toDisplayRate(best.finalScore),
    reasonText: "",
    highlightAxis: axisToLabel(best.topAxis),
    rawScore: best.finalScore,
  });

  if (scored.length >= 2) {
    // --- 比較軸 ---
    const bestTopAxis = best.topAxis;
    const contrastCandidates = scored.slice(1).map((s) => {
      let bestOtherScore = 0;
      let bestOtherAxis: keyof BuilderAxisScores = "designAffinity";
      for (const [key, val] of Object.entries(s.axisScores) as [keyof BuilderAxisScores, number][]) {
        if (key !== bestTopAxis && val > bestOtherScore) {
          bestOtherScore = val;
          bestOtherAxis = key;
        }
      }
      return { ...s, contrastScore: bestOtherScore + diversityBonus(s, [best]) * 2, contrastAxis: bestOtherAxis };
    });
    contrastCandidates.sort((a, b) => b.contrastScore - a.contrastScore);
    const contrast = contrastCandidates[0];

    results.push({
      role: "contrastive",
      roleLabel: "比較候補",
      roleIntro: "",
      builderId: contrast.builder.id,
      displayMatchRate: toDisplayRate(contrast.finalScore),
      reasonText: "",
      highlightAxis: axisToLabel(contrast.contrastAxis),
      rawScore: contrast.finalScore,
    });

    if (scored.length >= 3) {
      // --- 意外性 ---
      const subWeights = generateSubTypeWeights(profile.subType);
      const discoveryCandidates = scored
        .filter((s) => s.builder.id !== best.builder.id && s.builder.id !== contrast.builder.id)
        .map((s) => {
          const subScore = applyTypeAdjustment(s.axisScores, subWeights);
          const divBonus = diversityBonus(s, [best, contrast]);
          return { ...s, discoveryScore: subScore + divBonus };
        });
      discoveryCandidates.sort((a, b) => b.discoveryScore - a.discoveryScore);

      if (discoveryCandidates.length > 0) {
        const discovery = discoveryCandidates[0];
        results.push({
          role: "discovery",
          roleLabel: "新しい発見",
          roleIntro: "",
          builderId: discovery.builder.id,
          displayMatchRate: toDisplayRate(discovery.finalScore),
          reasonText: "",
          highlightAxis: axisToLabel(discovery.topAxis),
          rawScore: discovery.finalScore,
        });
      }
    }
  }

  // 役割イントロを設定
  const intros = generateRoleIntros(profile, results);
  for (const rec of results) {
    rec.roleIntro = intros[rec.role];
  }

  return {
    recommendations: results,
    setExplanation: generateSetExplanation(profile, results),
    comparisonTip: generateComparisonTip(profile),
  };
}

// =====================================================
// 7. 理由テキスト生成 v2（テンプレートベース）
// =====================================================

const AXIS_LABELS: Record<keyof BuilderAxisScores, string> = {
  insulationLevel: "断熱性能",
  airtightLevel: "気密性能",
  seismicLevel: "耐震性能",
  energyEfficiency: "省エネ性能",
  priceFit: "価格適合度",
  scaleIndicator: "施工実績",
  designFreedom: "設計自由度",
  designAffinity: "デザイン適合",
  lifestyleSupport: "暮らしサポート",
  styleCompatibility: "接客スタイル",
  valueAlignment: "価値観の一致",
  anxietyRelief: "不安解消力",
  trustSignal: "信頼性",
};

function axisToLabel(axis: keyof BuilderAxisScores): string {
  return AXIS_LABELS[axis] || axis;
}

// --- ラベル辞書 ---
const PRIORITY_LABELS: Record<string, string> = {
  design: "デザイン力", cost: "コストパフォーマンス", performance: "住宅性能",
  personality: "担当者の人柄", after_service: "アフターサービス",
  track_record: "施工実績", land_support: "土地探しサポート", custom_design: "設計自由度",
};

const EXTERIOR_LABELS: Record<string, string> = {
  simple_modern: "シンプルモダン", natural_nordic: "ナチュラル・北欧",
  japanese_modern: "和モダン", industrial: "インダストリアル",
  resort: "リゾート", hiraya: "平屋", other: "その他",
};

const INTERIOR_LABELS: Record<string, string> = {
  white_clean: "ホワイト・クリーン", natural_wood: "ナチュラルウッド",
  monotone: "モノトーン", cafe_vintage: "カフェ・ヴィンテージ",
  japanese: "和テイスト", colorful: "カラフル・ポップ",
};

const PERF_LABELS: Record<string, string> = {
  insulation: "断熱性", seismic: "耐震性", airtight: "気密性",
  energy: "省エネ性", soundproof: "防音性", natural_material: "自然素材",
  maintenance: "メンテナンス性",
};

const LIFESTYLE_LABELS: Record<string, string> = {
  cooking: "料理・キッチンにこだわりたい", family_living: "家族が自然と集まるリビング",
  remote_work: "在宅ワークのスペースが欲しい", hobby_room: "趣味の部屋が欲しい",
  outdoor_living: "庭・テラスでアウトドアを楽しみたい", pet: "ペットと暮らしやすい家",
  storage: "収納をたっぷり確保したい", housework: "家事がラクになる動線",
};

const ANXIETY_LABELS: Record<string, string> = {
  money: "予算面の不安", company_choice: "会社選びの不安", land: "土地探しの不安",
  process: "進め方への不安", image: "完成イメージへの不安", schedule: "スケジュールの不安",
};

// --- テンプレート型 ---
type ReasonTemplate = {
  condition: (ctx: ReasonContext) => boolean;
  generate: (ctx: ReasonContext) => string;
  priority: number;
  category: "main" | "sub" | "anxiety";
};

type ReasonContext = {
  profile: UserPreferenceProfile;
  builder: Builder;
  axisScores: BuilderAxisScores;
  role: RecommendationRole;
  topAxis: keyof BuilderAxisScores;
  // 導出済みラベル
  userFirstPriority: string;
  userExteriorFirst: string;
  userInteriorLabels: string;
  userPerfTop: string;
  userAnxiety: string;
  userLifestyleFirst: string;
  builderUA: string | null;
  builderC: string | null;
  builderZEH: string | null;
  builderAward: string | null;
  builderTopFeature: string;
  builderDesignFreedom: string;
};

function buildReasonContext(
  role: RecommendationRole,
  profile: UserPreferenceProfile,
  builder: Builder,
  axisScores: BuilderAxisScores,
  topAxis: keyof BuilderAxisScores
): ReasonContext {
  return {
    profile, builder, axisScores, role, topAxis,
    userFirstPriority: PRIORITY_LABELS[profile.valuePriorities[0]] || "",
    userExteriorFirst: EXTERIOR_LABELS[profile.exteriorStyles[0]] || "",
    userInteriorLabels: profile.interiorStyles.map((s) => INTERIOR_LABELS[s] || s).join("・"),
    userPerfTop: PERF_LABELS[profile.performancePriorities[0]] || "",
    userAnxiety: ANXIETY_LABELS[profile.anxietyPoint] || "",
    userLifestyleFirst: LIFESTYLE_LABELS[profile.lifestyleNeeds[0]] || "",
    builderUA: builder.b4_values.ua !== undefined ? String(builder.b4_values.ua) : null,
    builderC: builder.b4_values.c !== undefined ? String(builder.b4_values.c) : null,
    builderZEH: builder.b4_values.zehCount ? `年間${builder.b4_values.zehCount}棟` : null,
    builderAward: builder.awards.length > 0 ? builder.awards[0] : null,
    builderTopFeature: builder.b6_features[0] || "",
    builderDesignFreedom: builder.b5_designFreedom === "full_custom" ? "フルオーダー" : "セミオーダー",
  };
}

const REASON_TEMPLATES: ReasonTemplate[] = [
  // ===== 主理由 =====
  {
    condition: (ctx) => ctx.axisScores.valueAlignment >= 0.5 && !!ctx.userFirstPriority
      && ctx.builder.b7_topStrengths.includes(ctx.profile.valuePriorities[0]),
    generate: (ctx) =>
      `あなたが1位に選んだ「${ctx.userFirstPriority}」は、${ctx.builder.name}が最も力を入れている領域です`,
    priority: 10,
    category: "main",
  },
  {
    condition: (ctx) => ctx.axisScores.designAffinity >= 0.5 && !!ctx.userExteriorFirst,
    generate: (ctx) => {
      const isBest = ctx.builder.b3_bestStyle === ctx.profile.exteriorStyles[0];
      return isBest
        ? `あなたが選んだ「${ctx.userExteriorFirst}」を最も得意とし、内装も${ctx.userInteriorLabels}のテイストに対応できる会社です`
        : `「${ctx.userExteriorFirst}」を含む幅広いデザインに対応でき、内装も${ctx.userInteriorLabels}に実績がある会社です`;
    },
    priority: 9,
    category: "main",
  },
  {
    condition: (ctx) =>
      (ctx.axisScores.insulationLevel >= 0.6 || ctx.axisScores.airtightLevel >= 0.6) && !!ctx.builderUA,
    generate: (ctx) => {
      const specs = [
        ctx.builderUA ? `UA値${ctx.builderUA}` : null,
        ctx.builderC ? `C値${ctx.builderC}` : null,
      ].filter(Boolean).join("・");
      return `あなたが重視する「${ctx.userPerfTop}」で、${specs}という具体的な数値を実現している会社です`;
    },
    priority: 9,
    category: "main",
  },
  {
    condition: (ctx) => ctx.axisScores.priceFit >= 0.8,
    generate: (ctx) =>
      `あなたの予算帯で最も施工実績が多く、年間${ctx.builder.b5_annualBuilds}棟の経験からコストパフォーマンスの高い提案ができる会社です`,
    priority: 8,
    category: "main",
  },
  {
    condition: (ctx) => ctx.axisScores.lifestyleSupport >= 0.4 && !!ctx.userLifestyleFirst,
    generate: (ctx) =>
      `「${ctx.userLifestyleFirst}」を重視するあなたに、${ctx.builderDesignFreedom}の設計力で応えられる会社です`,
    priority: 8,
    category: "main",
  },
  {
    condition: (ctx) => ctx.axisScores.trustSignal >= 0.5 && !!ctx.builderAward,
    generate: (ctx) =>
      `${ctx.builderAward}の実績を持ち、年間${ctx.builder.b5_annualBuilds}棟の施工経験がある信頼性の高い会社です`,
    priority: 7,
    category: "main",
  },
  // フォールバック主理由
  {
    condition: () => true,
    generate: (ctx) =>
      `あなたの家づくりの条件にバランスよくマッチしている会社です`,
    priority: 1,
    category: "main",
  },

  // ===== 補助理由 =====
  {
    condition: (ctx) => !!ctx.builderZEH && ctx.axisScores.energyEfficiency >= 0.5,
    generate: (ctx) => `ZEH施工は${ctx.builderZEH}の実績があります`,
    priority: 6,
    category: "sub",
  },
  {
    condition: (ctx) => !!ctx.builderTopFeature,
    generate: (ctx) => `「${ctx.builderTopFeature}」も特徴のひとつです`,
    priority: 5,
    category: "sub",
  },
  {
    condition: (ctx) => ctx.builderDesignFreedom === "フルオーダー",
    generate: () => `フルオーダーで自由な設計が可能です`,
    priority: 4,
    category: "sub",
  },
  {
    condition: (ctx) => ctx.builder.b5_annualBuilds >= 50,
    generate: (ctx) => `年間${ctx.builder.b5_annualBuilds}棟の豊富な施工実績があります`,
    priority: 3,
    category: "sub",
  },

  // ===== 不安解消 =====
  {
    condition: (ctx) => ctx.profile.anxietyPoint === "money" && ctx.axisScores.priceFit >= 0.5,
    generate: () => `予算の不安には、明朗な見積もりと資金計画のサポートで応えてくれます`,
    priority: 6,
    category: "anxiety",
  },
  {
    condition: (ctx) => ctx.profile.anxietyPoint === "company_choice",
    generate: (ctx) =>
      ctx.builderAward
        ? `会社選びに迷うあなたへ——${ctx.builderAward}の実績が判断材料になるはずです`
        : `会社選びに迷うあなたへ——年間${ctx.builder.b5_annualBuilds}棟の施工実績が安心の裏付けです`,
    priority: 6,
    category: "anxiety",
  },
  {
    condition: (ctx) => ctx.profile.anxietyPoint === "image",
    generate: (ctx) =>
      `完成イメージが湧かない不安には、${ctx.builderTopFeature || "丁寧な提案力"}で応えてくれます`,
    priority: 6,
    category: "anxiety",
  },
  {
    condition: (ctx) => ctx.profile.anxietyPoint === "process",
    generate: (ctx) =>
      ctx.builder.b6_styles.includes("nurturing")
        ? `進め方への不安には、寄り添い型のサポートで安心して進められます`
        : `進め方への不安には、${ctx.builderTopFeature || "経験豊富なスタッフ"}がしっかりガイドしてくれます`,
    priority: 5,
    category: "anxiety",
  },
  {
    condition: (ctx) => ctx.profile.anxietyPoint === "land" && ctx.builder.b5_services.includes("land_support"),
    generate: () => `土地探しの不安には、土地探しサポートサービスで一緒に解決してくれます`,
    priority: 6,
    category: "anxiety",
  },
];

export function generateReasonText(
  role: RecommendationRole,
  profile: UserPreferenceProfile,
  builder: Builder,
  axisScores: BuilderAxisScores,
  topAxis: keyof BuilderAxisScores = "designAffinity"
): string {
  const ctx = buildReasonContext(role, profile, builder, axisScores, topAxis);
  const applicable = REASON_TEMPLATES.filter((t) => t.condition(ctx));

  const main = applicable
    .filter((t) => t.category === "main")
    .sort((a, b) => b.priority - a.priority)[0];
  const sub = applicable
    .filter((t) => t.category === "sub")
    .sort((a, b) => b.priority - a.priority)[0];
  const anxiety = applicable
    .filter((t) => t.category === "anxiety")
    .sort((a, b) => b.priority - a.priority)[0];

  const rolePrefix: Record<RecommendationRole, string> = {
    bestMatch: "",
    contrastive: "別の角度から見ると、",
    discovery: "視野を広げると、",
  };

  const parts: string[] = [];
  if (main) parts.push(main.generate(ctx));
  if (sub) parts.push(sub.generate(ctx));
  if (anxiety) parts.push(anxiety.generate(ctx));

  return rolePrefix[role] + parts.join("。") + "。";
}

// ラベル辞書をexport（他モジュールから使う）
export {
  PRIORITY_LABELS, EXTERIOR_LABELS, INTERIOR_LABELS,
  PERF_LABELS, LIFESTYLE_LABELS, ANXIETY_LABELS,
};

// =====================================================
// マッチ度変換（S字カーブ）
// =====================================================

function toDisplayRate(normalizedScore: number): number {
  const curved = Math.pow(Math.max(0, Math.min(1, normalizedScore)), 0.7);
  return Math.round(65 + curved * 33);
}

// セットストーリー生成
const TYPE_SHORT_LABELS: Record<TypeName, string> = {
  designFirst: "デザイン重視", performanceExpert: "性能重視",
  costBalance: "コスパ重視", lifestyleDesign: "暮らし重視",
  trustPartner: "安心重視", totalBalance: "バランス重視",
};

const TYPE_DISPLAY_NAMES: Record<TypeName, string> = {
  designFirst: "デザインファースト型", performanceExpert: "性能エキスパート型",
  costBalance: "コストバランス型", lifestyleDesign: "暮らしデザイン型",
  trustPartner: "安心パートナー型", totalBalance: "トータルバランス型",
};

function generateSetExplanation(
  profile: UserPreferenceProfile,
  recs: RecommendationItem[]
): string {
  const topPriority = PRIORITY_LABELS[profile.valuePriorities[0]] || "家づくりの条件";
  const contrastRec = recs.find((r) => r.role === "contrastive");
  const discoveryRec = recs.find((r) => r.role === "discovery");

  let text = `「${topPriority}」を最重視するあなたに、その条件に最も強い本命`;
  if (contrastRec) text += `、「${contrastRec.highlightAxis}」の視点で比較できる候補`;
  if (discoveryRec) text += `、そして${TYPE_DISPLAY_NAMES[profile.subType]}の傾向にも応える発見枠`;
  text += `の${recs.length}社を選びました。`;
  text += `この${recs.length}社を比較することで、あなたにとって何が本当に大事かが見えてきます。`;

  return text;
}

function generateRoleIntros(
  profile: UserPreferenceProfile,
  recs: RecommendationItem[]
): Record<RecommendationRole, string> {
  const topPriority = PRIORITY_LABELS[profile.valuePriorities[0]] || "あなたの条件";
  const contrastRec = recs.find((r) => r.role === "contrastive");

  return {
    bestMatch: `あなたの最重要条件「${topPriority}」に最も強い`,
    contrastive: contrastRec
      ? `本命とは違う強み——「${contrastRec.highlightAxis}」で選ぶならこちら`
      : "別の視点で検討できる候補",
    discovery: `あなたの「${TYPE_DISPLAY_NAMES[profile.subType]}」への関心にも応えられる`,
  };
}

function generateComparisonTip(profile: UserPreferenceProfile): string {
  if (profile.decisionStyle === "cautious") {
    return "まずは3社すべてに資料請求して、手元で比較してみましょう。焦らず、自分のペースで進めるのがあなたに合った進め方です。";
  }
  if (profile.decisionStyle === "action") {
    return "気になった会社があれば、まず1社来場予約してみましょう。実際に話を聞くことで、比較の軸がはっきりします。";
  }
  return "3社の資料を見比べて、「ここだけは譲れない」と感じるポイントを見つけてください。それがあなたの本当の判断軸です。";
}

// =====================================================
// 8. エントリポイント
// =====================================================

export function getTopRecommendations(
  answers: Answer[],
  typeScores: Record<TypeName, number>,
  mainType: TypeName,
  subType: TypeName,
  allBuilders: Builder[],
  agentInsights?: AgentInsights
): RecommendationSet {
  // 1. プロファイル構築（エージェントの洞察を注入）
  const profile = buildUserPreferenceProfile(answers, typeScores, mainType, subType, agentInsights);

  // 2. フィルタ
  const { passed, relaxReason } = filterBuildersByConstraints(profile, allBuilders);

  // 3〜5. スコアリング
  const scored: ScoredBuilder[] = passed.map((builder) => {
    const axisScores = calcBuilderBaseScore(profile, builder);
    const weightedScore = applyTypeAdjustment(axisScores, profile.weights);
    const finalScore = applyAffinityAdjustment(weightedScore, profile, builder);
    const topAxis = getTopAxis(axisScores);
    return { builder, axisScores, weightedScore, finalScore, topAxis };
  });

  // ソート
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // 6. 役割ベース出し分け
  const recSet = diversifyRecommendations(scored, profile);

  // 7. 理由テキスト生成
  for (const rec of recSet.recommendations) {
    const sb = scored.find((s) => s.builder.id === rec.builderId);
    if (sb) {
      rec.reasonText = generateReasonText(rec.role, profile, sb.builder, sb.axisScores, sb.topAxis);
    }
  }

  // 緩和理由を付記
  if (relaxReason) {
    recSet.setExplanation += `（${relaxReason}）`;
  }

  return recSet;
}
