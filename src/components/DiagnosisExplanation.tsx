"use client";

import { DiagnosisEvidenceItem } from "@/data/types";

type Props = {
  evidences: DiagnosisEvidenceItem[];
};

export default function DiagnosisExplanation({ evidences }: Props) {
  if (evidences.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 mb-4">
        あなたがこのタイプになった理由
      </h3>
      <div className="space-y-4">
        {evidences.map((ev) => (
          <div key={ev.questionId} className="pl-4 border-l-2 border-gray-200">
            <p className="text-xs text-gray-400">{ev.questionText}</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              → 「{ev.answerLabel}」
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {ev.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
