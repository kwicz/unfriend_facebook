# Unfriend Facebook

This project uses Playwright to automate the deletion of Facebook activity from your activity log, helping you clean up your digital footprint specifically by removing activities that appear on the /allactivity page. The project is also available as a Chrome extension for easier access.

## Getting Started

### Prerequisites

1. Make sure you have Node.js installed (version 14 or higher)

2. Install the Playwright extension for VS Code

   - Open VS Code and go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
   - Search for "Playwright"
   - Install the "Playwright Test for VSCode" extension by Microsoft

3. Clone this repository

   ```bash
   git clone https://github.com/your-username/unfriend_facebook.git
   cd unfriend_facebook
   ```

4. Install dependencies

   ```bash
   npm install
   ```

5. Install Playwright browsers

   ```bash
   npx playwright install
   ```

## Usage Options

This project offers three different methods for deleting Facebook activities:

### Option 1: Chrome Extension (Easiest)

The Chrome extension provides a convenient interface to help you delete your Facebook activity:

1. **Install the extension**:

   - In Chrome, go to Menu (three dots) > More tools > Extensions
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the project folder
   - The Unfriend Facebook extension icon should appear in your browser toolbar

2. **Using the extension**:

   - Log into your Facebook account
   - Navigate to your Facebook activity page
   - Click the Unfriend Facebook extension icon in your toolbar
   - Follow the on-screen instructions in the popup to start the deletion process
   - The extension will automate the deletion process directly in your browser

3. **Extension features**:
   - Easy-to-use interface for managing Facebook activity
   - Runs directly in your browser without need for external scripts
   - Visual feedback on deletion progress

### Option 2: Node.js Script with Playwright (Recommended for Batch Processing)

This method uses a standalone Node.js script with Playwright for automation:

1. Run the activity deletion script:

   ```bash
   node delete-facebook-activity.js
   ```

2. You'll be prompted for your Facebook activity URL in the format:

   ```
   https://www.facebook.com/{username}/allactivity/
   ```

3. The script will open a browser window where you'll need to log in manually.

4. After logging in, press any key in the terminal to start the automated deletion process.

5. The script will continue running until no more activities are found or you terminate it with Ctrl+C.

6. A log of deleted activities will be saved to `deletedActivity.json` for your reference.

### Option 3: Browser Console Script

For users who prefer to run the script directly in their browser:

1. Log into Facebook in your preferred browser
2. Navigate to your activity page (https://www.facebook.com/{username}/allactivity/)
3. Open the browser developer console:
   - Chrome/Edge: F12 or Ctrl+Shift+J (Windows) or Cmd+Option+J (Mac)
   - Firefox: F12 or Ctrl+Shift+K (Windows) or Cmd+Option+K (Mac)
   - Safari: Cmd+Option+C (first enable developer menu in Safari preferences)
4. Copy the entire contents of the `dev-console-delete-activity.js` file
5. Paste the code into the console and press Enter to begin the deletion process
6. The script will run in your browser and display progress in the console

## Features

This automation tool helps you delete activities from your Facebook activity log (/allactivity page):

- Automatically navigates to your Facebook activity log
- Identifies deletable activities in your history including:
  - Posts
  - Comments
  - Likes/Reactions
  - Tags
  - Other activities in your history
- Clicks through Facebook's deletion flow for each activity
- Continues until no more activities are found or you terminate it
- The Node.js script additionally tracks and saves information about deleted activities
- Chrome extension provides a user-friendly interface for the deletion process

## Important Notes

⚠️ **Important**: These tools automate interactions with Facebook. Use responsibly and be aware of Facebook's terms of service. Consider the following:

- Run the automation slowly to avoid triggering Facebook's anti-bot measures
- Be prepared for potential account restrictions
- Always review what will be deleted before running the automation
- Keep backups of important content before deletion

## Safety and Legal Considerations

- These tools are for personal use only
- You are responsible for complying with Facebook's terms of service
- The automation may break if Facebook updates their interface
- Use at your own risk

## Contributing

If you find bugs or want to improve the automation scripts, please feel free to submit issues or pull requests.

## Disclaimer

This project is not affiliated with Facebook/Meta. It's an independent tool created to help users manage their own Facebook data. Use responsibly and in accordance with Facebook's terms of service.
