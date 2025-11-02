import type { ObsidianClient } from '../client/obsidian.js';
import type { ToolResult, SearchMatch } from '../types/index.js';
import { walkVault } from './find.js';

export async function search(
  client: ObsidianClient,
  args: {
    query: string;
    case_sensitive?: boolean;
    regex?: boolean;
    max_results?: number;
  }
): Promise<ToolResult> {
  try {
    if (!args.query) {
      return {
        success: false,
        error: 'query parameter is required',
      };
    }

    const allFiles = await walkVault(client);
    const mdFiles = allFiles.filter((f) => f.endsWith('.md'));

    const matches: SearchMatch[] = [];
    const maxResults = args.max_results || 100;
    const caseSensitive = args.case_sensitive || false;
    const useRegex = args.regex || false;

    let pattern: RegExp;
    try {
      pattern = useRegex
        ? new RegExp(args.query, caseSensitive ? 'g' : 'gi')
        : new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    } catch {
      return {
        success: false,
        error: 'Invalid regex pattern',
      };
    }

    for (const file of mdFiles) {
      if (matches.length >= maxResults) break;

      try {
        const content = await client.readFile(file);
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) break;

          if (pattern.test(lines[i])) {
            matches.push({
              file,
              line: i + 1,
              content: lines[i],
              context_before: i > 0 ? lines[i - 1] : undefined,
              context_after: i < lines.length - 1 ? lines[i + 1] : undefined,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read, but log the error for debugging
        console.error(`Failed to read file ${file}:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    return {
      success: true,
      data: {
        matches,
        total_matches: matches.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
