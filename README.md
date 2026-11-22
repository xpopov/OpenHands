> [!NOTE]
> **Fork of [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) (Agent Canvas v1.34.0): Docker conversations can use host folders, a new Docker Worktree mode, and an "Allow local conversations" setting.**
>
> Branch `fix/canvas-docker-host-workspace-v1.34.0` (base tag `v1.34.0`). The older `fix/canvas-docker-host-workspace-v1.29.0` branch carries the first version of the host-folder change.
>
> **Workspace modes in the home launcher**
>
> | Mode            | Runs      | Workspace                                                                | Folder hooks                 | Offered when                                                                                                        |
> | --------------- | --------- | ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
> | Local           | host      | picked folder                                                            | yes                          | the server offers local runs and "Allow local conversations" is on                                                  |
> | Worktree        | host      | new git worktree of the folder                                           | yes                          | same as Local, folder picked                                                                                        |
> | Docker          | container | picked folder at `/workspace`; an empty private folder if none is picked | yes, when a folder is picked | the server offers Docker (hybrid or Docker-only)                                                                    |
> | Docker Worktree | container | new git worktree of the folder                                           | yes                          | the server offers Docker, a folder is picked, agent-server >= 1.61.0; shown disabled when the folder has no commits |
>
> **Agent-server requirements**
>
> - Agent-server >= 1.57.0 (the Canvas version check). Docker Worktree needs >= 1.61.0; on older servers it is not offered and no Canvas request sends `worktree: true` to a container.
> - Hybrid (host and Docker): `OH_CONVERSATION_RUNTIME_SELECTABLE=true`, a reachable Docker daemon and `OH_SECRET_KEY`. Docker-only: `OH_CONVERSATION_RUNTIME=docker`.
>
> **"Allow local conversations"** (Settings > Runtime, shown only on a local backend whose agent-server offers both host and Docker runs)
>
> - Stored with the other Canvas preferences in the agent-server settings (`misc_settings.app_preferences.allow_local_conversations`); not set means on.
> - When off, every conversation started from this Canvas runs in Docker: launcher, sidebar menu, `/launch` links, profile switch, skill restart, children and planners. The `local` and `worktree` default-runtime choices are hidden unless one of them is already saved.
> - It is a Canvas preference, not a server control: direct API callers and the automation service can still start host conversations. Anyone holding the session key can change it.
>
> **Children and planners**: a child or planner of a Docker conversation (or any conversation on a Docker-only server) is refused, so it can never move to the host. A child or planner of a host conversation is refused while local conversations are off.
>
> **Worktree options**: the saved `worktree_base`, `worktree_base_ref` and `worktree_branch_prefix` also apply to Docker Worktree. They are hidden in Settings > Runtime while local conversations are off.
>
> **Security trade-offs**
>
> - The picked folder is mounted read-write. In Docker Worktree mode the repository root and its git common dir are mounted read-write too. Code in the container can therefore plant files that run on the host later: `.git/config` (`core.fsmonitor`, `core.hooksPath`), `.git/hooks/*`, and `.openhands/hooks.json` plus hook scripts (run by the next Local or Worktree conversation on that folder). Upstream hybrid Docker mode has the same exposure.
> - Folder hooks run inside the container, not on the host. They fail open: only exit code 2 blocks an action; a missing script or interpreter in the container (exit 127) lets the action proceed.
> - Any absolute host path can be mounted, including `/` or `~/.ssh`; the folder picker is the only guard (as upstream).

## OpenHands (Canvas and Agent Server) updates on DigitalOcean installation

Add or update these values in the environment configuration used by the `openhands` service:

```dotenv
# Installed Agent Canvas version
OPENHANDS_VERSION=1.34.0

OH_AGENT_SERVER_VERSION=1.62.0
# Local agent-server
OH_AGENT_SERVER_LOCAL_PATH=/home/openhands/software-agent-sdk

OH_CONVERSATION_RUNTIME_SELECTABLE=true
OH_CONVERSATION_IMAGE=hub-openhands-agent:latest # custom Docker image

# Give conversation containers more memory and CPU
OH_CONVERSATION_CONTAINER_MEMORY=3g
OH_CONVERSATION_CONTAINER_CPUS=2.0
```

Optional explicit workspace mount (installation-specific; not assumed to be the default):

