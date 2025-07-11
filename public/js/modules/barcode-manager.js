class BarcodeManager {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
        this.addedSoldiers = [];
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.barcodeInput = document.getElementById('barcodeInput');
        this.parseBarcodeBtn = document.getElementById('parseBarcodeBtn');
        this.clearBarcodeBtn = document.getElementById('clearBarcodeBtn');
        this.soldiersChips = document.getElementById('soldiersChips');
        this.clearAllSoldiersBtn = document.getElementById('clearAllSoldiersBtn');
    }

    attachEventListeners() {
        this.parseBarcodeBtn.addEventListener('click', () => this.handleBarcodeParse());
        this.clearBarcodeBtn.addEventListener('click', () => this.clearBarcodeData());
        this.clearAllSoldiersBtn.addEventListener('click', () => this.clearAllSoldiers());
        this.barcodeInput.addEventListener('input', () => {
            
            setTimeout(() => this.handleBarcodeParse(), 500);
        });
        
        
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('soldier-chip-remove')) {
                const index = parseInt(e.target.dataset.index);
                if (!isNaN(index)) {
                    this.removeSoldier(index);
                }
            }
        });
    }

    handleBarcodeParse() {
        const barcodeData = this.barcodeInput.value.trim();
        
        if (!barcodeData) {
            this.notificationManager.showNotification('Please enter or paste barcode data first.', 'warning');
            return;
        }

        try {
            const parsedInfo = window.BarcodeParser.parseSoldierInfo(barcodeData);
            
            if (parsedInfo && window.BarcodeParser.validateSoldierInfo(parsedInfo)) {
                
                const isDuplicate = this.addedSoldiers.some(soldier => 
                    soldier.firstName === parsedInfo.firstName && 
                    soldier.lastName === parsedInfo.lastName &&
                    soldier.dodId === parsedInfo.dodId
                );
                
                if (isDuplicate) {
                    this.notificationManager.showNotification('This soldier has already been added.', 'warning');
                    return;
                }
                
                
                this.addedSoldiers.push(parsedInfo);
                this.renderSoldierChips();
                
                
                this.notificationManager.showNotification(
                    `Successfully added: ${parsedInfo.rank} ${parsedInfo.fullName}`, 
                    'success'
                );
                
                
                this.barcodeInput.value = '';
                
                console.log('Added soldier:', parsedInfo);
            } else {
                this.notificationManager.showNotification('Could not parse soldier information from barcode data. Please check the format.', 'error');
            }
        } catch (error) {
            console.error('Error parsing barcode:', error);
            this.notificationManager.showNotification('Error parsing barcode data. Please try again.', 'error');
        }
    }

    clearBarcodeData() {
        this.barcodeInput.value = '';
        this.notificationManager.showNotification('Barcode data cleared.', 'info');
    }

    renderSoldierChips() {
        if (this.addedSoldiers.length === 0) {
            this.soldiersChips.innerHTML = '<div class="empty-state-chips">No soldiers added yet. Scan CAC barcodes to add soldiers.</div>';
            this.clearAllSoldiersBtn.style.display = 'none';
            this.autoAdjustContainerHeight();
            return;
        }

        this.soldiersChips.innerHTML = this.addedSoldiers.map((soldier, index) => `
            <div class="soldier-chip${soldier.isManualEntry ? ' manual-entry' : ''}" data-index="${index}">
                <span class="soldier-chip-name">${soldier.rank} ${soldier.lastName}, ${soldier.firstName}${soldier.middleInitial ? ' ' + soldier.middleInitial + '.' : ''}</span>
                ${soldier.isManualEntry ? '<span class="manual-tag">Manual</span>' : ''}
                <button type="button" class="soldier-chip-remove" data-index="${index}" title="Remove soldier" tabindex="-1">×</button>
                <div class="soldier-chip-tooltip">DOD ID: ${soldier.dodId || 'N/A'}</div>
            </div>
        `).join('');
        
        this.clearAllSoldiersBtn.style.display = 'inline-block';
        this.autoAdjustContainerHeight();
    }

    autoAdjustContainerHeight() {
        
        setTimeout(() => {
            const container = this.soldiersChips;
            const contentHeight = container.scrollHeight;
            const minHeight = 60;
            const maxHeight = 300;
            
            
            const optimalHeight = Math.min(Math.max(contentHeight + 24, minHeight), maxHeight);
            
            
            if (contentHeight > container.clientHeight || contentHeight < container.clientHeight - 50) {
                container.style.height = `${optimalHeight}px`;
            }
            
            
            if (contentHeight > maxHeight) {
                container.style.overflowY = 'auto';
            } else {
                container.style.overflowY = 'visible';
            }
        }, 100);
    }

    removeSoldier(index) {
        if (index >= 0 && index < this.addedSoldiers.length) {
            const removedSoldier = this.addedSoldiers.splice(index, 1)[0];
            this.renderSoldierChips();
            this.notificationManager.showNotification(`Removed: ${removedSoldier.rank} ${removedSoldier.fullName}`, 'info');
        }
    }

    clearAllSoldiers() {
        this.addedSoldiers = [];
        this.renderSoldierChips();
        this.notificationManager.showNotification('All soldiers cleared.', 'info');
    }

    getSoldiers() {
        return this.addedSoldiers;
    }

    clearSoldiers() {
        this.addedSoldiers = [];
        this.renderSoldierChips();
    }
}

export default BarcodeManager;
