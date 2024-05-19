function playVideo(frameNumber) {
    const urlInput = document.getElementById(`url${frameNumber}`);
    const video = document.getElementById(`video${frameNumber}`);
    const url = urlInput.value;

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            video.play();
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', function () {
            video.play();
        });
    } else {
        alert("Your browser does not support HLS.");
    }
}
