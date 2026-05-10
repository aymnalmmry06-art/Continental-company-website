/* --- Continental JS Core - Ultra Professional Version --- */

// Firebase Configuration
const firebaseConfig = {
  databaseURL: "https://continental-f76a8-default-rtdb.firebaseio.com/",
};

let database = null;
let activeNewsRefs = [];
const NEWS_PATHS = ["news", "posts", "articles"];
let latestNewsItems = new Map();
let pendingNewsId = new URLSearchParams(window.location.search).get("news");

function slugifyNewsId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// التحقق من تهيئة Firebase لمرة واحدة فقط لضمان استقرار الأداء
if (typeof firebase !== "undefined" && firebase.apps && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

if (typeof firebase !== "undefined" && typeof firebase.database === "function") {
  database = firebase.database();
}

let currentLang = "en";
let slowConnectionTimer = null;

function updateConnectionCopy(mode) {
  const titleAr = document.getElementById("connectionTitleAr");
  const textAr = document.getElementById("connectionTextAr");
  const titleEn = document.getElementById("connectionTitleEn");
  const textEn = document.getElementById("connectionTextEn");

  if (!titleAr || !textAr || !titleEn || !textEn) return;

  if (mode === "slow") {
    titleAr.textContent = "الاتصال بطيء حالياً";
    textAr.textContent =
      "يبدو أن الشبكة متعبة قليلاً. سنواصل المحاولة بهدوء حتى يكتمل تحميل الموقع.";
    titleEn.textContent = "The connection is slow";
    textEn.textContent =
      "Your network seems a little slow. We will keep trying gently until the site finishes loading.";
    return;
  }

  titleAr.textContent = "لا يوجد اتصال بالإنترنت";
  textAr.textContent =
    "يبدو أن الاتصال غير متوفر الآن. لا تقلق، سنعيد المحاولة فور عودة الشبكة.";
  titleEn.textContent = "You are offline";
  textEn.textContent =
    "It looks like your internet connection is unavailable. No worries, we will reconnect as soon as the network returns.";
}

function showConnectionOverlay(mode = "offline") {
  const overlay = document.getElementById("connectionOverlay");
  if (!overlay) return;

  updateConnectionCopy(mode);
  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
}

function hideConnectionOverlay() {
  const overlay = document.getElementById("connectionOverlay");
  if (!overlay) return;

  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
}

function setupConnectionMonitor() {
  const retryBtn = document.getElementById("connectionRetryBtn");

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        showConnectionOverlay("offline");
      }
    });
  }

  if (!navigator.onLine) {
    showConnectionOverlay("offline");
  }

  window.addEventListener("offline", () => showConnectionOverlay("offline"));
  window.addEventListener("online", () => {
    hideConnectionOverlay();
    showToast(
      currentLang === "ar"
        ? "عاد الاتصال بالإنترنت"
        : "Internet connection restored",
    );
  });

  slowConnectionTimer = window.setTimeout(() => {
    if (document.readyState !== "complete" && navigator.onLine) {
      showConnectionOverlay("slow");
    }
  }, 9000);

  window.addEventListener("load", () => {
    window.clearTimeout(slowConnectionTimer);
    if (navigator.onLine) hideConnectionOverlay();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function setTranslatedContent(el, value) {
  if (!el || !value) return;

  if (el.dataset.allowHtml === "true" && window.DOMPurify) {
    el.innerHTML = DOMPurify.sanitize(value);
    return;
  }

  if (el.children.length) {
    const textNode = Array.from(el.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
    );

    if (textNode) {
      textNode.textContent = ` ${value}`;
    } else {
      el.appendChild(document.createTextNode(value));
    }
    return;
  }

  el.textContent = value;
}

// --- 1. Language Toggle Logic ---
function toggleLanguage() {
  currentLang = currentLang === "en" ? "ar" : "en";
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = currentLang;

  const langBtn = document.getElementById("lang-btn");
  if (langBtn) langBtn.innerText = currentLang === "en" ? "AR" : "EN";

  const elements = document.querySelectorAll("[data-en]");
  elements.forEach((el) => {
    const translation = el.getAttribute(`data-${currentLang}`);
    setTranslatedContent(el, translation);
  });

  const placeholders = document.querySelectorAll("[data-en-placeholder]");
  placeholders.forEach((el) => {
    const placeholder = el.getAttribute(`data-${currentLang}-placeholder`);
    if (placeholder) el.placeholder = placeholder;
  });

  showToast(
    currentLang === "ar"
      ? "تم تغيير اللغة إلى العربية"
      : "Language changed to English",
  );

  renderNews();
}

// --- 2. Menu Toggle Logic (Updated with Click-Outside) ---
function toggleMenu() {
  const nav = document.getElementById("navbar");
  const menuIcon = document.getElementById("menu-icon");
  if (!nav || !menuIcon) return;

  const isActive = nav.classList.toggle("active");
  if (isActive) {
    menuIcon.classList.replace("fa-bars", "fa-times");
    document.body.style.overflow = "hidden"; // منع التمرير عند فتح المنيو
  } else {
    menuIcon.classList.replace("fa-times", "fa-bars");
    document.body.style.overflow = "auto";
  }
}

// إغلاق المنيو تلقائياً عند الضغط في أي مكان خارجه
document.addEventListener("click", function (event) {
  const nav = document.getElementById("navbar");
  const menuBtn = document.querySelector(".menu-btn");
  const menuIcon = document.getElementById("menu-icon");

  if (nav && nav.classList.contains("active")) {
    // إذا كان الضغط خارج النبار وخارج زر القائمة
    if (!nav.contains(event.target) && !menuBtn?.contains(event.target)) {
      nav.classList.remove("active");
      if (menuIcon) menuIcon.classList.replace("fa-times", "fa-bars");
      document.body.style.overflow = "auto";
    }
  }
});

// --- 3. UI Notifications (Toast) ---
function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  const icon = document.createElement("i");
  icon.className = "fas fa-check-circle";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(icon, text);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = "translateX(120%)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// --- 4. Contact Form Handler ---
async function handleFormSubmit(e) {
  if (!e) return;
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : "";

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = currentLang === "ar" ? "جاري الإرسال..." : "Sending...";
    }

    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error("Form submission failed");

    form.reset();
    closeModal();
    showToast(
      currentLang === "ar"
        ? "تم إرسال الطلب بنجاح! سنتواصل معك قريباً."
        : "Request sent successfully! We will contact you soon.",
    );
  } catch (error) {
    showToast(
      currentLang === "ar"
        ? "تعذر الإرسال حالياً. يرجى المحاولة لاحقاً."
        : "Could not send right now. Please try again later.",
    );
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

// --- 5. Firebase News Engine ---
function normalizeNewsItem(raw, fallbackId = "") {
  const item = raw || {};
  const title =
    item[`title_${currentLang}`] ||
    item[currentLang === "ar" ? "titleAr" : "titleEn"] ||
    item.title ||
    item.heading ||
    "";
  const content =
    item[`content_${currentLang}`] ||
    item[currentLang === "ar" ? "contentAr" : "contentEn"] ||
    item.content ||
    item.body ||
    item.description ||
    "";
  const img = item.img || item.image || item.imageUrl || item.photo || "logo.png";
  const timestamp =
    Number(item.timestamp || item.createdAt || item.dateMs || item.time || 0) ||
    Date.parse(item.date || "") ||
    0;

  return {
    ...item,
    id: String(
      item.id ||
        item.key ||
        fallbackId ||
        slugifyNewsId(`${title}-${timestamp || item.date || ""}`),
    ),
    title: String(title),
    content: String(content),
    img,
    timestamp,
    type: item.type || item.category || "normal",
    date:
      item.date ||
      (timestamp
        ? new Date(timestamp).toLocaleDateString(currentLang === "ar" ? "ar" : "en")
        : ""),
  };
}

function getNewsUrl(item) {
  const url = new URL(window.location.href);
  url.searchParams.set("news", item.id || "");
  url.hash = "news";
  return url.toString();
}

function openNewsItem(item, updateUrl = true) {
  const normalized = normalizeNewsItem(item);
  if (!normalized.title && !normalized.content) return;

  if (updateUrl && normalized.id) {
    const url = new URL(window.location.href);
    url.searchParams.set("news", normalized.id);
    url.hash = "news";
    window.history.replaceState({}, "", url.toString());
  }

  openStory(normalized.title || "", normalized.content || "", normalized.img || "");
}

async function shareNewsItem(item) {
  const normalized = normalizeNewsItem(item);
  const url = getNewsUrl(normalized);

  try {
    if (navigator.share) {
      await navigator.share({
        title: normalized.title || document.title,
        text: normalized.content ? normalized.content.slice(0, 120) : "",
        url,
      });
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const temp = document.createElement("textarea");
      temp.value = url;
      temp.setAttribute("readonly", "");
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      temp.remove();
    }
    showToast(currentLang === "ar" ? "تم نسخ رابط الخبر" : "News link copied");
  } catch (error) {
    showToast(
      currentLang === "ar"
        ? "تعذر مشاركة الرابط حالياً"
        : "Could not share right now",
    );
  }
}

function createNewsCard(item) {
  item = normalizeNewsItem(item);
  const card = document.createElement("article");
  card.className = "news-card reveal";
  if (item.id) card.id = `news-${slugifyNewsId(item.id)}`;

  const image = document.createElement("img");
  image.className = "news-img";
  image.loading = "lazy";
  image.alt = item.title || "Continental news";
  image.src = item.img || "logo.png";
  image.onerror = () => {
    image.src = "logo.png";
  };

  const body = document.createElement("div");
  body.className = "news-body";

  const type = String(item.type || "normal").toLowerCase();
  const tag = document.createElement("span");
  tag.className = `news-tag tag-${type}`;
  tag.textContent =
    currentLang === "ar"
      ? type === "normal"
        ? "تحديث"
        : type
      : type === "normal"
        ? "Update"
        : type;

  const title = document.createElement("h3");
  title.style.marginBottom = "10px";
  title.textContent = item.title || "";

  const content = String(item.content || "");
  const isLong = content.length > 130;
  const excerpt = document.createElement("p");
  excerpt.style.fontSize = "0.9rem";
  excerpt.style.opacity = "0.8";
  excerpt.textContent = isLong ? `${content.slice(0, 130)}...` : content;

  body.append(tag, title, excerpt);

  const actions = document.createElement("div");
  actions.className = "news-actions";

  const readMore = document.createElement("button");
  readMore.type = "button";
  readMore.className = "news-action primary";
  readMore.innerHTML = `<i class="fas fa-book-open"></i><span>${currentLang === "ar" ? "قراءة الخبر" : "Read Story"}</span>`;
  readMore.addEventListener("click", () => openNewsItem(item));
  actions.appendChild(readMore);

  const download = document.createElement("a");
  download.className = "news-action";
  download.href = item.img || "logo.png";
  download.download = `${(item.title || "continental-news").replace(/[^\w\u0600-\u06FF-]+/g, "-").slice(0, 60)}.jpg`;
  download.target = "_blank";
  download.rel = "noopener noreferrer";
  download.innerHTML = `<i class="fas fa-download"></i><span>${currentLang === "ar" ? "تحميل الصورة" : "Download Image"}</span>`;
  actions.appendChild(download);

  const share = document.createElement("button");
  share.type = "button";
  share.className = "news-action";
  share.innerHTML = `<i class="fas fa-share-alt"></i><span>${currentLang === "ar" ? "مشاركة" : "Share"}</span>`;
  share.addEventListener("click", () => shareNewsItem(item));
  actions.appendChild(share);

  body.appendChild(actions);

  const date = document.createElement("small");
  date.style.display = "block";
  date.style.marginTop = "15px";
  date.style.opacity = "0.5";
  date.textContent = item.date || "";
  body.appendChild(date);

  card.append(image, body);
  return card;
}

function renderNews() {
  const container = document.getElementById("news-container");
  if (!container) return;

  activeNewsRefs.forEach((ref) => ref.off());
  activeNewsRefs = [];

  container.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "news-empty-state news-loading-state";
  loading.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i><strong>${
    currentLang === "ar" ? "جاري تحميل الأخبار" : "Loading news..."
  }</strong>`;
  container.appendChild(loading);

  if (!database) {
    container.innerHTML = "";
    const message = document.createElement("div");
    message.className = "news-empty-state";
    message.innerHTML = `<span class="news-empty-logo"><img src="logo.png" alt="Continental Logo"></span><strong>${
      currentLang === "ar" ? "لا توجد أخبار في الوقت الحالي" : "No news at the moment"
    }</strong>`;
    container.appendChild(message);
    return;
  }
  const allItems = new Map();
  let completedInitialLoads = 0;

  const draw = () => {
    const items = Array.from(allItems.values())
      .map(normalizeNewsItem)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 12);
    latestNewsItems = new Map(items.map((item) => [item.id, item]));

    container.innerHTML = "";

    if (items.length) {
      const fragment = document.createDocumentFragment();
      items.forEach((item) => fragment.appendChild(createNewsCard(item)));
      container.appendChild(fragment);

      document
        .querySelectorAll(".reveal")
        .forEach((el) => observer.observe(el));

      if (pendingNewsId && latestNewsItems.has(pendingNewsId)) {
        openNewsItem(latestNewsItems.get(pendingNewsId), false);
        pendingNewsId = null;
      }
      return;
    }

    if (completedInitialLoads >= NEWS_PATHS.length) {
        const empty = document.createElement("div");
        empty.className = "news-empty-state";
        empty.innerHTML = `<span class="news-empty-logo"><img src="logo.png" alt="Continental Logo"></span><strong>${
          currentLang === "ar" ? "لا توجد أخبار في الوقت الحالي" : "No news at the moment"
        }</strong>`;
        container.appendChild(empty);
    }
  };

  NEWS_PATHS.forEach((path) => {
    const newsRef = database.ref(path);
    activeNewsRefs.push(newsRef);

    newsRef.orderByChild("timestamp").limitToLast(12).on(
      "value",
      (snapshot) => {
        if (snapshot.exists()) {
          snapshot.forEach((child) => {
            const item = child.val() || {};
            item.id = `${path}-${child.key}`;
            allItems.set(`${path}-${child.key}`, item);
          });
        }
        completedInitialLoads += 1;
        draw();
      },
      (error) => {
        console.error("Firebase Error:", error);
        completedInitialLoads += 1;
        if (completedInitialLoads >= NEWS_PATHS.length && allItems.size === 0) {
          container.innerHTML = "";
          const errorMessage = document.createElement("p");
          errorMessage.style.textAlign = "center";
          errorMessage.style.gridColumn = "1/-1";
          errorMessage.style.color = "#ff6b6b";
          errorMessage.textContent =
            currentLang === "ar" ? "حدث خطأ في الاتصال بالأخبار." : "News connection error.";
          container.appendChild(errorMessage);
        }
      },
    );
  });
}

// --- 6. Modals Logic ---
function openStory(title, content, img) {
  document.getElementById("storyTitle").textContent = title;
  document.getElementById("storyContent").textContent = content;
  const sImg = document.getElementById("storyImg");
  if (img && !img.includes("placeholder") && img !== "undefined") {
    sImg.src = img;
    sImg.style.display = "block";
  } else {
    sImg.style.display = "none";
  }
  document.getElementById("storyModal").style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeStory() {
  document.getElementById("storyModal").style.display = "none";
  document.body.style.overflow = "auto";
}

function openModal() {
  const modal = document.getElementById("quoteModal");
  if (modal) modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("quoteModal");
  if (modal) modal.style.display = "none";
}

// Global Click Listener for Modals
window.addEventListener("click", function (e) {
  const quoteModal = document.getElementById("quoteModal");
  const storyModal = document.getElementById("storyModal");
  if (e.target === quoteModal) closeModal();
  if (e.target === storyModal) closeStory();
});

// --- 7. Preloader & Initialization ---
window.addEventListener("DOMContentLoaded", () => {
  const logoOverlay = document.getElementById("logo-overlay");
  const preloader = document.getElementById("preloader");
  const mainContent = document.getElementById("main-content");
  const introSeen = sessionStorage.getItem("continentalIntroSeen") === "true";

  if (introSeen) {
    if (logoOverlay) logoOverlay.style.display = "none";
    if (preloader) preloader.style.display = "none";
    if (mainContent) mainContent.style.visibility = "visible";
    renderNews();
    return;
  }

  setTimeout(() => {
    if (logoOverlay) {
      logoOverlay.style.opacity = "0";
      if (preloader) preloader.style.display = "flex";
      setTimeout(() => (logoOverlay.style.display = "none"), 800);
    }
  }, 650);

  setTimeout(() => {
    if (preloader) {
      preloader.style.opacity = "0";
      if (mainContent) mainContent.style.visibility = "visible";
      sessionStorage.setItem("continentalIntroSeen", "true");
      renderNews();
      setTimeout(() => (preloader.style.display = "none"), 600);
    }
  }, 1700);
});

// --- 8. FAQ Accordion ---
document.querySelectorAll(".faq-question").forEach((q) => {
  q.addEventListener("click", () => {
    const parent = q.parentElement;
    const isActive = parent.classList.contains("active");
    document
      .querySelectorAll(".faq-item")
      .forEach((item) => item.classList.remove("active"));
    if (!isActive) parent.classList.add("active");
  });
});

// --- 9. Dark/Light Mode ---
function toggleMode() {
  document.body.classList.toggle("light");
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.classList.toggle("fa-moon");
    icon.classList.toggle("fa-sun");
  }
}

// --- 10. Scroll Logic ---
const backToTop = document.getElementById("backToTop");
const header = document.querySelector("header");
const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"]'));
const pageSections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
let ticking = false;

function updateActiveNavLink() {
  const anchorLine = window.scrollY + Math.max(120, window.innerHeight * 0.22);
  let activeSection = pageSections[0];

  pageSections.forEach((section) => {
    if (section.offsetTop <= anchorLine) activeSection = section;
  });

  navLinks.forEach((link) => {
    const isActive = activeSection && link.getAttribute("href") === `#${activeSection.id}`;
    link.classList.toggle("active", Boolean(isActive));
  });
}

