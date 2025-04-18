// your code goes here
// Configuration
const JSONBIN_BIN_ID = '68026be88561e97a50027f65';
const JSONBIN_API_KEY = '$2a$10$g9ECYeyBcUfoe1YWMp3w9eOZleHxwNDe4LX0Pv9yopoigUaOEJ6gq/e5OQya4EEWznFeiEWglTpkqDMSP9sajDui8jHCkWjpLaq';
const RAZORPAY_KEY = 'rzp_live_Apno0aW38JljQW';

// DOM Elements
const navLinks = document.querySelectorAll('nav ul li a');
const contentSections = document.querySelectorAll('.content-section');
const reviewForm = document.getElementById('reviewForm');
const reviewsList = document.getElementById('reviewsList');
const tipButton = document.getElementById('tipButton');
const presentBtn = document.getElementById('presentBtn');
const absentBtn = document.getElementById('absentBtn');
const attendanceRecords = document.getElementById('attendanceRecords');
const weekoffForm = document.getElementById('weekoffForm');
const weekoffRecords = document.getElementById('weekoffRecords');
const contactForm = document.getElementById('contactForm');

// Global data
let reviewsData = [];
let attendanceData = [];
let weekoffData = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load all data from JSONBin
    loadAllData();
    
    // Set up navigation
    setupNavigation();
    
    // Set up form handlers
    setupForms();
});

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active link
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
            
            // Show corresponding section
            const targetId = link.getAttribute('href').substring(1);
            contentSections.forEach(section => {
                section.style.display = section.id === targetId ? 'block' : 'none';
            });
            
            // Special handling for certain sections
            if (targetId === 'reviews') {
                displayReviews();
            } else if (targetId === 'attendance') {
                displayAttendance();
            } else if (targetId === 'weekoff') {
                displayWeekoffs();
            }
        });
    });
    
    // Show home section by default
    document.querySelector('nav ul li a').click();
}

function setupForms() {
    // Review form
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const review = {
            passengerName: document.getElementById('passengerName').value,
            airline: document.getElementById('airline').value,
            age: document.getElementById('age').value,
            pnr: document.getElementById('pnr').value,
            phone: document.getElementById('phone').value,
            service: document.getElementById('service').value,
            feedback: document.getElementById('feedback').value,
            date: new Date().toISOString(),
            tipped: false
        };
        
        try {
            reviewsData.push(review);
            await saveReviews();
            
            // Reset form
            reviewForm.reset();
            
            // Show success message
            alert('Review submitted successfully!');
            
            // Update display
            displayReviews();
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review. Please try again.');
        }
    });
    
    // Tip button
    tipButton.addEventListener('click', () => {
        const options = {
            key: RAZORPAY_KEY,
            amount: 1500, // ₹15 in paise
            currency: 'INR',
            name: 'Daksh Hande Services',
            description: 'Service Tip',
            handler: async function(response) {
                // Mark the latest review as tipped
                if (reviewsData.length > 0) {
                    reviewsData[reviewsData.length - 1].tipped = true;
                    await saveReviews();
                    displayReviews();
                    
                    // Update tip button
                    tipButton.textContent = 'Tipped 😊';
                    tipButton.classList.add('tipped');
                    tipButton.disabled = true;
                }
            },
            theme: {
                color: '#0066cc'
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
    });
    
    // Attendance buttons
    presentBtn.addEventListener('click', async () => {
        await recordAttendance('present', 'green');
    });
    
    absentBtn.addEventListener('click', async () => {
        await recordAttendance('absent', 'red');
    });
    
    // Week off form
    weekoffForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const weekoff = {
            type: document.getElementById('weekoffType').value,
            date: new Date().toISOString()
        };
        
        try {
            weekoffData.push(weekoff);
            await saveWeekoffs();
            
            // Reset form
            weekoffForm.reset();
            
            // Show success message
            alert('Week off recorded successfully!');
            
            // Update display
            displayWeekoffs();
        } catch (error) {
            console.error('Error recording week off:', error);
            alert('Failed to record week off. Please try again.');
        }
    });
    
    // Contact form
    contactForm.addEventListener('submit', (e) => {
        // Formspree will handle the submission
        // We just show a confirmation
        setTimeout(() => {
            alert('Your message has been sent. Thank you!');
            contactForm.reset();
        }, 100);
    });
}

