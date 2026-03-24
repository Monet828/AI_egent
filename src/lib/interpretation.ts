import { Answer } from "@/data/types";

// =====================================================
// 解釈ポイントの定義
// =====================================================
// カテゴリ番号の境目に差し込む。
// afterCategory = そのカテゴリの最後の質問を終えた後に表示。

export type InterpretationPoint = {
  id: string;
  afterCategory: number;
  generate: (answers: Answer[]) => string;
};

// =====================================================
// ヘルパー
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

// =====================================================
// 解釈①: 予算・資金（カテゴリ2の後）
// =====================================================

function generateBudgetInterpretation(answers: Answer[]): string {
  const budget = getVal(answers, "Q4");
  const loan = getVal(answers, "Q5");
  const monthly = getVal(answers, "Q6");

  // 予算が高め ＋ ローン未着手
  if (
    (budget === "4500_5500" || budget === "over_5500") &&
    loan === "not_yet"
  ) {
    return "理想の住まいへの期待が大きい一方で、お金の具体的な話はまだこれからという段階ですね。「まずは夢を描きたい」という気持ちが強いように感じます。合っていますか？";
  }

  // 予算控えめ ＋ 月々も控えめ
  if (
    (budget === "under_2500" || budget === "2500_3500") &&
    (monthly === "under_7" || monthly === "7_10")
  ) {
    return "無理のない範囲でしっかり家づくりをしたいという、堅実な姿勢が伝わってきます。「身の丈に合った選択をしたい」という思いが根底にありそうですね。合っていますか？";
  }

  // ローン事前審査済み
  if (loan === "pre_approved") {
    return "すでにローンの事前審査まで進めているんですね。計画的に動かれている印象です。「決めたら着実に進めたい」タイプでしょうか？";
  }

  // 予算未定
  if (budget === "undecided") {
    return "予算はまだ固まっていない段階ですね。「いくらかけるか」より「どんな暮らしがしたいか」をまず考えたいという気持ちがあるように感じます。合っていますか？";
  }

  // デフォルト
  return "お金のことは、理想と現実のバランスを取りながら考えていきたいところですよね。今の段階では「選択肢を狭めたくない」という気持ちもありそうです。合っていますか？";
}

// =====================================================
// 解釈②: 暮らし・デザイン（カテゴリ5の後）
// =====================================================

function generateLifestyleInterpretation(answers: Answer[]): string {
  const lifestyle = getArr(answers, "Q11");
  const pains = getArr(answers, "Q12");
  const exterior = getArr(answers, "Q13");
  const interior = getArr(answers, "Q14");

  // 暮らし重視（家事・収納系が多い）
  const practicalNeeds = ["cooking", "storage", "housework", "remote_work"];
  const practicalCount = lifestyle.filter((l) => practicalNeeds.includes(l)).length;

  // デザイン重視（外観・内装の選択にこだわりが見える）
  const hasStrongDesignPref = exterior.length >= 2 && interior.length >= 2;

  if (practicalCount >= 2 && hasStrongDesignPref) {
    return "「見た目も大事だけど、毎日の暮らしやすさは絶対に譲れない」——デザインと機能、両方を高い水準で求めていらっしゃるように感じます。合っていますか？";
  }

  if (practicalCount >= 2) {
    return "お話を聞いていると、家に求めているのは「映え」よりも「日々の快適さ」なのかなと感じます。家事や収納など、暮らしの質を上げたいという思いが強そうですね。合っていますか？";
  }

  // アウトドア・ペット系
  if (lifestyle.includes("outdoor_living") || lifestyle.includes("pet")) {
    return "家の中だけでなく、外とのつながりや家族（ペットも含めて）との過ごし方を大切にされているように感じます。「暮らし全体をデザインしたい」という思いがありそうですね。合っていますか？";
  }

  // 趣味部屋
  if (lifestyle.includes("hobby_room")) {
    return "自分だけの空間や時間を大切にされているんですね。家は「家族のため」だけでなく「自分のため」の場所でもあるという感覚がありそうです。合っていますか？";
  }

  // 現住まいの不満が強い
  if (pains.length >= 2) {
    return "今のお住まいで感じている不満が、家づくりの大きなモチベーションになっているようですね。「今の問題を解決すること」が最優先という気持ちが伝わってきます。合っていますか？";
  }

  // デザイン寄り
  if (hasStrongDesignPref) {
    return "外観も内装も、しっかりとイメージをお持ちですね。「自分の好きな空間に囲まれて暮らしたい」という美意識を大切にされているように感じます。合っていますか？";
  }

  return "暮らし方やデザインについて、バランスよく考えていらっしゃいますね。「特定のこだわり」というよりは、「全体的に心地よい家」を求めているように感じます。合っていますか？";
}

