// Enhanced Configuration with fallbacks
const CONFIG = {
  JSONBIN: {
    BIN_ID: '68026be88561e97a50027f65',
    API_KEY: '$2a$10$g9ECYeyBcUfoe1YWMp3w9eOZleHxwNDe4LX0Pv9yopoigUaOEJ6gq',
    BASE_URL: 'https://api.jsonbin.io/v3/b'
  },
  RAZORPAY: {
    KEY: 'rzp_live_Apno0aW38JljQW',
    TIP_AMOUNT: 1500, // in paise (₹15)
    CURRENCY: 'INR'
  },
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  MAX_RECORDS: 100, // Prevent data bloat
  DEFAULT_THEME: 'light'
};

// DOM Elements with better organization
const elements = {
  nav: {
    links: document.querySelectorAll('nav ul li a'),
    toggle: document.getElementById('navToggle')
  },
  sections: {
    content: document.querySelectorAll('.content-section'),
    loading: document.getElementById('loadingSection')
  },
  forms: {
    review: document.getElementById('reviewForm'),
    weekoff: document.getElementById('weekoffForm'),
    contact: document.getElementById('contactForm')
  },
  buttons: {
    tip: document.getElementById('tipButton'),
    present: document.getElementById('presentBtn'),
    absent: document.getElementById('absentBtn'),
    themeToggle: document.getElementById('themeToggle')
  },
  displays: {
    reviews: document.getElementById('reviewsList'),
    attendance: document.getElementById('attendanceRecords'),
    weekoffs: document.getElementById('weekoffRecords'),
    stats: document.getElementById('statsDisplay')
  },
  inputs: {
    passengerName: document.getElementById('passengerName'),
    service: document.getElementById('service'),
    feedback: document.getElementById('feedback')
  }
};

// Global state with better structure
const state = {
  data: {
    reviews: [],
    attendance: [],
    weekoffs: []
  },
  ui: {
    currentSection: 'dashboard',
    theme: localStorage.getItem('theme') || CONFIG.DEFAULT_THEME,
    lastSaved: null
  },
  autoSaveInterval: null
};

// Enhanced initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoading(true);
    await initializeApp();
    setupEventListeners();
    startAutoSave();
    showLoading(false);
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize app. Please refresh.');
  }
});

async function initializeApp() {
  // Set theme
  applyTheme(state.ui.theme);
  
  // Load data
  await loadAllData();
  
  // Initialize UI
  navigateToSection(state.ui.currentSection);
  updateLastSavedDisplay();
  updateStatsDisplay();
}

function setupEventListeners() {
  // Navigation
  elements.nav.links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      navigateToSection(targetId);
    });
  });
  
  // Mobile nav toggle
  if (elements.nav.toggle) {
    elements.nav.toggle.addEventListener('click', () => {
      document.querySelector('nav ul').classList.toggle('active');
    });
  }
  
  // Theme toggle
  elements.buttons.themeToggle.addEventListener('click', toggleTheme);
  
  // Review form with validation
  elements.forms.review.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateReviewForm()) return;
    
    const review = {
      passengerName: elements.inputs.passengerName.value.trim() || 'Anonymous',
      service: elements.inputs.service.value,
      feedback: elements.inputs.feedback.value.trim(),
      date: new Date().toISOString(),
      tipped: false,
      rating: document.querySelector('input[name="rating"]:checked')?.value || null,
      ...(document.getElementById('pnr').value && { pnr: document.getElementById('pnr').value.trim() }),
      ...(document.getElementById('phone').value && { phone: document.getElementById('phone').value.trim() })
    };
    
    try {
      await addReview(review);
      elements.forms.review.reset();
      showToast('Feedback submitted successfully!', 'success');
    } catch (error) {
      console.error('Submission error:', error);
      showToast('Submission failed. Please try again.', 'error');
    }
  });
  
  // Tip button with confirmation
  elements.buttons.tip.addEventListener('click', () => {
    if (state.data.reviews.length === 0) {
      showToast('No recent feedback to tip for', 'warning');
      return;
    }
    
    if (confirm('Do you want to leave a ₹15 tip for the service?')) {
      initiateTipPayment();
    }
  });
  
  // Attendance buttons
  elements.buttons.present.addEventListener('click', () => recordAttendance('present', '#4CAF50'));
  elements.buttons.absent.addEventListener('click', () => recordAttendance('absent', '#F44336'));
  
  // Week off form
  elements.forms.weekoff.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weekoff = {
      type: document.getElementById('weekoffType').value,
      date: new Date().toISOString(),
      notes: document.getElementById('weekoffNotes').value.trim() || null
    };
    
    try {
      await addWeekoff(weekoff);
      elements.forms.weekoff.reset();
      showToast('Weekoff recorded!', 'success');
    } catch (error) {
      console.error('Weekoff error:', error);
      showToast('Failed to save weekoff', 'error');
    }
  });
  
  // Contact form with basic validation
  elements.forms.contact.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('contactEmail').value.trim();
    if (email && !validateEmail(email)) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }
    
    // Simulate submission
    setTimeout(() => {
      showToast('Message sent! Thank you.', 'success');
      elements.forms.contact.reset();
    }, 1000);
  });
  
  // Window events
  window.addEventListener('beforeunload', handleBeforeUnload);
}

