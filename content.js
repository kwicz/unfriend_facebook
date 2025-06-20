// Facebook Activity Cleaner Content Script
// This script handles the activity deletion on Facebook pages similar to the standalone script

// Script version timestamp to help identify when script is freshly loaded
const SCRIPT_LOAD_TIME = new Date().toISOString();
console.log(
  `Facebook Activity Cleaner content script loaded at: ${SCRIPT_LOAD_TIME}`
);

// Global state variables
let isRunning = false;
let isPaused = false;
let settings = {
  activityType: 'all',
  timeRange: 'all',
  batchSize: 10,
  pauseInterval: 1000,
  timing: {
    menuWait: 700, // Wait after clicking menu button
    modalWait: 700, // Wait for modal to appear
    actionComplete: 1200, // Wait for action to complete
    nextItem: 1000, // Wait before proceeding to next item
    pageLoad: 2500, // Wait after page reload
  },
  maxConsecutiveFailures: 5,
  maxPageRefreshes: 5,
  maxActionRetries: 2,
};

// Statistics tracking
const stats = {
  deleted: 0,
  failed: 0,
  total: 0,
  progress: 0,
  pageRefreshes: 0,
};

// Track consecutive failures and page refreshes
let consecutiveFailures = 0;
let pageRefreshes = 0;
let lastSaveTime = Date.now();
const SAVE_INTERVAL = 5000; // Save every 5 seconds

