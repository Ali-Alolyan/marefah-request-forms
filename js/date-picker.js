/**
 * Dual Calendar Date Picker
 * Custom date picker with Hijri and Gregorian calendar support
 */

class DualCalendarPicker {
  constructor(inputElement, options = {}) {
    this.input = inputElement; // Hidden input for form value
    this.displayInput = document.getElementById(inputElement.id + 'Display'); // Visible input for display
    this.options = {
      defaultCalendar: 'gregorian', // 'gregorian' or 'hijri'
      showBothCalendars: true,
      rtl: true,
      ...options
    };

    this.selectedDate = null;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.currentHijriMonth = hijriConverter.getCurrentHijri().month;
    this.currentHijriYear = hijriConverter.getCurrentHijri().year;
    this.activeCalendar = this.options.defaultCalendar;
    this.isOpen = false;

    this.init();
  }

  /**
   * Initialize the date picker
   */
  init() {
    // Create picker container
    this.createPicker();

    // Attach event listeners
    this.attachEventListeners();

    // Set initial value if exists, otherwise set to today
    if (this.input.value) {
      // Parse ISO as *local* date.
      this.selectedDate = parseISOToLocalDate(this.input.value) || new Date();
    } else {
      // Set today's date as default
      this.selectedDate = new Date();
      this.selectedDate.setHours(12, 0, 0, 0); // Noon avoids off-by-one

      // Update input with today's date
      const isoDate = toLocalISODate(this.selectedDate);
      this.input.value = isoDate;

      // Trigger change event for validation
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    this.updateDisplay();
  }

  /**
   * Create picker HTML structure
   */
  createPicker() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'dual-calendar-picker';
    this.container.style.display = 'none';

    // Backdrop (used mainly on mobile to center the picker and prevent awkward zoom/scroll)
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'dcp-backdrop';
    this.backdrop.style.display = 'none';
    this.backdrop.addEventListener('click', () => this.close());

    // Append to body to avoid z-index stacking context issues
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.container);

