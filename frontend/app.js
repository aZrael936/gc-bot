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
let recentCalls = [];
let callsPage = 1;
const CALLS_PER_PAGE = 10;

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

  // Load recent calls
  loadRecentCalls();

  // Setup event listeners
  dateInput.addEventListener('change', loadReport);

  // Close modal on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCallModal();
  });
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

// ===================================
// Recent Calls Functions
// ===================================

/**
 * Load recent calls from API
 */
async function loadRecentCalls() {
  try {
    const response = await fetch(`${API_BASE_URL}/analyses?limit=${CALLS_PER_PAGE}&page=${callsPage}`);
    const result = await response.json();

    if (result.success && result.data) {
      recentCalls = result.data.analyses || [];
      renderRecentCalls();
    } else {
      // Try alternate endpoint
      const altResponse = await fetch(`${API_BASE_URL}/analyses/alerts?limit=${CALLS_PER_PAGE}`);
      const altResult = await altResponse.json();
      if (altResult.success && altResult.data) {
        recentCalls = altResult.data || [];
        renderRecentCalls();
      }
    }
  } catch (error) {
    console.error('Error loading recent calls:', error);
    renderRecentCallsEmpty();
  }
}

/**
 * Load more calls (pagination)
 */
async function loadMoreCalls() {
  callsPage++;
  try {
    const response = await fetch(`${API_BASE_URL}/analyses?limit=${CALLS_PER_PAGE}&page=${callsPage}`);
    const result = await response.json();

    if (result.success && result.data && result.data.analyses) {
      recentCalls = [...recentCalls, ...result.data.analyses];
      renderRecentCalls();
      showToast(`Loaded ${result.data.analyses.length} more calls`, 'success');
    } else {
      showToast('No more calls to load', 'info');
    }
  } catch (error) {
    console.error('Error loading more calls:', error);
    showToast('Failed to load more calls', 'error');
  }
}

/**
 * Render recent calls table
 */
