// Configuration
const JSONBIN_BIN_ID = '68026be88561e97a50027f65';
const JSONBIN_API_KEY = '$2a$10$g9ECYeyBcUfoe1YWMp3w9eOZleHxwNDe4LX0Pv9yopoigUaOEJ6gq';
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
    loadAllData();
    setupNavigation();
    setupForms();
});

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
            
            const targetId = link.getAttribute('href').substring(1);
            contentSections.forEach(section => {
                section.style.display = section.id === targetId ? 'block' : 'none';
            });
            
            if (targetId === 'reviews') displayReviews();
            else if (targetId === 'attendance') displayAttendance();
            else if (targetId === 'weekoff') displayWeekoffs();
        });
    });
    document.querySelector('nav ul li a').click();
}

function setupForms() {
    // Review form
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const review = {
            passengerName: document.getElementById('passengerName').value || 'Anonymous',
            service: document.getElementById('service').value,
            feedback: document.getElementById('feedback').value,
            date: new Date().toISOString(),
            tipped: false,
            // Optional fields
            ...(document.getElementById('pnr').value && { pnr: document.getElementById('pnr').value }),
            ...(document.getElementById('phone').value && { phone: document.getElementById('phone').value })
        };
        
        try {
            reviewsData.push(review);
            await saveReviews();
            reviewForm.reset();
            alert('Feedback submitted successfully!');
            displayReviews();
        } catch (error) {
            console.error('Error:', error);
            alert('Submission failed. Please try again.');
        }
    });
    
    // Tip button
    tipButton.addEventListener('click', () => {
        const options = {
            key: RAZORPAY_KEY,
            amount: 1500,
            currency: 'INR',
            name: 'Service Appreciation',
            description: 'Voluntary Tip',
            handler: async function(response) {
                if (reviewsData.length > 0) {
                    reviewsData[reviewsData.length - 1].tipped = true;
                    await saveReviews();
                    displayReviews();
                    tipButton.textContent = 'Tipped 😊';
                    tipButton.classList.add('tipped');
                    tipButton.disabled = true;
                }
            },
            theme: { color: '#0066cc' }
        };
        new Razorpay(options).open();
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
            weekoffForm.reset();
            alert('Record saved!');
            displayWeekoffs();
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to save. Please try again.');
        }
    });
    
    // Contact form
    contactForm.addEventListener('submit', (e) => {
        setTimeout(() => {
            alert('Message sent! Thank you.');
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
        alert(`Marked as ${status}`);
        displayAttendance();
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to record. Please try again.');
    }
}

// Data functions
async function loadAllData() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_API_KEY }
        });
        const json = await response.json();
        
        if (json.record) {
            reviewsData = json.record.reviews || [];
            attendanceData = json.record.attendance || [];
            weekoffData = json.record.weekoffs || [];
            displayReviews();
            displayAttendance();
            displayWeekoffs();
        }
    } catch (error) {
        console.error('Loading error:', error);
    }
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
        console.error('Saving error:', error);
        throw error;
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

// Display functions
function displayReviews() {
    reviewsList.innerHTML = reviewsData.length ? 
        reviewsData.map(review => `
            <div class="review-item">
                <h3>${review.passengerName}</h3>
                <div class="review-date">${formatDate(review.date)}</div>
                ${review.pnr ? `<p><strong>PNR:</strong> ${review.pnr}</p>` : ''}
                ${review.phone ? `<p><strong>Phone:</strong> ${review.phone}</p>` : ''}
                <p><strong>Service:</strong> ${review.service}</p>
                <p><strong>Feedback:</strong> ${review.feedback || 'No feedback'}</p>
                ${review.tipped ? '<span style="color:green;">(Tipped 😊)</span>' : ''}
            </div>
        `).join('') : '<p>No feedback yet.</p>';
}

function displayAttendance() {
    attendanceRecords.innerHTML = attendanceData.length ?
        attendanceData.map(record => `
            <div class="record-item">
                <h3 style="color:${record.color}">
                    ${record.status === 'present' ? '✓' : '✗'} ${record.status.toUpperCase()}
                </h3>
                <div class="record-date">${formatDate(record.date)}</div>
            </div>
        `).join('') : '<p>No records yet.</p>';
}

function displayWeekoffs() {
    weekoffRecords.innerHTML = weekoffData.length ?
        weekoffData.map(record => `
            <div class="record-item">
                <h3>${record.type.toUpperCase()}</h3>
                <div class="record-date">${formatDate(record.date)}</div>
            </div>
        `).join('') : '<p>No records yet.</p>';
}

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
