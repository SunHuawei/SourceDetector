"use strict";

let port = chrome.extension.connect({
  name: "Communication to BackGround",
});

port.postMessage("getAllSourceFiles");
port.onMessage.addListener(function (list) {
  contentMap = list.reduce((map, item) => {
    map[item.url] = item.content;
    return map;
  }, {});

  renderDOM(renderGroups(list), document.getElementById("app"));
});

let contentMap = {};
const renderGroups = (list) => {
  let group = _.groupBy(list, (file) => file.page.url);

  return (
    <div className="panel">
      <p className="actions">
        <a href="#" onclick={downloadAll}>
          Download All
        </a>
      </p>
      <p className="content">
        {Object.keys(group).map((url) => (
          <div className="group">
            <div className="title">
              <a href={group[url][0].page.url} target="_blank">
                {group[url][0].page.title}({group[url][0].page.url})
              </a>
            </div>
            <ul>
              {group[url].map((file) => (
                <li>
                  <div>
                    <a className="url" href={file.url} onclick={download}>
                      {file.url}
                    </a>
                  </div>
                  <div className="fileSize">
                    {fileSizeIEC(file.content.length)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </p>
    </div>
  );
};

const download = (e) => {
  let filename = parseFileName(e.target.href);
  try {
    parseSourceMap(filename, contentMap[e.target.href]);
  } catch (e) {
    console.log(e);
  }
};

const downloadAll = (e) => {
  let errors = [];
  Object.keys(contentMap).forEach((key) => {
    let filename = parseFileName(key);
    try {
      parseSourceMap(filename, contentMap[key]);
    } catch (e) {
      errors.push(e);
    }
  });

  console.log(errors);
};

const parseFileName = (path) => {
  let filename = path.split("/");
  return filename[filename.length - 1];
};

const parseSourceMap = (sourceMapFileName, rawSourceMap) => {
  const SourceMapConsumer = sourceMap.SourceMapConsumer;
  const consumer = new SourceMapConsumer(rawSourceMap);

  if (consumer.hasContentsOfAllSources()) {
    var zip = new JSZip();

    var img = zip.folder("images");
    consumer.sources.forEach((fileName) => {
      if (fileName.indexOf("webpack://") !== 0) {
        return;
      }

      let fileContent = consumer.sourceContentFor(fileName);
      fileName = fileName.replace(/^webpack:\/\//, "");
      fileName = fileName.replace(/^\//, "");
      fileName = fileName.replace(/^\~\//, "node_modules/");
      addZipFile(zip, fileName, fileContent);
    });

    return zip.generateAsync({ type: "blob" }).then(function (content) {
      var reader = new FileReader();
      reader.readAsDataURL(content);
      reader.onloadend = () => {
        chrome.downloads.download({
          filename: sourceMapFileName + ".zip",
          url: reader.result,
        });
      };
    });
  } else {
    console.log("TODO");
  }
};

const addZipFile = (root, filename, content) => {
  let folders = filename.split("/");
  let folder = root;
  for (let i = 0; i < folders.length - 1; i++) {
    folder = folder.folder(folders[i]);
  }

  folder.file(folders[folders.length - 1], content);
};

function fileSizeIEC(a, b, c, d, e) {
  return (
    ((b = Math),
    (c = b.log),
    (d = 1024),
    (e = (c(a) / c(d)) | 0),
    a / b.pow(d, e)).toFixed(2) +
    " " +
    (e ? "KMGTPEZY"[--e] + "B" : "Bytes")
  );
}
