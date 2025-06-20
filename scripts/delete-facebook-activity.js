// Standalone Facebook activity deletion script
const { chromium } = require('playwright');
const readline = require('readline');
const fs = require('fs');

// Data structure to store deleted activities
const deletedActivities = {
  items: [],
  summary: {
    totalDeleted: 0,
    totalFailed: 0,
    pageRefreshes: 0,
    startTime: new Date().toISOString(),
    endTime: null,
  },
};

// Load existing data if available
try {
  if (fs.existsSync('./deletedActivity.json')) {
    const existingData = JSON.parse(
      fs.readFileSync('./deletedActivity.json', 'utf8')
    );
    if (existingData && existingData.items) {
      deletedActivities.items = existingData.items;
      // Also maintain the existing totalDeleted count if it exists
      if (existingData.summary && existingData.summary.totalDeleted) {
        deletedActivities.summary.totalDeleted =
          existingData.summary.totalDeleted;
      }
      console.log(
        `Loaded ${existingData.items.length} existing activity records`
      );
    }
  }
} catch (err) {
  console.log('No existing activity records found, starting fresh');
}

async function getActivityURL() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter the Facebook activity URL: ', (url) => {
      rl.close();
      if (!url) {
        console.log(
          'Error: URL is required. Please run the script again and provide a valid URL.'
        );
        process.exit(1);
      }
      resolve(url);
    });
  });
}

