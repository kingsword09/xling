#!/bin/bash
# Build xling-expert skill package for Claude Code

set -e

SKILL_NAME="xling-expert"
SKILL_DIR="$SKILL_NAME"
OUTPUT_FILE="${SKILL_NAME}.zip"

echo "Building ${SKILL_NAME} skill package..."

# Check if skill directory exists
if [ ! -d "$SKILL_DIR" ]; then
    echo "Error: Skill directory '$SKILL_DIR' not found"
    exit 1
fi

# Check if Skill.md exists
if [ ! -f "$SKILL_DIR/Skill.md" ]; then
    echo "Error: Skill.md not found in '$SKILL_DIR'"
    exit 1
fi

# Remove old zip if exists
if [ -f "$OUTPUT_FILE" ]; then
    echo "Removing old $OUTPUT_FILE..."
    rm "$OUTPUT_FILE"
fi

# Create zip with correct structure
echo "Creating $OUTPUT_FILE..."
zip -r "$OUTPUT_FILE" "$SKILL_DIR" -x "*.DS_Store" -x "__MACOSX/*"

# Verify zip structure
echo ""
echo "Verifying zip structure..."
unzip -l "$OUTPUT_FILE" | head -10

echo ""
echo "✅ Skill package created: $OUTPUT_FILE"
echo ""
echo "To install:"
echo "1. Open Claude Code"
echo "2. Click Skills icon in sidebar"
echo "3. Click 'Add Skill'"
echo "4. Select $OUTPUT_FILE"
echo "5. Enable the skill"
