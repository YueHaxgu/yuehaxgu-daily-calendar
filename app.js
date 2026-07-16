const entriesStorageKey = "daily-calendar-entries";
const categoriesStorageKey = "daily-calendar-categories";
const themeStorageKey = "daily-calendar-theme";
const defaultCategories = ["工作", "学习", "生活", "运动", "阅读"];
const fallbackCategory = "生活";
const allCategory = "全部";
const categoryColors = ["#4dd4ac", "#7dd3fc", "#f59e57", "#a78bfa", "#fb7185", "#facc15", "#60a5fa"];
const supabaseUrl = "https://motlvavfznjenkecyshu.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdGx2YXZmem5qZW5rZWN5c2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDI4ODMsImV4cCI6MjA5OTc3ODg4M30.CADb-ywgy6wlhqojJGjAohPBL2Ujj0e3uDq_kTnSNv0";
const cloudStateTable = "calendar_state";
const supabaseClient = window.supabase?.createClient?.(supabaseUrl, supabaseAnonKey);

const calendarGrid = document.querySelector("#calendarGrid");
const monthTitle = document.querySelector("#monthTitle");
const selectedDateTitle = document.querySelector("#selectedDateTitle");
const entryCount = document.querySelector("#entryCount");
const dayInsight = document.querySelector("#dayInsight");
const entriesContainer = document.querySelector("#entries");
const monthEntryTotal = document.querySelector("#monthEntryTotal");
const activeDayTotal = document.querySelector("#activeDayTotal");
const importantTotal = document.querySelector("#importantTotal");
const topCategory = document.querySelector("#topCategory");
const categoryChips = document.querySelector("#categoryChips");
// filterCategory/filterFocus - removed
const searchInput = document.querySelector("#searchInput");
const resetFilters = document.querySelector("#resetFilters");
const filterAllButton = document.querySelector("#filterAllButton");
const restoreFile = document.querySelector("#restoreFile");
const dataMenuButton = document.querySelector("#dataMenuButton");
const dataDropdown = document.querySelector("#dataDropdown");
const themeToggle = document.querySelector("#themeToggle");
const entryForm = document.querySelector("#entryForm");
const entryText = document.querySelector("#entryText");
const entryCategory = document.querySelector("#entryCategory");
const entryMood = document.querySelector("#entryMood");
const entryImportant = document.querySelector("#entryImportant");
const submitEntry = document.querySelector("#submitEntry");
const cancelEdit = document.querySelector("#cancelEdit");
// category input replaced by modal
const editTime = document.querySelector("#editTime");
const editTimeOverlay = document.querySelector("#editTimeOverlay");
const entryTemplate = document.querySelector("#entryTemplate");
const cloudAccountButton = document.querySelector("#cloudAccountButton");
const cloudAccountStatus = document.querySelector("#cloudAccountStatus");
const cloudAuthModal = document.querySelector("#cloudAuthModal");
const cloudAuthClose = document.querySelector("#cloudAuthClose");
const cloudAuthForm = document.querySelector("#cloudAuthForm");
const cloudEmail = document.querySelector("#cloudEmail");
const cloudPassword = document.querySelector("#cloudPassword");
const cloudSignIn = document.querySelector("#cloudSignIn");
const cloudSignUp = document.querySelector("#cloudSignUp");
const cloudSignOut = document.querySelector("#cloudSignOut");
const cloudAccountEmail = document.querySelector("#cloudAccountEmail");
function showToast(message, type) {
  const container = document.querySelector("#toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "info");
  const iconMap = { success: "\u2713", error: "\u2717", info: "\u2139" };
  toast.innerHTML = "<span class=\"toast-icon\">" + (iconMap[type] || iconMap.info) + "</span><span class=\"toast-msg\">" + message + "</span>";
  container.append(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
}

function applyTheme(theme, persist) {
  const isLight = theme === "light";
  document.documentElement.dataset.theme = isLight ? "light" : "dark";
  themeToggle?.setAttribute("aria-pressed", String(isLight));

  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, isLight ? "light" : "dark");
    } catch {}
  }
}

applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark", false);

themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(nextTheme, true);
  showToast(nextTheme === "light" ? "已切换为白天模式" : "已切换为黑夜模式", "info");
});


const today = new Date();
let visibleYear = today.getFullYear();
let visibleMonth = today.getMonth();
let selectedDate = toDateKey(today);
let selectedFilter = allCategory;
let selectedFocus = "all";
let searchTerm = "";
let editingEntryId = null;
let categories = loadCategories();
let entriesByDate = normalizeEntries(loadEntries());
let cloudUser = null;
let cloudSyncTimer = null;
let cloudSyncBusy = false;
let isApplyingCloudState = false;

