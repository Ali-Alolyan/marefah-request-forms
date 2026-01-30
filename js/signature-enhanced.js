/**
 * Enhanced Signature Canvas Implementation
 * Features: Undo/Redo, Pen size control, Color selection
 */

class SignatureManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas with id "${canvasId}" not found`);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;

    // History for undo/redo (max 50 states to prevent memory issues)
    this.history = [];
    this.historyStep = -1;
    this.maxHistory = 50;

    // Drawing settings
    this.penSize = 2;
    // Default ink color: blue (matches official signature style)
    this.penColor = '#1d4ed8';

    // Initialize
    this.init();
  }

  init() {
    this.resizeCanvas();
    this.setupEventListeners();
    this.setupControls();
    this.saveState(); // Save initial blank state
    console.log('✓ Enhanced signature canvas initialized');
  }

  /**
   * Set canvas size based on display size with DPR scaling
   */
  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Save current canvas content
    const imageData = this.canvas.toDataURL();
    const hasContent = this.historyStep > 0;

    // Resize canvas
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    // Restore drawing settings
    this.updateDrawingStyle();

    // Restore content if it existed
    if (hasContent) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = imageData;
    }
  }

  /**
   * Update drawing style based on current settings
   */
  updateDrawingStyle() {
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.penSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /**
   * Get coordinates relative to canvas
   */
  getCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /**
   * Start drawing
   */
  startDrawing(e) {
    e.preventDefault();
    this.isDrawing = true;

    const coords = this.getCoordinates(e);
    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  /**
   * Draw on canvas
   */
  draw(e) {
    if (!this.isDrawing) return;
    e.preventDefault();

    const coords = this.getCoordinates(e);

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();

    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  /**
   * Stop drawing and save state
   */
  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveState(); // Save after each stroke

      // Dispatch event to notify that signature has changed
      const event = new CustomEvent('signatureChanged', {
        detail: { hasDrawing: !this.isEmpty() }
      });
      this.canvas.dispatchEvent(event);
    }
  }

  /**
   * Save current canvas state to history
   */
  saveState() {
    // Remove any states after current step (when drawing after undo)
    this.historyStep++;
    if (this.historyStep < this.history.length) {
      this.history.length = this.historyStep;
    }

    // Save current state
    this.history.push(this.canvas.toDataURL());

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.historyStep--;
    }

    this.updateUndoRedoButtons();
  }

  /**
   * Restore canvas from data URL
   */
  restoreState(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.restoreState(this.history[this.historyStep]);
      this.updateUndoRedoButtons();
      this.announce('تم التراجع عن آخر عملية');

      // Dispatch event to notify that signature has changed
      const event = new CustomEvent('signatureChanged', {
        detail: { hasDrawing: !this.isEmpty() }
      });
      this.canvas.dispatchEvent(event);
    }
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.historyStep < this.history.length - 1) {
      this.historyStep++;
      this.restoreState(this.history[this.historyStep]);
      this.updateUndoRedoButtons();
      this.announce('تم إعادة آخر عملية');

      // Dispatch event to notify that signature has changed
      const event = new CustomEvent('signatureChanged', {
        detail: { hasDrawing: !this.isEmpty() }
      });
      this.canvas.dispatchEvent(event);
    }
  }

  /**
   * Update undo/redo button states
   */
  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoSignature');
    const redoBtn = document.getElementById('redoSignature');

    if (undoBtn) {
      undoBtn.disabled = this.historyStep <= 0;
      undoBtn.setAttribute('aria-disabled', this.historyStep <= 0);
    }

    if (redoBtn) {
      redoBtn.disabled = this.historyStep >= this.history.length - 1;
      redoBtn.setAttribute('aria-disabled', this.historyStep >= this.history.length - 1);
    }
  }

  /**
   * Clear canvas completely
   */
  clear() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.saveState();
    this.announce('تم مسح التوقيع');

    // Dispatch event to notify that signature has been cleared
    const event = new CustomEvent('signatureChanged', {
      detail: { hasDrawing: false }
    });
    this.canvas.dispatchEvent(event);
  }

  /**
   * Set pen size
   */
  setPenSize(size) {
    this.penSize = parseFloat(size);
    this.updateDrawingStyle();

    // Update visual feedback
    const penSizeValue = document.getElementById('penSizeValue');
    if (penSizeValue) {
      penSizeValue.textContent = `${size}px`;
    }
  }

  /**
   * Set pen color
   */
  setPenColor(color) {
    this.penColor = color;
    this.updateDrawingStyle();
  }

  /**
   * Get canvas as data URL
   */
  getDataURL() {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Check if canvas is empty
   */
  isEmpty() {
    return this.historyStep <= 0;
  }

  /**
   * Check if canvas has drawing (alias for !isEmpty())
   * Used by validation
   */
  hasDrawing() {
    return !this.isEmpty();
  }

  /**
   * Setup event listeners for drawing
   */
  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.draw(e), { passive: false });
    this.canvas.addEventListener('touchend', () => this.stopDrawing());
    this.canvas.addEventListener('touchcancel', () => this.stopDrawing());

    // Resize handling
    window.addEventListener('resize', () => this.resizeCanvas());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && document.activeElement === this.canvas) {
        e.preventDefault();
        this.undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y') && document.activeElement === this.canvas) {
        e.preventDefault();
        this.redo();
      }
    });
  }

  /**
   * Setup toolbar controls
   */
  setupControls() {
    // Undo button
    const undoBtn = document.getElementById('undoSignature');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
    }

    // Redo button
    const redoBtn = document.getElementById('redoSignature');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
    }

    // Clear button
    const clearBtn = document.getElementById('clearSignature');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }

    // Pen size slider
    const penSizeSlider = document.getElementById('penSize');
    if (penSizeSlider) {
      penSizeSlider.addEventListener('input', (e) => {
        this.setPenSize(e.target.value);
      });

      // Set initial value
      const penSizeValue = document.getElementById('penSizeValue');
      if (penSizeValue) {
        penSizeValue.textContent = `${this.penSize}px`;
      }
    }

    // Pen color picker
    const penColorPicker = document.getElementById('penColor');
    if (penColorPicker) {
      penColorPicker.addEventListener('input', (e) => {
        this.setPenColor(e.target.value);
      });
    }

    // Initialize button states
    this.updateUndoRedoButtons();
  }

  /**
   * Announce message to screen readers
   */
  announce(message) {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  }
}

// Initialize signature manager when DOM is ready
let signatureManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    signatureManager = new SignatureManager('signatureCanvas');
    window.signatureManager = signatureManager; // Make globally accessible
  });
} else {
  signatureManager = new SignatureManager('signatureCanvas');
  window.signatureManager = signatureManager; // Make globally accessible
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SignatureManager;
}
