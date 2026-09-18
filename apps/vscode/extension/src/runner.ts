import { execFile } from "node:child_process";
export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}
export interface AnsibleCommandRunner {
  execute(command: string, args: string[], cwd: string): Promise<CommandResult>;
}
export class ExtensionHostRunner implements AnsibleCommandRunner {
  execute(
    command: string,
    args: string[],
    cwd: string,
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          cwd,
          shell: false,
          timeout: 30000,
          maxBuffer: 1_000_000,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (error && typeof error.code !== "number") {
            reject(
              new Error(
                `Validation tool could not run: ${error.code ?? "timeout"}. Check the executable in the active Extension Host.`,
              ),
            );
            return;
          }
          resolve({
            stdout,
            stderr,
            code: typeof error?.code === "number" ? error.code : 0,
          });
        },
      );
    });
  }
}
