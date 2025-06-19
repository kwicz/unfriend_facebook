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

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50, // Reduced from 100 to 50 to make script faster
  });

  const context = await browser.newContext();
  const page = await context.newPage();

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

        // Get the first visible menu button
        const visibleButtons = [];
        for (let i = 0; i < count; i++) {
          const button = menuButtons.nth(i);
          if (await button.isVisible()) {
            visibleButtons.push(button);
          }
        }

        if (visibleButtons.length === 0) {
          console.log(
            'No visible menu buttons found, scrolling to find more...'
          );
          await autoScroll(page);
          await page.waitForTimeout(1000); // Reduced from 1500 to 1000
          continue;
        }

        // Use the first visible button
        const menuButton = visibleButtons[0];

        // Before clicking the menu, try to get the activity date using the specified selector
        let activityDate = null;
        let activityType = null;
        let activityContent = null;

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
              'span[style="--fontSize: 15px; --lineHeight: 19.6421px; --8dd7yt: -0.3085em; --hxtmnb: -0.2915em;"]'
            )
            .first();

          // Get the activity content using the specific CSS selector
          const activityContentElement = activityItem
            .locator(
              'span[style="--fontSize: 13px; --lineHeight: 18.2231px; --8dd7yt: -0.3547em; --hxtmnb: -0.3376em;"]'
            )
            .first();

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
        await page.waitForTimeout(800); // Reduced from 1000 to 800

        // Look for the menu items
        const menuItems = page.locator('div[role="menuitem"]');
        const menuItemCount = await menuItems.count();

        // Wait a moment for the menu to fully appear
        await page.waitForTimeout(800); // Reduced from 1000 to 800

        if (menuItemCount > 0) {
          // Check first menu item text
          const firstMenuItem = menuItems.nth(0);
          const firstMenuText = await firstMenuItem.textContent();

          // Determine which menu item to click
          let menuItemToClick;
          let menuText;

          // If first item contains "Hide", use the second menu item (if available)
          if (firstMenuText.includes('Hide')) {
            if (menuItemCount > 1) {
              menuItemToClick = menuItems.nth(1);
              menuText = await menuItemToClick.textContent();
              console.log(
                `First item contains "Hide", clicking second menu item: "${menuText}"`
              );
            } else {
              // If only one item is available (which has "Hide"), just close and skip
              console.log('Only "Hide" option available, skipping this item');
              await page.keyboard.press('Escape');
              await page.waitForTimeout(800);
              continue;
            }
          } else {
            // Use the first menu item if it doesn't contain "Hide"
            menuItemToClick = firstMenuItem;
            menuText = firstMenuText;
            console.log(`Clicking first menu item: "${menuText}"`);
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
          await page.waitForTimeout(800);

          // Check specifically for the three modal types
          let confirmed = false;

          try {
            // Check for Delete? modal first
            const deleteModal = page.locator('div[aria-label="Delete?"]');
            const removeModal = page.locator('div[aria-label="Remove?"]');
            const removeTagsModal = page.locator(
              'div[aria-label="Remove tags?"]'
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
              await page.waitForTimeout(1500);
              deletedCount++;

              // Save activity details to our data structure with more detailed information
              deletedActivities.items.push({
                url: urlBefore,
                date: activityDate,
                activityType: activityType,
                activityContent: activityContent,
                action: menuText,
                actionType: menuText.toLowerCase().includes('delete')
                  ? 'delete'
                  : menuText.toLowerCase().includes('remove')
                  ? 'remove'
                  : 'other',
                deletedAt: new Date().toISOString(),
              });

              // Save the updated data after each successful deletion
              fs.writeFileSync(
                './deletedActivity.json',
                JSON.stringify(deletedActivities, null, 2)
              );

              console.log(
                `Successfully deleted item. Total deleted: ${deletedCount}`
              );
            } else {
              console.log(
                'Could not find expected buttons in the modal or confirm deletion'
              );
              // Try to close the modal and continue
              await page.keyboard.press('Escape');
              failedCount++;
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
        await page.waitForTimeout(1500); // Reduced from 2000 to 1500
      } catch (error) {
        console.error('Error during deletion process:', error);
        failedCount++;

        // Try to recover by pressing Escape and continuing
        try {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(800); // Reduced from 1000 to 800
          await page.keyboard.press('Escape'); // Press twice to ensure menus are closed
        } catch (escapeError) {
          // Ignore if Escape fails
        }

        await page.waitForTimeout(1500); // Reduced from 2000 to 1500
      }
    }

    // Final report
    deletedActivities.summary.totalDeleted = deletedCount;
    deletedActivities.summary.totalFailed = failedCount;
    deletedActivities.summary.pageRefreshes = pageRefreshes;
    deletedActivities.summary.endTime = new Date().toISOString();

    console.log('\n===== FACEBOOK ACTIVITY DELETION REPORT =====');
    console.log(`Total items successfully deleted: ${deletedCount}`);
    console.log(`Total items failed to delete: ${failedCount}`);
    console.log(`Page refreshes: ${pageRefreshes}`);
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

// Helper function to scroll down the page to load more content
// This is still needed in some cases, but we'll use refresh more aggressively
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  console.log('Scrolled down to load more content');
}

// Run the script
deleteFacebookActivity();
