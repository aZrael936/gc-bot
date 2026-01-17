/**
 * Daily Digest Dashboard
 * Frontend JavaScript for the Sales Call QC Dashboard
 */

// Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

// Chart instances
let categoryChart = null;
let sentimentChart = null;

// State
let currentData = null;

/**
 * Initialize the dashboard
 */
document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today
  const dateInput = document.getElementById('dateInput');
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;

  // Load initial report
  loadReport();

  // Setup event listeners
  dateInput.addEventListener('change', loadReport);
});

/**
 * Load the daily report from API
 */
async function loadReport() {
  const dateInput = document.getElementById('dateInput');
  const date = dateInput.value;

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/reports/daily?date=${date}&includeDetails=true`);
    const result = await response.json();

    if (result.success) {
      currentData = result.data;
      renderReport(result.data);
      showToast('Report loaded successfully', 'success');
    } else {
      throw new Error(result.error || 'Failed to load report');
    }
  } catch (error) {
    console.error('Error loading report:', error);
    showToast(`Error: ${error.message}`, 'error');
    renderEmptyState();
  } finally {
    showLoading(false);
  }
}

/**
 * Render the report data
 * @param {Object} data - Report data
 */
function renderReport(data) {
  // Update header
  document.getElementById('reportDate').textContent = formatDate(data.date);

  // Update stats cards
  document.getElementById('totalCalls').textContent = data.totalCalls || 0;
  document.getElementById('avgScore').textContent = formatScore(data.avgScore);
  document.getElementById('excellentCalls').textContent = data.excellentCalls || 0;
  document.getElementById('lowScoreCalls').textContent = data.lowScoreCalls || 0;

  // Update score range
  updateScoreRange(data);

  // Update charts
  updateCategoryChart(data.categoryAverages);
  updateSentimentChart(data);

  // Update tables
  updateIssuesTable(data.topIssues, data.totalIssues);
  updateAgentTable(data.agentPerformance);

  // Update needs improvement section
  updateNeedsImprovement(data.needsImprovement);
}

/**
 * Update the score range visualization
 * @param {Object} data - Report data
 */
function updateScoreRange(data) {
  const total = data.totalCalls || 1;
  const lowCount = data.lowScoreCalls || 0;
  const excellentCount = data.excellentCalls || 0;
  const goodCount = (data.goodCalls || 0) + (total - lowCount - excellentCount - (data.goodCalls || 0));

  const lowPercent = (lowCount / total) * 100;
  const goodPercent = (goodCount / total) * 100;
  const excellentPercent = (excellentCount / total) * 100;

  // Update segments
  document.getElementById('lowSegment').style.width = `${lowPercent}%`;
  document.getElementById('goodSegment').style.width = `${goodPercent}%`;
  document.getElementById('excellentSegment').style.width = `${excellentPercent}%`;

  // Update legend counts
  document.getElementById('lowCount').textContent = lowCount;
  document.getElementById('goodCount').textContent = goodCount;
  document.getElementById('excellentCount').textContent = excellentCount;

  // Update score stats
  document.getElementById('minScore').textContent = data.minScore || '-';
  document.getElementById('medianScore').textContent = data.medianScore || '-';
  document.getElementById('maxScore').textContent = data.maxScore || '-';
}

/**
 * Update the category performance chart
 * @param {Object} categoryAverages - Category average scores
 */
function updateCategoryChart(categoryAverages) {
  const ctx = document.getElementById('categoryChart').getContext('2d');

  // Normalize category names
  const categories = {
    'Greeting': categoryAverages?.greeting || 0,
    'Need Discovery': categoryAverages?.need_discovery || categoryAverages?.needDiscovery || 0,
    'Product Presentation': categoryAverages?.product_presentation || categoryAverages?.productPresentation || 0,
    'Objection Handling': categoryAverages?.objection_handling || categoryAverages?.objectionHandling || 0,
    'Closing': categoryAverages?.closing || 0,
  };

  const labels = Object.keys(categories);
  const values = Object.values(categories);

  // Generate colors based on scores
  const colors = values.map(score => {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#f59e0b';
    if (score >= 50) return '#f97316';
    return '#ef4444';
  });

  if (categoryChart) {
    categoryChart.destroy();
  }

  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Score',
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        barThickness: 40,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => `Score: ${context.raw.toFixed(1)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: '#f1f5f9',
          },
          ticks: {
            font: { size: 11 },
            color: '#94a3b8',
          }
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: { size: 11 },
            color: '#475569',
          }
        }
      }
    }
  });
}

/**
 * Update the sentiment analysis chart
 * @param {Object} data - Report data
 */
