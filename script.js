/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const rtlToggle = document.getElementById("rtlToggle");

// Cloudflare Workers proxy configuration -- set to your worker domain
// This worker should accept POST requests and forward them to OpenAI (server-side key)
const WORKER_PROXY_BASE = "https://black-rice-7b4b.riveraja.workers.dev"; // set to your worker
// Path on the worker that handles chat/completions. Adjust if your worker expects a different path.
const WORKER_PROXY_CHAT_PATH = "/chat";

/**
 * Helper to call the proxy or fallback to OpenAI directly.
 * body should be the same object you'd send to OpenAI (model, messages, etc.).
 */
async function proxyFetchChat(body) {
  const url = WORKER_PROXY_BASE
    ? `${WORKER_PROXY_BASE.replace(/\/$/, "")}${WORKER_PROXY_CHAT_PATH}`
    : "https://api.openai.com/v1/chat/completions";
  const headers = { "Content-Type": "application/json" };
  // If no worker is configured and an OPENAI_API_KEY is present, send the Authorization header
  if (!WORKER_PROXY_BASE && typeof OPENAI_API_KEY !== "undefined") {
    headers.Authorization = `Bearer ${OPENAI_API_KEY}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res;
}

// Simple translation map for UI strings (English + Arabic)
const TRANSLATIONS = {
  en: {
    siteTitle: "Smart Routine & Product Advisor",
    chooseCategory: "Choose a Category",
    selectCategoryPrompt: "Select a category to view products",
    searchPlaceholder: "Search products by name or keyword…",
    selectedProducts: "Selected Products",
    noProducts: "No products selected",
    clearAll: "Clear All",
    generateBtn: "Generate Routine",
    chatHeading: "Let's Build Your Routine",
    chatPlaceholder: "Ask me about products or routines…",
    rtlButton: "RTL",
    selectAtLeastOne: "Select at least one product to generate a routine.",
    generatingRoutine: "Generating routine…",
    errorGenerating: "Error generating routine:",
  },
  ar: {
    siteTitle: "منشئ روتين المنتجات",
    chooseCategory: "اختر فئة",
    selectCategoryPrompt: "اختر فئة لعرض المنتجات",
    searchPlaceholder: "ابحث عن منتجات بالاسم أو الكلمة…",
    selectedProducts: "المنتجات المختارة",
    noProducts: "لا توجد منتجات محددة",
    clearAll: "مسح الكل",
    generateBtn: "إنشاء روتين",
    chatHeading: "دعنا نبني روتينك",
    chatPlaceholder: "اسألني عن المنتجات أو الروتين…",
    rtlButton: "عربي",
    selectAtLeastOne: "حدد منتجًا واحدًا على الأقل لإنشاء روتين.",
    generatingRoutine: "جاري إنشاء الروتين…",
    errorGenerating: "خطأ في إنشاء الروتين:",
  },
};

const ALLOWED_TOPIC_KEYWORDS = [
  "skincare",
  "skin",
  "moisturizer",
  "cleanser",
  "toner",
  "serum",
  "sunscreen",
  "spf",
  "hair",
  "haircare",
  "shampoo",
  "conditioner",
  "styling",
  "makeup",
  "foundation",
  "concealer",
  "mascara",
  "eyeshadow",
  "lipstick",
  "fragrance",
  "perfume",
  "scent",
  "routine",
  "product",
  "ingredient",
  "ingredients",
];

function isOnTopic(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  // allow if any keyword appears
  return ALLOWED_TOPIC_KEYWORDS.some((kw) => t.includes(kw));
}

// Current UI language (used for translations). Prefer stored value, else infer from direction.
let currentLang = (function () {
  try {
    const s = localStorage.getItem("uiLang");
    if (s) return s;
  } catch (e) {}
  return document.documentElement.getAttribute("dir") === "rtl" ? "ar" : "en";
})();

/* Apply UI translations for a given language code (simple, safe updates) */
function applyTranslations(lang) {
  currentLang = lang || currentLang || "en";
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  try {
    localStorage.setItem("uiLang", currentLang);
  } catch (e) {}
  // Update common elements if present
  const siteTitleEl = document.getElementById("siteTitle");
  if (siteTitleEl) siteTitleEl.textContent = t.siteTitle;
  const genBtn = document.getElementById("generateRoutine");
  if (genBtn) genBtn.textContent = t.generateBtn;
  const searchEl = document.getElementById("productSearch");
  if (searchEl) searchEl.placeholder = t.searchPlaceholder;
  const rtlBtn = document.getElementById("rtlToggle");
  if (rtlBtn) rtlBtn.textContent = t.rtlButton;
  const selectedLabel = document.getElementById("selectedProductsLabel");
  if (selectedLabel) selectedLabel.textContent = t.selectedProducts;
  const chatHeading = document.getElementById("chatHeading");
  if (chatHeading) chatHeading.textContent = t.chatHeading;
  const userInput = document.getElementById("userInput");
  if (userInput) userInput.placeholder = t.chatPlaceholder;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are an assistant that creates and answers questions about skincare, haircare, makeup, fragrance, and routines built from the provided products. Remember the full conversation history and use it to provide relevant answers. If the user asks something outside these topics, politely decline and ask them to ask about skincare, haircare, makeup, fragrance, or the generated routine.";

// Current system prompt (editable by user). Persisted in localStorage under 'systemPrompt'.
let currentSystemPrompt = (function () {
  try {
    const s = localStorage.getItem("systemPrompt");
    return s && s.length ? s : DEFAULT_SYSTEM_PROMPT;
  } catch (err) {
    return DEFAULT_SYSTEM_PROMPT;
  }
})();

/* Persist selected products in localStorage so selections survive reloads */
function loadSelectedIds() {
  try {
    const raw = localStorage.getItem("selectedProductIds");
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((v) => Number(v)));
  } catch (err) {
    return new Set();
  }
}

function saveSelectedIds() {
  try {
    localStorage.setItem(
      "selectedProductIds",
      JSON.stringify(Array.from(selectedIds))
    );
  } catch (err) {
    console.warn("Could not save selections:", err);
  }
}

// Initialize selection state from storage
const selectedIds = loadSelectedIds();

// Initialize RTL state from localStorage (persist user's preference)
function applyDir(dir) {
  if (dir === "rtl") {
    document.documentElement.setAttribute("dir", "rtl");
    if (rtlToggle) rtlToggle.setAttribute("aria-pressed", "true");
    // apply Arabic translations when switching to RTL
    applyTranslations("ar");
  } else {
    document.documentElement.removeAttribute("dir");
    if (rtlToggle) rtlToggle.setAttribute("aria-pressed", "false");
    // apply English translations for LTR
    applyTranslations("en");
  }
}

const savedDir = localStorage.getItem("uiDir");
if (savedDir) {
  applyDir(savedDir);
} else {
  // Auto-detect RTL based on browser language if user has not set a preference
  const RTL_LANGS = new Set([
    "ar",
    "he",
    "fa",
    "ur",
    "ps",
    "sd",
    "ug",
    "ku",
    "yi",
  ]);
  const userLangs =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "en"];

  const wantsRtl = userLangs.some((lang) => {
    if (!lang) return false;
    const primary = String(lang).split("-")[0].toLowerCase();
    return RTL_LANGS.has(primary);
  });

  if (wantsRtl) {
    applyDir("rtl");
    try {
      localStorage.setItem("uiDir", "rtl");
      localStorage.setItem("uiLang", "ar");
    } catch (err) {
      /* ignore persistence errors */
    }
  }
}

// Ensure translations are applied for LTR default when no dir was set
if (!document.documentElement.getAttribute("dir")) {
  applyTranslations("en");
}

if (rtlToggle) {
  rtlToggle.addEventListener("click", () => {
    const isRtl = document.documentElement.getAttribute("dir") === "rtl";
    const next = isRtl ? "ltr" : "rtl";
    applyDir(next === "rtl" ? "rtl" : "ltr");
    try {
      localStorage.setItem("uiDir", next === "rtl" ? "rtl" : "ltr");
      // persist language mapping as well
      localStorage.setItem("uiLang", next === "rtl" ? "ar" : "en");
    } catch (err) {
      console.warn("Could not persist UI direction:", err);
    }
  });
}

/* Render selected products list (chips) and provide remove / clear-all controls */
async function updateSelectedProductsList() {
  const container = document.getElementById("selectedProductsList");
  if (!container) return;

  const products = await loadProducts();
  if (!selectedIds || selectedIds.size === 0) {
    container.innerHTML = `<p class="placeholder-message">${TRANSLATIONS[currentLang].noProducts}</p>`;
    return;
  }

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/\'/g, "&#39;");

  const selectedArray = products.filter((p) => selectedIds.has(p.id));
  container.innerHTML = selectedArray
    .map(
      (p) =>
        `<div class="selected-chip" data-id="${
          p.id
        }"><span class="chip-name">${esc(
          p.name
        )} <small class="chip-brand">${esc(
          p.brand
        )}</small></span><button class="chip-remove" data-id="${
          p.id
        }" aria-label="Remove ${esc(p.name)}">×</button></div>`
    )
    .join("");

  // Add Clear All button
  const clearBtn = document.createElement("button");
  clearBtn.id = "clearSelections";
  clearBtn.className = "clear-btn";
  clearBtn.textContent = TRANSLATIONS[currentLang].clearAll || "Clear All";
  container.appendChild(clearBtn);

  // Wire remove buttons
  container.querySelectorAll(".chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = Number(e.currentTarget.dataset.id);
      selectedIds.delete(id);
      saveSelectedIds();
      // update card state in grid if visible
      const card = productsContainer.querySelector(
        `.product-card[data-id="${id}"]`
      );
      if (card) {
        card.classList.remove("selected");
        card.setAttribute("aria-pressed", "false");
      }
      // re-render the selected list
      updateSelectedProductsList();
    });
  });

  clearBtn.addEventListener("click", () => {
    selectedIds.clear();
    saveSelectedIds();
    document.querySelectorAll(".product-card.selected").forEach((c) => {
      c.classList.remove("selected");
      c.setAttribute("aria-pressed", "false");
    });
    updateSelectedProductsList();
  });
}

