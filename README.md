# electron-download-manager

> Manage downloadItems from [Electron](https://electronjs.org)'s BrowserWindows without user interaction, allowing single file download and bulk downloading asynchronously


## Why?

- Register global listener that attaches to all newly created BrowserWindow instances
- Automatically download the file to a given folder, without user prompt
- Callback when download has completed (or failed)
- Bulk download: pass a bunch of links and all will get downloaded, with a callback once they're all done.


## Install

```
$ npm install electron-download-manager
```


## Usage

### Register it for all windows

Register the listener (that will catch all DownloadItems)

```js
const electron = require("electron");
const { app, BrowserWindow } = electron;

const DownloadManager = require("electron-download-manager");

DownloadManager.register();

app.on("ready", () => {
    let mainWindow = new BrowserWindow();
});
```

### Examples

After registering you must wait until at least 1 window is created to call DownloadManager.download function

#### Single file download from the Main Process

```js
const electron = require("electron");
const { app, BrowserWindow } = electron;

const DownloadManager = require("electron-download-manager");

DownloadManager.register({
    downloadFolder: app.getPath("downloads") + "/my-app"
});

app.on("ready", () => {

    let mainWindow = new BrowserWindow();

    mainWindow.loadURL(`file://${__dirname}/app/index.html`);

    //Single file download
    DownloadManager.download({
        url: "https://i.imgur.com/H124sSq.jpg"
    }, function (error, info) {
        if (error) {
            console.log(error);
            return;
        }

        console.log("DONE: " + info.url);
    });

});
```

This example downloads *https://i.imgur.com/H124sSq.jpg* file to *user-downloads-folder/my-app/H124sSq.jpg*

#### Bulk file download from the Main Process

```js
const electron = require("electron");
const {app, BrowserWindow} = electron;

const DownloadManager = require("electron-download-manager");

DownloadManager.register({downloadFolder: app.getPath("downloads") + "/my-app"});;

app.on("ready", () => {
    let mainWindow = new BrowserWindow();

    mainWindow.loadURL(`file://${__dirname}/app/index.html`);

    var links = [
        "https://i.imgur.com/xineeuw.jpg",
        "https://i.imgur.com/RguiWa6.jpg",
        "https://i.imgur.com/JR4Z0aD.jpg",
        "https://i.imgur.com/ccvEJO1.jpg",
        "https://i.imgur.com/yqZoShd.jpg"
    ];

    //Bulk file download    
    DownloadManager.bulkDownload({
        urls: links,
        path: "bulk-download"
    }, function (error, finished, errors) {
        if (error) {
            console.log("finished: " + finished);
            console.log("errors: " + errors);
            return;
        }

        console.log("all finished");
    });

});


```
This example downloads 5 files to *user-downloads-folder/my-app/bulk-downloads*

#### Use from Renderer Process

Once you've registered the listener on the Main process at any time you can call the download function through electron's [`remote`](https://electronjs.org/docs/api/remote)

```js
require("electron").remote.require("electron-download-manager").download({
    url: "https://i.imgur.com/H124sSq.jpg"
}, function (error, info) {
    if (error) {
        console.log(error);
        return;
    }

    console.log("DONE: " + info.url);
});
```

## API

### DownloadManager.register([options])

### options

#### downloadFolder

Type: `string`<br>
Default: `app.getPath("downloads")]`

Set a folder where all downloadItems will be downloaded to. It will also be the parent folder for individual folders of each download. Explained below in Download function.

By default, this "root" folder will be user's OS downloads folder
([read about this](http://electron.atom.io/docs/api/app/#appgetpathname))

If the file already exists in the location it will check the file's size against the size on the server, if it is lower than the server it will attempt to resume downloading the file. This is good for downloading large files. E.G Downloading a 200MB file and only 100MB downloaded (app closed/crashed) it will resume the download from where it left off automatically.

If the file size on the disk is the same as the server it will not download and return a successful callback.

### DownloadManager.download(options, callback(error, {url, filePath}))

### options

#### url
Type: `string`

The url of the file to be downloaded

#### path
Type: `string`<br>
Default: `""`

Set a folder where this downloadItems will be downloaded to. This folder is relative to downloadFolder location set in the register function. By default it will be downloaded to root of downloadFolder which would be user download's folder.

#### onLogin(authInfo, callback)
Type: `function`<br>

Emitted when an authenticating proxy is asking for user credentials.

```js
    DownloadManager.download({
        url: "https://i.imgur.com/H124sSq.jpg",
        onLogin: (authInfo, callback) => {
            callback('username', 'password');
        },
    }, function (error, info) {
        if (error) {
            console.log(error);
            return;
        }

        console.log("DONE: " + info.url);
    });

```

> Please see [Class ClientRequest's 'login' event](http://electronjs.org/docs/api/client-request#event-login) for detail.

#### onProgress(progress, item)
Type: `function`<br>

A function to be called whenever the file being downloaded progresses, this function will be constantly called with the updated value. 

`progress` an object with various metrics for the downloading file
```
{
    downloaded          // downloaded amount in ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    downloadedBytes     // same as previous only in bytes for calculation if required (eg. 4061073)
    progress            // float progress of downloaing file (0 to 100)
    remaining           // remaining amount of file download in ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] (eg. 28.36 MB)
    remainingBytes      // same as previous only in bytes for calculation if required (eg. 28360919)
    speed               // download speed (eg. 311.3 KB/sec)
    speedBytes          // same as previous only in bytes for calculation if required (eg. 311296)
    total               // file size in ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] (eg. 32.42 MB)
    totalBytes          // same as previous only in bytes for calculation if required (eg. 32421992)
    }
```

`item` instance of [DownloadItem](https://electronjs.org/docs/api/download-item#class-downloaditem) class. Useful for pausing and cancelling among other things.

> This feature currently exists only for single file downloads and hasn't been implemented (yet) for bulk processing.


### callback(error, {url, filePath})

Callback to be called when the download has reached a "done" state, which could mean two things either it was successful, or it failed.

if the download was successful the callback's error will be `null`, otherwise it will contain the error message

`url` returns the url of the downloaded file<br>
`filePath` location of where the file was saved

### DownloadManager.bulkDownload(options, callback(error, finished, failed))

### options

#### urls
Type: `array`

Array of `url` strings of the files to be downloaded

#### path
Type: `string`<br>
Default: `""`

Set a path to save all the bulk downloaded files. This folder is relative to downloadFolder location set in the register function. By default it will be downloaded to root of downloadFolder which would be user download's folder.

#### onResult(finishedCount, errorsCount, itemUrl)
Type: `function`<br>

A function to be called whenever a file has been downloaded or whenever a download failed. 

`finishedCount` integer. Represents the number of file successfully downloaded. example: `4`

`errorsCount` integer. Represents the number of file that couldn't be downloaded. example: `5`

`itemUrl` string. Represents the `url` of the item.

> This feature is really different as the `onProgress` feature for single files as it doesn't take the size in the calculation.


### callback(error, finished, failed)
Callback to be executed when all downloadItems in this bulk process have been completed

`error` will be `null` if everything was successful <br>
`finished` is an array containing the `url` of successfully downloaded items <br>
`failed` is an array containing the `url` of failed downloaded items (if any)

## Questions
Feel free to open Issues to ask questions about using this module, PRs are very welcome and encouraged.

## License

MIT © Daniel Nieto, loosely based on code from [Sindre Sorhus](https://sindresorhus.com)
