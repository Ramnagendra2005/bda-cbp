#!/usr/bin/env bash
# ChurnSight — start the dashboard at http://localhost:5050
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"

if [ ! -f "$VENV_DIR/bin/python3" ]; then
    echo "Environment not set up. Running setup first..."
    bash "$PROJECT_DIR/setup_environment.sh"
fi

source "$VENV_DIR/bin/activate"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(which java)")")")}"
export SPARK_LOCAL_IP=127.0.0.1

python3 -u "$PROJECT_DIR/dashboard/app.py"
