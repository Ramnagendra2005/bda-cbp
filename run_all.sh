#!/usr/bin/env bash
# ChurnSight — run the full batch pipeline (then start the dashboard with run_dashboard.sh)
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

echo "Running ChurnSight Big Data Pipeline..."
python3 -u "$PROJECT_DIR/run_pipeline.py"
