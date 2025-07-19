import Utils from './utils.js';
import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';

class AuthManager {
    constructor(app) {
        this.app = app;
        this.authCheckInProgress = false;
        this.currentUser = null;
        this.targetUser = null;
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('AuthManager');
    }

    async checkAuthentication() {
        try {
            if (window.location.pathname === '/login' || window.location.pathname === '/login.html') {
                console.log('Already on login page, skipping auth check');
                return this.errorHandler.success(null, 'Already on login page');
            }
            
            if (this.authCheckInProgress) {
                console.log('Auth check already in progress, skipping');
                return this.errorHandler.success(null, 'Auth check in progress');
            }
            this.authCheckInProgress = true;
            
            console.log('Checking authentication...');
            const result = await Utils.safeApiCall('/api/auth/status', {}, 'Authentication check');
            
            if (!result.success) {
                // Handle API error using standardized response
                console.log('Auth check failed:', result.error);
                
                if (this.app.durationInterval) {
                    clearInterval(this.app.durationInterval);
                }
                
                if (!window.location.href.includes('/login')) {
                    setTimeout(() => {
                        console.log('EXECUTING REDIRECT TO LOGIN - API ERROR');
                        window.location.href = '/login';
                    }, 100);
                }
                return result;
            }
            
            const authData = result.data;
            
            if (!authData.userAuthenticated || !authData.user) {
                console.log('Not authenticated, redirecting to login...');
                
                if (this.app.durationInterval) {
                    clearInterval(this.app.durationInterval);
                }
                
                if (!window.location.href.includes('/login')) {
                    setTimeout(() => {
                        console.log('EXECUTING REDIRECT TO LOGIN - NOT AUTHENTICATED');
                        window.location.href = '/login';
                    }, 100);
                }
                
                return this.errorHandler.authError('User not authenticated', true);
            }
            
            console.log('Authentication successful - NO REDIRECT NEEDED');
            console.log('User data:', authData.user);
            console.log('About to set currentUser and start normal app flow...');
            this.currentUser = authData.user;
            this.app.currentUser = authData.user;
            
            const currentUserName = this.app.domManager.get('currentUserName');
            if (currentUserName) {
                currentUserName.textContent = `${authData.user.rank} ${authData.user.full_name}`;
            }
            
            // Load user permissions
            if (this.app.permissionsManager) {
                await this.app.permissionsManager.loadUserPermissions();
                this.app.permissionsManager.applyPermissionBasedVisibility();
            }
            
            // Load user theme preference
            if (this.app.themeManager) {
                await this.app.themeManager.loadThemePreference();
            }
            
            // Show dashboard view now that permissions are loaded
            this.app.viewManager.showDashboardView();
            
            console.log('About to load current signouts...');
            try {
                await this.app.signOutManager.loadCurrentSignOuts();
            } catch (e) {
                return this.errorHandler.failure('Failed to load current sign-outs', {
                    category: ErrorCategory.SYSTEM,
                    severity: ErrorSeverity.MEDIUM,
                    originalError: e
                });
            }
            console.log('About to start duration updates...');
            this.app.signOutManager.startDurationUpdates();
            console.log('Authentication setup complete - no redirects should happen now');
            
            return this.errorHandler.success(authData.user, 'Authentication successful');
            
        } catch (error) {
            console.error('Authentication check failed with error:', error);
            
            if (window.location.pathname !== '/login' && window.location.pathname !== '/login.html') {
                if (!window.location.href.includes('/login')) {
                    setTimeout(() => {
                        console.log('EXECUTING REDIRECT TO LOGIN - DUE TO ERROR:', error.message);
                        window.location.href = '/login';
                    }, 100);
                }
            }
            
            return this.errorHandler.failure('Authentication check failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
        } finally {
            this.authCheckInProgress = false;
        }
    }

    async authenticateForSettings(pin) {
        try {
            const result = await Utils.safeApiCall('/api/auth/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: this.currentUser.id, 
                    pin: pin 
                })
            }, 'Settings authentication');
            
            if (!result.success) {
                this.app.modalManager.showPinError(result.error || 'Invalid PIN');
                return result;
            }
            
            const authResult = result.data;
            
