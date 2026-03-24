import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { answersContext, previousProfile } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const previousSection = previousProfile
      ? `\n前回までのプロファイル:\n${previousProfile}\n\n今回の追加回答を踏まえて、プロファイルを更新してください。`
      : "";

    const prompt = `あなたは住宅マッチングAIの内部プロファイラーです。
ユーザーが住宅診断の質問に順番に回答しています。

以下はこれまでの回答です：
${answersContext}
${previousSection}

この回答から、ユーザーの「潜在的な人物像」をJSON形式で出力してください。

{
  "values": ["この人が大切にしている価値観を2-3個の短いフレーズで"],
  "anxieties": ["この人が潜在的に不安に感じていそうなことを1-2個"],
  "decisionStyle": "慎重派" | "行動派" | "バランス派",
  "hiddenNeeds": ["選択肢には直接現れないが、回答パターンから推測される潜在ニーズを1-2個"],
  "weightAdjustments": {
    "design": 0,
    "performance": 0,
    "cost": 0,
    "lifestyle": 0,
    "trust": 0
  },
  "summary": "この人を1文で表すなら"
}

ルール：
- values: 「堅実さ」「家族の時間」「自分らしさ」のような抽象度のフレーズ
- anxieties: 回答から読み取れる不安。明示されていなくても推測してよい
- hiddenNeeds: 選択肢の組み合わせから浮かぶ「言語化されていないニーズ」
- weightAdjustments: 各軸の重み調整（-2〜+2の整数）。回答パターンから強く推測できる場合のみ非0にする。確信がなければ全て0
  - design: デザイン・外観へのこだわり
  - performance: 断熱・耐震など住宅性能
  - cost: 予算・コストパフォーマンス
  - lifestyle: 暮らし方・家事動線・家族
  - trust: 会社の信頼性・担当者
- summary: 「予算を気にしつつも、家族の快適さは譲れない30代夫婦」のような1文
- JSONのみ返すこと`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonStr);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
