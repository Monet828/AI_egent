// ===== ユーザー回答 =====
export type Answer = {
  questionId: string;
  value: string | string[];
  rank?: string[];
};

export type UserAnswers = {
  answers: Answer[];
  completedAt: string;
};

// ===== 質問 =====
export type QuestionType = "single" | "multi" | "ranked" | "image" | "cascade" | "family";

export type Option = {
  value: string;
  label: string;
  imageUrl?: string;
};

export type Question = {
  id: string;
  category: number;
  categoryLabel: string;
  text: string;
  subText?: string;
  type: QuestionType;
  maxSelect?: number;
  minSelect?: number;
  options: Option[];
  condition?: {
    dependsOn: string;
    showWhen: string[];
  };
};

// ===== タイプ =====
export type TypeName =
  | "designFirst"
  | "performanceExpert"
  | "costBalance"
  | "lifestyleDesign"
  | "trustPartner"
  | "totalBalance";

// ===== 工務店 =====
export type Builder = {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  b1_areas: string[];
  b2_priceRanges: string[];
  b2_mainPriceRange: string;
  b3_exteriorStyles: string[];
  b3_interiorStyles: string[];
  b3_bestStyle: string;
  b4_strengths: string[];
  b4_specs: string[];
  b4_values: {
    ua?: number;
    c?: number;
    seismicGrade?: number;
    zehCount?: number;
  };
  b5_services: string[];
  b5_designFreedom: string;
  b5_annualBuilds: number;
  b6_styles: string[];
  b6_features: string[];
  b7_topStrengths: string[];
  photos: { url: string; tags: string[]; category: string }[];
  reviews: { text: string; author: string }[];
  awards: string[];
  campaign: string;
};

// ===== 推薦の役割 =====
export type RecommendationRole = "bestMatch" | "contrastive" | "discovery";

// ===== 診断根拠 =====
export type DiagnosisEvidenceItem = {
  questionId: string;
  questionText: string;
  answerLabel: string;
  explanation: string;
};

// ===== 解釈（インタープリテーション） =====
export type InterpretationReaction = "agree" | "disagree" | "skip";

export type InterpretationResult = {
  id: string;
  text: string;             // 解釈文
  reaction?: InterpretationReaction;
  correction?: string;       // 「ちょっと違う」時の自由入力
};

// ===== 追加質問（フォローアップ） =====
export type FollowupOption = {
  value: string;
  label: string;
};

export type FollowupQuestion = {
  id: string;
  text: string;
  subText?: string;
  options: [FollowupOption, FollowupOption]; // 必ず2択
  // この質問が回答された場合に適用する重み調整
  adjustments: Record<string, { axis: string; delta: number }>;
};

export type FollowupTrigger =
  | "score_tie"         // 上位2候補のスコア差が小さい
  | "weight_balanced"   // 重みベクトルが拮抗
  | "anxiety_ambiguous"  // 不安軸が複数強い
  | "discovery_weak"    // 発見枠の根拠が弱い
  | "reason_abstract";  // 推薦理由が抽象的になりそう

export type FollowupDecision = {
  shouldAsk: boolean;
  trigger?: FollowupTrigger;
  question?: FollowupQuestion;
};

// ===== 診断結果 =====
export type DiagnosisResult = {
  mainType: TypeName;
  subType: TypeName;
  typeScores: Record<TypeName, number>;
  displayLabel: string;
  radarValues: {
    design: number;
    performance: number;
    cost: number;
    lifestyle: number;
    trust: number;
  };
  evidences: DiagnosisEvidenceItem[];
  recommendations: {
    role: RecommendationRole;
    roleLabel: string;
    builderId: string;
    rawScore: number;
    displayMatchRate: number;
    reasonText: string;
    highlightAxis: string;
    roleIntro: string;
  }[];
  setExplanation: string;
  comparisonTip: string;
};