async function deleteFacebookActivity() {
  console.log('Starting Facebook activity deletion...');

  // Get activity URL from user input
  const activityURL = await getActivityURL();
  console.log(`Using activity URL: ${activityURL}`);

  // Centralized timing settings for easy tuning
  const TIMING = {
    MENU_WAIT: 700, // Wait after clicking menu button
    MODAL_WAIT: 700, // Wait for modal to appear
    ACTION_COMPLETE: 1200, // Wait for action to complete
    NEXT_ITEM: 1000, // Wait before proceeding to next item
    PAGE_LOAD: 2500, // Wait after page reload
  };

  // Launch browser with optimized settings
  const browser = await chromium.launch({
    headless: false,
    slowMo: 30, // Reduced for better performance
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Add this near the top of the file, after the deletedActivities declaration
  let lastSaveTime = Date.now();
  const SAVE_INTERVAL = 5000; // Save every 5 seconds instead of every deletion

  try {
    // Navigate to the Facebook activity page
    await page.goto(activityURL);
    console.log('Navigated to Facebook activity page');

    // Wait for user to log in
    console.log(
      'Please log in to Facebook. Press any key in the terminal when ready...'
    );
    await waitForKeyPress();
    console.log('Continuing with activity deletion...');

    // Initialize counters
    let deletedCount = 0;
    let failedCount = 0;
    let noMoreItems = false;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    let pageRefreshes = 0;
    const MAX_PAGE_REFRESHES = 5;
    const MAX_ACTION_RETRIES = 2; // Maximum number of times to retry a failed action
    const errorTypes = {}; // Track different types of errors

    // Main deletion loop
    while (!noMoreItems) {
      try {
        // Using the specific selector for the three dots "more options" menu button
        const menuButtons = page.locator('div[aria-label="More options"]');

        await page.waitForTimeout(800);
        const count = await menuButtons.count();

        if (count === 0) {
          consecutiveFailures++;
          console.log(
            `No menu buttons found. Attempt ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`
          );

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            // Try refreshing the page if no menu buttons are found
            if (pageRefreshes < MAX_PAGE_REFRESHES) {
              pageRefreshes++;
              consecutiveFailures = 0;
              console.log(
                `Refreshing page to find more items. Refresh attempt ${pageRefreshes}/${MAX_PAGE_REFRESHES}`
              );
              await page.reload();
              await page.waitForTimeout(3000); // Wait for page to reload
              continue;
            } else {
              console.log(
                'Reached maximum page refreshes. No more items to delete.'
              );
              noMoreItems = true;
              break;
            }
          }

          // Refresh instead of scrolling when no menu items are found
          console.log('No menu buttons found, refreshing the page...');
          await page.reload();
          await page.waitForTimeout(3000); // Wait for page to reload
          continue;
        }

        // Reset consecutive failures counter if we found items
        consecutiveFailures = 0;

        // Get the first visible menu button - improved with better selector handling
        let visibleButton = null;

        try {
          // First try to find a button that's already in view
          visibleButton = await page
            .locator('div[aria-label="More options"]')
            .filter({ has: page.locator(':visible') })
            .first();

          // If no visible button found, try to find any button and scroll it into view
          if (!visibleButton || !(await visibleButton.isVisible())) {
            const anyButton = page
              .locator('div[aria-label="More options"]')
              .first();
            if ((await anyButton.count()) > 0) {
              await anyButton.scrollIntoViewIfNeeded();
              await page.waitForTimeout(300);
              visibleButton = anyButton;
            }
          }
        } catch (error) {
          console.log(
            'Error finding visible menu button, will try standard approach:',
            error.message
          );

          // Fall back to the previous method if the optimized approach fails
          const visibleButtons = [];
          for (let i = 0; i < count; i++) {
            const button = menuButtons.nth(i);
            if (await button.isVisible()) {
              visibleButtons.push(button);
            }
          }

          if (visibleButtons.length > 0) {
            visibleButton = visibleButtons[0];
          }
        }

        if (!visibleButton) {
          console.log('No visible menu buttons found, trying scrolling...');
          await autoScroll(page);
          continue;
        }

        const menuButton = visibleButton;

        // Before clicking the menu, try to get the activity date using the specified selector
        let activityDate = null;
        let activityType = null;
        let activityContent = null;
        let activityLink = null;

        try {
          // Find the parent activity log item that contains this menu button
          const activityItem = menuButton.locator(
            'xpath=./ancestor::div[@aria-label="Activity Log Item"]'
          );

          // Get the activity date
          const dateElement = activityItem
            .locator('h2 span.html-span > span')
            .first();

          // Get the activity type using the specific CSS selector
          const activityTypeElement = activityItem
            .locator(
              'div:first-child > span[dir="auto"] > span.html-span > span.html-span > span > div'
            )
            .first();

          // const activityTypeElement = activityItem
          //   .locator(
          //     'span[style="--fontSize: 15px; --lineHeight: 19.6421px; --8dd7yt: -0.3085em; --hxtmnb: -0.2915em;"]'
          //   )
          //   .first();

          // Get the activity content using the specific CSS selector
          const activityContentElement = activityItem
            .locator(
              'div:nth-child(2) > span[dir="auto"] > span.html-span > span.html-span'
            )
            .first();
          // const activityContentElement = activityItem
          //   .locator(
          //     'span[style="--fontSize: 13px; --lineHeight: 18.2231px; --8dd7yt: -0.3547em; --hxtmnb: -0.3376em;"]'
          //   )
          //   .first();

          // Get the activity link using the View button
          const viewLinkElement = activityItem
            .locator('a[aria-label="View"]')
            .first();

          if (await viewLinkElement.isVisible()) {
            activityLink = await viewLinkElement.getAttribute('href');
            console.log(`Found activity link: ${activityLink}`);
          } else {
            console.log('Could not find activity link element');
          }

          if (await dateElement.isVisible()) {
            activityDate = await dateElement.textContent();
            console.log(`Found activity date: ${activityDate}`);
          } else {
            console.log('Could not find activity date element');
          }

          if (await activityTypeElement.isVisible()) {
            activityType = await activityTypeElement.textContent();
            console.log(`Found activity type: ${activityType}`);
          } else {
            console.log(
              'Could not find activity type element with the specified selector'
            );
          }

          if (await activityContentElement.isVisible()) {
            activityContent = await activityContentElement.textContent();
            console.log(
              `Found activity content: ${activityContent.substring(0, 50)}${
                activityContent.length > 50 ? '...' : ''
              }`
            );
          } else {
            console.log(
              'Could not find activity content element with the specified selector'
            );
          }
        } catch (dateError) {
          console.log('Error getting activity details:', dateError.message);
        }

        // Ensure the button is visible in viewport before clicking
        await menuButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300); // Reduced from 500 to 300

        console.log('Clicking menu button...');
        // Click the menu button
        await menuButton.click({ force: true });
        await page.waitForTimeout(TIMING.MENU_WAIT); // Use centralized timing

        // Look for the menu items
        const menuItems = page.locator('div[role="menuitem"]');
        const menuItemCount = await menuItems.count();

        // Wait a moment for the menu to fully appear
        await page.waitForTimeout(TIMING.MODAL_WAIT); // Use centralized timing

        if (menuItemCount > 0) {
          // Check for specific action buttons we want to click: "Remove Tag", "Unlike", "Delete", or "Move to trash"
          let menuItemToClick = null;
          let menuText = null;
          const targetActions = [
            'Remove Tag',
            'Unlike',
            'Delete',
            'Move to trash',
            'Remove Reaction',
          ];

          // Loop through all menu items to find the target actions
          for (let i = 0; i < menuItemCount; i++) {
            const menuItem = menuItems.nth(i);
            const itemText = await menuItem.textContent();

            if (targetActions.some((action) => itemText.includes(action))) {
              menuItemToClick = menuItem;
              menuText = itemText;
              console.log(`Found target action: "${menuText}"`);
              break;
            }
          }

          // If we didn't find any of our target actions
          if (!menuItemToClick) {
            console.log(
              'No target action found ("Remove Tag", "Unlike", "Delete", or "Move to trash", "Remove Reaction"), skipping this item'
            );
            await page.keyboard.press('Escape');
            await page.waitForTimeout(800);
            continue;
          }

          // Store the current URL or some element count to detect changes
          const elementCountBefore = await page
            .locator('div[aria-label="More options"]')
            .count();
          const urlBefore = page.url();

          // Click the selected menu item
          await menuItemToClick.click();
          await page.waitForTimeout(1000); // Reduced from 1500 to 1000

          console.log('Looking for confirmation modal...');

          // Wait for any modal dialog to appear
          await page.waitForTimeout(TIMING.MODAL_WAIT); // Use centralized timing

          // Check specifically for the three modal types
          let confirmed = false;

          try {
            // Check for Delete? modal first
            const deleteModal = page.locator('div[aria-label="Delete?"]');
            const removeModal = page.locator('div[aria-label="Remove?"]');
            const removeTagsModal = page.locator(
              'div[aria-label="Remove tags?"]'
            );
            const moveToTrashModal = page.locator(
              'div[aria-label="Move to Trash?"]'
            );

            if (await deleteModal.isVisible()) {
              console.log('Delete? modal found');
              // Look for Delete button specifically within this modal
              const deleteButton = deleteModal
                .locator('div[aria-label="Delete"]')
                .first();
              if (await deleteButton.isVisible()) {
                console.log('Clicking Delete button...');
                await deleteButton.click();
                confirmed = true;
              }
            }
            // If Delete modal not found, try Remove modal
            else if (await removeModal.isVisible()) {
              console.log('Remove? modal found');
              // Look for Remove button specifically within this modal
              const removeButton = removeModal
                .locator('div[aria-label="Remove"]')
                .first();
              if (await removeButton.isVisible()) {
                console.log('Clicking Remove button...');
                await removeButton.click();
                confirmed = true;
              }
            }
            // If neither Delete nor Remove modal found, try Remove tags modal
            else if (await removeTagsModal.isVisible()) {
              console.log('Remove tags? modal found');
              // Look for Remove button specifically within this modal
              const removeTagsButton = removeTagsModal
                .locator('div[aria-label="Remove"]')
                .first();
              if (await removeTagsButton.isVisible()) {
                console.log('Clicking Remove button in Remove tags modal...');
                await removeTagsButton.click();
                confirmed = true;
              }
            }
            // Check for Move to Trash modal
            else if (await moveToTrashModal.isVisible()) {
              console.log('Move to Trash? modal found');
              // Look for Move to Trash button specifically within this modal
              const moveToTrashButton = moveToTrashModal
                .locator('div[aria-label="Move to Trash"]')
                .first();
              if (await moveToTrashButton.isVisible()) {
                console.log('Clicking Move to Trash button...');
                await moveToTrashButton.click();
                confirmed = true;
              }
            } else {
              // No modal found - check if the page content changed indicating a successful deletion
              await page.waitForTimeout(1000);
              const elementCountAfter = await page
                .locator('div[aria-label="More options"]')
                .count();
              const urlAfter = page.url();

              // If we observe a change (fewer elements or URL change), consider it a success
              if (
                elementCountAfter < elementCountBefore ||
                urlAfter !== urlBefore
              ) {
                console.log(
                  'No modal appeared, but item appears to have been deleted'
                );
                confirmed = true;
              }
            }

            if (confirmed) {
              // Wait for modal to disappear or action to complete
              await page.waitForTimeout(TIMING.ACTION_COMPLETE);
              deletedCount++;

              // Save activity details to our data structure with more detailed information
              deletedActivities.items.push({
                url: urlBefore,
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
              });

              // Update the summary totals with each successful deletion
              deletedActivities.summary.totalDeleted++;

              // Save the updated data periodically instead of after each deletion
              const now = Date.now();
              if (now - lastSaveTime > SAVE_INTERVAL) {
                fs.writeFileSync(
                  './deletedActivity.json',
                  JSON.stringify(deletedActivities, null, 2)
                );
                lastSaveTime = now;
                console.log('Saved deletion progress to file');
              }

              console.log(
                `Successfully deleted item. Total deleted: ${deletedCount}`
              );
            } else {
              console.log(
                'Could not find expected buttons in the modal or confirm deletion'
              );

              // Add retry logic for failed confirmations
              let retrySuccess = false;

              for (
                let retryCount = 0;
                retryCount < MAX_ACTION_RETRIES && !retrySuccess;
                retryCount++
              ) {
                console.log(
                  `Retry attempt ${
                    retryCount + 1
                  }/${MAX_ACTION_RETRIES} for confirmation...`
                );

                // Try pressing Escape to close the dialog first
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);

                // Try clicking the menu button again
                try {
                  await menuButton.click({ force: true });
                  await page.waitForTimeout(TIMING.MENU_WAIT);

                  // Try clicking the menu item again
                  if (menuItemToClick && (await menuItemToClick.isVisible())) {
                    await menuItemToClick.click();
                    await page.waitForTimeout(TIMING.MODAL_WAIT);

                    // Check for confirmation dialog again
                    // This is a simplified check - we're just looking for any of the modal types
                    const anyModal = page.locator(
                      'div[aria-label="Delete?"], div[aria-label="Remove?"], div[aria-label="Remove tags?"], div[aria-label="Move to Trash?"]'
                    );
                    if (await anyModal.isVisible()) {
                      const actionButton = anyModal
                        .locator(
                          'div[aria-label="Delete"], div[aria-label="Remove"], div[aria-label="Move to Trash"]'
                        )
                        .first();
                      if (await actionButton.isVisible()) {
                        await actionButton.click();
                        console.log('Retry succeeded!');
                        retrySuccess = true;
                        confirmed = true;

                        // Need to repeat the deletedActivities update here
                        deletedCount++;
                        deletedActivities.items.push({
                          url: urlBefore,
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
                        });
                        deletedActivities.summary.totalDeleted++;

                        // Save progress if needed
                        const now = Date.now();
                        if (now - lastSaveTime > SAVE_INTERVAL) {
                          fs.writeFileSync(
                            './deletedActivity.json',
                            JSON.stringify(deletedActivities, null, 2)
                          );
                          lastSaveTime = now;
                          console.log('Saved deletion progress to file');
                        }
                      }
                    }
                  }
                } catch (retryError) {
                  console.log(
                    `Retry attempt ${retryCount + 1} failed:`,
                    retryError.message
                  );
                }

                // If still not successful, try pressing Escape to close any dialogs
                if (!retrySuccess) {
                  await page.keyboard.press('Escape');
                  await page.waitForTimeout(500);
                }
              }

              if (!retrySuccess) {
                // If all retries failed, increment the failure count
                failedCount++;
              }
            }
          } catch (modalError) {
            console.log('Error handling modal:', modalError.message);
            // Try Escape to close any open dialogs
            await page.keyboard.press('Escape');
            await page.waitForTimeout(800);
            failedCount++;
          }
        } else {
          console.log('No menu items found, closing menu...');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(800); // Reduced from 1000 to 800
          failedCount++;
        }

        // Wait a moment before continuing to next item
        await page.waitForTimeout(TIMING.NEXT_ITEM); // Use centralized timing
      } catch (error) {
        console.error('Error during deletion process:', error);
        failedCount++;

        // Track error types for reporting
        const errorType = error.name || 'UnknownError';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;

        // Try to recover by pressing Escape and continuing
        try {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(800);
          await page.keyboard.press('Escape'); // Press twice to ensure menus are closed
        } catch (escapeError) {
          // Ignore if Escape fails
        }

        await page.waitForTimeout(TIMING.NEXT_ITEM);
      }
    }

    // Enhanced final report
    deletedActivities.summary.totalDeleted = deletedCount;
    deletedActivities.summary.totalFailed = failedCount;
    deletedActivities.summary.pageRefreshes = pageRefreshes;
    deletedActivities.summary.endTime = new Date().toISOString();
    deletedActivities.summary.errorBreakdown = errorTypes;
    deletedActivities.summary.successRate =
      deletedCount > 0
        ? ((deletedCount / (deletedCount + failedCount)) * 100).toFixed(2) + '%'
        : '0%';

    console.log('\n===== FACEBOOK ACTIVITY DELETION REPORT =====');
    console.log(`Total items successfully deleted: ${deletedCount}`);
    console.log(`Total items failed to delete: ${failedCount}`);
    console.log(`Success rate: ${deletedActivities.summary.successRate}`);
    console.log(`Page refreshes: ${pageRefreshes}`);

    // Show error breakdown if any errors occurred
    if (Object.keys(errorTypes).length > 0) {
      console.log('\nError breakdown:');
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    console.log('==========================================\n');

    // Save final report to deletedActivity.json
    fs.writeFileSync(
      './deletedActivity.json',
      JSON.stringify(deletedActivities, null, 2)
    );
    console.log(`Deletion report saved to deletedActivity.json`);

    // Also save a timestamped backup copy
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    const backupFilename = `deleted_activities_backup_${timestamp}.json`;
    fs.writeFileSync(
      backupFilename,
      JSON.stringify(deletedActivities, null, 2)
    );
    console.log(`Backup copy saved to ${backupFilename}`);
  } catch (error) {
    console.error('Fatal error during execution:', error);
  } finally {
    // Keep the browser open for review
    console.log(
      'Script finished. Browser will remain open. Press Ctrl+C to exit when done.'
    );
  }
}

// Helper function to wait for a keypress
function waitForKeyPress() {
  return new Promise((resolve) => {
    console.log('Press any key to continue...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

// Helper function to refresh the page instead of scrolling
// We'll use refresh exclusively as per user request
async function autoScroll(page) {
  console.log(
    'No visible menu buttons found, trying scrolls before refreshing...'
  );

  // Try scrolling a couple of times first
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    console.log(`Scroll attempt ${i + 1}/2 completed`);
    await page.waitForTimeout(1000); // Wait a second after each scroll

    // Check if new menu buttons appeared after scrolling
    const buttonsAfterScroll = await page
      .locator('div[aria-label="More options"]')
      .count();
    if (buttonsAfterScroll > 0) {
      console.log(`Found ${buttonsAfterScroll} menu buttons after scrolling`);
      return; // Exit if we found buttons
    }
  }

  // If scrolling didn't help, refresh the page
  console.log(
    "Scrolling didn't reveal new menu buttons, refreshing the page..."
  );
  await page.reload();
  await page.waitForTimeout(TIMING.PAGE_LOAD); // Use centralized timing

  console.log('Page refreshed to find more content');
}

// Run the script
deleteFacebookActivity();
