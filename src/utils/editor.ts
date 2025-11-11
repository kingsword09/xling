import { spawn } from 'child_process';
import { EditorLaunchError } from './errors.ts';

const KNOWN_EDITORS: Record<string, string> = {
  vscode: 'code',
  code: 'code',
  cursor: 'cursor',
  zed: 'zed',
  sublime: 'subl',
  subl: 'subl',
};

export function resolveEditorCommand(ide?: string): string {
  if (!ide) {
    return 'code';
  }
  const normalized = ide.toLowerCase();
  return KNOWN_EDITORS[normalized] ?? ide;
}

export async function openInEditor(command: string, filePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [filePath], {
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      reject(new EditorLaunchError(command, error.message));
    });

    child.on('exit', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new EditorLaunchError(command, `Exited with code ${code}`));
      }
    });
  });
}
