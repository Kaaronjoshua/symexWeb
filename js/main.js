// ===== Symex Intro Sequence (runs on refresh) =====
window.addEventListener("load", () => {
  const symexStage = document.getElementById("symexStage");
  const contentStage = document.getElementById("contentStage");

  // 1) Move logo to top + shrink after outline + fill
  setTimeout(() => {
    symexStage?.classList.add("to-top");
  }, 3600);

  // 2) Show website slowly after logo moved
  setTimeout(() => {
    document.body.classList.remove("preload");
    document.body.classList.add("ready");
    contentStage?.classList.add("show");

    // start reveal observer AFTER intro so it feels smooth
    startRevealObserver();
  }, 4600);

  // 3) IMPORTANT: Unpin so Symex scrolls with the page (not fixed forever)
  // This assumes your CSS has .symex-stage as position: fixed
  // and .symex-stage.unpinned switches it to position: absolute
  setTimeout(() => {
    symexStage?.classList.add("unpinned");
  }, 4800);
});

// Year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile menu
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");
const closeMenu = document.getElementById("closeMenu");

function openMenu() {
  if (!menu) return;
  menu.classList.add("is-open");
  document.body.style.overflow = "hidden";
}
function hideMenu() {
  if (!menu) return;
  menu.classList.remove("is-open");
  document.body.style.overflow = "";
}

burger?.addEventListener("click", openMenu);
closeMenu?.addEventListener("click", hideMenu);

// Close menu when clicking outside panel
menu?.addEventListener("click", (e) => {
  if (e.target === menu) hideMenu();
});

// Close menu on link click
document.querySelectorAll(".menu__link").forEach((a) => {
  a.addEventListener("click", hideMenu);
});

// ---- Scroll reveal animations (start after intro) ----
function startRevealObserver() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.12 }
  );

  els.forEach((el) => io.observe(el));
}