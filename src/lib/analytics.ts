// イベントトラッキング基盤
// GA4が導入されていればgtag()に送信、なければconsole.logにフォールバック

type EventParams = Record<string, string | number | boolean | undefined>;

function sendEvent(eventName: string, params: EventParams = {}) {
  // GA4
  if (typeof window !== "undefined" && "gtag" in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag(
      "event",
      eventName,
      params
    );
  }

  // デバッグ用ログ（開発環境のみ）
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${eventName}`, params);
  }

  // カスタムイベントとしてもディスパッチ（外部ツール連携用）
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("iematch_event", { detail: { eventName, params, timestamp: Date.now() } })
    );
  }
}

// ===== ページビュー =====
export function trackPageView(page: string) {
  sendEvent("page_view", { page_title: page, page_location: window.location.href });
}

// ===== ヒアリング =====
export function trackDiagnosisStart() {
  sendEvent("diagnosis_start");
}

export function trackQuestionView(questionId: string, category: string, stepNumber: number, totalSteps: number) {
  sendEvent("question_view", {
    question_id: questionId,
    category,
    step_number: stepNumber,
    total_steps: totalSteps,
  });
}

export function trackQuestionAnswer(questionId: string, category: string, answerValue: string) {
  sendEvent("question_answer", {
    question_id: questionId,
    category,
    answer_value: answerValue,
  });
}

export function trackQuestionBack(questionId: string, stepNumber: number) {
  sendEvent("question_back", {
    question_id: questionId,
    step_number: stepNumber,
  });
}

export function trackDiagnosisComplete(totalTimeMs: number) {
  sendEvent("diagnosis_complete", {
    total_time_seconds: Math.round(totalTimeMs / 1000),
  });
}

// ===== 診断結果 =====
export function trackResultView(mainType: string, subType: string) {
  sendEvent("result_view", { main_type: mainType, sub_type: subType });
}

export function trackBuilderCardView(builderId: string, matchRate: number, rank: number) {
  sendEvent("builder_card_view", {
    builder_id: builderId,
    match_rate: matchRate,
    rank,
  });
}

export function trackBuilderDetailClick(builderId: string, matchRate: number) {
  sendEvent("builder_detail_click", { builder_id: builderId, match_rate: matchRate });
}

export function trackBuilderSelect(builderId: string, selected: boolean) {
  sendEvent("builder_select", { builder_id: builderId, selected });
}

// ===== 資料請求 =====
export function trackRequestFormView(builderCount: number) {
  sendEvent("request_form_view", { builder_count: builderCount });
}

export function trackRequestSubmit(builderCount: number, builderIds: string[]) {
  sendEvent("request_submit", {
    builder_count: builderCount,
    builder_ids: builderIds.join(","),
  });
}

// ===== CTA =====
export function trackCtaClick(location: string, ctaType: string) {
  sendEvent("cta_click", { location, cta_type: ctaType });
}

// ===== 離脱検知 =====
export function trackExit(page: string, lastQuestionId?: string) {
  sendEvent("exit_intent", { page, last_question_id: lastQuestionId || "none" });
}
