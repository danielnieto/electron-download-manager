'use strict';
const path = require('path');
const electron = require('electron');
const { BrowserWindow } = electron;
const request = require("request");

const app = electron.app;
let downloadFolder = app.getPath("downloads");
let lastWindowCreated;

let queue = [];

function _registerListener(win, opts = {}, cb = () => {}) {

    lastWindowCreated = win;
    downloadFolder = opts.downloadFolder || downloadFolder;

    const listener = (e, item, webContents) => {

        let queueItem = _popQueueItem(item.getURL());

        const filePath = path.join(downloadFolder, path.join(queueItem.path, item.getFilename()));

        const totalBytes = item.getTotalBytes();

        item.setSavePath(filePath);

        // Resuming an interupted download
        if (item.getState() === 'interrupted') {
            item.resume();
        }

        item.on('updated', () => {
            const progress = item.getReceivedBytes() * 100 / totalBytes;

            if (typeof queueItem.onProgress === 'function') {
                queueItem.onProgress(progress, item);
            }
        });

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

var fs = require('fs');

var download = (options, callback) => {
    let win = BrowserWindow.getFocusedWindow() || lastWindowCreated;
    options = Object.assign({}, {
        path: ""
    }, options);

    request(options.url).on("response", function(response) {
        response.request.abort();

        queue.push({
            url: response.request.uri.href,
            path: options.path.toString(),
            callback: callback,
            onProgress: options.onProgress
        });

        const filename = path.basename(response.request.uri.href);

        const filePath = path.join(path.join(downloadFolder, options.path.toString()), filename);

        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);

            const fileOffset = stats.size;

            const serverFileSize = parseInt(response.headers["content-length"]);

            console.log(filename + ' exists, verifying file size: (' + fileOffset + ' / ' + serverFileSize + " downloaded)");

            // Check if size on disk is lower than server
            if (fileOffset < serverFileSize) {
                console.log('File needs re-downloaded as it was not completed');

                options = {
                    path: filePath,
                    urlChain: [response.request.uri.href],
                    offset: parseInt(fileOffset),
                    length: serverFileSize,
                    lastModified: response.headers["last-modified"]
                };

                win.webContents.session.createInterruptedDownload(options);
            } else {
                console.log(filename + ' verified, no download needed');

                let finishedDownloadCallback = callback || function() {};

                finishedDownloadCallback(null, response.request.uri.href);
            }

        } else {
            console.log(filename + ' does not exist, download it now');
            win.webContents.downloadURL(options.url);
        }
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
