document.addEventListener("DOMContentLoaded", function() {
    // Section 1: Mood Button Interaction
    const moodButtons = document.querySelectorAll('.mood-btn');
    moodButtons.forEach(button => {
        button.addEventListener('click', () => {
            moodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // Section 2: Daily Streak Calculation Logic
    const streakText = document.getElementById('streak-text');
    const streakBadge = document.getElementById('streak-badge');
    
    // Store the date of the last visit
    const lastVisitDate = localStorage.getItem('lastVisitDate');
    const today = new Date().toISOString().slice(0, 10);
    
    let currentStreak = parseInt(localStorage.getItem('mindwellStreak')) || 1;

    if (lastVisitDate !== today) {
        if (lastVisitDate) {
            const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().slice(0, 10);
            if (lastVisitDate === yesterday) {
                currentStreak += 1; // Increase streak if visit was yesterday
            } else {
                currentStreak = 1; // Reset streak if a day was missed
            }
        }
        localStorage.setItem('mindwellStreak', currentStreak);
        localStorage.setItem('lastVisitDate', today);
    }

    if (currentStreak === 1) {
        streakText.textContent = '1 Day of MindWell';
    } else {
        streakText.textContent = `${currentStreak} Days of MindWell`;
    }

    // Section 3: Start Talking Button Interaction
    const startTalkingBtn = document.getElementById('start-talking-btn');
    startTalkingBtn.addEventListener('click', () => {
        alert('Opening chat with Luna...');
    });
});