window.addEventListener("scroll", () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      if (window.pageYOffset > 400) {
        if (backToTop) backToTop.style.display = "flex";
      } else {
        if (backToTop) backToTop.style.display = "none";
      }

      if (window.scrollY > 50) {
        if (header) header.classList.add("scrolled");
      } else {
        if (header) header.classList.remove("scrolled");
      }
      updateActiveNavLink();
      ticking = false;
    });
    ticking = true;
  }
});

updateActiveNavLink();

if (backToTop) {
  backToTop.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- 11. Statistics Counter Logic ---
const startCounters = (el) => {
  const counters = el.querySelectorAll(".counter");
  counters.forEach((counter) => {
    if (counter.dataset.started === "true") return;
    counter.dataset.started = "true";

    const target = +counter.getAttribute("data-target");
    const increment = target / 60; // سرعة العداد

    const updateCount = () => {
      const count = +counter.innerText.replace("+", "");
      if (count < target) {
        counter.innerText = Math.ceil(count + increment) + "+";
        setTimeout(updateCount, 30);
      } else {
        counter.innerText = target + "+";
      }
    };
    updateCount();
  });
};

// --- 12. Intersection Observer (Animations) ---
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        if (
          entry.target.classList.contains("stats") ||
          entry.target.querySelector(".counter")
        ) {
          startCounters(entry.target);
        }
      }
    });
  },
  { threshold: 0.15 },
);

