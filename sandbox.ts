import Docker from 'dockerode';
import { config } from '../config';
import { EventEmitter } from 'events';

export interface SandboxOptions {
  repoUrl: string;
  branch?: string;
  image?: string;
  env?: Record<string, string>;
}

export interface SandboxInstance {
  containerId: string;
  exec: (command: string) => Promise<ExecResult>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  listFiles: (path?: string) => Promise<string[]>;
  destroy: () => Promise<void>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function createSandbox(options: SandboxOptions): Promise<SandboxInstance> {
  const { repoUrl, branch = 'main', image = 'spacze/agent-node:latest' } = options;

  // Create container with resource limits
  const container = await docker.createContainer({
    Image: image,
    Cmd: ['sleep', 'infinity'], // Keep alive for agent to use
    HostConfig: {
      Memory: config.agent.memoryLimitMb * 1024 * 1024,
      NanoCpus: config.agent.cpuLimit * 1e9,
      NetworkMode: 'none', // No network by default
      AutoRemove: true,
    },
    WorkingDir: '/workspace',
    Env: [
      `REPO_URL=${repoUrl}`,
      `BRANCH=${branch}`,
      ...Object.entries(options.env || {}).map(([k, v]) => `${k}=${v}`),
    ],
  });

  await container.start();

  // Clone the repo
  await execInContainer(container, `git clone --depth 1 --branch ${branch} ${repoUrl} /workspace/repo`);

  const containerId = container.id;

  return {
    containerId,

    async exec(command: string): Promise<ExecResult> {
      return execInContainer(container, command);
    },

    async readFile(path: string): Promise<string> {
      const result = await execInContainer(container, `cat /workspace/repo/${path}`);
      if (result.exitCode !== 0) throw new Error(`Failed to read file: ${result.stderr}`);
      return result.stdout;
    },

    async writeFile(path: string, content: string): Promise<void> {
      const escaped = content.replace(/'/g, "'\\''")
      const result = await execInContainer(
        container,
        `mkdir -p "$(dirname /workspace/repo/${path})" && printf '%s' '${escaped}' > /workspace/repo/${path}`
      );
      if (result.exitCode !== 0) throw new Error(`Failed to write file: ${result.stderr}`);
    },

    async listFiles(path = '.'): Promise<string[]> {
      const result = await execInContainer(
        container,
        `find /workspace/repo/${path} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sort`
      );
      return result.stdout.split('\n').filter(Boolean).map(f => f.replace('/workspace/repo/', ''));
    },

    async destroy(): Promise<void> {
      try {
        await container.stop({ t: 5 });
      } catch {
        // Container might already be stopped
      }
      try {
        await container.remove({ force: true });
      } catch {
        // AutoRemove might have already cleaned up
      }
    },
  };
}

async function execInContainer(container: Docker.Container, command: string): Promise<ExecResult> {
  const exec = await container.exec({
    Cmd: ['bash', '-c', command],
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: '/workspace/repo',
  });

  const stream = await exec.start({ Detach: false, Tty: false });

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    docker.modem.demuxStream(stream, 
      { write: (chunk: Buffer) => { stdout += chunk.toString(); } },
      { write: (chunk: Buffer) => { stderr += chunk.toString(); } }
    );

    stream.on('end', async () => {
      const inspect = await exec.inspect();
      resolve({
        exitCode: inspect.ExitCode ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}
