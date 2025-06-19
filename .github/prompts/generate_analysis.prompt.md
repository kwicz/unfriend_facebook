# A/B Test Prompt Templates with Screenshots & Heatmaps

## URL-Only Template (Simplified Input):

```
@generate_test.prompt.md

**Website**: [URL]

This is all you need to provide! The system will automatically:
1. Visit the URL
2. Take screenshots
3. Generate heatmap analyses
4. Identify key elements
5. Suggest and implement optimizations
6. Create a complete analysis report with left-right layout
```

## Basic Template with Screenshot:

```
@generate_test.prompt.md

**Website**: [URL]
**Target Element**: [Description] (Optional)
**Desired Modification**: [Specific change] (Optional)
**Documentation**: Take screenshots for analysis and documentation

**Steps**:
1. Go to [website URL]
2. Extract domain from URL to create a directory-friendly name
3. Check if directory `/analysis/{url}/` exists - if so, clear existing reports
4. Create/recreate directory `/analysis/{url}/`
5. Take a full-page screenshot and save to `/analysis/{url}/original.png`
6. Find the [target element description] (or auto-identify key elements if not specified)
7. Generate JavaScript to [specific modification] (or auto-suggest optimization if not specified)
8. Apply the modification and take another screenshot and save to `/analysis/{url}/modified.png`
9. Create HTML report with heatmap on left side, analysis text and results on right side
```

## Template with Heatmap Overlay:

```
@generate_test.prompt.md

**Website**: [URL]
**Target Element**: [Description] (Optional)
**Desired Modification**: [Specific change] (Optional)
**Heatmap**: I will provide a predictive heatmap image to overlay (Optional)
**Documentation**: Capture screenshots with heatmap analysis

**Steps**:
1. Go to [website URL]
2. Extract domain from URL to create a directory-friendly name
3. Check if directory `/analysis/{url}/` exists - if so, replace existing report
4. Create/recreate directory `/analysis/{url}/`
5. Take a full-page screenshot and save to `/analysis/{url}/original.png`
6. Generate a predictive heatmap if not provided and save to `/analysis/{url}/heatmap.png`
7. Overlay the heatmap image onto the screenshot with 65% opacity
8. Save the combined image to `/analysis/{url}/heatmap-overlay.png`
9. Find the [target element description] (or auto-identify key elements)
10. Analyze how the target element aligns with high-attention areas in the heatmap
11. Generate JavaScript to [specific modification] (or auto-suggest optimization based on heatmap)
12. Apply modifications and take final screenshot and save to `/analysis/{url}/final.png`
13. Generate HTML report with two-column layout: heatmap/screenshots left, analysis/results right
```

## Complete Example with Heatmap:

```
@generate_test.prompt.md

**Website**: https://www.example.com
**Target Element**: Call-to-action button in the hero section
**Desired Modification**: Move the CTA button to align with the highest attention area shown in the heatmap
**Heatmap**: [Attach your predictive heatmap image file]
**Analysis Goal**: Optimize button placement based on predicted user attention patterns

**Steps**:
1. Go to https://www.example.com
2. Check for existing report at `/analysis/example.com/` - replace if found
3. Create/recreate directory `/analysis/example.com/`
4. Take a full-page screenshot and save to `/analysis/example.com/original.png`
5. Load and overlay the provided heatmap image with 65% opacity
6. Save the combined image to `/analysis/example.com/heatmap-overlay.png`
7. Find the current CTA button in the hero section
8. Identify the coordinates of the highest attention area from the heatmap
9. Generate JavaScript to reposition the CTA button to align with the hottest heatmap area
10. Include CSS positioning and z-index adjustments as needed
11. Apply the modification and take a final screenshot and save to `/analysis/example.com/final.png`
12. Create a comparison showing original vs heatmap vs final positioning and save to `/analysis/example.com/comparison.png`
13. Generate HTML report with split layout: images/heatmaps on left panel, analysis text and recommendations on right panel
```

## Advanced Template - Multiple Elements with Heatmap:

```
@generate_test.prompt.md

**Website**: https://landing.example.com
**Target Elements**:
- Primary headline
- Hero image
- CTA button
- Social proof section
**Desired Modification**: Reorganize page layout based on heatmap attention patterns
**Heatmap**: [Attach predictive heatmap]
**Goal**: Restructure page hierarchy to match predicted user attention flow

**Steps**:
1. Go to https://landing.example.com
2. Replace existing report if found at `/analysis/landing.example.com/`
3. Create/recreate directory `/analysis/landing.example.com/`
4. Take full-page screenshot and save to `/analysis/landing.example.com/original.png`
5. Overlay heatmap with 60% opacity and save to `/analysis/landing.example.com/heatmap-overlay.png`
6. Identify all target elements and their current positions
7. Map each element's current position against heatmap attention areas
8. Create a priority ranking based on heatmap intensity:
   - Highest attention area: [most important element]
   - Second highest: [second most important]
   - etc.
9. Generate JavaScript functions to:
   - Reposition elements according to attention hierarchy
   - Adjust sizes based on attention area size
   - Modify colors/contrast for low-attention elements
10. Apply all modifications and take final screenshot and save to `/analysis/landing.example.com/final.png`
11. Create a side-by-side comparison image showing before/after with heatmap reference and save to `/analysis/landing.example.com/comparison.png`
12. Generate HTML report with two-column layout: visual content (screenshots, heatmaps, comparisons) on left, detailed analysis and optimization recommendations on right
```

## Template for Heatmap-Driven Color/Contrast Changes:

```
@generate_test.prompt.md

**Website**: https://shop.example.com/product/123
**Target Element**: Product images and pricing information
**Desired Modification**: Adjust visual prominence based on heatmap data
**Heatmap**: [Attach eye-tracking or attention heatmap]
**Strategy**: Make high-attention areas more prominent, reduce visual noise in low-attention areas

**Steps**:
1. Go to https://shop.example.com/product/123
2. Replace any existing report at `/analysis/shop.example.com/`
3. Create/recreate directory `/analysis/shop.example.com/`
4. Capture original screenshot and save to `/analysis/shop.example.com/original.png`
5. Overlay heatmap at 70% opacity and save to `/analysis/shop.example.com/heatmap-overlay.png`
6. Identify which elements fall in:
   - High attention zones (red/orange in heatmap)
   - Medium attention zones (yellow/green)
   - Low attention zones (blue/cold areas)
7. Generate JavaScript to:
   - Increase contrast/saturation for high-attention elements
   - Add subtle highlighting or borders to medium-attention areas
   - Reduce opacity or desaturate low-attention elements
   - Adjust font weights based on attention levels
8. Apply changes and screenshot and save to `/analysis/shop.example.com/optimized.png`
9. Create a 3-panel comparison: original | heatmap | optimized and save to `/analysis/shop.example.com/comparison.png`
10. Generate HTML report with split-screen layout: all visual assets (heatmaps, screenshots, comparisons) displayed on left side, comprehensive analysis report and actionable insights on right side
```

## Key Instructions for Heatmap Integration:

### File Handling:

- Save all files in a structured directory: `/analysis/{url}/`
- **Report Replacement**: Always check if a report directory exists for the URL. If found, completely remove and recreate it to replace the old report
- Use consistent naming conventions: `original.png`, `heatmap.png`, `heatmap-overlay.png`, `final.png`, `comparison.png`
- Create comparison images automatically to show the optimization process

### HTML Report Layout Requirements:

- **Two-Column Layout**: Create HTML page with CSS grid or flexbox
- **Left Panel (40% width)**: Display all visual content
  - Original screenshot
  - Heatmap overlay
  - Modified/final screenshot
  - Comparison images
  - Interactive heatmap viewer if applicable
- **Right Panel (60% width)**: Display text content and analysis
  - Executive summary
  - Detailed analysis
  - Optimization recommendations
  - Metrics and expected improvements
  - Implementation notes
- **Responsive Design**: Ensure layout works on different screen sizes
- **Navigation**: Add anchor links between sections for easy navigation

### URL Processing:

- Extract domain from URL and sanitize for directory names
- Handle subdirectories and querystring parameters appropriately
- Create nested directory structure that mirrors the URL path when needed
- **Duplicate Handling**: Before creating new analysis, check if URL has been analyzed before and replace existing reports

### Heatmap Overlay Specifications:

- Use 60-70% opacity for heatmap overlays (maintains readability)
- Auto-generate predictive heatmap if one is not provided by the user
- Ensure proper alignment of heatmap with the page elements
- Save both the individual screenshot and the overlay combination

### Analysis Integration:

- Reference specific heatmap zones when describing modifications
- Explain the reasoning: "Moving CTA to red zone because it shows 40% higher attention"
- Consider heatmap data in your modification strategy

### Documentation Output:

- Always provide before/after visual documentation in the left panel
- Include the heatmap reference in your analysis in the right panel
- Create summary images showing the optimization rationale
- **No Unit Tests**: Focus on visual analysis and user experience optimization only
- Generate actionable recommendations rather than test code