// =====================================================
// 解釈③: 会社選びの軸（カテゴリ7の後、診断直前）
// =====================================================

function generateCompanyInterpretation(answers: Answer[]): string {
  const priorities = getArr(answers, "Q17"); // ranked: 会社選びの軸
  const anxiety = getVal(answers, "Q18");
  const contact = getVal(answers, "Q19");

  const top = priorities[0] || "";

  // 性能・実績重視 ＋ 不安が「会社選び」
  if (
    (top === "performance" || top === "track_record") &&
    anxiety === "company_choice"
  ) {
    return "「失敗したくない」という思いがとても強いですね。数字や実績など、客観的な根拠がないと安心できないタイプかもしれません。慎重に進めたい気持ち、よく分かります。合っていますか？";
  }

  // デザイン重視 ＋ 提案型希望
  if (top === "design" && contact === "proposal") {
    return "自分の理想はあるけれど、プロの視点でさらに引き上げてほしいという期待がありそうですね。「任せる」のではなく「一緒にいいものをつくりたい」という姿勢を感じます。合っていますか？";
  }

  // コスト重視 ＋ 不安が「お金」
  if (top === "cost" && anxiety === "money") {
    return "予算への意識がとても高いですね。ただ、「安ければいい」というよりは「納得できるお金の使い方をしたい」という気持ちが根底にあるように感じます。合っていますか？";
  }

  // 担当者の人柄重視
  if (top === "personality") {
    return "「何を建てるか」と同じくらい「誰と建てるか」を大切にされているんですね。家づくりのプロセスそのものを楽しみたい、信頼できる人と進めたいという思いが伝わってきます。合っていますか？";
  }

  // アフターサービス重視
  if (top === "after_service") {
    return "建てた後のことまでしっかり考えていらっしゃるのが印象的です。家は「建てて終わり」ではなく「住み始めてからが本番」という感覚をお持ちなんですね。合っていますか？";
  }

  // じっくり聞いてほしい
  if (contact === "listening" || contact === "honest") {
    return "家づくりで大切にされているのは、「自分の話をちゃんと聞いてくれること」や「正直に教えてくれること」——つまり、対等な関係で進められることのようですね。合っていますか？";
  }

  return "ここまでの回答を見ると、家づくりに対して「自分なりの判断軸」をしっかり持とうとされている印象です。情報に流されず、自分で納得して決めたいという姿勢がありますね。合っていますか？";
}

// =====================================================
// 解釈ポイント定義
// =====================================================

export const INTERPRETATION_POINTS: InterpretationPoint[] = [
  {
    id: "interp_budget",
    afterCategory: 2,
    generate: generateBudgetInterpretation,
  },
  {
    id: "interp_lifestyle",
    afterCategory: 5,
    generate: generateLifestyleInterpretation,
  },
  {
    id: "interp_company",
    afterCategory: 7,
    generate: generateCompanyInterpretation,
  },
];

// 回答を人間が読めるコンテキスト文に変換
const ANSWER_LABELS: Record<string, Record<string, string>> = {
  Q4: {
    under_2500: "総予算2,500万円未満",
    "2500_3500": "総予算2,500〜3,500万円",
    "3500_4500": "総予算3,500〜4,500万円",
    "4500_5500": "総予算4,500〜5,500万円",
    over_5500: "総予算5,500万円以上",
    undecided: "予算はまだ決めていない",
  },
  Q5: {
    pre_approved: "ローン事前審査済み",
    consulted: "ローン相談済み",
    not_yet: "ローンはまだ何もしていない",
    no_loan: "ローンは利用しない",
  },
  Q6: {
    under_7: "月々7万円未満",
    "7_10": "月々7〜10万円",
    "10_13": "月々10〜13万円",
    "13_16": "月々13〜16万円",
    over_16: "月々16万円以上",
    undecided: "月々の目安はまだ決めていない",
  },
  Q11: {
    cooking: "料理・キッチンにこだわりたい",
    family_living: "家族が集まるリビング",
    remote_work: "在宅ワークスペース",
    hobby_room: "趣味の部屋",
    outdoor_living: "庭・テラスでアウトドア",
    pet: "ペットと暮らしやすい家",
    storage: "収納をたっぷり",
    housework: "家事がラクになる動線",
  },
  Q12: {
    storage: "収納不足", layout: "間取りが使いにくい", insulation: "暑い/寒い",
    noise: "音が気になる", aging: "設備が古い", sunlight: "日当たりが悪い",
    rent: "家賃がもったいない", commute: "通勤が不便",
  },
  Q13: {
    simple_modern: "シンプルモダン", natural_nordic: "ナチュラル・北欧",
    japanese_modern: "和モダン", industrial: "インダストリアル",
    resort: "リゾート", hiraya: "平屋", other: "その他・特にこだわりなし",
  },
  Q14: {
    white_clean: "ホワイト・クリーン", natural_wood: "ナチュラルウッド",
    monotone: "モノトーン", cafe_vintage: "カフェ・ヴィンテージ",
    japanese: "和テイスト", colorful: "カラフル",
  },
  Q17: {
    design: "デザイン力", cost: "コスパ", performance: "住宅性能",
    personality: "担当者の人柄", after_service: "アフターサービス",
    track_record: "施工実績", land_support: "土地探しサポート",
    custom_design: "設計自由度",
  },
  Q18: {
    money: "お金のこと", company_choice: "会社選び", land: "土地探し",
    process: "進め方", image: "完成イメージ", schedule: "スケジュール",
  },
  Q19: {
    listening: "じっくり聞いてほしい", proposal: "積極的に提案してほしい",
    response: "レスポンスが早い", honest: "正直にデメリットも", expertise: "専門知識豊富",
  },
};

