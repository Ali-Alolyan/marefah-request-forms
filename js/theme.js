/**
 * Theme Manager
 * Handles light/dark mode switching with localStorage persistence
 * Material Design 3 theme system
 */

class ThemeManager {
  constructor() {
    this.storageKey = 'arabic-letter-theme';
    this.theme = this.getInitialTheme();
    this.toggleBtn = null;
    this.init();
  }

  /**
   * Get initial theme from localStorage or system preference
   * @returns {string} 'light' or 'dark'
   */
  getInitialTheme() {
    // Check localStorage first
    const savedTheme = localStorage.getItem(this.storageKey);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // Default to light
    return 'light';
  }

  /**
   * Initialize theme manager
   */
  init() {
    // Apply initial theme immediately (prevent flash)
    this.applyTheme(this.theme, false);

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupUI());
    } else {
      this.setupUI();
    }

    // Listen for system theme changes
    this.watchSystemTheme();
  }

  /**
   * Set up UI elements
   */
  setupUI() {
    this.toggleBtn = document.getElementById('theme-toggle');

    if (this.toggleBtn) {
      this.updateToggleButton();
      this.attachEventListeners();
    }
  }

  /**
   * Apply theme to document
   * @param {string} theme - 'light' or 'dark'
   * @param {boolean} animate - Whether to animate the transition
   */
  applyTheme(theme, animate = true) {
    const root = document.documentElement;

    // Add transition class if animating
    if (animate) {
      root.classList.add('theme-transitioning');
    }

    // Set theme attribute
    root.setAttribute('data-theme', theme);

    // Remove transition class after animation
    if (animate) {
      setTimeout(() => {
        root.classList.remove('theme-transitioning');
      }, 300);
    }

    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor(theme);
  }

  /**
   * Update meta theme-color tag for mobile browser chrome
   * @param {string} theme - 'light' or 'dark'
   */
  updateMetaThemeColor(theme) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    // Use surface color from the theme
    const color = theme === 'dark' ? '#0b1220' : '#ffffff';
    metaThemeColor.content = color;
  }

  /**
   * Toggle between light and dark themes
   */
  toggle() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.theme, true);
    this.saveTheme();
    this.updateToggleButton();
    this.announceThemeChange();
  }

  /**
   * Set specific theme
   * @param {string} theme - 'light' or 'dark'
   */
  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      console.warn(`Invalid theme: ${theme}. Using 'light' instead.`);
      theme = 'light';
    }

    this.theme = theme;
    this.applyTheme(this.theme, true);
    this.saveTheme();
    this.updateToggleButton();
    this.announceThemeChange();
  }

  /**
   * Save theme to localStorage
   */
  saveTheme() {
    try {
      localStorage.setItem(this.storageKey, this.theme);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  }

  /**
   * Update toggle button UI
   */
  updateToggleButton() {
    if (!this.toggleBtn) return;

    const isDark = this.theme === 'dark';

    // Update icon
    const icon = this.toggleBtn.querySelector('.theme-toggle-icon');
    if (icon) {
      icon.innerHTML = isDark
        ? this.getSunIcon()
        : this.getMoonIcon();
    }

    // Update text
    const text = this.toggleBtn.querySelector('.theme-toggle-text');
    if (text) {
      text.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
    }

    // Update aria-label
    this.toggleBtn.setAttribute('aria-label', isDark
      ? 'التبديل إلى الوضع النهاري'
      : 'التبديل إلى الوضع الليلي'
    );

    // Update aria-pressed
    this.toggleBtn.setAttribute('aria-pressed', isDark);
  }

  /**
   * Get sun icon SVG
   * @returns {string} SVG markup
   */
  getSunIcon() {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2"></path>
        <path d="M12 20v2"></path>
        <path d="m4.93 4.93 1.41 1.41"></path>
        <path d="m17.66 17.66 1.41 1.41"></path>
        <path d="M2 12h2"></path>
        <path d="M20 12h2"></path>
        <path d="m6.34 17.66-1.41 1.41"></path>
        <path d="m19.07 4.93-1.41 1.41"></path>
      </svg>
    `;
  }

  /**
   * Get moon icon SVG
   * @returns {string} SVG markup
   */
  getMoonIcon() {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.toggleBtn) return;

    // Click event
    this.toggleBtn.addEventListener('click', () => this.toggle());

    // Keyboard support
    this.toggleBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Watch for system theme changes
   */
  watchSystemTheme() {
    if (!window.matchMedia) return;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    darkModeQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set a preference
      const savedTheme = localStorage.getItem(this.storageKey);
      if (!savedTheme) {
        this.theme = e.matches ? 'dark' : 'light';
        this.applyTheme(this.theme, true);
        this.updateToggleButton();
        this.announceThemeChange();
      }
    });
  }

  /**
   * Announce theme change to screen readers
   */
  announceThemeChange() {
    const announcement = this.theme === 'dark'
      ? 'تم التبديل إلى الوضع الليلي'
      : 'تم التبديل إلى الوضع النهاري';

    // Create or update live region
    let liveRegion = document.getElementById('theme-announcement');

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'theme-announcement';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = announcement;

    // Clear after announcement
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 1000);
  }

  /**
   * Get current theme
   * @returns {string} Current theme ('light' or 'dark')
   */
  getTheme() {
    return this.theme;
  }

  /**
   * Check if dark mode is active
   * @returns {boolean} True if dark mode is active
   */
  isDarkMode() {
    return this.theme === 'dark';
  }
}

// Initialize theme manager when script loads
// This runs immediately to prevent FOUC (Flash of Unstyled Content)
const themeManager = new ThemeManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
