/**
 * Handles modals, instructions panel, side panels
 */
export default class ModalManager {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.instructionPages = [];
    this.instructionIndex = 0;
  }

  /**
   * Show a simple confirm/cancel modal and resolve a promise with the choice.
   */
  showModal(title, text, confirmText = 'Yes', cancelText = 'No') {
    const elements = this.uiManager.getElements();
    const { modalOverlay, modalTitle, modalText, modalConfirm, modalCancel } = elements;
    
    return new Promise((resolve) => {
      modalTitle.textContent = title;
      modalText.textContent = text;
      modalConfirm.textContent = confirmText;
      modalCancel.textContent = cancelText;
      this.uiManager.show(modalOverlay);
      
      const close = (value) => {
        this.uiManager.hide(modalOverlay);
        modalConfirm.onclick = null;
        modalCancel.onclick = null;
        resolve(value);
      };
      
      modalConfirm.onclick = () => close(true);
      modalCancel.onclick = () => close(false);
    });
  }

  /**
   * Open the instructions panel, collecting pages if needed and focusing page 1.
   */
  openInstructions() {
    const elements = this.uiManager.getElements();
    const { instrPanel, instrScrim } = elements;
    
    if (!instrPanel || !instrScrim) return;

    if (!this.instructionPages.length) this.collectPages();
    this.goToPage(0);

    instrPanel.classList.add('open');
    instrPanel.setAttribute('aria-hidden', 'false');
    instrScrim.classList.add('visible');
    document.body.classList.add('instructions-open');
  }

  /**
   * Close the instructions panel and remove related body state.
   */
  closeInstructions() {
    const elements = this.uiManager.getElements();
    const { instrPanel, instrScrim } = elements;
    
    if (!instrPanel || !instrScrim) return;
    instrPanel.classList.remove('open');
    instrPanel.setAttribute('aria-hidden', 'true');
    instrScrim.classList.remove('visible');
    document.body.classList.remove('instructions-open');
  }

  /**
   * Collect instruction pages, reset to first page, and build the navigation dots.
   */
  collectPages() {
    const elements = this.uiManager.getElements();
    const { insPagesWrap } = elements;
    
    this.instructionPages = Array.from(insPagesWrap?.querySelectorAll('.ins-page') || []);
    this.instructionPages.forEach((p, i) => p.toggleAttribute('hidden', i !== 0));
    this.instructionIndex = 0;
    this.buildDots();
    this.updatePager();
  }

  /**
   * Build clickable dot navigation for the instructions pager.
   */
  buildDots() {
    const elements = this.uiManager.getElements();
    const { insDotsWrap } = elements;
    
    if (!insDotsWrap) return;
    insDotsWrap.innerHTML = '';
    this.instructionPages.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ins-dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Page ${i+1}`);
      dot.setAttribute('aria-selected', i === this.instructionIndex ? 'true' : 'false');
      dot.addEventListener('click', () => this.goToPage(i));
      insDotsWrap.appendChild(dot);
    });
  }

  /**
   * Update the pager UI (counter, page visibility, dot selection, prev/next state).
   */
  updatePager() {
    const elements = this.uiManager.getElements();
    const { insCounter, insDotsWrap, insPrev, insNext } = elements;
    
    const total = this.instructionPages.length || 1;
    const page = this.instructionIndex + 1;
    
    if (insCounter) insCounter.textContent = `Page ${page} of ${total}`;
    
    this.instructionPages.forEach((p, i) => p.toggleAttribute('hidden', i !== this.instructionIndex));
    
    Array.from(insDotsWrap?.children || []).forEach((dot, i) =>
      dot.setAttribute('aria-selected', i === this.instructionIndex ? 'true' : 'false')
    );
    
    if (insPrev) insPrev.disabled = (this.instructionIndex === 0);
    if (insNext) insNext.disabled = (this.instructionIndex === total - 1);
  }

  /**
   * Navigate to a specific instruction page index and focus its first focusable.
   */
  goToPage(i) {
    if (!this.instructionPages.length) return;
    this.instructionIndex = Math.max(0, Math.min(i, this.instructionPages.length - 1));
    this.updatePager();
    const firstHeading = this.instructionPages[this.instructionIndex].querySelector('h1,h2,h3,h4,h5,h6,button,[tabindex]');
    if (firstHeading) firstHeading.focus({ preventScroll: true });
  }

  /**
   * Navigate to the next instruction page.
   */
  nextPage() { 
    this.goToPage(this.instructionIndex + 1); 
  }

  /**
   * Navigate to the previous instruction page.
   */
  prevPage() { 
    this.goToPage(this.instructionIndex - 1); 
  }
}