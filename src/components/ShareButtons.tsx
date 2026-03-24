"use client";

import { trackCtaClick } from "@/lib/analytics";

type Props = {
  typeLabel: string;
  catchCopy: string;
};

export default function ShareButtons({ typeLabel, catchCopy }: Props) {
  const shareText = `私の家づくりタイプは「${typeLabel}」でした！\n${catchCopy}\n\n#イエマッチAI #家づくり診断`;
  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleShare = async (platform: string) => {
    trackCtaClick("result_share", platform);

    if (platform === "native" && navigator.share) {
      try {
        await navigator.share({
          title: `イエマッチAI診断結果 - ${typeLabel}`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // ユーザーがキャンセルした場合
      }
      return;
    }

    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);

    const urls: Record<string, string> = {
      x: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], "_blank", "width=600,height=400");
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="flex items-center gap-3 justify-center">
      <span className="text-xs text-gray-500">シェアする:</span>

      {/* X (Twitter) */}
      <button
        onClick={() => handleShare("x")}
        className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center hover:bg-gray-700 transition-colors"
        aria-label="Xでシェア"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      {/* LINE */}
      <button
        onClick={() => handleShare("line")}
        className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center hover:bg-[#05b34d] transition-colors"
        aria-label="LINEでシェア"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 5.82 2 10.5c0 4.21 3.74 7.74 8.79 8.41.34.07.81.23.93.52.1.27.07.68.03.95l-.15.9c-.04.27-.21 1.05.92.57 1.13-.47 6.1-3.59 8.33-6.15C22.78 13.46 22 11.89 22 10.5 22 5.82 17.52 2 12 2z" />
        </svg>
      </button>

      {/* ネイティブシェア（対応デバイスのみ） */}
      {canNativeShare && (
        <button
          onClick={() => handleShare("native")}
          className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
          aria-label="シェア"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16,6 12,2 8,6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      )}
    </div>
  );
}
