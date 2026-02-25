// ============================================
// FILE: auth-protection.js
// Add this script to your index.html before closing </body> tag
// ============================================

// Check if user is authenticated
async function checkAuth() {
  const token = sessionStorage.getItem('authToken');
  
  if (!token) {
    // No token found, redirect to login
    window.location.href = '/login.html';
    return false;
  }

  try {
    // Verify token with backend
    const response = await fetch('/.netlify/functions/verify-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!data.valid) {
      // Invalid token, clear storage and redirect
      sessionStorage.clear();
      window.location.href = '/login.html';
      return false;
    }

    // Token is valid, update UI with user info
    updateUserUI();
    return true;

  } catch (error) {
    console.error('Auth check failed:', error);
    sessionStorage.clear();
    window.location.href = '/login.html';
    return false;
  }
}

// Update UI with logged-in user information
function updateUserUI() {
  const username = sessionStorage.getItem('username');
  
  if (username) {
    // Update the user profile button with username
    const userBtn = document.querySelector('button[aria-label="User profile"]');
    if (userBtn) {
      userBtn.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
          <span class="hidden md:inline text-sm">${username}</span>
        </div>
      `;
    }
  }
}

// Logout function
function logout() {
  sessionStorage.clear();
  window.location.href = '/login.html';
}

// Add logout button to user menu
function addLogoutButton() {
  const userBtn = document.querySelector('button[aria-label="User profile"]');
  if (userBtn) {
    userBtn.setAttribute('onclick', 'toggleUserMenu()');
  }
}

// Toggle user dropdown menu
function toggleUserMenu() {
  const existingMenu = document.getElementById('userDropdown');
  
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const username = sessionStorage.getItem('username');
  const email = sessionStorage.getItem('email');

  const menu = document.createElement('div');
  menu.id = 'userDropdown';
  menu.className = 'absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 z-50';
  menu.style.top = '100%';
  menu.style.right = '0';
  
  menu.innerHTML = `
    <div class="px-4 py-3 border-b border-slate-700">
      <p class="text-sm font-semibold text-white">${username || 'User'}</p>
      <p class="text-xs text-slate-400 truncate">${email || ''}</p>
    </div>
    <a href="#" class="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
      Profile Settings
    </a>
    <a href="#" class="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors" onclick="showCollection()">
      My Collection
    </a>
    <a href="#" class="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
      Purchase History
    </a>
    <div class="border-t border-slate-700 mt-2 pt-2">
      <button onclick="logout()" class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors">
        Sign Out
      </button>
    </div>
  `;

  // Find user button and make its parent relative
  const userBtn = document.querySelector('button[aria-label="User profile"]');
  if (userBtn) {
    userBtn.parentElement.style.position = 'relative';
    userBtn.parentElement.appendChild(menu);
  }

  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target) && e.target !== userBtn) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// Run auth check when page loads
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  addLogoutButton();
});


// ============================================
// UPDATED INDEX.HTML ADDITIONS
// Add these changes to your index.html
// ============================================

/*
1. ADD TO <head> section:
   <script src="auth-protection.js" defer></script>

2. UPDATE the user profile button in header:
   Replace the existing user button with:
   
   <button aria-label="User profile" class="p-2 hover:bg-slate-800 rounded-lg transition-colors">
     <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
     </svg>
   </button>

3. ADD before closing </body> tag:
   <script src="auth-protection.js"></script>
*/