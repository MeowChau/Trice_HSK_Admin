import importlib.util
import io
import json
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

CI = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CI))
from deploy import ASSETS, CommandFailure, Deployer, Settings, validate_bundle, validate_manifest, write_json

REGISTRY = 'ghcr.io/meowchau/trice_hsk_admin'
MANIFEST = {'schemaVersion': 1, 'revision': 'a' * 40,
            'apiImage': REGISTRY + '-api@sha256:' + '1' * 64,
            'adminImage': REGISTRY + '-admin@sha256:' + '2' * 64}


class FakeDocker:
    def __init__(self, fixture, bundle):
        self.fixture = fixture
        self.bundle = bundle
        self.calls = []
        self.pending = False
        self.fail_start = False
        self.fail_migration = False
        self.fail_backup = False
        self.volume = 'tricehsk_import_uploads_source'
        self.database = 'tricehsk_import_source'
        self.revision = MANIFEST['revision']

    def metadata(self, name):
        if name.endswith('-release:production'):
            return {'Id': 'marker-image', 'Config': {'Labels': {'org.opencontainers.image.revision': MANIFEST['revision']}}}
        if '@sha256:' in name:
            return {'Config': {'Labels': {'org.opencontainers.image.revision': self.revision}}}
        return {'Id': name, 'Image': 'cached-' + name,
                'Config': {'Env': ['DATABASE_NAME=tricehsk_import_source', 'DATABASE_URL=',
                                   'POSTGRES_USER=dbuser', 'AUTH_JWT_SECRET=secret-test-sentinel']},
                'Mounts': [{'Destination': '/app/files', 'Name': 'tricehsk_import_uploads_source'}]}

    def run(self, command, output=None):
        self.calls.append(command)
        if output is not None:
            if self.fail_backup:
                raise CommandFailure(command, 1)
            output.write(b'backup-test-bytes')
            return ''
        if command[:2] == ['docker', 'inspect']:
            return json.dumps([self.metadata(command[-1])])
        if command[:2] == ['docker', 'info']:
            return str(self.fixture)
        if command[:2] == ['docker', 'create']:
            return 'read-only-marker-container'
        if command[:2] == ['docker', 'cp']:
            for file in self.bundle.iterdir():
                shutil.copyfile(file, Path(command[-1]) / file.name)
        if 'ps' in command:
            return command[-1] + '-container'
        if 'config' in command and '--format' in command:
            return json.dumps({'name': 'tricehsk', 'volumes': {'uploads': {'name': self.volume}},
                               'services': {'api': {'environment': {'DATABASE_NAME': self.database, 'DATABASE_URL': ''}}}})
        if 'node' in command and '-e' in command:
            return 'CD_MIGRATIONS_PENDING\n' if self.pending else 'CD_MIGRATIONS_CLEAR\n'
        if 'migration:run' in command and self.fail_migration:
            raise CommandFailure(command, 1)
        if 'up' in command and 'api' in command and 'admin' in command and self.fail_start:
            self.fail_start = False
            raise CommandFailure(command, 1)
        return ''


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        temporary_root = CI.parents[0] / 'transfers'
        temporary_root.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix='ci-test-', dir=temporary_root)
        self.fixture = Path(self.temporary.name).resolve()
        self.assertTrue(self.fixture.is_relative_to(temporary_root.resolve()))
        self.root = self.fixture / 'deploy'
        self.bundle = self.fixture / 'bundle'
        self.root.mkdir()
        self.bundle.mkdir()
        self.original_env = b'DATABASE_NAME=tricehsk_import_source\nAUTH_JWT_SECRET=secret-test-sentinel\nUPLOADS_VOLUME_NAME=tricehsk_import_uploads_source\n'
        (self.root / '.env').write_bytes(self.original_env)
        (self.root / 'cloudflare.env').write_text('TUNNEL_TOKEN=test-only-token')
        for asset in ASSETS:
            (self.root / asset).write_text('previous-' + asset)
            (self.bundle / asset).write_text('new-' + asset)
        (self.root / 'compose.release.yaml').unlink()
        (self.bundle / 'release.json').write_text(json.dumps(MANIFEST))
        self.runner = FakeDocker(self.fixture, self.bundle)
        self.deployer = Deployer(Settings(self.root, REGISTRY), self.runner)
        self.health = patch.object(self.deployer, 'health')
        self.health.start()
        self.logs = io.StringIO()
        self.stdout = redirect_stdout(self.logs)
        self.stderr = redirect_stderr(self.logs)
        self.stdout.__enter__()
        self.stderr.__enter__()

    def tearDown(self):
        self.stderr.__exit__(None, None, None)
        self.stdout.__exit__(None, None, None)
        self.health.stop()
        self.temporary.cleanup()

    def test_release_requires_immutable_images_from_the_expected_repo(self):
        validate_manifest(MANIFEST, REGISTRY)
        for changes in ({'apiImage': REGISTRY + '-api:latest'}, {'adminImage': 'ghcr.io/other/repo-admin@sha256:' + '2' * 64},
                        {'revision': '../escape'}, {'schemaVersion': True}, {'revision': 123}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_manifest({**MANIFEST, **changes}, REGISTRY)

    def test_bundle_rejects_missing_and_extra_files(self):
        self.assertEqual(validate_bundle(self.bundle, REGISTRY), MANIFEST)
        (self.bundle / '.env').write_text('must-not-ship')
        with self.assertRaises(ValueError):
            validate_bundle(self.bundle, REGISTRY)

    def test_success_deploys_pair_without_changing_credentials_or_running_migrations(self):
        self.deployer.poll()
        current = self.deployer.read_state('current.json')
        self.assertEqual(current['revision'], MANIFEST['revision'])
        self.assertEqual((self.root / '.env').read_bytes(), self.original_env)
        self.assertIn(MANIFEST['apiImage'], (self.deployer.state / 'active-images.env').read_text())
        self.assertFalse(any('migration:run' in call for call in self.runner.calls))
        self.assertTrue(any('pg_dump' in call for call in self.runner.calls))
        self.assertTrue(any('--volumes-from' in call for call in self.runner.calls))
        self.assertNotIn('secret-test-sentinel', self.logs.getvalue())

    def test_pending_migration_keeps_running_services_and_config_unchanged(self):
        self.runner.pending = True
        self.deployer.poll()
        self.assertEqual(self.deployer.read_state('pending.json')['revision'], MANIFEST['revision'])
        self.assertFalse(any('stop' in call or 'pg_dump' in call for call in self.runner.calls))
        self.assertEqual((self.root / 'compose.yaml').read_text(), 'previous-compose.yaml')
        self.assertEqual((self.root / '.env').read_bytes(), self.original_env)
        self.runner.calls.clear()
        self.deployer.poll()
        self.assertFalse(any('create' in call for call in self.runner.calls))

    def test_different_upload_volume_is_rejected_before_stopping_services(self):
        self.runner.volume = 'wrong-empty-volume'
        with self.assertRaisesRegex(ValueError, 'upload volume'):
            self.deployer.poll()
        self.assertFalse(any('stop' in call for call in self.runner.calls))

    def test_image_revision_mismatch_is_rejected(self):
        self.runner.revision = 'b' * 40
        with self.assertRaisesRegex(ValueError, 'release revision'):
            self.deployer.poll()
        self.assertFalse(any('stop' in call for call in self.runner.calls))

    def test_database_change_is_rejected_before_stopping_services(self):
        self.runner.database = 'another-database'
        with self.assertRaisesRegex(ValueError, 'database connection'):
            self.deployer.poll()
        self.assertFalse(any('stop' in call for call in self.runner.calls))

    def test_failed_start_rolls_back_and_does_not_repeatedly_restart_failed_release(self):
        self.runner.fail_start = True
        with self.assertRaises(CommandFailure):
            self.deployer.poll()
        self.assertEqual((self.root / 'compose.yaml').read_text(), 'previous-compose.yaml')
        self.assertIn('TRICEHSK_API_IMAGE=tricehsk-api:ci-rollback-', (self.deployer.state / 'active-images.env').read_text())
        self.assertEqual((self.root / '.env').read_bytes(), self.original_env)
        self.assertEqual(self.deployer.read_state('failed.json')['revision'], MANIFEST['revision'])
        self.runner.calls.clear()
        self.deployer.poll()
        self.assertFalse(any('stop' in call for call in self.runner.calls))

    def test_failed_backup_restores_running_images(self):
        self.runner.fail_backup = True
        with self.assertRaises(CommandFailure):
            self.deployer.poll()
        self.assertEqual((self.root / '.env').read_bytes(), self.original_env)
        self.assertTrue(any('up' in call and 'api' in call and 'admin' in call for call in self.runner.calls))

    def test_approved_migration_runs_after_backup(self):
        self.runner.pending = True
        self.deployer.poll(allow_migrations=True)
        calls = self.runner.calls
        backup = next(index for index, call in enumerate(calls) if 'pg_dump' in call)
        migrate = next(index for index, call in enumerate(calls) if 'migration:run' in call)
        self.assertLess(backup, migrate)
        self.assertEqual(self.deployer.read_state('current.json')['revision'], MANIFEST['revision'])

    def test_migration_attempt_failure_requires_operator_recovery(self):
        self.runner.pending = self.runner.fail_migration = True
        with self.assertRaises(CommandFailure):
            self.deployer.poll(allow_migrations=True)
        self.assertEqual((self.root / 'compose.yaml').read_text(), 'new-compose.yaml')
        self.assertIn(MANIFEST['apiImage'], (self.deployer.state / 'active-images.env').read_text())
        self.assertFalse(any('up' in call for call in self.runner.calls))
        self.assertIn('Automatic code rollback is disabled', self.logs.getvalue())

    def test_current_release_is_not_redeployed(self):
        write_json(self.deployer.state / 'current.json', {'marker': 'marker-image'})
        self.deployer.poll()
        self.assertFalse(any('create' in call or 'stop' in call for call in self.runner.calls))

    def test_publisher_bundle_contains_only_manifest_and_config(self):
        spec = importlib.util.spec_from_file_location('make_release', CI / 'make-release.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        output = self.fixture / 'published'
        (self.root / 'compose.release.yaml').write_text('overlay')
        module.make_release(self.root, output, MANIFEST, REGISTRY)
        self.assertEqual({file.name for file in output.iterdir()}, set(ASSETS) | {'release.json'})
        self.assertNotIn('secret-test-sentinel', ''.join(file.read_text() for file in output.iterdir()))

    def test_origin_health_uses_both_hosts_and_validates_actual_responses(self):
        self.health.stop()
        responses = []
        for body in (b'{"name":"TriceHSK API"}', b'<button type="submit">Login</button>'):
            response = unittest.mock.MagicMock()
            response.__enter__.return_value = response
            response.status = 200
            response.read.return_value = body
            responses.append(response)
        with patch('deploy.urlopen', side_effect=responses) as request:
            self.deployer.health()
        self.assertEqual([call.args[0].get_header('Host') for call in request.call_args_list],
                         ['api.tricehsk.id.vn', 'admin.tricehsk.id.vn'])

    def test_wrong_origin_content_fails_instead_of_accepting_status_200(self):
        self.health.stop()
        response = unittest.mock.MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.read.return_value = b'[]'
        with patch('deploy.urlopen', return_value=response), patch('deploy.time.sleep'), \
                self.assertRaisesRegex(RuntimeError, 'health check failed'):
            self.deployer.health()


if __name__ == '__main__':
    unittest.main()