document
  .querySelectorAll(".reveal, .stats")
  .forEach((el) => observer.observe(el));

// --- 13. Hero Slider ---
let slides = document.querySelectorAll(".slide");
let slideIdx = 0;
if (slides.length > 0) {
  const sliderInterval = setInterval(() => {
    slides[slideIdx].classList.remove("active");
    slideIdx = (slideIdx + 1) % slides.length;
    slides[slideIdx].classList.add("active");
  }, 5000);

  window.addEventListener("beforeunload", () => clearInterval(sliderInterval));
}

// --- 14. Chatbot Logic (Free Local Engine) ---
const USE_FREE_LOCAL_ASSISTANT = true;
const CHAT_API_URL =
  window.CONTINENTAL_CHAT_API_URL ||
  (window.location.port === "8787"
    ? "/api/chat"
    : "http://127.0.0.1:8787/api/chat");

function toggleChat(event) {
  if (event) event.stopPropagation();
  const chatWindow = document.getElementById("chatWindow");
  if (!chatWindow) return;
  const isHidden =
    chatWindow.style.display === "none" || chatWindow.style.display === "";
  chatWindow.style.display = isHidden ? "flex" : "none";
  chatWindow.classList.toggle("is-open", isHidden);
  document
    .getElementById("botBtn")
    ?.setAttribute("aria-expanded", String(isHidden));

  if (isHidden) {
    const messagesDiv = document.getElementById("chatMessages");
    if (messagesDiv && messagesDiv.children.length === 0) {
      setTimeout(() => {
        const welcomeMsg =
          currentLang === "ar"
            ? "مرحباً بك في كونتيننتال! أنا كون ايليت، كيف يمكنني مساعدتك؟"
            : "Welcome to Continental! I am Con Elite, how can I help you?";
        addMessage(welcomeMsg, "bot");
      }, 500);
    }
  }
}

