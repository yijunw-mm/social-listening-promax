// Authentication utility functions

export function getToken() {
    return localStorage.getItem('authToken');
}

export function setToken(token) {
    localStorage.setItem('authToken', token);
}

export function clearToken() {
    localStorage.removeItem('authToken');
}

export function isAuthenticated() {
    return !!getToken();
}

export function logout() {
    clearToken();
    window.location.href = 'login.html';
}

// Check authentication on protected pages
export function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}
