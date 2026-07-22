// Ordis theme toggle — shared by home, terms, and privacy pages.
// Applied synchronously (not deferred) so the theme is set before first paint.
(function () {
  var stored = localStorage.getItem('ordis-theme');
  var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  function reflectIcons(theme) {
    var sun = toggle.querySelector('.icon-sun');
    var moon = toggle.querySelector('.icon-moon');
    if (sun) sun.hidden = theme === 'dark';
    if (moon) moon.hidden = theme === 'light';
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  reflectIcons(document.documentElement.getAttribute('data-theme') || 'light');

  toggle.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ordis-theme', next);
    reflectIcons(next);
    window.dispatchEvent(new CustomEvent('ordis-themechange', { detail: { theme: next } }));
  });
});
