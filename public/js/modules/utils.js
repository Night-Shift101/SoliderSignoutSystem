import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';

class Utils {
    static calculateDuration(startTime, endTime = null) {
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        const diffMs = end - start;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMins / 60);
        const minutes = diffMins % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    static formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    static formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }

    static setButtonLoading(button, loading) {
        const btnText = button.querySelector('.btn-text');
        const loader = button.querySelector('.btn-loader');
        
        button.disabled = loading;
        if (btnText) btnText.style.display = loading ? 'none' : 'inline';
        if (loader) loader.style.display = loading ? 'inline-block' : 'none';
    }

    static renderSoldierChipsForTable(soldiers, soldierCount) {
        
        if (typeof soldiers === 'string') {
            if (!soldiers) return '<span class="no-soldiers">No soldiers</span>';
            const soldierNames = soldiers.split(',').map(name => name.trim()).filter(name => name.length > 0);
            soldiers = soldierNames.map(name => ({
                rank: name.split(' ')[0] || '',
                firstName: name.split(' ')[1] || '',
                lastName: name.split(' ').slice(2).join(' ') || '',
                dodId: ''
            }));
        }
        
        
        if (!soldiers || !Array.isArray(soldiers) || soldiers.length === 0) {
            return '<span class="no-soldiers">No soldiers</span>';
        }
        
        
        const getRankCategory = (rank) => {
            const rankUpper = (rank || '').toUpperCase();
            if (rankUpper.includes('LT') || rankUpper.includes('CPT') || rankUpper.includes('MAJ') || 
                rankUpper.includes('COL') || rankUpper.includes('GEN')) {
                return 'rank-officer';
            } else if (rankUpper.includes('SGT') || rankUpper.includes('CPL') || rankUpper.includes('SFC') || 
                       rankUpper.includes('MSG') || rankUpper.includes('SGM')) {
                return 'rank-nco';
            } else {
                return 'rank-enlisted';
            }
        };
        
        
        const maxVisible = 4;
        const chipElements = soldiers.slice(0, maxVisible).map((soldier, index) => {
            const rankCategory = getRankCategory(soldier.rank);
            const displayName = `${soldier.rank || ''} ${soldier.lastName || ''}`.trim();
            const fullName = `${soldier.rank || ''} ${soldier.firstName || ''} ${soldier.lastName || ''}`.trim();
            const tooltipInfo = soldier.dodId ? `${fullName} (DOD: ${soldier.dodId})` : fullName;
            
            return `
                <div class="table-soldier-chip ${rankCategory}">
                    ${displayName}
                    <div class="table-soldier-chip-tooltip">
                        ${tooltipInfo}
                    </div>
                </div>
            `;
        }).join('');
        
        let result = `<div class="table-soldier-chips">${chipElements}`;
        
        
        if (soldiers.length > maxVisible) {
            const remainingSoldiers = soldiers.slice(maxVisible);
            const remainingNames = remainingSoldiers.map(s => 
                `${s.rank || ''} ${s.firstName || ''} ${s.lastName || ''}`.trim()
            ).join(', ');
            
            result += `
                <div class="table-soldier-chip rank-enlisted">
                    +${soldiers.length - maxVisible} more
                    <div class="table-soldier-chip-tooltip">
                        ${remainingNames}
                    </div>
                </div>
            `;
        }
        
        result += '</div>';
        
        
        if (soldierCount && soldierCount > 1) {
            result += `
                <div class="soldier-count-indicator">
                    <span class="soldier-count-badge">${soldierCount} soldiers</span>
                </div>
            `;
        }
        
        return result;
    }

    /**
     * Enhanced fetch utility with standardized error handling
     * @param {string} url - The URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Enhanced fetch response
     */
    static async fetchWithAuth(url, options = {}) {
        const defaultOptions = {
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error; // Let calling code handle with error handler
        }
    }

    /**
     * Safe API call wrapper that returns StandardResponse format
     * @param {string} url - The URL to fetch
     * @param {Object} options - Fetch options  
     * @param {string} operation - Description of the operation
     * @returns {Promise<StandardResponse>} Standardized response
     */
    static async safeApiCall(url, options = {}, operation = 'API request') {
        const errorHandler = globalFrontendErrorHandler.createContextHandler('Utils');
        
        try {
            const response = await Utils.fetchWithAuth(url, options);
            
            if (!response.ok) {
                return await errorHandler.apiError(response, operation);
            }

            const data = await response.json();
            
            // If API already returns StandardResponse format, return as-is
            if (data && typeof data === 'object' && 'success' in data) {
                return data;
            }
            
            return errorHandler.success(data);
        } catch (error) {
            return errorHandler.networkError(error, url);
        }
    }

    static showLoading(show = true) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    static getDurationHours(startTime, endTime = null) {
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        const diffMs = end - start;
        return Math.floor(diffMs / (1000 * 60 * 60)); 
    }

    static renderSoldierChips(soldiers) {
        if (!soldiers || !Array.isArray(soldiers) || soldiers.length === 0) {
            return '<span class="no-soldiers">No soldiers selected</span>';
        }
        
        const getRankCategory = (rank) => {
            const rankUpper = (rank || '').toUpperCase();
            if (rankUpper.includes('LT') || rankUpper.includes('CPT') || rankUpper.includes('MAJ') || 
                rankUpper.includes('COL') || rankUpper.includes('GEN')) {
                return 'rank-officer';
            } else if (rankUpper.includes('SGT') || rankUpper.includes('CPL') || rankUpper.includes('SFC') || 
                       rankUpper.includes('MSG') || rankUpper.includes('SGM')) {
                return 'rank-nco';
            } else {
                return 'rank-enlisted';
            }
        };
        
        return soldiers.map(soldier => {
            const rankCategory = getRankCategory(soldier.rank);
            const displayName = `${soldier.rank || ''} ${soldier.lastName || ''}, ${soldier.firstName || ''}`.trim();
            const tooltipInfo = soldier.dodId ? `DOD ID: ${soldier.dodId}` : 'No DOD ID';
            
            return `
                <div class="soldier-chip ${rankCategory}">
                    <span class="soldier-name">${displayName}</span>
                    <div class="soldier-tooltip">${tooltipInfo}</div>
                </div>
            `;
        }).join('');
    }
}

export default Utils;
