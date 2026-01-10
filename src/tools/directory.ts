import type { ObsidianClient } from '../client/obsidian.js';
import type { ToolResult } from '../types/index.js';
import type { CreateDirectoryArgs, CreateDirectoryData } from '../types/tools.js';

export async function createDirectory(
  client: ObsidianClient,
  args: CreateDirectoryArgs
): Promise<ToolResult> {
  try {
    if (!args.path) {
      return {
        success: false,
        error: 'path parameter is required',
      };
    }

    // Validate no trailing slash in user input (we add it)
    if (args.path.endsWith('/')) {
      return {
        success: false,
        error: 'Path must not end with / (use "Notes" not "Notes/")',
      };
    }

    const { created } = await client.createDirectory(args.path);

    // FIX: Create keep.md to prevent 404 errors on empty folders
    // The Obsidian API may return 404 if a folder is empty, so we ensure it contains at least one file.
    if (created) {
      try {
        await client.writeFile(`${args.path}/keep.md`, '');
      } catch (writeError) {
        console.warn(`Failed to create keep.md in ${args.path}:`, writeError);
        // We continue even if this fails, as the directory itself was created
      }
    }

    const data: CreateDirectoryData = {
      path: args.path,
      created,
      message: created
        ? `Directory created: ${args.path}/ (initialized with keep.md)`
        : `Directory already exists: ${args.path}/`,
    };

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
