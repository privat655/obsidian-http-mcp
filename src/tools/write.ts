import type { ObsidianClient } from '../client/obsidian.js';
import type { ToolResult } from '../types/index.js';
import { invalidateFilesCache } from './find.js';

export async function writeFile(
  client: ObsidianClient,
  args: { path: string; content: string; mode?: 'create' | 'overwrite' | 'append' }
): Promise<ToolResult> {
  try {
    if (!args.path || args.content === undefined) {
      return {
        success: false,
        error: 'path and content parameters are required',
      };
    }

    const mode = args.mode || 'create';
    const fileExists = await client.fileExists(args.path);

    if (mode === 'create' && fileExists) {
      return {
        success: false,
        error: `File already exists: ${args.path}. Use mode='overwrite' to replace.`,
      };
    }

    // Try to write the file
    try {
      if (mode === 'append') {
        await client.appendFile(args.path, args.content);
      } else {
        await client.writeFile(args.path, args.content);
      }
    } catch (error: any) {
      // Auto-fix: Create missing parent directories if needed
      if (error?.response?.status === 400 || error?.response?.status === 404) {
        const lastSlashIndex = args.path.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
          const parentDir = args.path.substring(0, lastSlashIndex);
          try {
             console.log(`[Auto-Fix] Creating parent directory: ${parentDir}`);
             await client.writeFile(`${parentDir}/keep.md`, '');
             
             // Retry the write
             if (mode === 'append') {
               await client.appendFile(args.path, args.content);
             } else {
               await client.writeFile(args.path, args.content);
             }
          } catch (retryError) {
             throw error; // Throw original error if retry fails
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    invalidateFilesCache();

    return {
      success: true,
      data: {
        path: args.path,
        // FIX: Include the path in the message so we can return JUST the message to the AI
        message: `Successfully ${mode === 'append' ? 'appended to' : 'wrote'} file "${args.path}"`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