document.querySelector("#prevMonth").addEventListener("click", () => {
  moveMonth(-1);
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  moveMonth(1);
});

document.querySelector("#todayButton").addEventListener("click", () => {
  visibleYear = today.getFullYear();
  visibleMonth = today.getMonth();
  selectedDate = toDateKey(today);
  render();
});


searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  render();
});

filterAllButton.addEventListener("click", () => {
  selectedFilter = allCategory;
  selectedFocus = "all";
  searchTerm = "";
  searchInput.value = "";
  render();
});

resetFilters.addEventListener("click", () => {
  selectedFilter = allCategory;
  selectedFocus = "all";
  searchTerm = "";
  searchInput.value = "";
  render();
});

dataMenuButton.addEventListener("click", (e) => {
  e.stopPropagation();
  dataDropdown.hidden = !dataDropdown.hidden;
});

document.addEventListener("click", () => {
  dataDropdown.hidden = true;
});

dataDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  const btn = e.target.closest("[data-action]");
  const action = btn ? btn.dataset.action : null;
  if (!action) return;
  dataDropdown.hidden = true;
  if (action === "export-month") {
    doExportMonth();
  } else if (action === "export-all") {
    doExportAll();
  } else if (action === "import") {
    restoreFile.click();
  }
});

function doExportMonth() {
  const data = {
    month: getMonthPrefix(),
    exportedAt: new Date().toISOString(),
    entries: Object.entries(entriesByDate)
      .filter(([dateKey]) => dateKey.startsWith(getMonthPrefix()))
      .flatMap(([date, entries]) => entries.map((entry) => ({ date, ...entry }))),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-log-${getMonthPrefix()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("\u672C\u6708\u8BB0\u5F55\u5DF2\u5BFC\u51FA", "success");
}

function doExportAll() {
  const data = {
    exportedAt: new Date().toISOString(),
    categories,
    entries: Object.entries(entriesByDate).flatMap(([date, entries]) =>
      entries.map((entry) => ({ date, ...entry }))
    ),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("\u5168\u90E8\u6570\u636E\u5DF2\u5907\u4EFD", "success");
}

// Backup merged into data menu

// import handled via data menu dropdown

restoreFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.entries || !Array.isArray(data.entries)) {
        alert("备份文件格式无效：缺少 entries 数组。");
        return;
      }
      const imported = {};
      let replaceCount = 0;
      for (const entry of data.entries) {
        if (!entry.date || !entry.id || !entry.text) continue;
        const dateKey = entry.date;
        const normalEntry = {
          id: entry.id,
          category: entry.category ?? fallbackCategory,
          mood: entry.mood ?? "平静",
          important: entry.important === true,
          time: entry.time ?? "",
          text: entry.text,
          createdAt: entry.createdAt ?? new Date().toISOString(),
          updatedAt: entry.updatedAt,
        };
        if (!imported[dateKey]) imported[dateKey] = [];
        imported[dateKey].push(normalEntry);
        replaceCount++;
      }
      if (replaceCount === 0) {
        alert("备份文件中没有找到有效记录。");
        return;
      }
      entriesByDate = imported;
      if (Array.isArray(data.categories)) {
        categories = normalizeCategories(data.categories);
        saveCategories();
      }
      saveEntries();
      render();
      showToast("\u6062\u590D\u5907\u4EFD\u6210\u529F\uFF0C\u5171" + replaceCount + "\u6761\u8BB0\u5F55", "success");
    } catch {
      alert("备份文件解析失败，请检查文件内容。");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});


const categoryModal = document.querySelector("#categoryModal");
const modalClose = document.querySelector("#modalClose");
const modalCategoryInput = document.querySelector("#modalCategoryInput");
const modalAddCategory = document.querySelector("#modalAddCategory");
const modalCategoryList = document.querySelector("#modalCategoryList");
const manageCategoriesBtn = document.querySelector("#manageCategoriesBtn");

manageCategoriesBtn.addEventListener("click", () => {
  categoryModal.hidden = false;
  renderCategoryModal();
  modalCategoryInput.value = "";
  modalCategoryInput.focus();
});

function closeCategoryModal() {
  categoryModal.hidden = true;
}

