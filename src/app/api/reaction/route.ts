import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { questionLabel, answerLabel, profileSummary } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ fallback: true });
    }

    const profileContext = profileSummary
      ? `\nユーザーの人物像: ${profileSummary}`
      : "";

    const prompt = `あなたは住宅カウンセラーAIです。ユーザーの回答に対して、その回答の「裏にある気持ちや価値観」を一言で解釈してください。

質問: ${questionLabel}
回答: ${answerLabel}${profileContext}

ルール:
- 15〜25文字の短い一言（句点不要）
- 回答をオウム返しにしない。回答の背景にある感情・価値観・性格を解釈する
- 「〜を選びましたね」「〜なんですね」のような回答の繰り返しは禁止
- 代わりに「〜を大事にするタイプですね」「〜への想いが強そうです」のように、一歩踏み込んだ解釈をする

悪い例（オウム返し）:
- 「情報収集中なんですね」 ← 回答そのまま
- 「2500万の予算ですね」 ← 数字を繰り返しただけ

良い例（解釈）:
- 「慎重に進めたいタイプですね」 ← 「情報収集中」の裏にある性格
- 「地に足のついた計画派ですね」 ← 予算の裏にある価値観
- 「見た目より暮らしの質を重視されそうです」 ← 選択の背景
- 「失敗したくないという気持ちが伝わります」 ← 不安の裏

テキストのみ返すこと（JSON不要）`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/。$/, "");

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ fallback: true });
  }
}
