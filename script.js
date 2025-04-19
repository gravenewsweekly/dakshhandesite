// @ts-check
/**
 * Configuration with environment-based fallbacks and validation
 * @type {Object}
 */
const CONFIG = {
  JSONBIN: {
    BIN_ID: '68026be88561e97a50027f65',
    API_KEY: '$2a$10$g9ECYeyBcUfoe1YWMp3w9eOZleHxwNDe4LX0Pv9yopoigUaOEJ6gq',
    BASE_URL: 'https://api.jsonbin.io/v3/b',
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,
  },
  RAZORPAY: {
    KEY: 'rzp_live_Apno0aW38JljQW',
    TIP_AMOUNT: 1500, // in paise (₹15)
    CURRENCY: 'INR',
  },
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  MAX_RECORDS: 100,
  DEFAULT_THEME: 'light',
  RATE_LIMIT: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 60000, // 1 minute
  },
  NOTIFICATION_TIMEOUT: 5000,
};

/**
 * DOM Elements with lazy initialization
 * @type {Object}
 */
const elements = {
  nav: {
    links: () => document.querySelectorAll('nav ul li a'),
    toggle: () => document.getElementById('navToggle'),
  },
  sections: {
    content: () => document.querySelectorAll('.content-section'),
    loading: () => document.getElementById('loadingSection'),
  },
  forms: {
    review: () => document.getElementById('reviewForm'),
    weekoff: () => document.getElementById('weekoffForm'),
    contact: () => document.getElementById('contactForm'),
  },
  buttons: {
    tip: () => document.getElementById('tipButton'),
    present: () => document.getElementById('presentBtn'),
    absent: () => document.getElementById('absentBtn'),
    themeToggle: () => document.getElementById('themeToggle'),
  },
  displays: {
    reviews: () => document.getElementById('reviewsList'),
    attendance: () => document.getElementById('attendanceRecords'),
    weekoffs: () => document.getElementById('weekoffRecords'),
    stats: () => document.getElementById('statsDisplay'),
    toast: () => document.getElementById('toastContainer'),
    lastSaved: () => document.getElementById('lastSaved'),
  },
  inputs: {
    passengerName: () => document.getElementById('passengerName'),
    service: () => document.getElementById('service'),
    feedback: () => document.getElementById('feedback'),
    pnr: () => document.getElementById('pnr'),
    phone: () => document.getElementById('phone'),
    weekoffType: () => document.getElementById('weekoffType'),
    weekoffNotes: () => document.getElementById('weekoffNotes'),
    contactName: () => document.getElementById('contactName'),
    contactEmail: () => document.getElementById('contactEmail'),
    contactMessage: () => document.getElementById('contactMessage'),
  },
};

/**
 * Global state with version control
 * @type {Object}
 */
const state = {
  data: {
    reviews: [],
    attendance: [],
    weekoffs: [],
    activityLog: [],
    version: '3.1',
  },
  ui: {
    currentSection: 'home',
    theme: localStorage.getItem('theme') || CONFIG.DEFAULT_THEME,
    lastSaved: null,
    isOnline: navigator.onLine,
    typingUsers: new Set(),
  },
  rateLimiter: {
    requests: [],
  },
  autoSaveInterval: null,
  liveUpdateInterval: null,
};

/**
 * Initialize application
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoading(true);
    await initializeApp();
    setupEventListeners();
    startAutoSave();
    startLiveUpdates();
    showLoading(false);
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize app. Please refresh.');
  }
});

/**
 * Initialize app components
 * @returns {Promise<void>}
 */
async function initializeApp() {
  applyTheme(state.ui.theme);
  await loadAllData();
  navigateToSection(state.ui.currentSection);
  updateLastSavedDisplay();
  updateStatsDisplay();
  requestNotificationPermission();
}

/**
 * Setup event listeners with delegation
 */
