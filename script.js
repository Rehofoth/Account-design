
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const STORAGE_KEY = "finova-transactions-v1";
  const BUDGET_KEY = "finova-budget-v1";
  const THEME_KEY = "finova-theme-v1";

  const categories = {
    income: ["Salary", "Allowance", "Freelance", "Gift", "Investment", "Other income"],
    expense: ["Food", "Transport", "Shopping", "Bills", "Education", "Entertainment", "Health", "Other expense"]
  };

  const categoryIcons = {
    Salary: "▤", Allowance: "◈", Freelance: "⌘", Gift: "◇",
    Investment: "↗", "Other income": "+", Food: "♨",
    Transport: "↗", Shopping: "◇", Bills: "▤", Education: "▣",
    Entertainment: "♫", Health: "✚", "Other expense": "•"
  };

  const palette = [
    "#7357f5", "#1da77a", "#f0a34a", "#e45e76",
    "#5c9ce6", "#b37bea", "#41b6b0", "#e5c04f"
  ];

  let transactions = loadTransactions();
  let budget = loadBudget();
  let editingId = null;
  let toastTimer;

  function loadTransactions() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved)
        ? saved.filter(t =>
            t && typeof t.id === "string" &&
            typeof t.title === "string" &&
            Number.isFinite(Number(t.amount)) &&
            Number(t.amount) > 0 &&
            ["income", "expense"].includes(t.type) &&
            typeof t.date === "string"
          ).map(t => ({
            ...t,
            amount: Number(t.amount),
            category: String(t.category || "Other expense"),
            note: String(t.note || "")
          }))
        : [];
    } catch {
      return [];
    }
  }

  function loadBudget() {
    try {
      const value = Number(localStorage.getItem(BUDGET_KEY));
      return Number.isFinite(value) && value >= 0 ? value : 50000;
    } catch {
      return 50000;
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      localStorage.setItem(BUDGET_KEY, String(budget));
      return true;
    } catch {
      showToast("Could not save data. Check browser storage.");
      return false;
    }
  }

  function money(amount, compact = false) {
    const n = Number(amount) || 0;
    if (compact && Math.abs(n) >= 1000000) {
      return "₦" + (n / 1000000).toFixed(1) + "m";
    }
    if (compact && Math.abs(n) >= 100000) {
      return "₦" + (n / 1000).toFixed(0) + "k";
    }
    return "₦" + n.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function todayString() {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function currentMonth() {
    return todayString().slice(0, 7);
  }

  function formatDate(value) {
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric"
    });
  }

  function sum(items, type) {
    return items
      .filter(t => !type || t.type === type)
      .reduce((total, t) => total + t.amount, 0);
  }

  function monthlyItems(month, type) {
    return transactions.filter(t =>
      t.date.startsWith(month) && (!type || t.type === type)
    );
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function fillCategoryOptions() {
    const type = $("#transactionType").value;
    const select = $("#transactionCategory");
    const previous = select.value;
    select.innerHTML = categories[type].map(c =>
      `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
    ).join("");
    if (categories[type].includes(previous)) select.value = previous;

    const filter = $("#filterCategory");
    const current = filter.value;
    const allCategories = [...new Set(
      transactions.map(t => t.category).concat(categories.income, categories.expense)
    )].sort();
    filter.innerHTML = '<option value="all">All categories</option>' +
      allCategories.map(c =>
        `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
      ).join("");
    if (allCategories.includes(current)) filter.value = current;
  }

  function renderStats() {
    const income = sum(transactions, "income");
    const expenses = sum(transactions, "expense");
    const thisMonth = monthlyItems(currentMonth());
    const monthlyExpenses = sum(thisMonth, "expense");

    $("#totalBalance").textContent = money(income - expenses);
    $("#totalIncome").textContent = money(income);
    $("#totalExpenses").textContent = money(expenses);
    $("#monthlyExpenses").textContent = money(monthlyExpenses);

    $("#analyticsIncome").textContent = money(sum(thisMonth, "income"));
    $("#analyticsExpenses").textContent = money(monthlyExpenses);
    $("#analyticsNet").textContent = money(
      sum(thisMonth, "income") - monthlyExpenses
    );
  }

  function transactionRow(t, withActions = false) {
    const income = t.type === "income";
    const icon = categoryIcons[t.category] || "◈";
    const note = t.note
      ? `<small>${escapeHTML(t.note)}</small>` : "";

    return `<tr>
      <td><div class="transaction-cell">
        <span class="transaction-icon">${icon}</span>
        <div><strong>${escapeHTML(t.title)}</strong>${note}</div>
      </div></td>
      <td>${escapeHTML(t.category)}</td>
      <td>${formatDate(t.date)}</td>
      <td class="${income ? "amount-income" : "amount-expense"}">${income ? "+" : "−"}${money(t.amount)}</td>
      <td><span class="type-pill ${t.type}">${t.type}</span></td>
      ${withActions ? `<td><div class="row-actions">
        <button data-edit="${escapeHTML(t.id)}" aria-label="Edit ${escapeHTML(t.title)}">Edit</button>
        <button class="delete-button" data-delete="${escapeHTML(t.id)}" aria-label="Delete ${escapeHTML(t.title)}">Delete</button>
      </div></td>` : ""}
    </tr>`;
  }

  function renderTransactions() {
    const sorted = [...transactions].sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );

    const recent = sorted.slice(0, 5);
    $("#recentTransactions").innerHTML = recent.map(t => transactionRow(t)).join("");
    $("#recentEmpty").classList.toggle("show", recent.length === 0);

    const query = $("#searchTransactions").value.trim().toLowerCase();
    const type = $("#filterType").value;
    const category = $("#filterCategory").value;

    const filtered = sorted.filter(t => {
      const text = `${t.title} ${t.category} ${t.note}`.toLowerCase();
      return text.includes(query) &&
        (type === "all" || t.type === type) &&
        (category === "all" || t.category === category);
    });

    $("#allTransactions").innerHTML = filtered.map(t => transactionRow(t, true)).join("");
    $("#transactionsEmpty").classList.toggle("show", filtered.length === 0);
  }

  function renderCashFlow(containerId) {
    const container = $("#" + containerId);
    const now = new Date();
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleDateString("en-NG", { month: "short" }),
        income: sum(monthlyItems(key), "income"),
        expense: sum(monthlyItems(key), "expense")
      });
    }

    const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));

    container.innerHTML = months.map(m => {
      const incomeHeight = m.income ? Math.max(3, m.income / max * 100) : 0;
      const expenseHeight = m.expense ? Math.max(3, m.expense / max * 100) : 0;

      return `<div class="chart-month" title="${m.label}: Income ${money(m.income)}, expenses ${money(m.expense)}">
        <div class="bar-pair">
          <div class="bar bar-income" style="height:${incomeHeight}%" title="Income: ${money(m.income)}"></div>
          <div class="bar bar-expense" style="height:${expenseHeight}%" title="Expenses: ${money(m.expense)}"></div>
        </div>
        <small>${m.label}</small>
      </div>`;
    }).join("");
  }

  function renderCategories() {
    const expenses = transactions.filter(t => t.type === "expense");
    const totals = {};

    expenses.forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((n, item) => n + item[1], 0);

    $("#donutTotal").textContent = money(total, true);

    if (!total) {
      $("#categoryDonut").style.background =
        "conic-gradient(var(--primary-light) 0deg 360deg)";
      $("#categoryLegend").innerHTML =
        '<p class="muted">Your spending categories will appear here.</p>';
      return;
    }

    let degrees = 0;
    const segments = entries.map(([name, amount], index) => {
      const start = degrees;
      degrees += amount / total * 360;
      return `${palette[index % palette.length]} ${start}deg ${degrees}deg`;
    });

    $("#categoryDonut").style.background = `conic-gradient(${segments.join(",")})`;

    $("#categoryLegend").innerHTML = entries.slice(0, 5).map(([name, amount], index) => `
      <div class="category-row">
        <span class="category-name">
          <i class="category-swatch" style="background:${palette[index % palette.length]}"></i>
          ${escapeHTML(name)}
        </span>
        <strong>${money(amount, true)}</strong>
      </div>
    `).join("");
  }

  function renderTopCategories() {
    const totals = {};
    transactions.filter(t => t.type === "expense").forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(item => item[1]));

    $("#topCategories").innerHTML = entries.length ? entries.slice(0, 6).map(([name, amount], i) => `
      <div class="top-category-item">
        <div class="top-category-label">
          <strong>${escapeHTML(name)}</strong><span>${money(amount)}</span>
        </div>
        <div class="mini-track">
          <div class="mini-fill" style="width:${amount / max * 100}%;background:${palette[i % palette.length]}"></div>
        </div>
      </div>
    `).join("") : '<p class="muted">Add expenses to see your spending analysis.</p>';
  }

  function renderBudget() {
    const spent = sum(monthlyItems(currentMonth()), "expense");
    const percent = budget > 0 ? spent / budget * 100 : 0;
    const safePercent = Math.min(100, percent);

    $("#budgetAmountLabel").textContent = money(budget);
    $("#budgetInput").value = budget || "";
    $("#budgetSpentLabel").textContent = `${money(spent)} spent this month`;
    $("#budgetPercent").textContent = `${Math.round(percent)}%`;
    $("#budgetProgress").style.width = `${safePercent}%`;
    $("#budgetProgress").classList.toggle("warning", percent >= 75 && percent < 100);
    $("#budgetProgress").classList.toggle("danger", percent >= 100);

    let message = "You're within your budget. Keep tracking your spending.";
    if (budget === 0) message = "Set a budget greater than zero to track your spending limit.";
    else if (percent >= 100) message = "Your recorded expenses have reached or exceeded your budget.";
    else if (percent >= 75) message = "You've used at least 75% of your budget. Review your spending.";
    $("#budgetMessage").textContent = message;
  }

  function renderAll() {
    fillCategoryOptions();
    renderStats();
    renderTransactions();
    renderCashFlow("cashFlowChart");
    renderCashFlow("analyticsChart");
    renderCategories();
    renderTopCategories();
    renderBudget();
  }

  function navigate(page) {
    const validPages = ["dashboard", "transactions", "analytics", "budget"];
    if (!validPages.includes(page)) page = "dashboard";

    $$(".page").forEach(section =>
      section.classList.toggle("active", section.id === `page-${page}`)
    );
    $$(".nav-link[data-page]").forEach(link =>
      link.classList.toggle("active", link.dataset.page === page)
    );

    const titles = {
      dashboard: "Overview",
      transactions: "Transactions",
      analytics: "Analytics",
      budget: "Budget planner"
    };

    $("#pageTitle").textContent = titles[page];
    $("#sidebar").classList.remove("open");
    window.location.hash = page;
  }

  function openModal(id = null) {
    editingId = id;
    const item = id ? transactions.find(t => t.id === id) : null;

    $("#modalTitle").textContent = item ? "Edit transaction" : "Add transaction";
    $("#transactionTitle").value = item?.title || "";
    $("#transactionAmount").value = item?.amount ?? "";
    $("#transactionType").value = item?.type || "expense";
    $("#transactionDate").value = item?.date || todayString();
    $("#transactionNote").value = item?.note || "";
    fillCategoryOptions();

    if (item) $("#transactionCategory").value = item.category;

    $("#transactionModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("#transactionTitle").focus();
  }

  function closeModal() {
    $("#transactionModal").hidden = true;
    document.body.style.overflow = "";
    editingId = null;
  }

  function saveTransaction(event) {
    event.preventDefault();

    const title = $("#transactionTitle").value.trim();
    const amount = Number($("#transactionAmount").value);
    const type = $("#transactionType").value;
    const category = $("#transactionCategory").value;
    const date = $("#transactionDate").value;
    const note = $("#transactionNote").value.trim();

    if (!title || !Number.isFinite(amount) || amount <= 0 || !date) {
      showToast("Enter a valid name, amount, and date.");
      return;
    }

    const item = {
      id: editingId || (
        window.crypto?.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      ),
      title,
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
      type,
      category,
      date,
      note
    };

    if (editingId) {
      transactions = transactions.map(t => t.id === editingId ? item : t);
    } else {
      transactions.push(item);
    }

    saveData();
    closeModal();
    renderAll();
    showToast(editingId ? "Transaction updated." : "Transaction added.");
  }

  function deleteTransaction(id) {
    const item = transactions.find(t => t.id === id);
    if (!item) return;

    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;

    transactions = transactions.filter(t => t.id !== id);
    saveData();
    renderAll();
    showToast("Transaction deleted.");
  }

  function exportCSV() {
    if (!transactions.length) {
      showToast("There are no transactions to export.");
      return;
    }

    const columns = ["Date", "Name", "Type", "Category", "Amount", "Note"];
    const rows = transactions
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(t => [t.date, t.title, t.type, t.category, t.amount.toFixed(2), t.note]);

    const escapeCSV = value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [columns, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finova-transactions-${todayString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("CSV export downloaded.");
  }

  function initializeTheme() {
    let theme = "light";
    try {
      theme = localStorage.getItem(THEME_KEY) || "light";
    } catch {}
    document.body.classList.toggle("dark", theme === "dark");
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle("dark");
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {}
  }

  function initialize() {
    $("#todayDate").textContent = new Date().toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric"
    });

    initializeTheme();
    renderAll();

    $$(".nav-link[data-page]").forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault();
        navigate(link.dataset.page);
      });
    });

    $$("[data-goto]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.goto));
    });

    $("#addTransaction").addEventListener("click", () => openModal());
    $("#addTransaction").addEventListener("keydown", event => {
      if (event.key === "Enter") openModal();
    });

    $("#closeModal").addEventListener("click", closeModal);
    $("#cancelModal").addEventListener("click", closeModal);
    $("#transactionForm").addEventListener("submit", saveTransaction);
    $("#transactionType").addEventListener("change", fillCategoryOptions);

    $("#transactionModal").addEventListener("click", event => {
      if (event.target === $("#transactionModal")) closeModal();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeModal();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate("transactions");
        $("#searchTransactions").focus();
      }
    });

    $("#searchTransactions").addEventListener("input", renderTransactions);
    $("#filterType").addEventListener("change", renderTransactions);
    $("#filterCategory").addEventListener("change", renderTransactions);

    $("#allTransactions").addEventListener("click", event => {
      const editButton = event.target.closest("[data-edit]");
      const deleteButton = event.target.closest("[data-delete]");

      if (editButton) openModal(editButton.dataset.edit);
      if (deleteButton) deleteTransaction(deleteButton.dataset.delete);
    });

    $("#exportCsv").addEventListener("click", exportCSV);
    $("#themeToggle").addEventListener("click", toggleTheme);
    $("#menuToggle").addEventListener("click", () => {
      $("#sidebar").classList.toggle("open");
    });

    $("#budgetForm").addEventListener("submit", event => {
      event.preventDefault();
      const value = Number($("#budgetInput").value);

      if (!Number.isFinite(value) || value < 0) {
        showToast("Enter a valid budget.");
        return;
      }

      budget = Math.round((value + Number.EPSILON) * 100) / 100;
      saveData();
      renderBudget();
      showToast("Monthly budget saved.");
    });

    const initialPage = window.location.hash.slice(1);
    navigate(["dashboard", "transactions", "analytics", "budget"].includes(initialPage)
      ? initialPage : "dashboard");
  }

  initialize();
})();
