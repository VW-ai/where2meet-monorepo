"""Fail-closed identity checks for the staging deployment and browser proof."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = '848dc1e0-d9c2-4571-b542-73a1efdc5848'
ENVIRONMENT = 'cc3365e4-e13f-43dd-b73c-77f2029bf8da'
SERVICE = '57bc3975-1bd6-4506-95df-ed7edc52380d'
POSTGRES = '46ecaa62-c152-4a6f-ab0d-9610b91268b8'
REDIS = 'cbfbc8c3-f35a-41a5-9c2d-fe2d299de277'
BACKEND = 'https://where2meet-server-staging.up.railway.app'
CLIENT = 'http://127.0.0.1:4317'
START_COMMAND = '/bin/sh -c "npx prisma migrate deploy && exec node dist/index.js"'


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def approved_event(event, repository, main_sha):
    run = event.get('workflow_run', {})
    sha = run.get('head_sha', '')
    require(run.get('name') == 'Server CI' and run.get('conclusion') == 'success'
            and run.get('event') == 'push' and run.get('head_branch') == 'main'
            and run.get('head_repository', {}).get('full_name') == repository
            and event.get('repository', {}).get('full_name') == repository,
            'Only successful repository Server CI pushes to main are approved')
    require(re.fullmatch('[0-9a-f]{40}', sha) and sha == main_sha,
            'Approved revision must equal current main HEAD')
    return sha


def pr_number(event, repository):
    pr = event.get('pull_request', {})
    number = event.get('number')
    require(event.get('repository', {}).get('full_name') == repository
            and type(number) is int and number > 0 and pr.get('number') == number,
            'Expected a pull request in the current repository')
    return number


def approved_pr_event(event, current, repository, checkout_sha):
    number = pr_number(event, repository)
    previous = event['pull_request']
    require(current.get('number') == number and previous.get('state') == 'open'
            and current.get('state') == 'open', 'Pull request is no longer open')
    for name in ('head', 'base'):
        original = previous.get(name, {})
        live = current.get(name, {})
        require(original.get('repo', {}).get('full_name') == repository
                and live.get('repo', {}).get('full_name') == repository,
                'Staging accepts only same-repository pull requests')
        original_sha = original.get('sha')
        require(isinstance(original_sha, str) and re.fullmatch('[0-9a-f]{40}', original_sha)
                and original_sha == live.get('sha'),
                f'Pull request {name} revision changed after CI started')
    require(re.fullmatch('[0-9a-f]{40}', checkout_sha)
            and current.get('merge_commit_sha') == checkout_sha,
            'Checkout must equal the current pull request test merge revision')
    return checkout_sha


def nodes(connection):
    return [edge['node'] for edge in connection.get('edges', [])]


def instance(status):
    require(status.get('id') == PROJECT, 'Unexpected Railway project')
    environments = [e for e in nodes(status.get('environments', {})) if e.get('id') == ENVIRONMENT]
    require(len(environments) == 1 and environments[0].get('name') == 'staging'
            and not environments[0].get('deletedAt'), 'Unexpected Railway environment')
    services = [s for s in nodes(environments[0].get('serviceInstances', {})) if s.get('serviceId') == SERVICE]
    require(len(services) == 1 and services[0].get('environmentId') == ENVIRONMENT,
            'Unexpected Railway service')
    return services[0]


def preflight(status, variables, postgres, redis):
    service = instance(status)
    require('source' in service and isinstance(service['source'], dict)
            and 'repo' in service['source'] and service['source']['repo'] is None
            and not service['source'].get('image'), 'Staging source must be disconnected from GitHub and images')
    require(variables.get('RAILWAY_ENVIRONMENT_ID') == ENVIRONMENT
            and variables.get('RAILWAY_SERVICE_ID') == SERVICE, 'Unexpected resolved variable identity')
    for name, resource, service_id, key in (('Postgres', postgres, POSTGRES, 'DATABASE_URL'),
                                            ('Redis', redis, REDIS, 'REDIS_URL')):
        require(resource.get('RAILWAY_ENVIRONMENT_ID') == ENVIRONMENT
                and resource.get('RAILWAY_SERVICE_ID') == service_id,
                f'{name} is not the staging resource')
        require(bool(variables.get(key)) and variables[key] == resource.get(key),
                f'Backend {key} does not resolve to staging {name}')
    origins = [origin.strip() for origin in variables.get('CORS_ORIGINS', variables.get('CORS_ORIGIN', '')).split(',')]
    require(CLIENT in origins and '*' not in origins, 'Staging must explicitly allow the loopback frontend')
    domains = service.get('domains', {})
    require(BACKEND in {'https://' + d['domain'] for kind in ('serviceDomains', 'customDomains')
                       for d in domains.get(kind, [])}, 'Unexpected staging backend origin')


def deployment_ready(status, deployments, deployment_id, approved_sha=None):
    service = instance(status)
    exact = [d for d in deployments if d.get('id') == deployment_id]
    require(len(exact) == 1, 'Uploaded deployment is absent or ambiguous')
    require(exact[0].get('status') not in ('FAILED', 'CRASHED', 'REMOVED', 'SKIPPED'), 'Uploaded deployment failed')
    if exact[0].get('status') != 'SUCCESS':
        return False
    meta = exact[0].get('meta') or {}
    manifest = meta.get('serviceManifest') or {}
    build = manifest.get('build') or {}
    deploy = manifest.get('deploy') or {}
    require(meta.get('rootDirectory') == '/server' and meta.get('configFile') == '/server/railway.toml'
            and build.get('builder') == 'DOCKERFILE' and build.get('dockerfilePath') == 'Dockerfile'
            and deploy.get('startCommand') == START_COMMAND
            and deploy.get('healthcheckPath') == '/health/ready',
            'Uploaded deployment has unexpected build or runtime settings')
    if approved_sha and meta.get('commitHash'):
        require(meta['commitHash'] == approved_sha, 'Uploaded deployment commit differs from approved source')
    active = service.get('activeDeployments', [])
    return (exact[0].get('status') == 'SUCCESS'
            and service.get('latestDeployment', {}).get('id') == deployment_id
            and len(active) == 1 and active[0].get('id') == deployment_id
            and not active[0].get('deploymentStopped'))


def evidence_matches(result, cleanup, identity):
    for item in (result, cleanup):
        require(item.get('status') == 'PASS' and item.get('identity') == identity,
                'Browser result and cleanup must pass with exact run identity')
    require(cleanup.get('absent') is True and cleanup.get('owned_event') is True
            and cleanup.get('get_status') == 404, 'Cleanup must prove the owned event absent')


def http_readiness(status, body, deployment_id):
    require(status == 200 and isinstance(body, dict) and body.get('deploymentId') == deployment_id
            and body.get('status') == 'ok'
            and body.get('services') == {'database': 'ok', 'redis': 'ok'},
            'Staging HTTP route does not serve the ready uploaded deployment')


def upload_error_code(payload):
    try:
        response = json.loads(payload)
    except (TypeError, ValueError):
        return 'UNKNOWN'
    code = response.get('code') if isinstance(response, dict) else None
    return code if isinstance(code, str) and re.fullmatch(r'[A-Z][A-Z0-9_]{0,63}', code) else 'UNKNOWN'


def railway(*command):
    proc = subprocess.run(['railway', *command, '--project', PROJECT, '--environment', ENVIRONMENT,
                           '--json'], capture_output=True, text=True, timeout=60)
    require(proc.returncode == 0, 'Railway read failed; provider output withheld')
    try:
        return json.loads(proc.stdout)
    except ValueError:
        raise RuntimeError('Railway JSON invalid; provider output withheld') from None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['event', 'pr-number', 'preflight', 'upload-id',
                                              'upload-error', 'wait', 'evidence'])
    parser.add_argument('--main-sha')
    parser.add_argument('--pr-file')
    parser.add_argument('--file')
    args = parser.parse_args()
    if args.operation == 'event':
        event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        if os.environ['GITHUB_EVENT_NAME'] == 'pull_request':
            require(bool(args.pr_file), 'Current pull request response is required')
            print(approved_pr_event(event, json.loads(Path(args.pr_file).read_text()),
                                    os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_SHA']))
        else:
            require(os.environ['GITHUB_EVENT_NAME'] == 'workflow_run' and bool(args.main_sha),
                    'Expected approved main workflow run')
            print(approved_event(event, os.environ['GITHUB_REPOSITORY'], args.main_sha))
    elif args.operation == 'pr-number':
        require(os.environ['GITHUB_EVENT_NAME'] == 'pull_request', 'Expected pull request event')
        print(pr_number(json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text()),
                        os.environ['GITHUB_REPOSITORY']))
    elif args.operation == 'preflight':
        preflight(railway('status'), railway('variables', '--service', SERVICE),
                  railway('variables', '--service', POSTGRES),
                  railway('variables', '--service', REDIS))
    elif args.operation == 'upload-id':
        rows = [json.loads(line) for line in Path(args.file).read_text().splitlines() if line.strip()]
        ids = {row['deploymentId'] for row in rows if row.get('deploymentId')}
        require(len(ids) == 1, 'Upload did not return one exact deployment ID')
        value = ids.pop()
        require(re.fullmatch('[0-9a-f-]{36}', value), 'Invalid uploaded deployment ID')
        print(value)
    elif args.operation == 'upload-error':
        try:
            with Path(args.file).open('rb') as source:
                payload = source.read(16385)
            code = upload_error_code(payload.decode('utf-8')) if len(payload) <= 16384 else 'UNKNOWN'
        except (OSError, TypeError, UnicodeError):
            code = 'UNKNOWN'
        print(code)
    elif args.operation == 'wait':
        for _ in range(90):
            if deployment_ready(railway('status'), railway('deployment', 'list', '--service', SERVICE, '--limit', '20'),
                                os.environ['DEPLOYMENT_ID'], os.environ['APPROVED_SHA']):
                request = urllib.request.Request(BACKEND + '/health/ready', headers={'Cache-Control': 'no-store'})
                try:
                    with urllib.request.urlopen(request, timeout=20) as response:
                        http_readiness(response.status, json.load(response), os.environ['DEPLOYMENT_ID'])
                    return
                except (urllib.error.URLError, TimeoutError, ValueError, RuntimeError):
                    pass
            time.sleep(10)
        raise RuntimeError('Exact uploaded deployment did not become active and ready')
    else:
        identity = {key: os.environ[value] for key, value in {
            'backend_sha': 'APPROVED_SHA', 'frontend_sha': 'APPROVED_SHA',
            'deployment_id': 'DEPLOYMENT_ID', 'run_id': 'VERIFY_RUN_ID'}.items()}
        identity.update(backend_origin=BACKEND, client_origin=CLIENT)
        evidence = Path(os.environ['RUN_DIR']) / 'evidence'
        evidence_matches(json.loads((evidence / 'result.json').read_text()),
                         json.loads((evidence / 'cleanup.json').read_text()), identity)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error)) from None
