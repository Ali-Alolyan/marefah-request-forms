/* Auth module — account-code login via Supabase */

(function () {
  const SUPABASE_URL = 'https://rlftalctuaybztrgegnb.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZnRhbGN0dWF5Ynp0cmdlZ25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzMzMDIsImV4cCI6MjA4NTYwOTMwMn0.ZhNWNj8U6Xn9jaWqgVX33IKcPPyz6ZuTTF3qycGanwo';
  const SESSION_KEY = 'marefah-auth-session-v2';
  const OLD_SESSION_KEY = 'marefah-auth-session-v1';
  const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  /* ---- Supabase client (with CDN failure detection) ---- */

  let supabase = null;
  let supabaseUnavailable = false;

  try {
    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      supabaseUnavailable = true;
    }
  } catch (_) {
    supabaseUnavailable = true;
  }

  /* ---- Session helpers ---- */

  function toCleanString(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function firstNonEmpty(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (const key of keys) {
      const val = toCleanString(obj[key]);
      if (val) return val;
    }
    return '';
  }

  function firstNonEmptyFromRows(rows, keys) {
    for (const row of rows) {
      const val = firstNonEmpty(row, keys);
      if (val) return val;
    }
    return '';
  }

  function normalizeProjectRow(row) {
    if (!row || typeof row !== 'object') return null;

    const projectId = toCleanString(
      row.project_id ??
      row.projectId ??
      row.id ??
      row.project?.project_id ??
      row.project?.id
    );
    const projectName = toCleanString(
      row.project_name ??
      row.projectName ??
      row.project?.project_name ??
      row.project?.name
    );
    const programName = toCleanString(
      row.program_name ??
      row.programName ??
      row.program?.program_name ??
      row.program?.name
    );
    const costCenter = toCleanString(
      row.cost_center ??
      row.costCenter ??
      row.project?.cost_center ??
      row.project?.costCenter
    );
    const portfolioName = toCleanString(
      row.portfolio_name ??
      row.portfolioName ??
      row.portfolio?.portfolio_name ??
      row.portfolio?.name
    );

    if (!projectId && !projectName && !programName && !costCenter && !portfolioName) {
      return null;
    }

    return {
      project_id: projectId || `${projectName || 'project'}|${costCenter || 'cc'}`,
      project_name: projectName,
      program_name: programName,
      cost_center: costCenter,
      portfolio_name: portfolioName
    };
  }

  function dedupeProjects(items) {
    const out = [];
    const seen = new Set();
    for (const item of items) {
      if (!item) continue;
      const key = [item.project_id, item.cost_center, item.project_name].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function normalizeProjects(raw) {
    if (!raw) return [];

    if (typeof raw === 'string') {
      try {
        return normalizeProjects(JSON.parse(raw));
      } catch (_) {
        return [];
      }
    }

    if (Array.isArray(raw)) {
      return dedupeProjects(raw.map(normalizeProjectRow).filter(Boolean));
    }

    if (typeof raw === 'object') {
      const nested = raw.projects ?? raw.employee_projects ?? raw.assigned_projects ?? raw.user_projects;
      if (nested != null && nested !== raw) {
        return normalizeProjects(nested);
      }

      const single = normalizeProjectRow(raw);
      if (single) return [single];

      const values = Object.values(raw);
      if (values.length) return normalizeProjects(values);
    }

    return [];
  }

  function normalizeLookupPayload(data) {
    let rows = [];
    if (Array.isArray(data)) {
      rows = data.filter(r => r && typeof r === 'object');
    } else if (data && typeof data === 'object') {
      rows = [data];
    }
    if (!rows.length) return null;

    const head = rows[0];
    const fullName = firstNonEmptyFromRows(rows, ['full_name', 'employee_name', 'name']);
    const jobTitle = firstNonEmptyFromRows(rows, ['job_title', 'title', 'position']);
    const jobTitleSecondary = firstNonEmptyFromRows(rows, ['job_title_secondary', 'secondary_job_title', 'title_secondary']) || null;

    let projects = normalizeProjects(
      head.projects ?? head.employee_projects ?? head.assigned_projects ?? head.user_projects
    );

    // Fallback: some RPCs return one row per project instead of a nested projects array.
    if (!projects.length && rows.length > 1) {
      projects = normalizeProjects(rows);
    }

    // Fallback: some RPCs return single-row payload with project fields on the row itself.
    if (!projects.length) {
      const single = normalizeProjectRow(head);
      if (single) projects = [single];
    }

    return {
      full_name: fullName,
      job_title: jobTitle,
      job_title_secondary: jobTitleSecondary,
      projects
    };
  }

  function saveSession(data) {
    data._savedAt = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.full_name || !s.job_title || !s.account_code) return null;
      // Expire session after 24 hours
      if (s._savedAt && (Date.now() - s._savedAt) > SESSION_MAX_AGE_MS) {
        clearSession();
        return null;
      }
      s.projects = normalizeProjects(s.projects);
      return s;
    } catch (_) { /* corrupt */ }
    return null;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(OLD_SESSION_KEY);
  }

  /* ---- DOM refs ---- */

  function getOverlay() { return document.getElementById('loginOverlay'); }
  function getError()   { return document.getElementById('loginError'); }
  function getCodeInput(){ return document.getElementById('loginCode'); }
  function getSubmitBtn(){ return document.getElementById('loginSubmit'); }
  function getLogoutBtn(){ return document.getElementById('btn-logout'); }

  /* ---- UI helpers ---- */

  var _focusTrapHandler = null;

  function showOverlay() {
    const ov = getOverlay();
    if (ov) ov.classList.add('is-active');
    document.body.classList.add('login-active');

    // Focus the code input
    var inp = getCodeInput();
    if (inp) setTimeout(function(){ inp.focus(); }, 50);

    // Install focus trap
    if (!_focusTrapHandler) {
      _focusTrapHandler = function(e) {
        if (e.key !== 'Tab') return;
        var overlay = getOverlay();
        if (!overlay || !overlay.classList.contains('is-active')) return;
        var focusable = overlay.querySelectorAll('input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', _focusTrapHandler);
    }
  }

  function hideOverlay() {
    const ov = getOverlay();
    if (ov) ov.classList.remove('is-active');
    document.body.classList.remove('login-active');

    // Remove focus trap
    if (_focusTrapHandler) {
      document.removeEventListener('keydown', _focusTrapHandler);
      _focusTrapHandler = null;
    }
  }

  function showError(msg) {
    const el = getError();
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function hideError() {
    const el = getError();
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  function setLoading(on) {
    const btn = getSubmitBtn();
    const inp = getCodeInput();
    if (btn) { btn.disabled = on; btn.textContent = on ? 'جاري التحقق...' : 'تسجيل الدخول'; }
    if (inp) inp.disabled = on;
  }

  /* ---- Apply session to form fields ---- */

  function applySession(session) {
    const nameEl = document.getElementById('applicantName');
    if (nameEl) { nameEl.value = session.full_name; nameEl.readOnly = true; }

    // Job title: if secondary title exists, replace input with a select dropdown
    var titleContainer = document.getElementById('jobTitle');
    if (titleContainer && session.job_title_secondary) {
      // Replace the input with a select element
      var sel = document.createElement('select');
      sel.id = 'jobTitle';
      sel.className = titleContainer.className;
      var opt1 = document.createElement('option');
      opt1.value = session.job_title;
      opt1.textContent = session.job_title;
      sel.appendChild(opt1);
      var opt2 = document.createElement('option');
      opt2.value = session.job_title_secondary;
      opt2.textContent = session.job_title_secondary;
      sel.appendChild(opt2);
      titleContainer.parentNode.replaceChild(sel, titleContainer);
      sel.addEventListener('change', function() {
        if (typeof window.refresh === 'function') window.refresh();
      });
    } else if (titleContainer) {
      titleContainer.value = session.job_title;
      titleContainer.readOnly = true;
    }

    const logoutBtn = getLogoutBtn();
    if (logoutBtn) logoutBtn.style.display = '';
  }

  function clearFields() {
    const nameEl = document.getElementById('applicantName');
    if (nameEl) { nameEl.value = ''; nameEl.readOnly = false; }

    // If jobTitle was replaced with a select, restore it to an input
    var titleEl = document.getElementById('jobTitle');
    if (titleEl && titleEl.tagName === 'SELECT') {
      var inp = document.createElement('input');
      inp.id = 'jobTitle';
      inp.className = titleEl.className;
      inp.placeholder = 'مثال: مدير إدارة البرامج والمشاريع';
      titleEl.parentNode.replaceChild(inp, titleEl);
    } else if (titleEl) {
      titleEl.value = '';
      titleEl.readOnly = false;
    }

    const logoutBtn = getLogoutBtn();
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  /* ---- Login handler ---- */

  async function handleLogin(code) {
    hideError();

    if (supabaseUnavailable || !supabase) {
      showError('تعذر الاتصال بخدمة المصادقة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
      return;
    }

    const codeNum = Number(code);
    if (!code || isNaN(codeNum) || code.length !== 9) {
      showError('يرجى إدخال كود حساب مكون من 9 أرقام.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('lookup_employee', { p_account_code: codeNum });
      if (error) {
        if (error.message && error.message.includes('RATE_LIMIT_EXCEEDED')) {
          showError('محاولات كثيرة جدًا. يرجى الانتظار 15 دقيقة ثم المحاولة مرة أخرى.');
        } else if (error.message && error.message.includes('EMPLOYEE_NOT_FOUND')) {
          showError('كود الحساب غير مسجل. تأكد من الكود وحاول مرة أخرى.');
        } else {
          showError('حدث خطأ أثناء التحقق. حاول مرة أخرى.');
        }
        return;
      }

      const normalized = normalizeLookupPayload(data);
      if (!normalized || !normalized.full_name || !normalized.job_title) {
        showError('تعذر قراءة بيانات الحساب. يرجى المحاولة مرة أخرى.');
        return;
      }

      const session = {
        account_code: codeNum,
        full_name: normalized.full_name,
        job_title: normalized.job_title,
        job_title_secondary: normalized.job_title_secondary || null,
        projects: normalized.projects
      };
      saveSession(session);
      applySession(session);
      hideOverlay();

      // Load projects data and rebuild dropdown
      if (typeof window.loadSessionProjects === 'function') window.loadSessionProjects(session);
      if (typeof window.buildProjectDropdown === 'function') window.buildProjectDropdown();

      // Trigger a refresh so the preview updates with the new name/title
      if (typeof window.refresh === 'function') window.refresh();
    } catch (e) {
      showError('حدث خطأ في الاتصال. تحقق من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  }

  /* ---- Logout ---- */

  function logout() {
    clearSession();
    clearFields();

    // Clear projects data and rebuild empty dropdown
    if (typeof window.loadSessionProjects === 'function') window.loadSessionProjects(null);
    if (typeof window.buildProjectDropdown === 'function') window.buildProjectDropdown();
    if (typeof window.resetEditorState === 'function') window.resetEditorState();

    showOverlay();

    // Clear the code input for next login
    const inp = getCodeInput();
    if (inp) inp.value = '';
    hideError();

    if (typeof window.refresh === 'function') window.refresh();
  }

  /* ---- Bind events ---- */

  function bindLoginForm() {
    const form = document.getElementById('loginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var inp = getCodeInput();
        handleLogin(inp ? inp.value.trim() : '');
      });
    }

    const logoutBtn = getLogoutBtn();
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        logout();
      });
    }
  }

  /* ---- Public API ---- */

  Object.defineProperty(window, 'authSession', {
    get: function () { return loadSession(); },
    configurable: true
  });

  window.authLogout = logout;
  window.authApplySession = applySession;

  /* ---- Init on DOM ready ---- */

  function initAuth() {
    bindLoginForm();

    // Clear old session format
    localStorage.removeItem(OLD_SESSION_KEY);

    // If Supabase CDN failed to load, show error and disable login
    if (supabaseUnavailable) {
      showOverlay();
      showError('تعذر تحميل خدمة المصادقة. تأكد من اتصالك بالإنترنت وأعد تحميل الصفحة.');
      var btn = getSubmitBtn();
      if (btn) btn.disabled = true;
      return;
    }

    var session = loadSession();
    if (session) {
      applySession(session);
      hideOverlay();
    } else {
      showOverlay();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
})();
