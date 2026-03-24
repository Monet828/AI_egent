import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 解釈ポイントごとのプロンプトコンテキスト
const CONTEXT_MAP: Record<string, string> = {
  interp_budget: "予算・資金計画に関する回答",
  interp_lifestyle: "暮らし方・デザインの好みに関する回答",
  interp_company: "住宅会社選びの軸に関する回答",
};

export async function POST(req: NextRequest) {
  try {
    const { interpretationId, answersContext } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const context = CONTEXT_MAP[interpretationId] || "住宅に関する回答";

    const prompt = `あなたは住宅選びをサポートする対話型AIです。
ユーザーが住宅診断の質問に回答しました。以下は${context}の要約です：

${answersContext}

この回答から、ユーザーの潜在的な価値観や本音を「軽く解釈」してください。

ルール：
- 2〜3文で簡潔に
- 「〜のように感じます」「〜がありそうですね」など、柔らかい推測の表現を使う
- 最後に「合っていますか？」で締める
- ユーザーの発言をそのまま繰り返さない。背景にある感情や価値観を言語化する
- 誘導的にならない。どの選択肢も肯定する姿勢
- 特定の工務店や商品に言及しない
- 日本語で自然に`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
