(function (window) {
  "use strict";

  var STATE_KEY = "zhutai-v2-state-v1";
  var MIGRATION_KEY = "zhutai-v2-migration-complete-v1";
  var SCHEMA_VERSION = 3;
  var SCHEMA_MIGRATION_KEY = "zhutai-v2-schema-v3-complete-v1";
  var LEGACY_REVIEW_KEY = "zhutai-correction-reviews-v1";
  var LEGACY_INSIGHT_KEY = "zc-observation-records-v2";
  var LEGACY_KEYS = ["dingzhenchao-insight-offline-v1", "huangsiquan-insight-offline-v1", "x" + "unji-insight-offline-v1"];
  var storageNotice = "";

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function uid(prefix) {
    return (prefix || "ZT") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function defaultState() {
    return {
      version: 2,
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      settings: {
        name: "丁振超",
        birthDate: "",
        targetAge: 80,
        greeting: "每一步的积累，都是在为未来筑台。",
        theme: "dark"
      },
      correction: {
        goal: "",
        action: "",
        startDate: "",
        status: "待设置",
        completedAt: ""
      },
      mainline: {
        title: "",
        reason: "",
        startDate: "",
        stage: "",
        coreSkill: "",
        notDoing: ""
      },
      quotes: ["不是看到了希望才坚持，而是坚持了才会看到希望。"],
      quoteIndex: 0,
      reviews: [],
      plans: [],
      insights: [],
      tasks: [],
      goals: [],
      focusItems: [],
      products: [],
      iterations: [],
      learnings: [],
      meditations: [],
      resources: []
    };
  }

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }

  function asArray(value) { return Array.isArray(value) ? value : []; }
  function text(value) { return value == null ? "" : String(value); }
  function pick() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] != null && String(arguments[i]).trim()) return String(arguments[i]);
    }
    return "";
  }

  function normalizeState(input) {
    var base = defaultState();
    var source = input && typeof input === "object" ? input : {};
    base.version = 2;
    base.schemaVersion = SCHEMA_VERSION;
    base.createdAt = source.createdAt || base.createdAt;
    base.settings = Object.assign(base.settings, source.settings || {});
    if (!String(base.settings.name || "").trim()) base.settings.name = "丁振超";
    base.correction = Object.assign(base.correction, source.correction || {});
    base.mainline = Object.assign(base.mainline, source.mainline || {});
    ["reviews", "plans", "insights", "tasks", "goals", "focusItems", "products", "iterations", "learnings", "meditations", "resources"].forEach(function (key) {
      base[key] = asArray(source[key]);
    });
    base.quotes = asArray(source.quotes).filter(function (item) { return String(item || "").trim(); });
    if (!base.quotes.length) base.quotes = defaultState().quotes;
    base.quoteIndex = Math.max(0, Math.min(Number(source.quoteIndex) || 0, base.quotes.length - 1));
    Object.keys(source).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(base, key)) base[key] = source[key];
    });
    return base;
  }

  function migrateReview(item) {
    var source = item || {};
    return {
      id: source.id || uid("REV"),
      date: source.date || today(),
      didToday: source.didToday || source.todayDid || "",
      mostImportant: source.mostImportant || source.newIssue || source.note || "",
      previousGoal: source.previousGoal || "",
      currentGoal: source.currentGoal || "",
      executionResult: source.executionResult || "",
      evidence: source.evidence || "",
      newIssue: source.newIssue || "",
      dropoutChain: source.dropoutChain || "",
      nextAction: source.nextAction || "",
      acceptance: source.acceptance || "",
      note: source.note || "",
      rawText: source.rawText || "",
      createdAt: source.createdAt || new Date((source.date || today()) + "T20:00:00").toISOString(),
      updatedAt: source.updatedAt || source.createdAt || new Date().toISOString()
    };
  }

  function migrateInsight(item) {
    var source = item || {};
    var scene = pick(source.scene, source.gateService, source.summary);
    var observation = [source.scene, source.trigger, source.sellerOffers, source.buyerProvides].filter(Boolean).join("\n\n");
    var problem = pick(source.pain, source.commonPain, source.unknownPoint);
    var job = pick(source.task, source.coreTask, source.gateBuyerTask);
    var alternative = pick(source.oldSolution, source.alternatives, source.choice);
    var alternativeProblem = pick(source.choiceReason, source.missingKnowledge);
    var conclusion = pick(source.insight, source.finalJudgment, source.title);
    return {
      id: source.id || uid("INS"),
      date: source.date || source.createdAt || today(),
      title: source.title || source.accountName || "旧版需求洞察",
      observation: observation || scene,
      scene: scene,
      problem: problem,
      job: job,
      alternative: alternative,
      alternativeProblem: alternativeProblem,
      hypothesis: text(source.hypothesis),
      toValidate: pick(source.unknowns, source.nextValidation, source.validationResult),
      nextAction: pick(source.nextValidation, source.nextChange, source.personalDecision),
      conclusion: conclusion,
      extra: pick(source.mingdengResult, source.facts, source.fullAnalysis),
      linkedProductId: "",
      sourceType: source.type || "旧版记录",
      legacyData: source,
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || source.date || today()
    };
  }

  function migrateLegacy() {
    var state = defaultState();
    var legacyReviews = asArray(safeParse(localStorage.getItem(LEGACY_REVIEW_KEY), []));
    var legacyInsights = asArray(safeParse(localStorage.getItem(LEGACY_INSIGHT_KEY), []));

    if (!legacyInsights.length) {
      for (var i = 0; i < LEGACY_KEYS.length; i += 1) {
        var candidate = asArray(safeParse(localStorage.getItem(LEGACY_KEYS[i]), []));
        if (candidate.length) { legacyInsights = candidate; break; }
      }
    }

    state.reviews = legacyReviews.map(migrateReview);
    state.insights = legacyInsights
      .filter(function (item) { return !String(item && item.id || "").startsWith("sample-"); })
      .map(migrateInsight);

    if (state.reviews.length) {
      var latest = state.reviews.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0];
      if (latest.previousGoal || latest.currentGoal) {
        state.correction = {
          goal: latest.currentGoal || latest.previousGoal,
          action: latest.nextAction || "",
          startDate: latest.date || today(),
          status: "进行中",
          completedAt: ""
        };
      }
    }

    var rawBackup = {
      reviews: safeParse(localStorage.getItem(LEGACY_REVIEW_KEY), []),
      insights: safeParse(localStorage.getItem(LEGACY_INSIGHT_KEY), [])
    };
    try {
      localStorage.setItem("zhutai-v2-legacy-backup-" + Date.now(), JSON.stringify(rawBackup));
    } catch (error) {}

    localStorage.setItem(MIGRATION_KEY, "1");
    return state;
  }

  function backupRaw(prefix, raw) {
    if (!raw) return "";
    var key = prefix + Date.now();
    localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw new Error("本地备份校验失败");
    return key;
  }

  function migrateSchemaIfNeeded(raw, saved) {
    var sourceVersion = Number(saved && saved.schemaVersion) || 2;
    if (sourceVersion >= SCHEMA_VERSION) {
      try { localStorage.setItem(SCHEMA_MIGRATION_KEY, "1"); } catch (error) {}
      return normalizeState(saved);
    }
    try {
      backupRaw("zhutai-v2-before-schema-v3-", raw);
      var migrated = normalizeState(saved);
      localStorage.setItem(STATE_KEY, JSON.stringify(migrated));
      localStorage.setItem(SCHEMA_MIGRATION_KEY, "1");
      storageNotice = "数据结构已安全升级，并已自动保留升级前备份。";
      return migrated;
    } catch (error) {
      storageNotice = "数据升级未写入：" + error.message + "。原数据仍保持不变。";
      return normalizeState(saved);
    }
  }

  function load() {
    var raw = localStorage.getItem(STATE_KEY);
    var saved = safeParse(raw, null);
    if (saved) return migrateSchemaIfNeeded(raw, saved);
    var state = localStorage.getItem(MIGRATION_KEY) ? defaultState() : migrateLegacy();
    save(state);
    return state;
  }

  function save(state) {
    var currentRaw = localStorage.getItem(STATE_KEY);
    var current = safeParse(currentRaw, null);
    if (currentRaw && current && (Number(current.schemaVersion) || 2) < SCHEMA_VERSION && !localStorage.getItem(SCHEMA_MIGRATION_KEY)) {
      backupRaw("zhutai-v2-before-schema-v3-", currentRaw);
    }
    var normalized = normalizeState(state);
    localStorage.setItem(STATE_KEY, JSON.stringify(normalized));
    localStorage.setItem(MIGRATION_KEY, "1");
    localStorage.setItem(SCHEMA_MIGRATION_KEY, "1");
    return normalized;
  }

  function clearV2() {
    var currentRaw = localStorage.getItem(STATE_KEY);
    if (currentRaw) backupRaw("zhutai-v2-before-clear-", currentRaw);
    var state = defaultState();
    localStorage.setItem(MIGRATION_KEY, "1");
    localStorage.setItem(SCHEMA_MIGRATION_KEY, "1");
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return state;
  }

  function importPayload(payload) {
    if (!payload || typeof payload !== "object") throw new Error("备份文件格式不正确");
    var source = payload.state || payload;
    if (!source || typeof source !== "object") throw new Error("备份文件缺少数据");
    var currentRaw = localStorage.getItem(STATE_KEY);
    if (currentRaw) backupRaw("zhutai-v2-before-import-", currentRaw);
    localStorage.setItem(MIGRATION_KEY, "1");
    return save(source);
  }

  function exportPayload(state) {
    return {
      app: "筑台者 V2",
      version: 3,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      state: normalizeState(state)
    };
  }

  function getNotice() { return storageNotice; }
  function clearNotice() { storageNotice = ""; }

  window.ZTStore = {
    STATE_KEY: STATE_KEY,
    MIGRATION_KEY: MIGRATION_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    SCHEMA_MIGRATION_KEY: SCHEMA_MIGRATION_KEY,
    LEGACY_REVIEW_KEY: LEGACY_REVIEW_KEY,
    LEGACY_INSIGHT_KEY: LEGACY_INSIGHT_KEY,
    today: today,
    uid: uid,
    defaultState: defaultState,
    normalizeState: normalizeState,
    load: load,
    save: save,
    clearV2: clearV2,
    importPayload: importPayload,
    exportPayload: exportPayload,
    getNotice: getNotice,
    clearNotice: clearNotice
  };
})(window);
