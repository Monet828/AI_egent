"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Answer, FollowupQuestion } from "@/data/types";
import { getSessionData } from "@/lib/session";
import { diagnose } from "@/lib/diagnosis";
import {
  applyFollowupAnswer,
  getScoreAdjustment,
  buildScoreBonus,
} from "@/lib/followup";

export default function FollowupPage() {
  const router = useRouter();
  const [question, setQuestion] = useState<FollowupQuestion | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    const q = getSessionData<FollowupQuestion>("followupQuestion");
    const a = getSessionData<Answer[]>("userAnswers");

    if (!q || !a) {
      setNoData(true);
      sessionStorage.removeItem("followupQuestion");
      router.push("/");
      return;
    }

    setQuestion(q);
    setAnswers(a);
  }, [router]);

  const handleSelect = (value: string) => {
    if (isTransitioning || !question) return;
    setSelected(value);
    setIsTransitioning(true);

    // 選択フィードバックを見せてから遷移
    setTimeout(() => {
      // 1. 回答を追加
      const updatedAnswers = applyFollowupAnswer(answers, question, value);

      // 2. スコアボーナスを計算（元スコアに依存しない固定加算）
      const adj = getScoreAdjustment(question, value);
      const bonus = adj ? buildScoreBonus(adj.axis, adj.delta) : undefined;

      // 3. 再診断（ボーナスを加算）
      const newResult = diagnose(updatedAnswers, bonus);

      // 4. 保存して結果へ
      sessionStorage.setItem("diagnosisResult", JSON.stringify(newResult));
      sessionStorage.setItem("userAnswers", JSON.stringify(updatedAnswers));
      sessionStorage.removeItem("followupQuestion");
      router.push("/result");
    }, 500);
  };

  const handleSkip = () => {
    sessionStorage.removeItem("followupQuestion");
    router.push("/result");
  };

  if (noData || !question) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span
            className="text-base font-bold text-brand"
          >
            イエマッチAI
          </span>
          <button
            onClick={handleSkip}
            disabled={isTransitioning}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            スキップ →
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 px-4 py-8 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <p className="text-xs text-gray-400 mb-4">
              あなたの回答から、もう1問だけ確認させてください（任意）
            </p>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {question.text}
            </h2>
            {question.subText && (
              <p className="text-sm text-gray-500">{question.subText}</p>
            )}
          </div>

          <div className="space-y-3">
            {question.options.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  disabled={isTransitioning}
                  className={`w-full text-left px-6 py-5 rounded-xl border-2 transition-all text-sm focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                    isSelected
                      ? "border-brand bg-brand-light"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "border-brand"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                      )}
                    </span>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={handleSkip}
              disabled={isTransitioning}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors py-2 px-4"
            >
              この質問をスキップして結果を見る
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
