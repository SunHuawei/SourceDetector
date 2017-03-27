'use strict';

chrome.browserAction.setBadgeText({text: ''});

let sourceFileList = {}
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {

    chrome.tabs.query({'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT},
      function(tabs){
        if (details.type === 'script' && /\.js$/.test(details.url) && !(/^chrome-extension:\/\//.test(details.url))) {
          tryGetMap(details.url, (url, content) => {
            if (isValidSourceMap(content)) {
              sourceFileList[url] = {content, page: tabs[0]}
              setBadgeText(Object.keys(sourceFileList).length)
            }
          })
        }
      }
    );
  },
  {
    urls: ['<all_urls>']
  }
);

const setBadgeText = (num) => {
  let text = num > 0 ? '' + num : ''
  chrome.browserAction.setBadgeText({text: text});
}

const tryGetMap = (url, callback) => {
  setTimeout(() => {
    fetch(url + '.map').then(resp => {
      if (resp.status === 200) {
        resp.text().then(text => {
          callback(resp.url, text);
        })
      }
    }).catch(err => {
      console.log(err)
    })
  }, 300);
}

const isValidSourceMap = (rawSourceMap) => {
  try {
    const SourceMapConsumer = sourceMap.SourceMapConsumer
    const consumer = new SourceMapConsumer(rawSourceMap);

    return consumer.hasContentsOfAllSources()
  } catch(e) {
    console.log(e)
  }

  return false;
}

chrome.extension.onConnect.addListener(function(port) {
  port.postMessage(Object.keys(sourceFileList).map(key => (
    {
      url: key,
      content: sourceFileList[key].content,
      page: sourceFileList[key].page
    }
  )))
})