// Helper function to ensure timing settings always exist
function ensureTimingSettings() {
  if (!settings.timing) {
    settings.timing = {
      menuWait: 700,
      modalWait: 700,
      actionComplete: 1200,
      nextItem: 1000,
      pageLoad: 2500,
    };
    console.log(
      'Warning: settings.timing was undefined. Default values applied.'
    );
  } else {
    // Make sure all required timing properties exist
    settings.timing.menuWait = settings.timing.menuWait || 700;
    settings.timing.modalWait = settings.timing.modalWait || 700;
    settings.timing.actionComplete = settings.timing.actionComplete || 1200;
    settings.timing.nextItem = settings.timing.nextItem || 1000;
    settings.timing.pageLoad = settings.timing.pageLoad || 2500;
  }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Add debug info for messages
  debug(`Received message: ${message.action}`, 'info');

  if (message.action === 'ping') {
    // Respond to ping to confirm content script is loaded
    debug('Received ping request, sending confirmation', 'info');
    sendResponse({ status: 'ok', loadTime: SCRIPT_LOAD_TIME });
    return true; // Indicate that we'll respond asynchronously
  } else if (message.action === 'debug') {
    // Special commands for debugging
    if (message.command === 'scan') {
      const results = scanForActivityItems();
      sendResponse({ success: true, message: 'Page scan complete', results });
      return true; // Indicate that we'll respond asynchronously
    } else if (message.command === 'test') {
      testMenuInteraction()
        .then((result) => sendResponse({ success: true, result }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Indicate async response
    } else if (message.command === 'status') {
      // Add a status command for diagnostics
      sendResponse({
        isRunning,
        isPaused,
        stats,
        scriptLoadTime: SCRIPT_LOAD_TIME,
      });
      return true;
    }
  } else if (message.action === 'startCleaning') {
    // Only start if not already running
    if (!isRunning) {
      debug('Starting Facebook activity cleaning', 'info');

      // Save the old settings.timing if it exists
      const oldTiming = settings.timing ? { ...settings.timing } : null;

      // Update settings with the new ones
      settings = message.settings || settings;

      // Ensure timing settings are always present
      ensureTimingSettings();

      isRunning = true;
      isPaused = false;

      // Initialize stats for this session
      if (settings.resetStats) {
        stats.deleted = 0;
        stats.failed = 0;
        stats.total = 0;
        stats.progress = 0;
        stats.pageRefreshes = 0;
      }

      // Reset consecutive failures and page refreshes
      consecutiveFailures = 0;
      pageRefreshes = 0;

      // Add status indicator to the page
      addStatusIndicator();

      // Send explicit confirmation that we've started
      chrome.runtime.sendMessage({
        action: 'cleaningStarted',
        timestamp: Date.now(),
      });

      // Start the cleaning process
      startActivityCleaning();

      // Send immediate response to the calling code
      sendResponse({ success: true, message: 'Cleaning started' });
    } else {
      debug('Cleaning already in progress', 'warning');
      sendResponse({ success: false, message: 'Cleaning already in progress' });
    }
    return true; // Indicate we're responding asynchronously
  } else if (message.action === 'stopCleaning') {
    const wasRunning = isRunning;
    isRunning = false;
    updateStatusMessage('Cleaning stopped');

    // Send explicit confirmation that we've stopped
    chrome.runtime.sendMessage({
      action: 'cleaningStopped',
      timestamp: Date.now(),
    });

    sendResponse({
      success: true,
      wasRunning: wasRunning,
      message: wasRunning ? 'Cleaning stopped' : 'Cleaning was not running',
    });
    return true; // Indicate we're responding asynchronously
  } else if (message.action === 'pauseCleaning') {
    isPaused = true;
    updateStatusMessage('Cleaning paused');
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'resumeCleaning') {
    isPaused = false;
    updateStatusMessage('Cleaning resumed');

    // Ensure timing settings exist before resuming
    ensureTimingSettings();

    // Resume the cleaning process
    setTimeout(() => {
      if (isRunning && !isPaused) {
        processNextBatch();
      }
    }, 500);

    sendResponse({ success: true });
    return true;
  } else if (message.action === 'getStatus') {
    // New method to get current status
    sendResponse({
      isRunning: isRunning,
      isPaused: isPaused,
      stats: stats,
      scriptLoadTime: SCRIPT_LOAD_TIME,
    });
    return true;
  }

  // For messages that don't need a response
  // This helps avoid "The message port closed before a response was received" errors
  sendResponse({ received: true });
  return true;
});

// Initialize debugging tools - but hidden by default
(function initDebugTools() {
  // Add a small timeout to ensure the page is fully loaded
  setTimeout(() => {
    console.log(
      'Initializing Facebook Activity Cleaner debugging tools (hidden mode)...'
    );
    addDebugPanel(true); // Pass true to initialize in hidden mode
    debug(
      'Debug panel initialized in hidden mode. Use Shift+Alt+D to show.',
      'info'
    );

    // Check if we're on a Facebook activity page
    if (window.location.href.includes('facebook.com')) {
      if (window.location.href.includes('allactivity')) {
        debug('Detected Facebook Activity Log page', 'success');
      } else {
        debug('On Facebook but not on Activity Log page', 'warning');
      }
    } else {
      debug('Not on a Facebook page', 'error');
    }
  }, 2000);
})();

// Add a floating status indicator to the page
function addStatusIndicator() {
  // Remove existing status indicator if present
  removeStatusIndicator();

  // Create main container
  const container = document.createElement('div');
  container.id = 'fb-activity-cleaner-container';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '9999';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.maxWidth = '400px';
  container.style.fontFamily = 'Arial, sans-serif';

  // Create status indicator
  const statusDiv = document.createElement('div');
  statusDiv.id = 'fb-activity-cleaner-status';
  statusDiv.style.padding = '10px 15px';
  statusDiv.style.backgroundColor = '#1877f2';
  statusDiv.style.color = 'white';
  statusDiv.style.borderRadius = '5px 5px 0 0';
  statusDiv.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  statusDiv.style.fontSize = '14px';
  statusDiv.style.fontWeight = 'bold';
  statusDiv.textContent = 'Initializing...';

  // Create log panel
  const logPanel = document.createElement('div');
  logPanel.id = 'fb-activity-cleaner-log';
  logPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  logPanel.style.color = '#eee';
  logPanel.style.padding = '10px';
  logPanel.style.borderRadius = '0 0 5px 5px';
  logPanel.style.maxHeight = '300px';
  logPanel.style.overflowY = 'auto';
  logPanel.style.fontSize = '12px';
  logPanel.style.fontFamily = 'monospace';
  logPanel.style.whiteSpace = 'pre-wrap';
  logPanel.style.wordBreak = 'break-word';
  logPanel.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';

  // Create minimize/maximize toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'fb-activity-cleaner-toggle';
  toggleButton.style.position = 'absolute';
  toggleButton.style.top = '10px';
  toggleButton.style.right = '10px';
  toggleButton.style.backgroundColor = 'transparent';
  toggleButton.style.border = 'none';
  toggleButton.style.color = 'white';
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.fontSize = '14px';
  toggleButton.textContent = '−';
  toggleButton.title = 'Minimize/Maximize log';

  toggleButton.addEventListener('click', function () {
    const logPanel = document.getElementById('fb-activity-cleaner-log');
    if (logPanel.style.display === 'none') {
      logPanel.style.display = 'block';
      toggleButton.textContent = '−';
    } else {
      logPanel.style.display = 'none';
      toggleButton.textContent = '+';
    }
  });

  statusDiv.appendChild(toggleButton);
  container.appendChild(statusDiv);
  container.appendChild(logPanel);
  document.body.appendChild(container);

  // Add initial log entry
  addLogMessage('Facebook Activity Cleaner initialized');
  addLogMessage('Waiting for activities to clean...');
}

// Remove the status indicator
function removeStatusIndicator() {
  const existingContainer = document.getElementById(
    'fb-activity-cleaner-container'
  );
  if (existingContainer) {
    existingContainer.remove();
  }
}

// Update the status message displayed on the page
function updateStatusMessage(message) {
  const statusDiv = document.getElementById('fb-activity-cleaner-status');
  if (statusDiv) {
    // Keep the toggle button when updating text
    const toggleButton = statusDiv.querySelector('#fb-activity-cleaner-toggle');
    statusDiv.textContent = message;
    if (toggleButton) {
      statusDiv.appendChild(toggleButton);
    }
  }

  // Also send message to popup
  try {
    chrome.runtime.sendMessage({
      action: 'updateStatus',
      status: message,
    });
  } catch (error) {
    // Ignore errors sending messages as the popup might be closed
    console.log('Could not send status update to popup (likely closed)');
  }
}

// Add a log message to the log panel
function addLogMessage(message, type = 'info') {
  const logPanel = document.getElementById('fb-activity-cleaner-log');
  if (!logPanel) return;

  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.style.marginBottom = '5px';
  logEntry.style.borderLeft = '3px solid';

  // Style based on message type
  switch (type) {
    case 'success':
      logEntry.style.borderColor = '#4CAF50';
      logEntry.style.color = '#4CAF50';
      break;
    case 'error':
      logEntry.style.borderColor = '#F44336';
      logEntry.style.color = '#F44336';
      break;
    case 'warning':
      logEntry.style.borderColor = '#FF9800';
      logEntry.style.color = '#FF9800';
      break;
    default:
      logEntry.style.borderColor = '#2196F3';
      logEntry.style.color = '#2196F3';
  }

  logEntry.innerHTML = `<span style="color: #999;">[${timestamp}]</span> <span style="padding-left: 5px;">${message}</span>`;

  logPanel.appendChild(logEntry);
  logPanel.scrollTop = logPanel.scrollHeight; // Scroll to bottom

  // Also log to console for debugging
  console.log(`[FB Cleaner] ${message}`);
}

// Console log wrapper that also adds to the UI log
function log(message, type = 'info') {
  addLogMessage(message, type);
  return message; // Return message for use in assignment expressions
}

// Start the main activity cleaning process
async function startActivityCleaning() {
  // Ensure timing settings are properly initialized
  ensureTimingSettings();

  updateStatusMessage('Starting activity cleaning...');

  // Check if we're on a Facebook activity page
  if (!window.location.href.includes('facebook.com')) {
    updateStatusMessage('Please navigate to Facebook first');
    isRunning = false;

    // Send confirmation that we've stopped
    chrome.runtime.sendMessage({
      action: 'cleaningStopped',
      reason: 'not_facebook',
      timestamp: Date.now(),
    });

    return;
  }

  // If not on activity page, navigate to activity page based on settings
  if (!window.location.href.includes('allactivity')) {
    let activityUrl = 'https://www.facebook.com/me/allactivity';

    // Add filters based on activity type
    if (settings.activityType !== 'all') {
      switch (settings.activityType) {
        case 'posts':
          activityUrl += '/content_you_created';
          break;
        case 'likes':
          activityUrl += '/interactions_content_you_liked_and_reacted_to';
          break;
        case 'comments':
          activityUrl += '/interactions_comments';
          break;
        case 'tags':
          activityUrl += '/tags';
          break;
      }
    }

    updateStatusMessage('Navigating to activity page...');
    window.location.href = activityUrl;
    return;
  }

  // Start processing activity items
  updateStatusMessage('Looking for activities to clean...');
  processNextBatch();
}

// Process the next batch of activity items (main processing function)
async function processNextBatch() {
  if (!isRunning || isPaused) {
    return;
  }

  // Ensure settings.timing exists with default values if needed
  ensureTimingSettings();

  updateStatusMessage(
    `Cleaning in progress (${stats.deleted} deleted, ${stats.failed} failed)`
  );

  try {
    // Find all "more options" menu buttons using the same selector as the standalone script
    const menuButtons = document.querySelectorAll(
      'div[aria-label="More options"]'
    );

    if (menuButtons.length === 0) {
      consecutiveFailures++;
      log(
        `No menu buttons found. Attempt ${consecutiveFailures}/${settings.maxConsecutiveFailures}`,
        'warning'
      );

      if (consecutiveFailures >= settings.maxConsecutiveFailures) {
        // Try refreshing the page if no menu buttons are found
        if (pageRefreshes < settings.maxPageRefreshes) {
          pageRefreshes++;
          consecutiveFailures = 0;

          // Update page refreshes in background
          chrome.runtime.sendMessage({
            action: 'updatePageRefreshes',
            count: pageRefreshes,
          });

          log(
            `Refreshing page to find more items. Refresh attempt ${pageRefreshes}/${settings.maxPageRefreshes}`,
            'info'
          );
          updateStatusMessage(
            `Refreshing page to find more items. Refresh attempt ${pageRefreshes}/${settings.maxPageRefreshes}`
          );

          // Perform a page refresh
          window.location.reload();
          return;
        } else {
          // We've reached maximum page refreshes, assume we're done
          isRunning = false;
          log('Maximum page refreshes reached. Cleaning completed.', 'info');
          updateStatusMessage(
            `Cleaning completed: ${stats.deleted} deleted, ${stats.failed} failed. Max refreshes reached.`
          );

          // Notify background script that we're stopping
          chrome.runtime.sendMessage({
            action: 'stopCleaning',
          });
          return;
        }
      }

      // Try scrolling to load more content
      log('Trying to scroll for more content...', 'info');
      await scrollForMoreItems();

      // Continue to next attempt
      setTimeout(() => {
        if (isRunning && !isPaused) {
          processNextBatch();
        }
      }, settings.timing.pageLoad);
      return;
    }

    // Reset consecutive failures counter if we found items
    consecutiveFailures = 0;

    // Find the first visible menu button
    let visibleButton = null;
    log(
      `Found ${menuButtons.length} activity items with "More options" buttons`,
      'info'
    );

    // First try to find a button that's already in view
    for (const button of menuButtons) {
      const rect = button.getBoundingClientRect();
      if (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      ) {
        visibleButton = button;
        log('Found a visible "More options" button in viewport', 'info');
        break;
      }
    }

    // If no visible button found, use the first one and scroll it into view
    if (!visibleButton && menuButtons.length > 0) {
      visibleButton = menuButtons[0];
      log('No button in view, scrolling first button into viewport', 'info');
      visibleButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
    }

    if (!visibleButton) {
      log('No visible menu buttons found, trying scrolling...', 'warning');
      await scrollForMoreItems();
      setTimeout(() => {
        if (isRunning && !isPaused) {
          processNextBatch();
        }
      }, settings.timing.nextItem);
      return;
    }

    const menuButton = visibleButton;

    // Before clicking the menu, try to extract activity information
    let activityItem = findActivityItemFromMenuButton(menuButton);
    let activityDate = extractDate(activityItem);
    let activityType = extractActivityType(activityItem);
    let activityContent = extractContent(activityItem);
    let activityLink = null;

    // Display details about the current activity being processed
    log('---------- PROCESSING ACTIVITY ----------', 'info');
    log(`Date: ${activityDate}`, 'info');
    log(`Type: ${activityType}`, 'info');
    if (activityContent && activityContent !== 'No content extracted') {
      log(`Content: ${activityContent}`, 'info');
    }

    // Try to get the activity link using the View button
    try {
      const viewLinkElement = activityItem.querySelector(
        'a[aria-label="View"]'
      );
      if (viewLinkElement) {
        activityLink = viewLinkElement.getAttribute('href');
        log(`Found link: ${activityLink}`, 'info');
      }
    } catch (linkError) {
      log('Could not extract activity link', 'warning');
    }

    // Ensure the button is visible in viewport before clicking
    menuButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);

    log('Clicking "More options" button...', 'info');
    // Click the menu button
    menuButton.click();
    await sleep(settings.timing.menuWait);

    // Look for the menu items - using the same selector as in standalone script
    const menuItems = document.querySelectorAll('div[role="menuitem"]');

    if (menuItems.length === 0) {
      log('No menu items found, closing menu...', 'error');
      document.body.click(); // Close the menu by clicking elsewhere
      await sleep(800);
      stats.failed++;
      updateStats();

      // Continue to next item
      setTimeout(() => {
        if (isRunning && !isPaused) {
          processNextBatch();
        }
      }, settings.timing.nextItem);
      return;
    }

    log(`Found ${menuItems.length} menu items`, 'info');

    // Check for specific action buttons we want to click using the same approach as standalone script
    let menuItemToClick = null;
    let menuText = null;
    const targetActions = [
      'Remove Tag',
      'Unlike',
      'Delete',
      'Move to trash',
      'Remove Reaction',
    ];

    // Loop through all menu items to find the target actions - same as in standalone script
    for (const menuItem of menuItems) {
      const itemText = menuItem.textContent.trim();

      // Display all available menu items for debugging
      log(`Available menu item: "${itemText}"`, 'info');

      if (targetActions.some((action) => itemText.includes(action))) {
        menuItemToClick = menuItem;
        menuText = itemText;
        log(`Found target action: "${menuText}"`, 'success');
        break;
      }
    }

    // If we didn't find any of our target actions
    if (!menuItemToClick) {
      log('No delete/unlike/remove action found in menu', 'error');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(800);
      stats.failed++;
      updateStats();

      // Continue to next item
      setTimeout(() => {
        if (isRunning && !isPaused) {
          processNextBatch();
        }
      }, settings.timing.nextItem);
      return;
    }

    // Store the current state to check for changes after action
    const elementCountBefore = document.querySelectorAll(
      'div[aria-label="More options"]'
    ).length;
    const urlBefore = window.location.href;

    // Click the menu action - Making sure this uses the correct element
    log(`Clicking "${menuText}" menu item...`, 'info');
    menuItemToClick.click();
    await sleep(settings.timing.modalWait);

    log('Looking for confirmation modal...', 'info');

    // Check specifically for the known modal types
    let confirmed = false;

    try {
      // Check for Delete? modal first
      const deleteModal = document.querySelector('div[aria-label="Delete?"]');
      const removeModal = document.querySelector('div[aria-label="Remove?"]');
      const removeTagsModal = document.querySelector(
        'div[aria-label="Remove tags?"]'
      );
      const moveToTrashModal = document.querySelector(
        'div[aria-label="Move to Trash?"]'
      );

      if (deleteModal) {
        log('Delete? modal found', 'info');
        const deleteButton = deleteModal.querySelector(
          'div[aria-label="Delete"]'
        );
        if (deleteButton) {
          log('Clicking Delete button...', 'info');
          deleteButton.click();
          confirmed = true;
        }
      } else if (removeModal) {
        log('Remove? modal found', 'info');
        const removeButton = removeModal.querySelector(
          'div[aria-label="Remove"]'
        );
        if (removeButton) {
          log('Clicking Remove button...', 'info');
          removeButton.click();
          confirmed = true;
        }
      } else if (removeTagsModal) {
        log('Remove tags? modal found', 'info');
        const removeTagsButton = removeTagsModal.querySelector(
          'div[aria-label="Remove"]'
        );
        if (removeTagsButton) {
          log('Clicking Remove button in Remove tags modal...', 'info');
          removeTagsButton.click();
          confirmed = true;
        }
      } else if (moveToTrashModal) {
        log('Move to Trash? modal found', 'info');
        const moveToTrashButton = moveToTrashModal.querySelector(
          'div[aria-label="Move to Trash"]'
        );
        if (moveToTrashButton) {
          log('Clicking Move to Trash button...', 'info');
          moveToTrashButton.click();
          confirmed = true;
        }
      } else {
        // No modal found - check if the page content changed indicating a successful deletion
        log('No modal found, checking if content was affected...', 'info');
        await sleep(1000);
        const elementCountAfter = document.querySelectorAll(
          'div[aria-label="More options"]'
        ).length;
        const urlAfter = window.location.href;

        // If we observe a change (fewer elements or URL change), consider it a success
        if (elementCountAfter < elementCountBefore || urlAfter !== urlBefore) {
          log('Content appears to have been deleted (UI changed)', 'success');
          confirmed = true;
        }
      }

      if (confirmed) {
        // Wait for modal to disappear or action to complete
        await sleep(settings.timing.actionComplete);
        stats.deleted++;
        updateStats();

        // Send the activity to the background script for storage
        chrome.runtime.sendMessage({
          action: 'logActivity',
          activity: {
            url: window.location.href,
            date: activityDate,
            activityType: activityType,
            activityContent: activityContent,
            activityLink: activityLink,
            action: menuText,
            actionType: menuText.toLowerCase().includes('delete')
              ? 'delete'
              : menuText.toLowerCase().includes('remove')
              ? 'remove'
              : 'other',
            deletedAt: new Date().toISOString(),
          },
        });

        log(
          `Successfully deleted item (${activityType}). Total: ${stats.deleted}`,
          'success'
        );
      } else {
        log(
          'Could not confirm deletion - no confirmation button found',
          'warning'
        );

        // Add retry logic for failed confirmations
        let retrySuccess = false;

        // Ensure settings.timing exists for retry logic
        if (!settings.timing) {
          settings.timing = {
            menuWait: 700,
            modalWait: 700,
            actionComplete: 1200,
            nextItem: 1000,
            pageLoad: 2500,
          };
          log(
            'Warning: settings.timing was undefined during retry. Default values applied.',
            'warning'
          );
        }

        for (
          let retryCount = 0;
          retryCount < settings.maxActionRetries && !retrySuccess;
          retryCount++
        ) {
          log(
            `Retry attempt ${retryCount + 1}/${
              settings.maxActionRetries
            } for confirmation...`,
            'warning'
          );

          // Try pressing Escape to close the dialog first
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape' })
          );
          await sleep(500);

          // Try clicking the menu button again
          try {
            log('Re-opening menu for retry...', 'info');
            menuButton.click();
            await sleep(settings.timing.menuWait);

            // Try clicking the menu item again
            if (menuItemToClick) {
              log(`Re-clicking "${menuText}" menu item (retry)`, 'info');
              menuItemToClick.click();
              await sleep(settings.timing.modalWait);

              // Check for confirmation dialog again
              const anyModal = document.querySelector(
                'div[aria-label="Delete?"], div[aria-label="Remove?"], div[aria-label="Remove tags?"], div[aria-label="Move to Trash?"]'
              );

              if (anyModal) {
                log('Found confirmation modal on retry', 'info');
                const actionButton = anyModal.querySelector(
                  'div[aria-label="Delete"], div[aria-label="Remove"], div[aria-label="Move to Trash"]'
                );

                if (actionButton) {
                  log('Clicking confirmation button on retry...', 'info');
                  actionButton.click();
                  log('Retry succeeded!', 'success');
                  retrySuccess = true;
                  confirmed = true;

                  stats.deleted++;
                  updateStats();

                  // Send the activity to the background script with retry info
                  chrome.runtime.sendMessage({
                    action: 'logActivity',
                    activity: {
                      url: window.location.href,
                      date: activityDate,
                      activityType: activityType,
                      activityContent: activityContent,
                      activityLink: activityLink,
                      action: menuText,
                      actionType: menuText.toLowerCase().includes('delete')
                        ? 'delete'
                        : menuText.toLowerCase().includes('remove')
                        ? 'remove'
                        : 'other',
                      deletedAt: new Date().toISOString(),
                      retry: retryCount + 1,
                    },
                  });

                  await sleep(settings.timing.actionComplete);
                }
              } else {
                log('No confirmation modal found on retry', 'warning');
              }
            }
          } catch (retryError) {
            log(
              `Retry attempt ${retryCount + 1} failed: ${retryError.message}`,
              'error'
            );
          }

          // If still not successful, try pressing Escape to close any dialogs
          if (!retrySuccess) {
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'Escape' })
            );
            await sleep(500);
          }
        }

        if (!retrySuccess) {
          // If all retries failed, increment the failure count
          log('All retry attempts failed', 'error');
          stats.failed++;
          updateStats();

          // Track error type for reporting
          chrome.runtime.sendMessage({
            action: 'saveErrorType',
            errorType: 'ConfirmationFailed',
          });
        }
      }
    } catch (modalError) {
      log(`Error handling modal: ${modalError.message}`, 'error');
      // Try Escape to close any open dialogs
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(800);
      stats.failed++;
      updateStats();

      // Track error type for reporting
      chrome.runtime.sendMessage({
        action: 'saveErrorType',
        errorType: modalError.name || 'ModalError',
      });
    }

    // Wait a moment before continuing to next item
    await sleep(settings.timing.nextItem);

    // Continue with the next item
    if (isRunning && !isPaused) {
      processNextBatch();
    }
  } catch (error) {
    log(`Error during deletion process: ${error.message}`, 'error');
    stats.failed++;
    updateStats();

    // Track error type for reporting
    chrome.runtime.sendMessage({
      action: 'saveErrorType',
      errorType: error.name || 'UnknownError',
    });

    // Try to recover by pressing Escape and continuing
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(800);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    } catch (escapeError) {
      // Ignore if Escape fails
    }

    // Continue with the next item
    await sleep(settings.timing.nextItem);
    if (isRunning && !isPaused) {
      processNextBatch();
    }
  }
}