```dotenv
OH_EXECUTION_VOLUMES='["/home/openhands/workspace/project:/workspace/project"]'
```

Ensure the custom conversation image's Dockerfile includes:

```dockerfile
ENV LITELLM_MODEL_COST_MAP_URL=https://129.212.148.213/litellm/model_prices_and_context_window.json
```

For the initial setup, clone both forks as the `openhands` user into the paths used below (run once):

```sh
sudo -u openhands -i bash -c 'git clone https://github.com/xpopov/OpenHands.git ~/agent-canvas-fork'
sudo -u openhands -i bash -c 'git clone https://github.com/xpopov/software-agent-sdk.git ~/software-agent-sdk'
```

With Canvas in `/home/openhands/agent-canvas-fork` and the Agent Server SDK in `/home/openhands/software-agent-sdk`, update and rebuild Canvas, update the SDK, then restart the service:

```sh
sudo -u openhands -i bash -c 'cd ~/agent-canvas-fork && git pull && npm ci --no-audit --no-fund && npm run build && npm pack && npm install -g --prefix ~/.local ./openhands-agent-canvas-1.34.0.tgz'

sudo -u openhands -i bash -c 'cd ~/software-agent-sdk && git pull'
sudo systemctl restart openhands
```

<a name="readme-top"></a>

<div align="center">
  <img src="https://assets.openhands.dev/logo-whitebackground.png" alt="OpenHands logo" width="340">
  <h1 align="center" style="border-bottom: none">Agent Canvas</h1>
  <p align="center">
    <strong>The self-hosted developer control center for coding agents and automations.</strong>
  </p>
  <p align="center">
    Run OpenHands, Claude Code, Codex, Gemini, Pi, OpenCode, or any ACP-compatible agent across local, remote, and cloud backends.
  </p>
</div>
<div align="center">
  <a href="https://github.com/OpenHands/OpenHands/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/OpenHands/OpenHands/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/@openhands/agent-canvas"><img src="https://img.shields.io/npm/v/%40openhands%2Fagent-canvas?style=for-the-badge&logo=npm" alt="npm version"></a>
  <a href="https://docs.openhands.dev/openhands/usage/agent-canvas/backends"><img src="https://img.shields.io/badge/Documentation-000?logo=googledocs&logoColor=FFE165&style=for-the-badge" alt="Documentation"></a>
  <a href="https://go.openhands.dev/slack"><img src="https://img.shields.io/badge/Slack-Join%20the%20community-611f69?logo=slack&logoColor=white&style=for-the-badge" alt="Join us on Slack"></a>
</div>
<div align="center">
  <a href="#quickstart">Quickstart</a> |
  <a href="./docs/README.md">Docs</a> |
  <a href="./docs/SELF_HOSTING.md">Self-Hosting</a> |
  <a href="https://docs.openhands.dev/openhands/usage/agent-canvas/acp-agents">ACP Agents</a> |
  <a href="https://docs.openhands.dev/openhands/usage/agent-canvas/prebuilt-automations">Automations</a> |
  <a href="https://go.openhands.dev/slack">Slack</a>
</div>
<p align="center">
  <img src="https://assets.openhands.dev/screenshot/automation-preview.png" alt="Agent Canvas automation preview" width="100%">
</p>
<hr>

OpenHands Agent Canvas turns your coding agents into a self-hosted, always-on engineering team. It's a developer control center for starting conversations and automating everyday tasks — like generating reports that publish to Slack or automatically decomposing GitHub issues into tasks.

It runs locally on your machine by default, but can connect to multiple “agent backends”, e.g. running agents in Docker containers, on VMs, or within your company infrastructure. You can optionally choose to run agents on OpenHands Cloud or OpenHands Enterprise infrastructure.

Agent Canvas runs the open source OpenHands agent out-of-the-box, but can use third-party agents such as Claude Code, Codex, Gemini CLI, Pi, and OpenCode.