function renderRecentCalls() {
  const tbody = document.getElementById('recentCallsTable');

  if (!recentCalls || recentCalls.length === 0) {
    renderRecentCallsEmpty();
    return;
  }

  tbody.innerHTML = recentCalls.map(call => {
    const scoreClass = getScoreClass(call.overall_score);
    const statusClass = getStatusClass(call.status || 'analyzed');
    const sentimentIcon = getSentimentIcon(call.sentiment);

    return `
      <tr>
        <td>
          <span class="call-id" title="${call.call_id}">${truncateId(call.call_id)}</span>
        </td>
        <td>${escapeHtml(call.agent_id || 'Unknown')}</td>
        <td>${formatDuration(call.duration_seconds)}</td>
        <td>
          <span class="score-badge">
            <span class="score-dot ${scoreClass}"></span>
            ${call.overall_score || '-'}
          </span>
        </td>
        <td>
          <span class="sentiment-badge ${call.sentiment || 'neutral'}">${sentimentIcon} ${call.sentiment || 'N/A'}</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${call.status || 'analyzed'}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-icon" onclick="viewCallDetails('${call.call_id}')" title="View Details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render empty state for recent calls
 */
function renderRecentCallsEmpty() {
  const tbody = document.getElementById('recentCallsTable');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No recent calls found. Process some calls to see them here.</td></tr>';
}

/**
 * Get status class
 */
function getStatusClass(status) {
  switch (status) {
    case 'analyzed': return 'success';
    case 'transcribed': return 'info';
    case 'downloaded': return 'info';
    case 'received': return 'pending';
    case 'failed':
    case 'transcription_failed':
    case 'analysis_failed': return 'error';
    default: return 'info';
  }
}

/**
 * Get sentiment icon
 */
function getSentimentIcon(sentiment) {
  switch (sentiment?.toLowerCase()) {
    case 'positive': return '😊';
    case 'negative': return '😞';
    default: return '😐';
  }
}

/**
 * Truncate call ID for display
 */
function truncateId(id) {
  if (!id) return '-';
  if (id.length <= 12) return id;
  return id.substring(0, 8) + '...';
}

/**
 * Format duration in mm:ss
 */
function formatDuration(seconds) {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===================================
// Call Detail Modal Functions
// ===================================

/**
 * View call details
 */
async function viewCallDetails(callId) {
  const modal = document.getElementById('callDetailModal');
  const content = document.getElementById('callDetailContent');

  // Show loading state
  content.innerHTML = '<div class="modal-loading"><div class="spinner"></div><p>Loading call details...</p></div>';
  modal.classList.add('active');

  try {
    const response = await fetch(`${API_BASE_URL}/calls/${callId}/report`);
    const result = await response.json();

    if (result.success && result.data) {
      renderCallDetails(result.data);
    } else {
      throw new Error(result.error || 'Failed to load call details');
    }
  } catch (error) {
    console.error('Error loading call details:', error);
    content.innerHTML = `<div class="modal-error"><p>Failed to load call details: ${error.message}</p></div>`;
  }
}

/**
 * Render call details in modal
 */
function renderCallDetails(data) {
  const content = document.getElementById('callDetailContent');
  const call = data.call || {};
  const analysis = data.analysis || {};
  const transcript = data.transcript || {};

  const categoryScores = typeof analysis.category_scores === 'string'
    ? JSON.parse(analysis.category_scores)
    : analysis.category_scores || {};

  const issues = typeof analysis.issues === 'string'
    ? JSON.parse(analysis.issues)
    : analysis.issues || [];

  const recommendations = typeof analysis.recommendations === 'string'
    ? JSON.parse(analysis.recommendations)
    : analysis.recommendations || [];

  content.innerHTML = `
    <div class="call-detail">
      <!-- Call Info -->
      <div class="detail-section">
        <h3>Call Information</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Call ID</span>
            <span class="detail-value">${call.id || analysis.call_id}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Agent</span>
            <span class="detail-value">${call.agent_id || 'Unknown'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Duration</span>
            <span class="detail-value">${formatDuration(call.duration_seconds)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Status</span>
            <span class="status-badge ${getStatusClass(call.status)}">${call.status || 'analyzed'}</span>
          </div>
        </div>
      </div>

      <!-- Analysis Summary -->
      <div class="detail-section">
        <h3>Analysis Summary</h3>
        <div class="analysis-summary">
          <div class="score-circle ${getScoreClass(analysis.overall_score)}">
            <span class="score-value">${analysis.overall_score || '-'}</span>
            <span class="score-label">Overall Score</span>
          </div>
          <div class="analysis-info">
            <p><strong>Sentiment:</strong> <span class="sentiment-badge ${analysis.sentiment}">${getSentimentIcon(analysis.sentiment)} ${analysis.sentiment || 'N/A'}</span></p>
            <p><strong>Summary:</strong> ${analysis.summary || 'No summary available'}</p>
          </div>
        </div>
      </div>

      <!-- Category Scores -->
      <div class="detail-section">
        <h3>Category Scores</h3>
        <div class="category-scores">
          ${Object.entries(categoryScores).map(([cat, data]) => {
            const score = typeof data === 'object' ? data.score : data;
            const feedback = typeof data === 'object' ? data.feedback : '';
            return `
              <div class="category-item">
                <div class="category-header">
                  <span class="category-name">${formatCategoryName(cat)}</span>
                  <span class="category-score ${getScoreClass(score)}">${score}/100</span>
                </div>
                <div class="category-bar">
                  <div class="category-fill ${getScoreClass(score)}" style="width: ${score}%"></div>
                </div>
                ${feedback ? `<p class="category-feedback">${feedback}</p>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Issues -->
      ${issues.length > 0 ? `
        <div class="detail-section">
          <h3>Issues Found</h3>
          <ul class="issues-list">
            ${issues.map(issue => `
              <li class="issue-item ${issue.severity || 'medium'}">
                <span class="issue-severity">${issue.severity || 'medium'}</span>
                <span class="issue-category">${issue.category || 'General'}</span>
                <p class="issue-description">${issue.description}</p>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Recommendations -->
      ${recommendations.length > 0 ? `
        <div class="detail-section">
          <h3>Recommendations</h3>
          <ul class="recommendations-list">
            ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Transcript -->
      ${transcript.content ? `
        <div class="detail-section">
          <h3>Transcript</h3>
          <div class="transcript-content">
            <pre>${escapeHtml(transcript.content)}</pre>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Format category name for display
 */
function formatCategoryName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Close call detail modal
 */
function closeCallModal() {
  const modal = document.getElementById('callDetailModal');
  modal.classList.remove('active');
}

// ===================================
// Export Functions
// ===================================

/**
 * Export data to CSV or Excel
 */
async function exportData(format) {
  const dateInput = document.getElementById('dateInput');
  const date = dateInput.value;

  try {
    showToast(`Generating ${format.toUpperCase()} export...`, 'info');

    const response = await fetch(`${API_BASE_URL}/export/${format}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: date,
        endDate: date,
        includeTranscripts: false,
        includeFullAnalysis: true,
      }),
    });

    const result = await response.json();

    if (result.success) {
      // Trigger download
      const downloadUrl = `${API_BASE_URL}/export/download/${result.data.filename}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = result.data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`${format.toUpperCase()} export downloaded!`, 'success');
    } else {
      throw new Error(result.error || 'Export failed');
    }
  } catch (error) {
    console.error('Export error:', error);
    showToast(`Export failed: ${error.message}`, 'error');
  }
}
