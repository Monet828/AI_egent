"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { builders } from "@/data/builders";
import { BUILDER_PHOTOS } from "@/data/photos";
import { DiagnosisResult } from "@/data/types";
import { getSessionData } from "@/lib/session";

const specLabels: Record<string, string> = {
  insulation: "断熱性",
  seismic: "耐震性",
  airtight: "気密性",
  energy: "省エネ性",
  soundproof: "防音性",
  natural_material: "自然素材",
  maintenance: "メンテナンス性",
};

const strengthLabels: Record<string, string> = {
  design: "デザイン力",
  cost: "コストパフォーマンス",
  performance: "住宅性能",
  personality: "担当者の人柄",
  after_service: "アフターサービス",
  track_record: "施工実績",
  land_support: "土地探しサポート",
  custom_design: "設計自由度",
};

export default function BuilderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const builder = builders.find((b) => b.id === params.id);

  useEffect(() => {
    const data = getSessionData<DiagnosisResult>("diagnosisResult");
    if (data) setResult(data);
  }, []);

  if (!builder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">工務店が見つかりませんでした</p>
          <Link href="/result" className="text-sm text-brand">
            診断結果に戻る
          </Link>
        </div>
      </div>
    );
  }

  const rec = result?.recommendations.find((r) => r.builderId === builder.id);

  const handleRequest = () => {
    // 既に選択済みの工務店があれば統合する
    const existing = getSessionData<string[]>("requestBuilders") || [];
    const merged = Array.from(new Set([...existing, builder.id]));
    sessionStorage.setItem("requestBuilders", JSON.stringify(merged));
    router.push("/request");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-base font-bold text-brand">
            イエマッチAI
          </Link>
          <Link href="/result" className="text-sm text-gray-500">
            ← 結果に戻る
          </Link>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* 施工事例写真 */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-4 px-4">
          {(() => {
            const bp = BUILDER_PHOTOS[builder.id];
            const photos = bp
              ? [
                  { url: bp.exterior, label: "外観" },
                  { url: bp.interior1, label: "内装 1" },
                  { url: bp.interior2, label: "内装 2" },
                ]
              : builder.photos.map((p, i) => ({
                  url: "",
                  label: `${p.category === "exterior" ? "外観" : "内装"} ${i + 1}`,
                }));
            return photos.map((photo, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 w-72 h-48 bg-gray-200 rounded-xl overflow-hidden snap-start"
              >
                {photo.url ? (
                  <Image
                    src={photo.url}
                    alt={`${builder.name} ${photo.label}`}
                    fill
                    className="object-cover"
                    sizes="288px"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                    {photo.label}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-3 py-2">
                  <span className="text-xs text-white font-medium">{photo.label}</span>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* 基本情報 */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{builder.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{builder.address}</p>
            </div>
            {rec && (
              <span className="text-2xl font-bold text-brand">
                {rec.displayMatchRate}%
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{builder.description}</p>
          {rec && (
            <div className="p-3 rounded-xl bg-brand-light">
              <p className="text-xs font-medium mb-1 text-brand-dark">
                おすすめ理由
              </p>
              <p className="text-sm text-brand-dark">
                {rec.reasonText}
              </p>
            </div>
          )}
        </section>

        {/* 性能数値 */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">住宅性能</h2>
          <div className="grid grid-cols-2 gap-3">
            {builder.b4_values.ua !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{builder.b4_values.ua}</p>
                <p className="text-xs text-gray-500 mt-1">UA値 (W/m²K)</p>
              </div>
            )}
            {builder.b4_values.c !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{builder.b4_values.c}</p>
                <p className="text-xs text-gray-500 mt-1">C値 (cm²/m²)</p>
              </div>
            )}
            {builder.b4_values.seismicGrade !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">等級{builder.b4_values.seismicGrade}</p>
                <p className="text-xs text-gray-500 mt-1">耐震等級</p>
              </div>
            )}
            {builder.b4_values.zehCount !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{builder.b4_values.zehCount}棟</p>
                <p className="text-xs text-gray-500 mt-1">ZEH施工実績</p>
              </div>
            )}
          </div>
        </section>

        {/* 強みタグ */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">強み</h2>
          <div className="flex flex-wrap gap-2">
            {builder.b4_strengths.map((s) => (
              <span
                key={s}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: "var(--tag-performance)", color: "var(--tag-performance-text)" }}
              >
                {specLabels[s] || s}
              </span>
            ))}
            {builder.b7_topStrengths.map((s) => (
              <span
                key={s}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: "var(--tag-design)", color: "var(--tag-design-text)" }}
              >
                {strengthLabels[s] || s}
              </span>
            ))}
          </div>
          {builder.awards.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">受賞歴</p>
              <div className="flex flex-wrap gap-2">
                {builder.awards.map((a) => (
                  <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                    🏆 {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 会社情報 */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">会社情報</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex">
              <dt className="w-28 text-gray-500 flex-shrink-0">所在地</dt>
              <dd className="text-gray-900">{builder.address}</dd>
            </div>
            <div className="flex">
              <dt className="w-28 text-gray-500 flex-shrink-0">年間施工棟数</dt>
              <dd className="text-gray-900">{builder.b5_annualBuilds}棟</dd>
            </div>
            <div className="flex">
              <dt className="w-28 text-gray-500 flex-shrink-0">設計自由度</dt>
              <dd className="text-gray-900">
                {builder.b5_designFreedom === "full_custom" ? "フルオーダー" : "セミオーダー"}
              </dd>
            </div>
          </dl>
        </section>

        {/* お客様の声 */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">お客様の声</h2>
          <div className="space-y-4">
            {builder.reviews.map((review, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed mb-2">「{review.text}」</p>
                <p className="text-xs text-gray-500 text-right">— {review.author}</p>
              </div>
            ))}
          </div>
        </section>

        {/* キャンペーン */}
        {builder.campaign && (
          <section className="rounded-2xl p-5 shadow-sm bg-brand-light">
            <p className="text-xs font-medium mb-1 text-brand-dark">
              キャンペーン情報
            </p>
            <p className="text-sm font-bold text-brand-dark">
              {builder.campaign}
            </p>
          </section>
        )}
      </main>

      {/* 固定CTA */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleRequest}
            className="w-full py-3.5 rounded-full text-white font-medium text-sm shadow-md bg-brand hover:bg-brand-dark transition-colors"
          >
            この会社に資料請求する
          </button>
        </div>
      </div>
    </div>
  );
}
