import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { correctionText, interpretationId } = await req.json();

    if (!process.env.GEMINI_API_KEY || !correctionText) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const prompt = `あなたは住宅マッチングAIの内部モジュールです。

ユーザーが住宅診断の途中で、AIの解釈に「ちょっと違う」と回答し、以下の補正テキストを入力しました：

「${correctionText}」

このテキストから、ユーザーが本当に重視していることを分析し、以下のJSON形式で返してください。

{
  "boost": "design" | "performance" | "cost" | "lifestyle" | "trust" | null,
  "reduce": "design" | "performance" | "cost" | "lifestyle" | "trust" | null,
  "insight": "ユーザーの本音を1文で要約"
}

ルール：
- boost: ユーザーがより重視したいと示唆している軸（1つ。不明なら null）
- reduce: ユーザーが相対的に下げたいと示唆している軸（1つ。不明なら null）
- insight: ユーザーの発言の裏にある価値観を1文で言語化
- 5つの軸の意味:
  - design: デザイン・外観・見た目のこだわり
  - performance: 断熱・耐震・気密など住宅性能
  - cost: 予算・コストパフォーマンス
  - lifestyle: 暮らし方・家事動線・家族の過ごし方
  - trust: 会社の信頼性・アフターサービス・担当者の人柄
- boostとreduceは異なる軸にすること（同じにしない）
- 確信が持てない場合はnullにする。無理に推測しない
- JSONのみ返すこと。説明文は不要`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSONをパース（コードブロックで返ってくる場合に対応）
    const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonStr);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Parse correction error:", error);
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
