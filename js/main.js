// js/main.js
// HOSA — Application entry point

// 1. Footer year
const yearEl = document.querySelector('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// 2. Mobile menu toggle
const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('#primary-nav');

if (menuToggle && primaryNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close menu when a link is clicked
  primaryNav.addEventListener('click', (e) => {
    if (e.target.matches('a')) {
      primaryNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// 3. Highlight the active navigation link based on current path
const path = window.location.pathname.replace(/\/$/, '') || '/';
const routeMap = {
  '/': 'home',
  '/directory': 'directory',
  '/events': 'events',
  '/mentorship': 'mentorship',
  '/jobs': 'jobs',
  '/saved': 'saved'
};
const currentRoute = routeMap[path] || 'home';

document.querySelectorAll('.primary-nav a[data-route]').forEach((link) => {
  if (link.dataset.route === currentRoute) {
    link.classList.add('active');
    link.setAttribute('aria-current', 'page');
  }
});