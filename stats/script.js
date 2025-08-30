class TelegramBotAPIStats {
    constructor() {
        this.apiUrl = '/stats';
        this.refreshInterval = 5000; // 5 seconds default
        this.intervalId = null;
        this.lastData = null;
        this.requestHistory = [];
        this.maxHistoryPoints = 50;
        this.chart = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeChart();
        this.startAutoRefresh();
        this.fetchStats(); // Initial fetch
    }

    initializeElements() {
        // Get all DOM elements
        this.elements = {
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            refreshBtn: document.getElementById('refreshBtn'),
            refreshInterval: document.getElementById('refreshInterval'),
            lastUpdate: document.getElementById('lastUpdate'),
            
            // System stats
            uptime: document.getElementById('uptime'),
            botCount: document.getElementById('botCount'),
            activeBotCount: document.getElementById('activeBotCount'),
            activeRequests: document.getElementById('activeRequests'),
            
            // Memory stats
            rss: document.getElementById('rss'),
            vm: document.getElementById('vm'),
            rssPeak: document.getElementById('rssPeak'),
            vmPeak: document.getElementById('vmPeak'),
            bufferMemory: document.getElementById('bufferMemory'),
            
            // CPU stats
            totalCpu: document.getElementById('totalCpu'),
            userCpu: document.getElementById('userCpu'),
            systemCpu: document.getElementById('systemCpu'),
            totalCpuBar: document.getElementById('totalCpuBar'),
            userCpuBar: document.getElementById('userCpuBar'),
            systemCpuBar: document.getElementById('systemCpuBar'),
            
            // Network stats
            activeWebhookConnections: document.getElementById('activeWebhookConnections'),
            activeNetworkQueries: document.getElementById('activeNetworkQueries'),
            requestCount: document.getElementById('requestCount'),
            requestBytes: document.getElementById('requestBytes'),
            responseCount: document.getElementById('responseCount'),
            responseCountOk: document.getElementById('responseCountOk'),
            responseCountError: document.getElementById('responseCountError'),
            responseBytes: document.getElementById('responseBytes'),
            updateCount: document.getElementById('updateCount'),
            
            // Chart
            requestChart: document.getElementById('requestChart')
        };
    }

    setupEventListeners() {
        this.elements.refreshBtn.addEventListener('click', () => {
            this.fetchStats();
        });

        this.elements.refreshInterval.addEventListener('change', (e) => {
            this.refreshInterval = parseInt(e.target.value);
            this.startAutoRefresh();
        });
    }

    initializeChart() {
        const canvas = this.elements.requestChart;
        this.chart = canvas.getContext('2d');
        
        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        this.chart.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    drawChart() {
        if (!this.chart || this.requestHistory.length === 0) return;

        const canvas = this.elements.requestChart;
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;
        
        this.chart.clearRect(0, 0, width, height);
        
        // Draw background
        this.chart.fillStyle = '#f8f9fa';
        this.chart.fillRect(0, 0, width, height);
        
        // Draw grid
        this.chart.strokeStyle = '#e9ecef';
        this.chart.lineWidth = 1;
        
        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
            const x = (width / 10) * i;
            this.chart.beginPath();
            this.chart.moveTo(x, 0);
            this.chart.lineTo(x, height);
            this.chart.stroke();
        }
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = (height / 5) * i;
            this.chart.beginPath();
            this.chart.moveTo(0, y);
            this.chart.lineTo(width, y);
            this.chart.stroke();
        }
        
        if (this.requestHistory.length < 2) return;
        
        // Find max value for scaling
        const maxValue = Math.max(...this.requestHistory.map(point => point.value), 1);
        
        // Draw request rate line
        this.chart.strokeStyle = '#3498db';
        this.chart.lineWidth = 3;
        this.chart.beginPath();
        
        this.requestHistory.forEach((point, index) => {
            const x = (width / (this.requestHistory.length - 1)) * index;
            const y = height - (point.value / maxValue) * height;
            
            if (index === 0) {
                this.chart.moveTo(x, y);
            } else {
                this.chart.lineTo(x, y);
            }
        });
        
        this.chart.stroke();
        
        // Draw points
        this.chart.fillStyle = '#2980b9';
        this.requestHistory.forEach((point, index) => {
            const x = (width / (this.requestHistory.length - 1)) * index;
            const y = height - (point.value / maxValue) * height;
            
            this.chart.beginPath();
            this.chart.arc(x, y, 4, 0, 2 * Math.PI);
            this.chart.fill();
        });
        
        // Draw labels
        this.chart.fillStyle = '#2c3e50';
        this.chart.font = '12px Arial';
        this.chart.textAlign = 'right';
        this.chart.fillText(`Max: ${maxValue.toFixed(3)}`, width - 10, 20);
        this.chart.fillText('0', width - 10, height - 10);
    }

    async fetchStats() {
        try {
            this.setStatus('loading', 'Fetching...');
            this.elements.refreshBtn.disabled = true;
            
            const response = await fetch(this.apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const data = this.parseStatsData(text);
            
            this.updateUI(data);
            this.setStatus('connected', 'Connected');
            this.elements.lastUpdate.textContent = new Date().toLocaleTimeString();
            
        } catch (error) {
            console.error('Error fetching stats:', error);
            this.setStatus('error', `Error: ${error.message}`);
            this.showError(`Failed to fetch stats: ${error.message}`);
        } finally {
            this.elements.refreshBtn.disabled = false;
        }
    }

    parseStatsData(text) {
        const lines = text.trim().split('\n');
        const data = { system: {}, bots: [] };
        let isSystemSection = true;
        let currentBot = null;
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) {
                if (currentBot) {
                    data.bots.push(currentBot);
                    currentBot = null;
                }
                isSystemSection = false;
                return;
            }
            
            const parts = line.split('\t');
            if (parts.length >= 2) {
                const key = parts[0];
                const values = parts.slice(1);
                
                if (isSystemSection) {
                    data.system[key] = values;
                } else {
                    // Bot section - each bot starts with 'id'
                    if (key === 'id') {
                        if (currentBot) {
                            data.bots.push(currentBot);
                        }
                        currentBot = { id: values[0] };
                    } else if (currentBot) {
                        currentBot[key] = values;
                    }
                }
            }
        });
        
        // Add the last bot if exists
        if (currentBot) {
            data.bots.push(currentBot);
        }
        
        return data;
    }

    updateUI(data) {
        const system = data.system;
        const bots = data.bots || [];
        
        // System stats
        if (system.uptime) {
            this.updateElement('uptime', this.formatUptime(parseFloat(system.uptime[0])));
        }
        if (system.bot_count) {
            this.updateElement('botCount', system.bot_count[0]);
        }
        if (system.active_bot_count) {
            this.updateElement('activeBotCount', system.active_bot_count[0]);
        }
        if (system.active_requests) {
            this.updateElement('activeRequests', system.active_requests[0]);
        }
        
        // Memory stats
        if (system.rss) {
            this.updateElement('rss', system.rss[0]);
        }
        if (system.vm) {
            this.updateElement('vm', system.vm[0]);
        }
        if (system.rss_peak) {
            this.updateElement('rssPeak', system.rss_peak[0]);
        }
        if (system.vm_peak) {
            this.updateElement('vmPeak', system.vm_peak[0]);
        }
        if (system.buffer_memory) {
            this.updateElement('bufferMemory', system.buffer_memory[0]);
        }
        
        // CPU stats (using 5sec values - index 1)
        if (system.total_cpu) {
            const totalCpuValue = parseFloat(system.total_cpu[1]);
            this.updateElement('totalCpu', totalCpuValue.toFixed(2) + '%');
            this.updateProgressBar('totalCpuBar', totalCpuValue);
        }
        if (system.user_cpu) {
            const userCpuValue = parseFloat(system.user_cpu[1]);
            this.updateElement('userCpu', userCpuValue.toFixed(2) + '%');
            this.updateProgressBar('userCpuBar', userCpuValue);
        }
        if (system.system_cpu) {
            const systemCpuValue = parseFloat(system.system_cpu[1]);
            this.updateElement('systemCpu', systemCpuValue.toFixed(2) + '%');
            this.updateProgressBar('systemCpuBar', systemCpuValue);
        }
        
        // Network stats (using 5sec values - index 1)
        if (system.active_webhook_connections) {
            this.updateElement('activeWebhookConnections', system.active_webhook_connections[0]);
        }
        if (system.active_network_queries) {
            this.updateElement('activeNetworkQueries', system.active_network_queries[0]);
        }
        if (system.request_count) {
            const requestCountValue = parseFloat(system.request_count[1]);
            this.updateElement('requestCount', requestCountValue.toFixed(6));
            
            // Add to chart history
            this.requestHistory.push({
                timestamp: Date.now(),
                value: requestCountValue
            });
            
            if (this.requestHistory.length > this.maxHistoryPoints) {
                this.requestHistory.shift();
            }
        }
        if (system.request_bytes) {
            this.updateElement('requestBytes', parseFloat(system.request_bytes[1]).toFixed(2) + 'B');
        }
        if (system.response_count) {
            this.updateElement('responseCount', parseFloat(system.response_count[1]).toFixed(6));
        }
        if (system.response_count_ok) {
            this.updateElement('responseCountOk', parseFloat(system.response_count_ok[1]).toFixed(6));
        }
        if (system.response_count_error) {
            this.updateElement('responseCountError', parseFloat(system.response_count_error[1]).toFixed(6));
        }
        if (system.response_bytes) {
            this.updateElement('responseBytes', parseFloat(system.response_bytes[1]).toFixed(2) + 'B');
        }
        if (system.update_count) {
            this.updateElement('updateCount', parseFloat(system.update_count[1]).toFixed(6));
        }
        
        // Update bots display
        this.updateBotsDisplay(bots);
        
        // Update chart
        this.drawChart();
    }

    updateBotsDisplay(bots) {
        // Get bots container
        let botsContainer = document.querySelector('.bots-container');
        if (!botsContainer) {
            // Create new container if not found
            botsContainer = document.createElement('div');
            botsContainer.className = 'bots-container';
            document.querySelector('.stats-grid').appendChild(botsContainer);
        }
        
        // Clear existing bot cards
        botsContainer.innerHTML = '';
        
        // Create card for each bot
        bots.forEach((bot, index) => {
            const botCard = this.createBotCard(bot, index);
            botsContainer.appendChild(botCard);
        });
    }

    createBotCard(bot, index) {
        const card = document.createElement('div');
        card.className = 'card bot-card';
        card.setAttribute('data-bot-id', bot.id);
        
        const username = bot.username ? bot.username[0] : 'Unknown';
        const botUptime = bot.uptime ? this.formatUptime(parseFloat(bot.uptime[0])) : '-';
        const headUpdateId = bot.head_update_id ? bot.head_update_id[0] : '-';
        const tailUpdateId = bot.tail_update_id ? bot.tail_update_id[0] : '-';
        const pendingUpdates = bot.pending_update_count ? bot.pending_update_count[0] : '0';
        const activeRequests = bot.active_request_count ? bot.active_request_count[0] : '0';
        const requestCountSec = bot['request_count/sec'] ? parseFloat(bot['request_count/sec'][1]).toFixed(6) : '0.000000';
        const updateCountSec = bot['update_count/sec'] ? parseFloat(bot['update_count/sec'][1]).toFixed(6) : '0.000000';
        
        // Determine bot status based on activity
        const isActive = parseFloat(requestCountSec) > 0 || parseFloat(updateCountSec) > 0;
        const statusClass = isActive ? 'active' : 'idle';
        const statusText = isActive ? 'Active' : 'Idle';
        
        card.innerHTML = `
            <div class="bot-header">
                <h2>🤖 Bot #${index + 1}</h2>
                <div class="bot-status ${statusClass}">
                    <span class="status-dot"></span>
                    <span>${statusText}</span>
                </div>
            </div>
            <div class="bot-info">
                <div class="stat-item">
                    <span class="label">Bot ID:</span>
                    <span class="value">${bot.id}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Username:</span>
                    <span class="value">@${username}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Uptime:</span>
                    <span class="value">${botUptime}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Active Requests:</span>
                    <span class="value">${activeRequests}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Head Update ID:</span>
                    <span class="value">${headUpdateId}</span>
                </div>
                ${tailUpdateId !== '-' ? `
                <div class="stat-item">
                    <span class="label">Tail Update ID:</span>
                    <span class="value">${tailUpdateId}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Pending Updates:</span>
                    <span class="value ${parseInt(pendingUpdates) > 0 ? 'warning' : ''}">${pendingUpdates}</span>
                </div>
                ` : ''}
                <div class="stat-item">
                    <span class="label">Request/sec (5s):</span>
                    <span class="value">${requestCountSec}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Update/sec (5s):</span>
                    <span class="value">${updateCountSec}</span>
                </div>
            </div>
        `;
        
        return card;
    }

    updateElement(elementName, value) {
        const element = this.elements[elementName];
        if (element) {
            const oldValue = element.textContent;
            element.textContent = value;
            
            // Add highlight animation if value changed
            if (oldValue !== value && oldValue !== '-') {
                element.classList.add('updated');
                setTimeout(() => {
                    element.classList.remove('updated');
                }, 600);
            }
        }
    }

    updateProgressBar(barName, percentage) {
        const bar = this.elements[barName];
        if (bar) {
            bar.style.width = Math.min(percentage, 100) + '%';
        }
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    setStatus(status, text) {
        this.elements.statusDot.className = `status-dot ${status}`;
        this.elements.statusText.textContent = text;
    }

    showError(message) {
        // Remove existing error messages
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(error => error.remove());
        
        // Create new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Insert after refresh controls
        const refreshControls = document.querySelector('.refresh-controls');
        refreshControls.parentNode.insertBefore(errorDiv, refreshControls.nextSibling);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    startAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        this.intervalId = setInterval(() => {
            this.fetchStats();
        }, this.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TelegramBotAPIStats();
});

// Handle window resize for chart
window.addEventListener('resize', () => {
    // Debounce resize
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        const statsInstance = window.telegramStatsInstance;
        if (statsInstance) {
            statsInstance.initializeChart();
            statsInstance.drawChart();
        }
    }, 250);
});
