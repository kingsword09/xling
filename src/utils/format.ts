/**
 * 输出格式化工具
 */

import Table from 'cli-table3';

/**
 * 格式化为 JSON 字符串
 */
export function formatJson(data: unknown, pretty = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

/**
 * 格式化为表格
 */
export function formatTable(data: Record<string, unknown>): string {
  const table = new Table({
    head: ['Key', 'Value'],
    colWidths: [30, 50],
    wordWrap: true,
  });

  for (const [key, value] of Object.entries(data)) {
    table.push([key, formatValue(value)]);
  }

  return table.toString();
}

/**
 * 格式化单个值
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * 生成 diff 预览
 */
export function generateDiff(
  oldValue: unknown,
  newValue: unknown,
  key: string,
): string {
  const lines: string[] = [];
  lines.push(`Key: ${key}`);
  lines.push(`- Old: ${formatValue(oldValue)}`);
  lines.push(`+ New: ${formatValue(newValue)}`);
  return lines.join('\n');
}
