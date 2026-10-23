(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { config: null, selectedService: null, lastFocused: null, toastTimer: null };
  const dialog = $("#booking-dialog");
  const form = $("#booking-form");
  const fieldsContainer = $("#form-fields");
  const preview = $("#message-preview");
  const messageText = $("#message-text");
  const formError = $("#form-error");

  const safeText = (value, fallback = "") => typeof value === "string" ? value.trim() : fallback;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const digits = (value) => String(value || "").replace(/\D/g, "");
  const dateToday = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const displayDate = (value) => {
    if (!value) return "";
    const date = new Date(value + "T12:00:00");
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date);
  };
  const showToast = (message) => {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3500);
  };
  const setTheme = (theme = {}) => {
    const root = document.documentElement;
    const allowed = { background: "--bg", surface: "--surface", text: "--text", muted: "--muted", accent: "--accent", border: "--border" };
    Object.entries(allowed).forEach(([key, cssVar]) => {
      if (typeof theme[key] === "string" && /^#[0-9a-f]{3,8}$/i.test(theme[key])) root.style.setProperty(cssVar, theme[key]);
    });
  };
  const setContent = (config) => {
    const { business = {}, contacts = {}, seo = {} } = config;
    const name = safeText(business.name, "Название компании") || "Название компании";
    document.title = safeText(seo.title, name);
    $('meta[name="description"]').content = safeText(seo.description);
    $('meta[property="og:title"]').content = safeText(seo.ogTitle, name);
    $('meta[property="og:description"]').content = safeText(seo.ogDescription, safeText(seo.description));
    if (seo.ogImage) $('meta[property="og:image"]').content = seo.ogImage;
    $("#brand-name").textContent = name;
    $("#footer-name").textContent = name;
    $("#footer-company").textContent = name;
    $("#current-year").textContent = new Date().getFullYear();
    $("#hero-eyebrow").textContent = safeText(business.type, "Услуги для вас");
    $("#hero-title").textContent = safeText(business.heroTitle, "Качество, которому можно доверять.");
    $("#hero-description").textContent = safeText(business.heroDescription, safeText(business.description));
    $("#hero-note").textContent = safeText(business.heroNote);
    $("#hero-image").setAttribute("aria-label", safeText(business.heroImageAlt, "Тематическое изображение компании"));
    $("#hero-image-caption").textContent = safeText(business.heroImageCaption, name);
    if (business.heroImage) {
      $("#hero-image").style.backgroundImage = 'linear-gradient(180deg,transparent 48%,rgba(23,33,29,.42)),url("' + String(business.heroImage).replace(/["\\]/g, "") + '")';
    }
    $("#about-title").innerHTML = escapeHtml(safeText(business.aboutTitle, "Внимание к деталям. Понятный подход.")).replace(/\.\s+/g, ".<br>");
    $("#about-description").textContent = safeText(business.aboutDescription);
    $("#about-points").innerHTML = (Array.isArray(business.aboutPoints) ? business.aboutPoints : []).filter(Boolean).map((point, i) => '<div class="about-point"><span>0' + (i + 1) + '</span><div>' + escapeHtml(point) + '</div></div>').join("");
    $("#contact-intro").textContent = safeText(config.booking?.intro, "Выберите услугу и отправьте заявку удобным способом.");
    $("#contact-address").textContent = safeText(contacts.address, "Укажите адрес компании");
    $("#contact-hours").textContent = safeText(contacts.hours, "Укажите график работы");
    $("#footer-description").textContent = safeText(business.description);
    const phone = safeText(contacts.phone);
    const phoneLink = $("#contact-phone");
    phoneLink.textContent = phone || "Укажите телефон";
    phoneLink.href = phone ? "tel:" + phone.replace(/[^+\d]/g, "") : "#contacts";
    const headerPhone = $("#header-phone");
    headerPhone.textContent = phone || "Контакты";
    headerPhone.href = phone ? "tel:" + phone.replace(/[^+\d]/g, "") : "#contacts";
    const route = $("#route-link");
    if (contacts.routeUrl && /^https?:\/\//i.test(contacts.routeUrl)) { route.href = contacts.routeUrl; route.hidden = false; }
    else route.hidden = true;
    renderContactMessengers(config.messengers || {});
  };
  const renderContactMessengers = (messengers) => {
    const container = $("#contact-messengers");
    const labels = { whatsapp: "WhatsApp", telegram: "Telegram", max: "MAX" };
    container.innerHTML = "";
    Object.entries(labels).forEach(([key, label]) => {
      const item = messengers[key];
      if (!item?.enabled) return;
      const url = key === "whatsapp" ? (digits(item.phone) ? "https://wa.me/" + digits(item.phone) : "") : (item.url || "");
      if (!url || !/^https:\/\//i.test(url)) return;
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = label;
      container.append(a);
    });
    if (!container.children.length) container.textContent = "Добавьте ссылки в конфигурацию";
  };
  const renderServices = () => {
    const list = $("#services-list");
    const services = Array.isArray(state.config.services) ? state.config.services : [];
    if (!services.length) { list.innerHTML = '<p class="empty-state">Добавьте услуги в config/business.json.</p>'; return; }
    list.innerHTML = services.map((service, index) => {
      const price = safeText(service.price) ? escapeHtml(service.price) : "Уточняйте";
      const duration = safeText(service.duration);
      return '<article class="service-card"><div class="service-top"><span class="service-index">УСЛУГА / ' + String(index + 1).padStart(2, "0") + '</span><span class="service-arrow" aria-hidden="true">↗</span></div><h3>' + escapeHtml(service.name || "Название услуги") + '</h3><p>' + escapeHtml(service.description || "") + '</p><div class="service-meta"><span class="service-price">' + price + '</span><span class="service-duration">' + (duration ? escapeHtml(duration) : "") + '</span></div><button class="service-book" type="button" data-service-id="' + escapeHtml(service.id || String(index)) + '">Оставить заявку <span aria-hidden="true">↗</span></button></article>';
    }).join("");
  };
  const createField = (field, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-field" + (field.type === "textarea" ? " full-width" : "");
    const id = "booking-field-" + index;
    const label = document.createElement("label");
    label.className = "field-label"; label.htmlFor = id;
    label.append(document.createTextNode(safeText(field.label, field.name || "Поле")));
    if (field.required) { const required = document.createElement("span"); required.className = "required"; required.textContent = " *"; label.append(required); }
    let control;
    if (field.type === "textarea") control = document.createElement("textarea");
    else if (field.type === "select") control = document.createElement("select");
    else {
      const supported = ["text", "date", "time", "number", "email", "tel"];
      control = document.createElement("input");
      control.type = supported.includes(field.type) ? field.type : "text";
    }
    control.id = id; control.name = field.name || "field_" + index;
    control.required = Boolean(field.required);
    control.placeholder = safeText(field.placeholder);
    control.autocomplete = field.name === "name" ? "name" : "off";
    if (field.type === "date") control.min = dateToday();
    if (field.type === "number") {
      if (Number.isFinite(Number(field.min))) control.min = String(field.min);
      if (Number.isFinite(Number(field.max))) control.max = String(field.max);
      control.step = "1";
    }
    if (field.type === "select") {
      const blank = document.createElement("option"); blank.value = ""; blank.textContent = safeText(field.placeholder, "Выберите вариант"); control.append(blank);
      (Array.isArray(field.options) ? field.options : []).forEach(option => {
        const opt = document.createElement("option");
        if (typeof option === "string") { opt.value = option; opt.textContent = option; }
        else { opt.value = option.value ?? ""; opt.textContent = option.label ?? option.value ?? ""; }
        control.append(opt);
      });
    }
    const error = document.createElement("p"); error.className = "field-error"; error.id = id + "-error"; error.hidden = true;
    control.setAttribute("aria-describedby", error.id);
    control.addEventListener("input", () => clearFieldError(control, error));
    wrapper.append(label, control, error);
    return wrapper;
  };
  const clearFieldError = (control, error) => { control.removeAttribute("aria-invalid"); error.hidden = true; error.textContent = ""; };
  const renderFormFields = () => {
    fieldsContainer.replaceChildren();
    const fields = Array.isArray(state.config.booking?.fields) ? state.config.booking.fields : [];
    fields.forEach((field, index) => fieldsContainer.append(createField(field, index)));
  };
  const getService = (id) => (state.config.services || []).find((service, index) => String(service.id || index) === String(id));
  const openBooking = (service = null) => {
    state.lastFocused = document.activeElement;
    state.selectedService = service || state.selectedService || null;
    $("#selected-service-name").textContent = state.selectedService?.name || "Не выбрана";
    $("#change-service").hidden = !(state.config.services || []).length;
    form.hidden = false; preview.hidden = true; formError.hidden = true;
    renderFormFields();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("dialog-open");
    $(".dialog-close").focus();
  };
  const closeBooking = () => {
    if (dialog.open) dialog.close();
    document.body.classList.remove("dialog-open");
    if (state.lastFocused?.focus) state.lastFocused.focus();
  };
  const validateForm = () => {
    let valid = true;
    const controls = $$("input,textarea,select", fieldsContainer);
    controls.forEach(control => {
      const error = $("#" + control.id + "-error");
      clearFieldError(control, error);
      let message = "";
      if (control.required && !control.value.trim()) message = "Заполните это поле.";
      else if (control.type === "date" && control.value && control.value < dateToday()) message = "Выберите сегодняшнюю или будущую дату.";
      else if (control.type === "number" && control.value !== "" && !control.checkValidity()) message = "Проверьте введённое число.";
      else if (control.type === "email" && control.value && !control.checkValidity()) message = "Введите корректный адрес электронной почты.";
      if (message) {
        valid = false; control.setAttribute("aria-invalid", "true"); error.textContent = message; error.hidden = false;
      }
    });
    if (!state.selectedService && (state.config.services || []).length) {
      valid = false; formError.textContent = "Сначала выберите услугу."; formError.hidden = false;
    } else formError.hidden = true;
    if (!valid) {
      const firstInvalid = controls.find(control => control.getAttribute("aria-invalid") === "true");
      firstInvalid?.focus();
    }
    return valid;
  };
  const collectFields = () => {
    const labels = new Map((state.config.booking?.fields || []).map(field => [field.name, field.label]));
    return $$("input,textarea,select", fieldsContainer).map(control => {
      const value = control.value.trim();
      if (!value) return null;
      let formatted = value;
      if (control.type === "date") formatted = displayDate(value);
      return { name: labels.get(control.name) || control.name, value: formatted };
    }).filter(Boolean);
  };
  const makeMessage = (values) => {
    const businessName = safeText(state.config.business?.name, "Название компании");
    const serviceName = state.selectedService?.name || "Не указана";
    const fieldLines = values.map(field => field.name + ": " + field.value).join("\n");
    const template = safeText(state.config.booking?.messageTemplate, "Здравствуйте! Хочу оставить заявку в {{businessName}}.\nУслуга: {{serviceName}}\n{{fields}}");
    return template.replace(/\{\{businessName\}\}/g, businessName).replace(/\{\{serviceName\}\}/g, serviceName).replace(/\{\{fields\}\}/g, fieldLines).split("\n").filter(line => !/^\s*$/.test(line)).join("\n");
  };
  const messengerSettings = (key) => state.config.messengers?.[key] || {};
  const messengerUrl = (key, message) => {
    const settings = messengerSettings(key);
    if (!settings.enabled) return "";
    if (key === "whatsapp") {
      const phone = digits(settings.phone);
      return phone ? "https://wa.me/" + phone + "?text=" + encodeURIComponent(message) : "";
    }
    const url = safeText(settings.url);
    return /^https:\/\//i.test(url) ? url : "";
  };
  const renderMessengerActions = () => {
    const container = $("#messenger-actions");
    container.replaceChildren();
    const labels = { whatsapp: "WhatsApp ↗", telegram: "Telegram ↗", max: "MAX ↗" };
    Object.keys(labels).forEach(key => {
      const url = messengerUrl(key, messageText.value);
      const button = document.createElement("button");
      button.type = "button"; button.className = "button " + (key === "whatsapp" ? "" : "button-outline");
      button.textContent = labels[key]; button.disabled = !url;
      button.title = url ? "" : "Добавьте подтверждённые контактные данные в config/business.json";
      button.addEventListener("click", async () => {
        const latestUrl = messengerUrl(key, messageText.value);
        if (!latestUrl) { showToast("Настройте контакт мессенджера в конфигурации."); return; }
        if (key !== "whatsapp") {
          try { await copyText(messageText.value); }
          catch (_) { showToast("Скопируйте текст сообщения вручную перед переходом."); }
          $("#messenger-instructions").textContent = "Текст скопирован, если браузер разрешил копирование. В открывшемся мессенджере вставьте сообщение и самостоятельно отправьте его.";
        }
        const link = document.createElement("a");
        link.href = latestUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
        document.body.append(link); link.click(); link.remove();
        showToast(key === "whatsapp" ? "Проверьте сообщение в WhatsApp и самостоятельно отправьте его." : "Вставьте подготовленный текст в мессенджере и отправьте его самостоятельно.");
      });
      container.append(button);
    });
  };
  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const temporary = document.createElement("textarea");
    temporary.value = text; temporary.setAttribute("readonly", ""); temporary.style.position = "fixed"; temporary.style.opacity = "0";
    document.body.append(temporary); temporary.select();
    const success = document.execCommand("copy"); temporary.remove();
    if (!success) throw new Error("copy_failed");
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    messageText.value = makeMessage(collectFields());
    form.hidden = true; preview.hidden = false;
    $("#copy-status").textContent = "";
    $("#messenger-instructions").textContent = "Выберите мессенджер. Для Telegram и MAX текст нужно вставить вручную, если сервис не поддерживает его автоматическую подстановку.";
    renderMessengerActions();
    $("#message-text").focus();
  });
  $("#copy-message").addEventListener("click", async () => {
    try { await copyText(messageText.value); $("#copy-status").textContent = "Текст скопирован."; }
    catch (_) { $("#copy-status").textContent = "Не удалось скопировать автоматически — выделите текст и скопируйте вручную."; }
  });
  messageText.addEventListener("input", renderMessengerActions);
  $("#back-to-form").addEventListener("click", () => { preview.hidden = true; form.hidden = false; $("#booking-form button[type=submit]").focus(); });
  $("#change-service").addEventListener("click", () => { closeBooking(); $("#services").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
  $(".dialog-close").addEventListener("click", closeBooking);
  dialog.addEventListener("click", event => { if (event.target === dialog) closeBooking(); });
  dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
  document.addEventListener("click", event => {
    const serviceButton = event.target.closest("[data-service-id]");
    if (serviceButton) { const service = getService(serviceButton.dataset.serviceId); if (service) openBooking(service); }
    else if (event.target.closest("[data-open-booking]")) openBooking(null);
  });
  const menuToggle = $(".menu-toggle");
  menuToggle.addEventListener("click", () => {
    const nav = $("#main-nav");
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    $(".menu-toggle .sr-only").textContent = open ? "Закрыть меню" : "Открыть меню";
  });
  $$("#main-nav a").forEach(link => link.addEventListener("click", () => {
    $("#main-nav").classList.remove("is-open"); menuToggle.setAttribute("aria-expanded", "false"); $(".menu-toggle .sr-only").textContent = "Открыть меню";
  }));
  const init = async () => {
    try {
      const response = await fetch("./config/business.json");
      if (!response.ok) throw new Error("Не удалось загрузить config/business.json");
      state.config = await response.json();
      setTheme(state.config.theme);
      setContent(state.config);
      renderServices();
      if (window.anime && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.anime({ targets: ".hero-copy > *, .hero-visual", translateY: [16, 0], opacity: [0, 1], delay: window.anime.stagger(90), duration: 650, easing: "easeOutCubic" });
      }
    } catch (error) {
      console.error(error);
      $("#services-list").innerHTML = '<p class="empty-state">Не удалось загрузить конфигурацию. Запустите сайт через локальный веб-сервер и проверьте файл config/business.json.</p>';
      showToast("Ошибка загрузки конфигурации сайта.");
    }
  };
  init();
})();