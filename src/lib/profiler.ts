import { Answer } from "@/data/types";

// =====================================================
// バックグラウンドプロファイラー
// =====================================================
// ユーザーの回答が蓄積されるたびに、Geminiで「潜在的な人物像」を
// バックグラウンドで構築する。UIはブロックしない。

export type UserProfile = {
  values: string[];           // 大切にしている価値観
  anxieties: string[];        // 潜在的な不安
  decisionStyle: string;      // 慎重派 / 行動派 / バランス派
  hiddenNeeds: string[];      // 潜在ニーズ
  weightAdjustments: {        // スコア調整
    design: number;
    performance: number;
    cost: number;
    lifestyle: number;
    trust: number;
  };
  summary: string;            // 1文で表す人物像
  updatedAt: number;          // 最終更新の回答数
};

const EMPTY_PROFILE: UserProfile = {
  values: [],
  anxieties: [],
  decisionStyle: "バランス派",
  hiddenNeeds: [],
  weightAdjustments: { design: 0, performance: 0, cost: 0, lifestyle: 0, trust: 0 },
  summary: "",
  updatedAt: 0,
};

// 回答を人間が読めるテキストに変換
const QUESTION_LABELS: Record<string, string> = {
  Q1: "検討段階", Q2: "入居希望時期", Q3: "検討社数",
  Q4: "総予算", Q5: "ローン状況", Q6: "月々の住居費",
  Q7: "建築エリア", Q8: "土地の状況", Q9: "土地探しサポート",
  Q10: "家族構成", Q11: "家での過ごし方", Q12: "現住まいの不満",
  Q13: "好みの外観", Q14: "好みの内装",
  Q15: "重視する住宅性能", Q16: "気になる仕様",
  Q17: "会社選びの軸", Q18: "最も不安なこと", Q19: "担当者への期待",
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  Q1: { info_gathering: "情報収集中", researching: "会社を調査中", talking: "会社と面談中", land_searching: "土地探し中", rebuild: "建替え検討中" },
  Q2: { within_6m: "半年以内", within_1y: "1年以内", "1_to_2y": "1〜2年以内", over_2y: "2年以上先" },
  Q3: { none: "未検討", "1_2": "1〜2社", "3_5": "3〜5社", over_6: "6社以上" },
  Q4: { under_2500: "2500万未満", "2500_3500": "2500〜3500万", "3500_4500": "3500〜4500万", "4500_5500": "4500〜5500万", over_5500: "5500万以上", undecided: "未定" },
  Q5: { pre_approved: "事前審査済", consulted: "相談済", not_yet: "未着手", no_loan: "ローン不要" },
  Q6: { under_7: "7万未満", "7_10": "7〜10万", "10_13": "10〜13万", "13_16": "13〜16万", over_16: "16万以上", undecided: "未定" },
  Q8: { owned: "土地あり", contracted: "契約済", searching: "探し中", not_started: "未着手" },
  Q9: { yes_please: "サポート希望", both: "自分でも+相談", self_search: "自分で探す" },
  Q11: { cooking: "料理", family_living: "家族リビング", remote_work: "在宅ワーク", hobby_room: "趣味部屋", outdoor_living: "アウトドア", pet: "ペット", storage: "収納", housework: "家事動線" },
  Q12: { storage: "収納不足", layout: "間取り不満", insulation: "暑い/寒い", noise: "騒音", aging: "設備老朽", sunlight: "日当たり", rent: "家賃", commute: "通勤" },
  Q13: { simple_modern: "シンプルモダン", natural_nordic: "北欧", japanese_modern: "和モダン", industrial: "インダストリアル", resort: "リゾート", hiraya: "平屋", other: "こだわりなし" },
  Q14: { white_clean: "ホワイト", natural_wood: "ナチュラルウッド", monotone: "モノトーン", cafe_vintage: "カフェ風", japanese: "和テイスト", colorful: "カラフル" },
  Q15: { insulation: "断熱", seismic: "耐震", airtight: "気密", energy: "省エネ", soundproof: "防音", natural_material: "自然素材", maintenance: "メンテナンス", none: "こだわりなし" },
  Q16: { zeh: "ZEH", long_quality: "長期優良", solar: "太陽光", whole_house_ac: "全館空調", passive: "パッシブ", smart_home: "スマートホーム", none: "こだわりなし" },
  Q17: { design: "デザイン", cost: "コスパ", performance: "性能", personality: "人柄", after_service: "アフター", track_record: "実績", land_support: "土地サポート", custom_design: "設計自由度" },
  Q18: { money: "お金", company_choice: "会社選び", land: "土地", process: "進め方", image: "完成イメージ", schedule: "スケジュール" },
  Q19: { listening: "傾聴", proposal: "提案力", response: "レスポンス", honest: "正直さ", expertise: "専門知識" },
};

function answersToContext(answers: Answer[]): string {
  return answers
    .map((a) => {
      const qLabel = QUESTION_LABELS[a.questionId] || a.questionId;
      const vLabels = VALUE_LABELS[a.questionId];
      const vals = Array.isArray(a.value) ? a.value : [a.value];
      const readable = vLabels
        ? vals.map((v) => vLabels[v] || v).join("、")
        : vals.join("、");
      return `- ${qLabel}: ${readable}`;
    })
    .join("\n");
}

// プロファイル更新のバッチ間隔（何問ごとにGeminiを呼ぶか）
const BATCH_INTERVAL = 4;

// プロファイル更新が必要か判定
export function shouldUpdateProfile(
  currentAnswerCount: number,
  lastUpdatedAt: number
): boolean {
  return currentAnswerCount - lastUpdatedAt >= BATCH_INTERVAL;
}

// バックグラウンドでプロファイルを更新
export async function updateProfile(
  answers: Answer[],
  currentProfile: UserProfile | null
): Promise<UserProfile | null> {
  const context = answersToContext(answers);
  if (!context) return null;

  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answersContext: context,
        previousProfile: currentProfile?.summary || null,
      }),
    });
    const data = await res.json();
    if (data.fallback) return null;

    return {
      values: data.values || [],
      anxieties: data.anxieties || [],
      decisionStyle: data.decisionStyle || "バランス派",
      hiddenNeeds: data.hiddenNeeds || [],
      weightAdjustments: {
        design: clamp(data.weightAdjustments?.design || 0),
        performance: clamp(data.weightAdjustments?.performance || 0),
        cost: clamp(data.weightAdjustments?.cost || 0),
        lifestyle: clamp(data.weightAdjustments?.lifestyle || 0),
        trust: clamp(data.weightAdjustments?.trust || 0),
      },
      summary: data.summary || "",
      updatedAt: answers.length,
    };
  } catch {
    return null;
  }
}

function clamp(v: number): number {
  return Math.max(-2, Math.min(2, Math.round(v)));
}

// プロファイルのweightAdjustmentsをdiagnose用のscoreBonusに変換
export function profileToScoreBonus(profile: UserProfile): Record<string, number> {
  const map: Record<string, string> = {
    design: "designFirst",
    performance: "performanceExpert",
    cost: "costBalance",
    lifestyle: "lifestyleDesign",
    trust: "trustPartner",
  };
  const bonus: Record<string, number> = {};
  for (const [axis, typeName] of Object.entries(map)) {
    const adj = profile.weightAdjustments[axis as keyof typeof profile.weightAdjustments];
    if (adj !== 0) bonus[typeName] = adj;
  }
  return bonus;
}

export { EMPTY_PROFILE };
