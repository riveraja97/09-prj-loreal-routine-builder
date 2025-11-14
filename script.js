/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const rtlToggle = document.getElementById("rtlToggle");

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
    selectAtLeastOne: "Select at least one product to generate a routine.",
    generatingRoutine: "Generating routine…",
    errorGenerating: "Error generating routine:",
    rtlButton: "RTL",
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
    selectAtLeastOne: "حدد منتجًا واحدًا على الأقل لإنشاء روتين.",
    generatingRoutine: "جاري إنشاء الروتين…",
    errorGenerating: "خطأ في إنشاء الروتين:",
    rtlButton: "عربي",
  },
};

// current UI language code (en/ar)
let currentLang = "en";

function applyTranslations(lang) {
  currentLang = TRANSLATIONS[lang] ? lang : "en";
  const t = TRANSLATIONS[currentLang];
  // site title
  const siteTitleEl = document.querySelector(".site-title");
  if (siteTitleEl) siteTitleEl.textContent = t.siteTitle;

  // category select placeholder (first disabled option)
  if (categoryFilter) {
    const firstOpt = categoryFilter.querySelector("option[disabled]");
    if (firstOpt) firstOpt.textContent = t.chooseCategory;
  }

  // search input placeholder
  const searchEl = document.getElementById("productSearch");
  if (searchEl) searchEl.setAttribute("placeholder", t.searchPlaceholder);

  // selected products header
  const selHdr = document.querySelector(".selected-products h2");
  if (selHdr) selHdr.textContent = t.selectedProducts;

  // chat heading
  const chatHdr = document.querySelector(".chatbox h2");
  if (chatHdr) chatHdr.textContent = t.chatHeading;

  // chat input placeholder
  const userInput = document.getElementById("userInput");
  if (userInput) userInput.setAttribute("placeholder", t.chatPlaceholder);

  // generate button text (keep icon)
  const genBtn = document.getElementById("generateRoutine");
  if (genBtn)
    genBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t.generateBtn}`;

  // rtl toggle label
  if (rtlToggle) rtlToggle.textContent = t.rtlButton;

  // update selectedProductsList messages if empty
  const selList = document.getElementById("selectedProductsList");
  if (selList && (!selectedIds || selectedIds.size === 0)) {
    selList.innerHTML = `<p class=\"placeholder-message\">${t.noProducts}</p>`;
  }
  // refresh dynamic selected-products UI so Clear All text and chips update
  try {
    updateSelectedProductsList();
  } catch (err) {
    /* ignore: function may be defined later */
  }
}

/* Topic validation: only allow beauty-related queries */
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

const DEFAULT_SYSTEM_PROMPT =
  "You are an assistant that creates and answers questions about skincare, haircare, makeup, fragrance, and routines built from the provided products. Remember the full conversation history and use it to provide relevant answers. If the user asks something outside these topics, politely decline and ask them to ask about skincare, haircare, makeup, fragrance, or the generated routine.";

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
      { role: "system", content: DEFAULT_SYSTEM_PROMPT },
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
  /* Generate routine button handler */
  const generateBtn = document.getElementById("generateRoutine");
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      if (selectedIds.size === 0) {
        chatWindow.innerHTML = `<p class="placeholder-message">${TRANSLATIONS[currentLang].selectAtLeastOne}</p>`;
        return;
      }

      generateBtn.disabled = true;
      chatWindow.innerHTML = `<p class="placeholder-message">${TRANSLATIONS[currentLang].generatingRoutine}</p>`;

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

        const systemMsg = { role: "system", content: DEFAULT_SYSTEM_PROMPT };

        const userMsg = {
          role: "user",
          content: `Here are the selected products in JSON format:\n${JSON.stringify(
            selectedProducts,
            null,
            2
          )}\n\nCreate a short routine (bulleted or numbered) describing when and how to use these products together.`,
        };

        // initialize conversation for follow-ups
        window.chatMessages = [systemMsg, userMsg];

        const assistantText = await callOpenAI(window.chatMessages);
        window.chatMessages.push({ role: "assistant", content: assistantText });
        renderChatWindow();
      } catch (err) {
        console.error(err);
        chatWindow.innerHTML = `<p class=\"placeholder-message\">${
          TRANSLATIONS[currentLang].errorGenerating
        } ${escapeHtml(err.message)}</p>`;
      } finally {
        generateBtn.disabled = false;
      }
    });
  }

  /* Helper: call OpenAI Chat Completions and return assistant text */
  async function callOpenAI(messages) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        max_tokens: 700,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${errText}`);
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

  /* Render the conversation in the chat window */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/\'/g, "&#39;");
  }

  function renderChatWindow() {
    if (!window.chatMessages || window.chatMessages.length === 0) return;
    chatWindow.innerHTML = window.chatMessages
      .map((m) => {
        const role =
          m.role === "user"
            ? "You"
            : m.role === "assistant"
            ? "Assistant"
            : "System";
        const content = escapeHtml(m.content).replace(/\n/g, "<br>");
        return `<div class=\"chat-line chat-${m.role}\"><strong>${role}:</strong> <div class=\"chat-content\">${content}</div></div>`;
      })
      .join("");
  }
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
    // collect selected product ids
    if (selectedIds.size === 0) {
      chatWindow.innerHTML = `<p class="placeholder-message">${TRANSLATIONS[currentLang].selectAtLeastOne}</p>`;
      return;
    }

    // show loading
    chatWindow.innerHTML = `<p class="placeholder-message">${TRANSLATIONS[currentLang].generatingRoutine}</p>`;

    try {
      const products = await loadProducts();

      // filter and map selected products to include only relevant fields
      const selectedProducts = products
        .filter((p) => selectedIds.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          description: p.description,
        }));

      // Build messages for the API using the `messages` parameter
      const systemMsg = { role: "system", content: DEFAULT_SYSTEM_PROMPT };

      const userMsg = {
        role: "user",
        content: `Here are the selected products in JSON format:\n${JSON.stringify(
          selectedProducts,
          null,
          2
        )}\n\nCreate a short routine (bulleted or numbered) describing when and how to use these products together.`,
      };

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [systemMsg, userMsg],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${errText}`);
      }

      const data = await res.json();

      // Check for the expected content location
      const assistantMsg =
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content
          ? data.choices[0].message.content
          : "(No response returned)";

      // render assistant response in chat window
      chatWindow.innerHTML = `<div class=\"chat-response\">${assistantMsg
        .replace(/\n/g, "<br>")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")}</div>`;
    } catch (err) {
      console.error(err);
      chatWindow.innerHTML = `<p class=\"placeholder-message\">${
        TRANSLATIONS[currentLang].errorGenerating
      } ${escapeHtml(err.message)}</p>`;
    }
  });
}