modalClose.addEventListener("click", closeCategoryModal);
categoryModal.addEventListener("click", (e) => {
  if (e.target === categoryModal) closeCategoryModal();
});
const monthEntriesModal = document.querySelector("#monthEntriesModal");
const monthEntriesClose = document.querySelector("#monthEntriesClose");
const monthEntriesTitle = document.querySelector("#monthEntriesTitle");
const monthEntriesBody = document.querySelector("#monthEntriesBody");

monthEntriesClose.addEventListener("click", () => { monthEntriesModal.hidden = true; });
monthEntriesModal.addEventListener("click", (e) => {
  if (e.target === monthEntriesModal) monthEntriesModal.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!categoryModal.hidden) closeCategoryModal();
    if (!monthEntriesModal.hidden) monthEntriesModal.hidden = true;
  }
});

modalAddCategory.addEventListener("click", () => {
  const name = modalCategoryInput.value.trim();
  if (!name) return;
  if (categories.includes(name)) {
    showToast("\u5206\u7C7B\u201C" + name + "\u201D\u5DF2\u5B58\u5728", "error");
    return;
  }
  categories = [...categories, name];
  saveCategories();
  renderCategories();
  renderCategoryModal();
  modalCategoryInput.value = "";
  modalCategoryInput.focus();
  showToast("\u5206\u7C7B\u201C" + name + "\u201D\u5DF2\u6DFB\u52A0", "success");
});

modalCategoryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") modalAddCategory.click();
});

function renderCategoryModal() {
  modalCategoryList.innerHTML = "";
  if (categories.length === 0) {
    modalCategoryList.innerHTML = "<p class=\"empty-state\" style=\"text-align:center\">\u8FD8\u6CA1\u6709\u5206\u7C7B\uFF0C\u8F93\u5165\u540D\u79F0\u6DFB\u52A0\u4E00\u4E2A\u5427</p>";
    return;
  }
  categories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "modal-cat-row";
    
    const colorDot = document.createElement("span");
    colorDot.className = "modal-cat-dot";
    colorDot.style.background = getCategoryColor(cat);
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "modal-cat-name";
    nameSpan.textContent = cat;
    
    const isDefault = ["\u5DE5\u4F5C", "\u5B66\u4E60", "\u751F\u6D3B", "\u8FD0\u52A8", "\u9605\u8BFB"].includes(cat);
    
    const editBtn = document.createElement("button");
    editBtn.className = "modal-cat-btn";
    editBtn.textContent = "\u7F16\u8F91";
    editBtn.addEventListener("click", () => {
      const newName = prompt("\u4FEE\u6539\u5206\u7C7B\u540D\u79F0\uFF1A", cat);
      if (!newName || newName.trim() === cat || !newName.trim()) return;
      const trimmed = newName.trim();
      if (categories.includes(trimmed)) {
        showToast("\u5206\u7C7B\u201C" + trimmed + "\u201D\u5DF2\u5B58\u5728", "error");
        return;
      }
      // Update all entries with this category
      for (const [dateKey, entries] of Object.entries(entriesByDate)) {
        entriesByDate[dateKey] = entries.map((entry) => {
          return entry.category === cat ? { ...entry, category: trimmed } : entry;
        });
        if (entriesByDate[dateKey].length === 0) delete entriesByDate[dateKey];
      }
      categories = categories.map((c) => c === cat ? trimmed : c);
      saveCategories();
      saveEntries();
      render();
      renderCategoryModal();
      showToast("\u5DF2\u66F4\u65B0\u4E3A\u201C" + trimmed + "\u201D", "success");
    });
    
    const delBtn = document.createElement("button");
    delBtn.className = "modal-cat-btn modal-cat-del";
    delBtn.textContent = "\u5220\u9664";
        // All categories can be deleted (with migration)
    delBtn.addEventListener("click", () => {
      // Count how many entries use this category
      let usageCount = 0;
      for (const [, entries] of Object.entries(entriesByDate)) {
        for (const entry of entries) {
          if (entry.category === cat) usageCount++;
        }
      }
      if (usageCount > 0) {
        const msg = "分类“" + cat + "”已被 " + usageCount + " 条记录使用。请输入目标分类名称将这些记录迁移到其他分类：";
        const target = prompt(msg, fallbackCategory);
        if (!target || !target.trim()) {
          showToast("已取消删除", "info");
          return;
        }
        const trimmedTarget = target.trim();
        if (!categories.includes(trimmedTarget)) {
          showToast("目标分类“" + trimmedTarget + "”不存在，请先添加该分类", "error");
          return;
        }
        if (trimmedTarget === cat) {
          showToast("目标分类与当前分类相同", "error");
          return;
        }
        // Migrate entries
        for (const [dateKey, entries] of Object.entries(entriesByDate)) {
          entriesByDate[dateKey] = entries.map((entry) => {
            return entry.category === cat ? { ...entry, category: trimmedTarget } : entry;
          });
        }
      }
      categories = categories.filter((c) => c !== cat);
      saveCategories();
      saveEntries();
      render();
      renderCategoryModal();
      showToast("分类“" + cat + "”已删除", "info");
    });
        row.append(colorDot, nameSpan, editBtn, delBtn);
    modalCategoryList.append(row);
  });
}

