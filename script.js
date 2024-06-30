const videoContainer = document.querySelector('.video-container');
const m3u8Urls = [
  'https://api.sooplive.com/media/live/soopbaseball1/master.m3u8
', 'https://api.sooplive.com/media/live/soopbaseball2/master.m3u8
', 'https://api.sooplive.com/media/live/soopbaseball3/master.m3u8
', 'https://api.sooplive.com/media/live/soopbaseball4/master.m3u8
', 'https://api.sooplive.com/media/live/soopbaseball5/master.m3u8
' // m3u8 주소 입력
];

m3u8Urls.forEach(url => {
  const video = document.createElement('video');
  video.controls = true;

  const hls = new Hls();
  hls.loadSource(url);
  hls.attachMedia(video);

  video.addEventListener('click', () => {
    if (video.requestFullscreen) {
      video.requestFullscreen();
    }
  });

  videoContainer.appendChild(video);
});