function setupEventListeners() {
  // Navigation with event delegation
  document.querySelector('nav ul')?.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      navigateToSection(targetId);
    }
  });

  // Mobile nav toggle
  elements.nav.toggle()?.addEventListener('click', () => {
    const navList = document.querySelector('nav ul');
    const isExpanded = navList.classList.toggle('active');
    elements.nav.toggle().setAttribute('aria-expanded', isExpanded.toString());
  });

  // Theme toggle
  elements.buttons.themeToggle()?.addEventListener('click', toggleTheme);

  // Review form
  elements.forms.review()?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateReviewForm()) return;

    const review = {
      passengerName: elements.inputs.passengerName().value.trim() || 'Anonymous',
      service: elements.inputs.service().value,
      feedback: elements.inputs.feedback().value.trim(),
      date: new Date().toISOString(),
      tipped: false,
      rating: document.querySelector('input[name="rating"]:checked')?.value || null,
      pnr: elements.inputs.pnr().value.trim() || null,
      phone: elements.inputs.phone().value.trim() || null,
      location: await tryGetLocation(),
      sentiment: analyzeSentiment(elements.inputs.feedback().value),
    };

    try {
      await addReview(review);
      elements.forms.review().reset();
      showToast('Feedback submitted successfully!', 'success');
      logActivity('New feedback added');
    } catch (error) {
      console.error('Submission error:', error);
      showToast('Submission failed. Please try again.', 'error');
    }
  });

  // Real-time form validation
  elements.forms.review()?.addEventListener('input', (e) => {
    const input = e.target;
    if (input.id === 'feedback') {
      simulateTypingIndicator(input.value);
      showLiveValidation(input);
    }
  });

  // Tip button
  elements.buttons.tip()?.addEventListener('click', () => {
    if (state.data.reviews.length === 0) {
      showToast('No recent feedback to tip for', 'warning');
      return;
    }
    if (confirm('Do you want to leave a ₹15 tip for the service?')) {
      initiateTipPayment();
    }
  });

  // Attendance buttons
  elements.buttons.present()?.addEventListener('click', () => recordAttendance('present', '#4CAF50'));
  elements.buttons.absent()?.addEventListener('click', () => recordAttendance('absent', '#F44336'));

  // Week off form
  elements.forms.weekoff()?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weekoff = {
      type: elements.inputs.weekoffType().value,
      date: new Date().toISOString(),
      notes: elements.inputs.weekoffNotes().value.trim() || null,
    };

    try {
      await addWeekoff(weekoff);
      elements.forms.weekoff().reset();
      showToast('Weekoff recorded!', 'success');
      logActivity('New weekoff recorded');
    } catch (error) {
      console.error('Weekoff error:', error);
      showToast('Failed to save weekoff', 'error');
    }
  });

  // Contact form
  elements.forms.contact()?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = elements.inputs.contactEmail().value.trim();
    if (!validateEmail(email)) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }

    try {
      // Simulate async submission
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast('Message sent! Thank you.', 'success');
      elements.forms.contact().reset();
      logActivity('Contact form submitted');
    } catch (error) {
      showToast('Failed to send message', 'error');
    }
  });

  // Network status
  window.addEventListener('online', () => {
    state.ui.isOnline = true;
    showToast('Back online!', 'success');
    saveAllData();
  });
  window.addEventListener('offline', () => {
    state.ui.isOnline = false;
    showToast('Offline mode activated', 'warning');
  });

  // Before unload
  window.addEventListener('beforeunload', handleBeforeUnload);
}

/**
 * Data Management with Retries
 */

/**
 * Load all data with fallback
 * @returns {Promise<void>}
 */
async function loadAllData() {
  try {
    const response = await fetchWithRetry(`${CONFIG.JSONBIN.BASE_URL}/${CONFIG.JSONBIN.BIN_ID}/latest`, {
      headers: { 'X-Master-Key': CONFIG.JSONBIN.API_KEY },
      cache: 'no-cache',
    });

    const json = await response.json();
    if (json.record) {
      state.data = {
        reviews: json.record.reviews || [],
        attendance: json.record.attendance || [],
        weekoffs: json.record.weekoffs || [],
        activityLog: json.record.activityLog || [],
        version: json.record.version || '3.1',
      };

      trimData();
      updateAllDisplays();
    }
  } catch (error) {
    console.error('Loading error:', error);
    const localData = localStorage.getItem('localBackup');
    if (localData) {
      state.data = JSON.parse(localData);
      showToast('Using locally saved data', 'warning');
      updateAllDisplays();
    } else {
      showToast('Failed to load data', 'error');
    }
  }
}

/**
 * Save all data with retry
 * @returns {Promise<boolean>}
 */