cancelEdit.addEventListener("click", () => {
  resetEntryForm();
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = entryText.value.trim();
  if (!text) return;

  const category = entryCategory.value || fallbackCategory;
  const now = new Date();
  const autoTime = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");

  if (editingEntryId) {
    updateEntry(editingEntryId, {
      category,
      mood: entryMood.value,
      important: entryImportant.checked,
      time: editTime.value || autoTime,
      text,
      updatedAt: new Date().toISOString(),
    });
    resetEntryForm();
    return;
  }

  const dayEntries = entriesByDate[selectedDate] ?? [];
  entriesByDate[selectedDate] = [
    ...dayEntries,
    {
      id: crypto.randomUUID(),
      category,
      mood: entryMood.value,
      important: entryImportant.checked,
      time: autoTime,
      text,
      createdAt: new Date().toISOString(),
    },
  ];

  resetEntryForm();
  saveEntries();
  render();
  showToast("\u8BB0\u5F55\u6DFB\u52A0\u6210\u529F", "success");
});

function moveMonth(offset) {
  const nextDate = new Date(visibleYear, visibleMonth + offset, 1);
  visibleYear = nextDate.getFullYear();
  visibleMonth = nextDate.getMonth();
  render();
}

function render() {
  renderCategories();
  renderSummary();
  renderCalendar();
  renderEntries();
}

function renderCategories() {
  const previousEntryValue = entryCategory.value || fallbackCategory;
  entryCategory.innerHTML = "";

  categories.forEach((category) => {
    const formOption = document.createElement("option");
    formOption.value = category;
    formOption.textContent = category;
    entryCategory.append(formOption);
  });

  entryCategory.value = categories.includes(previousEntryValue) ? previousEntryValue : fallbackCategory;

  const categoryCounts = getMonthCategoryCounts();
  categoryChips.innerHTML = "";
  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category]) => {
      const chip = document.createElement("button");
      chip.className = "category-chip";
      chip.type = "button";
      chip.style.setProperty("--chip-color", getCategoryColor(category));
      chip.textContent = category;
      chip.addEventListener("click", () => {
        selectedFilter = category;
        // filterCategory removed
        render();
      });
      categoryChips.append(chip);
    });
}

function renderSummary() {
  const monthEntries = getVisibleMonthEntries();
  const allMonthEntries = Object.entries(entriesByDate)
    .filter(([dateKey]) => dateKey.startsWith(getMonthPrefix()))
    .flatMap(([, entries]) => entries);
  const activeDays = Object.entries(entriesByDate)
    .filter(([dateKey]) => dateKey.startsWith(getMonthPrefix()) && entriesByDate[dateKey].length > 0).length;
  const top = getTopCategories(allMonthEntries)[0];

  monthEntryTotal.textContent = monthEntries.length;
  activeDayTotal.textContent = activeDays;
  importantTotal.textContent = monthEntries.filter((entry) => entry.important).length;
  topCategory.textContent = top ? `${top[0]} ${top[1]}` : "暂无";
  
  // Mark first summary card as clickable
  const summaryArticles = document.querySelectorAll(".summary-grid article");
  if (summaryArticles.length > 0) {
    summaryArticles[0].classList.add("is-clickable");
  }
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  monthTitle.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(new Date(visibleYear, visibleMonth, 1));

  const firstDay = new Date(visibleYear, visibleMonth, 1);
  const mondayBasedStart = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(visibleYear, visibleMonth, 1 - mondayBasedStart);

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const dateKey = toDateKey(date);
    const allEntries = entriesByDate[dateKey] ?? [];
    const visibleEntries = filterEntries(allEntries);
    const cell = document.createElement("button");
    const number = document.createElement("span");
    const summary = document.createElement("span");
    const meta = document.createElement("span");

    cell.type = "button";
    cell.className = "day-cell";
    cell.setAttribute("aria-label", `${formatFullDate(date)}，${visibleEntries.length} 条记录`);
    number.className = "day-number";
    number.textContent = date.getDate();
    summary.className = "day-summary";
    meta.className = "day-meta";

    if (date.getMonth() !== visibleMonth) {
      cell.classList.add("is-muted");
    }

    if (dateKey === selectedDate) {
      cell.classList.add("is-selected");
    }

    if (dateKey === toDateKey(today)) {
      cell.classList.add("is-today");
    }

    cell.append(number);

    if (visibleEntries.length) {
      const firstText = visibleEntries[0].text;
      summary.textContent = firstText.length > 55 ? firstText.slice(0, 55) + "\u2026" : firstText;
      getTopCategories(visibleEntries).forEach(([category]) => {
        const dot = document.createElement("span");
        dot.className = "category-dot";
        dot.title = category;
        dot.style.background = getCategoryColor(category);
        meta.append(dot);
      });

      const total = document.createElement("span");
      total.className = "day-total";
      total.textContent = `${visibleEntries.length} 条`;
      meta.append(total);
      cell.append(summary, meta);
    } else {
      cell.append(summary);
    }

    if (visibleEntries.some((entry) => entry.important)) {
      const marker = document.createElement("span");
      marker.className = "important-marker";
      marker.textContent = "!";
      cell.append(marker);
    }

    cell.addEventListener("click", () => {
      selectedDate = dateKey;
      visibleYear = date.getFullYear();
      visibleMonth = date.getMonth();
      render();
    });

    calendarGrid.append(cell);
  }
}

