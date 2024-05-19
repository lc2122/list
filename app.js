document.addEventListener('DOMContentLoaded', function() {
    // Define your stream URLs
    const streamUrls = [
        'https://example.com/stream1.m3u8',
        'https://example.com/stream2.m3u8',
        'https://example.com/stream3.m3u8',
        'https://example.com/stream4.m3u8'
    ];

    // Load and play each stream
    streamUrls.forEach((url, index) => {
        loadStream(url, index + 1);
    });
});

function loadStream(streamUrl, videoNum) {
    const videoElement = document.getElementById(`video${videoNum}`);

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            videoElement.play();
        });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = streamUrl;
        videoElement.addEventListener('loadedmetadata', function() {
            videoElement.play();
        });
    }
}
