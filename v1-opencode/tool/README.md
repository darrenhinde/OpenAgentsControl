# Gemini Image Tools

This collection of tools allows you to edit and analyze images using Google's Gemini AI directly from OpenCode.

## Setup

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to your `.env` file:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

## Available Tools

### `/gemini` - Simple Image Editor
Edit an image using file path or data URL:

```bash
/gemini "path/to/image.png" "Add a red border around the image" "output.png"
/gemini "data:image/png;base64,AAA..." "Convert to black and white"
```

### `/gemini_multiple_edit` - Advanced Image Editor
Same functionality as `/gemini` but from the multiple tools file:

```bash
/gemini_multiple_edit "image.jpg" "Make it look like a watercolor painting" "watercolor.jpg"
```

### `/gemini_multiple_analyze` - Image Analysis
Analyze an image without editing it:

```bash
/gemini_multiple_analyze "screenshot.png" "What programming language is shown in this code?"
/gemini_multiple_analyze "photo.jpg" "Describe the objects and colors in this image"
```

### `/gemini_edit` - Auto-Detection Plugin
1. Paste an image directly into your OpenCode chat
2. Use the command with just the prompt:

```bash
/gemini_edit "Add the text 'Hello World' in cursive at top"
/gemini_edit "Make this image look like a painting"
```

## Features

- **File Path Support**: Pass local image file paths
- **Data URL Support**: Use base64 data URLs from pasted images
- **Auto-Detection**: Plugin automatically captures the latest pasted image
- **Image Analysis**: Ask questions about images without editing
- **Flexible Output**: Specify custom output filenames or use defaults
- **Error Handling**: Clear error messages for missing API keys or failed requests

## Files

- `gemini.ts` - Simple tool that accepts image arguments
- `gemini-multiple.ts` - Multiple tools (edit + analyze) in one file
- `../plugin/gemini-edit.ts` - Plugin with auto-detection of pasted images

## API Endpoints

- **Image Editing**: Uses Gemini 2.5 Flash with image preview capabilities
- **Image Analysis**: Uses Gemini 2.5 Flash for text-based analysis

## Examples

```bash
# Edit an image
/gemini "logo.png" "Add a subtle drop shadow" "logo-shadow.png"

# Analyze code in a screenshot
/gemini_multiple_analyze "code-screenshot.png" "What bugs can you spot in this code?"

# Auto-edit pasted image
# (paste image first, then run:)
/gemini_edit "Remove the background and make it transparent"
```