function renderEntries() {
  const date = fromDateKey(selectedDate);
  const entries = filterEntries(entriesByDate[selectedDate] ?? []);
  const allDayEntries = entriesByDate[selectedDate] ?? [];

  selectedDateTitle.textContent = formatFullDate(date);
  entryCount.textContent = `${entries.length} 条`;
  renderDayInsight(allDayEntries);
  entriesContainer.innerHTML = "";

  if (!entries.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "这一天没有匹配的记录。换个筛选条件，或者写下一件刚做完的事。";
    entriesContainer.append(emptyState);
    return;
  }

  // Sort entries by time descending (newest first)
  const sortedEntries = [...entries].sort((a, b) => {
  // Sort by time descending (newest first), with createdAt as tiebreaker
  const timeCmp = (b.time || "23:59").localeCompare(a.time || "23:59");
  if (timeCmp !== 0) return timeCmp;
  return (b.createdAt || "").localeCompare(a.createdAt || "");
});
  sortedEntries.forEach((entry) => {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    node.classList.toggle("is-important", entry.important);
    node.style.setProperty("--entry-color", getCategoryColor(entry.category));
    node.querySelector(".entry-category").textContent = entry.category;
    node.querySelector(".entry-mood").textContent = entry.mood;
    node.querySelector(".entry-text").textContent = entry.text;
    node.querySelector(".entry-important").hidden = !entry.important;

    const timeEl = node.querySelector(".entry-time");
    if (entry.time) {
      timeEl.textContent = "\u23F0 " + entry.time;
    } else {
      timeEl.style.display = "none";
    }

    node.querySelector(".edit-entry").addEventListener("click", () => {
      startEditingEntry(entry);
    });

    const importantButton = node.querySelector(".toggle-important");
    importantButton.textContent = entry.important ? "取消重要" : "标重要";
    importantButton.addEventListener("click", () => {
      updateEntry(entry.id, { important: !entry.important });
    });

    node.querySelector(".delete-entry").addEventListener("click", () => {
      if (!confirm("确定删除这条记录吗？")) return;
      entriesByDate[selectedDate] = entriesByDate[selectedDate].filter((item) => item.id !== entry.id);

      if (entriesByDate[selectedDate].length === 0) {
        delete entriesByDate[selectedDate];
      }

      saveEntries();
      render();
      showToast("\u8BB0\u5F55\u5DF2\u5220\u9664", "info");
    });
    entriesContainer.append(node);
  });
}

function renderDayInsight(entries) {
  dayInsight.innerHTML = "";

  if (!entries.length) {
    dayInsight.textContent = "这一天还没有记录。";
    return;
  }

  const top = getTopCategories(entries);
  top.forEach(([category, count]) => {
    const item = document.createElement("span");
    item.className = "insight-pill";
    item.style.setProperty("--pill-color", getCategoryColor(category));
    item.textContent = `${category} ${count}`;
    dayInsight.append(item);
  });
}

