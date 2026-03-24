"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { DiagnosisResult, TypeName } from "@/data/types";
import { typeCatchCopies, typeAdvice, typeNames } from "@/lib/diagnosis";
import Image from "next/image";
import { builders } from "@/data/builders";
import { BUILDER_PHOTOS } from "@/data/photos";
import { trackResultView, trackBuilderSelect, trackBuilderDetailClick, trackCtaClick } from "@/lib/analytics";
import ShareButtons from "@/components/ShareButtons";
import DiagnosisExplanation from "@/components/DiagnosisExplanation";
import { getSessionData } from "@/lib/session";

const RadarChart = dynamic(() => import("@/components/RadarChart"), { ssr: false });

const typeColors: Record<TypeName, string> = {
  designFirst: "#3C3489",
  performanceExpert: "#085041",
  costBalance: "#B45309",
  lifestyleDesign: "#633806",
  trustPartner: "#1D9E75",
  totalBalance: "#4B5563",
};

const roleBgColors: Record<string, string> = {
  bestMatch: "#1D9E75",
  contrastive: "#6366f1",
  discovery: "#f59e0b",
};

const loadingMessages = [
  "回答を分析しています...",
  "あなたの家づくりタイプを判定中...",
  "ぴったりの住宅会社を検索中...",
  "マッチング結果を準備しています...",
];

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [selectedBuilders, setSelectedBuilders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [noData, setNoData] = useState(false);

  useEffect(() => {
    const parsed = getSessionData<DiagnosisResult>("diagnosisResult");
    if (!parsed) {
      setNoData(true);
      router.push("/");
      return;
    }

    const msgInterval = setInterval(() => {
      setLoadingMsg((prev) => Math.min(prev + 1, loadingMessages.length - 1));
    }, 600);
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + 4, 100));
    }, 80);

    setTimeout(() => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
      setResult(parsed);
      setSelectedBuilders(parsed.recommendations.map((r) => r.builderId));
      trackResultView(parsed.mainType, parsed.subType);
      setIsLoading(false);
    }, 2500);

    return () => { clearInterval(msgInterval); clearInterval(progressInterval); };
  }, [router]);

  // データなしでリダイレクト中は何も表示しない
  if (noData) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-8">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-3 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-3 border-t-brand animate-spin" />
          </div>
          <p className="text-sm font-medium text-gray-800 mb-3 transition-all duration-300">
            {loadingMessages[loadingMsg]}
          </p>
          <div className="w-48 h-1.5 bg-gray-200 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200 bg-brand"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const toggleBuilder = (id: string) => {
    const willSelect = !selectedBuilders.includes(id);
    trackBuilderSelect(id, willSelect);
    setSelectedBuilders((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const handleBulkRequest = () => {
    trackCtaClick("result_bottom", "bulk_request");
    sessionStorage.setItem("requestBuilders", JSON.stringify(selectedBuilders));
    router.push("/request");
  };

  const advice = typeAdvice[result.mainType];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-base font-bold text-brand">
            イエマッチAI
          </Link>
          <span className="text-xs text-gray-400">診断結果</span>
        </div>
      </header>

      <main className="px-4 py-8 max-w-2xl mx-auto space-y-8 pb-24">
        {/* ① タイプ診断結果（コンパクト） */}
        <section className="text-center">
          <p className="text-sm text-gray-400 mb-2">あなたの家づくりタイプ</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span
              className="inline-block px-3 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ background: typeColors[result.mainType] }}
            >
              {typeNames[result.mainType]}
            </span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">{result.displayLabel}</h1>
          <p className="text-xs text-gray-400">{typeCatchCopies[result.mainType]}</p>
        </section>

        {/* ② おすすめ工務店（メインコンテンツ） */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-1">あなた専用の比較セット</h2>
          {result.setExplanation && (
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">{result.setExplanation}</p>
          )}

          <div className="space-y-5">
            {result.recommendations.map((rec) => {
              const builder = builders.find((b) => b.id === rec.builderId);
              if (!builder) return null;
              const isSelected = selectedBuilders.includes(rec.builderId);

              return (
                <div key={rec.builderId}>
                  {rec.roleIntro && (
                    <p className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: roleBgColors[rec.role] || "#1D9E75" }}
                      />
                      {rec.roleIntro}
                    </p>
                  )}

                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="relative h-40 bg-gray-100">
                      {BUILDER_PHOTOS[rec.builderId] ? (
                        <Image
                          src={BUILDER_PHOTOS[rec.builderId].exterior}
                          alt={`${builder.name}の施工事例`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 640px"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          施工事例写真
                        </div>
                      )}
                      <span
                        className="absolute top-3 left-3 text-xs text-white px-2.5 py-1 rounded-full font-medium"
                        style={{ background: roleBgColors[rec.role] || "#1D9E75" }}
                      >
                        {rec.roleLabel}
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-base font-bold text-gray-900">{builder.name}</h3>
                          {rec.highlightAxis && (
                            <span className="text-xs text-gray-400">{rec.highlightAxis}</span>
                          )}
                        </div>
                        <span className="text-xl font-bold text-brand">
                          {rec.displayMatchRate}%
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{rec.reasonText}</p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {builder.b6_features.map((f) => (
                          <span
                            key={f}
                            className="text-xs px-2.5 py-1 rounded-full bg-brand-light text-brand-dark"
                          >
                            {f}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleBuilder(rec.builderId)}
                          className={`flex-1 py-2.5 rounded-full text-sm font-medium border-2 transition-all ${
                            isSelected
                              ? "border-brand text-brand bg-brand-light"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {isSelected ? "✓ 選択中" : "選択する"}
                        </button>
                        <Link
                          href={`/builder/${builder.id}`}
                          onClick={() => trackBuilderDetailClick(builder.id, rec.displayMatchRate)}
                          className="flex-1 py-2.5 rounded-full text-sm font-medium text-center border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition-all"
                        >
                          詳しく見る
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {result.comparisonTip && (
            <div className="mt-5 p-4 rounded-xl bg-blue-50">
              <p className="text-xs font-medium text-blue-700 mb-1">比較のヒント</p>
              <p className="text-sm text-blue-800 leading-relaxed">{result.comparisonTip}</p>
            </div>
          )}
        </section>

        {result.recommendations.length === 0 && (
          <section className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <p className="text-gray-500 mb-4">条件に合う工務店が見つかりませんでした。</p>
            <Link href="/diagnosis" className="text-sm font-medium text-brand">
              条件を変えて再診断する →
            </Link>
          </section>
        )}

        {/* ③ あなたの診断詳細（工務店の後に配置） */}
        <section className="space-y-6">
          <h2 className="text-base font-bold text-gray-900">あなたの診断詳細</h2>

          {/* レーダーチャート */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4 text-center">家づくり傾向</h3>
            <RadarChart values={result.radarValues} />
          </div>

          {/* 診断の根拠 */}
          {result.evidences && result.evidences.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <DiagnosisExplanation evidences={result.evidences} />
            </div>
          )}

          {/* アドバイス */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">家づくりアドバイス</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium mb-1 text-brand">あなたの強み</p>
                <p className="text-sm text-gray-700 leading-relaxed">{advice.strengths}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1">注意ポイント</p>
                <p className="text-sm text-gray-700 leading-relaxed">{advice.cautions}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1">次のステップ</p>
                <p className="text-sm text-gray-700 leading-relaxed">{advice.nextStep}</p>
              </div>
            </div>
          </div>

          {/* シェア */}
          <div className="text-center pt-2">
            <ShareButtons typeLabel={result.displayLabel} catchCopy={typeCatchCopies[result.mainType]} />
          </div>
        </section>

        {/* まとめて資料請求（sticky） */}
        {selectedBuilders.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="max-w-2xl mx-auto">
              <button
                onClick={handleBulkRequest}
                className="w-full py-3.5 rounded-full text-white font-medium text-sm shadow-md bg-brand hover:bg-brand-dark transition-colors"
              >
                まとめて資料請求する（{selectedBuilders.length}社）
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
