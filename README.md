# Unfriend Facebook

This project uses Playwright to automate the deletion of Facebook activity from your activity log, helping you clean up your digital footprint specifically by removing activities that appear on the /allactivity page.

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

### Starting the Server

This project uses the Model Context Protocol (MCP) server for Playwright. To start the server:

1. Open the project in Visual Studio Code
2. Use the Command Palette (Cmd+Shift+P on macOS) and search for "MCP: Start Server"
3. Select the "playwright" server defined in the `.vscode/mcp.json` file

The MCP server will start running and provide browser automation capabilities for the script.

### Usage

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

## Features

This automation tool specifically helps you delete activities from your Facebook activity log (/allactivity page):

- Automatically navigates to your Facebook activity log
- Identifies deletable activities in your history
- Clicks through Facebook's deletion flow for each activity
- Continues until no more activities are found or you terminate it

Note: The tool currently only focuses on the activities shown in your Facebook activity log (https://www.facebook.com/{username}/allactivity/) and does not include other features mentioned previously like post deletion from your profile page, comment cleanup, or like/reaction removal beyond what appears in your activity log.

## Usage

⚠️ **Important**: This tool automates interactions with Facebook. Use responsibly and be aware of Facebook's terms of service. Consider the following:

- Run the automation slowly to avoid triggering Facebook's anti-bot measures
- Be prepared for potential account restrictions
- Always review what will be deleted before running the automation
- Keep backups of important content before deletion

## Safety and Legal Considerations

- This tool is for personal use only
- You are responsible for complying with Facebook's terms of service
- The automation may break if Facebook updates their interface
- Use at your own risk

## Contributing

If you find bugs or want to improve the automation scripts, please feel free to submit issues or pull requests.

## Disclaimer

This project is not affiliated with Facebook/Meta. It's an independent tool created to help users manage their own Facebook data. Use responsibly and in accordance with Facebook's terms of service.
