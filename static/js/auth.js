document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('authForm');
    if (!form) return;
    const radios = document.getElementsByName('auth_mode');
    const submitBtn = document.getElementById('submitBtn');

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'login') {
                form.action = '/login';
                submitBtn.textContent = 'Sign In';
            } else {
                form.action = '/register';
                submitBtn.textContent = 'Register';
            }
        });
    });
});