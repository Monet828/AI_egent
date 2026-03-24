import { Answer } from "@/data/types";
import { UserProfile } from "./profiler";

// =====================================================
// 動的ヒアリングエージェント
// =====================================================
// 毎問バックグラウンドで動作し、3つの「行動」を行う:
// 1. リアクション: 回答を踏まえた一言
// 2. 動的subText: 次の質問の前置きをパーソナライズ
// 3. 深掘りプローブ: 潜在ニーズに基づく追加質問の差し込み

// --- 回答ラベル変換 ---
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
  Q1: { info_gathering: "情報収集中", researching: "調査中", talking: "面談中", land_searching: "土地探し中", rebuild: "建替え検討" },
  Q4: { under_2500: "2500万未満", "2500_3500": "2500〜3500万", "3500_4500": "3500〜4500万", "4500_5500": "4500〜5500万", over_5500: "5500万以上", undecided: "未定" },
  Q5: { pre_approved: "事前審査済", consulted: "相談済", not_yet: "未着手", no_loan: "ローン不要" },
  Q6: { under_7: "7万未満", "7_10": "7〜10万", "10_13": "10〜13万", "13_16": "13〜16万", over_16: "16万以上", undecided: "未定" },
  Q11: { cooking: "料理", family_living: "家族リビング", remote_work: "在宅ワーク", hobby_room: "趣味部屋", outdoor_living: "アウトドア", pet: "ペット", storage: "収納", housework: "家事動線" },
  Q12: { storage: "収納不足", layout: "間取り不満", insulation: "暑い/寒い", noise: "騒音", aging: "設備古い", sunlight: "日当たり", rent: "家賃", commute: "通勤" },
  Q13: { simple_modern: "シンプルモダン", natural_nordic: "北欧", japanese_modern: "和モダン", industrial: "インダストリアル", resort: "リゾート", hiraya: "平屋", other: "こだわりなし" },
  Q14: { white_clean: "ホワイト", natural_wood: "ナチュラルウッド", monotone: "モノトーン", cafe_vintage: "カフェ風", japanese: "和テイスト", colorful: "カラフル" },
  Q17: { design: "デザイン", cost: "コスパ", performance: "性能", personality: "人柄", after_service: "アフター", track_record: "実績", land_support: "土地サポート", custom_design: "設計自由度" },
  Q18: { money: "お金", company_choice: "会社選び", land: "土地", process: "進め方", image: "完成イメージ", schedule: "スケジュール" },
  Q19: { listening: "傾聴", proposal: "提案力", response: "レスポンス", honest: "正直さ", expertise: "専門知識" },
};

function answerToLabel(qId: string, value: string | string[]): string {
  const labels = VALUE_LABELS[qId];
  const vals = Array.isArray(value) ? value : [value];
  if (labels) return vals.map((v) => labels[v] || v).join("、");
  return vals.join("、");
}

function answersToShortContext(answers: Answer[]): string {
  return answers
    .slice(-6) // 直近6問のみ
    .map((a) => `${QUESTION_LABELS[a.questionId] || a.questionId}: ${answerToLabel(a.questionId, a.value)}`)
    .join(" / ");
}

// =====================================================
// 1. 動的リアクション
// =====================================================

export async function fetchDynamicReaction(
  questionId: string,
  value: string | string[],
  profile: UserProfile | null
): Promise<string | null> {
  try {
    const res = await fetch("/api/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionLabel: QUESTION_LABELS[questionId] || questionId,
        answerLabel: answerToLabel(questionId, value),
        profileSummary: profile?.summary || null,
      }),
    });
    const data = await res.json();
    if (data.fallback) return null;
    return data.text || null;
  } catch {
    return null;
  }
}

// =====================================================
// 2. 動的subText
// =====================================================

export async function fetchDynamicSubText(
  questionId: string,
  questionText: string,
  answers: Answer[],
  profile: UserProfile | null
): Promise<string | null> {
  if (!profile?.summary) return null;

  try {
    const res = await fetch("/api/dynamic-subtext", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        questionText,
        profileSummary: profile.summary,
        answersContext: answersToShortContext(answers),
      }),
    });
    const data = await res.json();
    if (data.fallback) return null;
    return data.text || null;
  } catch {
    return null;
  }
}

// =====================================================
// 3. 深掘りプローブ
// =====================================================

export type ProbeQuestion = {
  question: string;
  options: { value: string; label: string }[];
  targetAxis: string;
};

export async function fetchProbeQuestion(
  answers: Answer[],
  profile: UserProfile | null
): Promise<ProbeQuestion | null> {
  if (!profile?.summary || !profile.hiddenNeeds.length) return null;

  try {
    const res = await fetch("/api/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileSummary: profile.summary,
        hiddenNeeds: profile.hiddenNeeds,
        answersContext: answersToShortContext(answers),
      }),
    });
    const data = await res.json();
    if (!data.shouldProbe) return null;
    return {
      question: data.question,
      options: data.options,
      targetAxis: data.targetAxis,
    };
  } catch {
    return null;
  }
}
