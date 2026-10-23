( () => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const AUTH_KEY = "businessTemplate.adminCredential.v1";
  const SESSION_KEY = "businessTemplate.adminUnlocked.v1";
  let config = null;
  let editorInitialized = false;

  const authStatus = (message, isError = false) => {
    const node = $("#auth-status");
    node.textContent = message;
    node.classList.toggle("is-error", isError);
  };
  const hashPassword = async (password, salt) => {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Криптографический API недоступен. Откройте страницу по HTTPS или через localhost.");
    }
    const bytes = new TextEncoder().encode(salt + ":" + password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  };
  const randomSalt = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  };
  const showAuthMode = () => {
    const configured = Boolean(localStorage.getItem(AUTH_KEY));
    $("#auth-title").innerHTML = configured ? "Вход в <em>редактор.</em>" : "Задайте <em>пароль.</em>";
    $("#auth-description").textContent = configured
      ? "Введите пароль, сохранённый для этого браузера."
      : "Создайте пароль длиной не менее 8 символов. Он будет храниться локально в этом браузере.";
    $("#auth-confirm-label").hidden = configured;
    $("#auth-confirm").required = !configured;
    $("#auth-password").autocomplete = configured ? "current-password" : "new-password";
    $("#auth-submit").textContent = configured ? "Войти" : "Создать пароль";
  };
  const unlockAdmin = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    $("#auth-screen").hidden = true;
    $("#admin-app").hidden = false;
    initEditor();
  };
  const initAuth = () => {
    $("#auth-form").addEventListener("submit", async event => {
      event.preventDefault();
      const password = $("#auth-password").value;
      const confirm = $("#auth-confirm").value;
      if (password.length < 8) {
        authStatus("Пароль должен содержать не менее 8 символов.", true);
        return;
      }
      try {
        const saved = localStorage.getItem(AUTH_KEY);
        if (!saved) {
          if (password !== confirm) {
            authStatus("Пароли не совпадают.", true);
            return;
          }
          const salt = randomSalt();
          const hash = await hashPassword(password, salt);
          localStorage.setItem(AUTH_KEY, JSON.stringify({ salt, hash }));
          authStatus("Пароль создан. Редактор открыт.");
          unlockAdmin();
          return;
        }
        const credential = JSON.parse(saved);
        const hash = await hashPassword(password, credential.salt);
        if (hash !== credential.hash) {
          authStatus("Неверный пароль.", true);
          $("#auth-password").select();
          return;
        }
        authStatus("Вход выполнен.");
        unlockAdmin();
      } catch (error) {
        authStatus(error.message || "Не удалось выполнить вход.", true);
      }
    });
    $("#logout-admin").addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      $("#admin-app").hidden = true;
      $("#auth-screen").hidden = false;
      $("#auth-form").reset();
      showAuthMode();
      authStatus("Вы вышли из редактора.");
      $("#auth-password").focus();
    });
    showAuthMode();
    if (sessionStorage.getItem(SESSION_KEY) === "1") unlockAdmin();
  };

  const status = (message, isError = false) => {
    const node = $("#admin-status");
    node.textContent = message;
    node.classList.toggle("is-error", isError);
  };
  const setValue = (id, value) => { $("#" + id).value = value ?? ""; };
  const getValue = (id) => $("#" + id).value.trim();
  const ensureShape = (data) => {
    if (!data || typeof data !== "object" || !data.business || typeof data.business !== "object" || !Array.isArray(data.services)) {
      throw new Error("JSON должен содержать объект business и массив services.");
    }
    if (!data.contacts || typeof data.contacts !== "object") data.contacts = {};
    if (!data.messengers || typeof data.messengers !== "object") data.messengers = {};
    return data;
  };
  const renderForm = () => {
    setValue("business-name", config.business.name);
    setValue("business-type", config.business.type);
    setValue("business-description", config.business.description);
    setValue("business-hero-title", config.business.heroTitle);
    setValue("business-hero-description", config.business.heroDescription);
    setValue("business-hero-image", config.business.heroImage);
    setValue("contact-phone", config.contacts.phone);
    setValue("contact-address", config.contacts.address);
    setValue("contact-hours", config.contacts.hours);
    setValue("contact-route", config.contacts.routeUrl);
    setValue("messenger-whatsapp", config.messengers.whatsapp?.phone);
    setValue("messenger-telegram", config.messengers.telegram?.url);
    setValue("messenger-max", config.messengers.max?.url);
    setValue("sheets-csv-url", config.liveData?.csvUrl || "");
    setValue("sheets-write-url", config.liveData?.writeUrl || "");
    renderServices();
    updatePreview();
  };
  const renderServices = () => {
    const container = $("#services-editor");
    container.replaceChildren();
    if (!config.services.length) {
      const empty = document.createElement("p");
      empty.className = "admin-help";
      empty.textContent = "Услуг пока нет. Нажмите «Добавить услугу».";
      container.append(empty);
    }
    config.services.forEach((service, index) => {
      const card = document.createElement("article");
      card.className = "service-editor-card";
      const top = document.createElement("div");
      top.className = "service-editor-top";
      const heading = document.createElement("strong");
      heading.textContent = "Услуга " + String(index + 1).padStart(2, "0");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-service";
      remove.textContent = "Удалить";
      remove.addEventListener("click", () => {
        config.services.splice(index, 1);
        renderServices();
        updatePreview();
        status("Услуга удалена из текущего черновика. Экспортируйте JSON, чтобы сохранить изменения.");
      });
      top.append(heading, remove);
      const fields = document.createElement("div");
      fields.className = "service-editor-fields";
      const name = makeInput("Название услуги", service.name, false);
      const description = makeInput("Описание", service.description, true);
      const price = makeInput("Цена или пометка «Уточняйте»", service.price, false);
      const duration = makeInput("Продолжительность", service.duration, false);
      description.wrapper.classList.add("wide");
      [[name, "name"], [description, "description"], [price, "price"], [duration, "duration"]].forEach(([item, key]) => {
        item.control.addEventListener("input", () => {
          config.services[index][key] = item.control.value;
          if (key === "name") heading.textContent = item.control.value.trim()
            ? "Услуга " + String(index + 1).padStart(2, "0") + " — " + item.control.value.trim()
            : "Услуга " + String(index + 1).padStart(2, "0");
          updatePreview();
        });
        fields.append(item.wrapper);
      });
      card.append(top, fields);
      container.append(card);
    });
  };
  const makeInput = (labelText, value, textarea) => {
    const wrapper = document.createElement("label");
    wrapper.textContent = labelText;
    const control = document.createElement(textarea ? "textarea" : "input");
    if (!textarea) control.type = "text";
    if (textarea) control.rows = 3;
    control.value = value ?? "";
    wrapper.append(control);
    return { wrapper, control };
  };
  const readForm = () => {
    config.business.name = getValue("business-name");
    config.business.type = getValue("business-type");
    config.business.description = getValue("business-description");
    config.business.heroTitle = getValue("business-hero-title");
    config.business.heroDescription = getValue("business-hero-description");
    config.business.heroImage = getValue("business-hero-image");
    config.contacts.phone = getValue("contact-phone");
    config.contacts.address = getValue("contact-address");
    config.contacts.hours = getValue("contact-hours");
    config.contacts.routeUrl = getValue("contact-route");
    if (!config.messengers.whatsapp) config.messengers.whatsapp = { enabled: true, phone: "" };
    if (!config.messengers.telegram) config.messengers.telegram = { enabled: true, url: "" };
    if (!config.messengers.max) config.messengers.max = { enabled: true, url: "" };
    config.messengers.whatsapp.phone = getValue("messenger-whatsapp");
    config.messengers.telegram.url = getValue("messenger-telegram");
    config.messengers.max.url = getValue("messenger-max");
  };
  const updatePreview = () => {
    if (!config) return;
    readForm();
    $("#json-preview").textContent = JSON.stringify(config, null, 2);
  };
  const configToSheetRows = () => {
    updatePreview();
    const rows = [["type","key","value","id","name","description","price","duration","image","imageAlt"]];
    const add = (key, value) => rows.push(["settings", key, Array.isArray(value) ? value.join("|") : String(value ?? ""), "", "", "", "", "", "", ""]);
    const b = config.business || {}, c = config.contacts || {}, m = config.messengers || {}, booking = config.booking || {}, seo = config.seo || {};
    [
      ["business.name",b.name],["business.type",b.type],["business.description",b.description],
      ["business.heroTitle",b.heroTitle],["business.heroDescription",b.heroDescription],["business.heroNote",b.heroNote],
      ["business.heroImage",b.heroImage],["business.heroImageAlt",b.heroImageAlt],["business.heroImageCaption",b.heroImageCaption],
      ["business.aboutTitle",b.aboutTitle],["business.aboutDescription",b.aboutDescription],["business.aboutPoints",b.aboutPoints],
      ["contacts.phone",c.phone],["contacts.address",c.address],["contacts.hours",c.hours],["contacts.routeUrl",c.routeUrl],
      ["messengers.whatsapp.phone",m.whatsapp?.phone],["messengers.whatsapp.enabled",m.whatsapp?.enabled],
      ["messengers.telegram.url",m.telegram?.url],["messengers.telegram.enabled",m.telegram?.enabled],
      ["messengers.max.url",m.max?.url],["messengers.max.enabled",m.max?.enabled],
      ["booking.intro",booking.intro],["seo.title",seo.title],["seo.description",seo.description],
      ["seo.ogTitle",seo.ogTitle],["seo.ogDescription",seo.ogDescription]
    ].forEach(([key,value]) => { if (value !== undefined && value !== null) add(key,value); });
    (config.services || []).forEach((s,i) => rows.push(["service","","",s.id || "service-"+(i+1),s.name || "",s.description || "",s.price || "",s.duration || "",s.image || "",s.imageAlt || ""]));
    return rows;
  };
  const saveToSheets = async () => {
    updatePreview();
    const endpoint = getValue("sheets-write-url");
    const token = getValue("sheets-admin-token");
    if (!endpoint || !/^https:\/\/script\.google\.com\/macros\/s\//i.test(endpoint)) {
      status("Укажите URL опубликованного веб-приложения Google Apps Script.", true); return;
    }
    if (!token) { status("Введите секретный токен, настроенный в свойствах Google Apps Script.", true); return; }
    const button = $("#save-to-sheets");
    button.disabled = true;
    status("Отправляю данные в Google Таблицу…");
    try {
      const payload = { token, rows: configToSheetRows() };
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
      });
      config.liveData = config.liveData || {};
      config.liveData.csvUrl = getValue("sheets-csv-url");
      config.liveData.writeUrl = endpoint;
      status("Запрос отправлен. Проверьте Google Таблицу: из-за ограничений браузера сайт не может прочитать ответ скрипта.");
    } catch (error) {
      status("Не удалось отправить данные: " + error.message, true);
    } finally {
      button.disabled = false;
    }
  };
  const exportConfig = () => {
    updatePreview();
    const blob = new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "business.json";
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status("Конфигурация экспортирована. Замените config/business.json в проекте.");
  };
  const loadFile = async file => {
    try {
      const parsed = JSON.parse(await file.text());
      config = ensureShape(parsed);
      renderForm();
      status("Конфигурация импортирована в редактор. Экспортируйте JSON, чтобы скачать результат.");
    } catch (error) {
      status("Не удалось импортировать JSON: " + error.message, true);
    }
  };
  const initEditor = async () => {
    if (editorInitialized) {
      try {
        const response = await fetch("./config/business.json", { cache: "no-store" });
        if (!response.ok) throw new Error("Не удалось загрузить config/business.json");
        config = ensureShape(await response.json());
        renderForm();
        status("Конфигурация повторно загружена.");
      } catch (error) {
        status(error.message, true);
      }
      return;
    }
    editorInitialized = true;
    try {
      const response = await fetch("./config/business.json");
      if (!response.ok) throw new Error("Не удалось загрузить config/business.json");
      config = ensureShape(await response.json());
      renderForm();
      $$(".admin-fields input, .admin-fields textarea").forEach(control => control.addEventListener("input", updatePreview));
      status("Конфигурация загружена. Изменения пока находятся в памяти страницы.");
    } catch (error) {
      status(error.message + ". Запустите сайт через локальный веб-сервер или импортируйте JSON-файл.", true);
      config = { business: {}, contacts: {}, messengers: {}, services: [], booking: { fields: [] } };
    }
    $("#add-service").addEventListener("click", () => {
      if (!config) return;
      config.services.push({ id: "service-" + Date.now(), name: "", description: "", price: "", duration: "", image: "", imageAlt: "" });
      renderServices();
      updatePreview();
      status("Добавлена новая услуга. Заполните поля и экспортируйте JSON.");
    });
    $("#save-to-sheets").addEventListener("click", saveToSheets);
    $("#export-config").addEventListener("click", exportConfig);
    $("#download-current").addEventListener("click", exportConfig);
    $("#import-config").addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (file) loadFile(file);
      event.target.value = "";
    });
    $$(".admin-fields input, .admin-fields textarea").forEach(control => control.addEventListener("input", updatePreview));
  };

  initAuth();
})();