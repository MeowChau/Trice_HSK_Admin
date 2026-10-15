#!/usr/bin/env python3
"""Pull a complete tested release from GHCR; no inbound CI connection needed."""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

try:
    import fcntl
except ImportError:  # Unit tests also run on Windows; the updater runs on Linux.
    fcntl = None

ASSETS = ("compose.yaml", "compose.tunnel.yaml", "compose.release.yaml", "nginx.conf", "nginx.tunnel.conf")
MIGRATION_CHECK = """
const {AppDataSource: db} = require('./dist/database/data-source.js');
(async () => {
  db.setOptions({synchronize:false,dropSchema:false,migrationsRun:false,logging:false});
  await db.initialize();
  try { console.log(await db.showMigrations() ? 'CD_MIGRATIONS_PENDING' : 'CD_MIGRATIONS_CLEAR'); }
  finally { await db.destroy(); }
})().catch(() => { console.error('CD_MIGRATION_CHECK_FAILED'); process.exitCode=1; });
"""


def validate_manifest(manifest: dict, registry: str) -> None:
    if not re.fullmatch(r"ghcr\.io/[a-z0-9-]+/[a-z0-9._-]+", registry):
        raise ValueError("Invalid GHCR repository namespace")
    if not isinstance(manifest, dict) or type(manifest.get("schemaVersion")) is not int or manifest["schemaVersion"] != 1:
        raise ValueError("Unsupported release manifest")
    if not isinstance(manifest.get("revision"), str) or not re.fullmatch(r"[a-f0-9]{40}", manifest["revision"]):
        raise ValueError("Invalid release revision")
    for key, suffix in (("apiImage", "api"), ("adminImage", "admin")):
        if not re.fullmatch(re.escape(f"{registry}-{suffix}@sha256:") + r"[a-f0-9]{64}", str(manifest.get(key, ""))):
            raise ValueError(f"Invalid immutable image reference: {key}")


def validate_bundle(directory: Path, registry: str) -> dict:
    expected = set(ASSETS) | {"release.json"}
    if {entry.name for entry in directory.iterdir()} != expected:
        raise ValueError("Release bundle has unexpected or missing files")
    for name in expected:
        item = directory / name
        if item.is_symlink() or not item.is_file() or item.stat().st_size > 1_000_000:
            raise ValueError(f"Invalid release file: {name}")
    manifest = json.loads((directory / "release.json").read_text(encoding="utf-8"))
    validate_manifest(manifest, registry)
    return manifest


def atomic_write(path: Path, data: bytes, mode: int = 0o600) -> None:
    temporary = path.with_name(f"{path.name}.tmp-{uuid.uuid4().hex}")
    try:
        temporary.write_bytes(data)
        temporary.chmod(mode)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def write_json(path: Path, value: dict) -> None:
    atomic_write(path, (json.dumps(value, indent=2) + "\n").encode())


class CommandFailure(RuntimeError):
    def __init__(self, command: list[str], code: int):
        super().__init__(f"{' '.join(command[:2])} failed (exit {code})")


class Runner:
    def run(self, command: list[str], output=None) -> str:
        result = subprocess.run(command, check=False, stdout=output if output is not None else subprocess.PIPE,
                                stderr=subprocess.PIPE, text=output is None)
        if result.returncode:
            # Do not print raw output: config and database commands may include secrets.
            raise CommandFailure(command, result.returncode)
        return result.stdout or ""


@dataclass(frozen=True)
class Settings:
    directory: Path
    registry: str
    tunnel: bool = True

    @classmethod
    def load(cls, path: Path):
        value = json.loads(path.read_text(encoding="utf-8"))
        directory = Path(value["directory"]).resolve(strict=True)
        if not (directory / ".env").is_file() or type(value.get("tunnel")) is not bool:
            raise ValueError("Invalid deployment configuration")
        if "," in str(directory):
            raise ValueError("Deployment path cannot contain a comma")
        settings = cls(directory, value["registry"], value["tunnel"])
        validate_manifest({"schemaVersion": 1, "revision": "0" * 40,
                           "apiImage": settings.registry + "-api@sha256:" + "0" * 64,
                           "adminImage": settings.registry + "-admin@sha256:" + "0" * 64}, settings.registry)
        return settings


