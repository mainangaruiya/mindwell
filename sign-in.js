document.getElementById('signin-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const gender = document.getElementById('gender').value;

    localStorage.setItem('savedUsername', username);
    localStorage.setItem('savedGender', gender);

    window.location.href = 'home.html';
});