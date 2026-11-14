(() => {
  const toggle = document.getElementById('music-toggle');
  const status = document.getElementById('music-status');
  const play = document.getElementById('music-play');
  let enabled = true;
  let active = false;
  let player;
  let ready = false;
  let failed = false;

  function sync() {
    toggle.setAttribute('aria-checked', String(enabled));
    toggle.textContent = enabled ? '♫ 音乐开' : '♫ 音乐关';
    play.hidden = true;
    if (!enabled || !active) {
      if (ready) player.pauseVideo();
      status.textContent = enabled ? '赌神 BGM · 开局自动播放' : '音乐已关闭';
      return;
    }
    if (failed) {
      status.textContent = '音乐加载失败，可通过下方链接打开。';
      return;
    }
    status.textContent = '正在加载音乐…';
    if (ready) player.playVideo();
  }

  window.gomokuMusic = {
    setActive(value) {
      if (active === value) return;
      active = value;
      sync();
    }
  };
  toggle.onclick = () => {
    enabled = !enabled;
    sync();
  };
  play.onclick = () => {
    if (ready && enabled && active) player.playVideo();
  };
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('music-player', {
      width: '100%',
      height: '200',
      videoId: 'IfYPHQ-oU5w',
      playerVars: {
        playsinline: 1,
        loop: 1,
        playlist: 'IfYPHQ-oU5w',
        origin: location.origin
      },
      events: {
        onReady() {
          ready = true;
          player.setVolume(40);
          sync();
        },
        onStateChange(event) {
          if (event.data === YT.PlayerState.PLAYING) {
            if (!enabled || !active) {
              player.pauseVideo();
              return;
            }
            status.textContent = '赌神 BGM · 正在播放';
            play.hidden = true;
          } else if (event.data === YT.PlayerState.PAUSED && enabled && active) {
            status.textContent = '音乐已暂停';
            play.hidden = false;
          }
        },
        onAutoplayBlocked() {
          if (enabled && active) {
            status.textContent = '浏览器需要你点击后播放';
            play.hidden = false;
          }
        },
        onError() {
          failed = true;
          status.textContent = '视频暂时无法播放，可通过下方链接打开。';
          play.hidden = true;
        }
      }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => {
    failed = true;
    status.textContent = '无法连接 YouTube，可通过下方链接打开。';
  };
  document.head.append(script);
})();
