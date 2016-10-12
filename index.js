'use strict';
const path = require('path');
const electron = require('electron');
const { BrowserWindow } = electron;
const unusedFilename = require('unused-filename');
const request = require("request");

const app = electron.app;
let downloadFolder = app.getPath("downloads");

let queue = [];

function _registerListener(win, opts = {}, cb = () => {}) {

    downloadFolder = opts.downloadFolder || downloadFolder;

    const listener = (e, item, webContents) => {

        let queueItem = _popQueueItem(item.getURL());

        const filePath = unusedFilename.sync(
            path.join(downloadFolder, path.join(queueItem.path, item.getFilename()))
        );

        item.setSavePath(filePath);

        item.on('done', (e, state) => {

            let finishedDownloadCallback = queueItem.callback || function() {};

            if (!win.isDestroyed()) {
                win.setProgressBar(-1);
            }

            if (state === 'interrupted') {
                const message = `The download of ${item.getFilename()} was interrupted`;

                finishedDownloadCallback(new Error(message), item.getURL())

            } else if (state === 'completed') {
                if (process.platform === 'darwin') {
                    app.dock.downloadFinished(filePath);
                }
                // TODO: remove this listener, and/or the listener that attach this listener to newly created windows
                // if (opts.unregisterWhenDone) {
                //     webContents.session.removeListener('will-download', listener);
                // }

                finishedDownloadCallback(null, item.getURL());

            }

        });
    };

    win.webContents.session.on('will-download', listener);
}

var register = (opts = {}) => {

    app.on('browser-window-created', (e, win) => {
        _registerListener(win, opts);
    });
};

var download = (options, callback) => {
    let win = BrowserWindow.getFocusedWindow();
    options = Object.assign({}, {
        path: ""
    }, options);

    request(options.url).on("response", function(response) {
        response.request.abort();

        queue.push({
            url: response.request.uri.href,
            path: options.path.toString(),
            callback: callback
        });

        win.webContents.downloadURL(options.url);
    })

}

var bulkDownload = (options, callback) => {

    options = Object.assign({}, {
        urls: [],
        path: ""
    }, options);

    let urlsCount = options.urls.length;
    let finished = [];
    let errors = [];

    options.urls.forEach((url) => {
        download({
            url,
            path: options.path
        }, function(error, item) {

            if (error) {
                errors.push(item);
            } else {
                finished.push(item);
            }

            let errorsCount = errors.length;
            let finishedCount = finished.length;

            if ((finishedCount + errorsCount) == urlsCount) {
                if (errorsCount > 0) {
                    callback(new Error(errorsCount + " downloads failed"), finished, errors);
                } else {
                    callback(null, finished, []);
                }
            }
        })
    });
}

var _popQueueItem = (url) => {
    let queueItem = queue.find(item => item.url === url);
    queue.splice(queue.indexOf(queueItem), 1);
    return queueItem;
}

module.exports = {
    register,
    download,
    bulkDownload
}