function updateEntry(entryId, changes) {
  entriesByDate[selectedDate] = (entriesByDate[selectedDate] ?? []).map((entry) => {
    return entry.id === entryId ? { ...entry, ...changes } : entry;
  });
  saveEntries();
  render();
  const keys = Object.keys(changes);
  const isImportantOnly = keys.length === 1 && keys[0] === "important";
  if (isImportantOnly) {
    showToast(changes.important ? "已标为重要 🔔" : "已取消重要", "info");
  } else {
    showToast("编辑保存成功", "success");
  }
}
function startEditingEntry(entry) {
  editingEntryId = entry.id;
  entryCategory.value = categories.includes(entry.category) ? entry.category : fallbackCategory;
  entryMood.value = entry.mood;
  entryImportant.checked = entry.important;
  editTime.value = entry.time || "";
  editTimeOverlay.style.display = "";
  entryText.value = entry.text;
  submitEntry.textContent = "保存修改";
  cancelEdit.hidden = false;
  entryText.focus();
}

function resetEntryForm() {
  editingEntryId = null;
  entryText.value = "";
  editTimeOverlay.style.display = "none";
  entryImportant.checked = false;
  submitEntry.textContent = "添加记录";
  cancelEdit.hidden = true;
}

function filterEntries(entries) {
  return entries.filter((entry) => {
    const text = `${entry.text} ${entry.category} ${entry.mood}`.toLowerCase();
    const matchesCategory = selectedFilter === allCategory || entry.category === selectedFilter;
    const matchesSearch = !searchTerm || text.includes(searchTerm);
    const matchesFocus = selectedFocus === "all" || (selectedFocus === "important" && entry.important);
    return matchesCategory && matchesSearch && matchesFocus;
  });
}

function getVisibleMonthEntries() {
  return Object.entries(entriesByDate)
    .filter(([dateKey]) => dateKey.startsWith(getMonthPrefix()))
    .flatMap(([, entries]) => filterEntries(entries));
}

function getMonthCategoryCounts() {
  return Object.entries(entriesByDate)
    .filter(([dateKey]) => dateKey.startsWith(getMonthPrefix()))
    .flatMap(([, entries]) => entries)
    .reduce((counts, entry) => {
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
      return counts;
    }, {});
}

function countMonthEntriesForCategory(category) {
  return Object.entries(entriesByDate)
    .filter(([dateKey]) => dateKey.startsWith(getMonthPrefix()))
    .flatMap(([, entries]) => entries)
    .filter((entry) => {
      const text = `${entry.text} ${entry.category} ${entry.mood}`.toLowerCase();
      const matchesCategory = category === allCategory || entry.category === category;
      const matchesSearch = !searchTerm || text.includes(searchTerm);
      const matchesFocus = selectedFocus === "all" || (selectedFocus === "important" && entry.important);
      return matchesCategory && matchesSearch && matchesFocus;
    }).length;
}

function getTopCategories(entries) {
  const counts = entries.reduce((result, entry) => {
    result[entry.category] = (result[entry.category] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
}

function getCategoryColor(category) {
  const index = [...category].reduce((sum, char) => sum + char.charCodeAt(0), 0) % categoryColors.length;
  return categoryColors[index];
}

function getMonthPrefix() {
  return `${visibleYear}-${String(visibleMonth + 1).padStart(2, "0")}`;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(entriesStorageKey)) ?? {};
  } catch {
    return {};
  }
}

function loadCategories() {
  try {
    return normalizeCategories(JSON.parse(localStorage.getItem(categoriesStorageKey)));
  } catch {
    return defaultCategories;
  }
}

function normalizeCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) return [...defaultCategories];
  const validCategories = rawCategories.filter((category) => typeof category === "string" && category.trim());
  return [...new Set([...defaultCategories, ...validCategories])];
}

function normalizeEntries(rawEntries) {
  if (!rawEntries || typeof rawEntries !== "object") return {};
  return Object.fromEntries(
    Object.entries(rawEntries).flatMap(([dateKey, entries]) => {
      if (!Array.isArray(entries)) return [];
      return [[dateKey, entries.map((entry) => ({
        id: entry.id ?? crypto.randomUUID(),
        category: entry.category ?? fallbackCategory,
        mood: entry.mood ?? "平静",
        important: entry.important === true,
        time: entry.time ?? "",
        text: entry.text ?? "",
        createdAt: entry.createdAt ?? new Date().toISOString(),
        updatedAt: entry.updatedAt,
      }))]];
    }),
  );
}

function saveEntries() {
  localStorage.setItem(entriesStorageKey, JSON.stringify(entriesByDate));
  scheduleCloudSync();
}