function updateSentimentChart(data) {
  const ctx = document.getElementById('sentimentChart').getContext('2d');

  const sentiments = {
    'Positive': data.positiveSentiment || 0,
    'Neutral': data.neutralSentiment || 0,
    'Negative': data.negativeSentiment || 0,
  };

  if (sentimentChart) {
    sentimentChart.destroy();
  }

  sentimentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(sentiments),
      datasets: [{
        data: Object.values(sentiments),
        backgroundColor: ['#10b981', '#94a3b8', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { size: 12 },
            color: '#475569',
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${context.raw} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Update the issues table
 * @param {Array} issues - Top issues
 * @param {number} totalIssues - Total issue count
 */
function updateIssuesTable(issues, totalIssues) {
  const tbody = document.getElementById('issuesTable');
  const badge = document.getElementById('totalIssues');

  badge.textContent = `${totalIssues || 0} issues`;

  if (!issues || issues.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No issues found - Great job!</td></tr>';
    return;
  }

  tbody.innerHTML = issues.slice(0, 10).map(issue => `
    <tr>
      <td>${escapeHtml(issue.category)}</td>
      <td><span class="severity-badge ${issue.severity || 'medium'}">${issue.severity || 'medium'}</span></td>
      <td>${issue.count}</td>
    </tr>
  `).join('');
}

/**
 * Update the agent performance table
 * @param {Array} agents - Agent performance data
 */
function updateAgentTable(agents) {
  const tbody = document.getElementById('agentTable');

  if (!agents || agents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No agent data available</td></tr>';
    return;
  }

  tbody.innerHTML = agents.slice(0, 10).map(agent => {
    const scoreClass = getScoreClass(agent.avgScore);
    const trend = getTrendIndicator(agent);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; color: #475569;">
              ${getInitials(agent.agentId)}
            </div>
            <span>${escapeHtml(agent.agentId)}</span>
          </div>
        </td>
        <td>${agent.totalCalls}</td>
        <td>
          <span class="score-badge">
            <span class="score-dot ${scoreClass}"></span>
            ${formatScore(agent.avgScore)}
          </span>
        </td>
        <td>${trend}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Update the needs improvement section
 * @param {Array} agents - Agents needing improvement
 */
function updateNeedsImprovement(agents) {
  const section = document.getElementById('needsImprovementSection');
  const list = document.getElementById('improvementList');

  if (!agents || agents.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = agents.map(agent => `
    <div class="improvement-item">
      <div class="improvement-avatar">${getInitials(agent.agentId)}</div>
      <div class="improvement-info">
        <div class="improvement-name">${escapeHtml(agent.agentId)}</div>
        <div class="improvement-stats">
          ${agent.totalCalls} calls | Avg: ${formatScore(agent.avgScore)}
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Send daily digest to Telegram
 */
async function sendDigest() {
  const dateInput = document.getElementById('dateInput');
  const date = dateInput.value;

  try {
    showToast('Sending digest to Telegram...', 'info');

    const response = await fetch(`${API_BASE_URL}/reports/daily/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date }),
    });

    const result = await response.json();

    if (result.success) {
      showToast('Digest sent successfully!', 'success');
    } else {
      throw new Error(result.error || 'Failed to send digest');
    }
  } catch (error) {
    console.error('Error sending digest:', error);
    showToast(`Error: ${error.message}`, 'error');
  }
}

/**
 * Render empty state
 */
function renderEmptyState() {
  document.getElementById('reportDate').textContent = 'No data available';
  document.getElementById('totalCalls').textContent = '0';
  document.getElementById('avgScore').textContent = '-';
  document.getElementById('excellentCalls').textContent = '0';
  document.getElementById('lowScoreCalls').textContent = '0';

  // Reset score range
  document.getElementById('lowSegment').style.width = '0%';
  document.getElementById('goodSegment').style.width = '0%';
  document.getElementById('excellentSegment').style.width = '0%';

  // Clear tables
  document.getElementById('issuesTable').innerHTML =
    '<tr><td colspan="3" class="empty-state">No data available</td></tr>';
  document.getElementById('agentTable').innerHTML =
    '<tr><td colspan="4" class="empty-state">No data available</td></tr>';

  // Hide improvement section
  document.getElementById('needsImprovementSection').style.display = 'none';
}

// ===================================
// Utility Functions
// ===================================

/**
 * Format date for display
 * @param {string} dateStr - Date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format score for display
 * @param {number} score - Score value
 * @returns {string} Formatted score
 */
function formatScore(score) {
  if (score === null || score === undefined) return '-';
  return Math.round(score * 10) / 10;
}

/**
 * Get score class based on value
 * @param {number} score - Score value
 * @returns {string} CSS class
 */
function getScoreClass(score) {
  if (score >= 85) return 'excellent';
  if (score >= 50) return 'good';
  return 'low';
}

/**
 * Get trend indicator HTML
 * @param {Object} agent - Agent data
 * @returns {string} HTML string
 */
function getTrendIndicator(agent) {
  // Since we don't have historical data, show based on score
  if (agent.avgScore >= 70) {
    return '<span class="trend up">&#8593;</span>';
  } else if (agent.avgScore < 50) {
    return '<span class="trend down">&#8595;</span>';
  }
  return '<span class="trend stable">&#8594;</span>';
}

/**
 * Get initials from agent ID
 * @param {string} agentId - Agent ID
 * @returns {string} Initials
 */
function getInitials(agentId) {
  if (!agentId) return '?';
  const parts = agentId.replace(/_/g, ' ').split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return agentId.substring(0, 2).toUpperCase();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Show/hide loading overlay
 * @param {boolean} show - Show or hide
 */
function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (show) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Toast type (success, error, info)
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
