#!/bin/bash
# generate_sample.sh - Generate 10-frame sample dataset for demo and testing
#
# Generates full (100k) and fallback (50k) tiers for 3 representative sequences,
# validates output, and places results in web app assets directory.
#
# Usage:
#   cd /home/josh/Code/AGILE3D-Demo
#   bash tools/converter/generate_sample.sh

set -e

# Paths
REPO_ROOT="/home/josh/Code/AGILE3D-Demo"
CONVERTER_DIR="$REPO_ROOT/tools/converter"
GT_PKL_DIR="/home/josh/Code/adaptive-3d-openpcdet/output"
BRANCHES_JSON="$REPO_ROOT/src/assets/data/branches.json"
ASSETS_DIR="$REPO_ROOT/apps/web/src/assets/data/streams"
TMP_DIR="/tmp/converter_sample_$$"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Sequences to generate (seq_id, gt_pkl_filename)
declare -a SEQUENCES=(
    "v_1784:v_1784-1982.pkl"
    "p_7513:p_7513-7711.pkl"
    "c_7910:c_7910-8108.pkl"
)

FRAMES_PER_SAMPLE=10
FRAME_RANGE="0:$((FRAMES_PER_SAMPLE - 1))"

# Cleanup function
cleanup() {
    if [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
}

trap cleanup EXIT

# Verify prerequisites
echo "Verifying prerequisites..."

if [ ! -f "$BRANCHES_JSON" ]; then
    echo -e "${RED}ERROR: Branches JSON not found: $BRANCHES_JSON${NC}"
    exit 1
fi

if [ ! -d "$GT_PKL_DIR" ]; then
    echo -e "${RED}ERROR: GT PKL directory not found: $GT_PKL_DIR${NC}"
    exit 1
fi

if [ ! -f "$CONVERTER_DIR/pkl2web.py" ]; then
    echo -e "${RED}ERROR: pkl2web.py not found: $CONVERTER_DIR/pkl2web.py${NC}"
    exit 1
fi

if [ ! -f "$CONVERTER_DIR/validators/validators.py" ]; then
    echo -e "${RED}ERROR: validators.py not found: $CONVERTER_DIR/validators/validators.py${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites verified${NC}"

# Create output directories
mkdir -p "$ASSETS_DIR"
mkdir -p "$TMP_DIR"

echo "Output directory: $ASSETS_DIR"
echo "Temp directory: $TMP_DIR"

# Process each sequence
FAILED=0
SUCCESS=0

for seq_entry in "${SEQUENCES[@]}"; do
    IFS=: read -r seq_id gt_pkl_file <<< "$seq_entry"
    gt_pkl="$GT_PKL_DIR/$gt_pkl_file"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Processing sequence: $seq_id"
    echo "GT PKL: $gt_pkl"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Verify GT PKL exists
    if [ ! -f "$gt_pkl" ]; then
        echo -e "${YELLOW}WARNING: GT PKL not found: $gt_pkl${NC}"
        echo "Skipping sequence $seq_id"
        FAILED=$((FAILED + 1))
        continue
    fi

    # Create temp directories for this sequence
    FULL_TIER_TMP="$TMP_DIR/${seq_id}_full"
    FALLBACK_TIER_TMP="$TMP_DIR/${seq_id}_fallback"
    mkdir -p "$FULL_TIER_TMP"
    mkdir -p "$FALLBACK_TIER_TMP"

    # Generate full tier (100k)
    echo ""
    echo "Generating full tier (100k points)..."
    python3 "$CONVERTER_DIR/pkl2web.py" \
        --input-pkl "$gt_pkl" \
        --seq-id "$seq_id" \
        --frames "$FRAME_RANGE" \
        --downsample 100k \
        --quantize off \
        --branches "$BRANCHES_JSON" \
        --out-dir "$FULL_TIER_TMP" 2>&1 || {
        echo -e "${RED}ERROR: Failed to generate full tier for $seq_id${NC}"
        FAILED=$((FAILED + 1))
        continue
    }

    # Validate full tier
    echo "Validating full tier..."
    python3 "$CONVERTER_DIR/validators/validators.py" \
        "$FULL_TIER_TMP" \
        "$FULL_TIER_TMP/manifest.json" \
        "full" \
        "$FRAMES_PER_SAMPLE" 2>&1 || {
        echo -e "${RED}ERROR: Full tier validation failed for $seq_id${NC}"
        FAILED=$((FAILED + 1))
        continue
    }

    # Generate fallback tier (50k)
    echo ""
    echo "Generating fallback tier (50k points)..."
    python3 "$CONVERTER_DIR/pkl2web.py" \
        --input-pkl "$gt_pkl" \
        --seq-id "$seq_id" \
        --frames "$FRAME_RANGE" \
        --downsample 50k \
        --quantize off \
        --branches "$BRANCHES_JSON" \
        --out-dir "$FALLBACK_TIER_TMP" 2>&1 || {
        echo -e "${RED}ERROR: Failed to generate fallback tier for $seq_id${NC}"
        FAILED=$((FAILED + 1))
        continue
    }

    # Validate fallback tier
    echo "Validating fallback tier..."
    python3 "$CONVERTER_DIR/validators/validators.py" \
        "$FALLBACK_TIER_TMP" \
        "$FALLBACK_TIER_TMP/manifest.json" \
        "fallback" \
        "$FRAMES_PER_SAMPLE" 2>&1 || {
        echo -e "${RED}ERROR: Fallback tier validation failed for $seq_id${NC}"
        FAILED=$((FAILED + 1))
        continue
    }

    # Copy to assets directory
    SEQ_ASSETS_DIR="$ASSETS_DIR/$seq_id"
    mkdir -p "$SEQ_ASSETS_DIR/full"
    mkdir -p "$SEQ_ASSETS_DIR/fallback"

    echo ""
    echo "Copying to assets directory: $SEQ_ASSETS_DIR"

    # Copy full tier
    cp "$FULL_TIER_TMP/manifest.json" "$SEQ_ASSETS_DIR/manifest.json"
    cp -r "$FULL_TIER_TMP/frames" "$SEQ_ASSETS_DIR/full/"
    cp "$FULL_TIER_TMP"/*.json "$SEQ_ASSETS_DIR/full/" 2>/dev/null || true

    # Copy fallback tier (frames only, reuse manifest with tier annotation if needed)
    mkdir -p "$SEQ_ASSETS_DIR/fallback/frames"
    cp -r "$FALLBACK_TIER_TMP/frames" "$SEQ_ASSETS_DIR/fallback/" || true
    cp "$FALLBACK_TIER_TMP"/*.json "$SEQ_ASSETS_DIR/fallback/" 2>/dev/null || true

    echo -e "${GREEN}✓ Successfully processed sequence $seq_id${NC}"
    SUCCESS=$((SUCCESS + 1))
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Successful: $SUCCESS / ${#SEQUENCES[@]}"
echo "Failed: $FAILED / ${#SEQUENCES[@]}"
echo "Output directory: $ASSETS_DIR"

# List output structure
if [ -d "$ASSETS_DIR" ]; then
    echo ""
    echo "Output structure:"
    ls -lR "$ASSETS_DIR" | head -30
fi

# Exit code
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}FAILED: $FAILED sequence(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All sequences processed successfully${NC}"
    exit 0
fi
