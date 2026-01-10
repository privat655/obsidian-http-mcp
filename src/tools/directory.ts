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

    // Validate no trailing slash in user input
    if (args.path.endsWith('/')) {
      return {
        success: false,
        error: 'Path must not end with / (use "Notes" not "Notes/")',
      };
    }

    // 1. Check if directory exists
    // We use the fixed directoryExists method you updated in the previous step
    const exists = await client.directoryExists(args.path);

    if (exists) {
      const data: CreateDirectoryData = {
        path: args.path,
        created: false,
        message: `Directory already exists: ${args.path}/`,
      };
      
      return {
        success: true,
        data: data, // Some MCP clients look at data
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    // 2. Create the directory by creating keep.md
    // We bypass client.createDirectory() entirely because PUT /vault/folder/ 
    // throws a 405 Method Not Allowed error on some API versions.
    // Creating a file implicitly creates the parent directories in Obsidian.
    await client.writeFile(`${args.path}/keep.md`, '');

    const data: CreateDirectoryData = {
      path: args.path,
      created: true,
      message: `Directory created: ${args.path}/ (initialized with keep.md)`,
    };

    return {
      success: true,
      data: data,
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