function saveCategories() {
  localStorage.setItem(categoriesStorageKey, JSON.stringify(categories));
  scheduleCloudSync();
}

// Month entries modal - click handler (event delegation)
document.querySelector(".summary-grid")?.addEventListener("click", (e) => {
  const article = e.target.closest("article");
  if (article && article.classList.contains("is-clickable")) {
    openMonthEntriesModal();
  }
});

function openMonthEntriesModal() {
  const prefix = getMonthPrefix();
  const allEntries = Object.entries(entriesByDate)
    .filter(([dateKey]) => dateKey.startsWith(prefix))
    .flatMap(([dateKey, entries]) => 
      entries.map((entry) => ({ ...entry, date: dateKey }))
    )
    .sort((a, b) => {
      // Sort by date (newest first), then by time (newest first)
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || "23:59").localeCompare(a.time || "23:59");
    });

  monthEntriesTitle.textContent = "本月记录 (" + allEntries.length + " 条)";
  monthEntriesBody.innerHTML = "";

  if (allEntries.length === 0) {
    monthEntriesBody.innerHTML = `<p class="empty-state">还没有记录，写下你的第一件事吧。</p>`;
    monthEntriesModal.hidden = false;
    return;
  }

  // Group entries by date
  let currentDate = "";
  let dateGroup = null;

  for (const entry of allEntries) {
    if (entry.date !== currentDate) {
      currentDate = entry.date;
      const dateObj = fromDateKey(entry.date);
      const dayNum = dateObj.getDate();
      const weekday = ["日", "一", "二", "三", "四", "五", "六"][dateObj.getDay()];
      const month = dateObj.getMonth() + 1;
      
      dateGroup = document.createElement("div");
      dateGroup.className = "month-entry-group";
      
      const header = document.createElement("div");
      header.className = "month-entry-group-header";
      header.innerHTML = `<span class="group-date">${month}月${dayNum}日</span><span class="group-weekday">周${weekday}</span>`;
      
      dateGroup.append(header);
      monthEntriesBody.append(dateGroup);
    }

    const card = document.createElement("div");
    card.className = "month-entry-card";
    
    const importantBadge = entry.important ? `<span class="me-important">重要</span>` : "";
    const timeStr = entry.time || "";
    
    card.innerHTML = `
      <div class="me-top">
        <div class="me-meta">
          <span class="me-category" style="background:${getCategoryColor(entry.category)}22;color:${getCategoryColor(entry.category)}">${entry.category}</span>
          <span class="me-mood">${entry.mood}</span>
          ${importantBadge}
        </div>
        <span class="me-time">${timeStr}</span>
      </div>
      <p class="me-text">${escapeHtml(entry.text)}</p>
    `;
    
    if (dateGroup) dateGroup.append(card);
  }

  monthEntriesModal.hidden = false;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, "<br>");
}

function setCloudStatus(message, tone) {
  if (!cloudAccountStatus) return;
  cloudAccountStatus.textContent = message;
  cloudAccountStatus.dataset.tone = tone || "idle";
}

function updateCloudAccountUi() {
  const isSignedIn = Boolean(cloudUser);
  cloudAccountButton?.classList.toggle("is-connected", isSignedIn);
  cloudAuthForm.hidden = isSignedIn;
  cloudAccountEmail.hidden = !isSignedIn;
  cloudSignOut.hidden = !isSignedIn;

  if (isSignedIn) {
    cloudAccountEmail.textContent = cloudUser.email || "已登录账户";
    setCloudStatus("云端已连接", "success");
  } else {
    setCloudStatus("云端同步", "idle");
  }
}

function closeCloudModal() {
  cloudAuthModal.hidden = true;
  cloudPassword.value = "";
}