class Deployer:
    def __init__(self, settings: Settings, runner=None):
        self.settings = settings
        self.root = settings.directory
        self.state = self.root / ".ci"
        if self.state.is_symlink():
            raise ValueError("Deployment state cannot be a symlink")
        self.state.mkdir(mode=0o700, exist_ok=True)
        self.state.chmod(0o700)
        self.runner = runner or Runner()

    def compose(self, directory=None, images=None) -> list[str]:
        directory = directory or self.root
        images = images or self.state / "active-images.env"
        command = ["docker", "compose", "--project-directory", str(self.root), "--env-file", str(self.root / ".env")]
        if images.is_file():
            command += ["--env-file", str(images)]
        command += ["-f", str(directory / "compose.yaml")]
        if self.settings.tunnel:
            command += ["-f", str(directory / "compose.tunnel.yaml")]
        if images.is_file():
            command += ["-f", str(directory / "compose.release.yaml")]
        return command

    def read_state(self, name: str) -> dict:
        path = self.state / name
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def inspect(self, reference: str) -> dict:
        return json.loads(self.runner.run(["docker", "inspect", reference]))[0]

    def inventory(self) -> dict:
        result = {}
        for service in ("api", "admin", "web", "postgres"):
            ids = self.runner.run(self.compose() + ["ps", "-a", "-q", service]).split()
            if len(ids) != 1:
                raise RuntimeError(f"Expected one existing {service} container")
            result[service] = self.inspect(ids[0])
        return result

    def extract(self, marker: str) -> Path:
        directory = self.state / f"candidate-{uuid.uuid4().hex}"
        directory.mkdir(mode=0o700)
        container = self.runner.run(["docker", "create", marker]).strip()
        try:
            self.runner.run(["docker", "cp", f"{container}:/release/.", str(directory)])
        finally:
            self.runner.run(["docker", "rm", container])
        return directory

    @staticmethod
    def image_env(manifest: dict, web: str) -> bytes:
        return (f"TRICEHSK_API_IMAGE={manifest['apiImage']}\n"
                f"TRICEHSK_ADMIN_IMAGE={manifest['adminImage']}\nTRICEHSK_WEB_IMAGE={web}\n").encode()

    def prepare(self, directory: Path, manifest: dict, inventory: dict) -> tuple[Path, bool, dict]:
        self.runner.run(["docker", "pull", manifest["apiImage"]])
        self.runner.run(["docker", "pull", manifest["adminImage"]])
        for key in ("apiImage", "adminImage"):
            labels = self.inspect(manifest[key]).get("Config", {}).get("Labels") or {}
            if labels.get("org.opencontainers.image.revision") != manifest["revision"]:
                raise ValueError("Application images do not match the release revision")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
        old_refs = {}
        for service in ("api", "admin", "web"):
            tag = f"tricehsk-{service}:ci-rollback-{stamp}"
            self.runner.run(["docker", "image", "tag", inventory[service]["Image"], tag])
            old_refs[service] = tag
        images = directory / "images.env"
        atomic_write(images, self.image_env(manifest, old_refs["web"]))
        staged = self.compose(directory, images)
        self.runner.run(staged + ["config", "--quiet"])
        config = json.loads(self.runner.run(staged + ["config", "--format", "json"]))
        if config.get("name") != "tricehsk":
            raise ValueError("Compose project name must stay tricehsk")
        mounts = {item["Destination"]: item.get("Name") for item in inventory["api"].get("Mounts", [])}
        if config["volumes"]["uploads"]["name"] != mounts.get("/app/files"):
            raise ValueError("Release would change the upload volume")
        active_env = dict(item.split("=", 1) for item in inventory["api"]["Config"]["Env"])
        target_env = config["services"]["api"]["environment"]
        connection_keys = ("DATABASE_NAME", "DATABASE_HOST", "DATABASE_PORT", "DATABASE_USERNAME", "DATABASE_TYPE")
        if (any(active_env.get(key) != target_env.get(key) for key in connection_keys)
                or active_env.get("DATABASE_URL") or target_env.get("DATABASE_URL")):
            raise ValueError("Automatic deployment cannot change the database connection")
        nginx = directory / ("nginx.tunnel.conf" if self.settings.tunnel else "nginx.conf")
        self.runner.run(["docker", "run", "--rm", "--network", "none", "--add-host", "api:127.0.0.1",
                         "--add-host", "admin:127.0.0.1", "--mount", f"type=bind,source={nginx},target=/etc/nginx/conf.d/default.conf,readonly",
                         "--entrypoint", "nginx", old_refs["web"], "-t"])
        result = self.runner.run(staged + ["run", "--rm", "--no-deps", "-T", "--pull", "never", "api", "node", "-e", MIGRATION_CHECK])
        if result.strip().splitlines()[-1:] == ["CD_MIGRATIONS_PENDING"]:
            pending = True
        elif result.strip().splitlines()[-1:] == ["CD_MIGRATIONS_CLEAR"]:
            pending = False
        else:
            raise RuntimeError("Cannot confirm database migration state")
        return images, pending, old_refs

    def backup(self, inventory: dict, stamp: str) -> Path:
        directory = self.state / "backups" / stamp
        directory.mkdir(parents=True, mode=0o700)
        for name in (*ASSETS, ".env", "cloudflare.env"):
            source = self.root / name
            if source.is_file():
                shutil.copyfile(source, directory / name)
                (directory / name).chmod(0o600)
        api_env = dict(item.split("=", 1) for item in inventory["api"]["Config"]["Env"])
        pg_env = dict(item.split("=", 1) for item in inventory["postgres"]["Config"]["Env"])
        if api_env.get("DATABASE_URL"):
            raise ValueError("External DATABASE_URL needs a separate backup procedure")
        with (directory / "database.dump").open("wb") as output:
            self.runner.run(["docker", "exec", inventory["postgres"]["Id"], "pg_dump", "-U", pg_env["POSTGRES_USER"],
                             "-d", api_env["DATABASE_NAME"], "-Fc", "--no-owner", "--no-acl"], output=output)
        with (directory / "uploads.tar.gz").open("wb") as output:
            self.runner.run(["docker", "run", "--rm", "--network", "none", "--user", "0", "--volumes-from",
                             inventory["api"]["Id"] + ":ro", "--entrypoint", "tar", inventory["api"]["Image"],
                             "-czf", "-", "-C", "/app/files", "."], output=output)
        return directory

    def health(self) -> None:
        probes = [("/health", "api.tricehsk.id.vn"), ("/signin", "admin.tricehsk.id.vn")]
        for route, host in probes:
            for attempt in range(30):
                try:
                    with urlopen(Request("http://127.0.0.1:8080" + route, headers={"Host": host}), timeout=5) as response:
                        body = response.read()
                        if response.status != 200:
                            raise RuntimeError("Unexpected origin response")
                        if route == "/health":
                            payload = json.loads(body)
                            if not isinstance(payload, dict) or payload.get("name") != "TriceHSK API":
                                raise RuntimeError("Unexpected API health response")
                        if route == "/signin" and b'type="submit"' not in body:
                            raise RuntimeError("Login form missing submit button")
                    break
                except (OSError, ValueError, RuntimeError):
                    if attempt == 29:
                        raise RuntimeError(f"Origin health check failed: {route}") from None
                    time.sleep(1)

    def activate(self, directory: Path, manifest: dict, images: Path, pending: bool, old_refs: dict, inventory: dict) -> None:
        previous = {name: (self.root / name).read_bytes() if (self.root / name).exists() else None for name in ASSETS}
        old_active = (self.state / "active-images.env").read_bytes() if (self.state / "active-images.env").exists() else None
        original = self.compose()
        migration_attempted = False
        try:
            self.runner.run(original + ["stop", "web", "api", "admin"])
            backup = self.backup(inventory, manifest["revision"] + "-" + uuid.uuid4().hex[:8])
            print(f"Backup saved: {backup}", flush=True)
            for name in ASSETS:
                atomic_write(self.root / name, (directory / name).read_bytes(), 0o644)
            atomic_write(self.state / "active-images.env", images.read_bytes())
            command = self.compose()
            if pending:
                migration_attempted = True
                self.runner.run(command + ["run", "--rm", "--no-deps", "-T", "--pull", "never", "api", "node",
                                           "node_modules/typeorm/cli.js", "-d", "dist/database/data-source.js", "migration:run", "--transaction", "all"])
            self.runner.run(command + ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--force-recreate", "--wait", "--wait-timeout", "120", "api", "admin"])
            self.runner.run(command + ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--force-recreate", "web"])
            self.health()
        except Exception:
            if migration_attempted:
                self.runner.run(self.compose() + ["stop", "web", "api", "admin"])
                print("Database migration was attempted. Automatic code rollback is disabled; use the saved backup for operator recovery.", file=sys.stderr)
            else:
                for name, contents in previous.items():
                    if contents is not None:
                        atomic_write(self.root / name, contents, 0o644)
                # The first deployment may start from local images without an overlay.
                if previous["compose.release.yaml"] is None:
                    atomic_write(self.root / "compose.release.yaml", (directory / "compose.release.yaml").read_bytes(), 0o644)
                if old_active is not None:
                    atomic_write(self.state / "active-images.env", old_active)
                else:
                    atomic_write(self.state / "active-images.env", self.image_env({"apiImage": old_refs["api"], "adminImage": old_refs["admin"]}, old_refs["web"]))
                command = self.compose()
                self.runner.run(command + ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--force-recreate", "--wait", "--wait-timeout", "120", "api", "admin"])
                self.runner.run(command + ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--force-recreate", "web"])
                self.health()
                print("Previous application images restored.", file=sys.stderr)
            raise

    def poll(self, allow_migrations=False, retry_failed=False) -> None:
        marker_ref = self.settings.registry + "-release:production"
        self.runner.run(["docker", "pull", marker_ref])
        marker = self.inspect(marker_ref)
        current = self.read_state("current.json")
        if current.get("marker") == marker["Id"]:
            return
        if not allow_migrations and self.read_state("pending.json").get("marker") == marker["Id"]:
            return
        if not retry_failed and self.read_state("failed.json").get("marker") == marker["Id"]:
            return
        docker_root = Path(self.runner.run(["docker", "info", "--format", "{{.DockerRootDir}}"]).strip())
        if shutil.disk_usage(docker_root).free < 2 * 1024 ** 3:
            raise RuntimeError("Less than 2 GiB free for Docker; deployment postponed")
        directory = self.extract(marker["Id"])
        manifest = validate_bundle(directory, self.settings.registry)
        if (marker.get("Config", {}).get("Labels") or {}).get("org.opencontainers.image.revision") != manifest["revision"]:
            raise ValueError("Release marker revision does not match its manifest")
        print(f"Preparing tested release {manifest['revision']}", flush=True)
        inventory = self.inventory()
        images, pending, old_refs = self.prepare(directory, manifest, inventory)
        if pending and not allow_migrations:
            write_json(self.state / "pending.json", {"marker": marker["Id"], "revision": manifest["revision"]})
            print("Migration approval required: review the migration, then run sudo tricehsk-deploy --allow-migrations", flush=True)
            return
        try:
            self.activate(directory, manifest, images, pending, old_refs, inventory)
        except Exception:
            write_json(self.state / "failed.json", {"marker": marker["Id"], "revision": manifest["revision"]})
            raise
        previous = {key: current[key] for key in ("marker", "revision", "deployedAt") if key in current}
        write_json(self.state / "current.json", {"marker": marker["Id"], "revision": manifest["revision"], "previous": previous,
                                                 "deployedAt": datetime.now(timezone.utc).isoformat()})
        (self.state / "pending.json").unlink(missing_ok=True)
        (self.state / "failed.json").unlink(missing_ok=True)
        print(f"DEPLOYMENT_OK: {manifest['revision']}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path("/etc/tricehsk-cd.json"))
    parser.add_argument("--allow-migrations", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--compose", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if fcntl is None or os.geteuid() != 0:
        raise RuntimeError("Run the VPS updater on Linux with sudo")
    deployer = Deployer(Settings.load(args.config))
    with (deployer.state / "deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Another deployment is running; try again later.")
            return 0
        if args.status:
            print(json.dumps({key: deployer.read_state(key + ".json") for key in ("current", "pending", "failed")}, indent=2))
        elif args.compose is not None:
            subprocess.run(deployer.compose() + args.compose, check=True)
        else:
            deployer.poll(args.allow_migrations, args.retry_failed)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"DEPLOYMENT_FAILED: {error}", file=sys.stderr)
        sys.exit(1)
