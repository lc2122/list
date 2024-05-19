document.addEventListener('DOMContentLoaded', function() {
    // Define your stream URLs
    const streamUrls = [
         'https://ch07-livecdn.spotvnow.co.kr/ch07/spt07_pc.smil/playlist.m3u8?Policy=eyJTdGF0ZW1lbnQiOiBbeyJSZXNvdXJjZSI6Imh0dHBzOi8vY2gwNy1saXZlY2RuLnNwb3R2bm93LmNvLmtyL2NoMDcvc3B0MDdfcGMuc21pbC8qIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzE2MjE3MjAwfX19XX0_&Signature=aYWZiJnmKkwu0zYibFh9oxu0I4pFH~oPY8QTCWU~e7NZe-zqyfAj7B2LW5TGb~MnoP6n44gXm8fYqs4l17CgrA6YOwnbCY1PjjlvhWwOMMcuv0e5ly3ckwUETHpV9zvKzQBKHAdCzb4RLXZlM04aDxhOY1uuD8kZ6eg2UG4xUEbwVDIQEeaagStAfxoRwjKbwvDxwAGWbRLzf3H3RK8X-d5n9SCZAWMFpS3arrI1cQx~v-ACIdKFaAUwFzKug2QvdZ3PnFJvB7TeIS1trdBfCv5WF6dnbWhzowY0vxWJB3D9r5Z0JCgtGT~sZn1WDz6Pj71SAFHtOO9ILH~Apqq9fQ__&Key-Pair-Id=APKAI2M6I5EDDXED7H5Q',  // Example URL 1
    'https://ch08-livecdn.spotvnow.co.kr/ch08/spt08_pc.smil/playlist.m3u8?Policy=eyJTdGF0ZW1lbnQiOiBbeyJSZXNvdXJjZSI6Imh0dHBzOi8vY2gwOC1saXZlY2RuLnNwb3R2bm93LmNvLmtyL2NoMDgvc3B0MDhfcGMuc21pbC8qIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzE2MjE3MjAwfX19XX0_&Signature=Y-Y6Eonc6Oetwc60zhPwoJyzi~QFwoLluAjr2qkGnkCBmDSs42PaDrB5lxdXk7MXFVK0UDGs3fasxsPB9jtr3toS9KQdoUL1EMXvyYojsuPr4Gv6UAydv0NHwbRwTmNE7ES6vJ8-L87Nv9rGTA-lp9pJ423JIVr3ryT58vCYdSkJbboOkQjhOy8IcZ9TunaqerRb3uHbmCns1FFxJMbkVz2EcXTDErfZh4CZt20d2OvUwxkqdddMqkptepMDPazF3Vu8IuiE7k5drX3AvlS-iTCNTgJOJ~hUXxIh9sAh-HZrjLSqf3Z4oTLGg2ZtmjjG72HTPmscC0OfYehHJ95bHw__&Key-Pair-Id=APKAI2M6I5EDDXED7H5Q',  // Example URL 2
    'https://ch01-livecdn.spotvnow.co.kr/ch01/spt01_pc.smil/playlist.m3u8?Policy=eyJTdGF0ZW1lbnQiOiBbeyJSZXNvdXJjZSI6Imh0dHBzOi8vY2gwMS1saXZlY2RuLnNwb3R2bm93LmNvLmtyL2NoMDEvc3B0MDFfcGMuc21pbC8qIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzE2MjE3MjAwfX19XX0_&Signature=nvhLSSlQROIWYRRZ37UZIFkx~k7XKeT~STFF-0ulCraL-06kf0tWkLmnO8zSDpQYsi4qsYaZOyx6Q-9O-pCGIaW100hglme9a3Mb6r41CVBe62JZI8DIXcJspCik4yWm2FQa4gV651Scp~noHVJQN2dsIUc-5affQQvr1aSrdg5F7ySSzzkBP5q6S9R9MHnolZLBU44w4D~niuxsenrBqfB3WTrxdD5OvyNfj15t4HRfUi9qTBTZAt8lses4u3Iq8VJ8zEyX7K7MR-8EJ7EhHeT8zZ-yzNQkiEXbIwMitvqR-0rAnzfBR9wYtkKSUw9ETidn0AVawZtvoIeZPboJpg__&Key-Pair-Id=APKAI2M6I5EDDXED7H5Q',  // Example URL 3
    'https://ch02-livecdn.spotvnow.co.kr/ch02/spt02_pc.smil/playlist.m3u8?Policy=eyJTdGF0ZW1lbnQiOiBbeyJSZXNvdXJjZSI6Imh0dHBzOi8vY2gwMi1saXZlY2RuLnNwb3R2bm93LmNvLmtyL2NoMDIvc3B0MDJfcGMuc21pbC8qIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzE2MjE3MjAwfX19XX0_&Signature=YSayO9tfUYKW2EMQmwgkRmRIbL06uy5gSncZrCorzgRLtFmrCyZN7Nf2C-gdnPEAH2y9q5dobyIuYONWY0rc1F9XhOV9-hGJk8htWg-D02WfyAdpeXBNFZfPzk4UwWrd9ROd5hQpIGSXEsuj1GcEgnuOxm2joLDGE96Do~GpnjfFtRmMP85xkGqOCaYYvX~GA6I~ZtAIgjabR-MnB~4BHH3VPs-Mkp7mZmNvCYTmM29pIW8v-62rrelomrt214v0SdaHFR1KiOO6hHkWhfsZdM~F3Bz8pzJTc~eoApSWZd4ibvhAFrrj5XyUCioCxrnn2BXf7ECuH~CUEtv4RfQRPQ__&Key-Pair-Id=APKAI2M6I5EDDXED7H5Q'   // Example URL 4

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
