(function (window, document) {
  "use strict";

  var Store = window.ZTStore;
  var Icons = window.ZTIcons;
  var ImportParser = window.ZTImportParser;
  var state = Store.load();
  var currentPage = "overview";
  var selectedProductId = state.products[0] ? state.products[0].id : "";
  var selectedCalendarDate = Store.today();
  var calendarCursor = new Date(selectedCalendarDate + "T12:00:00");
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  var reviewFilter = "全部";
  var reviewSearch = "";
  var insightSearch = "";
  var insightSort = "new";
  var resourceSearch = "";
  var resourceFilter = "全部";
  var dashboardRange = 7;
  var modalSubmitHandler = null;
  var clockTimer = null;
  var smartImportDraft = null;

  var navItems = [
    { id: "overview", label: "今日概览", icon: "home" },
    { id: "smart-import", label: "智能导入", icon: "build" },
    { id: "daily", label: "每日记录", icon: "daily" },
    { id: "life-plan", label: "人生计划", icon: "plan" },
    { id: "insights", label: "需求洞察", icon: "insight" },
    { id: "products", label: "产品迭代", icon: "product" },
    { id: "learning", label: "学习成长", icon: "learning" },
    { id: "meditation", label: "冥想与反思", icon: "meditation" },
    { id: "resources", label: "资源库", icon: "resources" },
    { id: "dashboard", label: "数据看板", icon: "dashboard" },
    { id: "settings", label: "设置", icon: "settings" }
  ];

  function $(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]; }); }
  function text(value, fallback) { var result = value == null ? "" : String(value).trim(); return result || (fallback == null ? "未填写" : fallback); }
  function number(value) { var result = Number(value); return Number.isFinite(result) ? result : 0; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, number(value))); }
  function dateOf(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : Store.today(); }
  function timeOf(value) { return /^\d{2}:\d{2}$/.test(String(value || "")) ? String(value) : "20:00"; }
  function toDate(value) { var date = new Date(String(value || "") + (/T/.test(String(value || "")) ? "" : "T12:00:00")); return isNaN(date.getTime()) ? new Date() : date; }
  function daysBetween(a, b) { return Math.max(0, Math.floor((toDate(b).getTime() - toDate(a).getTime()) / 86400000)); }
  function addDays(date, amount) { var d = toDate(date); d.setDate(d.getDate() + amount); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function formatDate(value) { var d = toDate(value); return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日"; }
  function shortDate(value) { var d = toDate(value); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; }
  function getFormObject(form) { var result = {}; new FormData(form).forEach(function (value, key) { result[key] = String(value); }); return result; }
  function showToast(message) { var toast = $("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(function () { toast.classList.remove("show"); }, 2100); }
  function save(message) {
    try {
      state = Store.save(state);
      renderAll();
      if (message) showToast(message);
      return true;
    } catch (error) {
      try { state = Store.load(); renderAll(); } catch (loadError) {}
      showToast("保存失败，原数据未被覆盖：" + error.message);
      return false;
    }
  }
  function download(name, content, type) { var blob = new Blob([content], { type: type || "application/json;charset=utf-8" }); var link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 800); }
  function findById(list, id) { return list.find(function (item) { return item.id === id; }); }
  function removeById(list, id) { return list.filter(function (item) { return item.id !== id; }); }
  function valueField(label, name, value, options) {
    options = options || {};
    var cls = options.full ? "full" : "";
    var required = options.required ? " required" : "";
    var type = options.type || "text";
    if (options.textarea) return '<label class="' + cls + '">' + esc(label) + '<textarea name="' + esc(name) + '" placeholder="' + esc(options.placeholder || "") + '"' + required + '>' + esc(value || "") + '</textarea></label>';
    if (options.select) return '<label class="' + cls + '">' + esc(label) + '<select name="' + esc(name) + '"' + required + '>' + options.select.map(function (item) { var itemValue = typeof item === "string" ? item : item.value; var itemLabel = typeof item === "string" ? item : item.label; return '<option value="' + esc(itemValue) + '"' + (String(value) === String(itemValue) ? " selected" : "") + '>' + esc(itemLabel) + '</option>'; }).join("") + '</select></label>';
    return '<label class="' + cls + '">' + esc(label) + '<input name="' + esc(name) + '" type="' + esc(type) + '" value="' + esc(value || "") + '" placeholder="' + esc(options.placeholder || "") + '"' + (options.min != null ? ' min="' + esc(options.min) + '"' : "") + (options.max != null ? ' max="' + esc(options.max) + '"' : "") + required + '></label>';
  }
  function emptyState(title, note, action, label) { return '<div class="empty-state"><div><strong>' + esc(title) + '</strong>' + esc(note || "") + (action ? '<button class="btn subtle" type="button" data-action="' + esc(action) + '">' + esc(label || "新增记录") + '</button>' : "") + '</div></div>'; }
  function icon(name) { return Icons.icon(name); }

  function openModal(title, eyebrow, html, onSubmit) {
    $("modalTitle").textContent = title;
    $("modalEyebrow").textContent = eyebrow || "RECORD";
    $("modalForm").innerHTML = html;
    modalSubmitHandler = onSubmit || null;
    $("modalLayer").classList.add("open");
    $("modalLayer").setAttribute("aria-hidden", "false");
    var first = $("modalForm").querySelector("input,textarea,select");
    if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function closeModal() { $("modalLayer").classList.remove("open"); $("modalLayer").setAttribute("aria-hidden", "true"); $("modalForm").innerHTML = ""; modalSubmitHandler = null; }
  function openDrawer(title, eyebrow, html) { $("drawerTitle").textContent = title; $("drawerEyebrow").textContent = eyebrow || "DETAIL"; $("drawerBody").innerHTML = html; $("drawerLayer").classList.add("open"); $("drawerLayer").setAttribute("aria-hidden", "false"); }
  function closeDrawer() { $("drawerLayer").classList.remove("open"); $("drawerLayer").setAttribute("aria-hidden", "true"); $("drawerBody").innerHTML = ""; }

  function renderNav() {
    $("sideNav").innerHTML = navItems.map(function (item) { return '<button class="nav-item ' + (currentPage === item.id ? "active" : "") + '" type="button" data-nav="' + item.id + '">' + icon(item.icon) + '<span>' + item.label + '</span></button>'; }).join("");
    $("menuToggle").innerHTML = icon("resources");
    document.querySelectorAll("[data-icon-slot]").forEach(function (element) { element.innerHTML = icon(element.getAttribute("data-icon-slot")); });
    $("correctionIcon").innerHTML = icon("build");
  }

  function setPage(page) {
    if (!navItems.some(function (item) { return item.id === page; })) page = "overview";
    currentPage = page;
    document.querySelectorAll(".view").forEach(function (view) { view.classList.toggle("active", view.dataset.view === page); });
    renderNav();
    $("appShell").classList.remove("menu-open");
    $("overlay").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderPage(page);
  }

  function allCollections() {
    return [
      { key: "reviews", page: "daily", type: "复盘", icon: "daily" },
      { key: "insights", page: "insights", type: "需求洞察", icon: "insight" },
      { key: "tasks", page: "life-plan", type: "计划", icon: "task" },
      { key: "iterations", page: "products", type: "产品迭代", icon: "product" },
      { key: "learnings", page: "learning", type: "学习", icon: "book" },
      { key: "meditations", page: "meditation", type: "冥想", icon: "meditation" },
      { key: "resources", page: "resources", type: "资源", icon: "resources" }
    ];
  }
  function recordTitle(key, item) {
    if (key === "reviews") return item.mostImportant || item.note || item.nextAction || "一条复盘";
    if (key === "insights") return item.title || "需求洞察";
    if (key === "tasks") return item.title || "计划";
    if (key === "iterations") return (item.version ? item.version + " · " : "") + (item.change || item.problem || "产品迭代");
    if (key === "learnings") return item.topic || "学习记录";
    if (key === "meditations") return item.reflection || item.thoughts || "冥想记录";
    if (key === "resources") return item.title || "资源";
    return "记录";
  }
  function recordSummary(key, item) {
    if (key === "reviews") return item.evidence || item.didToday || item.executionResult || "";
    if (key === "insights") return item.conclusion || item.problem || item.observation || "";
    if (key === "tasks") return item.note || (item.completed ? "已完成" : "待完成");
    if (key === "iterations") return item.result || item.reason || item.feedback || "";
    if (key === "learnings") return item.learned || item.content || "";
    if (key === "meditations") return item.afterState || item.reflection || "";
    if (key === "resources") return item.note || item.source || "";
    return "";
  }
  function allRecords() {
    var result = [];
    allCollections().forEach(function (collection) {
      state[collection.key].forEach(function (item) {
        result.push({
          id: item.id,
          key: collection.key,
          page: collection.page,
          type: collection.type,
          icon: collection.icon,
          date: dateOf(item.date || (item.createdAt || "").slice(0, 10)),
          time: item.time || ((item.createdAt || "").slice(11, 16)) || "20:00",
          title: recordTitle(collection.key, item),
          summary: recordSummary(collection.key, item),
          item: item
        });
      });
    });
    return result.sort(function (a, b) { return (b.date + "T" + b.time).localeCompare(a.date + "T" + a.time); });
  }

  function uniqueRecordDates() { var set = new Set(); allRecords().forEach(function (item) { if (item.date) set.add(item.date); }); return Array.from(set).sort(); }
  function streakCount() {
    var dates = uniqueRecordDates();
    if (!dates.length) return 0;
    var set = new Set(dates);
    var cursor = set.has(Store.today()) ? Store.today() : (set.has(addDays(Store.today(), -1)) ? addDays(Store.today(), -1) : dates[dates.length - 1]);
    var count = 0;
    while (set.has(cursor)) { count += 1; cursor = addDays(cursor, -1); }
    return count;
  }
  function minutesToday() {
    var today = Store.today();
    var taskMinutes = state.tasks.filter(function (item) { return item.date === today && item.completed; }).reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var learningMinutes = state.learnings.filter(function (item) { return item.date === today; }).reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var meditationMinutes = state.meditations.filter(function (item) { return item.date === today; }).reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    return taskMinutes + learningMinutes + meditationMinutes;
  }
  function getLifeProgress() {
    var birth = state.settings.birthDate;
    var targetAge = number(state.settings.targetAge) || 80;
    if (!birth) return { age: "--", percent: null };
    var birthday = toDate(birth);
    var now = new Date();
    var age = now.getFullYear() - birthday.getFullYear();
    var beforeBirthday = now.getMonth() < birthday.getMonth() || (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate());
    if (beforeBirthday) age -= 1;
    var end = new Date(birthday.getFullYear() + targetAge, birthday.getMonth(), birthday.getDate());
    var percent = clamp(((now.getTime() - birthday.getTime()) / (end.getTime() - birthday.getTime())) * 100, 0, 100);
    return { age: Math.max(0, age), percent: percent };
  }
  function greeting() { var hour = new Date().getHours(); if (hour < 6) return "夜深了"; if (hour < 11) return "早上好"; if (hour < 14) return "中午好"; if (hour < 18) return "下午好"; return "晚上好"; }

  function updateClock() {
    var now = new Date();
    var week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    $("greetingText").textContent = greeting();
    $("userNameText").textContent = "，" + (state.settings.name || "丁振超");
    $("clockDate").textContent = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日";
    $("clockWeek").textContent = week[now.getDay()];
    $("clockTime").textContent = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    $("clockPeriodIcon").textContent = now.getHours() >= 6 && now.getHours() < 18 ? "◌" : "☾";
  }

  function miniWaveSvg() {
    return '<svg viewBox="0 0 160 80" preserveAspectRatio="none"><defs><linearGradient id="focusArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38a5f7" stop-opacity=".42"/><stop offset="1" stop-color="#38a5f7" stop-opacity="0"/></linearGradient></defs><path d="M0 68 C22 68 25 58 42 59 C65 60 68 12 96 12 C124 12 128 59 160 67 L160 80 L0 80Z" fill="url(#focusArea)"/><path d="M0 68 C22 68 25 58 42 59 C65 60 68 12 96 12 C124 12 128 59 160 67" fill="none" stroke="#38a5f7" stroke-width="1.5"/></svg>';
  }

  function renderOverview() {
    $("greetingSub").textContent = state.settings.greeting || "每一步的积累，都是在为未来筑台。";
    $("streakDays").textContent = streakCount();
    var correction = state.correction;
    $("correctionGoalText").textContent = correction.goal || "尚未设置当前整改目标";
    $("correctionActionText").textContent = correction.action || "先确定本阶段只改哪一件事。";
    $("correctionSince").textContent = correction.startDate ? "已持续 " + (daysBetween(correction.startDate, Store.today()) + 1) + " 天" : "未开始";
    $("correctionStatus").textContent = correction.status || "待设置";
    $("correctionStatus").classList.toggle("done", correction.status === "已完成");

    var todayTasks = state.tasks.filter(function (item) { return item.date === Store.today(); });
    var doneTasks = todayTasks.filter(function (item) { return item.completed; });
    var completion = todayTasks.length ? Math.round(doneTasks.length / todayTasks.length * 100) : 0;
    $("metricFocus").textContent = minutesToday();
    $("metricFocusSub").textContent = minutesToday() ? "来自今日任务、学习与冥想" : "今天还没有完成记录";
    $("metricTasks").textContent = doneTasks.length + " / " + todayTasks.length;
    $("metricTasksSub").textContent = "完成度 " + completion + "%";
    $("taskProgress").style.width = completion + "%";
    $("metricRecordDays").textContent = uniqueRecordDates().length;
    var life = getLifeProgress();
    $("metricAge").textContent = life.age;
    $("lifePercent").textContent = life.percent == null ? "--" : Math.round(life.percent) + "%";
    $("lifeRing").style.setProperty("--ring", life.percent == null ? "0%" : life.percent + "%");
    $("lifeStageText").textContent = life.percent == null ? "在设置中填写出生日期" : "按目标年龄平静记录进度";
    $("focusWave").innerHTML = miniWaveSvg();
    renderOverviewPlanSummary();
    renderTimeline();
    renderCalendar();
    renderOverviewGoals();
    renderOverviewFocus();
    renderQuote();
    renderRecent();
    renderOverviewChart();
    updateClock();
  }

  function latestPlanForDate(date) {
    return state.plans.filter(function (item) { return item.date === date; }).sort(function (a, b) { return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")); })[0] || null;
  }
  function renderOverviewPlanSummary() {
    var target = $("overviewPlanSummary");
    if (!target) return;
    var plan = latestPlanForDate(Store.today());
    if (!plan) { target.innerHTML = ""; return; }
    var related = state.tasks.filter(function (task) { return task.planId === plan.id; });
    var completed = related.filter(function (task) { return task.completed; }).length;
    target.innerHTML = '<div class="overview-plan-strip"><div><span class="eyebrow gold">TODAY PLAN · 今日最重要</span><strong>' + esc(plan.mostImportant || "今天的计划已导入") + '</strong><small>' + esc((plan.latestStart ? "最晚 " + plan.latestStart + " 开始" : "") + (plan.minAction ? (plan.latestStart ? " · " : "") + "最低动作：" + plan.minAction : "")) + '</small></div><button class="text-btn" type="button" data-nav="life-plan">' + completed + ' / ' + related.length + ' 已完成 →</button></div>';
  }

  function timelineColor(type) { if (type === "冥想") return "blue"; if (type === "学习") return "gold"; if (type === "产品迭代") return "red"; if (type === "计划") return "green"; return "blue"; }
  function timelineIcon(type) { return type === "冥想" ? "meditation" : type === "学习" ? "book" : type === "产品迭代" ? "product" : type === "计划" ? "check" : "note"; }
  function timelineEditAction(key) { return { tasks: "edit-task", reviews: "edit-review", insights: "edit-insight", iterations: "edit-iteration", learnings: "edit-learning", meditations: "edit-meditation", resources: "edit-resource" }[key] || ""; }
  function renderTimeline() {
    var today = Store.today();
    var items = allRecords().filter(function (item) { return item.date === today; }).sort(function (a, b) { return a.time.localeCompare(b.time); });
    if (!items.length) { $("todayTimeline").innerHTML = emptyState("今天还没有轨迹", "从一条计划、学习或复盘开始。", "add-task", "添加今日任务"); return; }
    $("todayTimeline").innerHTML = items.slice(0, 8).map(function (item) {
      var done = item.key === "tasks" ? !!item.item.completed : true;
      var editAction = timelineEditAction(item.key);
      return '<div class="timeline-item"><time class="timeline-time">' + esc(item.time || "--:--") + '</time><span class="timeline-node ' + timelineColor(item.type) + '">' + icon(timelineIcon(item.type)) + '</span><div class="timeline-copy"><strong>' + esc(item.title) + '</strong><span>' + esc(item.summary || item.type) + '</span></div><div class="timeline-tail"><span class="timeline-state ' + (done ? "done" : "") + '">' + (done ? "✓ 已记录" : "进行中") + '</span>' + (editAction ? '<button class="timeline-edit" type="button" data-action="' + editAction + '" data-id="' + esc(item.id) + '">编辑</button>' : '') + '</div></div>';
    }).join("");
  }

  function datesWithRecords() { return new Set(allRecords().map(function (item) { return item.date; })); }
  function renderCalendar() {
    var year = calendarCursor.getFullYear();
    var month = calendarCursor.getMonth();
    $("calendarLabel").textContent = year + "年" + (month + 1) + "月";
    var first = new Date(year, month, 1);
    var startOffset = (first.getDay() + 6) % 7;
    var start = new Date(year, month, 1 - startOffset);
    var recordDates = datesWithRecords();
    var html = "";
    for (var i = 0; i < 42; i += 1) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      var classes = ["calendar-day-btn"];
      if (d.getMonth() !== month) classes.push("muted");
      if (key === Store.today()) classes.push("today");
      if (key === selectedCalendarDate) classes.push("selected");
      if (recordDates.has(key)) classes.push("has-record");
      html += '<button class="' + classes.join(" ") + '" type="button" data-action="select-calendar-day" data-date="' + key + '">' + d.getDate() + '</button>';
    }
    $("calendarGrid").innerHTML = html;
    renderCalendarDay();
  }
  function renderCalendarDay() {
    var tasks = state.tasks.filter(function (item) { return item.date === selectedCalendarDate; }).sort(function (a, b) { return timeOf(a.time).localeCompare(timeOf(b.time)); });
    var other = allRecords().filter(function (item) { return item.date === selectedCalendarDate && item.key !== "tasks"; });
    var plan = latestPlanForDate(selectedCalendarDate);
    var html = '<div class="calendar-day-head"><span>' + esc(selectedCalendarDate === Store.today() ? "今日计划" : formatDate(selectedCalendarDate)) + '</span><button class="text-btn" type="button" data-action="add-task-selected">＋ 新增</button></div>';
    if (plan) html += '<div class="calendar-plan-focus"><strong>' + esc(plan.mostImportant || "已导入计划") + '</strong>' + (plan.latestStart ? '<span>最晚 ' + esc(plan.latestStart) + ' 开始</span>' : '') + '</div>';
    if (!tasks.length && !other.length && !plan) html += '<div class="calendar-mini-task"><span>这一天还没有记录</span></div>';
    tasks.slice(0, 4).forEach(function (task) { html += '<label class="calendar-mini-task"><input type="checkbox" data-action="toggle-task" data-id="' + esc(task.id) + '"' + (task.completed ? " checked" : "") + '><span>' + esc(task.title) + '</span><time>' + esc(task.time || "") + '</time></label>'; });
    other.slice(0, 2).forEach(function (item) { html += '<div class="calendar-mini-task"><span>' + esc(item.type + " · " + item.title) + '</span></div>'; });
    $("calendarDayPanel").innerHTML = html;
  }

  function renderOverviewGoals() {
    var list = state.goals.filter(function (item) { return item.status !== "已完成"; }).slice(0, 4);
    if (!list.length) { $("overviewGoals").innerHTML = emptyState("还没有核心目标", "添加一个长期目标并持续更新进度。", "add-goal", "新增目标"); return; }
    $("overviewGoals").innerHTML = list.map(function (goal) { var progress = clamp(goal.progress, 0, 100); return '<div class="compact-item"><span class="compact-icon">' + icon("plan") + '</span><div class="compact-copy"><strong>' + esc(goal.title) + '</strong><div class="progress"><i style="width:' + progress + '%"></i></div></div><span class="compact-meta">' + esc(goal.status || "进行中") + '<br>' + progress + '%</span></div>'; }).join("");
  }
  function renderOverviewFocus() {
    var list = state.focusItems.slice().sort(function (a, b) { return number(a.order) - number(b.order); }).slice(0, 5);
    if (!list.length) { $("overviewFocus").innerHTML = emptyState("还没有近期重点", "只保留眼下最重要的3—5件事。", "add-focus", "新增重点"); return; }
    $("overviewFocus").innerHTML = list.map(function (item, index) { return '<div class="rank-item"><span class="rank-num">' + (index + 1) + '</span><div class="rank-copy"><strong>' + esc(item.title) + '</strong><span>' + esc(item.note || item.status || "") + '</span></div><div class="rank-actions"><button type="button" data-action="focus-up" data-id="' + esc(item.id) + '" aria-label="上移">↑</button><button type="button" data-action="focus-down" data-id="' + esc(item.id) + '" aria-label="下移">↓</button><button type="button" data-action="edit-focus" data-id="' + esc(item.id) + '" aria-label="编辑">·</button><button type="button" data-action="delete-focus" data-id="' + esc(item.id) + '" aria-label="删除">×</button></div></div>'; }).join("");
  }
  function renderQuote() { state.quoteIndex = clamp(state.quoteIndex, 0, state.quotes.length - 1); $("dailyQuote").textContent = state.quotes[state.quoteIndex] || "不是看到了希望才坚持，而是坚持了才会看到希望。"; }
  function renderRecent() {
    var items = allRecords().slice(0, 5);
    if (!items.length) { $("recentRecords").innerHTML = emptyState("还没有最近记录", "保存第一条真实记录后，这里会形成轨迹。", "focus-review-input", "开始复盘"); return; }
    $("recentRecords").innerHTML = items.map(function (item) { return '<div class="recent-item"><time>' + esc(shortDate(item.date) + " " + (item.time || "")) + ' · ' + esc(item.type) + '</time><button type="button" data-action="open-record" data-key="' + esc(item.key) + '" data-id="' + esc(item.id) + '">' + esc(item.title) + '</button></div>'; }).join("");
  }

  function dateRange(days) { var result = []; for (var i = days - 1; i >= 0; i -= 1) result.push(addDays(Store.today(), -i)); return result; }
  function chartSeries(days) {
    var dates = dateRange(days);
    return {
      dates: dates,
      records: dates.map(function (date) { return allRecords().filter(function (item) { return item.date === date; }).length; }),
      tasks: dates.map(function (date) { return state.tasks.filter(function (item) { return item.date === date && item.completed; }).length; }),
      learning: dates.map(function (date) { return state.learnings.filter(function (item) { return item.date === date; }).reduce(function (sum, item) { return sum + number(item.duration); }, 0); }),
      meditation: dates.map(function (date) { return state.meditations.filter(function (item) { return item.date === date; }).reduce(function (sum, item) { return sum + number(item.duration); }, 0); })
    };
  }
  function svgLineChart(values, labels, id) {
    var width = 600, height = 190, left = 25, right = 14, top = 16, bottom = 31;
    var max = Math.max.apply(null, values.concat([1]));
    var points = values.map(function (value, index) { var x = left + (width - left - right) * (values.length === 1 ? .5 : index / (values.length - 1)); var y = top + (height - top - bottom) * (1 - value / max); return { x: x, y: y, value: value }; });
    var path = points.map(function (point, index) { return (index ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1); }).join(" ");
    var area = path + " L" + points[points.length - 1].x.toFixed(1) + " " + (height - bottom) + " L" + points[0].x.toFixed(1) + " " + (height - bottom) + " Z";
    var grid = [0, .5, 1].map(function (step) { var y = top + (height - top - bottom) * step; return '<line class="chart-grid-line" x1="' + left + '" x2="' + (width - right) + '" y1="' + y + '" y2="' + y + '"/>'; }).join("");
    var dots = points.map(function (point) { return '<circle class="chart-point" cx="' + point.x + '" cy="' + point.y + '" r="3"/><title>' + point.value + '</title>'; }).join("");
    var xLabels = labels.map(function (label, index) { var x = points[index].x; return '<text class="chart-label" x="' + x + '" y="' + (height - 8) + '" text-anchor="middle">' + esc(label) + '</text>'; }).join("");
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="趋势折线图"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efbd62" stop-opacity=".24"/><stop offset="1" stop-color="#efbd62" stop-opacity="0"/></linearGradient></defs>' + grid + '<path d="' + area + '" fill="url(#' + id + ')"/><path class="chart-line" d="' + path + '"/>' + dots + xLabels + '</svg>';
  }
  function renderOverviewChart() {
    var series = chartSeries(7);
    var labels = series.dates.map(function (date) { return ["日", "一", "二", "三", "四", "五", "六"][toDate(date).getDay()]; });
    $("overviewChart").innerHTML = svgLineChart(series.records, labels, "overviewArea");
    var totals = [
      { label: "记录", value: series.records.reduce(function (a, b) { return a + b; }, 0), unit: "次" },
      { label: "完成任务", value: series.tasks.reduce(function (a, b) { return a + b; }, 0), unit: "个" },
      { label: "学习时长", value: series.learning.reduce(function (a, b) { return a + b; }, 0), unit: "分钟" },
      { label: "冥想时长", value: series.meditation.reduce(function (a, b) { return a + b; }, 0), unit: "分钟" }
    ];
    $("overviewLegend").innerHTML = totals.map(function (item) { return '<span class="legend-item">' + item.label + '<strong>' + item.value + '<small>' + item.unit + '</small></strong></span>'; }).join("");
    $("chartTotal").textContent = "最近7天 " + totals[0].value + " 条记录";
  }

  var reviewFields = [
    { key: "didToday", label: "今天做了什么", aliases: ["今天做了什么", "今日做了什么", "今日完成事项", "今日行动"] },
    { key: "mostImportant", label: "今天最重要的一件事", aliases: ["今天最重要的一件事", "今日最重要的一件事", "最重要的一件事"] },
    { key: "previousGoal", label: "上次整改目标", aliases: ["上次整改目标", "昨日整改目标", "本阶段整改目标"] },
    { key: "currentGoal", label: "当前整改目标", aliases: ["当前整改目标", "正在整改什么"] },
    { key: "executionResult", label: "今日执行结果", aliases: ["昨日整改结果", "上次整改结果", "今日执行结果", "整改执行结果", "今日结果", "执行结果", "整改结果"] },
    { key: "evidence", label: "事实证据", aliases: ["事实证据", "执行证据", "完成证据", "证据"] },
    { key: "newIssue", label: "今日新增问题", aliases: ["今日新增问题", "今日关键问题", "今天最值得纠正的一件事", "今日最值得纠正的一件事", "关键问题", "新增问题"] },
    { key: "dropoutChain", label: "掉线链路", aliases: ["掉线链路", "问题链路", "发生链路", "触发链路"] },
    { key: "nextAction", label: "明日整改动作", aliases: ["明日唯一整改动作", "明天唯一整改动作", "明日整改动作", "明天整改动作", "下一步整改动作", "明日改动", "明天改动", "明日动作", "明天动作"] },
    { key: "acceptance", label: "验收标准", aliases: ["明日验收标准", "验收标准", "完成标准", "验收点"] },
    { key: "note", label: "一句记录", aliases: ["一句记录", "一句话记录", "今日一句", "今日结论", "复盘一句", "今日总结"] }
  ];
  function cleanReviewLine(line) { return String(line || "").replace(/\*\*/g, "").replace(/^\s*>\s?/, "").replace(/^\s*#{1,6}\s*/, "").replace(/^\s*(?:[-+*]\s+|[①-⑳]\s*|[一二三四五六七八九十]+[.、)]\s*|\d+[.、)]\s*)/, "").trim(); }
  function reviewDateFromText(raw) { var match = String(raw || "").match(/(20\d{2})[\-\/.年](\d{1,2})[\-\/.月](\d{1,2})日?/); return match ? match[1] + "-" + String(match[2]).padStart(2, "0") + "-" + String(match[3]).padStart(2, "0") : Store.today(); }
  function parseReview(raw) {
    var result = { date: reviewDateFromText(raw), didToday: "", mostImportant: "", previousGoal: "", currentGoal: "", executionResult: "", evidence: "", newIssue: "", dropoutChain: "", nextAction: "", acceptance: "", note: "", rawText: String(raw || "") };
    var normalized = String(raw || "").replace(/\r/g, "").split("\n").map(cleanReviewLine).join("\n");
    var matches = [];
    reviewFields.forEach(function (field) {
      field.aliases.forEach(function (alias) {
        var from = 0, index;
        while ((index = normalized.indexOf(alias, from)) >= 0) {
          var after = normalized.slice(index + alias.length);
          var colon = after.match(/^\s*[：:]/);
          var lineStart = index === 0 || normalized.charAt(index - 1) === "\n";
          var standalone = lineStart && /^\s*(?:\n|$)/.test(after);
          if ((colon && lineStart) || standalone) matches.push({ key: field.key, index: index, aliasLength: alias.length, valueStart: index + alias.length + (colon ? colon[0].length : 0) });
          from = index + alias.length;
        }
      });
    });
    matches.sort(function (a, b) { return a.index - b.index || b.aliasLength - a.aliasLength; });
    matches = matches.filter(function (item, index, list) { return index === 0 || item.index !== list[index - 1].index; });
    var found = {};
    matches.forEach(function (match, index) {
      if (found[match.key]) return;
      var end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
      result[match.key] = normalized.slice(match.valueStart, end).trim();
      found[match.key] = true;
    });
    return { data: result, count: Object.keys(found).length };
  }
  function reviewFormHtml(review, mode) {
    var item = review || {};
    return '<div class="structured-grid">' +
      valueField("日期", "date", item.date || Store.today(), { type: "date", required: true }) +
      valueField("今日执行结果", "executionResult", item.executionResult || "", { select: ["", "做到", "部分做到", "没做到", "无新增问题"] }) +
      valueField("今天做了什么", "didToday", item.didToday || "", { textarea: true, full: true }) +
      valueField("今天最重要的一件事", "mostImportant", item.mostImportant || "", { textarea: true, full: true }) +
      valueField("上次整改目标", "previousGoal", item.previousGoal || "", { textarea: true }) +
      valueField("当前整改目标（仅随复盘保存，不覆盖首页整改）", "currentGoal", item.currentGoal || "", { textarea: true }) +
      valueField("事实证据", "evidence", item.evidence || "", { textarea: true }) +
      valueField("今日新增问题", "newIssue", item.newIssue || "", { textarea: true }) +
      valueField("掉线链路", "dropoutChain", item.dropoutChain || "", { textarea: true, full: true }) +
      valueField("明日整改动作", "nextAction", item.nextAction || "", { textarea: true, full: true }) +
      valueField("验收标准", "acceptance", item.acceptance || "", { textarea: true }) +
      valueField("一句记录", "note", item.note || "", { textarea: true }) +
      valueField("完整复盘原文", "rawText", item.rawText || "", { textarea: true, full: true }) +
      '</div><div class="form-actions"><button class="btn subtle" type="button" data-action="cancel-review-preview">取消</button><button class="btn primary" type="submit">' + (mode === "edit" ? "保存修改" : "确认保存") + '</button></div>';
  }
  function showReviewPreview(parsed) { $("reviewStructuredForm").innerHTML = reviewFormHtml(parsed, "new"); $("reviewStructuredForm").classList.remove("hidden"); $("reviewStructuredForm").dataset.mode = "new"; $("reviewStructuredForm").dataset.id = ""; }

  function importStatusText(status) {
    if (status === "high") return "已识别";
    if (status === "low") return "低置信度，请确认";
    return "未识别，请确认";
  }
  function referencePlanForReview(date) {
    return latestPlanForDate(date) || latestPlanForDate(addDays(date, -1));
  }
  function addPlanReferenceToReview(parsed) {
    if (!parsed || parsed.type !== "review" || !parsed.data) return parsed;
    var plan = referencePlanForReview(parsed.data.date || Store.today());
    if (!plan) return parsed;
    var tasks = state.tasks.filter(function (task) { return task.planId === plan.id; });
    if (!parsed.data.previousGoal && plan.mostImportant) {
      parsed.data.previousGoal = plan.mostImportant;
      parsed.meta.previousGoal = { status: "low", source: "参考已保存计划的最重要事项" };
    }
    if (!parsed.data.evidence && tasks.length) {
      var done = tasks.filter(function (task) { return task.completed; });
      var undone = tasks.filter(function (task) { return !task.completed; });
      parsed.data.evidence = "计划完成 " + done.length + "/" + tasks.length + " 项。" + (undone.length ? "未完成：" + undone.map(function (task) { return task.title; }).join("、") + "。" : "计划任务已全部完成。");
      parsed.meta.evidence = { status: "low", source: "根据已保存计划的勾选情况生成，请确认" };
    }
    return parsed;
  }
  function importFieldHtml(field, value, meta) {
    var status = meta && meta.status || "missing";
    var source = meta && meta.source || importStatusText(status);
    var className = "import-field status-" + status + (field.raw ? " full raw-field" : "");
    var input;
    if (field.date) input = '<input name="' + esc(field.key) + '" type="date" value="' + esc(value || "") + '">';
    else input = '<textarea name="' + esc(field.key) + '" rows="' + (field.raw ? "8" : "3") + '" placeholder="' + (status === "missing" ? "未识别，请确认或补充" : "") + '">' + esc(value || "") + '</textarea>';
    return '<label class="' + className + '"><span class="import-field-head"><strong>' + esc(field.label) + '</strong><em class="confidence-label">' + esc(importStatusText(status)) + '</em></span>' + input + '<small>' + esc(source) + '</small></label>';
  }
  function renderSmartImportPreview(parsed) {
    if (!parsed || !parsed.type) return;
    parsed = addPlanReferenceToReview(parsed);
    smartImportDraft = parsed;
    var fields = ImportParser.getFields(parsed.type);
    var recognized = fields.filter(function (field) { return !field.raw && parsed.data[field.key]; }).length;
    var missing = fields.filter(function (field) { return !field.raw && !parsed.data[field.key]; }).length;
    $("smartImportFields").innerHTML = fields.map(function (field) { return importFieldHtml(field, parsed.data[field.key], parsed.meta[field.key]); }).join("");
    $("smartPreviewTitle").textContent = parsed.type === "plan" ? "次日计划预览" : "每日复盘预览";
    $("smartPreviewType").textContent = parsed.type === "plan" ? "次日计划" : "每日复盘";
    $("smartPreviewSummary").textContent = "已填入 " + recognized + " 项，" + missing + " 项需要确认。带提示的字段可以直接修改。";
    $("smartImportPreviewForm").dataset.type = parsed.type;
    $("smartImportPasteStep").classList.add("hidden");
    $("smartImportPreviewForm").classList.remove("hidden");
    setTimeout(function () { $("smartImportPreviewForm").scrollIntoView({ behavior: "smooth", block: "start" }); }, 20);
  }
  function identifySmartImport(forcedType) {
    var raw = $("smartImportRaw").value.trim();
    if (!raw) { showToast("请先粘贴复盘或计划原文"); return; }
    var parsed = ImportParser.parse(raw, forcedType || "");
    $("smartImportManualType").classList.add("hidden");
    if (!parsed.type) {
      smartImportDraft = { rawText: raw, scores: parsed.scores };
      $("smartImportStatus").textContent = "已保留原文，但暂时无法可靠判断类型。请选择复盘或计划继续。";
      $("smartImportManualType").classList.remove("hidden");
      showToast("请手动选择记录类型");
      return;
    }
    renderSmartImportPreview(parsed);
  }
  function resetSmartImport(clearRaw) {
    smartImportDraft = null;
    $("smartImportPreviewForm").classList.add("hidden");
    $("smartImportPreviewForm").reset();
    $("smartImportPreviewForm").dataset.type = "";
    $("smartImportFields").innerHTML = "";
    $("smartImportPasteStep").classList.remove("hidden");
    $("smartImportManualType").classList.add("hidden");
    if (clearRaw) $("smartImportRaw").value = "";
    $("smartImportStatus").textContent = clearRaw ? "导入已取消，正式数据没有发生变化。" : "原文仍保留，可修改后重新识别。";
  }
  function cleanTaskTitle(value) {
    return String(value || "").replace(/^\s*(?:[-+*]\s+|[①-⑳]\s*|[一二三四五六七八九十]+[.、)]\s*|\d+[.、)]\s*)/, "").replace(/^\s*\d{1,2}\s*[：:]\s*\d{2}\s*[·｜|：:]?\s*/, "").replace(/[。；;]\s*$/, "").trim();
  }
  function taskLines(value) {
    function keepTime(line) { return String(line || "").replace(/^\s*(?:[-+*]\s+|[①-⑳]\s*|[一二三四五六七八九十]+[.、)]\s*|\d+[.、)]\s*)/, "").trim(); }
    var lines = String(value || "").split(/\n+/).map(keepTime).filter(Boolean);
    if (lines.length === 1 && /[；;]/.test(lines[0])) lines = lines[0].split(/[；;]/).map(keepTime).filter(Boolean);
    return lines;
  }
  function taskTime(value, fallback) {
    var match = String(value || "").match(/(?:^|\s)(\d{1,2})\s*[：:]\s*(\d{2})(?:\s|$)/);
    if (!match) return fallback;
    var hour = Number(match[1]), minute = Number(match[2]);
    if (hour > 23 || minute > 59) return fallback;
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }
  function taskDuration(value) {
    var match = String(value || "").match(/(?:至少|约|大约)?\s*(\d{1,3})\s*分钟/);
    return match ? String(match[1]) : "";
  }
  function planTasks(plan) {
    var groups = [
      { key: "morning", time: "09:00", label: "早上" },
      { key: "afternoon", time: "13:30", label: "下午" },
      { key: "after15", time: "15:00", label: "15:00后" },
      { key: "evening", time: "20:00", label: "晚上" }
    ];
    var tasks = [];
    groups.forEach(function (group) {
      taskLines(plan[group.key]).forEach(function (line) {
        tasks.push({
          id: Store.uid("TASK"), planId: plan.id, period: group.key, title: cleanTaskTitle(line),
          date: plan.date, time: taskTime(line, group.time), category: group.key === "after15" ? "学习" : "计划任务",
          duration: taskDuration(line), priority: "普通", note: "来自智能导入 · " + group.label,
          completed: false, completedAt: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
      });
    });
    return tasks;
  }
  function importMetaFromDraft() {
    var result = { source: "smart-import", parser: "local-rules-v1", confirmedAt: new Date().toISOString(), fields: {} };
    if (smartImportDraft && smartImportDraft.meta) Object.keys(smartImportDraft.meta).forEach(function (key) { result.fields[key] = smartImportDraft.meta[key].status; });
    return result;
  }
  function saveSmartImport(form) {
    var type = form.dataset.type;
    var data = getFormObject(form);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || "")) { showToast("请先确认记录日期"); var dateInput = form.elements.date; if (dateInput) dateInput.focus(); return; }
    var now = new Date().toISOString();
    if (type === "review") {
      var review = Object.assign({}, data, { id: Store.uid("REV"), importMeta: importMetaFromDraft(), createdAt: now, updatedAt: now });
      state.reviews.unshift(review);
      if (save("复盘已确认保存")) { resetSmartImport(true); setPage("daily"); }
      return;
    }
    if (type === "plan") {
      var plan = Object.assign({}, data, { id: Store.uid("PLAN"), taskIds: [], importMeta: importMetaFromDraft(), createdAt: now, updatedAt: now });
      var tasks = planTasks(plan);
      plan.taskIds = tasks.map(function (task) { return task.id; });
      state.plans.unshift(plan);
      state.tasks = tasks.concat(state.tasks);
      if (save("计划已确认保存，共生成 " + tasks.length + " 项任务")) { resetSmartImport(true); setPage("life-plan"); }
    }
  }

  function renderReviews() {
    var query = reviewSearch.trim().toLowerCase();
    function resultCategory(value) {
      var result = String(value || "");
      if (/部分/.test(result)) return "部分做到";
      if (/没做到|未完成|失败|未做到/.test(result)) return "没做到";
      if (/做到|完成|成功/.test(result)) return "做到";
      return result;
    }
    var list = state.reviews.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).filter(function (item) {
      var filterOk = reviewFilter === "全部" || resultCategory(item.executionResult) === reviewFilter;
      var haystack = reviewFields.map(function (field) { return item[field.key] || ""; }).concat([item.date, item.rawText]).join(" ").toLowerCase();
      return filterOk && (!query || haystack.indexOf(query) >= 0);
    });
    if (!list.length) { $("reviewList").innerHTML = emptyState("没有找到复盘", state.reviews.length ? "换个关键词或筛选条件。" : "粘贴一份完整复盘，识别后保存。", "focus-review-input", "新建复盘"); return; }
    $("reviewList").innerHTML = list.map(function (item) {
      var result = item.executionResult || "未标记";
      var resultClass = result.indexOf("部分") >= 0 ? "partial" : result.indexOf("没") >= 0 ? "fail" : result.indexOf("做到") >= 0 ? "success" : "";
      return '<article class="archive-card" data-archive-id="' + esc(item.id) + '"><button class="archive-summary" type="button" data-action="toggle-review" data-id="' + esc(item.id) + '"><time>' + esc(item.date) + '</time><div><h3>' + esc(item.mostImportant || item.note || item.nextAction || "一条复盘") + '</h3><p>' + esc(item.evidence || item.didToday || "还没有事实证据") + '</p></div><span class="result-badge ' + resultClass + '">' + esc(result) + '</span><span class="archive-arrow">⌄</span></button><div class="archive-preview"><div class="preview-grid"><div class="preview-block"><strong>上次整改目标</strong><p>' + esc(text(item.previousGoal)) + '</p></div><div class="preview-block"><strong>事实证据</strong><p>' + esc(text(item.evidence)) + '</p></div><div class="preview-block"><strong>明日整改动作</strong><p>' + esc(text(item.nextAction)) + '</p></div></div><div class="archive-actions"><button class="btn subtle" type="button" data-action="open-review" data-id="' + esc(item.id) + '">查看详情</button><button class="btn subtle" type="button" data-action="edit-review" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-review" data-id="' + esc(item.id) + '">删除</button></div></div></article>';
    }).join("");
  }

  function renderMainline() {
    var main = state.mainline;
    $("mainlineCard").innerHTML = '<div class="mainline-top"><div><span class="eyebrow gold">THE ONE MAINLINE · 唯一长期主线</span><h2>' + esc(main.title || "尚未设置长期主线") + '</h2><p>' + esc(main.reason || "写清为什么选择它，能帮助你在新想法出现时守住方向。") + '</p></div><button class="btn subtle" type="button" data-action="edit-mainline">编辑主线</button></div><div class="mainline-grid"><div class="info-cell"><span>开始日期</span><strong>' + esc(main.startDate || "未设置") + '</strong></div><div class="info-cell"><span>当前阶段</span><strong>' + esc(main.stage || "未设置") + '</strong></div><div class="info-cell"><span>当前最重要能力</span><strong>' + esc(main.coreSkill || "未设置") + '</strong></div><div class="info-cell"><span>暂时不做</span><strong>' + esc(main.notDoing || "未设置") + '</strong></div></div>';
  }
  function renderTasks() {
    var list = state.tasks.filter(function (item) { return item.date === Store.today(); }).sort(function (a, b) { return timeOf(a.time).localeCompare(timeOf(b.time)); });
    var plan = latestPlanForDate(Store.today());
    if (plan) {
      $("todayPlanSummary").innerHTML = '<article class="today-plan-summary"><span class="eyebrow gold">IMPORTED PLAN · ' + esc(formatDate(plan.date)) + '</span><h3>' + esc(plan.mostImportant || "今天最重要的一件事尚未填写") + '</h3><div class="plan-facts">' + (plan.latestStart ? '<span><strong>最晚开始</strong>' + esc(plan.latestStart) + '</span>' : '') + (plan.minAction ? '<span><strong>最低动作</strong>' + esc(plan.minAction) + '</span>' : '') + (plan.acceptance ? '<span><strong>验收标准</strong>' + esc(plan.acceptance) + '</span>' : '') + '</div></article>';
    } else $("todayPlanSummary").innerHTML = "";
    if (!list.length) { $("taskList").innerHTML = emptyState("今天还没有计划", "添加一件真正需要完成的事。", "add-task", "新增今日任务"); return; }
    function taskHtml(item) { return '<div class="task-item ' + (item.completed ? "done" : "") + '"><input type="checkbox" data-action="toggle-task" data-id="' + esc(item.id) + '"' + (item.completed ? " checked" : "") + ' aria-label="标记完成"><time>' + esc(item.time || "--:--") + '</time><div class="task-copy"><strong>' + esc(item.title) + '</strong><span>' + esc((item.category || "普通任务") + " · " + (item.duration ? item.duration + "分钟" : "未设时长") + " · " + (item.priority || "普通")) + '</span></div><div class="inline-actions"><button type="button" data-action="edit-task" data-id="' + esc(item.id) + '" title="编辑">✎</button><button type="button" data-action="delay-task" data-id="' + esc(item.id) + '" title="延期到明天">→</button><button type="button" data-action="delete-task" data-id="' + esc(item.id) + '" title="删除">×</button></div></div>'; }
    var periods = [{ key: "morning", label: "早上" }, { key: "afternoon", label: "下午" }, { key: "after15", label: "15:00之后 / 学习" }, { key: "evening", label: "晚上" }, { key: "other", label: "其他任务" }];
    $("taskList").innerHTML = periods.map(function (period) {
      var group = list.filter(function (item) { return period.key === "other" ? !item.period : item.period === period.key; });
      if (!group.length) return "";
      return '<section class="task-period"><header><strong>' + esc(period.label) + '</strong><span>' + group.filter(function (item) { return item.completed; }).length + '/' + group.length + '</span></header>' + group.map(taskHtml).join("") + '</section>';
    }).join("");
  }
  function renderGoals() {
    var list = state.goals.slice().sort(function (a, b) { return String(b.updatedAt || b.startDate).localeCompare(String(a.updatedAt || a.startDate)); });
    if (!list.length) { $("goalList").innerHTML = emptyState("还没有长期计划", "目标需要能够拆成真实行动。", "add-goal", "新增长期目标"); return; }
    $("goalList").innerHTML = list.map(function (item) { var progress = clamp(item.progress, 0, 100); return '<div class="goal-item"><div class="goal-row"><strong>' + esc(item.title) + '</strong><span>' + esc(item.type || "长期目标") + ' · ' + esc(item.status || "进行中") + '</span></div><div class="progress"><i style="width:' + progress + '%"></i></div><div class="goal-meta"><span>' + esc(item.startDate || "未设开始") + ' → ' + esc(item.endDate || "未设截止") + '</span><span>' + progress + '%</span></div><div class="archive-actions"><button class="btn subtle" type="button" data-action="edit-goal" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-goal" data-id="' + esc(item.id) + '">删除</button></div></div>'; }).join("");
  }

  function renderInsights() {
    var query = insightSearch.trim().toLowerCase();
    var list = state.insights.slice().filter(function (item) { return !query || [item.title, item.observation, item.scene, item.problem, item.job, item.hypothesis, item.conclusion, item.extra].join(" ").toLowerCase().indexOf(query) >= 0; });
    list.sort(function (a, b) { return insightSort === "old" ? String(a.date).localeCompare(String(b.date)) : String(b.date).localeCompare(String(a.date)); });
    if (!list.length) { $("insightList").innerHTML = emptyState("还没有需求洞察", "从一件真实发生的事情开始记录。", "add-insight", "新增洞察"); return; }
    $("insightList").innerHTML = list.map(function (item) { var linked = item.linkedProductId ? findById(state.products, item.linkedProductId) : null; return '<article class="data-card-small"><div class="card-kicker"><span>' + esc(item.sourceType || "需求洞察") + '</span><time>' + esc(item.date) + '</time></div><h3>' + esc(item.title) + '</h3><p>' + esc(item.conclusion || item.problem || item.observation || "尚未形成结论") + '</p><div class="card-bottom"><span class="tag">' + esc(linked ? "关联 · " + linked.name : "待验证") + '</span><button type="button" data-action="open-insight" data-id="' + esc(item.id) + '">查看详情 →</button></div></article>'; }).join("");
  }

  function renderProducts() {
    if (!state.products.length) {
      $("productList").innerHTML = emptyState("还没有产品", "创建第一个产品后记录真实迭代。", "add-product", "新建产品");
      $("productDetail").innerHTML = emptyState("产品时间线为空", "产品必须连接真实问题、反馈和测试。", "add-product", "新建产品");
      return;
    }
    if (!selectedProductId || !findById(state.products, selectedProductId)) selectedProductId = state.products[0].id;
    $("productList").innerHTML = state.products.map(function (product) { return '<button class="product-tab ' + (product.id === selectedProductId ? "active" : "") + '" type="button" data-action="select-product" data-id="' + esc(product.id) + '"><strong>' + esc(product.name) + '</strong><span>' + esc((product.version || "未设版本") + " · " + (product.stage || "未设阶段")) + '</span></button>'; }).join("");
    var product = findById(state.products, selectedProductId);
    var iterations = state.iterations.filter(function (item) { return item.productId === selectedProductId; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var html = '<div class="product-hero"><div class="card-head"><div><span class="eyebrow gold">' + esc(product.version || "PRODUCT") + '</span><h2>' + esc(product.name) + '</h2></div><div class="button-group"><button class="btn subtle" type="button" data-action="edit-product" data-id="' + esc(product.id) + '">编辑产品</button><button class="btn danger" type="button" data-action="delete-product" data-id="' + esc(product.id) + '">删除</button><button class="btn primary" type="button" data-action="add-iteration" data-product-id="' + esc(product.id) + '">记录迭代</button></div></div><p>' + esc(product.positioning || "尚未填写产品定位") + '</p><div class="product-meta-grid"><div class="info-cell"><span>解决问题</span><strong>' + esc(text(product.problem)) + '</strong></div><div class="info-cell"><span>目标用户</span><strong>' + esc(text(product.user)) + '</strong></div><div class="info-cell"><span>当前阶段</span><strong>' + esc(text(product.stage)) + '</strong></div><div class="info-cell"><span>最近更新</span><strong>' + esc(product.updatedAt || product.createdAt || "未记录") + '</strong></div></div></div>';
    if (!iterations.length) html += emptyState("还没有迭代记录", "第一次迭代从真实卡点开始。", "add-iteration", "记录迭代");
    else html += '<div class="iteration-line">' + iterations.map(function (item) { return '<article class="iteration-item"><div class="iteration-top"><strong>' + esc(item.version || "未设版本") + ' · ' + esc(item.change || item.problem || "一次迭代") + '</strong><span>' + esc(item.date) + '</span></div><p>' + esc(item.result || item.feedback || item.reason || "尚未填写测试结果") + '</p><div class="archive-actions"><button class="btn subtle" type="button" data-action="open-iteration" data-id="' + esc(item.id) + '">详情</button><button class="btn subtle" type="button" data-action="edit-iteration" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-iteration" data-id="' + esc(item.id) + '">删除</button></div></article>'; }).join("") + '</div>';
    $("productDetail").innerHTML = html;
  }

  function renderLearning() {
    var todayMinutes = state.learnings.filter(function (item) { return item.date === Store.today(); }).reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var weekDates = new Set(dateRange(7));
    var weekMinutes = state.learnings.filter(function (item) { return weekDates.has(item.date); }).reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var topics = new Set(state.learnings.map(function (item) { return item.topic; }).filter(Boolean));
    var dates = new Set(state.learnings.map(function (item) { return item.date; }));
    $("learningStats").innerHTML = miniStats([{ label: "今日学习", value: todayMinutes, unit: "分钟" }, { label: "本周学习", value: weekMinutes, unit: "分钟" }, { label: "学习主题", value: topics.size, unit: "个" }, { label: "记录天数", value: dates.size, unit: "天" }]);
    renderSimpleArchive("learningList", state.learnings, "learning", "还没有学习记录", "add-learning");
  }
  function renderMeditation() {
    var todayMinutes = state.meditations.filter(function (item) { return item.date === Store.today(); }).reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var weekDates = new Set(dateRange(7));
    var weekMinutes = state.meditations.filter(function (item) { return weekDates.has(item.date); }).reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var dates = new Set(state.meditations.map(function (item) { return item.date; }));
    var average = state.meditations.length ? Math.round(state.meditations.reduce(function (sum, item) { return sum + number(item.duration); }, 0) / state.meditations.length) : 0;
    $("meditationStats").innerHTML = miniStats([{ label: "今日冥想", value: todayMinutes, unit: "分钟" }, { label: "本周冥想", value: weekMinutes, unit: "分钟" }, { label: "累计次数", value: state.meditations.length, unit: "次" }, { label: "平均时长", value: average, unit: "分钟" }]);
    renderSimpleArchive("meditationList", state.meditations, "meditation", "还没有冥想记录", "add-meditation");
  }
  function miniStats(items) { return items.map(function (item) { return '<article class="mini-stat"><span>' + esc(item.label) + '</span><strong>' + item.value + '<small>' + esc(item.unit) + '</small></strong></article>'; }).join(""); }
  function renderSimpleArchive(target, list, kind, emptyTitle, action) {
    var sorted = list.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (!sorted.length) { $(target).innerHTML = emptyState(emptyTitle, "保存第一条真实记录后，统计会自动更新。", action, "新增记录"); return; }
    $(target).innerHTML = sorted.map(function (item) {
      var title = kind === "learning" ? item.topic : (item.reflection || item.thoughts || "一次冥想");
      var summary = kind === "learning" ? (item.learned || item.content) : (item.afterState || item.beforeState);
      return '<article class="archive-card"><div class="archive-summary"><time>' + esc(item.date + " " + (item.time || "")) + '</time><div><h3>' + esc(title) + '</h3><p>' + esc(summary || "尚未填写摘要") + '</p></div><span class="result-badge success">' + number(item.duration) + ' 分钟</span><span class="archive-arrow">›</span></div><div class="archive-preview" style="display:block"><div class="archive-actions"><button class="btn subtle" type="button" data-action="open-' + kind + '" data-id="' + esc(item.id) + '">详情</button><button class="btn subtle" type="button" data-action="edit-' + kind + '" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-' + kind + '" data-id="' + esc(item.id) + '">删除</button></div></div></article>';
    }).join("");
  }

  function renderResources() {
    var query = resourceSearch.trim().toLowerCase();
    var list = state.resources.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).filter(function (item) {
      var filterOk = resourceFilter === "全部" || item.type === resourceFilter;
      var haystack = [item.title, item.type, item.source, item.note, item.keywords].join(" ").toLowerCase();
      return filterOk && (!query || haystack.indexOf(query) >= 0);
    });
    if (!list.length) { $("resourceList").innerHTML = emptyState("没有找到资源", state.resources.length ? "换个关键词或类型。" : "保存真正值得再次使用的材料。", "add-resource", "保存资源"); return; }
    $("resourceList").innerHTML = list.map(function (item) { return '<article class="data-card-small"><div class="card-kicker"><span>' + esc(item.type || "资源") + '</span><time>' + esc(item.date) + '</time></div><h3>' + esc(item.title) + '</h3><p>' + esc(item.note || item.source || "暂无备注") + '</p><div class="card-bottom"><span class="tag">' + esc(item.used ? "已阅读/使用" : "未阅读") + '</span><button type="button" data-action="open-resource" data-id="' + esc(item.id) + '">查看详情 →</button></div></article>'; }).join("");
  }

  function renderDashboard() {
    var totalLearning = state.learnings.reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var totalMeditation = state.meditations.reduce(function (sum, item) { return sum + number(item.duration); }, 0);
    var completedTasks = state.tasks.filter(function (item) { return item.completed; }).length;
    var stats = [
      { label: "总复盘次数", value: state.reviews.length }, { label: "总需求洞察", value: state.insights.length },
      { label: "完成计划", value: completedTasks }, { label: "产品迭代", value: state.iterations.length },
      { label: "学习时长（分钟）", value: totalLearning }, { label: "冥想时长（分钟）", value: totalMeditation },
      { label: "连续记录天数", value: streakCount() }, { label: "累计记录天数", value: uniqueRecordDates().length }
    ];
    $("dashboardStats").innerHTML = stats.map(function (item) { return '<article class="dashboard-stat"><span>' + esc(item.label) + '</span><strong>' + item.value + '</strong></article>'; }).join("");
    var series = chartSeries(dashboardRange);
    var labels = series.dates.map(function (date, index) { return dashboardRange === 7 ? ["日", "一", "二", "三", "四", "五", "六"][toDate(date).getDay()] : (index % 5 === 0 || index === series.dates.length - 1 ? shortDate(date) : ""); });
    $("dashboardChart").innerHTML = svgLineChart(series.records, labels, "dashboardArea");
    var composition = [{ name: "复盘", value: state.reviews.length }, { name: "需求洞察", value: state.insights.length }, { name: "产品迭代", value: state.iterations.length }, { name: "学习记录", value: state.learnings.length }, { name: "冥想反思", value: state.meditations.length }, { name: "资源", value: state.resources.length }];
    var max = Math.max.apply(null, composition.map(function (item) { return item.value; }).concat([1]));
    $("compositionChart").innerHTML = '<div class="composition-list">' + composition.map(function (item) { return '<div class="composition-item"><span>' + item.name + '</span><div class="progress"><i style="width:' + (item.value / max * 100) + '%"></i></div><strong>' + item.value + '</strong></div>'; }).join("") + '</div>';
  }

  function renderSettings() {
    var form = $("profileForm");
    form.elements.name.value = state.settings.name || "";
    form.elements.birthDate.value = state.settings.birthDate || "";
    form.elements.targetAge.value = state.settings.targetAge || 80;
    form.elements.greeting.value = state.settings.greeting || "";
    form.elements.theme.value = state.settings.theme || "dark";
    var bytes = new Blob([JSON.stringify(state)]).size;
    $("storageSummary").textContent = "当前 V2 数据约 " + Math.max(1, Math.round(bytes / 1024)) + " KB，共 " + allRecords().length + " 条可统计记录。";
  }

  function renderPage(page) {
    if (page === "overview") renderOverview();
    else if (page === "daily") renderReviews();
    else if (page === "life-plan") { renderMainline(); renderTasks(); renderGoals(); }
    else if (page === "insights") renderInsights();
    else if (page === "products") renderProducts();
    else if (page === "learning") renderLearning();
    else if (page === "meditation") renderMeditation();
    else if (page === "resources") renderResources();
    else if (page === "dashboard") renderDashboard();
    else if (page === "settings") renderSettings();
  }
  function renderAll() { document.body.classList.toggle("theme-midnight", state.settings.theme === "midnight"); renderNav(); renderOverview(); renderReviews(); renderMainline(); renderTasks(); renderGoals(); renderInsights(); renderProducts(); renderLearning(); renderMeditation(); renderResources(); renderDashboard(); renderSettings(); }

  function modalButtons(label, dangerId) {
    return '<div class="form-actions">' + (dangerId ? '<button class="btn danger" type="button" data-action="' + esc(dangerId) + '">删除</button>' : '') + '<button class="btn subtle" type="button" data-action="close-modal">取消</button><button class="btn primary" type="submit">' + esc(label || "保存") + '</button></div>';
  }
  function detailHtml(title, subtitle, sections, actions) {
    return '<div class="detail-title"><span class="eyebrow gold">ARCHIVE RECORD</span><h2>' + esc(title) + '</h2><p>' + esc(subtitle || "") + '</p></div>' + sections.filter(function (item) { return item.value != null && String(item.value).trim(); }).map(function (item) { return '<section class="detail-section"><h3>' + esc(item.label) + '</h3><p>' + esc(item.value) + '</p></section>'; }).join("") + (actions ? '<div class="detail-actions">' + actions + '</div>' : '');
  }
  function upsert(listKey, item) {
    var index = state[listKey].findIndex(function (entry) { return entry.id === item.id; });
    if (index >= 0) state[listKey][index] = item; else state[listKey].unshift(item);
  }
  function confirmDelete(label) { return window.confirm("确定删除这条" + label + "吗？删除后无法撤销。"); }

  function openCorrectionForm() {
    var item = state.correction || {};
    var html = '<div class="form-grid">' +
      valueField("当前整改目标", "goal", item.goal, { textarea: true, full: true, required: true }) +
      valueField("本阶段具体动作", "action", item.action, { textarea: true, full: true }) +
      valueField("开始日期", "startDate", item.startDate || Store.today(), { type: "date", required: true }) +
      valueField("状态", "status", item.status || "进行中", { select: ["待设置", "进行中", "已完成"] }) +
      '</div>' + modalButtons("保存整改");
    openModal("当前整改", "CURRENT CORRECTION", html, function (data) {
      state.correction = Object.assign({}, state.correction, data, { completedAt: data.status === "已完成" ? (state.correction.completedAt || new Date().toISOString()) : "" });
      save("整改目标已更新"); closeModal();
    });
  }
  function completeCorrection() {
    if (!state.correction.goal) { openCorrectionForm(); return; }
    if (!window.confirm("确定完成本轮整改？记录会保留，但首页状态将改为已完成。")) return;
    state.correction.status = "已完成";
    state.correction.completedAt = new Date().toISOString();
    save("本轮整改已完成");
  }
  function openMainlineForm() {
    var item = state.mainline || {};
    var html = '<div class="form-grid">' +
      valueField("唯一长期主线", "title", item.title, { full: true, required: true }) +
      valueField("为什么选择它", "reason", item.reason, { textarea: true, full: true }) +
      valueField("开始日期", "startDate", item.startDate || Store.today(), { type: "date" }) +
      valueField("当前阶段", "stage", item.stage) +
      valueField("当前最重要能力", "coreSkill", item.coreSkill, { textarea: true }) +
      valueField("本阶段暂时不做", "notDoing", item.notDoing, { textarea: true }) +
      '</div>' + modalButtons("保存主线");
    openModal("唯一长期主线", "THE ONE MAINLINE", html, function (data) { state.mainline = Object.assign({}, state.mainline, data); save("长期主线已保存"); closeModal(); });
  }

  function openTaskForm(id, presetDate) {
    var old = id ? findById(state.tasks, id) : null;
    var item = old || { date: presetDate || Store.today(), time: "09:00", category: "核心任务", priority: "重要", duration: "30", title: "", note: "", completed: false };
    var html = '<div class="form-grid">' +
      valueField("任务名称", "title", item.title, { full: true, required: true }) +
      valueField("日期", "date", item.date || presetDate || Store.today(), { type: "date", required: true }) +
      valueField("时间", "time", item.time || "09:00", { type: "time" }) +
      valueField("分类", "category", item.category, { select: ["核心任务", "学习", "产品", "副业验证", "阅读", "生活", "其他"] }) +
      valueField("预计时长（分钟）", "duration", item.duration, { type: "number", min: 0, max: 1440 }) +
      valueField("优先级", "priority", item.priority, { select: ["重要", "普通", "可延后"] }) +
      valueField("备注", "note", item.note, { textarea: true, full: true }) +
      '</div>' + modalButtons(id ? "保存修改" : "创建任务");
    openModal(id ? "编辑任务" : "新增任务", "TODAY PLAN", html, function (data) {
      upsert("tasks", Object.assign({}, item, data, { id: item.id || Store.uid("TASK"), duration: number(data.duration), completed: !!item.completed, createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }));
      save(id ? "任务已修改" : "任务已创建"); closeModal();
    });
  }
  function toggleTask(id, checked) { var item = findById(state.tasks, id); if (!item) return; item.completed = !!checked; item.completedAt = item.completed ? new Date().toISOString() : ""; item.updatedAt = new Date().toISOString(); save(item.completed ? "任务已完成" : "任务已恢复"); }
  function delayTask(id) { var item = findById(state.tasks, id); if (!item) return; item.date = addDays(item.date || Store.today(), 1); item.completed = false; item.completedAt = ""; item.updatedAt = new Date().toISOString(); save("任务已延期一天"); }

  function openGoalForm(id) {
    var old = id ? findById(state.goals, id) : null;
    var item = old || { title: "", type: "能力", startDate: Store.today(), endDate: "", status: "进行中", progress: 0, nextAction: "" };
    var html = '<div class="form-grid">' +
      valueField("目标名称", "title", item.title, { full: true, required: true }) +
      valueField("目标类型", "type", item.type, { select: ["能力", "产品", "收入", "健康", "关系", "生活", "其他"] }) +
      valueField("开始日期", "startDate", item.startDate, { type: "date" }) +
      valueField("目标日期", "endDate", item.endDate, { type: "date" }) +
      valueField("状态", "status", item.status, { select: ["进行中", "暂停", "已完成"] }) +
      valueField("完成进度（0—100）", "progress", item.progress, { type: "number", min: 0, max: 100 }) +
      valueField("下一步行动", "nextAction", item.nextAction, { textarea: true, full: true }) +
      '</div>' + modalButtons(id ? "保存修改" : "创建目标");
    openModal(id ? "编辑长期目标" : "新增长期目标", "LONG-TERM GOAL", html, function (data) {
      upsert("goals", Object.assign({}, item, data, { id: item.id || Store.uid("GOAL"), progress: clamp(data.progress, 0, 100), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }));
      save(id ? "目标已修改" : "目标已创建"); closeModal();
    });
  }
  function openFocusForm(id) {
    var old = id ? findById(state.focusItems, id) : null;
    var item = old || { title: "", note: "", status: "进行中", order: state.focusItems.length + 1 };
    var html = '<div class="form-grid">' + valueField("近期重点", "title", item.title, { full: true, required: true }) + valueField("备注", "note", item.note, { textarea: true, full: true }) + valueField("状态", "status", item.status, { select: ["进行中", "等待", "已完成"] }) + '</div>' + modalButtons(id ? "保存修改" : "新增重点");
    openModal(id ? "编辑近期重点" : "新增近期重点", "RECENT FOCUS", html, function (data) { upsert("focusItems", Object.assign({}, item, data, { id: item.id || Store.uid("FOCUS"), order: number(item.order) || state.focusItems.length + 1, updatedAt: new Date().toISOString() })); save("近期重点已保存"); closeModal(); });
  }
  function moveFocus(id, amount) {
    var sorted = state.focusItems.slice().sort(function (a, b) { return number(a.order) - number(b.order); });
    var index = sorted.findIndex(function (item) { return item.id === id; });
    var next = index + amount;
    if (index < 0 || next < 0 || next >= sorted.length) return;
    var swap = sorted[index].order; sorted[index].order = sorted[next].order; sorted[next].order = swap;
    if (sorted[index].order === sorted[next].order) { sorted[index].order = next + 1; sorted[next].order = index + 1; }
    save("重点顺序已调整");
  }
  function openQuotesForm() {
    var html = '<div class="form-grid">' + valueField("每日语录（每行一条）", "quotes", state.quotes.join("\n"), { textarea: true, full: true, required: true }) + '</div>' + modalButtons("保存语录");
    openModal("每日语录", "DAILY QUOTES", html, function (data) { var quotes = data.quotes.split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean); if (!quotes.length) { showToast("请至少保留一条语录"); return; } state.quotes = quotes; state.quoteIndex = clamp(state.quoteIndex, 0, quotes.length - 1); save("语录已保存"); closeModal(); });
  }

  function saveReviewForm(form, id) {
    var data = getFormObject(form);
    var old = id ? findById(state.reviews, id) : null;
    var item = Object.assign({}, old || {}, data, { id: id || Store.uid("REV"), createdAt: old ? old.createdAt : new Date().toISOString(), updatedAt: new Date().toISOString() });
    upsert("reviews", item);
    save(id ? "复盘已修改" : "复盘已保存");
    if (form === $("reviewStructuredForm")) { form.classList.add("hidden"); form.innerHTML = ""; form.dataset.id = ""; form.dataset.mode = ""; $("reviewRawInput").value = ""; $("reviewParseStatus").textContent = "支持 V1 标题与 V2 新字段。"; }
    else closeModal();
  }
  function openReviewDetail(id) {
    var item = findById(state.reviews, id); if (!item) return;
    var sections = reviewFields.map(function (field) { return { label: field.label, value: item[field.key] }; });
    sections.push({ label: "完整复盘原文", value: item.rawText });
    openDrawer(item.mostImportant || item.note || "复盘记录", "DAILY REVIEW · " + item.date, detailHtml(item.mostImportant || "一条复盘", formatDate(item.date) + " · " + (item.executionResult || "未标记执行结果"), sections, '<button class="btn subtle" type="button" data-action="edit-review" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-review" data-id="' + esc(item.id) + '">删除</button>'));
  }
  function openReviewEdit(id) {
    var item = findById(state.reviews, id); if (!item) return;
    openModal("编辑复盘", "DAILY REVIEW", reviewFormHtml(item, "edit"), function (data) { var old = findById(state.reviews, id); upsert("reviews", Object.assign({}, old, data, { id: id, updatedAt: new Date().toISOString() })); save("复盘已修改"); closeModal(); closeDrawer(); });
  }

  function productOptions(selected, allowBlank) {
    var options = allowBlank ? [{ value: "", label: "不关联产品" }] : [];
    state.products.forEach(function (product) { options.push({ value: product.id, label: product.name }); });
    return options;
  }
  function openInsightForm(id) {
    var old = id ? findById(state.insights, id) : null;
    var item = old || { date: Store.today(), title: "", sourceType: "现实观察", observation: "", scene: "", problem: "", job: "", alternative: "", alternativeProblem: "", hypothesis: "", toValidate: "", nextAction: "", conclusion: "", extra: "", linkedProductId: "" };
    var html = '<div class="form-grid">' +
      valueField("标题", "title", item.title, { full: true, required: true }) + valueField("日期", "date", item.date, { type: "date", required: true }) + valueField("来源类型", "sourceType", item.sourceType, { select: ["现实观察", "用户访谈", "购买体验", "平台数据", "个人经历", "旧版记录", "其他"] }) +
      valueField("观察到的事实", "observation", item.observation, { textarea: true, full: true }) + valueField("发生场景", "scene", item.scene, { textarea: true }) + valueField("真实问题", "problem", item.problem, { textarea: true }) +
      valueField("用户要完成的任务", "job", item.job, { textarea: true }) + valueField("原有替代方案", "alternative", item.alternative, { textarea: true }) + valueField("替代方案的问题", "alternativeProblem", item.alternativeProblem, { textarea: true }) +
      valueField("当前假设", "hypothesis", item.hypothesis, { textarea: true }) + valueField("还要验证什么", "toValidate", item.toValidate, { textarea: true }) + valueField("下一步行动", "nextAction", item.nextAction, { textarea: true }) +
      valueField("当前结论", "conclusion", item.conclusion, { textarea: true, full: true }) + valueField("补充信息", "extra", item.extra, { textarea: true, full: true }) + valueField("关联产品", "linkedProductId", item.linkedProductId, { select: productOptions(item.linkedProductId, true) }) +
      '</div>' + modalButtons(id ? "保存修改" : "保存洞察");
    openModal(id ? "编辑需求洞察" : "新增需求洞察", "DEMAND INSIGHT", html, function (data) { upsert("insights", Object.assign({}, item, data, { id: item.id || Store.uid("INS"), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() })); save(id ? "洞察已修改" : "洞察已保存"); closeModal(); closeDrawer(); });
  }
  function openInsightDetail(id) {
    var item = findById(state.insights, id); if (!item) return;
    var linked = item.linkedProductId ? findById(state.products, item.linkedProductId) : null;
    var sections = [
      { label: "观察到的事实", value: item.observation }, { label: "发生场景", value: item.scene }, { label: "真实问题", value: item.problem }, { label: "用户要完成的任务", value: item.job },
      { label: "原有替代方案", value: item.alternative }, { label: "替代方案的问题", value: item.alternativeProblem }, { label: "当前假设", value: item.hypothesis }, { label: "还要验证什么", value: item.toValidate },
      { label: "下一步行动", value: item.nextAction }, { label: "当前结论", value: item.conclusion }, { label: "关联产品", value: linked ? linked.name : "" }, { label: "补充信息", value: item.extra }
    ];
    openDrawer(item.title, "DEMAND INSIGHT · " + item.date, detailHtml(item.title, item.sourceType + " · " + formatDate(item.date), sections, '<button class="btn subtle" type="button" data-action="edit-insight" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-insight" data-id="' + esc(item.id) + '">删除</button>'));
  }

  function openProductForm(id) {
    var old = id ? findById(state.products, id) : null;
    var item = old || { name: "", version: "V0.1", positioning: "", problem: "", user: "", stage: "想法验证" };
    var html = '<div class="form-grid">' + valueField("产品名称", "name", item.name, { full: true, required: true }) + valueField("当前版本", "version", item.version) + valueField("当前阶段", "stage", item.stage, { select: ["想法验证", "最小版本", "使用测试", "持续迭代", "暂停", "归档"] }) + valueField("一句话定位", "positioning", item.positioning, { textarea: true, full: true }) + valueField("解决什么问题", "problem", item.problem, { textarea: true }) + valueField("目标用户", "user", item.user, { textarea: true }) + '</div>' + modalButtons(id ? "保存修改" : "创建产品");
    openModal(id ? "编辑产品" : "新建产品", "PRODUCT", html, function (data) { var saved = Object.assign({}, item, data, { id: item.id || Store.uid("PROD"), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }); upsert("products", saved); selectedProductId = saved.id; save(id ? "产品已修改" : "产品已创建"); closeModal(); });
  }
  function openIterationForm(id, productId) {
    var old = id ? findById(state.iterations, id) : null;
    var chosen = productId || selectedProductId || (state.products[0] && state.products[0].id) || "";
    if (!old && !state.products.length) { showToast("请先创建一个产品"); openProductForm(); return; }
    var item = old || { productId: chosen, date: Store.today(), version: "", problem: "", reason: "", change: "", feedback: "", result: "" };
    var html = '<div class="form-grid">' + valueField("关联产品", "productId", item.productId, { select: productOptions(item.productId, false), required: true }) + valueField("迭代日期", "date", item.date, { type: "date", required: true }) + valueField("版本号", "version", item.version) + valueField("遇到的真实卡点", "problem", item.problem, { textarea: true, full: true }) + valueField("为什么修改", "reason", item.reason, { textarea: true }) + valueField("具体改了什么", "change", item.change, { textarea: true }) + valueField("用户或使用反馈", "feedback", item.feedback, { textarea: true }) + valueField("测试结果与下一步", "result", item.result, { textarea: true, full: true }) + '</div>' + modalButtons(id ? "保存修改" : "保存迭代");
    openModal(id ? "编辑迭代" : "记录产品迭代", "PRODUCT ITERATION", html, function (data) { upsert("iterations", Object.assign({}, item, data, { id: item.id || Store.uid("ITER"), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() })); var product = findById(state.products, data.productId); if (product) { product.version = data.version || product.version; product.updatedAt = new Date().toISOString(); selectedProductId = product.id; } save(id ? "迭代已修改" : "迭代已记录"); closeModal(); closeDrawer(); });
  }
  function openIterationDetail(id) {
    var item = findById(state.iterations, id); if (!item) return; var product = findById(state.products, item.productId);
    openDrawer(item.change || item.problem || "产品迭代", "PRODUCT ITERATION · " + item.date, detailHtml((item.version ? item.version + " · " : "") + (item.change || "一次迭代"), (product ? product.name + " · " : "") + formatDate(item.date), [{ label: "真实卡点", value: item.problem }, { label: "修改原因", value: item.reason }, { label: "具体改动", value: item.change }, { label: "用户反馈", value: item.feedback }, { label: "测试结果与下一步", value: item.result }], '<button class="btn subtle" type="button" data-action="edit-iteration" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-iteration" data-id="' + esc(item.id) + '">删除</button>'));
  }

  function openLearningForm(id) {
    var old = id ? findById(state.learnings, id) : null;
    var item = old || { date: Store.today(), time: "20:00", topic: "", duration: 30, content: "", learned: "", practice: "" };
    var html = '<div class="form-grid">' + valueField("学习主题", "topic", item.topic, { full: true, required: true }) + valueField("日期", "date", item.date, { type: "date", required: true }) + valueField("时间", "time", item.time, { type: "time" }) + valueField("学习时长（分钟）", "duration", item.duration, { type: "number", min: 0, max: 1440 }) + valueField("学习内容", "content", item.content, { textarea: true, full: true }) + valueField("真正学会了什么", "learned", item.learned, { textarea: true }) + valueField("怎样回到实践", "practice", item.practice, { textarea: true }) + '</div>' + modalButtons(id ? "保存修改" : "保存学习");
    openModal(id ? "编辑学习记录" : "记录学习", "LEARNING GROWTH", html, function (data) { upsert("learnings", Object.assign({}, item, data, { id: item.id || Store.uid("LEARN"), duration: number(data.duration), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() })); save("学习记录已保存"); closeModal(); closeDrawer(); });
  }
  function openLearningDetail(id) { var item = findById(state.learnings, id); if (!item) return; openDrawer(item.topic, "LEARNING · " + item.date, detailHtml(item.topic, formatDate(item.date) + " · " + number(item.duration) + " 分钟", [{ label: "学习内容", value: item.content }, { label: "真正学会了什么", value: item.learned }, { label: "怎样回到实践", value: item.practice }], '<button class="btn subtle" type="button" data-action="edit-learning" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-learning" data-id="' + esc(item.id) + '">删除</button>')); }
  function openMeditationForm(id) {
    var old = id ? findById(state.meditations, id) : null;
    var item = old || { date: Store.today(), time: "21:00", duration: 10, beforeState: "", afterState: "", thoughts: "", reflection: "" };
    var html = '<div class="form-grid">' + valueField("日期", "date", item.date, { type: "date", required: true }) + valueField("时间", "time", item.time, { type: "time" }) + valueField("时长（分钟）", "duration", item.duration, { type: "number", min: 0, max: 1440 }) + valueField("开始前状态", "beforeState", item.beforeState, { textarea: true }) + valueField("结束后状态", "afterState", item.afterState, { textarea: true }) + valueField("期间出现的想法", "thoughts", item.thoughts, { textarea: true, full: true }) + valueField("这次反思", "reflection", item.reflection, { textarea: true, full: true }) + '</div>' + modalButtons(id ? "保存修改" : "保存记录");
    openModal(id ? "编辑冥想记录" : "记录冥想与反思", "MEDITATION & REFLECTION", html, function (data) { upsert("meditations", Object.assign({}, item, data, { id: item.id || Store.uid("MEDIT"), duration: number(data.duration), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() })); save("冥想记录已保存"); closeModal(); closeDrawer(); });
  }
  function openMeditationDetail(id) { var item = findById(state.meditations, id); if (!item) return; openDrawer(item.reflection || "冥想与反思", "MEDITATION · " + item.date, detailHtml(item.reflection || "一次冥想", formatDate(item.date) + " · " + number(item.duration) + " 分钟", [{ label: "开始前状态", value: item.beforeState }, { label: "结束后状态", value: item.afterState }, { label: "期间出现的想法", value: item.thoughts }, { label: "这次反思", value: item.reflection }], '<button class="btn subtle" type="button" data-action="edit-meditation" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-meditation" data-id="' + esc(item.id) + '">删除</button>')); }
  function openResourceForm(id) {
    var old = id ? findById(state.resources, id) : null;
    var item = old || { date: Store.today(), title: "", type: "文章", source: "", link: "", keywords: "", note: "", used: false };
    var html = '<div class="form-grid">' + valueField("资源标题", "title", item.title, { full: true, required: true }) + valueField("日期", "date", item.date, { type: "date", required: true }) + valueField("类型", "type", item.type, { select: ["书籍", "文章", "编程知识", "产品案例", "重要句子", "以后再看", "其他"] }) + valueField("来源", "source", item.source) + valueField("链接（可选）", "link", item.link, { type: "url", full: true }) + valueField("关键词", "keywords", item.keywords, { full: true }) + valueField("为什么值得保存", "note", item.note, { textarea: true, full: true }) + valueField("使用状态", "usedText", item.used ? "已阅读/使用" : "未阅读", { select: ["未阅读", "已阅读/使用"] }) + '</div>' + modalButtons(id ? "保存修改" : "保存资源");
    openModal(id ? "编辑资源" : "保存资源", "RESOURCE LIBRARY", html, function (data) { upsert("resources", Object.assign({}, item, data, { id: item.id || Store.uid("RES"), used: data.usedText === "已阅读/使用", createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() })); save("资源已保存"); closeModal(); closeDrawer(); });
  }
  function openResourceDetail(id) { var item = findById(state.resources, id); if (!item) return; openDrawer(item.title, "RESOURCE · " + item.type, detailHtml(item.title, formatDate(item.date) + " · " + (item.used ? "已阅读/使用" : "未阅读"), [{ label: "来源", value: item.source }, { label: "链接", value: item.link }, { label: "关键词", value: item.keywords }, { label: "保存理由与笔记", value: item.note }], '<button class="btn subtle" type="button" data-action="edit-resource" data-id="' + esc(item.id) + '">编辑</button><button class="btn danger" type="button" data-action="delete-resource" data-id="' + esc(item.id) + '">删除</button>')); }

  function openGenericRecord(key, id) {
    if (key === "reviews") return openReviewDetail(id);
    if (key === "insights") return openInsightDetail(id);
    if (key === "iterations") return openIterationDetail(id);
    if (key === "learnings") return openLearningDetail(id);
    if (key === "meditations") return openMeditationDetail(id);
    if (key === "resources") return openResourceDetail(id);
    if (key === "tasks") { var task = findById(state.tasks, id); if (task) openDrawer(task.title, "PLAN · " + task.date, detailHtml(task.title, formatDate(task.date) + " " + (task.time || "") + " · " + (task.completed ? "已完成" : "待完成"), [{ label: "分类", value: task.category }, { label: "预计时长", value: task.duration ? task.duration + " 分钟" : "" }, { label: "优先级", value: task.priority }, { label: "备注", value: task.note }], '<button class="btn subtle" type="button" data-action="edit-task" data-id="' + esc(task.id) + '">编辑</button>')); }
  }
  function deleteRecord(key, id, label) { if (!confirmDelete(label)) return; state[key] = removeById(state[key], id); if (key === "products") { state.iterations = state.iterations.filter(function (item) { return item.productId !== id; }); state.insights.forEach(function (item) { if (item.linkedProductId === id) item.linkedProductId = ""; }); selectedProductId = state.products[0] ? state.products[0].id : ""; } save(label + "已删除"); closeModal(); closeDrawer(); }

  function handleAction(action, element) {
    var id = element.dataset.id || "";
    if (action === "toggle-menu") { $("appShell").classList.toggle("menu-open"); $("overlay").classList.toggle("open"); }
    else if (action === "close-mobile-menu") { $("appShell").classList.remove("menu-open"); $("overlay").classList.remove("open"); }
    else if (action === "close-modal") closeModal();
    else if (action === "close-drawer") closeDrawer();
    else if (action === "edit-correction") openCorrectionForm();
    else if (action === "complete-correction") completeCorrection();
    else if (action === "edit-mainline") openMainlineForm();
    else if (action === "add-task") openTaskForm();
    else if (action === "add-task-selected") openTaskForm("", selectedCalendarDate);
    else if (action === "edit-task") openTaskForm(id);
    else if (action === "delay-task") delayTask(id);
    else if (action === "delete-task") deleteRecord("tasks", id, "任务");
    else if (action === "add-goal") openGoalForm();
    else if (action === "edit-goal") openGoalForm(id);
    else if (action === "delete-goal") deleteRecord("goals", id, "目标");
    else if (action === "add-focus") openFocusForm();
    else if (action === "edit-focus") openFocusForm(id);
    else if (action === "delete-focus") deleteRecord("focusItems", id, "近期重点");
    else if (action === "focus-up") moveFocus(id, -1);
    else if (action === "focus-down") moveFocus(id, 1);
    else if (action === "edit-quotes") openQuotesForm();
    else if (action === "prev-quote" || action === "next-quote") { var delta = action === "next-quote" ? 1 : -1; state.quoteIndex = (state.quoteIndex + delta + state.quotes.length) % state.quotes.length; state = Store.save(state); renderQuote(); }
    else if (action === "calendar-prev" || action === "calendar-next") { calendarCursor.setMonth(calendarCursor.getMonth() + (action === "calendar-next" ? 1 : -1)); renderCalendar(); }
    else if (action === "select-calendar-day") { selectedCalendarDate = element.dataset.date; var d = toDate(selectedCalendarDate); calendarCursor = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendar(); }
    else if (action === "focus-review-input") { setPage("daily"); setTimeout(function () { $("reviewRawInput").focus(); $("reviewRawInput").scrollIntoView({ behavior: "smooth", block: "center" }); }, 60); }
    else if (action === "identify-review") { var raw = $("reviewRawInput").value.trim(); if (!raw) { showToast("请先粘贴完整复盘"); return; } var parsed = addPlanReferenceToReview(ImportParser.parse(raw, "review")); showReviewPreview(parsed.data); $("reviewParseStatus").textContent = "已识别 " + parsed.count + " 项，请检查预览后保存。"; if (parsed.count < 2) showToast("识别字段较少，请在预览中补充"); }
    else if (action === "cancel-review-preview") { $("reviewStructuredForm").classList.add("hidden"); $("reviewStructuredForm").innerHTML = ""; $("reviewParseStatus").textContent = "已取消预览，原文仍保留。"; }
    else if (action === "identify-smart-import") identifySmartImport();
    else if (action === "force-import-type") identifySmartImport(element.dataset.type);
    else if (action === "back-smart-import") resetSmartImport(false);
    else if (action === "cancel-smart-import") resetSmartImport(true);
    else if (action === "toggle-review") { var card = element.closest(".archive-card"); if (card) card.classList.toggle("open"); }
    else if (action === "open-review") openReviewDetail(id);
    else if (action === "edit-review") openReviewEdit(id);
    else if (action === "delete-review") deleteRecord("reviews", id, "复盘");
    else if (action === "add-insight") openInsightForm();
    else if (action === "open-insight") openInsightDetail(id);
    else if (action === "edit-insight") openInsightForm(id);
    else if (action === "delete-insight") deleteRecord("insights", id, "需求洞察");
    else if (action === "add-product") openProductForm();
    else if (action === "edit-product") openProductForm(id);
    else if (action === "delete-product") deleteRecord("products", id, "产品及其迭代");
    else if (action === "select-product") { selectedProductId = id; renderProducts(); }
    else if (action === "add-iteration") openIterationForm("", element.dataset.productId || selectedProductId);
    else if (action === "open-iteration") openIterationDetail(id);
    else if (action === "edit-iteration") openIterationForm(id);
    else if (action === "delete-iteration") deleteRecord("iterations", id, "产品迭代");
    else if (action === "add-learning") openLearningForm();
    else if (action === "open-learning") openLearningDetail(id);
    else if (action === "edit-learning") openLearningForm(id);
    else if (action === "delete-learning") deleteRecord("learnings", id, "学习记录");
    else if (action === "add-meditation") openMeditationForm();
    else if (action === "open-meditation") openMeditationDetail(id);
    else if (action === "edit-meditation") openMeditationForm(id);
    else if (action === "delete-meditation") deleteRecord("meditations", id, "冥想记录");
    else if (action === "add-resource") openResourceForm();
    else if (action === "open-resource") openResourceDetail(id);
    else if (action === "edit-resource") openResourceForm(id);
    else if (action === "delete-resource") deleteRecord("resources", id, "资源");
    else if (action === "open-record") openGenericRecord(element.dataset.key, id);
    else if (action === "export-all") { var payload = Store.exportPayload(state); download("筑台者-V2-备份-" + Store.today() + ".json", JSON.stringify(payload, null, 2)); showToast("备份已导出"); }
    else if (action === "import-all") $("importFile").click();
    else if (action === "clear-all") { if (!window.confirm("第一次确认：确定清空筑台者 V2 的全部数据吗？旧版 V1 数据不会被删除。")) return; if (!window.confirm("第二次确认：系统会先自动备份当前 V2 数据，是否继续？")) return; try { state = Store.clearV2(); selectedProductId = ""; renderAll(); showToast("V2 数据已备份并清空"); } catch (error) { showToast("清空失败，原数据保持不变：" + error.message); } }
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var nav = event.target.closest("[data-nav]"); if (nav) { setPage(nav.dataset.nav); return; }
      var actionNode = event.target.closest("[data-action]"); if (actionNode) { if (actionNode.tagName === "A") event.preventDefault(); handleAction(actionNode.dataset.action, actionNode); }
    });
    document.addEventListener("change", function (event) {
      if (event.target.matches('[data-action="toggle-task"]')) toggleTask(event.target.dataset.id, event.target.checked);
      else if (event.target.id === "insightSort") { insightSort = event.target.value; renderInsights(); }
      else if (event.target.id === "resourceFilter") { resourceFilter = event.target.value; renderResources(); }
      else if (event.target.id === "dashboardRange") { dashboardRange = number(event.target.value) || 7; renderDashboard(); }
    });
    document.addEventListener("input", function (event) {
      if (event.target.id === "reviewSearch") { reviewSearch = event.target.value; renderReviews(); }
      else if (event.target.id === "insightSearch") { insightSearch = event.target.value; renderInsights(); }
      else if (event.target.id === "resourceSearch") { resourceSearch = event.target.value; renderResources(); }
    });
    $("reviewFilters").addEventListener("click", function (event) { var chip = event.target.closest("[data-review-filter]"); if (!chip) return; reviewFilter = chip.dataset.reviewFilter; document.querySelectorAll("[data-review-filter]").forEach(function (item) { item.classList.toggle("active", item === chip); }); renderReviews(); });
    $("modalForm").addEventListener("submit", function (event) { event.preventDefault(); if (!modalSubmitHandler) return; modalSubmitHandler(getFormObject(event.currentTarget), event.currentTarget); });
    $("reviewStructuredForm").addEventListener("submit", function (event) { event.preventDefault(); saveReviewForm(event.currentTarget, event.currentTarget.dataset.id || ""); });
    $("smartImportPreviewForm").addEventListener("submit", function (event) { event.preventDefault(); saveSmartImport(event.currentTarget); });
    $("profileForm").addEventListener("submit", function (event) { event.preventDefault(); state.settings = Object.assign({}, state.settings, getFormObject(event.currentTarget)); state.settings.targetAge = number(state.settings.targetAge) || 80; save("个人设置已保存"); });
    $("importFile").addEventListener("change", function (event) { var file = event.target.files && event.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var parsed = JSON.parse(reader.result); if (!window.confirm("导入会覆盖当前 V2 数据，系统会先保存一份本地备份。是否继续？")) return; state = Store.importPayload(parsed); selectedProductId = state.products[0] ? state.products[0].id : ""; renderAll(); showToast("数据恢复成功"); } catch (error) { showToast("导入失败：" + error.message); } finally { event.target.value = ""; } }; reader.readAsText(file, "utf-8"); });
    $("modalLayer").addEventListener("click", function (event) { if (event.target === $("modalLayer")) closeModal(); });
    $("drawerLayer").addEventListener("click", function (event) { if (event.target === $("drawerLayer")) closeDrawer(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { closeModal(); closeDrawer(); $("appShell").classList.remove("menu-open"); $("overlay").classList.remove("open"); } });
  }

  function init() {
    renderAll();
    bindEvents();
    var notice = Store.getNotice ? Store.getNotice() : "";
    if (notice) { setTimeout(function () { showToast(notice); if (Store.clearNotice) Store.clearNotice(); }, 120); }
    clearInterval(clockTimer); clockTimer = setInterval(updateClock, 30000);
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("./sw.js").catch(function () {});
  }
  init();
})(window, document);
