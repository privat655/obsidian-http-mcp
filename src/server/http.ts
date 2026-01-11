import express, { type Request, type Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ObsidianClient } from '../client/obsidian.js';
import { listDir, listFiles } from '../tools/list.js';
import { readFile } from '../tools/read.js';
import { writeFile } from '../tools/write.js';
import { search } from '../tools/search.js';
import { moveFile } from '../tools/move.js';
import { deleteFile, deleteFolder } from '../tools/delete.js';
import { findFiles } from '../tools/find.js';
import { getFileInfo } from '../tools/fileinfo.js';
import { createDirectory } from '../tools/directory.js';
import { editFile } from '../tools/edit.js';
import type {
  ListDirArgs,
  ListFilesArgs,
  ReadFileArgs,
  WriteFileArgs,
  SearchArgs,
  MoveFileArgs,
  DeleteFileArgs,
  DeleteFolderArgs,
  FindFilesArgs,
  GetFileInfoArgs,
  CreateDirectoryArgs,
  EditFileArgs,
} from '../types/tools.js';
import { VERSION } from '../utils/version.js';

export function createHttpServer(client: ObsidianClient, port: number) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const mcpServer = new Server(
    {
      name: 'obsidian-http',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools/list handler
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_dir',
          description: 'List subdirectories in a path. Returns only folder names.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path WITH trailing slash (e.g., "BUSINESS/")' },
            },
          },
        },
        {
          name: 'list_files',
          description: 'List files in a directory. Returns only filenames.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path WITH trailing slash' },
              extension: { type: 'string', description: 'Filter by extension (e.g. "md")' },
            },
          },
        },
        {
          name: 'read_file',
          description: 'Read content of a file.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path (e.g., "Notes/meeting.md")' },
            },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: 'Create or update a file.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path (e.g., "Notes/daily.md")' },
              content: { type: 'string', description: 'File content' },
              mode: { type: 'string', enum: ['create', 'overwrite', 'append'] },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'search',
          description: 'Search for text inside file contents.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              case_sensitive: { type: 'boolean' },
              regex: { type: 'boolean' },
              max_results: { type: 'number' },
            },
            required: ['query'],
          },
        },
        {
          name: 'move_file',
          description: 'Move or rename a file.',
          inputSchema: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              destination: { type: 'string' },
              overwrite: { type: 'boolean' },
            },
            required: ['source', 'destination'],
          },
        },
        {
          name: 'delete_file',
          description: 'Delete a file (move to trash).',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              confirm: { type: 'boolean' },
              permanent: { type: 'boolean' },
            },
            required: ['path', 'confirm'],
          },
        },
        {
          name: 'delete_folder',
          description: 'Delete a folder recursively.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              confirm: { type: 'boolean' },
              permanent: { type: 'boolean' },
            },
            required: ['path', 'confirm'],
          },
        },
        {
          name: 'find_files',
          description: 'Fuzzy search for filenames.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              fuzzy: { type: 'boolean' },
              max_results: { type: 'number' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_file_info',
          description: 'Get file metadata.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
            },
            required: ['path'],
          },
        },
        {
          name: 'create_directory',
          description: 'Create a new directory.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path' },
            },
            required: ['path'],
          },
        },
        {
          name: 'edit_file',
          description: 'Edit file content using string replacement.',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              old_string: { type: 'string' },
              new_string: { type: 'string' },
              replace_all: { type: 'boolean' },
            },
            required: ['path', 'old_string', 'new_string'],
          },
        },
      ],
    };
  });

  // Register tools/call handler
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.log(`[DEBUG] Tool Call: ${name}`);
    console.log(`[DEBUG] Arguments:`, JSON.stringify(args, null, 2));

    let result;
    switch (name) {
      case 'list_dir': result = await listDir(client, (args || {}) as unknown as ListDirArgs); break;
      case 'list_files': result = await listFiles(client, (args || {}) as unknown as ListFilesArgs); break;
      case 'read_file': result = await readFile(client, (args || {}) as unknown as ReadFileArgs); break;
      case 'write_file': result = await writeFile(client, (args || {}) as unknown as WriteFileArgs); break;
      case 'search': result = await search(client, (args || {}) as unknown as SearchArgs); break;
      case 'move_file': result = await moveFile(client, (args || {}) as unknown as MoveFileArgs); break;
      case 'delete_file': result = await deleteFile(client, (args || {}) as unknown as DeleteFileArgs); break;
      case 'delete_folder': result = await deleteFolder(client, (args || {}) as unknown as DeleteFolderArgs); break;
      case 'find_files': result = await findFiles(client, (args || {}) as unknown as FindFilesArgs); break;
      case 'get_file_info': result = await getFileInfo(client, (args || {}) as unknown as GetFileInfoArgs); break;
      case 'create_directory': result = await createDirectory(client, (args || {}) as unknown as CreateDirectoryArgs); break;
      case 'edit_file': result = await editFile(client, (args || {}) as unknown as EditFileArgs); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }

    if (!result.success) {
      throw new Error(result.error || 'Tool execution failed');
    }

    // FIX: Unwrap JSON if a "message" field exists. 
    // This returns plain text to n8n, preventing the "reduce" error in the AI Agent.
    let textContent = '';
    
    if (result.data && typeof result.data === 'object' && 'message' in result.data) {
       // Return just the message (which now includes the path for context)
       textContent = (result.data as any).message;
    } else {
       // Fallback for tools like read_file (returns JSON/content)
       textContent = JSON.stringify(result.data, null, 2);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: textContent,
        },
      ],
    };
  });

  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => transport.close());
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        });
      }
    }
  });

  return app;
}
