document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('navToggle');
  var navList = document.getElementById('navList');
  if (toggle && navList) {
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
  }

  var autoRevealTargets = document.querySelectorAll([
    '.hero .eyebrow',
    '.hero h1',
    '.hero .tagline',
    '.hero .lead',
    '.hero .desc',
    '.hero .meta',
    '.hero .btn',
    '.page-hero .kicker',
    '.page-hero h1',
    '.page-hero .sub',
    'section > .wrap > h2, section > .wrap > h1',
    '.reason',
    '.flow-step',
    '.faq-item',
    '.menu-item',
    '.reserve-card',
    '.voice',
    '.staff-block',
    '.concerns li',
    '.post-card',
    '.final-cta',
    '.blog-intro',
    '.article-body',
    '.side-box',
    '.access-grid',
    '.staff-grid',
    '.space',
    '.reasons',
    '.notes',
    '.pivot'
  ].join(', '));

  autoRevealTargets.forEach(function (element, index) {
    if (!element || element.classList.contains('js-reveal') || element.classList.contains('reveal-item')) return;
    element.classList.add('reveal-item');
    var delay = (index % 7) * 0.08;
    element.setAttribute('data-delay', delay.toFixed(2));
  });

  var revealItems = document.querySelectorAll('.js-reveal, .reveal-item');
  if (revealItems.length) {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var delay = entry.target.getAttribute('data-delay');
            if (delay) {
              entry.target.style.transitionDelay = delay + 's';
            }
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      revealItems.forEach(function (item) {
        observer.observe(item);
      });
    } else {
      revealItems.forEach(function (item) {
        item.classList.add('is-visible');
      });
    }
  }
});
