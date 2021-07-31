'use strict';

let runtimePort;

// Listen external commands (startRecord / stopRecord)
chrome.runtime.onConnect.addListener(function (port) {
    runtimePort = port;
    runtimePort.onMessage.addListener(function (message, s, senderResponse) {
        if (!message) {
            return;
        }
        switch (message.action) {
            case "stopRecord":
                stopScreenRecording();
                break;
            default:
                console.log(`unknown action ${request.action}`);
        }
    })
});

// Listen tab events
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab.active === false) {
        return
    }
    console.log("changeInfo", changeInfo);
    switch (changeInfo.status) {
        case 'complete':
            if (isRecording) {
                return;
            }
            var pattern = /^((http|https):\/\/)/;
            if (!pattern.test(tab.url)) {
                return;
            }
            startScreenRecording();
            break;
        default:
    }
});

// Start recording (current tab)
function startScreenRecording() {
    var constraints = {
        audio: true,
        video: true,
        audioConstraints: {
            mandatory: {
                echoCancellation: false
            }
        },
        videoConstraints: {
            mandatory: {
                chromeMediaSource: 'tab',
                minWidth: 16,
                minHeight: 9,
                maxWidth: 1920,
                maxHeight: 1080,
                maxFrameRate: 24,
            }
        }
    };
    chrome.tabCapture.capture(constraints, function (stream) {
        var newStream = new MediaStream();
        try {
            stream.getTracks().forEach(function (track) {
                newStream.addTrack(track);
            });
        } catch (e) {
            alert("Please run chrome with:\n--whitelisted-extension-id=" + chrome.runtime.id)
            return true
        }

        var options = {
            type: 'video',
            disableLogs: false,
            ignoreMutedMedia: false,
            audioBitsPerSecond: audioBitsPerSecond,
            videoBitsPerSecond: videoBitsPerSecond,
        };

        switch (videoCodec) {
            case 'VP8':
                options.mimeType = 'video/webm; codecs="vp8, opus"';
                break;
            case 'VP9':
                options.mimeType = 'video/webm; codecs="vp9, opus"';
                break;
            case 'H264':
                options.mimeType = 'video/x-matroska; codecs="h264"';
                break;
            case 'AVC1':
                options.mimeType = 'video/x-matroska; codecs="avc1"';
                break;
            default:
                console.log("Unknown video codec");
                return;
        }

        recorder = new MediaStreamRecorder(newStream, options);
        recorder.streams = [newStream];
        recorder.record();
        isRecording = true;

        addStreamStopListener(recorder.streams[0], function () {
            stopScreenRecording();
        });

        initialTime = Date.now()
        timer = setInterval(checkTime, 100);
    });
};

// Stop recording
function stopScreenRecording() {
    if (!recorder || !isRecording) return;
    if (timer) {
        clearTimeout(timer);
    }
    setBadgeText('');
    isRecording = false;
    recorder.stop(function onStopRecording(blob) {
        var mimeType = 'video/webm';
        var fileExtension = 'webm'
        if (recorder && recorder.streams) {
            recorder.streams.forEach(function (stream, idx) {
                stream.getTracks().forEach(function (track) {
                    track.stop();
                });
                if (idx == 0 && typeof stream.onended === 'function') {
                    stream.onended();
                }
            });
            recorder.streams = null;
        }
        isRecording = false;
        setBadgeText('');

        var xhr = new XMLHttpRequest();
        console.log(xhr)
        xhr.open('POST', 'http://127.0.0.1:80/record', true);
        xhr.setRequestHeader('Content-Type', mimeType);
        xhr.setRequestHeader('X-ID', getFileName(fileExtension))
        xhr.send(recorder.blob);
        xhr.onreadystatechange = function () { // Call a function when the state changes.
            if (this.readyState === XMLHttpRequest.DONE)
                if (this.status === 200) {
                    console.log("Got response 200 from API!");
                    return
                }
            console.log("Error")
        }
    });
}

function convertTime(miliseconds) {
    var totalSeconds = Math.floor(miliseconds / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds - minutes * 60;
    minutes += '';
    seconds += '';
    if (seconds.length === 1) {
        seconds = '0' + seconds;
    }
    return minutes + ':' + seconds;
}

var initialTime, timer;

function checkTime() {
    if (!initialTime || !isRecording) return;
    var timeDifference = Date.now() - initialTime;
    var formatted = convertTime(timeDifference);
    setBadgeText(formatted);
}

function setBadgeText(text) {
    chrome.browserAction.setBadgeBackgroundColor({
        color: [255, 0, 0, 255]
    });
    chrome.browserAction.setBadgeText({
        text: text + ''
    });
}