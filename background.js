// Background script for Facebook Activity Cleaner

// Listen for installation events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Initialize settings on first install with improved defaults based on standalone script
    chrome.storage.local.set({
      cleanerSettings: {
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
      },
      cleanerStats: {
        deleted: 0,
        failed: 0,
        total: 0,
        progress: 0,
        pageRefreshes: 0,
      },
      isRunning: false,
      deletedActivities: {
        items: [],
        summary: {
          totalDeleted: 0,
          totalFailed: 0,
          pageRefreshes: 0,
          startTime: null,
          endTime: null,
          errorBreakdown: {},
          successRate: '0%',
        },
      },
    });

    // Open welcome page
    chrome.tabs.create({
      url: 'https://www.facebook.com/me/allactivity',
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'logActivity') {
    // Add deleted activity to storage with enhanced data structure from standalone script
    chrome.storage.local.get(['deletedActivities'], function (result) {
      const deletedActivities = result.deletedActivities || {
        items: [],
        summary: {
          totalDeleted: 0,
          totalFailed: 0,
          pageRefreshes: 0,
          startTime: null,
          endTime: null,
          errorBreakdown: {},
          successRate: '0%',
        },
      };

      // Add new deleted item with more detailed information
      deletedActivities.items.push(message.activity);

      // Update summary
      deletedActivities.summary.totalDeleted++;

      // Update success rate
      const total =
        deletedActivities.summary.totalDeleted +
        deletedActivities.summary.totalFailed;
      if (total > 0) {
        deletedActivities.summary.successRate =
          ((deletedActivities.summary.totalDeleted / total) * 100).toFixed(2) +
          '%';
      }

      // Save back to storage
      chrome.storage.local.set({ deletedActivities: deletedActivities });

      // Send response if callback provided
      if (sendResponse) {
        sendResponse({ success: true });
      }
    });

    // Return true to indicate we'll respond asynchronously
    return true;
  } else if (message.action === 'updateStats') {
    // Update the cleaner stats in storage
    chrome.storage.local.set({ cleanerStats: message.stats });

    // Update badge with count
    if (message.stats && message.stats.deleted) {
      chrome.action.setBadgeText({
        text: message.stats.deleted.toString(),
      });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    }
  } else if (message.action === 'startCleaning') {
    // Record start time when cleaning begins
    chrome.storage.local.get(['deletedActivities'], function (result) {
      const deletedActivities = result.deletedActivities || {
        items: [],
        summary: {
          totalDeleted: 0,
          totalFailed: 0,
          pageRefreshes: 0,
          startTime: null,
          endTime: null,
          errorBreakdown: {},
          successRate: '0%',
        },
      };

      // Set start time if it's not already set
      if (!deletedActivities.summary.startTime) {
        deletedActivities.summary.startTime = new Date().toISOString();
        chrome.storage.local.set({ deletedActivities: deletedActivities });
      }
    });

    // Set running state
    chrome.storage.local.set({ isRunning: true });
  } else if (message.action === 'stopCleaning') {
    // Record end time when cleaning stops
    chrome.storage.local.get(['deletedActivities'], function (result) {
      const deletedActivities = result.deletedActivities || {
        items: [],
        summary: {
          totalDeleted: 0,
          totalFailed: 0,
          pageRefreshes: 0,
          startTime: null,
          endTime: null,
          errorBreakdown: {},
          successRate: '0%',
        },
      };

      // Set end time
      deletedActivities.summary.endTime = new Date().toISOString();
      chrome.storage.local.set({
        deletedActivities: deletedActivities,
        isRunning: false,
      });
    });
  } else if (message.action === 'updatePageRefreshes') {
    // Update page refresh count
    chrome.storage.local.get(['deletedActivities'], function (result) {
      const deletedActivities = result.deletedActivities;
      if (deletedActivities) {
        deletedActivities.summary.pageRefreshes = message.count;
        chrome.storage.local.set({ deletedActivities: deletedActivities });
      }
    });
  } else if (message.action === 'saveErrorType') {
    // Track error types
    chrome.storage.local.get(['deletedActivities'], function (result) {
      const deletedActivities = result.deletedActivities;
      if (deletedActivities) {
        if (!deletedActivities.summary.errorBreakdown) {
          deletedActivities.summary.errorBreakdown = {};
        }

        const errorType = message.errorType;
        deletedActivities.summary.errorBreakdown[errorType] =
          (deletedActivities.summary.errorBreakdown[errorType] || 0) + 1;

        // Also update totalFailed count
        deletedActivities.summary.totalFailed++;

        // Update success rate
        const total =
          deletedActivities.summary.totalDeleted +
          deletedActivities.summary.totalFailed;
        if (total > 0) {
          deletedActivities.summary.successRate =
            ((deletedActivities.summary.totalDeleted / total) * 100).toFixed(
              2
            ) + '%';
        }

        chrome.storage.local.set({ deletedActivities: deletedActivities });
      }
    });
  } else if (message.action === 'getSettings') {
    // Get settings
    chrome.storage.local.get(['cleanerSettings'], function (result) {
      if (sendResponse) {
        sendResponse(result.cleanerSettings);
      }
    });
    return true;
  } else if (message.action === 'updateStatus') {
    // Update the extension popup with status
    chrome.runtime
      .sendMessage({
        action: 'statusUpdate',
        status: message.status,
      })
      .catch(() => {
        // Ignore errors when popup is not open
      });
  } else if (message.action === 'createBackup') {
    // Export deleted activities data with timestamp
    chrome.storage.local.get(['deletedActivities'], function (result) {
      if (result.deletedActivities) {
        // Create a download of the data
        const blob = new Blob(
          [JSON.stringify(result.deletedActivities, null, 2)],
          { type: 'application/json' }
        );

        const timestamp = new Date()
          .toISOString()
          .replace(/:/g, '-')
          .replace(/\..+/, '');

        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
          url: url,
          filename: `facebook_deleted_activities_${timestamp}.json`,
          saveAs: true,
        });
      }
    });
  } else if (message.action === 'forceReload') {
    // Handle force reload request from debug panel
    console.log('Force reload requested:', message.message);

    // Respond to let the content script know we received the message
    if (sendResponse) {
      sendResponse({ success: true, reloading: true });
    }

    // Use setTimeout to ensure the response is sent before reloading
    setTimeout(() => {
      // Reload the extension - this will cause Chrome to reload the content scripts
      chrome.runtime.reload();
    }, 100);

    return true; // Indicate we'll send a response asynchronously
  }
});

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clean-activity-page',
    title: 'Clean this activity page',
    contexts: ['page'],
    documentUrlPatterns: ['https://*.facebook.com/*activity*'],
  });

  chrome.contextMenus.create({
    id: 'view-logs',
    title: 'View deleted activity logs',
    contexts: ['action'],
  });

  chrome.contextMenus.create({
    id: 'export-logs',
    title: 'Export deleted activity data',
    contexts: ['action'],
  });

  // Add more specific cleaning options
  chrome.contextMenus.create({
    id: 'clean-likes',
    title: 'Clean only likes & reactions',
    contexts: ['page'],
    documentUrlPatterns: ['https://*.facebook.com/*activity*'],
  });

  chrome.contextMenus.create({
    id: 'clean-posts',
    title: 'Clean only posts',
    contexts: ['page'],
    documentUrlPatterns: ['https://*.facebook.com/*activity*'],
  });

  chrome.contextMenus.create({
    id: 'clean-comments',
    title: 'Clean only comments',
    contexts: ['page'],
    documentUrlPatterns: ['https://*.facebook.com/*activity*'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Get settings with more advanced options
  chrome.storage.local.get(['cleanerSettings'], function (result) {
    let settings = result.cleanerSettings || {
      activityType: 'all',
      timeRange: 'all',
      batchSize: 10,
      pauseInterval: 1000,
      timing: {
        menuWait: 700,
        modalWait: 700,
        actionComplete: 1200,
        nextItem: 1000,
        pageLoad: 2500,
      },
      maxConsecutiveFailures: 5,
      maxPageRefreshes: 5,
      maxActionRetries: 2,
    };

    if (info.menuItemId === 'clean-activity-page') {
      settings.activityType = 'all';
      chrome.tabs.sendMessage(tab.id, {
        action: 'startCleaning',
        settings: settings,
      });
    } else if (info.menuItemId === 'clean-likes') {
      settings.activityType = 'likes';
      chrome.tabs.sendMessage(tab.id, {
        action: 'startCleaning',
        settings: settings,
      });
    } else if (info.menuItemId === 'clean-posts') {
      settings.activityType = 'posts';
      chrome.tabs.sendMessage(tab.id, {
        action: 'startCleaning',
        settings: settings,
      });
    } else if (info.menuItemId === 'clean-comments') {
      settings.activityType = 'comments';
      chrome.tabs.sendMessage(tab.id, {
        action: 'startCleaning',
        settings: settings,
      });
    } else if (info.menuItemId === 'view-logs') {
      chrome.tabs.create({
        url: chrome.runtime.getURL('logs.html'),
      });
    } else if (info.menuItemId === 'export-logs') {
      chrome.tabs.create({
        url: chrome.runtime.getURL('export.html'),
      });
    }
  });
});