/* Toggle selection for a card and persist the change */
function toggleCardSelection(card) {
  if (!card) return;
  const id = Number(card.dataset.id);
  const isSelected = card.classList.toggle("selected");
  card.setAttribute("aria-pressed", String(isSelected));
  if (isSelected) selectedIds.add(id);
  else selectedIds.delete(id);
  saveSelectedIds();
  // update selected chips
  updateSelectedProductsList();
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    ${TRANSLATIONS[currentLang].selectCategoryPrompt}
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card${
      selectedIds.has(product.id) ? " selected" : ""
    }" data-id="${product.id}" data-name="${product.name}" data-brand="${
        product.brand
      }" role="button" tabindex="0" aria-pressed="${
        selectedIds.has(product.id) ? "true" : "false"
      }">
        <!-- details shown on hover/focus -->
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
        </div>
        <div class="product-desc" aria-hidden="true">${
          product.description
        }</div>
    </div>
  `
    )
    .join("");
  // Attach pointer/focus handlers for accessibility (update aria-hidden)
  attachCardEvents();
}

/* Utility: escape HTML for safe insertion */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/\'/g, "&#39;");
}

/* Render the conversation in the chat window (global) */
function renderChatWindow() {
  if (!window.chatMessages || window.chatMessages.length === 0) {
    chatWindow.innerHTML = "";
    return;
  }
  chatWindow.innerHTML = window.chatMessages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const role =
        m.role === "user" ? "You" : m.role === "assistant" ? "Assistant" : "";
      const content = escapeHtml(m.content).replace(/\n/g, "<br>");
      return `<div class=\"chat-line chat-${m.role}\"><strong>${role}:</strong> <div class=\"chat-content\">${content}</div></div>`;
    })
    .join("");
}

