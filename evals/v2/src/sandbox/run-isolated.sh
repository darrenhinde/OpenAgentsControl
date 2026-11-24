#!/usr/bin/env bash
# run-isolated.sh: the one door every coding-agent run in the local suite goes through.
#
#   run-isolated.sh <profile.sb> <workdir> <real_home> <repo_deny> <main_deny> <svc_port> \
#       -- NAME=value ... -- <cmd> [args...]
#
# Layers (07-test-suite-plan.md §4.2):
#   (a) `env -i` with only the NAME=value pairs given (built by env.ts: throwaway HOME/XDG,
#       dummy API key, base URL pointing at the local fake model), cwd = <workdir>.
#   (b) macOS sandbox-exec with <profile.sb>, when available. OAC_SANDBOX=iso skips (b);
#       the caller records that, and the post-run checks still run.
set -u
if [ "$#" -lt 8 ]; then
  echo "usage: run-isolated.sh <profile> <workdir> <real_home> <repo_deny> <main_deny> <svc_port> -- ENV... -- cmd..." >&2
  exit 2
fi
profile="$1"; workdir="$2"; real_home="$3"; repo_deny="$4"; main_deny="$5"; svc_port="$6"
shift 6
if [ "$1" != "--" ]; then echo "run-isolated.sh: expected -- before env" >&2; exit 2; fi
shift
assignments=()
while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
  assignments+=("$1")
  shift
done
if [ "$#" -eq 0 ]; then echo "run-isolated.sh: expected -- before cmd" >&2; exit 2; fi
shift
cd "${workdir}" || { echo "run-isolated.sh: cannot cd to ${workdir}" >&2; exit 2; }

if [ "${OAC_SANDBOX:-seatbelt}" = "seatbelt" ]; then
  exec /usr/bin/sandbox-exec -f "${profile}" \
    -D REAL_HOME="${real_home}" -D REPO_DENY="${repo_deny}" -D MAIN_DENY="${main_deny}" -D SVC_PORT="${svc_port}" \
    /usr/bin/env -i "${assignments[@]}" "$@"
fi
exec /usr/bin/env -i "${assignments[@]}" "$@"
