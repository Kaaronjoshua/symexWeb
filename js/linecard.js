const reveals = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  { threshold: 0.15 }
);

reveals.forEach((el) => observer.observe(el));

const year = document.getElementById("year");
if (year) {
  year.textContent = new Date().getFullYear();
}

const pageBrandBg = document.getElementById("pageBrandBg");
const brandCards = document.querySelectorAll(".brand-card[data-bg]");

brandCards.forEach((card) => {
  const bg = card.getAttribute("data-bg");

  card.addEventListener("mouseenter", () => {
    if (!pageBrandBg || !bg) return;
    pageBrandBg.style.backgroundImage = `url("${bg}")`;
    pageBrandBg.classList.add("is-active");
  });

  card.addEventListener("mouseleave", () => {
    if (!pageBrandBg) return;
    pageBrandBg.classList.remove("is-active");
  });
});