|                                                                                                                      |                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [**Self-host your way**](https://docs.openhands.dev/openhands/usage/agent-canvas/backend-setup/vm)                   | Run agents locally, in Docker, on VMs, or anywhere you can run an agent server backend                                                   |
| [**Switch between different backends**](https://docs.openhands.dev/openhands/usage/agent-canvas/backends)            | Switch between local, remote, and cloud agents without losing focus                                                                      |
| [**Create automations**](https://docs.openhands.dev/openhands/usage/agent-canvas/prebuilt-automations)               | Create automations and workflows that integrate with Slack, GitHub, Linear, and more. Run on a schedule or in response to webhook events |
| [**Integrate with the tools you use**](https://docs.openhands.dev/openhands/usage/agent-canvas/prebuilt-automations) | Connect your automations with third-party services like Slack, GitHub, Notion, and more to automate workflows                            |
| [**Bring your own model**](https://docs.openhands.dev/openhands/usage/settings/llm-settings#llm-profiles)            | Use with any LLM                                                                                                                         |
| [**Use with any agent**](https://docs.openhands.dev/openhands/usage/agent-canvas/acp-agents)                         | Use with OpenHands, Claude Code, Codex, Gemini, Pi, OpenCode, or any agent with Agent-Client Protocol (ACP).                             |

If you have questions or feedback, please open a GitHub issue or join the [#proj-agent-canvas channel in Slack](https://openhands.dev/joinslack).

## Quickstart

You can install OpenHands to run agents on any machine: on your laptop, on a dedicated computer like a Mac Mini,
or on a server in the cloud.

The most powerful way to run OpenHands is on a server in the cloud. This allows your agents to continue running
even when your laptop is shut, and makes it easier to trigger your agents through third-party services
like Slack, GitHub, and Datadog. See [SELF_HOSTING.md](docs/SELF_HOSTING.md) for details, especially with respect to security hardening.

Notably, you can run the backend in _multiple different environments_, and switch between
them from the same Agent Canvas frontend. E.g. you can share an Agent Server with your team for agents doing
code review and dependency updates, then have your personal agents running on your laptop.

### Option 1: Without a Sandbox

> [!WARNING]
> This runs the agent-server directly on the machine you're installing on — the agent will have full access to your filesystem!

**Prerequisites**: [Node.js](https://nodejs.org/) 24 or later, `uv`

```sh
npm install -g @openhands/agent-canvas
agent-canvas
```

The `agent-canvas` command starts the full local stack by default. You can also split it when you want to run pieces separately:

```sh
agent-canvas --frontend-only  # static frontend + ingress only
agent-canvas --backend-only   # agent server + automation backend + ingress only
```

### Option 2: With a Docker Sandbox

**Prerequisites**:

- Docker: Docker Desktop on macOS/Windows, or Docker Engine/Docker Desktop on Linux.
- A host directory for `PROJECTS_PATH` containing the project folders you want the agent to access. Create it before starting the container.

**macOS / Linux:**

```sh
export PROJECTS_PATH="$HOME/projects"  # directory containing your project folders
mkdir -p "$PROJECTS_PATH" "$HOME/.openhands"

docker run -it --rm \
  -p 127.0.0.1:8000:8000 \
  -e AGENT_CANVAS_ALLOW_LAN_SESSION_KEY=true \
  -v "$HOME/.openhands:/home/openhands/.openhands" \
  -v "${PROJECTS_PATH}:/projects" \
  ghcr.io/openhands/agent-canvas:1.34.0 # x-release-please-version
```

**Windows (PowerShell / Windows Terminal):** See [README.windows.md](./README.windows.md) for the equivalent commands.

The agent will be able to access any project under `PROJECTS_PATH`.

### Option 3: With Multiple Docker Sandboxes

Run each new conversation in its own Docker container, with its own Agent Server and tools. This is useful for running several agents concurrently. Canvas and the outer Agent Server run on your host and route conversation requests to the containers.

**Prerequisites**: Node.js 24 or later, `uv`, and a running Docker Desktop (macOS) or Docker Engine/Desktop (Linux). The user starting Canvas must be able to run `docker` commands.

**macOS / Linux:**

```sh
npm install -g @openhands/agent-canvas
OH_CONVERSATION_RUNTIME=docker agent-canvas
```

Open [http://localhost:8000](http://localhost:8000) and start a new conversation. Existing local conversations are not converted. Each container mounts its conversation's workspace and persisted state, so workspace files and conversation history survive container replacement. Conversations using the same host workspace still share those files; choose separate directories or worktrees to avoid conflicting edits.

This setting isolates conversation execution; it does not move the entire Canvas or automation service into a sandbox. For Windows, see [README.windows.md](./README.windows.md#option-3-with-multiple-docker-sandboxes-wsl-2).

### Option 4: From Source

> [!WARNING]
> This runs the agent-server directly on the machine you're installing on — the agent will have full access to your filesystem!

**Prerequisites**: [Node.js](https://nodejs.org/) 24 or later, npm 11.12.1 (the repository pin), `uv` (for running the agent server via `uvx`)

Check `npm --version` before resolving dependencies. The seven-day release-age
filter (`npm install --min-release-age=7`) requires npm >=11.10; older versions
do not enforce it. Use `npm ci` to replay the committed lockfile. This npm
requirement is for contributor dependency resolution, not for installing the
published Canvas package.

```sh
git clone https://github.com/OpenHands/OpenHands.git
cd OpenHands
npm ci
npm run dev
```

---

Access the UI at [http://localhost:8000](http://localhost:8000) for the npm/source launchers, or [http://localhost:8000/canvas](http://localhost:8000/canvas) for the Docker image. You can add additional backends directly from the UI.

Local (`npx` / `npm run dev`) listeners bind **loopback only** (`127.0.0.1`) so the auto-injected session key is not reachable from other machines on the network. To listen on all interfaces, pass `--host 0.0.0.0` (or set `OH_BIND_HOST`); the session key is then **not** injected and the UI uses the same API-key entry screen as `--public`.

Docker listens on all container interfaces so port publishing works, but does not inject its session key into HTML by default. The quickstart above explicitly enables injection while publishing the host port on `127.0.0.1` only. If you publish Docker on a LAN or public interface, omit `AGENT_CANVAS_ALLOW_LAN_SESSION_KEY` and enter the API key in the UI. Set `LOCAL_BACKEND_API_KEY` to a strong value, or retrieve the generated value with `docker exec <container> sh -c 'cat "$STATE_DIR/api-key.txt"'`. For internet-facing installs, follow [self-hosting](./docs/SELF_HOSTING.md).

# Architecture

Agent Canvas is powered by the [OpenHands Agent Server](https://github.com/OpenHands/software-agent-sdk/tree/main/openhands-agent-server/openhands/agent_server), a REST API for running multiple agents on a single machine. Each Agent Server runs on a single host/port; the Agent Canvas can connect to multiple Agent Servers and easily flip between them.

You can run an Agent Server anywhere:

- Directly on your laptop (be careful!)
- On a dedicated machine like a Mac Mini
- On a virtual machine in the cloud
- Inside OpenHands Cloud (our commercial offering)

The Agent Server is often paired with an [Automation Server](https://github.com/OpenHands/automation), which lets you set up agents that run on a schedule or in response to events.

<img width="1456" height="1258" alt="image" src="https://github.com/user-attachments/assets/cb6de6f5-ac30-4d04-a76a-b5c259f0c163" />

### Repository boundaries

Agent Canvas is part of a multi-repository OpenHands system. Changes should go to the repository that owns the behavior:

| Repository                                                                        | Responsibility                                                                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`OpenHands/OpenHands`](https://github.com/OpenHands/OpenHands)                   | Agent Canvas frontend, user-facing control center, backend selection, and local-stack orchestration.      |
| [`OpenHands/software-agent-sdk`](https://github.com/OpenHands/software-agent-sdk) | Python SDK, Agent Server, agents, tools, conversations, workspaces, events, and the canonical server API. |
| [`OpenHands/typescript-client`](https://github.com/OpenHands/typescript-client)   | Browser-compatible TypeScript client for the Agent Server API.                                            |
| [`OpenHands/automation`](https://github.com/OpenHands/automation)                 | Automation definitions, scheduling, webhooks, run history, and dispatching.                               |

The Agent Server API is implemented by the SDK and consumed through the TypeScript client by Agent Canvas. The automation service decides when work runs and dispatches conversations to the Agent Server/SDK, which decides what runs. See [`AGENTS.md`](./AGENTS.md) for contributor-specific boundaries and the required custom code-review guide.

## More documentation

- [Documentation index](./docs/README.md)
- [Architecture overview](./docs/architecture.md)
- [Development guide](./docs/DEVELOPMENT.md), including [embedding Canvas components in a host app](./docs/DEVELOPMENT.md#css-isolation-and-host-app-customization) (load `@openhands/agent-canvas/styles.css` once next to the component imports)
- [Self-hosting guide](./docs/SELF_HOSTING.md)
