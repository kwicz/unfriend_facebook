// Variables to track state
let isRunning = false;
let stats = {
  deleted: 0,
  failed: 0,
  total: 0,
};

// DOM elements
document.addEventListener('DOMContentLoaded', function () {
  const startButton = document.getElementById('startButton');
  const viewActivityLogButton = document.getElementById('viewActivityLog');
  const statusElement = document.getElementById('status');
  const facebookUsernameField = document.getElementById('facebookUsername');

  // Load any previous settings from storage
  chrome.storage.local.get(['cleanerSettings'], function (result) {
    if (result.cleanerSettings) {
      if (result.cleanerSettings.facebookUsername) {
        facebookUsernameField.value = result.cleanerSettings.facebookUsername;
      }
    }
  });

  // Load any previous stats from storage
  chrome.storage.local.get(['cleanerStats'], function (result) {
    if (result.cleanerStats) {
      stats = result.cleanerStats;
      updateStatsDisplay();
    }
  });

  // Check if currently running
  chrome.storage.local.get(['isRunning'], function (result) {
    if (result.isRunning) {
      isRunning = true;
      startButton.textContent = 'Stop Cleaning';
      statusElement.textContent = 'Cleaning in progress...';
    }
  });

  // Start/Stop button handler
  startButton.addEventListener('click', function () {
    if (!isRunning) {
      const facebookUsername = facebookUsernameField.value.trim();

      if (!facebookUsername) {
        statusElement.textContent = 'Please enter your Facebook username';
        return;
      }

      // Get settings from the form (using default values since form elements are missing)
      const settings = {
        facebookUsername: facebookUsername,
        activityType: 'all',
        timeRange: 'all',
        batchSize: 10,
        pauseInterval: 1000,
      };

      // Save settings
      chrome.storage.local.set({
        cleanerSettings: settings,
        isRunning: true,
      });

      // Send message to start cleaning
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].url.includes('facebook.com')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'startCleaning',
            settings: settings,
          });

          startButton.textContent = 'Stop Cleaning';
          statusElement.textContent = 'Cleaning in progress...';
          isRunning = true;
        } else {
          statusElement.textContent = 'Please navigate to Facebook first';
        }
      });
    } else {
      // Send message to stop cleaning
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'stopCleaning' });
      });

      chrome.storage.local.set({ isRunning: false });
      startButton.textContent = 'Start Cleaning';
      statusElement.textContent = 'Cleaning stopped';
      isRunning = false;
    }
  });

  // View Activity Log button
  viewActivityLogButton.addEventListener('click', function () {
    const username = facebookUsernameField.value.trim();
    if (username) {
      chrome.tabs.create({
        url: `https://www.facebook.com/${username}/allactivity`,
      });
    } else {
      statusElement.textContent = 'Please enter your Facebook username first';
    }
  });

  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener(function (message) {
    if (message.action === 'updateStats') {
      stats = message.stats;
      updateStatsDisplay();

      // Save stats to storage
      chrome.storage.local.set({ cleanerStats: stats });
    } else if (message.action === 'updateStatus') {
      statusElement.textContent = message.status;
    }
  });
});

// Helper function to update the stats display
function updateStatsDisplay() {
  document.getElementById('deletedCount').textContent = stats.deleted;
  document.getElementById('failedCount').textContent = stats.failed;
}