function buildAnswersContext(answers: Answer[], questionIds: string[]): string {
  const lines: string[] = [];
  for (const qId of questionIds) {
    const a = answers.find((a) => a.questionId === qId);
    if (!a) continue;
    const labels = ANSWER_LABELS[qId];
    if (!labels) continue;
    const vals = Array.isArray(a.value) ? a.value : [a.value];
    const readable = vals.map((v) => labels[v] || v).join("、");
    if (readable) lines.push(`- ${readable}`);
  }
  return lines.join("\n");
}

// 解釈ポイントごとの関連質問
const INTERP_QUESTIONS: Record<string, string[]> = {
  interp_budget: ["Q4", "Q5", "Q6"],
  interp_lifestyle: ["Q11", "Q12", "Q13", "Q14"],
  interp_company: ["Q17", "Q18", "Q19"],
};

// Gemini APIで解釈文を生成（クライアントから呼ぶ）
export async function fetchGeminiInterpretation(
  interpretationId: string,
  answers: Answer[]
): Promise<string | null> {
  const questionIds = INTERP_QUESTIONS[interpretationId];
  if (!questionIds) return null;

  const answersContext = buildAnswersContext(answers, questionIds);
  if (!answersContext) return null;

  try {
    const res = await fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interpretationId, answersContext }),
    });
    const data = await res.json();
    if (data.fallback) return null; // APIキーなし→テンプレートにフォールバック
    return data.text || null;
  } catch {
    return null; // エラー時もテンプレートにフォールバック
  }
}

// =====================================================
// 補正テキストの解析（Gemini）
// =====================================================

export type CorrectionAnalysis = {
  boost: string | null;  // 重視したい軸
  reduce: string | null; // 下げたい軸
  insight: string;       // 本音の要約
};

export async function parseCorrectionText(
  correctionText: string,
  interpretationId: string
): Promise<CorrectionAnalysis | null> {
  if (!correctionText.trim()) return null;

  try {
    const res = await fetch("/api/parse-correction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctionText, interpretationId }),
    });
    const data = await res.json();
    if (data.fallback) return null;
    if (data.boost || data.reduce || data.insight) {
      return data as CorrectionAnalysis;
    }
    return null;
  } catch {
    return null;
  }
}

// 補正解析結果からスコアボーナスを生成
const CORRECTION_AXIS_TO_TYPE: Record<string, string> = {
  design: "designFirst",
  performance: "performanceExpert",
  cost: "costBalance",
  lifestyle: "lifestyleDesign",
  trust: "trustPartner",
};

export function correctionToScoreBonus(
  analysis: CorrectionAnalysis
): Record<string, number> {
  const bonus: Record<string, number> = {};
  if (analysis.boost) {
    const type = CORRECTION_AXIS_TO_TYPE[analysis.boost];
    if (type) bonus[type] = 2; // +2ポイント（followupと同じスケール）
  }
  if (analysis.reduce) {
    const type = CORRECTION_AXIS_TO_TYPE[analysis.reduce];
    if (type) bonus[type] = -1; // -1ポイント（控えめに減算）
  }
  return bonus;
}

// 現在の質問のカテゴリが変わるタイミングで、解釈を出すべきか判定
// テンプレートベースの解釈文を返す（Gemini版はfetchGeminiInterpretationで別途取得）
export function getInterpretationForTransition(
  prevCategory: number,
  nextCategory: number,
  answers: Answer[]
): { id: string; text: string } | null {
  const point = INTERPRETATION_POINTS.find(
    (p) => p.afterCategory === prevCategory && nextCategory > prevCategory
  );
  if (!point) return null;
  return { id: point.id, text: point.generate(answers) };
}
