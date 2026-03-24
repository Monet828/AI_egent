import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { profileSummary, hiddenNeeds, answersContext } = await req.json();

    if (!process.env.GEMINI_API_KEY || !profileSummary) {
      return NextResponse.json({ shouldProbe: false });
    }

    const prompt = `住宅診断AIのエージェントとして、ユーザーに「追加で1問だけ深掘り質問」を出すべきか判断してください。

ユーザーの人物像: ${profileSummary}
潜在ニーズ: ${(hiddenNeeds || []).join("、") || "不明"}
これまでの回答:
${answersContext}

以下のJSON形式で返してください:
{
  "shouldProbe": true または false,
  "question": "質問文（shouldProbeがtrueの場合のみ）",
  "options": [
    { "value": "a", "label": "選択肢A" },
    { "value": "b", "label": "選択肢B" }
  ],
  "targetAxis": "design" | "performance" | "cost" | "lifestyle" | "trust",
  "reason": "なぜこの質問を聞くのか（内部メモ、ユーザーには見せない）"
}

判断基準:
- 潜在ニーズが具体的で、かつまだ回答で確認されていない場合のみ shouldProbe=true
- 曖昧なら shouldProbe=false（むやみに質問を増やさない）
- 質問は2択のみ（選択肢は中立的・対称的に）
- 誘導禁止
- targetAxis: この質問が影響する軸
- JSONのみ返すこと`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonStr);

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ shouldProbe: false });
  }
}