async function recordAttendance(status, color) {
    const record = {
        status,
        date: new Date().toISOString(),
        color
    };
    
    try {
        attendanceData.push(record);
        await saveAttendance();
        
        // Show success message
        alert(`Marked as ${status}`);
        
        // Update display
        displayAttendance();
    } catch (error) {
        console.error('Error recording attendance:', error);
        alert('Failed to record attendance. Please try again.');
    }
}

// Data loading and saving functions
async function loadAllData() {
    try {
        // Load reviews
        const reviewsResponse = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });
        
        const reviewsJson = await reviewsResponse.json();
        if (reviewsJson.record && reviewsJson.record.reviews) {
            reviewsData = reviewsJson.record.reviews;
            displayReviews();
        }
        
        // Load attendance
        if (reviewsJson.record && reviewsJson.record.attendance) {
            attendanceData = reviewsJson.record.attendance;
            displayAttendance();
        }
        
        // Load weekoffs
        if (reviewsJson.record && reviewsJson.record.weekoffs) {
            weekoffData = reviewsJson.record.weekoffs;
            displayWeekoffs();
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function saveReviews() {
    await saveData({ reviews: reviewsData, attendance: attendanceData, weekoffs: weekoffData });
}

async function saveAttendance() {
    await saveData({ reviews: reviewsData, attendance: attendanceData, weekoffs: weekoffData });
}

async function saveWeekoffs() {
    await saveData({ reviews: reviewsData, attendance: attendanceData, weekoffs: weekoffData });
}

async function saveData(data) {
    try {
        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Error saving data:', error);
        throw error;
    }
}

// Display functions
function displayReviews() {
    reviewsList.innerHTML = '';
    
    if (reviewsData.length === 0) {
        reviewsList.innerHTML = '<p>No reviews yet. Be the first to submit one!</p>';
        return;
    }
    
    reviewsData.forEach(review => {
        const reviewElement = document.createElement('div');
        reviewElement.className = 'review-item';
        
        const tippedText = review.tipped ? '<span style="color:green;"> (Tipped 😊)</span>' : '';
        
        reviewElement.innerHTML = `
            <h3>${review.passengerName}, ${review.age} years</h3>
            <div class="review-date">${formatDate(review.date)}</div>
            <p><strong>PNR:</strong> ${review.pnr}</p>
            <p><strong>Phone:</strong> ${review.phone}</p>
            <p><strong>Service:</strong> ${review.service}</p>
            <p><strong>Feedback:</strong> ${review.feedback || 'No feedback provided'}</p>
            ${tippedText}
        `;
        
        reviewsList.appendChild(reviewElement);
    });
}

function displayAttendance() {
    attendanceRecords.innerHTML = '';
    
    if (attendanceData.length === 0) {
        attendanceRecords.innerHTML = '<p>No attendance records yet.</p>';
        return;
    }
    
    attendanceData.forEach(record => {
        const recordElement = document.createElement('div');
        recordElement.className = 'record-item';
        
        const statusSymbol = record.status === 'present' ? '✓' : '✗';
        
        recordElement.innerHTML = `
            <h3 style="color:${record.color}">${statusSymbol} ${record.status.toUpperCase()}</h3>
            <div class="record-date">${formatDate(record.date)}</div>
        `;
        
        attendanceRecords.appendChild(recordElement);
    });
}

function displayWeekoffs() {
    weekoffRecords.innerHTML = '';
    
    if (weekoffData.length === 0) {
        weekoffRecords.innerHTML = '<p>No week off records yet.</p>';
        return;
    }
    
    weekoffData.forEach(record => {
        const recordElement = document.createElement('div');
        recordElement.className = 'record-item';
        
        recordElement.innerHTML = `
            <h3>${record.type.toUpperCase()} WEEK OFF</h3>
            <div class="record-date">${formatDate(record.date)}</div>
        `;
        
        weekoffRecords.appendChild(recordElement);
    });
}

// Helper function
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    }
