"""Create the small registry bundle after both application images were pushed."""
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from deploy import ASSETS, validate_manifest


def make_release(source: Path, output: Path, manifest: dict, registry: str) -> None:
    validate_manifest(manifest, registry)
    output.mkdir(parents=True, exist_ok=False)
    for name in ASSETS:
        shutil.copyfile(source / name, output / name)
    (output / "release.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    make_release(root, root / "ci" / ".bundle", {
        "schemaVersion": 1,
        "revision": os.environ["REVISION"],
        "apiImage": os.environ["API_IMAGE"],
        "adminImage": os.environ["ADMIN_IMAGE"],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }, os.environ["REGISTRY_BASE"])
