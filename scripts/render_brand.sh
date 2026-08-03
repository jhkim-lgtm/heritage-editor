#!/usr/bin/env bash
# 브랜드 8장 카드 PNG 일괄 렌더 (2160×2700) — 발행 파이프라인 1단계
# 사용법: scripts/render_brand.sh "Hermès" [시리즈 A|B|C] [출력폴더]
set -euo pipefail
BRAND="${1:?사용법: render_brand.sh <브랜드명> [A|B|C] [출력폴더]}"
SERIES="${2:-A}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${3:-$DIR/published/$BRAND}"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
case "$SERIES" in
  A) KEYS=(cover heroshot product founder quote heritage behind closing);;
  B) KEYS=(cover heritage product heroshot behind quote founder closing);;
  C) KEYS=(cover quote heroshot heritage founder behind product closing);;
  *) echo "시리즈는 A/B/C"; exit 1;;
esac
ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$BRAND")
mkdir -p "$OUT"
i=0
for K in "${KEYS[@]}"; do
  i=$((i+1))
  "$CH" --headless=new --disable-gpu --force-device-scale-factor=2 \
    --window-size=1080,1350 --virtual-time-budget=15000 \
    --screenshot="$OUT/$(printf '%02d' "$i")_$K.png" \
    "file://$DIR/index.html?solo=$ENC&card=$K&series=$SERIES" 2>/dev/null
done
echo "완료: $OUT"
ls -la "$OUT"