// Data management functions with enhanced features
async function loadAllData() {
  try {
    const response = await fetch(`${CONFIG.JSONBIN.BASE_URL}/${CONFIG.JSONBIN.BIN_ID}/latest`, {
      headers: { 'X-Master-Key': CONFIG.JSONBIN.API_KEY },
      cache: 'no-cache'
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const json = await response.json();
    
    if (json.record) {
      state.data = {
        reviews: json.record.reviews || [],
        attendance: json.record.attendance || [],
        weekoffs: json.record.weekoffs || []
      };
      
      // Trim data if exceeds max records
      Object.keys(state.data).forEach(key => {
        if (state.data[key].length > CONFIG.MAX_RECORDS) {
          state.data[key] = state.data[key].slice(-CONFIG.MAX_RECORDS);
        }
      });
      
      updateAllDisplays();
    }
  } catch (error) {
    console.error('Loading error:', error);
    
    // Try to load from localStorage if API fails
    const localData = localStorage.getItem('localBackup');
    if (localData) {
      state.data = JSON.parse(localData);
      showToast('Using locally saved data', 'warning');
    } else {
      showToast('Failed to load data', 'error');
    }
  }
}

async function saveAllData() {
  try {
    const response = await fetch(`${CONFIG.JSONBIN.BASE_URL}/${CONFIG.JSONBIN.BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': CONFIG.JSONBIN.API_KEY,
        'X-Bin-Versioning': 'false'
      },
      body: JSON.stringify(state.data)
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    state.ui.lastSaved = new Date();
    updateLastSavedDisplay();
    
    // Also save to localStorage as backup
    localStorage.setItem('localBackup', JSON.stringify(state.data));
    
    return true;
  } catch (error) {
    console.error('Saving error:', error);
    
    // Fallback to localStorage
    localStorage.setItem('localBackup', JSON.stringify(state.data));
    showToast('Data saved locally (cloud sync failed)', 'warning');
    
    return false;
  }
}

function startAutoSave() {
  if (state.autoSaveInterval) clearInterval(state.autoSaveInterval);
  
  state.autoSaveInterval = setInterval(async () => {
    if (hasUnsavedChanges()) {
      const success = await saveAllData();
      if (success) {
        console.log('Auto-saved successfully');
      }
    }
  }, CONFIG.AUTO_SAVE_INTERVAL);
}

function hasUnsavedChanges() {
  // Compare with last saved version
  const lastSaved = localStorage.getItem('localBackup');
  return !lastSaved || lastSaved !== JSON.stringify(state.data);
}

// CRUD Operations with validation
async function addReview(review) {
  if (!review || !review.service) {
    throw new Error('Invalid review data');
  }
  
  state.data.reviews.push(review);
  updateDisplays('reviews');
  await saveAllData();
}

async function recordAttendance(status, color) {
  const record = {
    status,
    color,
    date: new Date().toISOString(),
    location: await tryGetLocation()
  };
  
  state.data.attendance.push(record);
  updateDisplays('attendance');
  await saveAllData();
  showToast(`Marked as ${status}`, 'success');
}

async function addWeekoff(weekoff) {
  if (!weekoff.type) {
    throw new Error('Weekoff type is required');
  }
  
  state.data.weekoffs.push(weekoff);
  updateDisplays('weekoffs');
  await saveAllData();
}

// Display functions with enhanced UI
function updateAllDisplays() {
  updateDisplays('reviews');
  updateDisplays('attendance');
  updateDisplays('weekoffs');
  updateStatsDisplay();
}

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

function displayReviews() {
  const reviews = state.data.reviews;
  elements.displays.reviews.innerHTML = reviews.length ? 
    reviews.slice().reverse().map((review, index) => `
      <div class="review-item ${review.tipped ? 'tipped' : ''}">
        <div class="review-header">
          <h3>${escapeHtml(review.passengerName)}</h3>
          ${review.rating ? `<div class="stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>` : ''}
        </div>
        <div class="review-meta">
          <span class="review-date">${formatDate(review.date)}</span>
          ${review.tipped ? '<span class="tip-badge">Tipped</span>' : ''}
        </div>
        ${review.pnr ? `<p><strong>PNR:</strong> <span class="monospace">${escapeHtml(review.pnr)}</span></p>` : ''}
        ${review.phone ? `<p><strong>Phone:</strong> ${escapeHtml(review.phone)}</p>` : ''}
        <p><strong>Service:</strong> ${escapeHtml(review.service)}</p>
        <div class="feedback-content">${escapeHtml(review.feedback) || '<em>No feedback provided</em>'}</div>
        ${index === reviews.length - 1 ? '<div class="latest-indicator">NEWEST</div>' : ''}
      </div>
    `).join('') : '<div class="empty-state">No feedback yet. Be the first to review!</div>';
}

function displayAttendance() {
  const records = state.data.attendance;
  elements.displays.attendance.innerHTML = records.length ?
    `<div class="attendance-summary">
      <p>Present: ${records.filter(r => r.status === 'present').length} days</p>
      <p>Absent: ${records.filter(r => r.status === 'absent').length} days</p>
    </div>` +
    records.slice().reverse().map(record => `
      <div class="record-item" style="border-left: 4px solid ${record.color}">
        <div class="record-status" style="color: ${record.color}">
          ${record.status === 'present' ? '✓ Present' : '✗ Absent'}
        </div>
        <div class="record-meta">
          <span class="record-date">${formatDate(record.date)}</span>
          ${record.location ? `<span class="record-location">📍 ${record.location}</span>` : ''}
        </div>
      </div>
    `).join('') : '<div class="empty-state">No attendance records yet</div>';
}

function displayWeekoffs() {
  const weekoffs = state.data.weekoffs;
  elements.displays.weekoffs.innerHTML = weekoffs.length ?
    weekoffs.slice().reverse().map(weekoff => `
      <div class="record-item">
        <h3>${weekoff.type.toUpperCase()}</h3>
        <div class="record-meta">
          <span class="record-date">${formatDate(weekoff.date)}</span>
          ${weekoff.notes ? `<p class="weekoff-notes">${escapeHtml(weekoff.notes)}</p>` : ''}
        </div>
      </div>
    `).join('') : '<div class="empty-state">No weekoff records yet</div>';
}

function updateStatsDisplay() {
  const stats = {
    totalReviews: state.data.reviews.length,
    totalTipped: state.data.reviews.filter(r => r.tipped).length,
    presentDays: state.data.attendance.filter(a => a.status === 'present').length,
    absentDays: state.data.attendance.filter(a => a.status === 'absent').length,
    weekoffs: state.data.weekoffs.length
  };
  
  elements.displays.stats.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>${stats.totalReviews}</h3>
        <p>Total Reviews</p>
      </div>
      <div class="stat-card">
        <h3>${stats.totalTipped}</h3>
        <p>Tipped Services</p>
      </div>
      <div class="stat-card">
        <h3>${stats.presentDays}</h3>
        <p>Days Present</p>
      </div>
      <div class="stat-card">
        <h3>${stats.absentDays}</h3>
        <p>Days Absent</p>
      </div>
      <div class="stat-card">
        <h3>${stats.weekoffs}</h3>
        <p>Weekoffs Taken</p>
      </div>
    </div>
  `;
}

function updateLastSavedDisplay() {
  const lastSavedEl = document.getElementById('lastSaved');
  if (lastSavedEl) {
    lastSavedEl.textContent = state.ui.lastSaved ? 
      `Last saved: ${formatDateTime(state.ui.lastSaved)}` : 
      'Not saved yet';
  }
}

// UI Helper functions
function navigateToSection(sectionId) {
  // Update navigation
  elements.nav.links.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
  });
  
  // Update content
  elements.sections.content.forEach(section => {
    section.style.display = section.id === sectionId ? 'block' : 'none';
  });
  
  // Mobile: close menu if open
  document.querySelector('nav ul').classList.remove('active');
  
  // Update state
  state.ui.currentSection = sectionId;
  
  // Lazy load content if needed
  if (sectionId === 'reviews') displayReviews();
  else if (sectionId === 'attendance') displayAttendance();
  else if (sectionId === 'weekoff') displayWeekoffs();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  elements.buttons.themeToggle.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  state.ui.theme = theme;
}

function toggleTheme() {
  const newTheme = state.ui.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

function showLoading(show) {
  elements.sections.loading.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

function showError(message) {
  const errorEl = document.getElementById('errorDisplay');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => errorEl.style.display = 'none', 5000);
  }
}

// Utility functions
function formatDate(isoString) {
  if (!isoString) return 'Unknown date';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(date) {
  if (!date) return 'Unknown';
  if (typeof date === 'string') date = new Date(date);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateReviewForm() {
  const { passengerName, service, feedback } = elements.inputs;
  
  if (!service.value) {
    showToast('Please select a service type', 'warning');
    service.focus();
    return false;
  }
  
  if (feedback.value.trim().length < 5) {
    showToast('Please provide more detailed feedback', 'warning');
    feedback.focus();
    return false;
  }
  
  return true;
}

async function tryGetLocation() {
  if (!navigator.geolocation) return null;
  
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 60000
      });
    });
    
    // Use a simple geocoding service (in a real app, you'd use a proper API)
    return `Lat: ${position.coords.latitude.toFixed(2)}, Long: ${position.coords.longitude.toFixed(2)}`;
  } catch (error) {
    console.error('Geolocation error:', error);
    return null;
  }
}

