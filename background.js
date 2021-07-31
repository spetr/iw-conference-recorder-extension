'use strict';

const audioBitsPerSecond = 128000;
const videoBitsPerSecond = 2610000;
const videoCodec = 'VP8'; // VP8, VP9, H264

let runtimePort;
let isRecording = false;

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
    if (isRecording === true || tab.active === false) {
        return
    }
    switch (changeInfo.status) {
        case 'complete':
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
                maxFrameRate: 24
            }
        }
    };
    chrome.tabCapture.capture(constraints, function (stream) {
        if (chrome.runtime.lastError) {
            console.log('Error while capturing tab.');
            console.log(chrome.runtime.lastError.message);
            alert("Please run chrome with:\n--whitelisted-extension-id=" + chrome.runtime.id);
            return;
        }
        var tabCaptureStream = new MediaStream();
        try {
            stream.getTracks().forEach(function (track) {
                tabCaptureStream.addTrack(track);
            });
        } catch (e) {
            return;
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
                options.mimeType = 'video/webm; codecs="h264, opus"';
                break;
            default:
                console.log("Unknown video codec");
                return;
        }

        var mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = function (event) {
            if (event.data.size > 0) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', 'http://127.0.0.1:80/record', true);
                xhr.setRequestHeader('Content-Type', "video/webm");
                xhr.setRequestHeader('X-ID', "test.webm")
                xhr.send(event.data);
                xhr.onreadystatechange = function () { // Call a function when the state changes.
                    if (this.readyState === XMLHttpRequest.DONE) {
                        if (this.status === 200) {
                            console.log("Succesfuly send chunk to API.");
                            return
                        }
                        console.log("Error while sending chunk to API");
                        console.log(this);
                    }
                }
            }
        };

        mediaRecorder.start(5000);
        isRecording = true;
    });
};