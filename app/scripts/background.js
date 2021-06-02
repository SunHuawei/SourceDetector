"use strict";

chrome.browserAction.setBadgeText({ text: "" });

var sourceFileList = {};
chrome.webRequest.onBeforeRequest.addListener(function (details) {
  chrome.tabs.query({ active: true, windowId: chrome.windows.WINDOW_ID_CURRENT }, function (tabs) {
    if (details.type === "script" && /\.js$/.test(details.url) && !/^chrome-extension:\/\//.test(details.url)) {
      tryGetMap(details.url, function (url, content) {
        if (isValidSourceMap(content)) {
          sourceFileList[url] = { content: content, page: tabs[0] };
          setBadgeText(Object.keys(sourceFileList).length);
        }
      });
    }
  });
}, {
  urls: ["<all_urls>"]
});

var setBadgeText = function setBadgeText(num) {
  var text = num > 0 ? "" + num : "";
  chrome.browserAction.setBadgeText({ text: text });
};

var tryGetMap = function tryGetMap(url, callback) {
  setTimeout(function () {
    fetch(url + ".map").then(function (resp) {
      if (resp.status === 200) {
        resp.text().then(function (text) {
          callback(resp.url, text);
        });
      }
    }).catch(function (err) {
      console.log(err);
    });
  }, 300);
};

var isValidSourceMap = function isValidSourceMap(rawSourceMap) {
  try {
    var SourceMapConsumer = sourceMap.SourceMapConsumer;
    var consumer = new SourceMapConsumer(rawSourceMap);

    return consumer.hasContentsOfAllSources();
  } catch (e) {
    console.log(e);
  }

  return false;
};

chrome.extension.onConnect.addListener(function (port) {
  port.postMessage(Object.keys(sourceFileList).map(function (key) {
    return {
      url: key,
      content: sourceFileList[key].content,
      page: sourceFileList[key].page
    };
  }));
});