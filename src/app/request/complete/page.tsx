"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { builders } from "@/data/builders";
import { DiagnosisResult } from "@/data/types";
import { typeAdvice } from "@/lib/diagnosis";
import { getSessionData } from "@/lib/session";

export default function RequestCompletePage() {
  const [requestBuilderIds, setRequestBuilderIds] = useState<string[]>([]);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  useEffect(() => {
    const ids = getSessionData<string[]>("requestBuilders");
    if (ids) setRequestBuilderIds(ids);

    const data = getSessionData<DiagnosisResult>("diagnosisResult");
    if (data) setResult(data);
  }, []);

  const requestBuilders = builders.filter((b) => requestBuilderIds.includes(b.id));
  const advice = result ? typeAdvice[result.mainType] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-base font-bold text-brand">
            イエマッチAI
          </Link>
        </div>
      </header>

      <main className="px-4 py-12 max-w-2xl mx-auto text-center">
        {/* 完了メッセージ */}
        <div className="mb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-brand-light"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 16L14 22L24 10" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">資料請求が完了しました</h1>
          <p className="text-sm text-gray-500">ご入力いただいたメールアドレスに確認メールをお送りします。</p>
        </div>

        {/* 請求した会社リスト */}
        <section className="bg-white rounded-2xl p-5 shadow-sm mb-8 text-left">
          <p className="text-sm font-medium text-gray-700 mb-3">資料請求した住宅会社</p>
          <div className="space-y-3">
            {requestBuilders.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-brand"
                >
                  ✓
                </span>
                <span className="text-sm text-gray-900">{b.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 次のステップ */}
        {advice && (
          <section className="bg-white rounded-2xl p-5 shadow-sm mb-8 text-left">
            <h2 className="text-base font-bold text-gray-900 mb-3">次のステップ</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{advice.nextStep}</p>
            <div className="mt-4 p-3 rounded-xl bg-blue-50">
              <p className="text-xs text-blue-700 leading-relaxed">
                資料が届いたら、気になる会社に来場予約をしてみましょう。実際にモデルハウスを見たり、担当者と話すことで、より具体的なイメージが湧いてきます。
              </p>
            </div>
          </section>
        )}

        {/* ボタン */}
        <div className="space-y-3">
          <Link
            href="/result"
            className="block w-full py-3.5 rounded-full text-white font-medium text-sm shadow-md text-center bg-brand hover:bg-brand-dark transition-colors"
          >
            診断結果を見る
          </Link>
          <Link
            href="/diagnosis"
            className="block w-full py-3.5 rounded-full text-sm font-medium text-center border-2 border-gray-200 text-gray-600 hover:border-gray-300"
          >
            もう一度診断する
          </Link>
        </div>
      </main>
    </div>
  );
}