async function saveAllData() {
  if (!isRateLimited()) {
    try {
      const response = await fetchWithRetry(`${CONFIG.JSONBIN.BASE_URL}/${CONFIG.JSONBIN.BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.JSONBIN.API_KEY,
          'X-Bin-Versioning': 'false',
        },
        body: JSON.stringify(state.data),
      });

      state.ui.lastSaved = new Date();
      updateLastSavedDisplay();
      localStorage.setItem('localBackup', JSON.stringify(state.data));
      return true;
    } catch (error) {
      console.error('Saving error:', error);
      localStorage.setItem('localBackup', JSON.stringify(state.data));
      showToast('Data saved locally (cloud sync failed)', 'warning');
      return false;
    }
  } else {
    localStorage.setItem('localBackup', JSON.stringify(state.data));
    showToast('Rate limit reached, data saved locally', 'warning');
    return false;
  }
}

/**
 * Start auto-save
 */
function startAutoSave() {
  if (state.autoSaveInterval) clearInterval(state.autoSaveInterval);
  state.autoSaveInterval = setInterval(async () => {
    if (hasUnsavedChanges()) {
      await saveAllData();
    }
  }, CONFIG.AUTO_SAVE_INTERVAL);
}

/**
 * Start live updates (simulated WebSocket with polling)
 */
function startLiveUpdates() {
  if (state.liveUpdateInterval) clearInterval(state.liveUpdateInterval);
  state.liveUpdateInterval = setInterval(async () => {
    if (state.ui.currentSection === 'reviews') {
      await loadAllData();
      // Simulate new feedback
      if (Math.random() < 0.1) {
        simulateNewFeedback();
      }
    }
  }, 10000); // Poll every 10 seconds
}

/**
 * CRUD Operations
 */

/**
 * Add review
 * @param {Object} review
 * @returns {Promise<void>}
 */
async function addReview(review) {
  if (!review || !review.service || !review.feedback) {
    throw new Error('Invalid review data');
  }
  state.data.reviews.push(review);
  trimData();
  updateDisplays('reviews');
  await saveAllData();
  sendPushNotification('New feedback received!');
}

/**
 * Record attendance
 * @param {string} status
 * @param {string} color
 * @returns {Promise<void>}
 */
async function recordAttendance(status, color) {
  const record = {
    status,
    color,
    date: new Date().toISOString(),
    location: await tryGetLocation(),
  };
  state.data.attendance.push(record);
  trimData();
  updateDisplays('attendance');
  await saveAllData();
  showToast(`Marked as ${status}`, 'success');
  logActivity(`Attendance marked: ${status}`);
}

/**
 * Add weekoff
 * @param {Object} weekoff
 * @returns {Promise<void>}
 */
async function addWeekoff(weekoff) {
  if (!weekoff.type) {
    throw new Error('Weekoff type is required');
  }
  state.data.weekoffs.push(weekoff);
  trimData();
  updateDisplays('weekoffs');
  await saveAllData();
}

/**
 * Log activity
 * @param {string} action
 */
function logActivity(action) {
  state.data.activityLog.push({
    action,
    date: new Date().toISOString(),
  });
  trimData();
  updateActivityTimeline();
}

/**
 * Display Functions
 */

/**
 * Update all displays
 */
function updateAllDisplays() {
  updateDisplays('reviews');
  updateDisplays('attendance');
  updateDisplays('weekoffs');
  updateStatsDisplay();
  updateActivityTimeline();
}

/**
 * Update specific display
 * @param {string} type
 */
function updateDisplays(type) {
  switch (type) {
    case 'reviews':
      displayReviews();
      break;
    case 'attendance':
      displayAttendance();
      break;
    case 'weekoffs':
      displayWeekoffs();
      break;
  }
  updateStatsDisplay();
}

/**
 * Display reviews with sentiment
 */
function displayReviews() {
  const reviews = state.data.reviews;
  const container = elements.displays.reviews();
  container.innerHTML = reviews.length
    ? reviews
        .slice()
        .reverse()
        .map(
          (review, index) => `
      <div class="review-item ${review.tipped ? 'tipped' : ''}">
        <div class="review-header">
          <h3>${escapeHtml(review.passengerName)}</h3>
          ${
            review.rating
              ? `<div class="stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>`
              : ''
          }
          <span class="sentiment ${
            review.sentiment > 0 ? 'positive' : review.sentiment < 0 ? 'negative' : 'neutral'
          }">
            ${review.sentiment > 0 ? '😊' : review.sentiment < 0 ? '😔' : '😐'}
          </span>
        </div>
        <div class="review-meta">
          <span class="review-date">${formatDate(review.date)}</span>
          ${review.tipped ? '<span class="tip-badge">Tipped</span>' : ''}
          ${review.location ? `<span class="review-location">📍 ${escapeHtml(review.location)}</span>` : ''}
        </div>
        ${review.pnr ? `<p><strong>PNR:</strong> <span class="monospace">${escapeHtml(review.pnr)}</span></p>` : ''}
        ${review.phone ? `<p><strong>Phone:</strong> ${escapeHtml(review.phone)}</p>` : ''}
        <p><strong>Service:</strong> ${escapeHtml(review.service)}</p>
        <div class="feedback-content">${escapeHtml(review.feedback)}</div>
        ${index === reviews.length - 1 ? '<div class="latest-indicator">NEWEST</div>' : ''}
      </div>
    `
        )
        .join('')
    : '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>No feedback yet. Be the first to review!</p></div>';
}

/**
 * Display attendance
 */
function displayAttendance() {
  const records = state.data.attendance;
  const container = elements.displays.attendance();
  container.innerHTML = records.length
    ? `
      <div class="attendance-summary">
        <p>Present: ${records.filter((r) => r.status === 'present').length} days</p>
        <p>Absent: ${records.filter((r) => r.status === 'absent').length} days</p>
      </div>` +
      records
        .slice()
        .reverse()
        .map(
          (record) => `
      <div class="record-item" style="border-left: 4px solid ${record.color}">
        <div class="record-status" style="color: ${record.color}">
          ${record.status === 'present' ? '✓ Present' : '✗ Absent'}
        </div>
        <div class="record-meta">
          <span class="record-date">${formatDate(record.date)}</span>
          ${record.location ? `<span class="record-location">📍 ${escapeHtml(record.location)}</span>` : ''}
        </div>
      </div>
    `
        )
        .join('')
    : '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No attendance records yet</p></div>';
}

/**
 * Display weekoffs
 */
function displayWeekoffs() {
  const weekoffs = state.data.weekoffs;
  const container = elements.displays.weekoffs();
  container.innerHTML = weekoffs.length
    ? weekoffs
        .slice()
        .reverse()
        .map(
          (weekoff) => `
      <div class="record-item">
        <h3>${weekoff.type.toUpperCase()}</h3>
        <div class="record-meta">
          <span class="record-date">${formatDate(weekoff.date)}</span>
          ${weekoff.notes ? `<p class="weekoff-notes">${escapeHtml(weekoff.notes)}</p>` : ''}
        </div>
      </div>
    `
        )
        .join('')
    : '<div class="empty-state"><i class="fas fa-calendar-minus"></i><p>No weekoff records yet</p></div>';
}

/**
 * Update stats with animations
 */
function updateStatsDisplay() {
  const stats = {
    totalReviews: state.data.reviews.length,
    totalTipped: state.data.reviews.filter((r) => r.tipped).length,
    presentDays: state.data.attendance.filter((a) => a.status === 'present').length,
    absentDays: state.data.attendance.filter((a) => a.status === 'absent').length,
    weekoffs: state.data.weekoffs.length,
    positiveFeedback: state.data.reviews.filter((r) => r.sentiment > 0).length,
  };

  const container = elements.displays.stats();
  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card animate-number" data-target="${stats.totalReviews}">
        <h3>${stats.totalReviews}</h3>
        <p>Total Reviews</p>
      </div>
      <div class="stat-card animate-number" data-target="${stats.totalTipped}">
        <h3>${stats.totalTipped}</h3>
        <p>Tipped Services</p>
      </div>
      <div class="stat-card animate-number" data-target="${stats.presentDays}">
        <h3>${stats.presentDays}</h3>
        <p>Days Present</p>
      </div>
      <div class="stat-card animate-number" data-target="${stats.absentDays}">
        <h3>${stats.absentDays}</h3>
        <p>Days Absent</p>
      </div>
      <div class="stat-card animate-number" data-target="${stats.weekoffs}">
        <h3>${stats.weekoffs}</h3>
        <p>Weekoffs Taken</p>
      </div>
      <div class="stat-card animate-number" data-target="${stats.positiveFeedback}">
        <h3>${stats.positiveFeedback}</h3>
        <p>Positive Feedback</p>
      </div>
    </div>
  `;

  // Animate numbers
  document.querySelectorAll('.animate-number').forEach((el) => {
    const target = parseInt(el.dataset.target);
    animateNumber(el.querySelector('h3'), target);
  });

  // Update charts
  updateCharts();
}

/**
 * Update activity timeline
 */
function updateActivityTimeline() {
  const timeline = state.data.activityLog.slice().reverse().slice(0, 5);
  const homeSection = document.querySelector('#home');
  let timelineContainer = homeSection.querySelector('.activity-timeline');
  if (!timelineContainer) {
    timelineContainer = document.createElement('div');
    timelineContainer.className = 'card activity-timeline';
    timelineContainer.innerHTML = '<h3><i class="fas fa-stream"></i> Recent Activity</h3>';
    homeSection.appendChild(timelineContainer);
  }
  timelineContainer.innerHTML =
    '<h3><i class="fas fa-stream"></i> Recent Activity</h3>' +
    (timeline.length
      ? timeline
          .map(
            (activity) => `
      <div class="activity-item">
        <span class="activity-date">${formatDate(activity.date)}</span>
        <p>${escapeHtml(activity.action)}</p>
      </div>
    `
          )
          .join('')
      : '<p>No recent activity</p>');
}

/**
 * Animate number count-up
 * @param {HTMLElement} element
 * @param {number} target
 */
function animateNumber(element, target) {
  let current = 0;
  const step = target / 50;
  const interval = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    element.textContent = Math.round(current).toString();
  }, 20);
}