function entryUpdatedAt(entry) {
  const timestamp = Date.parse(entry.updatedAt || entry.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeEntries(...entryStates) {
  const entriesByIdAndDate = new Map();

  entryStates.forEach((entryState) => {
    Object.entries(entryState).forEach(([dateKey, entries]) => {
      const entriesById = entriesByIdAndDate.get(dateKey) ?? new Map();
      entries.forEach((entry) => {
        const existing = entriesById.get(entry.id);
        if (!existing || entryUpdatedAt(entry) >= entryUpdatedAt(existing)) {
          entriesById.set(entry.id, entry);
        }
      });
      entriesByIdAndDate.set(dateKey, entriesById);
    });
  });

  return Object.fromEntries(
    [...entriesByIdAndDate.entries()].map(([dateKey, entriesById]) => [dateKey, [...entriesById.values()]]),
  );
}

function scheduleCloudSync() {
  if (!supabaseClient || !cloudUser || isApplyingCloudState) return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = window.setTimeout(() => {
    cloudSyncTimer = null;
    syncCalendarToCloud();
  }, 600);
}

async function syncCalendarToCloud() {
  if (!supabaseClient || !cloudUser) return;
  if (cloudSyncBusy) {
    scheduleCloudSync();
    return;
  }

  cloudSyncBusy = true;
  setCloudStatus("正在同步", "pending");
  const { error } = await supabaseClient.from(cloudStateTable).upsert({
    user_id: cloudUser.id,
    entries: entriesByDate,
    categories,
    updated_at: new Date().toISOString(),
  });
  cloudSyncBusy = false;

  if (error) {
    console.error("Supabase sync failed", error);
    setCloudStatus("同步失败", "error");
    showToast("云端同步失败，请稍后重试。", "error");
    return;
  }

  setCloudStatus("已同步", "success");
}

async function loadCloudState() {
  if (!supabaseClient || !cloudUser) return;

  setCloudStatus("正在读取", "pending");
  const { data, error } = await supabaseClient
    .from(cloudStateTable)
    .select("entries, categories")
    .eq("user_id", cloudUser.id)
    .maybeSingle();

  if (error) {
    console.error("Supabase load failed", error);
    setCloudStatus("同步不可用", "error");
    showToast("无法读取云端数据，请确认 Supabase 已完成配置。", "error");
    return;
  }

  isApplyingCloudState = true;
  entriesByDate = mergeEntries(
    normalizeEntries(data?.entries),
    normalizeEntries(entriesByDate),
  );
  categories = normalizeCategories([...(data?.categories ?? []), ...categories]);
  localStorage.setItem(entriesStorageKey, JSON.stringify(entriesByDate));
  localStorage.setItem(categoriesStorageKey, JSON.stringify(categories));
  isApplyingCloudState = false;
  render();
  scheduleCloudSync();
}

async function syncCloudUser(nextUser) {
  const userChanged = nextUser?.id !== cloudUser?.id;
  cloudUser = nextUser ?? null;
  updateCloudAccountUi();

  if (cloudUser && userChanged) {
    await loadCloudState();
  }
}

async function initializeCloudSync() {
  if (!supabaseClient) {
    setCloudStatus("云端不可用", "error");
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Supabase session failed", error);
    setCloudStatus("云端不可用", "error");
    return;
  }

  await syncCloudUser(data.session?.user);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      syncCloudUser(session?.user);
    }, 0);
  });
}

async function handleCloudAuthentication(mode) {
  if (!supabaseClient) {
    showToast("云端服务当前不可用。", "error");
    return;
  }

  const email = cloudEmail.value.trim();
  const password = cloudPassword.value;
  if (!email || !password) {
    showToast("请输入邮箱和密码。", "error");
    return;
  }
  if (password.length < 6) {
    showToast("密码至少需要 6 位。", "error");
    return;
  }

  cloudSignIn.disabled = true;
  cloudSignUp.disabled = true;
  const emailRedirectTo = window.location.protocol === "file:"
    ? "https://yuehaxgu.github.io/yuehaxgu-daily-calendar/"
    : window.location.origin + window.location.pathname;
  const result = mode === "signup"
    ? await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  cloudSignIn.disabled = false;
  cloudSignUp.disabled = false;

  if (result.error) {
    showToast(result.error.message, "error");
    return;
  }

  if (mode === "signup" && !result.data.session) {
    showToast("注册邮件已发送，请验证邮箱后再登录。", "success");
    return;
  }

  showToast(mode === "signup" ? "账户已创建，正在同步数据。" : "登录成功，正在同步数据。", "success");
}

cloudAccountButton?.addEventListener("click", () => {
  cloudAuthModal.hidden = false;
  updateCloudAccountUi();
  if (!cloudUser) cloudEmail.focus();
});

cloudAuthClose?.addEventListener("click", closeCloudModal);
cloudAuthModal?.addEventListener("click", (event) => {
  if (event.target === cloudAuthModal) closeCloudModal();
});
cloudAuthForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleCloudAuthentication("signin");
});
cloudSignIn?.addEventListener("click", () => handleCloudAuthentication("signin"));
cloudSignUp?.addEventListener("click", () => handleCloudAuthentication("signup"));
cloudSignOut?.addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) showToast(error.message, "error");
});

render();
initializeCloudSync();
