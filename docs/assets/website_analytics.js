(function () {
  "use strict";

  var measurementId = "G-2RPFT5BD5W";
  var productionHost = "sunhuawei.github.io";
  var supportedEvents = {
    install_intent: true,
    outbound_click: true,
    language_switch: true
  };

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Keep production analytics clean by only sending from GitHub Pages host.
  if (window.location.hostname !== productionHost) {
    return;
  }

  var dataLayer = (window.dataLayer = window.dataLayer || []);
  function gtag() {
    dataLayer.push(arguments);
  }

  window.gtag = window.gtag || gtag;
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
    anonymize_ip: true
  });

  loadGaScript(measurementId);

  var baseParams = getBaseParams();
  window.gtag("event", "page_view", baseParams);
  document.addEventListener("click", onTrackedClick, true);

  function onTrackedClick(event) {
    if (!event.target || typeof event.target.closest !== "function") {
      return;
    }

    var trackedLink = event.target.closest("a[data-analytics-event]");
    if (!trackedLink) {
      return;
    }

    var eventName = sanitizeEnum(trackedLink.dataset.analyticsEvent);
    if (!supportedEvents[eventName]) {
      return;
    }

    var eventParams = {
      page_language: baseParams.page_language,
      page_type: baseParams.page_type,
      page_path: baseParams.page_path
    };

    assignParam(eventParams, "cta_name", trackedLink.dataset.analyticsCtaName);
    assignParam(eventParams, "cta_location", trackedLink.dataset.analyticsCtaLocation);
    assignParam(eventParams, "destination_type", trackedLink.dataset.analyticsDestinationType);
    assignParam(eventParams, "target_language", trackedLink.dataset.analyticsTargetLanguage);

    if (trackedLink.dataset.analyticsIncludeDestinationUrl === "true") {
      assignParam(eventParams, "destination_url", normalizeDestinationUrl(trackedLink.href));
    }

    window.gtag("event", eventName, eventParams);
  }

  function getBaseParams() {
    return {
      page_language: getPageLanguage(),
      page_type: getPageType(),
      page_path: normalizePath(window.location.pathname)
    };
  }

  function getPageLanguage() {
    var rawLang = (document.documentElement.lang || "en").toLowerCase();
    if (rawLang === "zh-cn" || rawLang === "zh") {
      return "zh-CN";
    }
    if (rawLang === "ja") {
      return "ja";
    }
    return "en";
  }

  function getPageType() {
    var datasetType = sanitizeEnum(document.body && document.body.dataset.pageType);
    if (datasetType) {
      return datasetType;
    }

    var path = normalizePath(window.location.pathname);
    if (path.indexOf("/privacy/") === 0) {
      return "privacy";
    }
    if (path.indexOf("/faq/") === 0) {
      return "faq";
    }
    if (path.indexOf("/404") === 0) {
      return "not_found";
    }
    return "home";
  }

  function loadGaScript(id) {
    var gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    gaScript.referrerPolicy = "strict-origin-when-cross-origin";
    document.head.appendChild(gaScript);
  }

  function assignParam(target, key, value) {
    var cleanValue = sanitizeEnum(value);
    if (cleanValue) {
      target[key] = cleanValue;
    }
  }

  function sanitizeEnum(value) {
    if (typeof value !== "string") {
      return "";
    }

    var normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_");
    if (!normalized) {
      return "";
    }
    return normalized.slice(0, 80);
  }

  function normalizePath(pathname) {
    if (typeof pathname !== "string" || pathname.length === 0) {
      return "/";
    }

    var projectPath = pathname;
    if (projectPath.indexOf("/SourceDetector/") === 0) {
      projectPath = projectPath.slice("/SourceDetector".length);
    }

    return projectPath.split("?")[0].split("#")[0] || "/";
  }

  function normalizeDestinationUrl(rawHref) {
    if (!rawHref) {
      return "";
    }

    try {
      var url = new URL(rawHref, window.location.origin);
      return url.origin + url.pathname;
    } catch (error) {
      return "";
    }
  }
})();