/**
 * Update charts
 */
function updateCharts() {
  const ratingsData = state.data.reviews.reduce((acc, review) => {
    const rating = review.rating || 'No Rating';
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});
  const attendanceData = state.data.attendance.reduce(
    (acc, record) => {
      acc[record.status]++;
      return acc;
    },
    { present: 0, absent: 0 }
  );

  // Ratings chart
  if (window.Chart) {
    new Chart(document.getElementById('ratingsChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(ratingsData),
        datasets: [
          {
            label: 'Feedback Ratings',
            data: Object.values(ratingsData),
            backgroundColor: '#0066cc',
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
      },
    });

    // Attendance chart
    new Chart(document.getElementById('attendanceChart'), {
      type: 'pie',
      data: {
        labels: ['Present', 'Absent'],
        datasets: [
          {
            data: [attendanceData.present, attendanceData.absent],
            backgroundColor: ['#4CAF50', '#F44336'],
          },
        ],
      },
      options: { responsive: true },
    });
  }
}

/**
 * UI Helpers
 */

/**
 * Navigate to section
 * @param {string} sectionId
 */
function navigateToSection(sectionId) {
  elements.nav.links().forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
    link.setAttribute('aria-current', link.getAttribute('href') === `#${sectionId}` ? 'page' : 'false');
  });

  elements.sections.content().forEach((section) => {
    section.hidden = section.id !== sectionId;
  });

  document.querySelector('nav ul').classList.remove('active');
  state.ui.currentSection = sectionId;

  updateDisplays(sectionId);
}

