document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('navToggle');
  var navList = document.getElementById('navList');
  if (!toggle || !navList) return;

  toggle.addEventListener('click', function () {
    var isOpen = navList.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  navList.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navList.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 760) {
      navList.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
});