            if (authResult.success) {
                this.app.modalManager.closePinModal();
                this.app.viewManager.showSettingsView();
                return this.errorHandler.success(authResult, 'Settings access granted', true);
            } else {
                this.app.modalManager.showPinError('Invalid PIN');
                return this.errorHandler.failure('Invalid PIN', {
                    category: ErrorCategory.AUTHENTICATION,
                    severity: ErrorSeverity.MEDIUM
                });
            }
        } catch (error) {
            console.error('Settings authentication error:', error);
            this.app.modalManager.showPinError('Authentication failed');
            return this.errorHandler.failure('Settings authentication failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.MEDIUM,
                originalError: error
            });
        }
    }

    async authenticateUserSwitch(pin) {
        if (!this.targetUser) {
            this.app.modalManager.showPinError('No user selected');
            return;
        }

        const targetUserInfo = {
            id: this.targetUser.id,
            rank: this.targetUser.rank,
            full_name: this.targetUser.full_name
        };

        try {
            const response = await Utils.fetchWithAuth('/api/auth/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: targetUserInfo.id, 
                    pin: pin 
                })
            });
            
            if (!response.ok) {
                throw new Error('Invalid PIN');
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.app.modalManager.closePinModal();
                
                // Update current user
                this.currentUser = targetUserInfo;
                this.app.currentUser = targetUserInfo;
                
                // Update UI
                const currentUserName = this.app.domManager.get('currentUserName');
                if (currentUserName) {
                    currentUserName.textContent = `${targetUserInfo.rank} ${targetUserInfo.full_name}`;
                }
                
                // Load user permissions
                if (this.app.permissionsManager) {
                    await this.app.permissionsManager.loadUserPermissions();
                    this.app.permissionsManager.applyPermissionBasedVisibility();
                }
                
                // Load user theme preference
                if (this.app.themeManager) {
                    await this.app.themeManager.loadThemePreference();
                }
                
                this.app.notificationManager.showNotification(`Switched to ${targetUserInfo.rank} ${targetUserInfo.full_name}`, 'success');
                
                // Validate current view permissions and refresh appropriate data
                if (this.app.viewManager) {
                    this.app.viewManager.validateCurrentViewPermissions();
                }
            } else {
                this.app.modalManager.showPinError('Invalid PIN');
            }
        } catch (error) {
            console.error('User switch error:', error);
            this.app.modalManager.showPinError('Invalid PIN');
        }
    }

    async processSignIn(pin) {
        if (!this.app.currentSignOutId) {
            this.app.modalManager.showPinError('No sign-out selected');
            return;
        }

        try {
            const response = await Utils.fetchWithAuth(`/api/signouts/${this.app.currentSignOutId}/signin`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                
                if (errorData.details && Array.isArray(errorData.details)) {
                    const errorMessages = errorData.details.map(err => err.msg).join(', ');
                    throw new Error(errorMessages);
                } else {
                    throw new Error(errorData.error || 'Sign-in failed');
                }
            }
            
            const result = await response.json();
            
            if (result.success !== false) {
                this.app.modalManager.closePinModal();
                this.app.currentSignOutId = null;
                
                this.app.signOutManager.loadCurrentSignOuts();
                this.app.notificationManager.showNotification(result.message || 'Soldiers signed in successfully', 'success');
            } else {
                this.app.modalManager.showPinError(result.message || 'Sign-in failed');
            }
        } catch (error) {
            console.error('Sign-in error:', error);
            this.app.modalManager.showPinError(error.message || 'Invalid PIN or sign-in failed');
        }
    }

    promptUserSwitch(user) {
        this.targetUser = user;
        
        const pinModal = this.app.domManager.get('pinModal');
        if (pinModal) {
            pinModal.style.display = 'flex';
            pinModal.style.visibility = 'visible';
            pinModal.style.opacity = '1';
            pinModal.classList.add('show');
        }
        
        pinModal.dataset.purpose = 'user-switch';
        
        const modalTitle = pinModal.querySelector('.modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = `Switch to ${user.rank} ${user.full_name}`;
        }
        
        const signInDetails = this.app.domManager.get('signInDetails');
        if (signInDetails) {
            signInDetails.style.display = 'none';
        }
        
        const pinInput = this.app.domManager.get('pinInput');
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
        
        const pinError = this.app.domManager.get('pinError');
        if (pinError) {
            pinError.style.display = 'none';
        }
    }

    async logout() {
        try {
            const response = await Utils.fetchWithAuth('/api/auth/logout', {
                method: 'POST'
            });
            
            if (response.ok) {
                localStorage.clear();
                this.app.notificationManager.showNotification('Logged out successfully', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1000);
            } else {
                this.app.notificationManager.showNotification('Failed to logout', 'error');
            }
        } catch (error) {
            console.error('Error logging out:', error);
            this.app.notificationManager.showNotification('Failed to logout', 'error');
        }
    }
}

export default AuthManager;
