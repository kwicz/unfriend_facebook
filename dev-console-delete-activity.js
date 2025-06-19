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
    scrollAmount: 100, // How much to scroll each time
    maxConsecutiveFailures: 5, // Stop after this many consecutive failures
    pageRefreshes: 0,
    maxPageRefreshes: 5,
  };

  // Stats
  let stats = {
    deletedCount: 0,
    failedCount: 0,
    consecutiveFailures: 0,
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

  // Helper function to scroll down the page
  async function autoScroll() {
    return new Promise((resolve) => {
      let totalHeight = 0;
      const distance = config.scrollAmount;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          log('Scrolled down to load more content');
          resolve();
        }
      }, 100);
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
      log(
        'No visible menu buttons found, scrolling to find more...',
        'warning'
      );
      return false;
    }

    // Use the first visible button
    const menuButton = visibleButtons[0];

    // Ensure the button is in view
    menuButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(300); // Reduced from 500 to 300

    log('Clicking menu button...', 'info');
    menuButton.click();
    await wait(config.delayBetweenActions);

    // Reset consecutive failures counter if we found and clicked a button
    stats.consecutiveFailures = 0;
    return true;
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

    // Check first menu item text
    const firstMenuItem = menuItems[0];
    const firstMenuText = firstMenuItem.textContent || '';

    // Determine which menu item to click
    let menuItemToClick;
    let menuText;

    // If first item contains "Hide", use the second menu item (if available)
    if (firstMenuText.includes('Hide')) {
      if (menuItems.length > 1) {
        menuItemToClick = menuItems[1];
        menuText = menuItemToClick.textContent;
        log(
          `First item contains "Hide", clicking second menu item: "${menuText}"`,
          'info'
        );
      } else {
        // If only one item is available (which has "Hide"), just close and skip
        log('Only "Hide" option available, skipping this item', 'warning');
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
        );
        await wait(config.delayBetweenActions);
        return false;
      }
    } else {
      // Use the first menu item if it doesn't contain "Hide"
      menuItemToClick = firstMenuItem;
      menuText = firstMenuText;
      log(`Clicking menu item: "${menuText}"`, 'info');
    }

    // Store element count before clicking to detect changes
    const elementsBefore = document.querySelectorAll(
      'div[aria-label="More options"]'
    ).length;

    menuItemToClick.click();
    await wait(config.delayBetweenActions);
    return { success: true, elementsBefore: elementsBefore };
  }

  // Try to handle the confirmation modal
  async function handleConfirmationModal(elementsBefore) {
    await wait(800); // Reduced from 1000 to 800

    // Check for the three possible modal types
    const deleteModal = document.querySelector('div[aria-label="Delete?"]');
    const removeModal = document.querySelector('div[aria-label="Remove?"]');
    const removeTagsModal = document.querySelector(
      'div[aria-label="Remove tags?"]'
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
    }

    if (confirmButton) {
      log(
        `${modalType} modal found, clicking confirmation button...`,
        'success'
      );
      confirmButton.click();
      await wait(1500); // Reduced from 2000 to 1500
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
    // Try to close any open dialog
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
    );
    await wait(800); // Reduced from 1000 to 800
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

        // Try scrolling to find more content
        await autoScroll();
        await wait(1500); // Reduced from 2000 to 1500
        return true; // Continue trying
      }

      // Find and click the menu item
      const clickedMenuItem = await findAndClickMenuItem();
      if (!clickedMenuItem || !clickedMenuItem.success) {
        stats.failedCount++;
        return true; // Continue to next item
      }

      // Handle the confirmation modal
      await handleConfirmationModal(clickedMenuItem.elementsBefore);

      // Wait a moment before continuing to the next item
      await wait(1500); // Reduced from 2000 to 1500
      return true; // Continue to next item
    } catch (error) {
      log(`Error during deletion process: ${error.message}`, 'error');
      stats.failedCount++;

      // Try to recover
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
      );
      await wait(800); // Reduced from 1000 to 800
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
      );
      await wait(1500); // Reduced from 2000 to 1500

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

    while (shouldContinue) {
      shouldContinue = await processNextItem();
      // Small break between iterations
      await wait(300); // Reduced from 500 to 300
    }

    // Final report
    log('\n===== FACEBOOK ACTIVITY DELETION REPORT =====', 'info');
    log(`Total items successfully deleted: ${stats.deletedCount}`, 'success');
    log(`Total items failed to delete: ${stats.failedCount}`, 'warning');
    log(`Page refreshes: ${config.pageRefreshes}`, 'info');
    log('==========================================\n', 'info');
  }

  // Start the process
  runDeletionProcess();
})();
