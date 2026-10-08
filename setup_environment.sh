#!/usr/bin/env bash
# ============================================================
# ChurnSight — Environment Setup Script
# Sets up PySpark local environment for the Big Data project
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"

echo "============================================================"
echo "  ChurnSight — Environment Setup"
echo "============================================================"

# 1. Check Java
echo ""
echo "[1/4] Checking Java..."
if ! command -v java &>/dev/null; then
    echo "  Java not found. Installing OpenJDK 11..."
    sudo apt-get update -qq && sudo apt-get install -y openjdk-11-jdk-headless
else
    java -version
    echo "  Java found"
fi

export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
echo "  JAVA_HOME=$JAVA_HOME"

# 2. Python venv
echo ""
echo "[2/4] Setting up Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo "  Created venv at $VENV_DIR"
else
    echo "  Venv already exists at $VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

# 3. Install packages
echo ""
echo "[3/4] Installing Python packages..."
pip install --quiet --upgrade pip
pip install --quiet -r "$PROJECT_DIR/requirements.txt"
echo "  pyspark, flask, jupyter installed"

# 4. Jupyter kernel
echo ""
echo "[4/4] Installing Jupyter kernel..."
python3 -m ipykernel install --user --name churnsight --display-name "Python (ChurnSight)" 2>/dev/null
echo "  Kernel 'Python (ChurnSight)' installed"

# Export vars for current session
export SPARK_LOCAL_IP=127.0.0.1
export PYSPARK_PYTHON="$VENV_DIR/bin/python3"

echo ""
echo "============================================================"
echo "  Setup complete!"
echo ""
echo "  1. Run the pipeline:    bash run_all.sh"
echo "  2. Start the dashboard:  bash run_dashboard.sh  ->  http://localhost:5050"
echo ""
echo "  Notebook (optional):    source .venv/bin/activate && jupyter notebook"
echo "============================================================"
