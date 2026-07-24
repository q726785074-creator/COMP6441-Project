"use strict";

const content = window.PHISHWISE_CONTENT;
const zhTranslations = window.PHISHWISE_ZH || {};
const STORAGE_KEY = "phishwise-session-v3";

function createSessionCode() {
  const random = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, "0");
  return `PW-${random}`;
}

const createInitialState = () => ({
  activityVersion: "4.0",
  sessionCode: createSessionCode(),
  currentScreen: "intro",
  highestStep: 1,
  language: "en",
  preScore: null,
  postScore: null,
  preAnswers: {},
  postAnswers: {},
  preStatus: null,
  postStatus: null,
  openLessons: new Set(["attack"]),
  openRisks: new Set(["credential"]),
  learnVisited: false,
  scenarioIndex: 0,
  scenarioFound: Object.fromEntries(content.emailScenarios.map((scenario) => [scenario.id, []])),
  scenarioFirstFound: Object.fromEntries(content.emailScenarios.map((scenario) => [scenario.id, []])),
  scenarioScores: Object.fromEntries(content.emailScenarios.map((scenario) => [scenario.id, null])),
  currentClueId: null,
  defenceIndex: 0,
  defenceAnswers: {},
  defenceFirstAnswers: {},
  feedbackStatus: null,
  feedbackData: null,
  demoDataFilled: false,
});

let state = createInitialState();
let demoMode = false;
let formalState = null;
const screens = [...document.querySelectorAll(".screen")];
const navButtons = [...document.querySelectorAll(".step-link")];
const translatedTextNodes = [];
const translatedAttributes = [];

function pick(value) {
  if (typeof value === "string") return value;
  return value?.[state.language] || value?.en || "";
}

function tr(english) {
  return state.language === "zh" ? (zhTranslations[english] || english) : english;
}

function trTemplate(english, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    tr(english),
  );
}

function ui(en, zh) {
  return state.language === "zh" ? zh : en;
}

function captureTranslatableContent() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const original = node.nodeValue;
    const key = original.trim();
    if (key && Object.hasOwn(zhTranslations, key)) {
      translatedTextNodes.push({
        node,
        key,
        prefix: original.match(/^\s*/)?.[0] || "",
        suffix: original.match(/\s*$/)?.[0] || "",
      });
    }
    node = walker.nextNode();
  }

  document.querySelectorAll("[aria-label], [placeholder]").forEach((element) => {
    ["aria-label", "placeholder"].forEach((attribute) => {
      const original = element.getAttribute(attribute);
      if (original && Object.hasOwn(zhTranslations, original)) {
        translatedAttributes.push({ element, attribute, original });
      }
    });
  });
}

function serialisableState() {
  return {
    version: 3,
    activityVersion: state.activityVersion,
    sessionCode: state.sessionCode,
    currentScreen: state.currentScreen,
    highestStep: state.highestStep,
    language: state.language,
    preScore: state.preScore,
    postScore: state.postScore,
    preAnswers: state.preAnswers,
    postAnswers: state.postAnswers,
    learnVisited: state.learnVisited,
    scenarioIndex: state.scenarioIndex,
    scenarioFound: state.scenarioFound,
    scenarioFirstFound: state.scenarioFirstFound,
    scenarioScores: state.scenarioScores,
    defenceIndex: state.defenceIndex,
    defenceAnswers: state.defenceAnswers,
    defenceFirstAnswers: state.defenceFirstAnswers,
  };
}

function saveSession() {
  if (demoMode) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialisableState()));
  } catch {
    // The activity still works in memory when browser storage is unavailable.
  }
}

function loadSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (!saved || saved.version !== 3) return;
    const initial = createInitialState();
    state = {
      ...initial,
      ...saved,
      openLessons: initial.openLessons,
      openRisks: initial.openRisks,
      scenarioFirstFound: saved.scenarioFirstFound || Object.fromEntries(
        content.emailScenarios.map((scenario) => [scenario.id, [...(saved.scenarioFound?.[scenario.id] || [])]]),
      ),
      defenceFirstAnswers: saved.defenceFirstAnswers || { ...(saved.defenceAnswers || {}) },
      preStatus: Number.isInteger(saved.preScore) ? "recorded" : null,
      postStatus: Number.isInteger(saved.postScore) ? "recorded" : null,
      currentClueId: null,
      feedbackStatus: null,
      feedbackData: null,
    };
  } catch {
    state = createInitialState();
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function updateDemoModeUi() {
  document.body.classList.toggle("is-demo-mode", demoMode);
  const button = document.getElementById("demo-mode-button");
  button.textContent = demoMode ? ui("Exit Demo Mode", "退出演示模式") : ui("Demo Mode", "演示模式");
  button.setAttribute("aria-pressed", String(demoMode));
  document.getElementById("demo-sidebar-label").hidden = !demoMode;
  document.getElementById("demo-nav-panel").hidden = !demoMode;
  document.getElementById("demo-results-banner").hidden = !demoMode;
}

function enterDemoMode() {
  formalState = state;
  state = createInitialState();
  state.language = formalState.language;
  state.currentScreen = formalState.currentScreen;
  state.highestStep = 8;
  demoMode = true;
  updateDemoModeUi();
  renderDynamicContent();
  showScreen(state.currentScreen);
}

function exitDemoMode() {
  if (!demoMode) return;
  const language = state.language;
  state = formalState || createInitialState();
  state.language = language;
  formalState = null;
  demoMode = false;
  updateDemoModeUi();
  document.querySelectorAll("form").forEach((form) => form.reset());
  renderDynamicContent();
  showScreen(state.currentScreen || "intro");
  saveSession();
}

function temporaryDemoAnswers(questions, correctCount) {
  return Object.fromEntries(questions.map((question, index) => [
    question.id,
    index < correctCount ? question.answer : (question.answer + 1) % question.options.length,
  ]));
}

function autoFillDemoData() {
  if (!demoMode) return;
  state.preAnswers = temporaryDemoAnswers(content.pretest, 4);
  state.postAnswers = temporaryDemoAnswers(content.posttest, 9);
  state.preScore = 4;
  state.postScore = 9;
  state.preStatus = "recorded";
  state.postStatus = "recorded";
  state.learnVisited = true;
  const scenarioScores = [5, 6, 7];
  content.emailScenarios.forEach((scenario, index) => {
    state.scenarioFound[scenario.id] = scenario.elements.slice(0, scenarioScores[index]).map((item) => item.id);
    state.scenarioFirstFound[scenario.id] = [...state.scenarioFound[scenario.id]];
    state.scenarioScores[scenario.id] = scenarioScores[index];
  });
  state.defenceAnswers = Object.fromEntries(content.defenceScenarios.map((scenario, index) => [
    scenario.id,
    index < 6 ? scenario.answer : (scenario.answer + 1) % scenario.options.length,
  ]));
  state.defenceFirstAnswers = { ...state.defenceAnswers };
  state.demoDataFilled = true;
  state.highestStep = 8;
  renderDynamicContent();
  showScreen("results");
}

function allScenariosFirstScored() {
  return content.emailScenarios.every((scenario) => Number.isInteger(state.scenarioScores[scenario.id]));
}

function allDefenceFirstAnswered() {
  return content.defenceScenarios.every((scenario) => state.defenceFirstAnswers[scenario.id] !== undefined);
}

function showScreen(requestedId) {
  let id = requestedId;
  let flowMessage = "";
  if (!demoMode) {
    const afterPretest = new Set(["learn", "inspect", "defend", "posttest"]);
    if (afterPretest.has(id) && !Number.isInteger(state.preScore)) {
      id = "pretest";
      state.preStatus = "required";
      flowMessage = ui("Formal sequence: complete the pre-test before opening the learning activity.", "正式流程：请先完成前测，再打开学习活动。");
    } else if (["inspect", "defend", "posttest"].includes(id) && !state.learnVisited) {
      id = "learn";
      flowMessage = ui("Formal sequence: open the learning module before the inspection activity.", "正式流程：请先打开学习模块，再进入检查活动。");
    } else if (["defend", "posttest"].includes(id) && !allScenariosFirstScored()) {
      id = "inspect";
      flowMessage = ui("Formal sequence: finish and record a first attempt for all three inspection scenarios.", "正式流程：请先完成三个检查场景并记录首次得分。");
    } else if (id === "posttest" && !allDefenceFirstAnswered()) {
      id = "defend";
      flowMessage = ui("Formal sequence: answer all seven defence decisions before the post-test.", "正式流程：请先完成七个防御情境，再进入后测。");
    }
  }

  const target = document.getElementById(id);
  if (!target || !target.classList.contains("screen")) return;

  screens.forEach((screen) => screen.classList.toggle("is-active", screen.id === id));
  navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.go === id));
  const step = Number(target.dataset.step);
  state.currentScreen = id;
  if (!demoMode && id === "learn" && Number.isInteger(state.preScore)) state.learnVisited = true;
  state.highestStep = Math.max(state.highestStep, step);
  navButtons.forEach((button) => {
    const linked = document.getElementById(button.dataset.go);
    button.classList.toggle("is-complete", Number(linked.dataset.step) < state.highestStep);
  });

  document.getElementById("progress-label").textContent = ui(`Step ${step} of 8`, `第 ${step} 步，共 8 步`);
  document.getElementById("progress-percent").textContent = `${Math.round((step / 8) * 100)}%`;
  document.getElementById("progress-bar").style.width = `${(step / 8) * 100}%`;
  const flowNotice = document.getElementById("flow-notice");
  flowNotice.textContent = flowMessage;
  flowNotice.hidden = !flowMessage;
  history.replaceState(null, "", `#${id}`);
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (state.preStatus === "required") {
    const message = document.getElementById("pretest-message");
    message.style.color = "var(--danger)";
    message.textContent = ui("Complete the pre-test before opening the learning modules.", "请先完成前测，再打开学习模块。");
  }
  if (id === "results") renderResults();
  saveSession();
}

function renderQuiz(type) {
  const questions = content[type];
  const answers = type === "pretest" ? state.preAnswers : state.postAnswers;
  const recorded = type === "pretest" ? state.preStatus === "recorded" : state.postStatus === "recorded";
  const locked = !demoMode && recorded;
  const container = document.getElementById(`${type}-questions`);
  container.replaceChildren();

  questions.forEach((question, index) => {
    const fieldset = element("fieldset", "question-card");
    fieldset.dataset.questionId = question.id;
    const legend = element("legend");
    const number = element("span", "", String(index + 1).padStart(2, "0"));
    legend.append(number, document.createTextNode(` ${pick(question.question)}`));
    const topic = content.topics.find((item) => item.id === question.topic);
    const topicTag = element("small", "question-topic", pick(topic.name));
    fieldset.append(legend, topicTag);

    question.options.forEach((option, optionIndex) => {
      const label = element("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.id;
      input.value = String(optionIndex);
      input.checked = Number(answers[question.id]) === optionIndex;
      input.disabled = locked;
      label.append(input, document.createTextNode(pick(option)));
      fieldset.append(label);
    });
    container.append(fieldset);
  });
  const submitButton = container.closest("form")?.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = locked;
    submitButton.textContent = locked ? ui("First attempt recorded", "首次作答已记录") : ui(type === "pretest" ? "Submit pre-test" : "Submit post-test", type === "pretest" ? "提交前测" : "提交后测");
  }
}

function quizResult(type) {
  const questions = content[type];
  const answers = type === "pretest" ? state.preAnswers : state.postAnswers;
  const complete = questions.every((question) => answers[question.id] !== undefined);
  const score = questions.reduce((total, question) => total + (Number(answers[question.id]) === question.answer ? 1 : 0), 0);
  return { complete, score };
}

function handleQuizChange(type, event) {
  if (!event.target.matches('input[type="radio"]')) return;
  const answers = type === "pretest" ? state.preAnswers : state.postAnswers;
  answers[event.target.name] = Number(event.target.value);
  event.target.closest("fieldset")?.classList.remove("is-missing");
  saveSession();
}

