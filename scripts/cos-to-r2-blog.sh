#!/usr/bin/env bash
set -euo pipefail

# Fill in this block before running.
# Keep this file private if you put real credentials here.
COS_SECRET_ID="${COS_SECRET_ID:-}"
COS_SECRET_KEY="${COS_SECRET_KEY:-}"
COS_BUCKET="blgo-1258469251"
COS_REGION="${COS_REGION:-ap-shanghai}"
COS_PREFIX="${COS_PREFIX:-}"

R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET="${R2_BUCKET:-blog}"
R2_PREFIX="${R2_PREFIX:-blog}"

# Optional knobs.
RCLONE_BIN="${RCLONE_BIN:-rclone}"
TRANSFERS="${TRANSFERS:-8}"
CHECKERS="${CHECKERS:-16}"
FORCE_OVERWRITE="${FORCE_OVERWRITE:-0}"

usage() {
	cat <<'EOF'
Usage:
  scripts/cos-to-r2-blog.sh --dry-run   # preview only, default
  scripts/cos-to-r2-blog.sh --run       # copy COS objects into R2 blog/blog/

Required values:
  COS_SECRET_ID
  COS_SECRET_KEY
  COS_BUCKET
  COS_REGION
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY

Optional values:
  COS_PREFIX          Source prefix in COS. Empty means whole bucket.
  R2_BUCKET           Target R2 bucket. Default: blog
  R2_PREFIX           Target prefix in R2. Default: blog
  FORCE_OVERWRITE=1   Re-upload same-name objects even when rclone thinks unchanged.

Example:
  COS_BUCKET=my-cos-bucket-1250000000 \
  COS_REGION=ap-shanghai \
  COS_PREFIX=images \
  R2_ACCOUNT_ID=xxxx \
  R2_ACCESS_KEY_ID=xxxx \
  R2_SECRET_ACCESS_KEY=xxxx \
  scripts/cos-to-r2-blog.sh --dry-run
EOF
}

mode="${1:---dry-run}"
case "$mode" in
--dry-run | --run) ;;
-h | --help)
	usage
	exit 0
	;;
*)
	usage
	exit 2
	;;
esac

require_value() {
	local name="$1"
	local value="${!name:-}"
	if [[ -z "$value" ]]; then
		echo "Missing required value: $name" >&2
		exit 1
	fi
}

for name in \
	COS_SECRET_ID \
	COS_SECRET_KEY \
	COS_BUCKET \
	COS_REGION \
	R2_ACCOUNT_ID \
	R2_ACCESS_KEY_ID \
	R2_SECRET_ACCESS_KEY; do
	require_value "$name"
done

if ! command -v "$RCLONE_BIN" >/dev/null 2>&1; then
	echo "rclone is not installed or not in PATH." >&2
	echo "Install it first: brew install rclone" >&2
	exit 1
fi

trim_slashes() {
	local value="$1"
	value="${value#/}"
	value="${value%/}"
	printf '%s' "$value"
}

COS_PREFIX="$(trim_slashes "$COS_PREFIX")"
R2_PREFIX="$(trim_slashes "$R2_PREFIX")"

source_path="cos:${COS_BUCKET}"
target_path="r2:${R2_BUCKET}"

if [[ -n "$COS_PREFIX" ]]; then
	source_path="${source_path}/${COS_PREFIX}"
fi

if [[ -n "$R2_PREFIX" ]]; then
	target_path="${target_path}/${R2_PREFIX}"
fi

tmp_config="$(mktemp -t rclone-cos-r2.XXXXXX.conf)"
trap 'rm -f "$tmp_config"' EXIT

"$RCLONE_BIN" --config "$tmp_config" config create cos s3 \
	provider TencentCOS \
	access_key_id "$COS_SECRET_ID" \
	secret_access_key "$COS_SECRET_KEY" \
	endpoint "cos.${COS_REGION}.myqcloud.com" \
	>/dev/null

"$RCLONE_BIN" --config "$tmp_config" config create r2 s3 \
	provider Cloudflare \
	access_key_id "$R2_ACCESS_KEY_ID" \
	secret_access_key "$R2_SECRET_ACCESS_KEY" \
	endpoint "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
	acl private \
	>/dev/null

copy_args=(
	copy
	"$source_path"
	"$target_path"
	--progress
	--transfers "$TRANSFERS"
	--checkers "$CHECKERS"
	--s3-no-check-bucket
)

if [[ "$FORCE_OVERWRITE" == "1" ]]; then
	copy_args+=(--ignore-times)
fi

if [[ "$mode" == "--dry-run" ]]; then
	copy_args+=(--dry-run)
	echo "Dry run: $source_path -> $target_path"
else
	echo "Copying: $source_path -> $target_path"
	echo "Same-name objects in R2 may be overwritten when source differs."
fi

"$RCLONE_BIN" --config "$tmp_config" "${copy_args[@]}"