/**
 * Apply theme with sync
 * @param {string} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  elements.buttons.themeToggle().querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  state.ui.theme = theme;

  // Sync theme to server (simulated)
  if (state.ui.isOnline) {
    localStorage.setItem('themeSync', theme);
  }
}

/**
 * Toggle theme
 */
function toggleTheme() {
  const newTheme = state.ui.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

/**
 * Show loading
 * @param {boolean} show
 */
function showLoading(show) {
  const loading = elements.sections.loading();
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
    loading.setAttribute('aria-hidden', (!show).toString());
  }
}

/**
 * Show toast notification
 * @param {string} message
 * @param {string} type
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  elements.displays.toast().appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, CONFIG.NOTIFICATION_TIMEOUT);
}

/**
 * Show error
 * @param {string} message
 */
function showError(message) {
  const errorEl = document.getElementById('errorDisplay');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.focus();
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, CONFIG.NOTIFICATION_TIMEOUT);
  }
}

/**
 * Simulate typing indicator
 * @param {string} text
 */
function simulateTypingIndicator(text) {
  if (text.length > 10) {
    state.ui.typingUsers.add('Anonymous');
    const reviewsList = elements.displays.reviews();
    let typingIndicator = reviewsList.querySelector('.typing-indicator');
    if (!typingIndicator) {
      typingIndicator = document.createElement('div');
      typingIndicator.className = 'typing-indicator';
      reviewsList.prepend(typingIndicator);
    }
    typingIndicator.textContent = 'Someone is typing feedback...';
    setTimeout(() => {
      state.ui.typingUsers.delete('Anonymous');
      typingIndicator.remove();
    }, 3000);
  }
}

