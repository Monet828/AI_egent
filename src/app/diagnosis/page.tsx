"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { questions, areaData } from "@/data/questions";
import { Answer, InterpretationResult } from "@/data/types";
import { diagnose } from "@/lib/diagnosis";
import { shouldAskFollowup } from "@/lib/followup";
import { getInterpretationForTransition, fetchGeminiInterpretation, parseCorrectionText, correctionToScoreBonus } from "@/lib/interpretation";
import { UserProfile, EMPTY_PROFILE, shouldUpdateProfile, updateProfile, profileToScoreBonus } from "@/lib/profiler";
import { fetchDynamicReaction, fetchDynamicSubText, fetchProbeQuestion, ProbeQuestion } from "@/lib/agent";
import RankedSelect from "@/components/RankedSelect";
import { EXTERIOR_PHOTOS, INTERIOR_PHOTOS } from "@/data/photos";
import {
  trackDiagnosisStart,
  trackQuestionView,
  trackQuestionAnswer,
  trackQuestionBack,
  trackDiagnosisComplete,
  trackExit,
} from "@/lib/analytics";

function shouldShow(qIndex: number, answers: Answer[]): boolean {
  const q = questions[qIndex];
  if (!q.condition) return true;
  const dep = answers.find((a) => a.questionId === q.condition!.dependsOn);
  if (!dep) return false;
  const vals = Array.isArray(dep.value) ? dep.value : [dep.value];
  return vals.some((v) => q.condition!.showWhen.includes(v));
}

function getVisibleIndices(answers: Answer[]): number[] {
  return questions.map((_, i) => i).filter((i) => shouldShow(i, answers));
}

