"""
ChurnSight — dashboard server.

Serves the dashboard page and a JSON API. The numbers come from the Spark
pipeline's summary (output/dashboard_data.json). If that file does not exist
yet, Spark computes it in the background on first start.
"""

import json
import os
import sys
import threading

from flask import Flask, jsonify, render_template

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import analytics  # noqa: E402

app = Flask(__name__, template_folder="templates", static_folder="static")
# Always pick up edits to the template and static files without a stale cache.
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

_state = {"status": "loading", "data": None, "message": ""}
_lock = threading.Lock()


def _compute():
    print("Running Spark analytics (first run takes ~30 seconds)...")
    try:
        data = analytics.compute_summary()
        with _lock:
            _state.update(status="ready", data=data, message="")
        print("Analytics ready.")
    except Exception as e:  # surface the reason in the UI instead of hanging
        with _lock:
            _state.update(status="error", data=None, message=str(e))
        print(f"Analytics failed: {e}")


def _start():
    if os.path.exists(analytics.SUMMARY_JSON):
        with open(analytics.SUMMARY_JSON) as f:
            _state.update(status="ready", data=json.load(f))
        print(f"Loaded pipeline results from {analytics.SUMMARY_JSON}")
    else:
        threading.Thread(target=_compute, daemon=True).start()


@app.route("/")
def index():
    static_dir = os.path.join(app.root_path, "static")
    version = int(max(os.path.getmtime(os.path.join(static_dir, f)) for f in ("style.css", "app.js")))
    return render_template("index.html", project=analytics.PROJECT_NAME, v=version)


@app.route("/api/data")
def data():
    with _lock:
        if _state["status"] == "ready":
            return jsonify(_state["data"])
        code = 202 if _state["status"] == "loading" else 500
        return jsonify({"status": _state["status"], "message": _state["message"]}), code


@app.route("/api/refresh", methods=["POST"])
def refresh():
    with _lock:
        if _state["status"] == "loading":
            return jsonify({"status": "loading"}), 202
        _state.update(status="loading", data=None, message="")
    threading.Thread(target=_compute, daemon=True).start()
    return jsonify({"status": "loading"})


_start()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    print(f"{analytics.PROJECT_NAME} dashboard: http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