    // Render initial calendar
    this.render();
  }

  /**
   * Render the calendar picker
   */
  render() {
    this.container.innerHTML = `
      <div class="dcp-header">
        <div class="dcp-calendar-toggle">
          <button type="button" class="dcp-toggle-btn ${this.activeCalendar === 'gregorian' ? 'active' : ''}" data-calendar="gregorian">
            ميلادي
          </button>
          <button type="button" class="dcp-toggle-btn ${this.activeCalendar === 'hijri' ? 'active' : ''}" data-calendar="hijri">
            هجري
          </button>
        </div>
        <button type="button" class="dcp-close" aria-label="إغلاق">×</button>
      </div>

      <div class="dcp-body">
        ${this.activeCalendar === 'gregorian' ? this.renderGregorianCalendar() : this.renderHijriCalendar()}
      </div>

      ${this.renderBothDatesDisplay()}
    `;

    this.attachPickerEventListeners();
  }

  /**
   * Render Gregorian calendar
   */
  renderGregorianCalendar() {
    const monthNames = hijriConverter.gregorianMonths;
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(this.currentYear, this.currentMonth, 1).getDay();

    let calendarHTML = `
      <div class="dcp-calendar">
        <div class="dcp-calendar-nav">
          <button type="button" class="dcp-nav-btn" data-action="prev-year">«</button>
          <button type="button" class="dcp-nav-btn" data-action="prev-month">‹</button>
          <div class="dcp-current-month">
            ${monthNames[this.currentMonth]} ${this.currentYear}
          </div>
          <button type="button" class="dcp-nav-btn" data-action="next-month">›</button>
          <button type="button" class="dcp-nav-btn" data-action="next-year">»</button>
        </div>

        <div class="dcp-weekdays">
          <div>أحد</div>
          <div>اثنين</div>
          <div>ثلاثاء</div>
          <div>أربعاء</div>
          <div>خميس</div>
          <div>جمعة</div>
          <div>سبت</div>
        </div>

        <div class="dcp-days">
    `;

    // Empty cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarHTML += '<div class="dcp-day dcp-day-empty"></div>';
    }

    // Days of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(this.currentYear, this.currentMonth, day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = this.selectedDate && date.toDateString() === this.selectedDate.toDateString();

      let classes = 'dcp-day';
      if (isToday) classes += ' dcp-day-today';
      if (isSelected) classes += ' dcp-day-selected';

      calendarHTML += `
        <div class="${classes}" data-date="${this.currentYear}-${(this.currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}">
          ${day}
        </div>
      `;
    }

    calendarHTML += `
        </div>
      </div>
    `;

    return calendarHTML;
  }

  /**
   * Render Hijri calendar
   */
  renderHijriCalendar() {
    const monthNames = hijriConverter.hijriMonths;
    const daysInMonth = hijriConverter.getHijriMonthDays(this.currentHijriYear, this.currentHijriMonth);

    // Get first day of Hijri month
    const firstGregorian = hijriConverter.toGregorian(this.currentHijriYear, this.currentHijriMonth, 1);
    const firstDayOfMonth = firstGregorian.getDay();

    let calendarHTML = `
      <div class="dcp-calendar">
        <div class="dcp-calendar-nav">
          <button type="button" class="dcp-nav-btn" data-action="prev-year-hijri">«</button>
          <button type="button" class="dcp-nav-btn" data-action="prev-month-hijri">‹</button>
          <div class="dcp-current-month">
            ${monthNames[this.currentHijriMonth - 1]} ${this.currentHijriYear} هـ
          </div>
          <button type="button" class="dcp-nav-btn" data-action="next-month-hijri">›</button>
          <button type="button" class="dcp-nav-btn" data-action="next-year-hijri">»</button>
        </div>

        <div class="dcp-weekdays">
          <div>أحد</div>
          <div>اثنين</div>
          <div>ثلاثاء</div>
          <div>أربعاء</div>
          <div>خميس</div>
          <div>جمعة</div>
          <div>سبت</div>
        </div>

        <div class="dcp-days">
    `;

    // Empty cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarHTML += '<div class="dcp-day dcp-day-empty"></div>';
    }

    // Days of the month
    const today = new Date();
    const todayHijri = hijriConverter.toHijri(today);

    for (let day = 1; day <= daysInMonth; day++) {
      const gregorianDate = hijriConverter.toGregorian(this.currentHijriYear, this.currentHijriMonth, day);
      const isToday = todayHijri.year === this.currentHijriYear &&
                     todayHijri.month === this.currentHijriMonth &&
                     todayHijri.day === day;
      const isSelected = this.selectedDate && gregorianDate.toDateString() === this.selectedDate.toDateString();

      let classes = 'dcp-day';
      if (isToday) classes += ' dcp-day-today';
      if (isSelected) classes += ' dcp-day-selected';

      // IMPORTANT: never use toISOString() here because it can shift the day for GMT+ timezones.
      const isoDate = toLocalISODate(gregorianDate);

      calendarHTML += `
        <div class="${classes}" data-date="${isoDate}" data-hijri="${this.currentHijriYear}-${this.currentHijriMonth}-${day}">
          ${day}
        </div>
      `;
    }

    calendarHTML += `
        </div>
      </div>
    `;

    return calendarHTML;
  }

  /**
   * Render both dates display
   */
  renderBothDatesDisplay() {
    if (!this.selectedDate) {
      return '<div class="dcp-selected-dates">لم يتم اختيار تاريخ</div>';
    }

    const hijriDate = hijriConverter.toHijri(this.selectedDate);
    const gregorianFormatted = hijriConverter.formatGregorianNumeric(this.selectedDate, { useArabicDigits: false });
    const hijriFormatted = hijriConverter.formatHijriNumeric(hijriDate, { useArabicDigits: false });

    return `
      <div class="dcp-selected-dates">
        <div class="dcp-date-row">
          <span class="dcp-date-label">ميلادي:</span>
          <span class="dcp-date-value">${gregorianFormatted}</span>
        </div>
        <div class="dcp-date-row">
          <span class="dcp-date-label">هجري:</span>
          <span class="dcp-date-value">${hijriFormatted}</span>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to input
   */
  attachEventListeners() {
    // Open picker on display input click
    this.displayInput.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent document click listener
      if (!this.isOpen) {
        this.open();
      }
    });

    // Prevent default date picker
    this.displayInput.addEventListener('keydown', (e) => {
      e.preventDefault();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target) &&
          e.target !== this.displayInput && e.target !== this.input) {
        this.close();
      }
    });

    // Prevent clicks inside the container from closing
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Reposition picker on scroll/resize
    window.addEventListener('scroll', () => {
      if (this.isOpen) {
        this.repositionPicker();
      }
    }, true);

    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.repositionPicker();
      }
    });
  }

  /**
   * Reposition picker (for scroll/resize)
   */
  repositionPicker() {
    if (!this.isOpen) return;

    const inputRect = this.displayInput.getBoundingClientRect();
    this.container.style.top = (inputRect.bottom + 8) + 'px';
    this.container.style.right = (window.innerWidth - inputRect.right) + 'px';
  }

  /**
   * Attach event listeners to picker elements
   */
  attachPickerEventListeners() {
    // Calendar toggle - prevent closing picker
    this.container.querySelectorAll('.dcp-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click listener from closing picker
        this.activeCalendar = btn.dataset.calendar;

        // Sync current month/year when switching calendars
        if (this.activeCalendar === 'hijri' && this.selectedDate) {
          const hijriDate = hijriConverter.toHijri(this.selectedDate);
          this.currentHijriMonth = hijriDate.month;
          this.currentHijriYear = hijriDate.year;
        } else if (this.activeCalendar === 'gregorian' && this.selectedDate) {
          this.currentMonth = this.selectedDate.getMonth();
          this.currentYear = this.selectedDate.getFullYear();
        }

        this.render();
      });
    });

    // Navigation buttons - prevent closing picker
    this.container.querySelectorAll('.dcp-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click listener from closing picker
        this.handleNavigation(btn.dataset.action);
      });
    });

    // Day selection
    this.container.querySelectorAll('.dcp-day:not(.dcp-day-empty)').forEach(day => {
      day.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent closing immediately
        this.selectDate(day.dataset.date);
        // Close after selection
        setTimeout(() => this.close(), 150);
      });
    });

    // Close button
    const closeBtn = this.container.querySelector('.dcp-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }
  }

  /**
   * Handle calendar navigation
   */
  handleNavigation(action) {
    switch (action) {
      case 'prev-month':
        this.currentMonth--;
        if (this.currentMonth < 0) {
          this.currentMonth = 11;
          this.currentYear--;
        }
        break;
      case 'next-month':
        this.currentMonth++;
        if (this.currentMonth > 11) {
          this.currentMonth = 0;
          this.currentYear++;
        }
        break;
      case 'prev-year':
        this.currentYear--;
        break;
      case 'next-year':
        this.currentYear++;
        break;
      case 'prev-month-hijri':
        this.currentHijriMonth--;
        if (this.currentHijriMonth < 1) {
          this.currentHijriMonth = 12;
          this.currentHijriYear--;
        }
        break;
      case 'next-month-hijri':
        this.currentHijriMonth++;
        if (this.currentHijriMonth > 12) {
          this.currentHijriMonth = 1;
          this.currentHijriYear++;
        }
        break;
      case 'prev-year-hijri':
        this.currentHijriYear--;
        break;
      case 'next-year-hijri':
        this.currentHijriYear++;
        break;
    }

    this.render();
  }

  /**
   * Select a date
   */
  selectDate(dateStr) {
    // Parse ISO date as local date to avoid UTC parsing shifting the day.
    this.selectedDate = parseISOToLocalDate(dateStr) || new Date();

    // Update input value (ISO format for standard form submission)
    this.input.value = dateStr;

    // Trigger change event for validation
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.input.dispatchEvent(new Event('input', { bubbles: true }));

    // Update display
    this.updateDisplay();

    // Re-render to show selection
    this.render();
  }

  /**
   * Update input display
   */
  updateDisplay() {
    if (!this.selectedDate) {
      this.displayInput.value = '';
      this.displayInput.placeholder = ' ';
      this.displayInput.removeAttribute('data-has-value');
      return;
    }

    const hijriDate = hijriConverter.toHijri(this.selectedDate);
    const hijriFormatted = hijriConverter.formatHijriNumeric(hijriDate, { useArabicDigits: false });
    const gregorianFormatted = hijriConverter.formatGregorianNumeric(this.selectedDate, { useArabicDigits: false });

    // Show both calendars in the display input
    const displayText = `${hijriFormatted} • ${gregorianFormatted}`;

    // Set the visible input value and mark it as having a value
    this.displayInput.value = displayText;
    this.displayInput.setAttribute('data-has-value', 'true');

    // Force the input to show the value
    this.displayInput.setAttribute('readonly', 'readonly');
  }

  /**
   * Open the picker
   */
  open() {
    this.isOpen = true;
    this.container.style.display = 'block';

    const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
    if (isMobile) {
      this.backdrop.style.display = 'block';
      this.container.classList.add('is-centered');
      this.container.style.top = '50%';
      this.container.style.left = '50%';
      this.container.style.right = 'auto';
      this.container.style.transform = 'translate(-50%, -50%)';
      // Prevent background scroll while the picker is open
      document.documentElement.classList.add('dcp-open');
    } else {
      this.container.classList.remove('is-centered');
      this.container.style.left = 'auto';
      this.container.style.transform = 'none';
    }

    // Position the picker using fixed positioning relative to input
    const inputRect = this.displayInput.getBoundingClientRect();

    // Desktop: position below the input
    if (!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches)) {
      this.container.style.top = (inputRect.bottom + 8) + 'px';
      this.container.style.right = (window.innerWidth - inputRect.right) + 'px';
    }

    // Set calendar to show selected date's month/year
    if (this.selectedDate) {
      // Set Gregorian calendar to selected date
      this.currentMonth = this.selectedDate.getMonth();
      this.currentYear = this.selectedDate.getFullYear();

      // Set Hijri calendar to selected date
      const hijriDate = hijriConverter.toHijri(this.selectedDate);
      this.currentHijriMonth = hijriDate.month;
      this.currentHijriYear = hijriDate.year;
    } else {
      // Fallback to current date
      const now = new Date();
      this.currentMonth = now.getMonth();
      this.currentYear = now.getFullYear();
      const currentHijri = hijriConverter.getCurrentHijri();
      this.currentHijriMonth = currentHijri.month;
      this.currentHijriYear = currentHijri.year;
    }

    this.render();
  }

  /**
   * Close the picker
   */
  close() {
    this.isOpen = false;
    this.container.style.display = 'none';
    if (this.backdrop) this.backdrop.style.display = 'none';
    document.documentElement.classList.remove('dcp-open');
  }

  /**
   * Destroy the picker
   */
  destroy() {
    if (this.container) {
      this.container.remove();
    }
    if (this.backdrop) {
      this.backdrop.remove();
    }
  }
}
