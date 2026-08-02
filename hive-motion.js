/* ============================================================
   HIVE — MOTION LAYER (JS-часть)
   ------------------------------------------------------------
   Единственная задача этого файла — включить мягкое появление
   секций при скролле (.reveal / .reveal-group, см. hive-motion.css).
   Ничего из существующей логики сайта (hive-lead-capture.js,
   solutions-selector.js, cookies.js, диагностика) не трогает и
   не дублирует.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  const targets = document.querySelectorAll('.reveal, .reveal-group');
  if (!targets.length) return;

  // Если пользователь просит меньше анимаций — показываем всё сразу
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(function (el) { observer.observe(el); });
});