function submitQuiz(type, form) {
  if (!demoMode && ((type === "pretest" && state.preStatus === "recorded") || (type === "posttest" && state.postStatus === "recorded"))) {
    const message = document.getElementById(`${type}-message`);
    message.style.color = "var(--green)";
    message.textContent = ui("The formal first attempt is already recorded and remains unchanged.", "正式首次作答已经记录，并保持不变。");
    return;
  }
  const result = quizResult(type);
  const questions = content[type];
  const answers = type === "pretest" ? state.preAnswers : state.postAnswers;
  const message = document.getElementById(`${type}-message`);
  questions.forEach((question) => {
    form.querySelector(`[data-question-id="${question.id}"]`)?.classList.toggle("is-missing", answers[question.id] === undefined);
  });

  if (demoMode) {
    form.querySelectorAll(".is-missing").forEach((item) => item.classList.remove("is-missing"));
    if (type === "pretest") {
      state.preScore = result.score;
      state.preStatus = "recorded";
      message.textContent = ui(`Temporary demo score: ${result.score} / 10. Unanswered items are not counted.`, `临时演示分数：${result.score} / 10。未回答题目不计分。`);
      setTimeout(() => showScreen("learn"), 300);
    } else {
      state.postScore = result.score;
      state.postStatus = "recorded";
      message.textContent = ui(`Temporary demo score: ${result.score} / 10. Unanswered items are not counted.`, `临时演示分数：${result.score} / 10。未回答题目不计分。`);
      setTimeout(() => showScreen("results"), 300);
    }
    state.demoDataFilled = true;
    message.style.color = "var(--green)";
    updateQuizBadges();
    renderQuiz(type);
    updateStatusMessages();
    return;
  }

  if (!result.complete) {
    if (type === "pretest") state.preStatus = "missing";
    else state.postStatus = "missing";
    message.style.color = "var(--danger)";
    message.textContent = ui("Please answer all 10 questions before submitting.", "提交前请回答全部 10 道题。");
    form.querySelector(".is-missing")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  message.style.color = "var(--green)";
  if (type === "pretest") {
    state.preScore = result.score;
    state.preStatus = "recorded";
    message.textContent = ui(`Baseline recorded: ${result.score} out of 10. Answers will be reviewed after learning.`, `前测已记录：10 题中答对 ${result.score} 题。学习后再查看答案分析。`);
    setTimeout(() => showScreen("learn"), 500);
  } else {
    state.postScore = result.score;
    state.postStatus = "recorded";
    message.textContent = ui(`Post-test recorded: ${result.score} out of 10. Opening your analysis…`, `后测已记录：10 题中答对 ${result.score} 题。正在打开分析……`);
    setTimeout(() => showScreen("results"), 500);
  }
  updateQuizBadges();
  renderQuiz(type);
  updateStatusMessages();
  saveSession();
}

function updateQuizBadges() {
  const preBadge = document.getElementById("pretest-badge");
  const postBadge = document.getElementById("posttest-badge");
  preBadge.textContent = Number.isInteger(state.preScore)
    ? demoMode ? ui(`Demo ${state.preScore} / 10`, `演示 ${state.preScore} / 10`) : ui(`${state.preScore} / 10 recorded`, `已记录 ${state.preScore} / 10`)
    : tr("Not submitted");
  postBadge.textContent = Number.isInteger(state.postScore)
    ? demoMode ? ui(`Demo ${state.postScore} / 10`, `演示 ${state.postScore} / 10`) : ui(`${state.postScore} / 10 recorded`, `已记录 ${state.postScore} / 10`)
    : tr("Not submitted");
  preBadge.classList.toggle("is-scored", Number.isInteger(state.preScore));
  postBadge.classList.toggle("is-scored", Number.isInteger(state.postScore));
}

function updateStatusMessages() {
  const preMessage = document.getElementById("pretest-message");
  const postMessage = document.getElementById("posttest-message");
  const feedbackMessage = document.getElementById("feedback-message");
  [preMessage, postMessage, feedbackMessage].forEach((message) => {
    message.textContent = "";
    message.removeAttribute("style");
  });
  if (state.preStatus === "required") preMessage.textContent = ui("Complete the pre-test before opening the learning modules.", "请先完成前测，再打开学习模块。");
  if (state.preStatus === "missing") preMessage.textContent = ui("Please answer all 10 questions before submitting.", "提交前请回答全部 10 道题。");
  if (state.preStatus === "recorded") preMessage.textContent = demoMode
    ? ui(`Temporary demo score: ${state.preScore} / 10. It is not formal test data.`, `临时演示分数：${state.preScore} / 10，不属于正式测试数据。`)
    : ui(`Baseline recorded: ${state.preScore} out of 10. Answers will be reviewed after learning.`, `前测已记录：10 题中答对 ${state.preScore} 题。学习后再查看答案分析。`);
  if (state.postStatus === "missing") postMessage.textContent = ui("Please answer all 10 questions before submitting.", "提交前请回答全部 10 道题。");
  if (state.postStatus === "recorded") postMessage.textContent = demoMode
    ? ui(`Temporary demo score: ${state.postScore} / 10. It is not formal test data.`, `临时演示分数：${state.postScore} / 10，不属于正式测试数据。`)
    : ui(`Post-test recorded: ${state.postScore} out of 10. Open the results page for analysis.`, `后测已记录：10 题中答对 ${state.postScore} 题。请打开结果页面查看分析。`);
  if (state.feedbackStatus === "missing") feedbackMessage.textContent = ui("Please complete all rating and choice questions. Free-text fields are optional.", "请完成所有评分和选择题。自由文本为可选项。");
  if (state.feedbackStatus === "recorded") feedbackMessage.textContent = ui("Feedback is held in this tab only. Structured choices enter the anonymous summary only if you download it; free text is excluded and nothing is transmitted.", "反馈只保留在当前标签页中。仅在你下载匿名摘要时，结构化选项才会写入摘要；自由文本会被排除，且任何内容都不会传输。");
}

function renderObjectiveMap() {
  const container = document.getElementById("objective-map");
  container.replaceChildren();
  content.objectiveMap.forEach((objective, index) => {
    const card = element("article", "measurement-item");
    card.append(
      element("span", "eyebrow", String(index + 1).padStart(2, "0")),
      element("h3", "", pick(objective.title)),
      element("p", "", pick(objective.outcome)),
    );
    const evidence = element("div");
    [
      [ui("Evidence used", "使用的证据"), objective.evidence],
      [ui("Measurement limit", "测量局限"), objective.limitation],
    ].forEach(([label, value]) => {
      const row = element("div");
      row.append(element("strong", "", label), element("p", "", pick(value)));
      evidence.append(row);
    });
    card.append(evidence);
    container.append(card);
  });
}

function renderRiskModel() {
  const container = document.getElementById("risk-case-list");
  container.replaceChildren();
  content.engineeringRisks.forEach((risk, index) => {
    const article = element("article", "risk-case");
    const open = state.openRisks.has(risk.id);
    const button = element("button", "risk-case-trigger");
    button.type = "button";
    button.dataset.riskCase = risk.id;
    button.setAttribute("aria-expanded", String(open));
    button.append(
      element("span", "risk-case-number", String(index + 1).padStart(2, "0")),
      element("span", "risk-case-title", pick(risk.title)),
      element("span", "risk-case-toggle", open ? "−" : "+"),
    );
    const panel = element("div", "risk-case-panel");
    panel.hidden = !open;
    const grid = element("div", "risk-case-grid");
    [
      [ui("Asset and impact", "资产与影响"), risk.asset],
      [ui("Attack path", "攻击路径"), risk.attackPath],
      [ui("Layered controls", "分层控制"), risk.controls],
      [ui("Residual risk", "剩余风险"), risk.residual],
      [ui("Trade-off", "权衡"), risk.tradeoff],
    ].forEach(([label, value]) => {
      const row = element("section", label === ui("Trade-off", "权衡") ? "risk-wide" : "");
      row.append(element("strong", "", label), element("p", "", pick(value)));
      grid.append(row);
    });
    panel.append(grid);
    article.append(button, panel);
    container.append(article);
  });
}

function renderLessons() {
  const container = document.getElementById("lesson-accordion");
  container.replaceChildren();
  content.lessons.forEach((lesson) => {
    const article = element("article", "lesson-item");
    article.id = `lesson-${lesson.id}`;
    const open = state.openLessons.has(lesson.id);
    const button = element("button", "lesson-trigger");
    button.type = "button";
    button.dataset.lesson = lesson.id;
    button.setAttribute("aria-expanded", String(open));
    button.append(
      element("span", "lesson-number", lesson.number),
      element("span", "lesson-title", pick(lesson.title)),
      element("span", "lesson-summary", pick(lesson.summary)),
      element("span", "lesson-toggle", open ? "−" : "+"),
    );
    const panel = element("div", "lesson-panel");
    panel.hidden = !open;

    if (lesson.flow) {
      const flow = element("div", "lesson-flow");
      lesson.flow.forEach((step, index) => {
        flow.append(element("span", "", pick(step)));
        if (index < lesson.flow.length - 1) flow.append(element("b", "", "→"));
      });
      panel.append(flow);
    }

    const detailGrid = element("div", "lesson-detail-grid");
    [
      [ui("Attacker objective", "攻击者目的"), lesson.purpose],
      [ui("Common techniques", "常用手法"), lesson.techniques],
      [ui("Observable signals", "可观察信号"), lesson.signals],
      [ui("Why it works", "为什么有效"), lesson.why],
      [ui("User defence", "用户层面防御"), lesson.user],
      [ui("Organisation defence", "组织层面防御"), lesson.organisation],
      [ui("Control limitation", "控制局限"), lesson.limitation],
      [ui("Trade-off and residual risk", "权衡与剩余风险"), lesson.tradeoff],
    ].forEach(([title, value]) => {
      const card = element("section", "lesson-detail");
      card.append(element("h3", "", title), element("p", "", pick(value)));
      detailGrid.append(card);
    });
    const example = element("aside", "safe-example");
    example.append(element("strong", "", ui("Fictional safe example", "完全虚构的安全示例")), element("p", "", pick(lesson.example)));
    panel.append(detailGrid, example);
    article.append(button, panel);
    container.append(article);
  });
}

function currentScenario() {
  return content.emailScenarios[state.scenarioIndex];
}

function renderScenarioTabs() {
  const container = document.getElementById("scenario-tabs");
  container.replaceChildren();
  content.emailScenarios.forEach((scenario, index) => {
    const button = element("button", `scenario-tab${index === state.scenarioIndex ? " is-active" : ""}`);
    button.type = "button";
    button.dataset.scenarioIndex = String(index);
    const score = state.scenarioScores[scenario.id];
    button.append(element("strong", "", pick(scenario.label)), element("small", "", score === null ? ui("Not scored", "尚未评分") : `${score} / ${scenario.elements.length}`));
    container.append(button);
  });
}

function createClueButton(item, className) {
  const button = element("button", `${className} clue`);
  button.type = "button";
  button.dataset.emailClue = item.id;
  const found = state.scenarioFound[currentScenario().id].includes(item.id);
  button.classList.toggle("is-found", found);
  button.setAttribute("aria-expanded", String(state.currentClueId === item.id));
  button.append(document.createTextNode(pick(item.display)), element("span", "clue-marker", "?"));
  return button;
}

function renderScenarioEmail() {
  const scenario = currentScenario();
  const email = document.getElementById("scenario-email");
  email.replaceChildren();
  const toolbar = element("div", "email-toolbar");
  toolbar.append(element("span", "window-dot"), element("span", "window-dot"), element("span", "window-dot"), element("strong", "", pick(scenario.toolbar)), element("span", "simulation-label", ui("NOT A REAL EMAIL", "不是真实邮件")));
  const emailContent = element("div", "email-content");
  const byArea = (area) => scenario.elements.filter((item) => item.area === area);
  byArea("subject").forEach((item) => emailContent.append(createClueButton(item, "clue-block email-subject-button")));

  const senderRow = element("div", "sender-row");
  senderRow.append(element("div", "avatar", scenario.avatar));
  const senderDetails = element("div", "sender-details");
  byArea("senderName").forEach((item) => senderDetails.append(createClueButton(item, "clue-inline sender-name-clue")));
  byArea("senderEmail").forEach((item) => senderDetails.append(createClueButton(item, "clue-inline")));
  byArea("replyTo").forEach((item) => senderDetails.append(createClueButton({ ...item, display: { en: `Reply-To: ${item.display.en}`, zh: `Reply-To：${item.display.zh}` } }, "clue-inline reply-clue")));
  senderRow.append(senderDetails);
  emailContent.append(senderRow);

  const body = element("div", "email-body");
  body.append(element("p", "", ui("Hello Student,", "同学你好：")));
  scenario.elements.filter((item) => !["subject", "senderName", "senderEmail", "replyTo"].includes(item.area)).forEach((item) => {
    const classByArea = { body: "clue-text", link: "fake-link", destination: "destination-preview", attachment: "attachment" };
    body.append(createClueButton(item, classByArea[item.area] || "clue-text"));
  });
  body.append(element("p", "email-signoff", ui("Regards,\nFictional sender", "此致\n虚构发件人")));
  emailContent.append(body);
  email.append(toolbar, emailContent);

  const found = state.scenarioFound[scenario.id];
  document.getElementById("found-count").textContent = String(found.length);
  document.getElementById("found-total").textContent = ui(`/${scenario.elements.length} signals found`, `/${scenario.elements.length} 个信号已找到`);
  const clueList = document.getElementById("clue-list");
  clueList.replaceChildren();
  scenario.elements.forEach((item) => {
    const tag = element("span", found.includes(item.id) ? "is-found" : "", pick(item.label));
    clueList.append(tag);
  });

  const score = state.scenarioScores[scenario.id];
  const result = document.getElementById("scenario-result");
  if (score === null) {
    result.hidden = true;
  } else {
    showScenarioResult();
  }
  if (state.currentClueId) displayScenarioClue(state.currentClueId);
}

function displayScenarioClue(clueId) {
  const clue = currentScenario().elements.find((item) => item.id === clueId);
  if (!clue) return;
  document.getElementById("clue-placeholder").hidden = true;
  document.getElementById("clue-explanation").hidden = false;
  document.getElementById("clue-title").textContent = pick(clue.label);
  document.getElementById("clue-objective").textContent = pick(clue.objective);
  document.getElementById("clue-deception").textContent = pick(clue.deception);
  document.getElementById("clue-check").textContent = pick(clue.check);
  document.getElementById("clue-control").textContent = pick(clue.control);
  document.getElementById("clue-limit").textContent = pick(content.clueLimits[clue.area]);
}

function showScenarioResult() {
  const scenario = currentScenario();
  const practiceFound = state.scenarioFound[scenario.id];
  const firstFound = state.scenarioFirstFound[scenario.id] || [];
  const firstScore = state.scenarioScores[scenario.id];
  const missed = scenario.elements.filter((item) => !firstFound.includes(item.id));
  const result = document.getElementById("scenario-result");
  result.hidden = false;
  result.replaceChildren();
  result.append(element("strong", "", ui(`First-attempt score: ${firstScore} / ${scenario.elements.length}`, `首次得分：${firstScore} / ${scenario.elements.length}`)));
  result.append(element("p", "", missed.length
    ? ui(`Missed signals: ${missed.map((item) => item.label.en).join(", ")}.`, `遗漏信号：${missed.map((item) => item.label.zh).join("、")}。`)
    : ui("All dangerous signals were found.", "已找到全部危险信号。")));
  if (practiceFound.length > firstScore) {
    result.append(element("p", "", ui(`Practice progress: ${practiceFound.length} / ${scenario.elements.length}. The first-attempt score remains unchanged.`, `练习进度：${practiceFound.length} / ${scenario.elements.length}。首次得分保持不变。`)));
  }
  result.append(
    element("p", "scenario-calibration", `${ui("Calibration", "校准说明")}: ${pick(scenario.calibration)}`),
    element("p", "scenario-calibration", `${ui("Measurement limit", "测量局限")}: ${pick(scenario.measurement)}`),
  );
}

function finishScenario() {
  const scenario = currentScenario();
  if (!Number.isInteger(state.scenarioScores[scenario.id])) {
    state.scenarioFirstFound[scenario.id] = [...state.scenarioFound[scenario.id]];
    state.scenarioScores[scenario.id] = state.scenarioFirstFound[scenario.id].length;
  }
  showScenarioResult();
  renderScenarioTabs();
  const allScored = Object.values(state.scenarioScores).every((score) => score !== null);
  document.getElementById("inspect-complete").hidden = !allScored;
  saveSession();
}

function renderScenarioSection() {
  renderScenarioTabs();
  state.currentClueId = null;
  document.getElementById("clue-placeholder").hidden = false;
  document.getElementById("clue-explanation").hidden = true;
  renderScenarioEmail();
  document.getElementById("inspect-complete").hidden = !Object.values(state.scenarioScores).every((score) => score !== null);
}

function defenceScore() {
  return content.defenceScenarios.reduce((score, scenario) => score + (Number(state.defenceFirstAnswers[scenario.id]) === scenario.answer ? 1 : 0), 0);
}

function renderDefenceTabs() {
  const tabs = document.getElementById("decision-tabs");
  tabs.replaceChildren();
  content.defenceScenarios.forEach((scenario, index) => {
    const button = element("button", index === state.defenceIndex ? "is-active" : "");
    button.type = "button";
    button.dataset.defenceIndex = String(index);
    const answered = state.defenceFirstAnswers[scenario.id] !== undefined;
    const correct = Number(state.defenceFirstAnswers[scenario.id]) === scenario.answer;
    button.textContent = answered ? `${index + 1} ${correct ? "✓" : "!"}` : String(index + 1);
    button.setAttribute("aria-label", `${pick(scenario.title)}${answered ? (correct ? `, ${ui("correct", "正确")}` : `, ${ui("review", "需复习")}`) : ""}`);
    tabs.append(button);
  });
}

function renderDecisionFeedback(scenario, selectedIndex) {
  const feedback = document.getElementById("decision-feedback");
  feedback.replaceChildren();
  if (selectedIndex === undefined) {
    feedback.textContent = ui("Select one response.", "请选择一个应对措施。");
    return;
  }
  const correct = selectedIndex === scenario.answer;
  const firstIndex = state.defenceFirstAnswers[scenario.id];
  const isPracticeChange = firstIndex !== undefined && Number(firstIndex) !== Number(selectedIndex);
  const header = element("div", `decision-verdict ${correct ? "is-correct" : "is-wrong"}`);
  header.append(
    element("strong", "", correct ? ui("Correct response", "回答正确") : ui("Review this response", "需要复习此回答")),
    element("p", "", pick(scenario.risks[selectedIndex])),
    element("small", "", isPracticeChange
      ? ui("Practice answer shown. Your first answer remains the formal evidence.", "当前显示练习答案，首次答案仍作为正式证据。")
      : ui("This first answer is retained as the formal evidence.", "首次答案会被保留为正式证据。")),
  );
  const grid = element("div", "decision-explanation-grid");
  [
    [ui("Why the best answer is correct", "为什么最佳答案正确"), scenario.correctWhy],
    [ui("Risk of the selected action", "所选操作的风险"), scenario.risks[selectedIndex]],
    [ui("User's next step", "用户下一步"), scenario.userNext],
    [ui("Organisation's next step", "组织下一步"), scenario.orgNext],
    [ui("Control layer", "控制层级"), scenario.layer],
    [ui("Residual risk and trade-off", "剩余风险与权衡"), scenario.residual],
  ].forEach(([title, value]) => {
    const card = element("section");
    card.append(element("strong", "", title), element("p", "", pick(value)));
    grid.append(card);
  });
  feedback.append(header, grid);
}

function renderDefenceScenario() {
  const scenario = content.defenceScenarios[state.defenceIndex];
  document.getElementById("decision-title").textContent = pick(scenario.title);
  document.getElementById("decision-context").textContent = pick(scenario.context);
  const options = document.getElementById("decision-options");
  options.replaceChildren();
  scenario.options.forEach((option, index) => {
    const button = element("button", "", pick(option));
    button.type = "button";
    button.dataset.decisionIndex = String(index);
    const selected = Number(state.defenceAnswers[scenario.id]) === index;
    if (selected) button.classList.add(index === scenario.answer ? "is-correct" : "is-wrong");
    options.append(button);
  });
  renderDecisionFeedback(scenario, state.defenceAnswers[scenario.id]);
  renderDefenceTabs();
}

function topicPerformance(topicId) {
  const pre = content.pretest.find((question) => question.topic === topicId);
  const post = content.posttest.find((question) => question.topic === topicId);
  return {
    preCorrect: Number(state.preAnswers[pre.id]) === pre.answer,
    postCorrect: Number(state.postAnswers[post.id]) === post.answer,
    lesson: content.topics.find((topic) => topic.id === topicId).lesson,
  };
}

function renderResults() {
  const complete = Number.isInteger(state.preScore) && Number.isInteger(state.postScore);
  const locked = document.getElementById("results-locked");
  const lockedButton = locked.querySelector("button");
  if (demoMode && !complete) {
    locked.querySelector("h2").textContent = ui("No temporary demo results yet.", "尚无临时演示结果。" );
    locked.querySelector("p").textContent = ui("Use Auto-fill demo data in the demo navigation panel, or make temporary quiz selections.", "请使用演示导航面板中的“自动填充演示数据”，或临时选择测验答案。" );
    lockedButton.hidden = true;
  } else {
    locked.querySelector("h2").textContent = ui("Complete both tests to see your comparison.", "完成两次测试后查看比较结果。" );
    locked.querySelector("p").textContent = ui("Your pre-test establishes a baseline, while the post-test checks whether you can apply the defensive method to new examples.", "前测用于建立基准，后测检查你能否将防御方法应用到新示例。" );
    lockedButton.hidden = false;
  }
  document.getElementById("results-locked").hidden = complete;
  document.getElementById("results-content").hidden = !complete;
  if (!complete) return;

  const difference = state.postScore - state.preScore;
  document.getElementById("pre-score").textContent = state.preScore;
  document.getElementById("post-score").textContent = state.postScore;
  document.getElementById("pre-score-bar").style.width = `${state.preScore * 10}%`;
  document.getElementById("post-score-bar").style.width = `${state.postScore * 10}%`;
  document.getElementById("score-change").textContent = `${difference > 0 ? "+" : ""}${difference}`;
  document.getElementById("change-label").textContent = ui("points out of 10", "分（满分 10 分）");

  const heading = document.getElementById("result-heading");
  const copy = document.getElementById("result-copy");
  const symbol = document.getElementById("result-symbol");
  if (difference > 0) {
    symbol.textContent = "↑";
    heading.textContent = ui("Your measured score improved.", "测得的分数有所提高。");
    copy.textContent = ui(`Your post-test increased by ${difference} point${difference === 1 ? "" : "s"}. Review topic-level evidence below.`, `后测提高了 ${difference} 分。请查看下方各知识主题的表现。`);
  } else if (difference === 0) {
    symbol.textContent = "→";
    heading.textContent = state.postScore === 10 ? ui("You maintained a full score.", "你保持了满分。") : ui("Your measured score stayed the same.", "测得的分数保持不变。");
    copy.textContent = ui("A stable total can hide improvement in one topic and decline in another. Review each objective below.", "总分不变可能掩盖某个主题进步、另一个主题下降的情况。请查看下方每个目标。");
  } else {
    symbol.textContent = "↘";
    heading.textContent = ui("This attempt did not show an overall improvement yet.", "本次尝试尚未显示整体进步。");
    copy.textContent = ui("Use the personalised review links below, then repeat the learning activity without treating this result as failure.", "请使用下方个性化复习链接，然后重新学习；不要将这一结果视为失败。");
  }
  copy.textContent += ui(
    " This is short-term, within-session evidence and does not by itself prove lasting learning or teaching effectiveness.",
    " 这是同一会话中的短期证据，单独使用时不能证明长期学习效果或教学有效性。",
  );

  content.emailScenarios.forEach((scenario, index) => {
    const score = state.scenarioScores[scenario.id];
    document.getElementById(`inspect-score-${index + 1}`).textContent = score === null ? ui("Not completed", "未完成") : `${score} / ${scenario.elements.length}`;
  });
  document.getElementById("defence-score").textContent = `${defenceScore()} / ${content.defenceScenarios.length}`;

  const masteryList = document.getElementById("mastery-list");
  masteryList.replaceChildren();
  const recommendations = [];
  content.topics.forEach((topic) => {
    const performance = topicPerformance(topic.id);
    const row = element("article", `mastery-row ${performance.postCorrect ? "is-mastered" : "needs-review"}`);
    const status = performance.postCorrect ? ui("Post-test item correct", "后测题答对") : ui("Review", "需复习");
    const changeLabel = !performance.preCorrect && performance.postCorrect
      ? ui("Improved", "已进步")
      : performance.preCorrect && !performance.postCorrect
        ? ui("Needs reinforcement", "需要巩固")
        : ui("No item-level change", "单题表现无变化");
    row.append(element("strong", "", pick(topic.name)), element("span", "", `${ui("Pre", "前测")}: ${performance.preCorrect ? "✓" : "—"}`), element("span", "", `${ui("Post", "后测")}: ${performance.postCorrect ? "✓" : "—"}`), element("em", "", `${status} · ${changeLabel}`));
    masteryList.append(row);
    if (!performance.postCorrect) recommendations.push({ topic, lesson: performance.lesson });
  });

  const recommendationList = document.getElementById("recommendation-list");
  recommendationList.replaceChildren();
  if (!recommendations.length) {
    recommendationList.append(element("p", "recommendation-success", ui("All ten post-test objectives were answered correctly. Revisit the scenarios for retention practice.", "后测十个目标全部回答正确。可重新练习场景以巩固记忆。")));
  } else {
    recommendations.forEach(({ topic, lesson }) => {
      const button = element("button", "recommendation-link");
      button.type = "button";
      button.dataset.reviewLesson = lesson;
      button.append(element("strong", "", pick(topic.name)), element("span", "", ui(`Return to lesson: ${pick(content.lessons.find((item) => item.id === lesson).title)}`, `返回课程：${pick(content.lessons.find((item) => item.id === lesson).title)}`)));
      recommendationList.append(button);
    });
  }

  const reviewList = document.getElementById("review-list");
  reviewList.replaceChildren();
  content.posttest.forEach((question, index) => {
    const correct = Number(state.postAnswers[question.id]) === question.answer;
    const item = element("article", `review-item${correct ? "" : " is-wrong"}`);
    item.append(element("span", "", correct ? "✓" : "!"));
    const text = element("div");
    text.append(element("strong", "", ui(`Question ${index + 1}: ${correct ? "Correct" : "Review"}`, `第 ${index + 1} 题：${correct ? "正确" : "需要复习"}`)), element("p", "", pick(question.explanation)));
    item.append(text);
    reviewList.append(item);
  });
}

function renderRatingRows() {
  document.querySelectorAll("[data-rating-name]").forEach((row) => {
    const name = row.dataset.ratingName;
    const selected = row.querySelector(`input[name="${name}"]:checked`)?.value;
    row.replaceChildren();
    for (let rating = 1; rating <= 5; rating += 1) {
      const label = element("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = String(rating);
      input.checked = selected === String(rating);
      const visual = element("span", "", String(rating));
      if (rating === 1) visual.append(element("small", "", ui("Low", "低")));
      if (rating === 5) visual.append(element("small", "", ui("High", "高")));
      label.append(input, visual);
      row.append(label);
    }
  });
}

function renderDynamicContent() {
  updateDemoModeUi();
  renderObjectiveMap();
  renderQuiz("pretest");
  renderQuiz("posttest");
  renderLessons();
  renderRiskModel();
  renderScenarioSection();
  renderDefenceScenario();
  renderRatingRows();
  updateQuizBadges();
  updateStatusMessages();
  if (state.currentScreen === "results") renderResults();
}

function setLanguage(language) {
  state.language = language === "zh" ? "zh" : "en";
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = tr("PhishWise | Phishing Defence Activity");
  document.querySelector('meta[name="description"]').setAttribute("content", tr("PhishWise is a local, interactive phishing identification and defence activity for beginner university students."));
  translatedTextNodes.forEach(({ node, key, prefix, suffix }) => {
    node.nodeValue = `${prefix}${tr(key)}${suffix}`;
  });
  translatedAttributes.forEach(({ element, attribute, original }) => element.setAttribute(attribute, tr(original)));
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderDynamicContent();
  updateDemoModeUi();
  const currentStep = Number(document.getElementById(state.currentScreen)?.dataset.step || 1);
  document.getElementById("progress-label").textContent = ui(`Step ${currentStep} of 8`, `第 ${currentStep} 步，共 8 步`);
  saveSession();
}

function downloadSummary() {
  if (demoMode) return;
  if (!Number.isInteger(state.preScore) || !Number.isInteger(state.postScore)) return;
  const lines = [
    ui("PhishWise anonymous session summary", "PhishWise 匿名会话摘要"),
    ui("No participant identity, personal information, or free-text feedback is included.", "摘要不包含参与者身份、个人信息或自由文本反馈。"),
    ui(`Session code: ${state.sessionCode}`, `会话编号：${state.sessionCode}`),
    ui(`Activity version: ${state.activityVersion}`, `活动版本：${state.activityVersion}`),
    ui(`Interface language: ${state.language}`, `界面语言：${state.language}`),
    ui("All quiz, inspection, and defence measures below use the retained first attempt.", "以下测验、检查和防御指标均使用保留的首次作答。"),
    "",
    ui(`Pre-test: ${state.preScore}/10`, `前测：${state.preScore}/10`),
    ui(`Post-test: ${state.postScore}/10`, `后测：${state.postScore}/10`),
    ui(`Difference: ${state.postScore - state.preScore} points`, `差异：${state.postScore - state.preScore} 分`),
    "",
    ...content.emailScenarios.map((scenario, index) => {
      const score = state.scenarioScores[scenario.id];
      return ui(`Inspection scenario ${index + 1}, first attempt: ${score === null ? "not completed" : `${score}/${scenario.elements.length}`}`, `检查场景 ${index + 1} 首次得分：${score === null ? "未完成" : `${score}/${scenario.elements.length}`}`);
    }),
    ui(`Defence decisions, first attempts: ${defenceScore()}/${content.defenceScenarios.length}`, `防御决策首次作答：${defenceScore()}/${content.defenceScenarios.length}`),
    "",
    ...content.pretest.map((question, index) => ui(`Pre-test question ${index + 1} (${question.topic}): ${Number(state.preAnswers[question.id]) === question.answer ? "correct" : "incorrect"}`, `前测第 ${index + 1} 题（${question.topic}）：${Number(state.preAnswers[question.id]) === question.answer ? "正确" : "错误"}`)),
    ...content.posttest.map((question, index) => ui(`Post-test question ${index + 1}: ${Number(state.postAnswers[question.id]) === question.answer ? "correct" : "incorrect"}`, `后测第 ${index + 1} 题：${Number(state.postAnswers[question.id]) === question.answer ? "正确" : "错误"}`)),
  ];
  if (state.feedbackData) {
    const helpfulLabels = {
      learn: ui("Learning lessons", "学习课程"),
      inspect: ui("Email inspection scenarios", "邮件检查场景"),
      defend: ui("Defence decisions", "防御决策"),
      results: ui("Results and review", "结果与复习"),
    };
    const choiceLabels = {
      yes: ui("Yes", "是"),
      unsure: ui("Not sure", "不确定"),
      no: ui("No", "否"),
    };
    lines.push(
      "",
      ui("Optional structured feedback from this tab:", "当前标签页中的可选结构化反馈："),
      ui(`Clarity: ${state.feedbackData.clarity}/5`, `清晰度：${state.feedbackData.clarity}/5`),
      ui(`Interaction helpfulness: ${state.feedbackData.interaction}/5`, `互动帮助程度：${state.feedbackData.interaction}/5`),
      ui(`Difficulty fit: ${state.feedbackData.difficulty}/5`, `难度合适程度：${state.feedbackData.difficulty}/5`),
      ui(`Most helpful section: ${helpfulLabels[state.feedbackData.helpful]}`, `最有帮助部分：${helpfulLabels[state.feedbackData.helpful]}`),
      ui(`More confident: ${choiceLabels[state.feedbackData.confidence]}`, `信心是否提高：${choiceLabels[state.feedbackData.confidence]}`),
      ui(`Would recommend: ${choiceLabels[state.feedbackData.recommend]}`, `是否愿意推荐：${choiceLabels[state.feedbackData.recommend]}`),
    );
  }
  const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "phishwise-anonymous-session-summary.txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clearLearningResults({ returnToStart = false } = {}) {
  const language = state.language;
  state = createInitialState();
  state.language = language;
  if (demoMode) {
    state.highestStep = 8;
  } else {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
  }
  document.querySelectorAll("form").forEach((form) => form.reset());
  document.querySelectorAll(".form-message").forEach((message) => {
    message.textContent = "";
    message.removeAttribute("style");
  });
  document.getElementById("scenario-result").hidden = true;
  document.getElementById("inspect-complete").hidden = true;
  renderDynamicContent();
  showScreen(returnToStart ? "intro" : "results");
}

document.addEventListener("click", (event) => {
  const languageButton = event.target.closest("[data-language]");
  if (languageButton) {
    setLanguage(languageButton.dataset.language);
    return;
  }

  const demoScenarioButton = event.target.closest("[data-demo-scenario]");
  if (demoScenarioButton && demoMode) {
    state.scenarioIndex = Number(demoScenarioButton.dataset.demoScenario);
    state.currentClueId = null;
    renderScenarioSection();
    showScreen("inspect");
    return;
  }

  const demoNavigationButton = event.target.closest("[data-demo-go]");
  if (demoNavigationButton && demoMode) {
    showScreen(demoNavigationButton.dataset.demoGo);
    return;
  }

  const navigationButton = event.target.closest("[data-go]");
  if (navigationButton) {
    event.preventDefault();
    showScreen(navigationButton.dataset.go);
    return;
  }

  const lessonButton = event.target.closest("[data-lesson]");
  if (lessonButton) {
    const id = lessonButton.dataset.lesson;
    if (state.openLessons.has(id)) state.openLessons.delete(id);
    else state.openLessons.add(id);
    renderLessons();
    return;
  }

  const scenarioTab = event.target.closest("[data-scenario-index]");
  if (scenarioTab) {
    state.scenarioIndex = Number(scenarioTab.dataset.scenarioIndex);
    state.currentClueId = null;
    renderScenarioSection();
    saveSession();
    return;
  }

  const clueButton = event.target.closest("[data-email-clue]");
  if (clueButton) {
    const scenario = currentScenario();
    const found = new Set(state.scenarioFound[scenario.id]);
    found.add(clueButton.dataset.emailClue);
    state.scenarioFound[scenario.id] = [...found];
    state.currentClueId = clueButton.dataset.emailClue;
    renderScenarioEmail();
    saveSession();
    return;
  }

  const riskButton = event.target.closest("[data-risk-case]");
  if (riskButton) {
    const riskId = riskButton.dataset.riskCase;
    if (state.openRisks.has(riskId)) state.openRisks.delete(riskId);
    else state.openRisks.add(riskId);
    renderRiskModel();
    return;
  }

  const defenceTab = event.target.closest("[data-defence-index]");
  if (defenceTab) {
    state.defenceIndex = Number(defenceTab.dataset.defenceIndex);
    renderDefenceScenario();
    saveSession();
    return;
  }

  const decisionButton = event.target.closest("[data-decision-index]");
  if (decisionButton) {
    const scenario = content.defenceScenarios[state.defenceIndex];
    const selected = Number(decisionButton.dataset.decisionIndex);
    if (state.defenceFirstAnswers[scenario.id] === undefined) state.defenceFirstAnswers[scenario.id] = selected;
    state.defenceAnswers[scenario.id] = selected;
    renderDefenceScenario();
    saveSession();
    return;
  }

  const reviewButton = event.target.closest("[data-review-lesson]");
  if (reviewButton) {
    const lesson = reviewButton.dataset.reviewLesson;
    state.openLessons.add(lesson);
    showScreen("learn");
    renderLessons();
    setTimeout(() => document.getElementById(`lesson-${lesson}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
});

document.getElementById("pretest-form").addEventListener("change", (event) => handleQuizChange("pretest", event));
document.getElementById("posttest-form").addEventListener("change", (event) => handleQuizChange("posttest", event));
document.getElementById("pretest-form").addEventListener("submit", (event) => { event.preventDefault(); submitQuiz("pretest", event.currentTarget); });
document.getElementById("posttest-form").addEventListener("submit", (event) => { event.preventDefault(); submitQuiz("posttest", event.currentTarget); });

document.getElementById("finish-scenario").addEventListener("click", finishScenario);
document.getElementById("next-scenario").addEventListener("click", () => {
  state.scenarioIndex = (state.scenarioIndex + 1) % content.emailScenarios.length;
  state.currentClueId = null;
  renderScenarioSection();
  saveSession();
});

document.getElementById("feedback-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const required = ["clarity", "interaction", "difficulty", "confidence", "recommend"];
  const missingRadio = required.some((name) => !form.querySelector(`input[name="${name}"]:checked`));
  const missingSelect = !form.elements.helpful.value;
  const message = document.getElementById("feedback-message");
  if (missingRadio || missingSelect) {
    state.feedbackStatus = "missing";
    message.style.color = "var(--danger)";
    message.textContent = ui("Please complete all rating and choice questions. Free-text fields are optional.", "请完成所有评分和选择题。自由文本为可选项。");
    return;
  }
  state.feedbackStatus = "recorded";
  state.feedbackData = {
    clarity: form.querySelector('input[name="clarity"]:checked').value,
    interaction: form.querySelector('input[name="interaction"]:checked').value,
    difficulty: form.querySelector('input[name="difficulty"]:checked').value,
    helpful: form.elements.helpful.value,
    confidence: form.querySelector('input[name="confidence"]:checked').value,
    recommend: form.querySelector('input[name="recommend"]:checked').value,
  };
  message.style.color = "var(--green)";
  message.textContent = ui("Feedback is held in this tab only. Structured choices enter the anonymous summary only if you download it; free text is excluded and nothing is transmitted.", "反馈只保留在当前标签页中。仅在你下载匿名摘要时，结构化选项才会写入摘要；自由文本会被排除，且任何内容都不会传输。");
});

document.getElementById("download-summary").addEventListener("click", downloadSummary);
document.getElementById("demo-mode-button").addEventListener("click", () => {
  if (demoMode) {
    exitDemoMode();
    return;
  }
  const accepted = confirm(ui(
    "Demo mode allows free access to all sections. It is for presentation purposes only and will not count as formal test data.",
    "进入演示模式后，可以自由访问所有页面。此模式仅用于课堂展示，不计入正式测试结果。",
  ));
  if (accepted) enterDemoMode();
});
document.getElementById("demo-autofill").addEventListener("click", autoFillDemoData);
document.getElementById("clear-local-results").addEventListener("click", () => {
  if (confirm(ui("Clear all locally stored quiz, scenario, and defence results?", "是否清除本地保存的全部测验、场景和防御结果？"))) clearLearningResults();
});
document.getElementById("reset-button").addEventListener("click", () => {
  const accepted = demoMode
    ? confirm(ui("Reset the temporary demo activity? Formal results will be kept.", "是否重置临时演示活动？正式测试结果将被保留。"))
    : confirm(ui("Reset the entire activity and clear all local progress?", "是否重置整个活动并清除全部本地进度？"));
  if (accepted) clearLearningResults({ returnToStart: true });
});

captureTranslatableContent();
loadSession();
renderDynamicContent();
setLanguage(state.language);

const initialHash = window.location.hash.slice(1);
const restoredScreen = document.getElementById(initialHash)?.classList.contains("screen") ? initialHash : state.currentScreen;
showScreen(restoredScreen || "intro");