function initiateTipPayment() {
  const options = {
    key: CONFIG.RAZORPAY.KEY,
    amount: CONFIG.RAZORPAY.TIP_AMOUNT,
    currency: CONFIG.RAZORPAY.CURRENCY,
    name: 'Service Appreciation',
    description: 'Voluntary Tip',
    handler: async function(response) {
      if (state.data.reviews.length > 0) {
        state.data.reviews[state.data.reviews.length - 1].tipped = true;
        await saveAllData();
        displayReviews();
        elements.buttons.tip.textContent = 'Tipped 😊';
        elements.buttons.tip.classList.add('tipped');
        elements.buttons.tip.disabled = true;
        showToast('Thank you for your tip!', 'success');
      }
    },
    theme: { color: '#0066cc' },
    modal: {
      ondismiss: function() {
        showToast('Tip payment cancelled', 'info');
      }
    }
  };
  
  try {
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error('Razorpay error:', error);
    showToast('Payment system unavailable', 'error');
  }
}

function handleBeforeUnload(e) {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
}

// Initialize Razorpay if not already loaded
if (typeof Razorpay === 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onerror = () => {
    console.error('Failed to load Razorpay');
    elements.buttons.tip.disabled = true;
    elements.buttons.tip.title = 'Payment system unavailable';
  };
  document.body.appendChild(script);
      }
