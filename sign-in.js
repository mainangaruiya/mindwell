document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');

    const genderGroup = document.getElementById('gender-group');
    const genderSelect = document.getElementById('gender');
    const formHeading = document.querySelector('.signin-form h2');
    const formSubheading = document.querySelector('.signin-form p');

    if (role === 'school') {
        if (genderGroup) genderGroup.style.display = 'none';
        if (genderSelect) genderSelect.removeAttribute('required');
        if (formHeading) formHeading.textContent = 'School Portal';
        if (formSubheading) formSubheading.textContent = 'Please enter your administrative credentials.';
    }

    document.getElementById('signin-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const gender = genderSelect ? genderSelect.value : '';

        localStorage.setItem('savedUsername', username);
        if (role === 'school') {
            localStorage.setItem('savedRole', 'school');
            window.location.href = 'counselor_Admin.html';
        } else {
            localStorage.setItem('savedRole', 'student');
            localStorage.setItem('savedGender', gender);
            window.location.href = 'home.html';
        }
    });
});