// Add a debugging panel to help identify issues
function addDebugPanel(hidden = false) {
  // Only add if it doesn't exist yet
  if (document.getElementById('fb-cleaner-debug-panel')) return;

  const debugPanel = document.createElement('div');
  debugPanel.id = 'fb-cleaner-debug-panel';
  debugPanel.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px; 
    width: 500px;
    max-height: 600px;
    overflow-y: auto;
    background-color: rgba(0,0,0,0.85);
    color: lime;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    border-radius: 5px;
    z-index: 9999999;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    white-space: pre-wrap;
    word-break: break-word;
    display: ${hidden ? 'none' : 'flex'};
    flex-direction: column;
  `;

  // Add header and controls
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    border-bottom: 1px solid #444;
    padding-bottom: 5px;
  `;
  header.innerHTML = `<strong>Facebook Activity Cleaner Debug (v${SCRIPT_LOAD_TIME})</strong>`;

  // Add buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.gap = '5px';

  // Add clear button
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = `
    background: #333;
    color: white;
    border: none;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
  `;
  clearBtn.onclick = () => {
    const logContainer = document.getElementById('fb-cleaner-debug-content');
    if (logContainer) logContainer.innerHTML = '';
  };

  // Add refresh button
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = 'Force Reload';
  refreshBtn.style.cssText = `
    background: #005500;
    color: white;
    border: none;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
  `;
  refreshBtn.onclick = () => {
    debug('Force reloading the extension and page...', 'warning');
    // Try to send a message to the background script to reload the extension
    try {
      // Check if chrome runtime is still valid
      if (chrome.runtime && !chrome.runtime.id) {
        debug('Extension context is invalid. Reloading page...', 'error');
        window.location.reload(true);
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: 'forceReload',
          message: 'User requested force reload',
        },
        (response) => {
          // If there was an error or no response, just reload the page
          if (chrome.runtime.lastError || !response) {
            debug(
              'Error communicating with background script. Reloading page...',
              'warning'
            );
            window.location.reload(true);
          }
        }
      );

      // Add a timeout to reload the page anyway after a short delay
      setTimeout(() => {
        window.location.reload(true);
      }, 500);
    } catch (error) {
      debug(
        `Error during force reload: ${error.message}. Reloading page...`,
        'error'
      );
      // If any error occurs, just reload the page
      window.location.reload(true);
    }
  };

  // Add close/hide button
  const hideBtn = document.createElement('button');
  hideBtn.textContent = 'Hide';
  hideBtn.style.cssText = `
    background: #333;
    color: white;
    border: none;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
  `;
  hideBtn.onclick = () => {
    debugPanel.style.display = 'none';
    debug('Debug panel hidden. Press Shift+Alt+D to show again.', 'info');
  };

  buttonsContainer.appendChild(clearBtn);
  buttonsContainer.appendChild(refreshBtn);
  buttonsContainer.appendChild(hideBtn);
  header.appendChild(buttonsContainer);

  debugPanel.appendChild(header);

  // Add log content container
  const logContainer = document.createElement('div');
  logContainer.id = 'fb-cleaner-debug-content';
  logContainer.style.cssText = `
    overflow-y: auto;
    max-height: 550px;
    padding-right: 5px;
  `;
  debugPanel.appendChild(logContainer);

  // Add element inspection tool section
  const inspectSection = document.createElement('div');
  inspectSection.style.cssText = `
    border-top: 1px solid #444;
    margin-top: 10px;
    padding-top: 10px;
  `;

  // Add current script version info
  const versionInfo = document.createElement('div');
  versionInfo.style.cssText = `
    margin-bottom: 10px;
    color: #888;
    font-size: 11px;
  `;
  versionInfo.textContent = `Script loaded at: ${SCRIPT_LOAD_TIME}`;
  inspectSection.appendChild(versionInfo);

  const inspectBtn = document.createElement('button');
  inspectBtn.textContent = 'Inspect Next Activity Item';
  inspectBtn.style.cssText = `
    background: #333;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    margin-right: 10px;
  `;

  inspectBtn.onclick = () => {
    const menuButtons = document.querySelectorAll(
      'div[aria-label="More options"]'
    );
    if (menuButtons.length > 0) {
      const button = menuButtons[0];
      button.style.border = '3px solid red';

      // Find parent activity item
      const activityItem = findActivityItemFromMenuButton(button);
      if (activityItem) {
        activityItem.style.border = '2px solid lime';
        activityItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Log details about this item
        debug(`Inspecting activity item:
- Has menu button: ${button ? 'Yes' : 'No'}
- Activity date: ${extractDate(activityItem)}
- Activity type: ${extractActivityType(activityItem)}
- Activity content: ${extractContent(activityItem)}
- HTML structure:
${activityItem.outerHTML.substring(0, 500)}...`);
      } else {
        debug('Could not find parent activity item', 'error');
      }
    } else {
      debug('No "More options" buttons found on page', 'error');
    }
  };

  inspectSection.appendChild(inspectBtn);

  const testBtn = document.createElement('button');
  testBtn.textContent = 'Test Menu Click';
  testBtn.style.cssText = `
    background: #333;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
  `;

  testBtn.onclick = async () => {
    debug('Running test sequence on first menu button...');
    const menuButtons = document.querySelectorAll(
      'div[aria-label="More options"]'
    );

    if (menuButtons.length > 0) {
      const button = menuButtons[0];
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);

      // Click the menu button
      debug('Clicking menu button...');
      button.click();
      await sleep(800);

      // Check if menu opened using the same selector as standalone script
      const menuItems = document.querySelectorAll('div[role="menuitem"]');

      if (menuItems.length > 0) {
        debug(`Menu opened successfully. Found ${menuItems.length} items:`);

        // Define target actions we're looking for
        const targetActions = [
          'Remove Tag',
          'Unlike',
          'Delete',
          'Move to trash',
          'Remove Reaction',
        ];
        let targetItem = null;

        // First log all menu items and find the target item
        Array.from(menuItems).forEach((item, i) => {
          const itemText = item.textContent.trim();
          debug(`   ${i + 1}. "${itemText}"`);

          // Check if this item matches any of our target actions
          if (
            !targetItem &&
            targetActions.some((action) => itemText.includes(action))
          ) {
            targetItem = item;
            debug(
              `   Found target action: "${itemText}" at position ${i + 1}`,
              'success'
            );
          }
        });

        // Store the menu items in a global variable for later use
        window.fbCleanerMenuItems = Array.from(menuItems);

        // If we found a target item, click it
        if (targetItem) {
          debug(
            `Clicking target menu item: "${targetItem.textContent.trim()}"...`,
            'info'
          );
          try {
            targetItem.click();
            debug('Target menu item clicked successfully', 'success');
          } catch (clickError) {
            debug(
              `Error clicking target menu item: ${clickError.message}`,
              'error'
            );
          }
        } else {
          debug('No target action found in menu items', 'warning');
          debug('Menu will stay open for manual inspection', 'info');
        }
      } else {
        debug('Menu did not open or no menu items found', 'error');
        // Press escape to close menu
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }
    } else {
      debug('No "More options" buttons found on page', 'error');
    }
  };

  inspectSection.appendChild(testBtn);

  // Add a button to click the first menu item when menu is open
  const clickFirstItemBtn = document.createElement('button');
  clickFirstItemBtn.textContent = 'Click First Menu Item';
  clickFirstItemBtn.style.cssText = `
    background: #006400;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    margin-left: 10px;
  `;

  clickFirstItemBtn.onclick = async () => {
    debug('Attempting to click first menu item...', 'info');

    // Always get menu items directly from the DOM for the actual click
    const liveMenuItems = document.querySelectorAll('div[role="menuitem"]');
    debug(
      `Found ${liveMenuItems.length} menu items currently visible in DOM`,
      'info'
    );
    debug(`Menu items: ${liveMenuItems}`, 'info');

    // If we have stored menu items, log them for debugging purposes only
    if (window.fbCleanerMenuItems && window.fbCleanerMenuItems.length > 0) {
      debug(
        `Note: There are also ${window.fbCleanerMenuItems.length} stored menu items (for debugging only)`,
        'info'
      );
    }

    if (liveMenuItems.length > 0) {
      const firstItem = liveMenuItems[0];
      const itemText = firstItem.textContent.trim();

      debug(`Clicking menu item from DOM: "${itemText}"...`, 'info');
      debug(`Clicking menu item from DOM: "${firstItem}"...`, 'info');

      try {
        // Direct click on the live DOM element
        firstItem.click();
        debug(`Clicked on "${itemText}" successfully`, 'success');

        // Wait for possible confirmation dialog
        await sleep(800);

        // Check if menu closed - this is a good indicator that the click worked
        const menuStillOpen =
          document.querySelectorAll('div[role="menuitem"]').length > 0;
        if (menuStillOpen) {
          debug(
            'Menu is still open - click may not have worked properly',
            'warning'
          );
          debug('Try clicking on the item directly in the browser', 'warning');
        } else {
          debug('Menu closed after click - success!', 'success');
        }

        // Check for confirmation dialog using the same selectors as the standalone script
        const confirmationDialogs = document.querySelectorAll(
          'div[aria-label="Delete?"], div[aria-label="Remove?"], div[aria-label="Remove tags?"], div[aria-label="Move to Trash?"]'
        );

        if (confirmationDialogs.length > 0) {
          debug('Confirmation dialog detected', 'info');
          const dialogText =
            confirmationDialogs[0].getAttribute('aria-label') ||
            'Unknown dialog';
          debug(`Dialog type: ${dialogText}`, 'info');

          debug('Use "Click Confirmation" button to confirm action', 'warning');
        } else {
          debug('No confirmation dialog detected', 'info');
        }
      } catch (error) {
        debug(`Error clicking menu item: ${error.message}`, 'error');
      }
    } else {
      debug(
        'No menu items found in DOM. Open menu first using "Test Menu Click"',
        'error'
      );
      debug('Try the following steps:', 'info');
      debug('1. Click "Test Menu Click" to open the menu', 'info');
      debug(
        '2. Immediately after menu appears, click "Click First Menu Item"',
        'info'
      );
      debug(
        "(Facebook menus close quickly if you don't interact with them)",
        'warning'
      );
    }
  };

  inspectSection.appendChild(clickFirstItemBtn);

  // Add a button to click confirmation dialog
  const clickConfirmBtn = document.createElement('button');
  clickConfirmBtn.textContent = 'Click Confirmation';
  clickConfirmBtn.style.cssText = `
    background: #8B0000;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    margin-top: 5px;
    margin-right: 10px;
  `;

  clickConfirmBtn.onclick = async () => {
    debug('Looking for confirmation button to click...', 'info');

    // Try to find confirmation buttons in modals
    const confirmButtons = document.querySelectorAll(
      'div[aria-label="Delete"], div[aria-label="Remove"], div[aria-label="Move to Trash"]'
    );

    if (confirmButtons.length > 0) {
      const button = confirmButtons[0];
      const buttonText = button.getAttribute('aria-label') || 'Confirm';

      debug(`Clicking "${buttonText}" button...`, 'info');
      try {
        button.click();
        debug(`Clicked "${buttonText}" successfully`, 'success');

        // Wait for action to complete
        await sleep(1200);
        debug('Action should now be complete', 'success');
      } catch (error) {
        debug(`Error clicking confirmation: ${error.message}`, 'error');
      }
    } else {
      debug('No confirmation buttons found', 'error');
    }
  };

  inspectSection.appendChild(clickConfirmBtn);

  debugPanel.appendChild(inspectSection);

  // Add HTML page scan button
  const scanBtn = document.createElement('button');
  scanBtn.textContent = 'Scan Page Structure';
  scanBtn.style.cssText = `
    background: #333;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    margin-top: 10px;
    width: 100%;
  `;

  scanBtn.onclick = () => {
    debug('Scanning page structure...');
    // Check for core elements
    const moreOptionsButtons = document.querySelectorAll(
      'div[aria-label="More options"]'
    );
    debug(`Found ${moreOptionsButtons.length} "More options" buttons`);

    // Check for activity items
    const activityItems = document.querySelectorAll(
      'div[aria-label="Activity Log Item"]'
    );
    debug(`Found ${activityItems.length} activity log items with aria-label`);

    // Check for any potential menu items
    const menuItems = document.querySelectorAll('div[role="menuitem"]');
    debug(`Found ${menuItems.length} menu items currently visible`);

    // Check for alternative activity containers
    const articles = document.querySelectorAll('div[role="article"]');
    debug(`Found ${articles.length} article elements`);

    const listItems = document.querySelectorAll('div[role="listitem"]');
    debug(`Found ${listItems.length} list item elements`);

    // Check page URL
    debug(`Current URL: ${window.location.href}`);

    // Check if we're on a Facebook activity page
    if (!window.location.href.includes('facebook.com')) {
      debug('Not on a Facebook page!', 'error');
    } else if (!window.location.href.includes('allactivity')) {
      debug('Not on Facebook Activity Log page!', 'error');
    } else {
      debug('On correct Facebook Activity Log page', 'success');
    }
  };

  debugPanel.appendChild(scanBtn);

  document.body.appendChild(debugPanel);

  // Add keyboard shortcut to toggle debug panel
  document.addEventListener('keydown', function (e) {
    // Shift+Alt+D to toggle debug panel
    if (e.shiftKey && e.altKey && e.key === 'D') {
      const panel = document.getElementById('fb-cleaner-debug-panel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        if (panel.style.display === 'flex') {
          debug('Debug panel visible. Press Shift+Alt+D to hide.', 'info');
        }
      }
    }
  });
}