document.addEventListener("click", (event) => {
  const chatWindow = document.getElementById("chatWindow");
  const chatWidget = document.querySelector(".chat-widget");
  if (!chatWindow || !chatWidget) return;

  const isOpen = chatWindow.style.display === "flex";
  if (
    isOpen &&
    !chatWidget.contains(event.target) &&
    !event.target.closest(".ai-special-btn")
  ) {
    chatWindow.style.display = "none";
    chatWindow.classList.remove("is-open");
    document.getElementById("botBtn")?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target?.id === "botBtn"
  ) {
    event.preventDefault();
    toggleChat(event);
    return;
  }

  if (event.key !== "Escape") return;
  const chatWindow = document.getElementById("chatWindow");
  if (chatWindow && chatWindow.style.display === "flex") {
    chatWindow.style.display = "none";
    chatWindow.classList.remove("is-open");
    document.getElementById("botBtn")?.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("beforeunload", () => {
  activeNewsRefs.forEach((ref) => ref.off());
});

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  if (USE_FREE_LOCAL_ASSISTANT) {
    setTimeout(() => {
      addMessage(getFreeAssistantReply(message), "bot");
    }, 450);
    return;
  }

  const typingId = "typing-" + Date.now();
  const messagesDiv = document.getElementById("chatMessages");
  if (!messagesDiv) return;

  const typingDiv = document.createElement("div");
  typingDiv.id = typingId;
  typingDiv.className = "typing";
  typingDiv.innerHTML = "<span></span><span></span><span></span>";
  messagesDiv.appendChild(typingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  try {
    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        language: currentLang,
      }),
    });

    if (!response.ok) throw new Error("Chat request failed");

    const data = await response.json();
    document.getElementById(typingId)?.remove();
    addMessage(data.text || "...", "bot");
  } catch (error) {
    document.getElementById(typingId)?.remove();
    addMessage(
      currentLang === "ar"
        ? "تعذر الاتصال بالمساعد حالياً. يرجى المحاولة لاحقاً."
        : "Could not connect to the assistant right now. Please try again later.",
      "bot",
    );
  }
}

