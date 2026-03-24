"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { builders } from "@/data/builders";
import { DiagnosisResult } from "@/data/types";
import { trackRequestFormView, trackRequestSubmit } from "@/lib/analytics";
import { getSessionData } from "@/lib/session";

export default function RequestPage() {
  const router = useRouter();
  const [requestBuilderIds, setRequestBuilderIds] = useState<string[]>([]);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    const parsed = getSessionData<string[]>("requestBuilders");
    if (!parsed) {
      setNoData(true);
      router.push("/result");
      return;
    }
    setRequestBuilderIds(parsed);
    trackRequestFormView(parsed.length);

    const data = getSessionData<DiagnosisResult>("diagnosisResult");
    if (data) setResult(data);
  }, [router]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "お名前を入力してください";
    if (!email.trim()) errs.email = "メールアドレスを入力してください";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "正しいメールアドレスを入力してください";
    if (!phone.trim()) errs.phone = "電話番号を入力してください";
    else if (!/^[0-9\-]{10,13}$/.test(phone.replace(/\s/g, ""))) errs.phone = "正しい電話番号を入力してください";
    if (!agreed) errs.agreed = "プライバシーポリシーに同意してください";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    // プロトタイプなので実際の送信はなし
    trackRequestSubmit(requestBuilderIds.length, requestBuilderIds);
    sessionStorage.setItem(
      "requestData",
      JSON.stringify({ name, email, phone, address, message, builderIds: requestBuilderIds })
    );
    router.push("/request/complete");
  };

  const requestBuilders = builders.filter((b) => requestBuilderIds.includes(b.id));

  if (noData) return null;

  return (
    <div className="min-h-screen bg-gray-50">
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

      <main className="px-4 py-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">資料請求</h1>

        {/* 請求先工務店 */}
        <section className="bg-white rounded-2xl p-5 shadow-sm mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">請求先の住宅会社</p>
          <div className="space-y-3">
            {requestBuilders.map((b) => {
              const rec = result?.recommendations.find((r) => r.builderId === b.id);
              return (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-900 font-medium">{b.name}</span>
                  {rec && (
                    <span className="text-sm font-bold text-brand">
                      {rec.displayMatchRate}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              お名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              電話番号 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-1234-5678"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">住所（任意）</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="神奈川県横浜市..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">メッセージ（任意）</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="気になっていることがあればご記入ください"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
            />
          </div>

          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 accent-[#1D9E75]"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                個人情報の取り扱いについて同意の上、資料請求します。ご入力いただいた情報は、マッチングした工務店への紹介目的のみに使用します。
              </span>
            </label>
            {errors.agreed && <p className="text-xs text-red-500 mt-1">{errors.agreed}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-full text-white font-medium text-sm shadow-md bg-brand hover:bg-brand-dark transition-colors"
          >
            資料請求する（{requestBuilders.length}社）
          </button>

          <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="#9CA3AF" />
            </svg>
            SSL暗号化通信で保護されています
          </p>
        </form>
      </main>
    </div>
  );
}