// Debug logging function
function debug(message, type = 'info') {
  // Log to console first (this will always work)
  console.log(`[FB Cleaner Debug] ${message}`);

  // Try to find the log container
  let logContainer = document.getElementById('fb-cleaner-debug-content');

  // If the container doesn't exist, try to create the debug panel first
  if (!logContainer) {
    // Check if the whole panel exists, if not create it
    if (!document.getElementById('fb-cleaner-debug-panel')) {
      console.log('Debug panel not found. Creating it now...');
      addDebugPanel(true); // Create in hidden mode by default
      // Try to get the container again after creating the panel
      logContainer = document.getElementById('fb-cleaner-debug-content');
    }
  }

  // If we still don't have a log container, we can't continue
  if (!logContainer) {
    console.error('Failed to find or create debug log container');
    return;
  }

  const entry = document.createElement('div');
  const timestamp = new Date().toLocaleTimeString();

  // Style based on type
  let color = '#2196F3'; // info - blue
  if (type === 'success') color = '#4CAF50'; // green
  if (type === 'error') color = '#F44336'; // red
  if (type === 'warning') color = '#FF9800'; // orange

  entry.style.cssText = `
    margin-bottom: 4px;
    border-left: 3px solid ${color};
    padding-left: 5px;
    color: ${color};
  `;

  entry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${message}`;
  logContainer.appendChild(entry);

  // Don't make the debug panel visible automatically
  // Just ensure it has the right z-index for when it is shown
  const debugPanel = document.getElementById('fb-cleaner-debug-panel');
  if (debugPanel) {
    debugPanel.style.zIndex = '9999999'; // Ensure it's on top when shown
  }

  // Auto-scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Helper function to find the activity item container from a menu button
function findActivityItemFromMenuButton(menuButton) {
  // Find the closest parent that represents an activity item - using the same approach as standalone script
  return (
    menuButton.closest('div[aria-label="Activity Log Item"]') ||
    menuButton.closest('div[role="article"]') ||
    menuButton.closest('div[role="listitem"]') ||
    menuButton.closest('div[data-pagelet*="activity"]') ||
    // If we can't find a specific parent container, go up 4-5 levels to capture the activity item
    menuButton.parentElement?.parentElement?.parentElement?.parentElement
  );
}

// Helper function to scroll for more items - simplified from delete-facebook-activity.js
async function scrollForMoreItems() {
  return new Promise((resolve) => {
    console.log('Trying to scroll for more content...');

    const previousHeight = document.body.scrollHeight;

    // Scroll down a couple of times
    for (let i = 0; i < 2; i++) {
      window.scrollBy(0, 500);
    }

    // Wait for content to load after scrolling
    setTimeout(() => {
      const newHeight = document.body.scrollHeight;
      const hasNewContent = newHeight > previousHeight;

      console.log(
        `Scroll result: ${
          hasNewContent ? 'New content found' : 'No new content'
        }`
      );

      // If scrolling didn't help and we've reached consecutive failures, refresh may happen later
      resolve(hasNewContent);
    }, 2000);
  });
}

// Helper functions to extract activity information
function extractDate(activityItem) {
  if (!activityItem) return 'Unknown date';

  try {
    // Try the most specific selector first (from the standalone script)
    const dateElement = activityItem.querySelector('h2 span.html-span > span');

    if (dateElement && dateElement.textContent) {
      return dateElement.textContent.trim();
    }

    // Fall back to more general selectors
    const fallbackSelectors = [
      'span[role="text"] a',
      '[data-testid*="timestamp"]',
      'abbr',
      'h2 span',
      'a[href*="story_fbid"]',
      'span.timestampContent',
    ];

    for (const selector of fallbackSelectors) {
      const element = activityItem.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }

    return 'Unknown date';
  } catch (error) {
    console.log('Error extracting date:', error);
    return 'Unknown date';
  }
}

function extractActivityType(activityItem) {
  if (!activityItem) return 'Unknown activity';

  try {
    // Try the specific selector from the standalone script
    const typeElement = activityItem.querySelector(
      'div:first-child > span[dir="auto"] > span.html-span > span.html-span > span > div'
    );

    if (typeElement && typeElement.textContent) {
      return typeElement.textContent.trim();
    }

    // Fall back to text content analysis
    const text = activityItem.textContent.toLowerCase();

    if (
      text.includes('liked') ||
      text.includes('reacted') ||
      text.includes('reaction')
    ) {
      return 'Like/Reaction';
    } else if (text.includes('comment')) {
      return 'Comment';
    } else if (
      text.includes('post') ||
      text.includes('shared') ||
      text.includes('status')
    ) {
      return 'Post';
    } else if (text.includes('tag') || text.includes('tagged')) {
      return 'Tag';
    } else {
      return 'Other activity';
    }
  } catch (error) {
    console.log('Error extracting activity type:', error);
    return 'Unknown activity';
  }
}

function extractContent(activityItem) {
  if (!activityItem) return 'No content extracted';

  try {
    // Try the specific selector from the standalone script
    const contentElement = activityItem.querySelector(
      'div:nth-child(2) > span[dir="auto"] > span.html-span > span.html-span'
    );

    if (contentElement && contentElement.textContent) {
      const text = contentElement.textContent.trim();
      return text.substring(0, 100) + (text.length > 100 ? '...' : '');
    }

    // Look for post content with more fallback options
    const contentSelectors = [
      'div[dir="auto"]',
      'span[dir="auto"]',
      'div.userContent',
      'div[data-ad-preview="message"]',
      'span.userContent',
    ];

    for (const selector of contentSelectors) {
      const elements = activityItem.querySelectorAll(selector);

      for (const element of elements) {
        const text = element.textContent.trim();
        if (
          text.length > 10 &&
          !text.includes('minutes ago') &&
          !text.includes('hours ago') &&
          !text.includes('seconds ago') &&
          !text.includes('yesterday') &&
          !text.includes('week ago')
        ) {
          return text.substring(0, 100) + (text.length > 100 ? '...' : '');
        }
      }
    }

    return 'No content extracted';
  } catch (error) {
    console.log('Error extracting content:', error);
    return 'No content extracted';
  }
}

// Update the stats display and send to popup
function updateStats() {
  // Update pageRefreshes in the stats
  stats.pageRefreshes = pageRefreshes;

  // Periodically check if popup is still listening
  try {
    chrome.runtime.sendMessage({
      action: 'updateStats',
      stats: stats,
    });
  } catch (error) {
    // Popup might be closed, ignore this error
    console.log('Could not send stats update (popup likely closed)');
  }
}

// Simple sleep function
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to scan the page for activity items and log results
function scanForActivityItems() {
  debug('Scanning for activity items...', 'info');

  // Look for more options buttons (our primary selector)
  const moreOptionsButtons = document.querySelectorAll(
    'div[aria-label="More options"]'
  );
  debug(
    `Found ${moreOptionsButtons.length} "More options" buttons`,
    moreOptionsButtons.length > 0 ? 'success' : 'warning'
  );

  if (moreOptionsButtons.length > 0) {
    // Highlight the first few buttons for visibility
    Array.from(moreOptionsButtons)
      .slice(0, 3)
      .forEach((button, i) => {
        button.style.border = '2px solid red';
        button.style.backgroundColor = 'rgba(255,0,0,0.1)';
        debug(`Button ${i + 1} marked with red border`, 'info');

        // Try to find parent activity item
        const activityItem = findActivityItemFromMenuButton(button);
        if (activityItem) {
          debug(`Activity item ${i + 1} found`, 'success');
          // Log structure details
          const tagName = activityItem.tagName;
          const classes = activityItem.className;
          const role = activityItem.getAttribute('role') || 'none';
          const ariaLabel = activityItem.getAttribute('aria-label') || 'none';

          debug(
            `Item ${
              i + 1
            } structure: <${tagName} class="${classes}" role="${role}" aria-label="${ariaLabel}">`,
            'info'
          );
        } else {
          debug(
            `Could not find parent activity item for button ${i + 1}`,
            'error'
          );
        }
      });
  }

  // Check for menu items that might already be visible
  const menuItems = document.querySelectorAll('div[role="menuitem"]');
  if (menuItems.length > 0) {
    debug(
      `Warning: ${menuItems.length} menu items already visible - a menu might be open`,
      'warning'
    );
    debug('Menu items found:', 'info');
    Array.from(menuItems)
      .slice(0, 5)
      .forEach((item, i) => {
        debug(`   ${i + 1}. "${item.textContent.trim()}"`, 'info');
      });
  }

  return {
    moreOptionsCount: moreOptionsButtons.length,
    menuItemsCount: menuItems.length,
  };
}

// Function to test menu interaction on the first activity item
async function testMenuInteraction() {
  debug('Testing menu interaction on first activity item...', 'info');

  // Ensure timing settings exist
  ensureTimingSettings();

  const results = {
    buttonFound: false,
    menuOpened: false,
    menuItems: [],
    targetActionFound: false,
    targetAction: null,
  };

  // Find the first menu button
  const menuButtons = document.querySelectorAll(
    'div[aria-label="More options"]'
  );
  if (menuButtons.length === 0) {
    debug('No "More options" buttons found', 'error');
    return results;
  }

  results.buttonFound = true;
  const menuButton = menuButtons[0];
  debug('Found "More options" button', 'success');

  // Scroll button into view
  menuButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(500);

  try {
    // Click the menu button
    debug('Clicking menu button...', 'info');
    menuButton.click();
    await sleep(800);

    // Check if menu opened
    const menuItems = document.querySelectorAll('div[role="menuitem"]');
    if (menuItems.length > 0) {
      results.menuOpened = true;
      debug(
        `Menu opened successfully. Found ${menuItems.length} items:`,
        'success'
      );

      // Check each menu item
      const menuTexts = [];
      const targetActions = [
        'Remove Tag',
        'Unlike',
        'Delete',
        'Move to trash',
        'Remove Reaction',
      ];

      let foundTargetAction = false;
      let targetActionText = null;

      Array.from(menuItems).forEach((item, i) => {
        const text = item.textContent.trim();
        menuTexts.push(text);
        debug(`   ${i + 1}. "${text}"`, 'info');

        // Check if this is a target action
        if (
          !foundTargetAction &&
          targetActions.some((action) => text.includes(action))
        ) {
          foundTargetAction = true;
          targetActionText = text;
          debug(`Found target action: "${text}"`, 'success');
        }
      });

      results.menuItems = menuTexts;
      results.targetActionFound = foundTargetAction;
      results.targetAction = targetActionText;
    } else {
      debug('Menu did not open or no menu items found', 'error');
    }
  } catch (error) {
    debug(`Error during test: ${error.message}`, 'error');
  } finally {
    // Always close the menu at the end by pressing Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await sleep(300);
  }

  return results;
}
