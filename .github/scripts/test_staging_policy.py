import copy
import unittest

from staging_policy import (BACKEND, CLIENT, ENVIRONMENT, POSTGRES, PROJECT, REDIS, SERVICE,
                            START_COMMAND,
                            approved_event, approved_pr_event, deployment_ready, evidence_matches, http_readiness,
                            preflight)

SHA = 'a' * 40
DEPLOYMENT = '12cd34ef-1234-5678-abcd-123456789012'
REPOSITORY = 'VW-ai/where2meet-monorepo'


def status_fixture():
    service = {'serviceId': SERVICE, 'environmentId': ENVIRONMENT,
               'source': {'repo': None, 'image': None},
               'domains': {'serviceDomains': [{'domain': BACKEND.removeprefix('https://')}]},
               'latestDeployment': {'id': DEPLOYMENT, 'status': 'SUCCESS'},
               'activeDeployments': [{'id': DEPLOYMENT, 'deploymentStopped': False}]}
    return {'id': PROJECT, 'environments': {'edges': [{'node': {
        'id': ENVIRONMENT, 'name': 'staging', 'deletedAt': None,
        'serviceInstances': {'edges': [{'node': service}]}}}]}}


class StagingPolicyTests(unittest.TestCase):
    def test_pr_approval_requires_live_same_repo_merge_revision(self):
        head = 'b' * 40
        base = 'c' * 40
        merge = 'd' * 40
        pull_request = {'number': 38, 'state': 'open',
                        'head': {'sha': head, 'repo': {'full_name': REPOSITORY}},
                        'base': {'sha': base, 'repo': {'full_name': REPOSITORY}},
                        'merge_commit_sha': merge}
        event = {'number': 38, 'repository': {'full_name': REPOSITORY},
                 'pull_request': copy.deepcopy(pull_request)}
        self.assertEqual(approved_pr_event(event, pull_request, REPOSITORY, merge), merge)
        mutations = (
            ('new head', 'current', 'head', 'sha', 'e' * 40),
            ('new base', 'current', 'base', 'sha', 'e' * 40),
            ('new merge', 'current', None, 'merge_commit_sha', 'e' * 40),
            ('closed', 'current', None, 'state', 'closed'),
            ('forked head', 'current', 'head', 'repo', {'full_name': 'other/repo'}),
            ('forked base', 'event', 'base', 'repo', {'full_name': 'other/repo'}),
            ('wrong number', 'current', None, 'number', 39),
        )
        for label, source, part, field, value in mutations:
            with self.subTest(label=label):
                candidate_event = copy.deepcopy(event)
                candidate_current = copy.deepcopy(pull_request)
                target = candidate_event['pull_request'] if source == 'event' else candidate_current
                target = target[part] if part else target
                target[field] = value
                with self.assertRaises(RuntimeError):
                    approved_pr_event(candidate_event, candidate_current, REPOSITORY, merge)
        with self.assertRaises(RuntimeError):
            approved_pr_event(event, pull_request, REPOSITORY, 'f' * 40)

    def test_ci_approval_requires_current_main_and_repository(self):
        event = {'repository': {'full_name': REPOSITORY}, 'workflow_run': {
            'name': 'Server CI', 'conclusion': 'success', 'event': 'push',
            'head_branch': 'main', 'head_sha': SHA, 'head_repository': {'full_name': REPOSITORY}}}
        self.assertEqual(approved_event(event, REPOSITORY, SHA), SHA)
        for key, value in [('conclusion', 'failure'), ('event', 'workflow_dispatch'),
                           ('head_branch', 'feature'), ('head_sha', 'a' * 7),
                           ('head_repository', {'full_name': 'fork/repo'}), ('name', 'Other CI')]:
            rejected = copy.deepcopy(event)
            rejected['workflow_run'][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                approved_event(rejected, REPOSITORY, SHA)
        with self.assertRaises(RuntimeError):
            approved_event(event, REPOSITORY, 'b' * 40)

    def test_preflight_rejects_connected_source_and_wrong_cors(self):
        variables = {'RAILWAY_ENVIRONMENT_ID': ENVIRONMENT, 'RAILWAY_SERVICE_ID': SERVICE,
                     'CORS_ORIGINS': 'https://example.com, ' + CLIENT,
                     'DATABASE_URL': 'staging-postgres-url', 'REDIS_URL': 'staging-redis-url'}
        postgres = {'RAILWAY_ENVIRONMENT_ID': ENVIRONMENT, 'RAILWAY_SERVICE_ID': POSTGRES,
                    'DATABASE_URL': variables['DATABASE_URL']}
        redis = {'RAILWAY_ENVIRONMENT_ID': ENVIRONMENT, 'RAILWAY_SERVICE_ID': REDIS,
                 'REDIS_URL': variables['REDIS_URL']}
        self.assertIsNone(preflight(status_fixture(), variables, postgres, redis))
        for source in ({'repo': REPOSITORY, 'image': None}, {}, None):
            status = status_fixture()
            status['environments']['edges'][0]['node']['serviceInstances']['edges'][0]['node']['source'] = source
            with self.subTest(source=source), self.assertRaises(RuntimeError):
                preflight(status, variables, postgres, redis)
        for key, value in [('CORS_ORIGINS', '*'), ('CORS_ORIGINS', 'http://localhost:4317'),
                           ('RAILWAY_ENVIRONMENT_ID', 'production'), ('RAILWAY_SERVICE_ID', 'other')]:
            with self.subTest(key=key, value=value), self.assertRaises(RuntimeError):
                preflight(status_fixture(), {**variables, key: value}, postgres, redis)
        for bad_postgres, bad_redis in [({**postgres, 'DATABASE_URL': 'production'}, redis),
                                        (postgres, {**redis, 'REDIS_URL': 'production'}),
                                        ({**postgres, 'RAILWAY_ENVIRONMENT_ID': 'production'}, redis)]:
            with self.assertRaises(RuntimeError):
                preflight(status_fixture(), variables, bad_postgres, bad_redis)

    def test_only_uploaded_successful_active_deployment_is_ready(self):
        meta = {'commitHash': SHA, 'rootDirectory': '/server', 'configFile': '/server/railway.toml',
                'serviceManifest': {'build': {'builder': 'DOCKERFILE', 'dockerfilePath': 'Dockerfile'},
                                    'deploy': {'startCommand': START_COMMAND, 'healthcheckPath': '/health/ready'}}}
        deployments = [{'id': DEPLOYMENT, 'status': 'SUCCESS', 'meta': meta}]
        self.assertTrue(deployment_ready(status_fixture(), deployments, DEPLOYMENT, SHA))
        self.assertFalse(deployment_ready(status_fixture(), [{'id': DEPLOYMENT, 'status': 'BUILDING', 'meta': meta}], DEPLOYMENT, SHA))
        status = status_fixture()
        service = status['environments']['edges'][0]['node']['serviceInstances']['edges'][0]['node']
        service['activeDeployments'][0]['id'] = 'other'
        self.assertFalse(deployment_ready(status, deployments, DEPLOYMENT, SHA))
        for rows in ([], [{'id': 'other', 'status': 'SUCCESS'}], [{'id': DEPLOYMENT, 'status': 'FAILED'}]):
            with self.subTest(rows=rows), self.assertRaises(RuntimeError):
                deployment_ready(status_fixture(), rows, DEPLOYMENT, SHA)
        for changed in ({**meta, 'rootDirectory': '/'},
                        {**meta, 'serviceManifest': {**meta['serviceManifest'], 'build': {'builder': 'NIXPACKS'}}},
                        {**meta, 'commitHash': 'b' * 40}):
            with self.assertRaises(RuntimeError):
                deployment_ready(status_fixture(), [{**deployments[0], 'meta': changed}], DEPLOYMENT, SHA)

    def test_evidence_requires_exact_identity_and_cleanup_pass(self):
        identity = {'backend_sha': SHA, 'frontend_sha': SHA, 'deployment_id': DEPLOYMENT,
                    'run_id': '123-1', 'backend_origin': BACKEND, 'client_origin': CLIENT}
        result = {'status': 'PASS', 'identity': identity}
        cleanup = {'status': 'PASS', 'identity': identity, 'absent': True, 'owned_event': True, 'get_status': 404}
        self.assertIsNone(evidence_matches(result, cleanup, identity))
        for changed in ({**cleanup, 'status': 'FAIL'}, {**cleanup, 'absent': False},
                        {**cleanup, 'owned_event': False}, {**cleanup, 'get_status': 200},
                        {**cleanup, 'identity': {**identity, 'deployment_id': 'other'}},
                        {**cleanup, 'identity': {**identity, 'frontend_sha': 'b' * 40}}):
            with self.subTest(changed=changed), self.assertRaises(RuntimeError):
                evidence_matches(result, changed, identity)

    def test_http_readiness_requires_running_deployment_identity(self):
        ready = {'status': 'ok', 'deploymentId': DEPLOYMENT,
                 'services': {'database': 'ok', 'redis': 'ok'}}
        self.assertIsNone(http_readiness(200, ready, DEPLOYMENT))
        for status, body in [(503, ready),
                             (200, {**ready, 'deploymentId': 'other'}),
                             (200, {**ready, 'status': 'degraded'}),
                             (200, {**ready, 'services': {'database': 'ok', 'redis': 'unhealthy'}})]:
            with self.assertRaises(RuntimeError):
                http_readiness(status, body, DEPLOYMENT)


if __name__ == '__main__':
    unittest.main()
