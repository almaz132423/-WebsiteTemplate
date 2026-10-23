(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let config = null;
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
    renderServices();
    updatePreview();
  };
  const renderServices = () => {
    const container = $("#services-editor");
    container.replaceChildren();
    if (!config.services.length) {
      const empty = document.createElement("p"); empty.className = "admin-help"; empty.textContent = "Услуг пока нет. Нажмите «Добавить услугу»."; container.append(empty);
    }
    config.services.forEach((service, index) => {
      const card = document.createElement("article"); card.className = "service-editor-card";
      const top = document.createElement("div"); top.className = "service-editor-top";
      const heading = document.createElement("strong"); heading.textContent = "Услуга " + String(index + 1).padStart(2, "0");
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "delete-service"; remove.textContent = "Удалить";
      remove.addEventListener("click", () => { config.services.splice(index, 1); renderServices(); updatePreview(); status("Услуга удалена из текущего черновика. Экспортируйте JSON, чтобы сохранить изменения."); });
      top.append(heading, remove);
      const fields = document.createElement("div"); fields.className = "service-editor-fields";
      const name = makeInput("Название услуги", service.name, false);
      const description = makeInput("Описание", service.description, true);
      const price = makeInput("Цена или пометка «Уточняйте»", service.price, false);
      const duration = makeInput("Продолжительность", service.duration, false);
      description.wrapper.classList.add("wide");
      [[name, "name"], [description, "description"], [price, "price"], [duration, "duration"]].forEach(([item, key]) => {
        item.control.addEventListener("input", () => {
          config.services[index][key] = item.control.value;
          if (key === "name") heading.textContent = item.control.value.trim() ? "Услуга " + String(index + 1).padStart(2, "0") + " — " + item.control.value.trim() : "Услуга " + String(index + 1).padStart(2, "0");
          updatePreview();
        });
        fields.append(item.wrapper);
      });
      card.append(top, fields); container.append(card);
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
  const exportConfig = () => {
    updatePreview();
    const blob = new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "business.json"; document.body.append(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    status("Конфигурация экспортирована. Замените config/business.json в проекте.");
  };
  const loadFile = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      config = ensureShape(parsed);
      renderForm();
      status("Конфигурация импортирована в редактор. Экспортируйте JSON, чтобы скачать результат.");
    } catch (error) {
      status("Не удалось импортировать JSON: " + error.message, true);
    }
  };
  const init = async () => {
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
  };
  $("#add-service").addEventListener("click", () => {
    if (!config) return;
    config.services.push({ id: "service-" + Date.now(), name: "", description: "", price: "", duration: "", image: "", imageAlt: "" });
    renderServices(); updatePreview(); status("Добавлена новая услуга. Заполните поля и экспортируйте JSON.");
  });
  $("#export-config").addEventListener("click", exportConfig);
  $("#download-current").addEventListener("click", exportConfig);
  $("#import-config").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) loadFile(file);
    event.target.value = "";
  });
  $$(".admin-fields input, .admin-fields textarea").forEach(control => control.addEventListener("input", updatePreview));
  init();
})();