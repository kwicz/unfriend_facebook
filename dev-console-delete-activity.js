/**
 * Facebook Activity Deletion - Browser Console Version
 *
 * Instructions:
 * 1. Log into Facebook
 * 2. Navigate to the activity page you want to clean up
 * 3. Open browser developer console (F12 or Cmd+Option+I on Mac)
 * 4. Paste this entire script and press Enter
 */

(function () {
  // Configuration
  const config = {
    delayBetweenActions: 500, // Reduced from 1000ms to 500ms
    scrollAmount: 500, // How much to scroll each time
    maxConsecutiveFailures: 5, // Stop after this many consecutive failures
    pageRefreshes: 0,
    maxPageRefreshes: 5,
    maxActionRetries: 2, // Maximum number of times to retry a failed action
    // Centralized timing settings
    timing: {
      menuWait: 700, // Wait after clicking menu button
      modalWait: 700, // Wait for modal to appear
      actionComplete: 1200, // Wait for action to complete
      nextItem: 1000, // Wait before proceeding to next item
    },
  };

  // Stats
  let stats = {
    deletedCount: 0,
    failedCount: 0,
    consecutiveFailures: 0,
    errorTypes: {}, // Track different types of errors
  };

  // Console styling
  const consoleStyles = {
    info: 'color: #0066cc; font-weight: bold;',
    success: 'color: #00cc66; font-weight: bold;',
    error: 'color: #cc3300; font-weight: bold;',
    warning: 'color: #cc9900; font-weight: bold;',
  };

  // Logging function with better styling
  function log(message, type = 'info') {
    console.log(
      `%c[FB Deletion] ${message}`,
      consoleStyles[type] || consoleStyles.info
    );
  }

  // Helper function to try scrolling before refreshing the page
  async function autoScroll() {
    log(
      'No visible menu buttons found, trying scrolls before refreshing...',
      'info'
    );

    // Try scrolling a couple of times first
    for (let i = 0; i < 2; i++) {
      window.scrollBy(0, config.scrollAmount);
      log(`Scroll attempt ${i + 1}/2 completed`, 'info');
      await wait(1000); // Wait a second after each scroll

      // Check if new menu buttons appeared after scrolling
      const buttonsAfterScroll = document.querySelectorAll(
        'div[aria-label="More options"]'
      ).length;
      if (buttonsAfterScroll > 0) {
        log(`Found ${buttonsAfterScroll} menu buttons after scrolling`, 'info');
        return true; // Exit if we found buttons
      }
    }

    // If scrolling didn't help, refresh the page
    log(
      "Scrolling didn't reveal new menu buttons, refreshing the page...",
      'info'
    );
    location.reload();
    return new Promise((resolve) => {
      log('Page refreshed to find more content', 'info');
      setTimeout(resolve, 3000); // Wait for page to reload
    });
  }

  // Helper function to wait
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Try to find and click a menu button
  async function findAndClickMenuButton() {
    // Find all "More options" buttons
    const menuButtons = Array.from(
      document.querySelectorAll('div[aria-label="More options"]')
    );

    if (menuButtons.length === 0) {
      stats.consecutiveFailures++;
      log(
        `No menu buttons found. Attempt ${stats.consecutiveFailures}/${config.maxConsecutiveFailures}`,
        'warning'
      );

      // If we've reached max failures, try refreshing the page
      if (stats.consecutiveFailures >= config.maxConsecutiveFailures) {
        if (config.pageRefreshes < config.maxPageRefreshes) {
          config.pageRefreshes++;
          stats.consecutiveFailures = 0;
          log(
            `Refreshing page to find more items. Refresh attempt ${config.pageRefreshes}/${config.maxPageRefreshes}`,
            'warning'
          );
          location.reload();
          return 'refreshing'; // Special return value to handle page refresh
        } else {
          log(
            'Reached maximum page refresh attempts. No more items to delete.',
            'warning'
          );
          return false;
        }
      }
      return false;
    }

    // Find the first visible button
    const visibleButtons = menuButtons.filter((btn) => {
      const rect = btn.getBoundingClientRect();
      return (
        rect.height > 0 &&
        rect.width > 0 &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );
    });

    if (visibleButtons.length === 0) {
      log('No visible menu buttons found, trying scrolling...', 'warning');
      return false;
    }

    // Use the first visible button
    const menuButton = visibleButtons[0];

    // Try to get activity details before clicking (simplified version)
    try {
      // Find the parent activity log item that contains this menu button
      const activityItem = findAncestor(
        menuButton,
        '[aria-label="Activity Log Item"]'
      );
      if (activityItem) {
        // You could add code here to extract and log activity details if needed
        log('Found activity item', 'info');
      }
    } catch (detailsError) {
      log('Error getting activity details: ' + detailsError.message, 'warning');
    }

    // Ensure the button is in view
    menuButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(300); // Reduced from 500 to 300

    log('Clicking menu button...', 'info');
    menuButton.click();
    await wait(config.timing.menuWait);

    // Reset consecutive failures counter if we found and clicked a button
    stats.consecutiveFailures = 0;
    return true;
  }

  // Helper function to find ancestor element matching a selector
  function findAncestor(element, selector) {
    while (element && element !== document) {
      if (element.matches(selector)) return element;
      element = element.parentElement;
    }
    return null;
  }

  // Try to find and click the appropriate menu item
  async function findAndClickMenuItem() {
    const menuItems = Array.from(
      document.querySelectorAll('div[role="menuitem"]')
    );

    if (menuItems.length === 0) {
      log('No menu items found, closing menu...', 'warning');
      // Press Escape to close the menu
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
      );
      await wait(config.delayBetweenActions);
      return false;
    }

    // Define target actions to look for
    const targetActions = [
      'Remove Tag',
      'Unlike',
      'Delete',
      'Move to trash',
      'Remove Reaction',
    ];

    // Find the menu item that matches our target actions
    let menuItemToClick = null;
    let menuText = null;

    // Loop through all menu items to find the target actions
    for (let i = 0; i < menuItems.length; i++) {
      const menuItem = menuItems[i];
      const itemText = menuItem.textContent || '';

      if (targetActions.some((action) => itemText.includes(action))) {
        menuItemToClick = menuItem;
        menuText = itemText;
        log(`Found target action: "${menuText}"`, 'info');
        break;
      }
    }

    // If we didn't find any of our target actions
    if (!menuItemToClick) {
      log(
        'No target action found ("Remove Tag", "Unlike", "Delete", "Move to trash", "Remove Reaction"), skipping this item',
        'warning'
      );
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
      );
      await wait(800);
      return false;
    }

    // Store element count before clicking to detect changes
    const elementsBefore = document.querySelectorAll(
      'div[aria-label="More options"]'
    ).length;

    menuItemToClick.click();
    await wait(config.timing.menuWait);
    return {
      success: true,
      elementsBefore: elementsBefore,
      menuText: menuText,
    };
  }

  // Try to handle the confirmation modal
  async function handleConfirmationModal(elementsBefore, menuText) {
    await wait(config.timing.modalWait);

    // Check for all possible modal types
    const deleteModal = document.querySelector('div[aria-label="Delete?"]');
    const removeModal = document.querySelector('div[aria-label="Remove?"]');
    const removeTagsModal = document.querySelector(
      'div[aria-label="Remove tags?"]'
    );
    const moveToTrashModal = document.querySelector(
      'div[aria-label="Move to Trash?"]'
    );

    let confirmButton = null;
    let modalType = '';

    if (deleteModal) {
      confirmButton = deleteModal.querySelector('div[aria-label="Delete"]');
      modalType = 'Delete?';
    } else if (removeModal) {
      confirmButton = removeModal.querySelector('div[aria-label="Remove"]');
      modalType = 'Remove?';
    } else if (removeTagsModal) {
      confirmButton = removeTagsModal.querySelector('div[aria-label="Remove"]');
      modalType = 'Remove tags?';
    } else if (moveToTrashModal) {
      confirmButton = moveToTrashModal.querySelector(
        'div[aria-label="Move to Trash"]'
      );
      modalType = 'Move to Trash?';
    }

    if (confirmButton) {
      log(
        `${modalType} modal found, clicking confirmation button...`,
        'success'
      );
      confirmButton.click();
      await wait(config.timing.actionComplete);
      stats.deletedCount++;
      log(
        `Successfully deleted item. Total deleted: ${stats.deletedCount}`,
        'success'
      );
      return true;
    }

    // No modal found - check if the page content changed indicating a successful deletion
    await wait(1000);
    const elementsAfter = document.querySelectorAll(
      'div[aria-label="More options"]'
    ).length;

    // If we observe fewer elements, consider it a success
    if (elementsAfter < elementsBefore) {
      log(
        'No modal appeared, but item appears to have been deleted',
        'success'
      );
      stats.deletedCount++;
      log(
        `Successfully deleted item. Total deleted: ${stats.deletedCount}`,
        'success'
      );
      return true;
    }

    log(
      'Could not find expected buttons in any modal or confirm deletion',
      'error'
    );

    // Add retry logic for failed confirmations
    let retrySuccess = false;

    for (
      let retryCount = 0;
      retryCount < config.maxActionRetries && !retrySuccess;
      retryCount++
    ) {
      log(
        `Retry attempt ${retryCount + 1}/${
          config.maxActionRetries
        } for confirmation...`,
        'warning'
      );

      // Try pressing Escape to close the dialog first
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
      );
      await wait(500);

      // Try to reopen the menu and click the same item again
      try {
        // Find a menu button again
        const menuButtons = Array.from(
          document.querySelectorAll('div[aria-label="More options"]')
        );
        if (menuButtons.length > 0) {
          const visibleButtons = menuButtons.filter((btn) => {
            const rect = btn.getBoundingClientRect();
            return (
              rect.height > 0 &&
              rect.width > 0 &&
              rect.top >= 0 &&
              rect.left >= 0 &&
              rect.bottom <= window.innerHeight &&
              rect.right <= window.innerWidth
            );
          });

          if (visibleButtons.length > 0) {
            const menuButton = visibleButtons[0];
            menuButton.click();
            await wait(config.timing.menuWait);

            // Look for the menu items again
            const menuItems = Array.from(
              document.querySelectorAll('div[role="menuitem"]')
            );
            if (menuItems.length > 0) {
              // Find the item with the same text as before
              const targetItem = menuItems.find((item) =>
                item.textContent.includes(menuText)
              );
              if (targetItem) {
                targetItem.click();
                await wait(config.timing.modalWait);

                // Check for confirmation dialog again
                const anyModal = document.querySelector(
                  'div[aria-label="Delete?"], div[aria-label="Remove?"], div[aria-label="Remove tags?"], div[aria-label="Move to Trash?"]'
                );
                if (anyModal) {
                  const actionButton = anyModal.querySelector(
                    'div[aria-label="Delete"], div[aria-label="Remove"], div[aria-label="Move to Trash"]'
                  );
                  if (actionButton) {
                    actionButton.click();
                    log('Retry succeeded!', 'success');
                    retrySuccess = true;
                    stats.deletedCount++;
                    log(
                      `Successfully deleted item. Total deleted: ${stats.deletedCount}`,
                      'success'
                    );
                    return true;
                  }
                }
              }
            }
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
          new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
        );
        await wait(500);
      }
    }

    // Try to close any open dialog
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
    );
    await wait(800);
    stats.failedCount++;
    return false;
  }

  // Main deletion process function
  async function processNextItem() {
    try {
      // Find and click on a menu button
      const foundMenu = await findAndClickMenuButton();

      // Handle page refresh special case
      if (foundMenu === 'refreshing') {
        return true; // The page is refreshing, so we'll restart after reload
      }

      if (!foundMenu) {
        // If we've reached max consecutive failures, stop
        if (stats.consecutiveFailures >= config.maxConsecutiveFailures) {
          log(
            'Reached maximum consecutive failures. No more items to delete.',
            'warning'
          );
          return false; // Signal to stop
        }

        // Try scrolling before refreshing the page to find more content
        await autoScroll();
        await wait(1500);
        return true; // Continue trying
      }

      // Find and click the menu item
      const clickedMenuItem = await findAndClickMenuItem();
      if (!clickedMenuItem || !clickedMenuItem.success) {
        stats.failedCount++;
        return true; // Continue to next item
      }

      // Handle the confirmation modal
      await handleConfirmationModal(
        clickedMenuItem.elementsBefore,
        clickedMenuItem.menuText
      );

      // Wait a moment before continuing to the next item
      await wait(config.timing.nextItem);
      return true; // Continue to next item
    } catch (error) {
      log(`Error during deletion process: ${error.message}`, 'error');
      stats.failedCount++;

      // Track error types
      const errorType = error.name || 'UnknownError';
      stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;

      // Try to recover
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
      );
      await wait(800);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
      );
      await wait(1500);

      return true; // Try to continue despite error
    }
  }

  // Main loop function
  async function runDeletionProcess() {
    log(
      'Facebook Activity Deletion started - DO NOT close this console',
      'info'
    );
    log('You can stop the script at any time by refreshing the page', 'info');

    let shouldContinue = true;
    const startTime = new Date();

    while (shouldContinue) {
      shouldContinue = await processNextItem();
      // Small break between iterations
      await wait(300);
    }

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    // Calculate success rate
    const successRate =
      stats.deletedCount > 0
        ? (
            (stats.deletedCount / (stats.deletedCount + stats.failedCount)) *
            100
          ).toFixed(2) + '%'
        : '0%';

    // Final report
    log('\n===== FACEBOOK ACTIVITY DELETION REPORT =====', 'info');
    log(`Total items successfully deleted: ${stats.deletedCount}`, 'success');
    log(`Total items failed to delete: ${stats.failedCount}`, 'warning');
    log(`Success rate: ${successRate}`, 'info');
    log(`Page refreshes: ${config.pageRefreshes}`, 'info');
    log(`Total duration: ${duration} seconds`, 'info');

    // Show error breakdown if any errors occurred
    if (Object.keys(stats.errorTypes).length > 0) {
      log('\nError breakdown:', 'warning');
      Object.entries(stats.errorTypes).forEach(([type, count]) => {
        log(`  ${type}: ${count}`, 'warning');
      });
    }

    log('==========================================\n', 'info');
  }

  // Start the process
  runDeletionProcess();
})();
