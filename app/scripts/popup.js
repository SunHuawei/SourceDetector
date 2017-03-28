'use strict';

var port = chrome.extension.connect({
  name: 'Communication to BackGround'
});

port.postMessage('getAllSourceFiles');
port.onMessage.addListener(function (list) {
  contentMap = list.reduce(function (map, item) {
    map[item.url] = item.content;
    return map;
  }, {});

  renderDOM(renderGroups(list), document.getElementById("app"));
});

var contentMap = {};
var renderGroups = function renderGroups(list) {
  var group = _.groupBy(list, function (file) {
    return file.page.url;
  });

  return createVDOM(
    'div',
    { className: 'panel' },
    createVDOM(
      'p',
      { className: 'actions' },
      createVDOM(
        'a',
        { href: '#', onclick: downloadAll },
        'Download All'
      )
    ),
    createVDOM(
      'p',
      { className: 'content' },
      Object.keys(group).map(function (url) {
        return createVDOM(
          'div',
          { className: 'group' },
          createVDOM(
            'div',
            { className: 'title' },
            createVDOM(
              'a',
              { href: group[url][0].page.url, target: '_blank' },
              group[url][0].page.title,
              '(',
              group[url][0].page.url,
              ')'
            )
          ),
          createVDOM(
            'ul',
            null,
            group[url].map(function (file) {
              return createVDOM(
                'li',
                null,
                createVDOM(
                  'div',
                  null,
                  createVDOM(
                    'a',
                    { className: 'url', href: file.url, onclick: download },
                    file.url
                  )
                ),
                createVDOM(
                  'div',
                  { className: 'fileSize' },
                  fileSizeIEC(file.content.length)
                )
              );
            })
          )
        );
      })
    )
  );
};

var download = function download(e) {
  var filename = parseFileName(e.target.href);
  try {
    parseSourceMap(filename, contentMap[e.target.href]);
  } catch (e) {
    console.log(e);
  }
};

var downloadAll = function downloadAll(e) {
  var errors = [];
  Object.keys(contentMap).forEach(function (key) {
    var filename = parseFileName(key);
    try {
      parseSourceMap(filename, contentMap[key]);
    } catch (e) {
      errors.push(e);
    }
  });

  console.log(errors);
};

var parseFileName = function parseFileName(path) {
  var filename = path.split('/');
  return filename[filename.length - 1];
};

var parseSourceMap = function parseSourceMap(sourceMapFileName, rawSourceMap) {
  var SourceMapConsumer = sourceMap.SourceMapConsumer;
  var consumer = new SourceMapConsumer(rawSourceMap);

  if (consumer.hasContentsOfAllSources()) {
    var zip = new JSZip();

    var img = zip.folder('images');
    consumer.sources.forEach(function (fileName) {
      if (fileName.indexOf('webpack://') !== 0) {
        return;
      }

      var fileContent = consumer.sourceContentFor(fileName);
      fileName = fileName.replace(/^webpack:\/\//, '');
      fileName = fileName.replace(/^\//, '');
      fileName = fileName.replace(/^\~\//, 'node_modules/');
      addZipFile(zip, fileName, fileContent);
    });

    return zip.generateAsync({ type: 'blob' }).then(function (content) {
      var reader = new FileReader();
      reader.readAsDataURL(content);
      reader.onloadend = function () {
        chrome.downloads.download({ filename: sourceMapFileName + '.zip', url: reader.result });
      };
    });
  } else {
    console.log('TODO');
  }
};

var addZipFile = function addZipFile(root, filename, content) {
  var folders = filename.split('/');
  var folder = root;
  for (var i = 0; i < folders.length - 1; i++) {
    folder = folder.folder(folders[i]);
  }

  folder.file(folders[folders.length - 1], content);
};

function fileSizeIEC(a, b, c, d, e) {
  return (b = Math, c = b.log, d = 1024, e = c(a) / c(d) | 0, a / b.pow(d, e)).toFixed(2) + ' ' + (e ? 'KMGTPEZY'[--e] + 'B' : 'Bytes');
}