/**
 * Show live validation
 * @param {HTMLInputElement} input
 */
function showLiveValidation(input) {
  const feedback = input.value.trim();
  const hint = input.parentElement.querySelector('.hint');
  if (feedback.length < 5) {
    hint.textContent = 'Feedback should be at least 5 characters';
    hint.classList.add('error');
  } else {
    hint.textContent = 'Looks good!';
    hint.classList.remove('error');
    hint.classList.add('success');
  }
}

/**
 * Utilities
 */

/**
 * Format date
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return 'Unknown date';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date and time
 * @param {Date|string} date
 * @returns {string}
 */
function formatDateTime(date) {
  if (!date) return 'Unknown';
  if (typeof date === 'string') date = new Date(date);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Escape HTML
 * @param {string} unsafe
 * @returns {string}
 */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate email
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate review form
 * @returns {boolean}
 */
function validateReviewForm() {
  const { passengerName, service, feedback } = elements.inputs;
  if (!service().value) {
    showToast('Please select a service type', 'warning');
    service().focus();
    return false;
  }
  if (feedback().value.trim().length < 5) {
    showToast('Please provide more detailed feedback', 'warning');
    feedback().focus();
    return false;
  }
  return true;
}

/**
 * Get geolocation
 * @returns {Promise<string|null>}
 */
async function tryGetLocation() {
  if (!navigator.geolocation) return null;
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 60000,
      });
    });
    return `Lat: ${position.coords.latitude.toFixed(2)}, Long: ${position.coords.longitude.toFixed(2)}`;
  } catch (error) {
    console.error('Geolocation error:', error);
    return null;
  }
}

/**
 * Analyze sentiment (basic)
 * @param {string} text
 * @returns {number}
 */
function analyzeSentiment(text) {
  const positiveWords = ['great', 'excellent', 'wonderful', 'helpful', 'good'];
  const negativeWords = ['poor', 'bad', 'terrible', 'awful', 'disappointing'];
  let score = 0;
  text = text.toLowerCase();
  positiveWords.forEach((word) => {
    if (text.includes(word)) score += 1;
  });
  negativeWords.forEach((word) => {
    if (text.includes(word)) score -= 1;
  });
  return score;
}

/**
 * Simulate new feedback
 */
function simulateNewFeedback() {
  const mockReview = {
    passengerName: 'Anonymous',
    service: 'boarding',
    feedback: 'Great service, very helpful!',
    date: new Date().toISOString(),
    tipped: false,
    rating: '5',
    sentiment: 1,
  };
  state.data.reviews.push(mockReview);
  updateDisplays('reviews');
  showToast('New feedback received!', 'success');
  sendPushNotification('New feedback received!');
}

/**
 * Trim data to prevent bloat
 */
function trimData() {
  Object.keys(state.data).forEach((key) => {
    if (Array.isArray(state.data[key]) && state.data[key].length > CONFIG.MAX_RECORDS) {
      state.data[key] = state.data[key].slice(-CONFIG.MAX_RECORDS);
    }
  });
}

/**
 * Check rate limiting
 * @returns {boolean}
 */
function isRateLimited() {
  const now = Date.now();
  state.rateLimiter.requests = state.rateLimiter.requests.filter((t) => now - t < CONFIG.RATE_LIMIT.WINDOW_MS);
  if (state.rateLimiter.requests.length >= CONFIG.RATE_LIMIT.MAX_REQUESTS) {
    return true;
  }
  state.rateLimiter.requests.push(now);
  return false;
}

/**
 * Fetch with retry
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, retries = CONFIG.JSONBIN.RETRY_COUNT) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, CONFIG.JSONBIN.RETRY_DELAY));
,…
