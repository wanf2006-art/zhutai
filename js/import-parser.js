(function (window) {
  "use strict";

  var REVIEW_FIELDS = [
    { key: "date", label: "日期", aliases: ["日期", "复盘日期", "记录日期"], date: true },
    { key: "executionResult", label: "今日执行结果", aliases: ["今日执行结果", "今日结果", "执行结果", "整改执行结果", "上次整改结果", "昨日整改结果", "整改结果"] },
    { key: "didToday", label: "今天做了什么", aliases: ["今天做了什么", "今日做了什么", "今日完成事项", "今天完成事项", "今日行动", "完成事项"] },
    { key: "mostImportant", label: "今天最重要的一件事", aliases: ["今天最重要的一件事", "今日最重要的一件事", "今天最重要的事", "今日最重要的事", "最重要的一件事"] },
    { key: "previousGoal", label: "上次整改目标", aliases: ["上次整改目标", "昨日整改目标", "上一次整改目标", "本阶段整改目标"] },
    { key: "currentGoal", label: "当前整改目标", aliases: ["当前整改目标", "正在整改什么", "本次整改目标", "明日只改一件事", "明天只改一件事"] },
    { key: "evidence", label: "事实证据", aliases: ["事实证据", "执行证据", "完成证据", "今日证据", "证据"] },
    { key: "newIssue", label: "今日新增问题", aliases: ["今日新增问题", "今天新增问题", "今日关键问题", "今天最值得纠正的一件事", "今日最值得纠正的一件事", "关键问题", "新增问题"] },
    { key: "dropoutChain", label: "掉线链路", aliases: ["掉线链路", "问题链路", "发生链路", "触发链路", "掉线过程"] },
    { key: "nextAction", label: "明日整改动作", aliases: ["明日唯一整改动作", "明天唯一整改动作", "明日整改动作", "明天整改动作", "下一步整改动作", "明日改动", "明天改动", "明日动作", "明天动作"] },
    { key: "acceptance", label: "验收标准", aliases: ["明日验收标准", "明天验收标准", "验收标准", "完成标准", "验收点"] },
    { key: "note", label: "一句记录", aliases: ["一句记录", "一句话记录", "今日一句话", "今日一句", "今日结论", "复盘一句", "今日总结"] },
    { key: "rawText", label: "完整复盘原文", aliases: [], raw: true }
  ];

  var PLAN_FIELDS = [
    { key: "date", label: "计划日期", aliases: ["计划日期", "明日日期", "明天日期", "日期"], date: true },
    { key: "morning", label: "早上任务", aliases: ["早上任务", "上午任务", "早间任务", "早间安排", "上午安排"] },
    { key: "afternoon", label: "下午任务", aliases: ["下午任务", "下午安排", "午后任务"] },
    { key: "after15", label: "15:00之后的任务或学习任务", aliases: ["15:00之后", "15：00之后", "15点之后", "十五点之后", "15:00后", "15：00后", "下午三点后", "学习任务", "15:00之后的任务", "15:00之后的任务或学习任务"] },
    { key: "evening", label: "晚上任务", aliases: ["晚上任务", "晚间任务", "晚上安排", "晚间安排"] },
    { key: "mostImportant", label: "明天最重要的一件事", aliases: ["明天最重要的一件事", "明日最重要的一件事", "明天最重要的事", "明日最重要的事", "明日核心任务", "明天核心任务"] },
    { key: "latestStart", label: "最晚开始时间", aliases: ["最晚开始时间", "最迟开始时间", "最晚几点开始", "最迟几点开始"] },
    { key: "minAction", label: "最低动作", aliases: ["最低动作", "最低启动动作", "保底动作", "最小动作"] },
    { key: "acceptance", label: "验收标准", aliases: ["验收标准", "完成标准", "验收点", "计划验收标准"] },
    { key: "rawText", label: "完整计划原文", aliases: [], raw: true }
  ];

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function normalizeRaw(raw) {
    return String(raw == null ? "" : raw)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .replace(/^\s*```[^\n]*$/gm, "")
      .replace(/[\u00a0\u3000]/g, " ")
      .replace(/[ \t]+$/gm, "")
      .replace(/^\n{3,}/, "\n\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function normalizeLabel(value) {
    return String(value || "")
      .replace(/\*\*/g, "")
      .replace(/[【】\[\]]/g, "")
      .replace(/[：:]/g, "")
      .replace(/[\s_-]/g, "")
      .trim();
  }

  function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function headerCandidate(line) {
    return String(line || "")
      .replace(/^\s*>\s?/, "")
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/^\s*(?:[-+*]\s+|[①-⑳]\s*|[一二三四五六七八九十]+[.、)]\s*|\d+[.、)]\s*)/, "")
      .replace(/\*\*/g, "")
      .trim();
  }

  function buildAliases(fields) {
    var result = [];
    fields.forEach(function (field) {
      field.aliases.forEach(function (alias) {
        result.push({ key: field.key, label: field.label, alias: alias, normalized: normalizeLabel(alias) });
      });
    });
    return result.sort(function (a, b) { return b.normalized.length - a.normalized.length; });
  }

  function matchHeader(line, aliases) {
    var candidate = headerCandidate(line);
    if (!candidate) return null;

    var bracket = candidate.match(/^【\s*([^】]+?)\s*】\s*(?:[：:]\s*)?(.*)$/);
    if (bracket) {
      var bracketLabel = normalizeLabel(bracket[1]);
      for (var b = 0; b < aliases.length; b += 1) {
        if (bracketLabel === aliases[b].normalized) return { key: aliases[b].key, label: aliases[b].label, alias: aliases[b].alias, inline: String(bracket[2] || "").trim(), confidence: "high" };
      }
    }

    for (var i = 0; i < aliases.length; i += 1) {
      var alias = aliases[i];
      var pattern = new RegExp("^" + escapeRegExp(alias.alias).replace(/\\ /g, "\\s*") + "\\s*(?:[：:]\\s*(.*))?$");
      var match = candidate.match(pattern);
      if (match) return { key: alias.key, label: alias.label, alias: alias.alias, inline: String(match[1] || "").trim(), confidence: "high" };
    }
    return null;
  }

  function normalizeDate(value) {
    var match = String(value || "").match(/(20\d{2})\s*[\-\/.年]\s*(\d{1,2})\s*[\-\/.月]\s*(\d{1,2})\s*日?/);
    if (!match) return "";
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    return match[1] + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }

  function cleanContent(value) {
    return String(value || "")
      .replace(/^\n+|\n+$/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function parseWithFields(raw, fields) {
    var normalized = normalizeRaw(raw);
    var aliases = buildAliases(fields);
    var data = {};
    var meta = {};
    var buffers = {};
    var currentKey = "";

    fields.forEach(function (field) {
      data[field.key] = field.raw ? normalized : "";
      meta[field.key] = field.raw ? { status: "high", source: "原文保留" } : { status: "missing", source: "未识别，请确认" };
      buffers[field.key] = [];
    });

    normalized.split("\n").forEach(function (line) {
      var header = matchHeader(line, aliases);
      if (header) {
        currentKey = header.key;
        meta[currentKey] = { status: header.confidence, source: "标题：" + header.alias };
        if (header.inline) buffers[currentKey].push(header.inline);
        return;
      }
      if (currentKey) buffers[currentKey].push(line);
    });

    fields.forEach(function (field) {
      if (field.raw) return;
      var value = cleanContent(buffers[field.key].join("\n"));
      if (field.date && value) {
        var parsedDate = normalizeDate(value);
        if (parsedDate) value = parsedDate;
        else meta[field.key] = { status: "low", source: "识别到日期字段，但格式需确认" };
      }
      data[field.key] = value;
      if (!value && meta[field.key].status !== "missing") meta[field.key] = { status: "low", source: "识别到标题，但内容为空" };
    });

    var dateField = fields.find(function (field) { return field.date; });
    if (dateField && !data[dateField.key]) {
      var inferredDate = normalizeDate(normalized);
      if (inferredDate) {
        data[dateField.key] = inferredDate;
        meta[dateField.key] = { status: "low", source: "从原文日期推断" };
      }
    }

    return { data: data, meta: meta, normalizedRaw: normalized };
  }

  function meaningfulCount(parsed, fields) {
    return fields.filter(function (field) { return !field.raw && !field.date && String(parsed.data[field.key] || "").trim(); }).length;
  }

  function uniqueCount(parsed, type) {
    var keys = type === "plan" ? ["morning", "afternoon", "after15", "evening", "latestStart", "minAction"] : ["executionResult", "didToday", "previousGoal", "currentGoal", "evidence", "newIssue", "dropoutChain", "nextAction", "note"];
    return keys.filter(function (key) { return String(parsed.data[key] || "").trim(); }).length;
  }

  function inferLatestStart(plan) {
    if (plan.data.latestStart) return;
    var source = [plan.data.mostImportant, plan.data.minAction, plan.data.after15].join("\n");
    var match = source.match(/(?:最晚|最迟)?\s*(\d{1,2})\s*[：:]\s*(\d{2})/) || source.match(/(?:最晚|最迟)\s*(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分?)?/);
    if (!match) return;
    var hour = Number(match[1]);
    var minute = Number(match[2] || 0);
    if (hour > 23 || minute > 59) return;
    plan.data.latestStart = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    plan.meta.latestStart = { status: "low", source: "从任务文字推断，请确认" };
  }

  function parse(raw, forcedType) {
    var review = parseWithFields(raw, REVIEW_FIELDS);
    var plan = parseWithFields(raw, PLAN_FIELDS);
    inferLatestStart(plan);

    var reviewCount = meaningfulCount(review, REVIEW_FIELDS);
    var planCount = meaningfulCount(plan, PLAN_FIELDS);
    var reviewUnique = uniqueCount(review, "review");
    var planUnique = uniqueCount(plan, "plan");
    var type = forcedType === "review" || forcedType === "plan" ? forcedType : null;

    if (!type) {
      if (reviewUnique > planUnique && (reviewUnique >= 2 || planUnique === 0)) type = "review";
      else if (planUnique > reviewUnique && (planUnique >= 2 || reviewUnique === 0)) type = "plan";
      else if (reviewCount >= planCount + 2) type = "review";
      else if (planCount >= reviewCount + 2) type = "plan";
    }

    var selected = type === "plan" ? plan : type === "review" ? review : null;
    var fields = type === "plan" ? PLAN_FIELDS : REVIEW_FIELDS;
    var selectedCount = selected ? meaningfulCount(selected, fields) : 0;
    return {
      type: type,
      confidence: type && Math.abs(reviewUnique - planUnique) >= 2 ? "high" : type ? "low" : "unknown",
      count: selectedCount,
      data: selected ? selected.data : null,
      meta: selected ? selected.meta : null,
      rawText: normalizeRaw(raw),
      scores: { review: reviewCount, plan: planCount, reviewUnique: reviewUnique, planUnique: planUnique }
    };
  }

  function getFields(type) { return (type === "plan" ? PLAN_FIELDS : REVIEW_FIELDS).map(function (field) { return Object.assign({}, field, { aliases: field.aliases.slice() }); }); }

  window.ZTImportParser = {
    parse: parse,
    getFields: getFields,
    normalizeDate: normalizeDate,
    normalizeRaw: normalizeRaw,
    today: today
  };
})(window);
