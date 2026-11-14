(() => {
  const toggle = document.getElementById('music-toggle');
  const status = document.getElementById('music-status');
  const play = document.getElementById('music-play');
  const audio = document.getElementById('music-player');
  let enabled = true;
  let active = false;
  let request = 0;
  audio.volume = 0.4;

  async function sync() {
    const current = ++request;
    toggle.setAttribute('aria-checked', String(enabled));
    toggle.textContent = enabled ? '♫ 音乐开' : '♫ 音乐关';
    play.hidden = true;
    if (!enabled || !active) {
      audio.pause();
      status.textContent = enabled ? '赌神 BGM · 开局自动播放' : '音乐已关闭';
      return;
    }
    status.textContent = '正在加载音乐…';
    try {
      await audio.play();
      if (current !== request) return;
      status.textContent = '赌神 BGM · 正在播放';
    } catch (error) {
      if (current !== request) return;
      status.textContent = error.name === 'NotAllowedError'
        ? '点击播放音乐即可开启'
        : '音乐暂时无法播放，请点击重试';
      play.hidden = false;
    }
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
  play.onclick = sync;
  audio.addEventListener('error', () => {
    if (!enabled || !active) return;
    status.textContent = '音乐加载失败，请点击重试';
    play.hidden = false;
  });
})();
