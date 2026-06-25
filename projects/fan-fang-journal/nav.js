/* nav.js — injects shared navigation into every page */
(function () {
  const page = location.pathname.split('/').pop() || 'index.html';

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML =
    '<a href="index.html" class="nav-brand">反方</a>' +
    '<div class="nav-links">' +
    '  <a href="index.html" data-p="index.html">记录</a>' +
    '  <a href="insights.html" data-p="insights.html">洞见</a>' +
    '</div>' +
    '<a href="write.html" class="btn btn-primary" style="font-size:12px;padding:6px 14px">+ 新建</a>';

  document.body.prepend(nav);

  nav.querySelectorAll('[data-p]').forEach(function (a) {
    if (a.dataset.p === page) a.classList.add('active');
  });
})();