export default function DiagnosisPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentVisibleStep, setCurrentVisibleStep] = useState(0);

  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [futurePlan, setFuturePlan] = useState("");
  const [selectedPref, setSelectedPref] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // 解釈（インタープリテーション）
  const [showingInterpretation, setShowingInterpretation] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [interpretationResults, setInterpretationResults] = useState<InterpretationResult[]>([]);
  const [correctionInput, setCorrectionInput] = useState("");
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [correctionBonuses, setCorrectionBonuses] = useState<Record<string, number>>({});
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Gemini応答待ち

  // バックグラウンドプロファイラー
  const [userProfile, setUserProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const profileUpdateRef = useRef(false);

  // エージェント状態
  const [quickReaction, setQuickReaction] = useState<string | null>(null);
  const [dynamicSubText, setDynamicSubText] = useState<string | null>(null);
  const [probeQuestion, setProbeQuestion] = useState<ProbeQuestion | null>(null);
  const [showingProbe, setShowingProbe] = useState(false);
  const probeAskedRef = useRef(false); // 診断中1回のみ

  // アニメーション
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const [isAnimating, setIsAnimating] = useState(false);

  // アナリティクス
  const startTimeRef = useRef(Date.now());
  const prevStepRef = useRef(-1);

  const visibleIndices = getVisibleIndices(answers);
  const currentQIndex = visibleIndices[currentVisibleStep];
  const question = questions[currentQIndex];
  const totalVisible = visibleIndices.length;
  const currentAnswer = answers.find((a) => a.questionId === question?.id);

  // 診断開始時に古いセッションデータをクリア
  useEffect(() => {
    sessionStorage.removeItem("diagnosisResult");
    sessionStorage.removeItem("userAnswers");
    sessionStorage.removeItem("requestBuilders");
    sessionStorage.removeItem("requestData");
    sessionStorage.removeItem("followupQuestion");
  }, []);

  // バックグラウンドプロファイル更新（4問ごと）
  useEffect(() => {
    if (answers.length === 0) return;
    if (!shouldUpdateProfile(answers.length, userProfile.updatedAt)) return;
    if (profileUpdateRef.current) return; // 更新中なら重複呼び出ししない
    profileUpdateRef.current = true;
    updateProfile(answers, userProfile.updatedAt > 0 ? userProfile : null).then((newProfile) => {
      if (newProfile) setUserProfile(newProfile);
      profileUpdateRef.current = false;
    });
  }, [answers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (question && currentVisibleStep !== prevStepRef.current) {
      if (currentVisibleStep === 0 && prevStepRef.current === -1) trackDiagnosisStart();
      trackQuestionView(question.id, question.categoryLabel, currentVisibleStep + 1, totalVisible);
      prevStepRef.current = currentVisibleStep;
    }
  }, [currentVisibleStep, question, totalVisible]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (question) trackExit("diagnosis", question.id);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [question]);

  const setAnswer = useCallback(
    (qId: string, value: string | string[], rank?: string[]) => {
      setAnswers((prev) => {
        const next = prev.filter((a) => a.questionId !== qId);
        next.push({ questionId: qId, value, rank });
        return next;
      });
    },
    []
  );

  // カテゴリ遷移時に解釈を差し込むか判定
  const checkInterpretation = useCallback(
    (currentStep: number): boolean => {
      const nextStep = currentStep + 1;
      if (nextStep >= visibleIndices.length) return false;
      const currentQ = questions[visibleIndices[currentStep]];
      const nextQ = questions[visibleIndices[nextStep]];
      if (!currentQ || !nextQ) return false;
      if (currentQ.category === nextQ.category) return false;

      const interp = getInterpretationForTransition(
        currentQ.category,
        nextQ.category,
        answers
      );
      if (!interp) return false;
      if (interpretationResults.some((r) => r.id === interp.id)) return false;

      // 「分析中」を表示し、Gemini応答を待つ
      setIsAnalyzing(true);
      setShowingInterpretation({ id: interp.id, text: "" }); // 空テキストで表示枠だけ出す

      fetchGeminiInterpretation(interp.id, answers).then((geminiText) => {
        setShowingInterpretation({
          id: interp.id,
          text: geminiText || interp.text, // Gemini失敗時はテンプレートにフォールバック
        });
        setIsAnalyzing(false);
      });

      return true;
    },
    [answers, visibleIndices, interpretationResults]
  );

  // 次の質問の動的subTextをバックグラウンドで取得
  const prefetchSubText = useCallback((nextStep: number) => {
    if (nextStep >= visibleIndices.length) return;
    const nextQ = questions[visibleIndices[nextStep]];
    if (!nextQ || !userProfile.summary) return;
    setDynamicSubText(null); // リセット
    fetchDynamicSubText(nextQ.id, nextQ.text, answers, userProfile).then((text) => {
      setDynamicSubText(text);
    });
  }, [visibleIndices, answers, userProfile]);

  // 深掘りプローブチェック（プロファイル更新後、1回だけ）
  const checkProbe = useCallback(() => {
    if (probeAskedRef.current) return;
    if (!userProfile.hiddenNeeds.length) return;
    if (answers.length < 8) return; // 8問目以降に限定

    probeAskedRef.current = true;
    fetchProbeQuestion(answers, userProfile).then((probe) => {
      if (probe) setProbeQuestion(probe);
    });
  }, [answers, userProfile]);

  // プロファイル更新後に深掘りチェック
  useEffect(() => {
    if (userProfile.hiddenNeeds.length > 0 && !probeAskedRef.current) {
      checkProbe();
    }
  }, [userProfile.hiddenNeeds.length, checkProbe]);

  // 自動遷移付きの次へ処理
  const goNext = useCallback(() => {
    if (isAnimating) return;

    // 深掘りプローブが待機中なら表示
    if (probeQuestion && !showingProbe) {
      setShowingProbe(true);
      return;
    }

    // カテゴリが変わるなら解釈を表示
    if (checkInterpretation(currentVisibleStep)) return;

    setSlideDirection("left");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentVisibleStep((prev) => {
        prefetchSubText(prev + 1);
        return prev + 1;
      });
      setIsAnimating(false);
    }, 200);
  }, [isAnimating, checkInterpretation, currentVisibleStep, probeQuestion, showingProbe, prefetchSubText]);

  // 解釈への反応ハンドラ
  const handleInterpretationReact = (reaction: "agree" | "disagree" | "skip") => {
    if (!showingInterpretation) return;

    if (reaction === "disagree") {
      setShowCorrectionInput(true);
      return;
    }

    // 結果を保存
    setInterpretationResults((prev) => [
      ...prev,
      {
        id: showingInterpretation.id,
        text: showingInterpretation.text,
        reaction,
      },
    ]);
    setShowingInterpretation(null);
    setShowCorrectionInput(false);
    setCorrectionInput("");

    // 最後の質問の後なら診断完了へ
    if (currentVisibleStep >= totalVisible - 1) {
      finishDiagnosis();
      return;
    }

    // 次の質問へ進む
    setSlideDirection("left");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentVisibleStep((prev) => prev + 1);
      setIsAnimating(false);
    }, 200);
  };

  const handleCorrectionSubmit = async () => {
    if (!showingInterpretation) return;
    setIsSubmittingCorrection(true);

    // Geminiで補正テキストを解析（非同期、失敗してもフロー続行）
    const analysis = await parseCorrectionText(correctionInput, showingInterpretation.id);
    if (analysis) {
      const bonus = correctionToScoreBonus(analysis);
      setCorrectionBonuses((prev) => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(bonus)) {
          merged[k] = (merged[k] || 0) + v;
        }
        return merged;
      });
    }

    setInterpretationResults((prev) => [
      ...prev,
      {
        id: showingInterpretation.id,
        text: showingInterpretation.text,
        reaction: "disagree",
        correction: correctionInput,
      },
    ]);
    setShowingInterpretation(null);
    setShowCorrectionInput(false);
    setCorrectionInput("");
    setIsSubmittingCorrection(false);

    // 最後の質問の後なら診断完了へ
    if (currentVisibleStep >= totalVisible - 1) {
      finishDiagnosis();
      return;
    }

    setSlideDirection("left");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentVisibleStep((prev) => prev + 1);
      setIsAnimating(false);
    }, 200);
  };

  // 深掘りプローブへの回答
  const handleProbeAnswer = (val: string) => {
    if (!probeQuestion) return;

    // 回答をAnswerとして追加（PROBEプレフィックスで識別）
    setAnswer(`PROBE_${probeQuestion.targetAxis}`, val);

    // スコアボーナスに反映
    const axisToType: Record<string, string> = {
      design: "designFirst", performance: "performanceExpert",
      cost: "costBalance", lifestyle: "lifestyleDesign", trust: "trustPartner",
    };
    const typeName = axisToType[probeQuestion.targetAxis];
    if (typeName && val === "a") {
      setCorrectionBonuses((prev) => ({ ...prev, [typeName]: (prev[typeName] || 0) + 1 }));
    }

    setShowingProbe(false);
    setProbeQuestion(null);

    // 次の質問へ
    setSlideDirection("left");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentVisibleStep((prev) => {
        prefetchSubText(prev + 1);
        return prev + 1;
      });
      setIsAnimating(false);
    }, 200);
  };

  const handleProbeSkip = () => {
    setShowingProbe(false);
    setProbeQuestion(null);
    // 通常のgoNextを再実行
    setSlideDirection("left");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentVisibleStep((prev) => {
        prefetchSubText(prev + 1);
        return prev + 1;
      });
      setIsAnimating(false);
    }, 200);
  };

  // 単一選択 — 選んだ瞬間に自動で次へ
  const handleSingle = (val: string) => {
    setAnswer(question.id, val);
    trackQuestionAnswer(question.id, question.categoryLabel, val);

    // 動的リアクションをバックグラウンドで取得
    fetchDynamicReaction(question.id, val, userProfile).then((text) => {
      if (text) {
        setQuickReaction(text);
        setTimeout(() => setQuickReaction(null), 1200);
      }
    });

    setTimeout(() => {
      if (currentVisibleStep >= totalVisible - 1) {
        finishDiagnosis(val);
      } else {
        goNext();
      }
    }, 500);
  };

  const handleMulti = (val: string) => {
    const current = currentAnswer ? (Array.isArray(currentAnswer.value) ? currentAnswer.value : [currentAnswer.value]) : [];
    if (val === "none") { setAnswer(question.id, ["none"]); return; }
    let next: string[];
    if (current.includes(val)) { next = current.filter((v) => v !== val); }
    else {
      next = current.filter((v) => v !== "none");
      if (question.maxSelect && next.length >= question.maxSelect) return;
      next.push(val);
    }
    setAnswer(question.id, next);
  };

  const handleImage = (val: string) => {
    const current = currentAnswer ? (Array.isArray(currentAnswer.value) ? currentAnswer.value : [currentAnswer.value]) : [];
    let next: string[];
    if (current.includes(val)) { next = current.filter((v) => v !== val); }
    else {
      if (question.maxSelect && current.length >= question.maxSelect) return;
      next = [...current, val];
    }
    setAnswer(question.id, next);
  };

  // 診断完了処理
  const finishDiagnosis = (singleOverride?: string) => {
    trackDiagnosisComplete(Date.now() - startTimeRef.current);
    const finalAnswers = [...answers];

    // single の場合は最新値を反映
    if (singleOverride && question.type === "single") {
      const idx = finalAnswers.findIndex((a) => a.questionId === question.id);
      if (idx >= 0) finalAnswers[idx] = { questionId: question.id, value: singleOverride };
      else finalAnswers.push({ questionId: question.id, value: singleOverride });
    }
    if (question.type === "family") {
      const idx = finalAnswers.findIndex((a) => a.questionId === question.id);
      if (idx >= 0) finalAnswers[idx] = { questionId: question.id, value: futurePlan || "same" };
      else finalAnswers.push({ questionId: question.id, value: futurePlan || "same" });
    }
    if (question.type === "cascade") {
      const idx = finalAnswers.findIndex((a) => a.questionId === question.id);
      const val = selectedCity || selectedPref;
      if (idx >= 0) finalAnswers[idx] = { questionId: question.id, value: val };
      else finalAnswers.push({ questionId: question.id, value: val });
    }

    // 最後のカテゴリの解釈チェック（Q19後）
    if (!showingInterpretation) {
      const lastQ = questions[visibleIndices[currentVisibleStep]];
      const interp = getInterpretationForTransition(lastQ?.category || 0, 999, finalAnswers);
      if (interp && !interpretationResults.some((r) => r.id === interp.id)) {
        setIsAnalyzing(true);
        setShowingInterpretation({ id: interp.id, text: "" });
        fetchGeminiInterpretation(interp.id, finalAnswers).then((geminiText) => {
          setShowingInterpretation({
            id: interp.id,
            text: geminiText || interp.text,
          });
          setIsAnalyzing(false);
        });
        return;
      }
    }

    // プロファイラーの重み調整 + 補正解析のボーナスを統合
    const profileBonus = profileToScoreBonus(userProfile);
    const mergedBonus: Record<string, number> = { ...profileBonus };
    for (const [k, v] of Object.entries(correctionBonuses)) {
      mergedBonus[k] = (mergedBonus[k] || 0) + v;
    }
    const hasBonus = Object.keys(mergedBonus).length > 0;
    // エージェントの洞察をマッチングに注入
    const insights = userProfile.summary ? {
      hiddenNeeds: userProfile.hiddenNeeds,
      anxieties: userProfile.anxieties,
      values: userProfile.values,
      agentDecisionStyle: userProfile.decisionStyle,
    } : undefined;
    const result = diagnose(finalAnswers, hasBonus ? mergedBonus : undefined, insights);
    sessionStorage.setItem("diagnosisResult", JSON.stringify(result));
    sessionStorage.setItem("userAnswers", JSON.stringify(finalAnswers));
    if (interpretationResults.length > 0) {
      sessionStorage.setItem("interpretations", JSON.stringify(interpretationResults));
    }
    if (userProfile.summary) {
      sessionStorage.setItem("userProfile", JSON.stringify(userProfile));
    }

    // フォローアップ質問が必要か判定
    const followup = shouldAskFollowup(result);
    if (followup.shouldAsk && followup.question) {
      sessionStorage.setItem("followupQuestion", JSON.stringify(followup.question));
      router.push("/followup");
    } else {
      router.push("/result");
    }
  };

  // 次へ（multi, ranked, image, cascade, family 用）
  const handleNext = () => {
    const answerVal = currentAnswer
      ? Array.isArray(currentAnswer.value) ? currentAnswer.value.join(",") : currentAnswer.value
      : question.type === "family" ? futurePlan
      : question.type === "cascade" ? selectedCity
      : "";
    trackQuestionAnswer(question.id, question.categoryLabel, answerVal);

    if (question.type === "family") setAnswer(question.id, futurePlan || "same");
    if (question.type === "cascade") setAnswer(question.id, selectedCity || selectedPref);

    if (currentVisibleStep >= totalVisible - 1) {
      finishDiagnosis();
      return;
    }
    goNext();
  };

  const handleBack = () => {
    if (currentVisibleStep > 0 && !isAnimating) {
      trackQuestionBack(question.id, currentVisibleStep + 1);
      setSlideDirection("right");
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentVisibleStep((prev) => prev - 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const canProceed = (): boolean => {
    if (!question) return false;
    switch (question.type) {
      case "single": return !!currentAnswer;
      case "multi": return !!currentAnswer && Array.isArray(currentAnswer.value) && currentAnswer.value.length > 0;
      case "ranked": return !!currentAnswer?.rank && currentAnswer.rank.length > 0;
      case "image": {
        const vals = currentAnswer ? (Array.isArray(currentAnswer.value) ? currentAnswer.value : []) : [];
        return vals.length >= (question.minSelect || 1);
      }
      case "cascade": return !!selectedCity;
      case "family": return !!futurePlan;
      default: return false;
    }
  };

  if (!question) return null;

  const progressPercent = ((currentVisibleStep + 1) / totalVisible) * 100;
  const categorySteps = [...new Set(questions.filter((_, i) => visibleIndices.includes(i)).map((q) => q.category))];
  const currentCategoryIdx = categorySteps.indexOf(question.category) + 1;

  // single は自動遷移なので「次へ」ボタン不要
  const showNextButton = question.type !== "single";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-base font-bold text-brand">
            イエマッチAI
          </span>
          <span className="text-xs text-gray-400">約5〜7分</span>
        </div>
      </header>

      {/* プログレス */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand">
              {question.categoryLabel}
            </span>
            <span className="text-xs text-gray-400">
              Step {currentCategoryIdx}/{categorySteps.length}　{currentVisibleStep + 1} / {totalVisible}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-brand"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 深掘りプローブ表示 */}
      {showingProbe && probeQuestion && !showingInterpretation && (
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                <p className="text-xs text-brand font-medium">AIからの質問</p>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed mb-6">
                {probeQuestion.question}
              </p>
              <div className="space-y-2">
                {probeQuestion.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleProbeAnswer(opt.value)}
                    className="w-full text-left px-5 py-4 rounded-xl border-2 border-gray-200 bg-white hover:border-brand transition-all text-sm focus:ring-2 focus:ring-brand focus:ring-offset-2"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={handleProbeSkip}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  スキップ
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* 解釈表示 */}
      {showingInterpretation && (
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              {isAnalyzing ? (
                <div className="text-center py-8">
                  <div className="relative w-10 h-10 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-brand animate-spin" />
                  </div>
                  <p className="text-sm text-gray-500 animate-pulse">
                    あなたの回答を分析しています...
                  </p>
                  {userProfile.summary && (
                    <p className="text-xs text-gray-400 mt-2">
                      {userProfile.summary}
                    </p>
                  )}
                </div>
              ) : (
              <>
              <p className="text-xs text-brand font-medium mb-4">あなたの回答から見えてきたこと</p>
              <p className="text-sm text-gray-800 leading-relaxed mb-6">
                {showingInterpretation.text}
              </p>

              {!showCorrectionInput ? (
                <div className="space-y-2">
                  <button
                    onClick={() => handleInterpretationReact("agree")}
                    className="w-full py-3 rounded-xl border-2 border-brand bg-brand-light text-sm font-medium text-brand transition-all hover:bg-brand hover:text-white"
                  >
                    そうそう、合ってます
                  </button>
                  <button
                    onClick={() => handleInterpretationReact("disagree")}
                    className="w-full py-3 rounded-xl border-2 border-gray-200 text-sm text-gray-600 transition-all hover:border-gray-300"
                  >
                    ちょっと違うかも
                  </button>
                  <button
                    onClick={() => handleInterpretationReact("skip")}
                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    スキップ
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    どんなところが違いましたか？（短くてOKです）
                  </p>
                  <textarea
                    value={correctionInput}
                    onChange={(e) => setCorrectionInput(e.target.value)}
                    rows={2}
                    placeholder="例：コストより、デザインの方が大事かも"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCorrectionInput(false);
                        setCorrectionInput("");
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
                    >
                      戻る
                    </button>
                    <button
                      onClick={handleCorrectionSubmit}
                      disabled={isSubmittingCorrection || !correctionInput.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
                    >
                      {isSubmittingCorrection ? "分析中..." : "送信して次へ"}
                    </button>
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          </div>
        </main>
      )}

      {/* 質問エリア */}
      {!showingInterpretation && !(showingProbe && probeQuestion) && (
      <main className="flex-1 px-4 py-8 overflow-hidden">
        <div
          className="max-w-2xl mx-auto transition-all duration-200 ease-out"
          style={{
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating
              ? `translateX(${slideDirection === "left" ? "-20px" : "20px"})`
              : "translateX(0)",
          }}
        >
          {/* リアクション */}
          {quickReaction && (
            <div className="mb-3 flex items-center gap-2 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span className="text-xs text-brand font-medium">{quickReaction}</span>
            </div>
          )}

          {/* プロファイルサマリー（4問以降に表示） */}
          {userProfile.summary && currentVisibleStep >= 4 && !quickReaction && (
            <div className="mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400">AI分析: {userProfile.summary}</span>
            </div>
          )}

          <h2 className="text-lg font-bold text-gray-900 mb-1">{question.text}</h2>
          {(dynamicSubText || question.subText) && (
            <p className={`text-sm mb-6 ${dynamicSubText ? "text-brand/70 italic" : "text-gray-500"}`}>
              {dynamicSubText || question.subText}
            </p>
          )}
          {!question.subText && <div className="mb-6" />}

          {/* single — 選択即遷移 */}
          {question.type === "single" && (
            <div className="space-y-3">
              {question.options.map((opt) => {
                const selected = currentAnswer?.value === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSingle(opt.value)}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-sm ${
                      selected
                        ? "border-brand bg-brand-light"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selected ? "border-brand" : "border-gray-300"
                        }`}
                      >
                        {selected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                        )}
                      </span>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* multi */}
          {question.type === "multi" && (
            <div className="space-y-3">
              {question.options.map((opt) => {
                const vals = currentAnswer ? (Array.isArray(currentAnswer.value) ? currentAnswer.value : []) : [];
                const selected = vals.includes(opt.value);
                const disabled = !selected && opt.value !== "none" && question.maxSelect
                  ? vals.filter((v) => v !== "none").length >= question.maxSelect : false;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleMulti(opt.value)}
                    disabled={disabled}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-sm ${
                      selected
                        ? "border-brand bg-brand-light"
                        : disabled
                        ? "border-gray-100 bg-gray-50 text-gray-400"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 ${
                          selected ? "border-brand bg-brand" : "border-gray-300"
                        }`}
                      >
                        {selected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ranked */}
          {question.type === "ranked" && (
            <RankedSelect
              options={question.options}
              maxSelect={question.maxSelect || 3}
              selected={currentAnswer?.rank || []}
              onChange={(rank) => setAnswer(question.id, rank, rank)}
            />
          )}

          {/* image */}
          {question.type === "image" && (() => {
            const photoMap = question.id === "Q13" ? EXTERIOR_PHOTOS : INTERIOR_PHOTOS;
            return (
              <div className="grid grid-cols-2 gap-3">
                {question.options.map((opt) => {
                  const vals = currentAnswer ? (Array.isArray(currentAnswer.value) ? currentAnswer.value : []) : [];
                  const selected = vals.includes(opt.value);
                  const disabled = !selected && question.maxSelect ? vals.length >= question.maxSelect : false;
                  const photoUrl = photoMap[opt.value];
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleImage(opt.value)}
                      disabled={disabled}
                      className={`rounded-xl border-2 overflow-hidden transition-all ${
                        selected
                          ? "border-brand ring-2 ring-brand/30"
                          : disabled
                          ? "border-gray-100 opacity-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="relative w-full aspect-[4/3] bg-gray-100">
                        {photoUrl ? (
                          <>
                            <Image
                              src={photoUrl}
                              alt={opt.label}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 50vw, 300px"
                              unoptimized
                            />
                            {selected && (
                              <div className="absolute inset-0 bg-brand/20" />
                            )}
                            {selected && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                            {opt.label}
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5 text-xs font-medium text-gray-700 bg-white flex items-center gap-2">
                        {selected && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-brand" />}
                        {opt.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* cascade */}
          {question.type === "cascade" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block">都道府県</label>
                <select
                  value={selectedPref}
                  onChange={(e) => { setSelectedPref(e.target.value); setSelectedCity(""); }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none focus:border-brand"
                >
                  <option value="">選択してください</option>
                  {Object.keys(areaData).map((pref) => (
                    <option key={pref} value={pref}>{pref}</option>
                  ))}
                </select>
              </div>
              {selectedPref && (
                <div>
                  <label className="text-sm text-gray-600 mb-2 block">市区町村</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none focus:border-brand"
                  >
                    <option value="">選択してください</option>
                    {areaData[selectedPref]?.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* family */}
          {question.type === "family" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-700">大人の人数</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                      aria-label="大人の人数を減らす"
                      className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-brand focus:ring-offset-2"
                    >−</button>
                    <span className="text-lg font-bold w-6 text-center">{adults}</span>
                    <button
                      onClick={() => setAdults(Math.min(6, adults + 1))}
                      aria-label="大人の人数を増やす"
                      className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-brand focus:ring-offset-2"
                    >＋</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">子どもの人数</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setChildren(Math.max(0, children - 1))}
                      aria-label="子どもの人数を減らす"
                      className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-brand focus:ring-offset-2"
                    >−</button>
                    <span className="text-lg font-bold w-6 text-center">{children}</span>
                    <button
                      onClick={() => setChildren(Math.min(6, children + 1))}
                      aria-label="子どもの人数を増やす"
                      className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-brand focus:ring-offset-2"
                    >＋</button>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-3">将来の家族計画</p>
                <div className="space-y-3">
                  {question.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFuturePlan(opt.value)}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-sm ${
                        futurePlan === opt.value
                          ? "border-brand bg-brand-light"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            futurePlan === opt.value ? "border-brand" : "border-gray-300"
                          }`}
                        >
                          {futurePlan === opt.value && (
                            <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                          )}
                        </span>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      )}

      {/* フッターボタン */}
      {!showingInterpretation && !(showingProbe && probeQuestion) && (
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          {currentVisibleStep > 0 && (
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
            >
              戻る
            </button>
          )}
          {showNextButton && (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex-1 py-3 rounded-full text-white text-sm font-medium transition-all disabled:opacity-40 ${canProceed() ? "bg-brand" : "bg-gray-400"}`}
            >
              {currentVisibleStep >= totalVisible - 1 ? "診断結果を見る" : "次へ進む"}
              {question.type === "multi" && currentAnswer && Array.isArray(currentAnswer.value) && currentAnswer.value.length > 0 && (
                <span className="ml-1">（{currentAnswer.value.length}つ選択中）</span>
              )}
            </button>
          )}
          {!showNextButton && currentVisibleStep === 0 && (
            <div className="flex-1" /> /* 最初の質問で戻るボタンもないときのスペーサー */
          )}
        </div>
      </div>
      )}
    </div>
  );
}