/* Global helper to call the chat API via proxyFetchChat */
async function callOpenAI(messages, options = {}) {
  const payload = Object.assign(
    {
      model: "gpt-4o",
      messages,
      max_tokens: 700,
      temperature: 0.7,
    },
    options
  );

  const res = await proxyFetchChat(payload);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat API error: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const assistantMsg =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content
      : "(No response)";
  return assistantMsg;
}

/* Attach hover/focus handlers to each rendered card to keep aria-hidden in sync */
function attachCardEvents() {
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    const desc = card.querySelector(".product-desc");
    if (!desc) return;
    const tolerance = 6; // px for row detection

    const showDesc = () => {
      // mark this card as the hovered/expanded one
      card.classList.add("hover-expanded");
      desc.setAttribute("aria-hidden", "false");

      // collapse other hovered cards that are in the same visual row
      const cardTop = card.getBoundingClientRect().top;
      const others = productsContainer.querySelectorAll(
        ".product-card.hover-expanded"
      );
      others.forEach((other) => {
        if (other === card) return;
        const otherTop = other.getBoundingClientRect().top;
        if (Math.abs(otherTop - cardTop) <= tolerance) {
          other.classList.remove("hover-expanded");
          const otherDesc = other.querySelector(".product-desc");
          if (otherDesc) otherDesc.setAttribute("aria-hidden", "true");
        }
      });
    };

    const hideDesc = () => {
      card.classList.remove("hover-expanded");
      desc.setAttribute("aria-hidden", "true");
    };

    card.addEventListener("pointerenter", showDesc);
    card.addEventListener("pointerleave", hideDesc);
    card.addEventListener("focusin", showDesc);
    card.addEventListener("focusout", hideDesc);
  });
}

