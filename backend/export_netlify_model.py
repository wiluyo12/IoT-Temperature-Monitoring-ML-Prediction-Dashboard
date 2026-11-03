"""Export the trained sklearn forest for inference in Netlify's Node runtime.

Run after training, with the same Python dependencies used for training.
The exported artifact is immutable model data, not application storage.
"""
import json
from pathlib import Path

import joblib


def main():
    root = Path(__file__).resolve().parents[1]
    forest = joblib.load(root / "model/rf_temp_model.joblib")
    trees = []
    for estimator in forest.estimators_:
        tree = estimator.tree_
        trees.append({
            "left": tree.children_left.tolist(),
            "right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": tree.threshold.tolist(),
            "value": tree.value[:, 0, 0].tolist(),
        })
    artifact = {"features": forest.feature_names_in_.tolist(), "trees": trees}
    destination = root / "model/rf_netlify.json"
    destination.write_text(json.dumps(artifact, separators=(",", ":")))
    print(f"Exported {len(trees)} trained trees to {destination.name}")


if __name__ == "__main__":
    main()
