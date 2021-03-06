'use strict';

const audioBitsPerSecond = 128000;
const videoBitsPerSecond = 2610000;
const videoCodec = 'VP8'; // VP8, VP9, H264
const apiURL = 'http://127.0.0.1:80/record';

let isRecording = false;

// Listen tab events
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab.active === false) {
        return;
    }
    switch (changeInfo.status) {
        case 'complete':
            var pattern = /^((http|https):\/\/)/;
            if (!pattern.test(tab.url)) {
                console.log('URL of active tab is not starting with http:// or https://')
                return;
            }
            if (isRecording === true) {
                console.log('Recording is running');
                return;
            }
            startScreenRecording();
            break;
        default:
    }
});

// Start recording (current tab)
function startScreenRecording() {
    console.log('Starting tab recording.')
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
            console.log('Please run chrome with: --whitelisted-extension-id=' + chrome.runtime.id);
            return;
        }
        console.log('Recieved tabCapture stream:', stream)

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
        var seqID = 0;
        mediaRecorder.ondataavailable = function (event) {
            if (event.data.size > 0) {
                seqID++;
                console.log(`Sending chunk ${seqID} to API.`);
                console.log(mediaRecorder.state);
                var xhr = new XMLHttpRequest();
                var url = apiURL;
                if (mediaRecorder.state === 'inactive') {
                    url += '?end'
                }
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Content-Type', "video/webm");
                xhr.setRequestHeader('X-ID', "test.webm");
                xhr.setRequestHeader('X-SeqID', seqID);
                xhr.send(event.data);
                xhr.onreadystatechange = function () {
                    if (this.readyState === XMLHttpRequest.DONE) {
                        if (this.status === 200) {
                            console.log(`Succesfuly send chunk ${seqID} to API.`);
                            return
                        }
                        console.log(`Error while sending chunk ${seqID} to API.`);
                        console.log(this);
                    }
                }
            }
        };
        mediaRecorder.onerror = function (event) {
            console.log('Media recorder error.');
            console.log(event);
            isRecording = false;
            mediaRecorder.stop();
        };
        mediaRecorder.onstop = function (event) {
            console.log('Media recorder stop.');
            console.log(event);
            isRecording = false;
        };

        mediaRecorder.start(5000);
        isRecording = true;
    });
};

console.log('iw-conference-recorder-extension loaded');