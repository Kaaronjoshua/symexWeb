const burger = document.getElementById("burger");
const navLinks = document.getElementById("navLinks");

if (burger && navLinks) {
  burger.addEventListener("click", () => {
    navLinks.classList.toggle("is-open");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
    });
  });
}

/* =========================================
   REVEAL ANIMATIONS
========================================= */
const revealItems = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  {
    threshold: 0.15,
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

/* =========================================
   CUBE STORY SCROLL SYSTEM
========================================= */
const cubeStory = document.getElementById("cubeStory");
const cube = document.getElementById("cube");
const cubeShell = document.getElementById("cubeShell");
const copyItems = document.querySelectorAll(".cube-copy");
const progressDots = document.querySelectorAll(".cube-progress__dot");

const cubeStates = [
  { rotateX: 0, rotateY: 0, shell: "pos-left" },
  { rotateX: 0, rotateY: -90, shell: "pos-right" },
  { rotateX: 0, rotateY: -180, shell: "pos-left" },
  { rotateX: 0, rotateY: -270, shell: "pos-right" },
  { rotateX: -90, rotateY: -270, shell: "pos-left" },
  { rotateX: 90, rotateY: -270, shell: "pos-right" },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function activateStep(stepIndex) {
  const safeIndex = clamp(stepIndex, 0, cubeStates.length - 1);
  const state = cubeStates[safeIndex];

  if (cube) {
    cube.style.transform = `rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg)`;
  }

  if (cubeShell) {
    cubeShell.classList.remove("pos-left", "pos-right");
    cubeShell.classList.add(state.shell);
  }

  copyItems.forEach((item, index) => {
    item.classList.toggle("active", index === safeIndex);
  });

  progressDots.forEach((dot, index) => {
    dot.classList.toggle("active", index === safeIndex);
  });
}

function updateCubeOnScroll() {
  if (!cubeStory || !cube || !cubeShell) return;

  const rect = cubeStory.getBoundingClientRect();
  const storyHeight = cubeStory.offsetHeight;
  const viewportHeight = window.innerHeight;

  const scrollable = Math.max(storyHeight - viewportHeight, 1);
  const progress = clamp((-rect.top) / scrollable, 0, 1);

  const rawStep = progress * cubeStates.length;
  const currentStep = clamp(Math.floor(rawStep), 0, cubeStates.length - 1);

  activateStep(currentStep);
}

/* =========================================
   SMOOTH SCRUB FEEL
========================================= */
function updateCubeSmooth() {
  if (!cubeStory || !cube || !cubeShell) return;

  const rect = cubeStory.getBoundingClientRect();
  const storyHeight = cubeStory.offsetHeight;
  const viewportHeight = window.innerHeight;

  const scrollable = Math.max(storyHeight - viewportHeight, 1);
  const progress = clamp((-rect.top) / scrollable, 0, 1);

  const segments = cubeStates.length;
  const segmentProgress = progress * segments;
  const currentIndex = clamp(Math.floor(segmentProgress), 0, segments - 1);
  const nextIndex = clamp(currentIndex + 1, 0, segments - 1);
  const localT = clamp(segmentProgress - currentIndex, 0, 1);

  const current = cubeStates[currentIndex];
  const next = cubeStates[nextIndex];

  const rotateX = current.rotateX + (next.rotateX - current.rotateX) * localT;
  const rotateY = current.rotateY + (next.rotateY - current.rotateY) * localT;

  cube.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  cubeShell.classList.remove("pos-left", "pos-right");
  cubeShell.classList.add(localT < 0.5 ? current.shell : next.shell);

  const activeIndex = localT < 0.5 ? currentIndex : nextIndex;

  copyItems.forEach((item, index) => {
    item.classList.toggle("active", index === activeIndex);
  });

  progressDots.forEach((dot, index) => {
    dot.classList.toggle("active", index === activeIndex);
  });
}

let ticking = false;

function onScroll() {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      updateCubeSmooth();
      updateActiveNav();
      ticking = false;
    });
    ticking = true;
  }
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateCubeSmooth);

updateCubeSmooth();

/* =========================================
   ACTIVE NAV HIGHLIGHT ON SCROLL
========================================= */
const sections = document.querySelectorAll("main section[id]");
const navAnchors = document.querySelectorAll(
  '.nav__links a[href^="#"], .nav__links a[href$=".html"]'
);

function updateActiveNav() {
  let currentSectionId = "";

  sections.forEach((section) => {
    const sectionTop = section.offsetTop - 140;
    const sectionHeight = section.offsetHeight;

    if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
      currentSectionId = section.getAttribute("id");
    }
  });

  navAnchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) return;

    if (href.startsWith("#")) {
      anchor.classList.toggle("active", href === `#${currentSectionId}`);
    }
  });
}

updateActiveNav();

/* =========================================
   VIDEO AUTOPLAY SAFETY
========================================= */
const faceVideos = document.querySelectorAll(".face-video");

faceVideos.forEach((video) => {
  video.muted = true;
  video.playsInline = true;

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // ignore autoplay blocking silently
    });
  }
});