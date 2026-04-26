"""
nyaya_ai/api_service.py
=======================
Flask micro-service that exposes the Nyaya AI pipeline over HTTP.

The Node.js backend calls this service via REST endpoints.

Endpoints
---------
  POST  /analyze
        Body: { "dataset": "biased|fair", "mitigation": "reweighting|smote" }
        Returns: full JSON report (metrics before/after, insights, comparison)

  GET   /health
        Returns: { "status": "ok" }

Run locally
-----------
  pip install flask
  python -m nyaya_ai.api_service           # starts on port 5001
"""

from __future__ import annotations

import os
import sys
import json
import traceback

# Ensure the ml/ directory is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, request, jsonify
from nyaya_ai.pipeline import run_pipeline
from nyaya_ai.explainer import generate_plain_english_insights

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "Nyaya AI"})


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Run the full fairness pipeline and return JSON results.

    Expected JSON body:
    {
        "dataset":    "biased" | "fair"          (required)
        "mitigation": "reweighting" | "smote"    (optional, default: reweighting)
    }
    """
    try:
        body       = request.get_json(force=True) or {}
        dataset    = body.get("dataset",    "biased")
        mitigation = body.get("mitigation", "reweighting")

        # Run pipeline (returns dicts, models – we strip non-serialisable items)
        result = run_pipeline(
            dataset_key=dataset,
            mitigation=mitigation,
        )

        # Build a serialisable response
        before = result["before_metrics"]
        after  = result["after_metrics"]

        response = {
            "dataset":    dataset,
            "mitigation": mitigation,

            "before": {
                "selection_rates":  before["selection_rates"],
                "disparate_impact": before["disparate_impact"],
                "fairness_score":   before["fairness_score"],
                "bias_exists":      before["bias_exists"],
                "verdict":          before["verdict"],
                "disadvantaged":    before["disadvantaged"],
                "privileged":       before["privileged_group"],
                "insights": generate_plain_english_insights(
                    before, dataset_label=f"'{dataset}' dataset (baseline)"
                ),
            },

            "after": {
                "selection_rates":  after["selection_rates"],
                "disparate_impact": after["disparate_impact"],
                "fairness_score":   after["fairness_score"],
                "bias_exists":      after["bias_exists"],
                "verdict":          after["verdict"],
                "disadvantaged":    after["disadvantaged"],
                "privileged":       after["privileged_group"],
                "insights": generate_plain_english_insights(
                    after, dataset_label="mitigated model"
                ),
            },

            "comparison": {
                "di_delta": round(
                    after["disparate_impact"] - before["disparate_impact"], 4
                ),
                "fs_delta": after["fairness_score"] - before["fairness_score"],
                "improved": after["fairness_score"] > before["fairness_score"],
            },
        }

        return jsonify(response), 200

    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


if __name__ == "__main__":
    port = int(os.environ.get("NYAYA_PORT", 5001))
    print(f"[Nyaya AI] Starting Flask service on port {port} …")
    app.run(host="0.0.0.0", port=port, debug=False)
