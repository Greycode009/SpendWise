// Apply the saved theme before the first paint (avoids a white flash in dark mode).
(function () {
  try {
    var t = localStorage.getItem('spendwise.theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