function addMessage(text, sender) {
  const messagesDiv = document.getElementById("chatMessages");
  if (!messagesDiv) return;

  const msgElement = document.createElement("div");
  msgElement.className = `message ${sender} active`;

  String(text)
    .split(/(https?:\/\/[^\s]+)/g)
    .forEach((part) => {
      if (/^https?:\/\/[^\s]+$/.test(part)) {
        const link = document.createElement("a");
        link.href = part;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.color = "inherit";
        link.style.textDecoration = "underline";
        link.textContent = part;
        msgElement.appendChild(link);
      } else {
        msgElement.appendChild(document.createTextNode(part));
      }
    });

  messagesDiv.appendChild(msgElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

document.getElementById("chatInput")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

function getFreeAssistantReply(message) {
  const text = message.toLowerCase();
  const isArabic = /[\u0600-\u06ff]/.test(message) || currentLang === "ar";

  const replies = {
    greeting: {
      ar: "أنا كون ايليت. أستطيع مساعدتك في معلومات اعتماد النوع في اليمن، متطلبات وزارة الاتصالات، الأجهزة اللاسلكية، الوثائق، المدة، التجديد، والتواصل.",
      en: "I am Con Elite. I can help with Yemen Type Approval, telecom authority requirements, wireless devices, documents, timelines, renewals, and contact details.",
    },
    authority: {
      ar: "اعتماد النوع في اليمن يرتبط بقطاع الاتصالات وتقنية المعلومات وبالجهات المختصة بتنظيم أجهزة الاتصالات والراديو. بسبب الوضع الإداري الحالي، قد تختلف الجهة أو المسار حسب المنطقة المستهدفة مثل صنعاء أو عدن. ننصح دائمًا بتحديد وجهة الاستيراد والسوق المستهدف قبل بدء الطلب.",
      en: "Type Approval in Yemen is connected to the telecom and information technology regulatory authorities responsible for radio and telecom equipment. Because of the current administrative situation, the applicable path may depend on the target region, such as Sana'a or Aden. Always define the import destination and target market before submission.",
    },
    dualAuthority: {
      ar: "قد يحتاج المنتج إلى مسار موافقة منفصل حسب المنطقة المستهدفة داخل اليمن. بعض الحالات تتطلب مراعاة سلطتي صنعاء وعدن، ولا ينبغي افتراض أن شهادة واحدة تغطي كل المناطق. تواصل معنا لنحدد لك المسار الأنسب حسب الشحنة والوجهة.",
      en: "Some products may need separate approval paths depending on the target region in Yemen. In some cases, Sana'a and Aden authorities must be considered separately, and one certificate should not automatically be assumed to cover all areas. Contact us so we can advise based on shipment route and destination.",
    },
    scope: {
      ar: "الأجهزة التي تحتاج غالبًا اعتماد نوع تشمل: الهواتف، الراوترات، أجهزة Wi-Fi وBluetooth، أجهزة الاتصالات الخلوية 2G/3G/4G/5G، أجهزة الأقمار الصناعية، أجهزة الراديو، نقاط الوصول، المودم، أجهزة IoT، الكاميرات اللاسلكية، أجهزة التتبع GPS، وأي جهاز يستخدم ترددات راديوية أو يتصل بشبكات الاتصالات.",
      en: "Devices that often require Type Approval include mobile phones, routers, Wi-Fi and Bluetooth devices, 2G/3G/4G/5G equipment, satellite devices, radios, access points, modems, IoT devices, wireless cameras, GPS trackers, and any product using radio frequencies or connecting to telecom networks.",
    },
    requirements: {
      ar: "المتطلبات الأساسية عادة تشمل: نموذج الطلب، ملف TCF الفني، تقرير/تقارير اختبار من مختبر معتمد، إعلان المطابقة DoC، خطاب التفويض LoA، دليل المستخدم، المواصفات الفنية، صور الجهاز من عدة جهات، المخططات الفنية، وبيانات الشركة المصنعة والموديل. قد تختلف المتطلبات حسب نوع الجهاز والتقنية.",
      en: "Typical requirements include the application form, TCF dossier, accredited test reports, Declaration of Conformity, Letter of Authorization, user manual, technical specifications, product photos from multiple sides, schematic diagrams, and manufacturer/model details. Requirements may vary by product and technology.",
    },
    timeline: {
      ar: "المدة تختلف حسب الجهة، اكتمال الوثائق، وعدد الطلبات قيد المراجعة. غالبًا يمكن توقع عدة أسابيع عمل، وقد تمتد المدة إذا كانت التقارير ناقصة أو إذا طُلبت توضيحات أو عينات. تجهيز الملف بشكل صحيح من البداية يقلل التأخير.",
      en: "Lead time depends on the authority, document completeness, and review queue. It often takes several working weeks, and may take longer if reports are incomplete or clarifications/samples are requested. A clean submission file reduces delays.",
    },
    price: {
      ar: "تختلف التكلفة حسب نوع الجهاز والخدمة المطلوبة. للحصول على عرض سعر دقيق، اضغط على زر طلب تسعيرة أو راسلنا عبر واتساب.",
      en: "Pricing depends on the device type and required service. For an accurate quote, use the Request a Quote button or contact us on WhatsApp.",
    },
    renewal: {
      ar: "نعم، نوفر خدمة تجديد شهادات اعتماد النوع. يفضل بدء التجديد قبل انتهاء الشهادة بوقت كافٍ، خصوصًا إذا تغير الموديل أو البرنامج أو مكونات الراديو أو تقارير الاختبار.",
      en: "Yes, we provide Type Approval renewal. It is best to start before expiry, especially if the model, software, radio module, or test reports have changed.",
    },
    contact: {
      ar: "يمكنك التواصل معنا عبر الهاتف أو واتساب: +967 772299400، أو البريد الإلكتروني: Continental231@gmail.com.",
      en: "You can contact us by phone or WhatsApp: +967 772299400, or email: Continental231@gmail.com.",
    },
    samples: {
      ar: "في أغلب الحالات تكفي تقارير الاختبار من مختبرات معتمدة، لكن قد تطلب الجهة المختصة عينة فعلية لبعض الأجهزة أو التقنيات.",
      en: "In most cases, accredited test reports are sufficient, but the authority may request a physical sample for some devices or technologies.",
    },
    standards: {
      ar: "عادة تُراجع أجهزة الاتصالات وفق جوانب السلامة الكهربائية، التوافق الكهرومغناطيسي EMC، استخدام الترددات الراديوية RF، وتقارير مطابقة دولية مثل CE/RED أو تقارير مختبرات معتمدة. المهم أن تكون التقارير واضحة وتطابق نفس الموديل المراد إدخاله إلى اليمن.",
      en: "Telecom devices are commonly reviewed against electrical safety, EMC, RF/radio requirements, and international conformity evidence such as CE/RED or accredited lab reports. Reports should clearly match the exact model intended for Yemen.",
    },
    labels: {
      ar: "متطلبات الملصقات قد تختلف حسب الحالة والجهة، لكن في كثير من الحالات لا يكون هناك ملصق اعتماد يمني إلزامي مثل بعض الدول الأخرى. مع ذلك يجب التأكد قبل الشحن لأن المتطلبات قد تتغير.",
      en: "Labeling requirements may vary by case and authority, but in many cases Yemen does not require a special local approval label like some other markets. Still, this should be confirmed before shipment because requirements can change.",
    },
    localRep: {
      ar: "في كثير من طلبات اعتماد النوع، يحتاج المصنع أو المورد الأجنبي إلى وكيل أو ممثل محلي للتعامل مع الإجراءات والمراسلات وتقديم المستندات. كونتيننتال تساعد في هذا الدور وتتابع الملف حتى صدور الشهادة.",
      en: "For many Type Approval applications, a foreign manufacturer or supplier needs a local representative to manage procedures, correspondence, and document submission. Continental can support this role and follow the file until certificate issuance.",
    },
    providerGuidance: {
      ar: "لا أقدم قوائم بأسماء شركات أو مختبرات بعينها. لاختيار جهة مناسبة، ركز على نطاق الاعتماد الحالي، مطابقة الاختبارات للموديل نفسه، خبرة الجهة في السوق المستهدف، وضوح التقارير، وسهولة التحقق من التفويضات. ويمكن لكونتيننتال مساعدتك في مراجعة الملف وتحديد المتطلبات المناسبة لليمن.",
      en: "I do not provide lists of specific companies or labs. To choose a suitable provider, focus on current accreditation scope, reports that match the exact model, experience in the target market, report clarity, and verifiable authorizations. Continental can help review the file and identify the right requirements for Yemen.",
    },
    process: {
      ar: "الخطوات العامة: نحدد نوع الجهاز والوجهة، نراجع الوثائق، نجهز نموذج الطلب وخطاب التفويض، نتحقق من تقارير الاختبار، نقدم الملف للجهة المختصة، نتابع الملاحظات، ثم نستلم الشهادة عند الموافقة.",
      en: "General process: identify product and destination, review documents, prepare application and authorization letter, check test reports, submit to the authority, follow up on comments, then receive the certificate upon approval.",
    },
    technologies: {
      ar: "التقنيات التي نراجعها تشمل Wi-Fi، Bluetooth، GSM، UMTS، LTE، 5G، GPS، NFC، RFID، LoRa، Zigbee، أجهزة الأقمار الصناعية، وأجهزة الشبكات والراوترات. لكل تقنية تقارير ومتطلبات فنية مختلفة.",
      en: "Technologies we review include Wi-Fi, Bluetooth, GSM, UMTS, LTE, 5G, GPS, NFC, RFID, LoRa, Zigbee, satellite devices, networking equipment, and routers. Each technology may require different technical evidence.",
    },
    globalMarket: {
      ar: "عالمياً، الموافقات النوعية تشمل تحليل الدولة المستهدفة، الجهة المنظمة، الترددات، RF/EMC/Safety/SAR، الأمن السيبراني لبعض أجهزة IoT، الملصقات، الوكيل المحلي، صلاحية الشهادة، التجديد، ومتابعة جاهزية السوق. تختلف المسميات حسب السوق: FCC في أمريكا، ISED في كندا، CE/RED في أوروبا، UKCA في بريطانيا، MIC/TELEC في اليابان، KC في كوريا، WPC/BIS في الهند، SRRC/CCC/NAL في الصين حسب المنتج، ANATEL في البرازيل، IFETEL في المكسيك، NTRA في مصر، CST في السعودية، TDRA في الإمارات، وغيرها. تنبيه: المتطلبات والترددات والجهات قد تتغير مع الوقت، لذلك يلزم تأكيد رسمي للموديل والدولة وتاريخ التقديم.",
      en: "Globally, Type Approval covers target-country analysis, authority rules, spectrum, RF/EMC/Safety/SAR, cybersecurity for some IoT products, labeling, local representative needs, certificate validity, renewal, and market-readiness follow-up. Market names vary: FCC in the USA, ISED in Canada, CE/RED in Europe, UKCA in the UK, MIC/TELEC in Japan, KC in Korea, WPC/BIS in India, SRRC/CCC/NAL in China depending on product, ANATEL in Brazil, IFETEL in Mexico, NTRA in Egypt, CST in Saudi Arabia, TDRA in the UAE, and others. Note: requirements, frequencies, and authority practices may change over time, so final confirmation is needed for the exact model, country, and submission date.",
    },
    globalProcess: {
      ar: "الخطوات العالمية المعتادة: تحديد الدول المستهدفة، تحليل التقنيات والترددات، تحديد الاختبارات المطلوبة، تجهيز التقارير والوثائق، اختيار وكيل محلي إذا لزم، تقديم الطلب، الرد على ملاحظات الجهة، ثم استلام الشهادة ومتابعة التجديد.",
      en: "A typical global approval process is: identify target countries, analyze technologies and frequencies, define required tests, prepare reports and documents, appoint a local representative if required, submit the application, answer authority comments, receive the certificate, and track renewal.",
    },
    usa: {
      ar: "في الولايات المتحدة، أجهزة الراديو والاتصالات تخضع غالبًا لمتطلبات FCC. لا يجوز تسويق أو استيراد أجهزة تستخدم الطيف الراديوي إلا بعد استيفاء مسار التفويض المناسب مثل certification أو declaration/supplier conformity حسب نوع الجهاز.",
      en: "In the United States, radio and telecom devices are commonly subject to FCC equipment authorization. RF devices generally cannot be marketed or imported until the correct authorization route is completed, such as certification or supplier/declaration conformity depending on the product.",
    },
    europe: {
      ar: "في الاتحاد الأوروبي، أجهزة الراديو عادة تخضع لتوجيه RED وعلامة CE. الملف الفني يشمل تقييم السلامة، EMC، RF، دليل المستخدم، إعلان المطابقة، وقد يحتاج Notified Body لبعض الحالات أو إذا لم تطبق المعايير المنسقة بالكامل.",
      en: "In the European Union, radio equipment is generally covered by the Radio Equipment Directive and CE marking. The technical file includes safety, EMC, RF assessment, user information, Declaration of Conformity, and sometimes Notified Body involvement if harmonized standards are not fully applied.",
    },
    canada: {
      ar: "في كندا، الأجهزة اللاسلكية والراديوية تخضع عادة لاعتماد ISED. غالبًا تحتاج تقارير اختبار مطابقة للمعايير الكندية، رقم اعتماد، ومعلومات ملصق ودليل مستخدم مناسبة للسوق الكندي.",
      en: "In Canada, wireless and radio devices are commonly subject to ISED certification. They usually require test reports against Canadian standards, certification identification, and suitable labeling/user information for the Canadian market.",
    },
    uk: {
      ar: "في بريطانيا، يتم استخدام UKCA للمنتجات المشمولة بعد خروجها من الاتحاد الأوروبي، مع متطلبات قريبة من CE في كثير من المجالات. يجب التحقق من المتطلبات حسب نوع المنتج وتاريخ التطبيق.",
      en: "In the United Kingdom, UKCA is used for covered products after Brexit, with requirements often close to CE in many areas. Requirements should be checked by product type and current implementation date.",
    },
    asia: {
      ar: "في آسيا تختلف الجهات حسب الدولة: الصين قد تتطلب SRRC/NAL/CCC حسب المنتج، اليابان MIC/TELEC، كوريا KC، الهند WPC/BIS، تايوان NCC، وسنغافورة IMDA. كل سوق له نماذج وترددات وقواعد ملصقات مختلفة.",
      en: "In Asia, authorities vary by country: China may require SRRC/NAL/CCC depending on product, Japan MIC/TELEC, Korea KC, India WPC/BIS, Taiwan NCC, and Singapore IMDA. Each market has its own forms, frequency rules, and labeling requirements.",
    },
    gcc: {
      ar: "في دول الخليج، أجهزة الاتصالات واللاسلكي غالبًا تحتاج موافقة من الجهة الوطنية مثل CST في السعودية، TDRA في الإمارات، CRA في قطر، TRA في البحرين وعُمان، وCITRA في الكويت. وجود CE/FCC يساعد لكنه لا يغني دائمًا عن الموافقة المحلية.",
      en: "In GCC countries, telecom and wireless products often require approval from the national authority, such as CST in Saudi Arabia, TDRA in the UAE, CRA in Qatar, TRA in Bahrain/Oman, and CITRA in Kuwait. CE/FCC evidence helps but does not always replace local approval.",
    },
    mena: {
      ar: "في الشرق الأوسط وشمال أفريقيا، الاعتماد النوعي غالبًا يعتمد على تقارير RF/EMC/Safety، خطاب تفويض، وكيل محلي أحيانًا، ونماذج حكومية. أمثلة الجهات تشمل NTRA في مصر، ANRT في المغرب، TRC في الأردن، والجهات الوطنية في العراق ولبنان وتونس والجزائر وليبيا والسودان.",
      en: "In the Middle East and North Africa, Type Approval commonly relies on RF/EMC/Safety reports, authorization letter, sometimes a local representative, and authority forms. Examples include Egypt NTRA, Morocco ANRT, Jordan TRC, and national authorities in Iraq, Lebanon, Tunisia, Algeria, Libya, and Sudan.",
    },
    africa: {
      ar: "في أفريقيا، كثير من الدول تطلب اعتماد نوع قبل الاستيراد أو البيع. أمثلة: ICASA في جنوب أفريقيا، NCC في نيجيريا، CA في كينيا، NCA في غانا، ARCEP/ARTP/ARPT حسب الدولة. المتطلبات قد تشمل عينة، وكيل محلي، تقارير CE/FCC، رسوم حكومية، ومدة مراجعة تختلف كثيرًا.",
      en: "In Africa, many countries require Type Approval before import or sale. Examples include ICASA in South Africa, NCC in Nigeria, CA in Kenya, NCA in Ghana, and ARCEP/ARTP/ARPT depending on country. Requirements may include samples, local representative, CE/FCC reports, government fees, and variable review timelines.",
    },
    latinAmerica: {
      ar: "في أمريكا اللاتينية، المتطلبات تختلف بشكل كبير. أمثلة: ANATEL في البرازيل، IFETEL في المكسيك، ENACOM في الأرجنتين، SUBTEL في تشيلي. بعض الدول تطلب اختبارًا محليًا أو ممثلًا محليًا أو ملصقات خاصة.",
      en: "In Latin America, requirements vary widely. Examples include ANATEL in Brazil, IFETEL in Mexico, ENACOM in Argentina, and SUBTEL in Chile. Some markets require local testing, a local representative, or special labeling.",
    },
    labReports: {
      ar: "تقارير المختبرات المهمة عادة تشمل RF للترددات، EMC للتداخل الكهرومغناطيسي، Safety للسلامة الكهربائية، SAR للأجهزة القريبة من جسم الإنسان مثل الهواتف، وأحيانًا RoHS أو كفاءة الطاقة حسب السوق. يجب أن يطابق التقرير نفس اسم الموديل والنسخة.",
      en: "Important lab reports usually include RF for radio performance, EMC for electromagnetic compatibility, Safety for electrical safety, SAR for body-worn devices such as phones, and sometimes RoHS or energy efficiency depending on market. Reports must match the exact model and version.",
    },
    frequency: {
      ar: "الترددات يجب تأكيدها دائماً من الخطة الوطنية للطيف والجهة المختصة لأن المعلومات قد تتغير مع الوقت. كدليل مهني عام: Wi‑Fi وBluetooth غالباً حول 2.4GHz، وWi‑Fi قد يعمل أيضاً في 5GHz وبعض الدول تسمح 6GHz بشروط؛ NFC شائع عند 13.56MHz؛ GNSS عادة استقبال فقط مثل GPS/GLONASS/Galileo/BeiDou؛ RFID قد يكون HF أو UHF حسب البلد؛ LoRa/ISM تختلف كثيراً بين 433/868/915MHz؛ أجهزة 2G/3G/4G/5G تعتمد على نطاقات المشغلين والترخيص المحلي؛ وأجهزة الأقمار الصناعية أو أجهزة الإرسال عالية القدرة تحتاج تدقيقاً خاصاً وقد تتطلب ترخيصاً إضافياً. قبل الشحن إلى اليمن يجب مراجعة الموديل، قدرة الإرسال، الهوائي، نطاقات التشغيل، والغرض من الاستخدام.",
      en: "Frequencies must always be confirmed against the current national spectrum plan and authority rules because information can change over time. As professional general guidance: Wi‑Fi and Bluetooth commonly use 2.4GHz; Wi‑Fi may also use 5GHz and, in some countries, 6GHz under conditions; NFC is commonly 13.56MHz; GNSS is usually receive-only such as GPS/GLONASS/Galileo/BeiDou; RFID may be HF or UHF depending on country; LoRa/ISM varies widely around 433/868/915MHz; 2G/3G/4G/5G devices depend on operator bands and local authorization; satellite or high-power transmit devices need special review and may require additional licensing. Before shipping to Yemen, review the exact model, output power, antenna, operating bands, and intended use.",
    },
    modelChanges: {
      ar: "أي تغيير في وحدة الراديو، الهوائي، البرنامج، القدرة، رقم الموديل، أو تصميم الدائرة قد يؤثر على الشهادة. أحيانًا يكفي تحديث ملف، وأحيانًا يحتاج طلبًا جديدًا أو اختبارات إضافية.",
      en: "Changes to radio module, antenna, software, power, model number, or circuit design may affect the certificate. Sometimes a file update is enough, while other cases require a new application or additional testing.",
    },
    batteries: {
      ar: "إذا كان الجهاز يحتوي بطارية أو شاحن، فقد تحتاج متطلبات إضافية مثل السلامة الكهربائية، النقل UN38.3 للبطاريات، تقارير الشاحن، أو متطلبات كفاءة الطاقة حسب البلد.",
      en: "If the product includes a battery or charger, additional requirements may apply, such as electrical safety, UN38.3 battery transport tests, charger reports, or energy efficiency rules depending on the country.",
    },
    privacyCyber: {
      ar: "بعض الأسواق بدأت تضيف متطلبات للأمن السيبراني والخصوصية، خصوصًا لأجهزة IoT والكاميرات والراوترات. قد تشمل كلمات مرور افتراضية آمنة، تحديثات أمنية، حماية بيانات المستخدم، وإرشادات واضحة في الدليل.",
      en: "Some markets are adding cybersecurity and privacy requirements, especially for IoT devices, cameras, and routers. These may include secure default passwords, security updates, user data protection, and clear user instructions.",
    },
    disclaimer: {
      ar: "تنبيه: هذه معلومات عامة للمساعدة فقط وليست قرارًا رسميًا. المتطلبات قد تختلف حسب الجهة، المنطقة، نوع الجهاز، وتاريخ التقديم. للتأكيد النهائي، أرسل لنا موديل الجهاز والمستندات المتوفرة.",
      en: "Note: This is general guidance, not an official decision. Requirements may vary by authority, region, product type, and submission date. For final confirmation, send us the device model and available documents.",
    },
    default: {
      ar: "أنا كون ايليت، مساعد كونتيننتال لاعتماد النوع. أستطيع مساعدتك في اليمن والعالم: الجهات، الترددات، FCC، CE/RED، ISED، UKCA، الخليج، أفريقيا، آسيا، المختبرات، الوثائق، التجديد، وتقييم مخاطر الجهاز. ملاحظة مهمة: معلومات الترددات والمتطلبات قد تتغير مع الوقت ويجب تأكيدها رسمياً قبل الشحن أو التقديم.",
      en: "I am Con Elite, Continental's Type Approval assistant. I can help with Yemen and global approvals: authorities, frequencies, FCC, CE/RED, ISED, UKCA, GCC, Africa, Asia, labs, documents, renewals, and device risk review. Important note: frequency and requirement information may change over time and must be officially confirmed before shipment or submission.",
    },
  };

  let key = "default";

  if (/hello|hi|مرحبا|السلام|اهلا|أهلا/.test(text)) key = "greeting";
  else if (/ministry|mtit|authority|regulator|وزارة|الاتصالات|جهة|الجهة|تنظيم/.test(text)) key = "authority";
  else if (/sana|sanaa|aden|dual|two|separate|صنعاء|عدن|جهتين|سلطتين|منطقتين/.test(text)) key = "dualAuthority";
  else if (/device|equipment|product|radio|wireless|wifi|bluetooth|router|iot|gps|satellite|هاتف|جهاز|أجهزة|لاسلكي|راوتر|واي فاي|بلوتوث|اقمار|أقمار|تتبع/.test(text)) key = "scope";
  else if (/require|document|doc|file|tcf|doc|loa|manual|report|متطلبات|وثائق|مستندات|اوراق|أوراق|تقارير|دليل|تفويض|مطابقة/.test(text)) key = "requirements";
  else if (/how long|time|duration|مدة|كم تستغرق|وقت/.test(text)) key = "timeline";
  else if (/price|cost|quote|سعر|تكلفة|تسعير|تسعيرة/.test(text)) key = "price";
  else if (/renew|valid|expiry|تجديد|صلاحية|انتهاء/.test(text)) key = "renewal";
  else if (/contact|phone|email|whatsapp|تواصل|رقم|هاتف|واتساب|ايميل|إيميل/.test(text)) key = "contact";
  else if (/sample|test|مختبر|اختبار|عينة|عينات/.test(text)) key = "samples";
  else if (/standard|ce|red|emc|rf|safety|معيار|معايير|سلامة|توافق|كهرومغناطيسي|تردد/.test(text)) key = "standards";
  else if (/label|mark|ملصق|وسم|علامة/.test(text)) key = "labels";
    else if (/representative|agent|local|وكيل|ممثل|محلي/.test(text)) key = "localRep";
  else if (/company|companies|provider|providers|lab|labs|manufacturer|importer|distributor|operator|شركة|شركات|مزود|مزودين|مصنع|مصنعين|مستورد|موزع|مختبرات|جهات اعتماد/.test(text)) key = "providerGuidance";
  else if (/process|steps|procedure|خطوات|اجراءات|إجراءات|طريقة/.test(text)) key = "process";
  else if (/5g|4g|lte|gsm|umts|nfc|rfid|lora|zigbee|تقنية|تقنيات/.test(text)) key = "technologies";
  else if (/global|world|international|worldwide|homologation|gma|عالمي|العالم|دولي|دولية|الموافقات النوعية العالمية/.test(text)) key = "globalMarket";
  else if (/approval process|global process|roadmap|workflow|مسار|خطة|خارطة/.test(text)) key = "globalProcess";
  else if (/fcc|usa|united states|america|أمريكا|امريكا|الولايات/.test(text)) key = "usa";
  else if (/ce|red|europe|eu|european|أوروبا|اوروبا|الاتحاد الأوروبي/.test(text)) key = "europe";
  else if (/ised|canada|كندا/.test(text)) key = "canada";
  else if (/ukca|united kingdom|britain|بريطانيا|المملكة المتحدة/.test(text)) key = "uk";
  else if (/china|japan|korea|india|taiwan|singapore|asia|الصين|اليابان|كوريا|الهند|تايوان|سنغافورة|آسيا/.test(text)) key = "asia";
  else if (/gcc|gulf|saudi|uae|qatar|oman|bahrain|kuwait|الخليج|السعودية|الإمارات|الامارات|قطر|عمان|البحرين|الكويت/.test(text)) key = "gcc";
  else if (/mena|middle east|north africa|egypt|jordan|morocco|iraq|lebanon|الشرق الأوسط|الشرق الاوسط|شمال أفريقيا|مصر|الأردن|المغرب|العراق|لبنان/.test(text)) key = "mena";
  else if (/africa|south africa|nigeria|kenya|ghana|أفريقيا|افريقيا|جنوب أفريقيا|نيجيريا|كينيا|غانا/.test(text)) key = "africa";
  else if (/brazil|mexico|latin|argentina|chile|البرازيل|المكسيك|لاتينية|الأرجنتين|تشيلي/.test(text)) key = "latinAmerica";
  else if (/lab|report|sar|rohs|مختبر|تقرير|تقارير/.test(text)) key = "labReports";
  else if (/frequency|band|spectrum|تردد|ترددات|طيف/.test(text)) key = "frequency";
  else if (/change|variant|antenna|software|module|تغيير|نسخة|هوائي|برنامج|موديول|وحدة/.test(text)) key = "modelChanges";
  else if (/battery|charger|un38|بطارية|شاحن/.test(text)) key = "batteries";
  else if (/cyber|privacy|security|iot security|أمن|امن|خصوصية|سيبراني/.test(text)) key = "privacyCyber";
  else if (/official|guarantee|legal|رسمي|مضمون|قانوني|تأكيد/.test(text)) key = "disclaimer";

  return replies[key][isArabic ? "ar" : "en"];
}

setupConnectionMonitor();
registerServiceWorker();
