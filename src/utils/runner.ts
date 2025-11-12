/**
 * 进程启动和管理工具
 * 遵循 SRP 原则：只负责进程启动，不涉及业务逻辑
 */

import { spawn } from "node:child_process";
import type { LaunchCommandSpec } from "@/domain/types.ts";

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  args?: string[];
}

export interface SpawnResult {
  pid: number;
  command: string;
}

/**
 * 启动子进程
 * @param spec 命令规范
 * @param options 启动选项
 * @returns 进程 ID 和完整命令
 */
export async function spawnProcess(
  spec: LaunchCommandSpec,
  options?: SpawnOptions,
): Promise<SpawnResult> {
  // 1. 合并参数
  const args = [...spec.baseArgs];

  // 添加 yolo 参数
  if (spec.yoloArgs) {
    args.push(...spec.yoloArgs);
  }

  // 添加用户透传的额外参数
  if (options?.args) {
    args.push(...options.args);
  }

  // 2. 合并环境变量
  const env = {
    ...process.env,
    ...spec.envVars,
    ...options?.env,
  };

  // 3. 启动进程
  const child = spawn(spec.executable, args, {
    cwd: options?.cwd ?? process.cwd(),
    env,
    stdio: "inherit", // 继承父进程的标准输入输出
    detached: false,
  });

  // 构建完整命令字符串（用于日志）
  const command = `${spec.executable} ${args.join(" ")}`;

  // 等待进程启动
  return new Promise((resolve, reject) => {
    child.on("error", (error) => {
      reject(new Error(`Failed to spawn process: ${error.message}`));
    });

    // 进程成功启动后立即返回
    child.on("spawn", () => {
      resolve({
        pid: child.pid!,
        command,
      });
    });

    // 如果进程立即退出（如命令不存在），视为错误
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

/**
 * 检查可执行文件是否存在于 PATH 中
 * @param name 可执行文件名
 * @returns 是否存在
 */
export async function checkExecutable(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const command = process.platform === "win32" ? "where" : "which";
    const child = spawn(command, [name], {
      stdio: "ignore",
    });

    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

/**
 * 获取可执行文件的版本信息
 * @param executable 可执行文件名
 * @param versionArgs 版本参数（默认 --version）
 * @returns 版本字符串
 */
export async function getExecutableVersion(
  executable: string,
  versionArgs: string[] = ["--version"],
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";

    const child = spawn(executable, versionArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data) => {
      output += data.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to get version: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error("Failed to get version"));
      }
    });
  });
}
