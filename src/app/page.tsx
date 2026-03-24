"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { trackCtaClick, trackPageView } from "@/lib/analytics";

const worries = [
  { icon: "🏠", text: "どの住宅会社が\n自分に合うか分からない" },
  { icon: "💰", text: "予算内で理想の家が\n建てられるか不安" },
  { icon: "📋", text: "何から始めればいいか\n分からない" },
  { icon: "🔍", text: "比較サイトを見ても\n違いが分からない" },
];

const steps = [
  { num: "1", title: "かんたん質問に回答", desc: "19問の選択式質問に答えるだけ。約5〜7分で完了します。" },
  { num: "2", title: "AIがタイプを診断", desc: "あなたの「家づくりタイプ」をAIが分析・診断します。" },
  { num: "3", title: "ぴったりの会社をご紹介", desc: "マッチ度の高い住宅会社を最大3社おすすめします。" },
];

const stats = [
  { value: "50+", label: "登録工務店数" },
  { value: "5〜7分", label: "診断所要時間" },
  { value: "0円", label: "利用料" },
  { value: "0件", label: "営業電話" },
];

const reasons = [
  { title: "エリア特化の厳選工務店", desc: "地域密着の優良工務店を厳選してご紹介。大手ポータルにはない地元の実力派が見つかります。" },
  { title: "プロ監修の診断ロジック", desc: "住宅業界のプロが監修した独自のAI診断で、あなたの本当のニーズを引き出します。" },
  { title: "幅広い選択肢", desc: "デザイン重視から性能重視まで、多様なタイプの工務店をカバーしています。" },
  { title: "安心の無料サービス", desc: "診断も資料請求もすべて無料。しつこい営業電話は一切ありません。" },
];

const faqs = [
  { q: "本当に無料ですか？", a: "はい、診断・資料請求ともに完全無料です。費用が発生することは一切ありません。" },
  { q: "個人情報は安全ですか？", a: "SSL暗号化通信で保護されています。ご登録情報はマッチングした工務店への紹介目的のみに使用し、第三者に提供することはありません。" },
  { q: "営業電話はかかってきますか？", a: "資料請求後に工務店からご連絡がある場合がありますが、しつこい営業は禁止しています。" },
  { q: "どのエリアに対応していますか？", a: "現在は神奈川県・東京都・埼玉県・千葉県の一部エリアに対応しています。順次拡大予定です。" },
  { q: "診断結果はどのくらい正確ですか？", a: "住宅業界のプロが監修した19の質問から、6つの家づくりタイプを判定します。多角的な分析で精度の高いマッチングを実現しています。" },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    trackPageView("top");
    const onScroll = () => setShowSticky(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-brand">イエマッチAI</span>
          <Link
            href="/diagnosis"
            className="text-sm font-medium px-5 py-2 rounded-full text-white bg-brand hover:bg-brand-dark transition-colors"
          >
            無料診断
          </Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="pt-16 pb-20 px-4 sm:px-6 text-center bg-gradient-to-b from-brand-50 to-white">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold mb-3 text-brand tracking-wide">
            AI × 注文住宅マッチング
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold leading-tight mb-5 text-gray-900">
            たった5分の診断で
            <br />
            あなたにぴったりの
            <br />
            住宅会社が見つかる
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mb-8 leading-relaxed">
            19問の簡単な質問に答えるだけで、AIがあなたの
            <br className="sm:hidden" />
            「家づくりタイプ」を診断。
            <br />
            マッチ度の高い工務店を最大3社おすすめします。
          </p>
          <Link
            href="/diagnosis"
            onClick={() => trackCtaClick("hero", "diagnosis_start")}
            className="inline-block text-white font-semibold text-base px-10 py-4 rounded-full bg-brand shadow-lg hover:shadow-xl hover:bg-brand-dark transition-all"
          >
            無料で診断スタート
          </Link>
          <p className="text-xs text-gray-400 mt-4">約5〜7分 / 登録不要 / 完全無料</p>
        </div>
      </section>

      {/* 課題訴求 */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-2 text-gray-900">こんなお悩みありませんか？</h2>
          <p className="text-sm text-gray-400 text-center mb-10">家づくりの第一歩でつまずく方は多いです</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {worries.map((w, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-5 text-center">
                <span className="text-3xl block mb-3">{w.icon}</span>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使い方3ステップ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-brand-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-2 text-gray-900">かんたん3ステップ</h2>
          <p className="text-sm text-gray-400 text-center mb-10">面倒な会員登録は不要です</p>
          <div className="space-y-4">
            {steps.map((s) => (
              <div key={s.num} className="bg-white rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                <span className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg bg-brand">
                  {s.num}
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 実績数値 */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-bold text-brand">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 選ばれる理由 */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-2 text-gray-900">選ばれる4つの理由</h2>
          <p className="text-sm text-gray-400 text-center mb-10">イエマッチAIが支持される理由</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {reasons.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm mb-3 bg-brand">
                  {i + 1}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{r.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-10 text-gray-900">よくある質問</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-medium text-gray-900">{f.q}</span>
                  <span className="text-gray-400 text-lg ml-2" aria-hidden="true">{openFaq === i ? "−" : "＋"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* フッターCTA */}
      <section className="py-16 px-4 sm:px-6 text-center bg-brand-dark">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-3">あなたにぴったりの住宅会社を見つけよう</h2>
          <p className="text-sm text-white/70 mb-8">無料・約5分・登録不要</p>
          <Link
            href="/diagnosis"
            onClick={() => trackCtaClick("footer_cta", "diagnosis_start")}
            className="inline-block bg-white font-semibold text-base px-10 py-4 rounded-full shadow-lg hover:shadow-xl transition-all text-brand-dark"
          >
            無料で診断スタート
          </Link>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 px-4 bg-gray-900 text-center">
        <p className="text-sm text-gray-500">© 2026 イエマッチAI All rights reserved.</p>
      </footer>

      {/* スクロール追従CTA */}
      {showSticky && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 flex justify-center">
          <Link
            href="/diagnosis"
            onClick={() => trackCtaClick("sticky", "diagnosis_start")}
            className="text-white font-semibold text-sm px-8 py-3 rounded-full shadow-md bg-brand hover:bg-brand-dark transition-colors"
          >
            無料で診断スタート →
          </Link>
        </div>
      )}
    </div>
  );
}
