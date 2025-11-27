/**
 * Instructions module: handles the instructions pager and navigation
 */

import { show } from './ui.js';

let instructionPages = [];
let instructionIndex = 0;

export function openInstructions(instrPanel, instrScrim, insPagesWrap, insDotsWrap) {
  if (!instrPanel || !instrScrim) {
    console.warn('Cannot open instructions - elements not found');
    return;
  }

  if (!instructionPages.length) collectPages(insPagesWrap, insDotsWrap);
  goToPage(0, instrPanel, instrScrim, insPagesWrap, insDotsWrap);

  instrPanel.classList.add('open');
  show(instrPanel);
  instrPanel.setAttribute('aria-hidden', 'false');
  instrScrim.classList.add('visible');
  show(instrScrim);
  document.body.classList.add('instructions-open');
}

export function closeInstructions(instrPanel, instrScrim) {
  if (!instrPanel || !instrScrim) {
    console.warn('Cannot close instructions - elements not found');
    return;
  }
  
  instrPanel.classList.remove('open');
  instrPanel.setAttribute('aria-hidden', 'true');
  instrScrim.classList.remove('visible');
  document.body.classList.remove('instructions-open');
}

export function collectPages(insPagesWrap, insDotsWrap) {
  if (!insPagesWrap) {
    console.warn('Cannot collect pages - wrap element not found');
    return;
  }
  
  instructionPages = Array.from(insPagesWrap.querySelectorAll('.ins-page') || []);
  instructionPages.forEach((p, i) => p.toggleAttribute('hidden', i !== 0));
  instructionIndex = 0;
  buildDots(insDotsWrap);
  updatePager(insDotsWrap);
}

function buildDots(insDotsWrap) {
  if (!insDotsWrap) return;
  
  insDotsWrap.innerHTML = '';
  instructionPages.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'ins-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Page ${i + 1}`);
    dot.setAttribute('aria-selected', i === instructionIndex ? 'true' : 'false');
    dot.addEventListener('click', () => goToPage(i));
    insDotsWrap.appendChild(dot);
  });
}

function updatePager(insDotsWrap, insCounter, insPrev, insNext) {
  const total = instructionPages.length || 1;
  const page = instructionIndex + 1;
  
  if (insCounter) insCounter.textContent = `Page ${page} of ${total}`;
  
  instructionPages.forEach((p, i) => p.toggleAttribute('hidden', i !== instructionIndex));
  
  if (insDotsWrap) {
    Array.from(insDotsWrap.children || []).forEach((dot, i) =>
      dot.setAttribute('aria-selected', i === instructionIndex ? 'true' : 'false')
    );
  }
  
  if (insPrev) insPrev.disabled = (instructionIndex === 0);
  if (insNext) insNext.disabled = (instructionIndex === total - 1);
}

export function goToPage(i, insDotsWrap, insCounter, insPrev, insNext) {
  if (!instructionPages.length) {
    console.warn('Cannot go to page - no pages collected');
    return;
  }
  
  instructionIndex = Math.max(0, Math.min(i, instructionPages.length - 1));
  updatePager(insDotsWrap, insCounter, insPrev, insNext);
  
  const firstHeading = instructionPages[instructionIndex].querySelector('h1,h2,h3,h4,h5,h6,button,[tabindex]');
  if (firstHeading) firstHeading.focus({ preventScroll: true });
}

export function nextPage(insDotsWrap, insCounter, insPrev, insNext) {
  goToPage(instructionIndex + 1, insDotsWrap, insCounter, insPrev, insNext);
}

export function prevPage(insDotsWrap, insCounter, insPrev, insNext) {
  goToPage(instructionIndex - 1, insDotsWrap, insCounter, insPrev, insNext);
}

export function getInstructionIndex() {
  return instructionIndex;
}