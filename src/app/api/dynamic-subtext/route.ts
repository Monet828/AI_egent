import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { questionText, questionId, profileSummary, answersContext } = await req.json();

    if (!process.env.GEMINI_API_KEY || !profileSummary) {
      return NextResponse.json({ fallback: true });
    }

    const prompt = `住宅診断AIとして、次の質問の前置き文（subText）を動的に生成してください。

次の質問: ${questionText}
質問ID: ${questionId}
ユーザーの人物像: ${profileSummary}
これまでの回答要約: ${answersContext}

ルール:
- 20〜40文字程度の短い前置き
- ユーザーの状況や価値観を踏まえて「なぜこの質問が重要か」を伝える
- 誘導しない（特定の選択肢に誘導する表現は禁止）
- 例:
  - 「堅実派のあなたには、ここが特に大事なポイントです」
  - 「暮らしの快適さを重視するなら、ここは丁寧に選びたいですね」
  - 「予算とのバランスを考えると、優先順位がつけやすくなります」
- テキストのみ返すこと`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ fallback: true });
  }
}