/* Filter and display products when category changes */
// Search input (added to index.html)
const searchInput = document.getElementById("productSearch");

// Combined filter: category + search query
async function filterAndDisplay() {
  const products = await loadProducts();
  const selectedCategory = categoryFilter.value;
  const q =
    searchInput && searchInput.value
      ? searchInput.value.trim().toLowerCase()
      : "";

  let filtered = products;
  if (selectedCategory) {
    filtered = filtered.filter(
      (product) => product.category === selectedCategory
    );
  }
  if (q) {
    filtered = filtered.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const brand = (product.brand || "").toLowerCase();
      const desc = (product.description || "").toLowerCase();
      return name.includes(q) || brand.includes(q) || desc.includes(q);
    });
  }

  // If the set of filtered items is empty and no category selected, show placeholder
  if ((!filtered || filtered.length === 0) && !selectedCategory && !q) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  displayProducts(filtered);
}

// Wire events: category change and typing in search input
categoryFilter.addEventListener("change", filterAndDisplay);
if (searchInput) searchInput.addEventListener("input", filterAndDisplay);

// Initial render: show nothing (placeholder) until user interacts, or show all when search has text
if (searchInput && searchInput.value.trim()) filterAndDisplay();

/* Chat form submission handler - sends follow-up questions to the assistant using the conversation */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("userInput");
  if (!input) return;
  const text = input.value.trim();
  // Enforce topic whitelist: only allow beauty-related queries
  if (text && !isOnTopic(text)) {
    // Ensure a system prompt exists so chat window renders consistently
    window.chatMessages = window.chatMessages || [
      { role: "system", content: currentSystemPrompt },
    ];
    window.chatMessages.push({ role: "user", content: text });
    window.chatMessages.push({
      role: "assistant",
      content:
        "I can only help with skincare, haircare, makeup, fragrance, and routines based on selected products. Please ask a related question.",
    });
    renderChatWindow();
    input.value = "";
    return;
  }
  // use the global callOpenAI/escapeHtml/renderChatWindow
});

/* Click (and keyboard) handling using event delegation */
productsContainer.addEventListener("click", (e) => {
  // Hover/focus shows details via CSS; clicks on the card toggle selection only

  // Otherwise treat as selection toggle
  const card = e.target.closest(".product-card");
  if (!card) return;
  toggleCardSelection(card);
});

productsContainer.addEventListener("keydown", (e) => {
  // No special key guard needed; Enter/Space toggles selection when card is focused

  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".product-card");
    if (!card) return;
    e.preventDefault();
    toggleCardSelection(card);
  }
});

// Initialize selected list placeholder
updateSelectedProductsList();

/* Generate routine button handler */
const generateBtn = document.getElementById("generateRoutine");
if (generateBtn) {
  generateBtn.addEventListener("click", async () => {
    if (selectedIds.size === 0) {
      chatWindow.innerHTML = `<p class="placeholder-message">${
        (TRANSLATIONS[currentLang] &&
          TRANSLATIONS[currentLang].selectAtLeastOne) ||
        TRANSLATIONS.en.selectAtLeastOne
      }</p>`;
      return;
    }

    chatWindow.innerHTML = `<p class="placeholder-message">${
      (TRANSLATIONS[currentLang] &&
        TRANSLATIONS[currentLang].generatingRoutine) ||
      TRANSLATIONS.en.generatingRoutine
    }</p>`;

    try {
      const products = await loadProducts();
      const selectedProducts = products
        .filter((p) => selectedIds.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          description: p.description,
        }));

      const systemMsg = { role: "system", content: currentSystemPrompt };
      const userMsg = {
        role: "user",
        content: `Here are the selected products:\n\n${JSON.stringify(
          selectedProducts,
          null,
          2
        )}\n\nCreate a short routine (bulleted or numbered) describing when and how to use these products together.`,
      };

      const assistantText = await callOpenAI([systemMsg, userMsg], {
        max_tokens: 500,
      });

      window.chatMessages = [
        systemMsg,
        userMsg,
        { role: "assistant", content: assistantText },
      ];
      renderChatWindow();
    } catch (err) {
      console.error(err);
      chatWindow.innerHTML = `<p class="placeholder-message">${
        (TRANSLATIONS[currentLang] &&
          TRANSLATIONS[currentLang].errorGenerating) ||
        TRANSLATIONS.en.errorGenerating
      } ${escapeHtml(err.message)}</p>`;
    }
  });
}
