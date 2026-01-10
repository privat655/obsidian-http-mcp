import axios, { type AxiosInstance } from 'axios';

export class ObsidianClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  private validatePath(path: string): void {
    // Decode URL encoding to prevent bypass via %2e%2e
    const decoded = decodeURIComponent(path);
    if (decoded.includes('..') || decoded.startsWith('/') || decoded.includes('//')) {
      throw new Error('Invalid path: traversal not allowed');
    }
  }

  private encodePath(path: string): string {
    // Encode each path segment separately to preserve '/' separators
    // Handles emojis, spaces, special chars (e.g., "🧪Test.md" → "%F0%9F%A7%AATest.md")
    return path.split('/').map(segment =>
      segment ? encodeURIComponent(segment) : ''
    ).join('/');
  }

  async listVault(path: string = ''): Promise<{ files: string[]; folders: string[] }> {
    this.validatePath(path);
    // Add trailing / for directory listing (API requirement)
    const dirPath = path && !path.endsWith('/') ? `${path}/` : path;
    const encoded = this.encodePath(dirPath);
    const response = await this.client.get(`/vault/${encoded}`);

    // Obsidian API returns { files: [...] } where files contains BOTH files and folders
    // Folders end with '/', files do not
    const items: string[] = response.data.files || [];

    const files = items.filter(item => !item.endsWith('/'));
    const folders = items
      .filter(item => item.endsWith('/'))
      .map(folder => folder.slice(0, -1)); // Remove trailing '/'

    return { files, folders };
  }

  async readFile(path: string): Promise<string> {
    this.validatePath(path);
    const encoded = this.encodePath(path);
    const response = await this.client.get(`/vault/${encoded}`);
    return response.data;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.validatePath(path);
    const encoded = this.encodePath(path);
    try {
          await this.client.put(`/vault/${encoded}`, content, {
            headers: { 'Content-Type': 'text/markdown' },
          });
        } catch (error: any) {
          if (error.response) {
            console.error(`[DEBUG] Obsidian API Error ${error.response.status} for ${path}`);
            console.error(`[DEBUG] Response Data:`, JSON.stringify(error.response.data, null, 2));
          }
          throw error;
        }

  async appendFile(path: string, content: string): Promise<void> {
    this.validatePath(path);
    const encoded = this.encodePath(path);
    await this.client.patch(`/vault/${encoded}`, content, {
      headers: { 'Content-Type': 'text/markdown' },
    });
  }

  async deleteFile(path: string): Promise<void> {
    this.validatePath(path);
    const encoded = this.encodePath(path);
    await this.client.delete(`/vault/${encoded}`);
  }

  async fileExists(path: string): Promise<boolean> {
    this.validatePath(path);
    const encoded = this.encodePath(path);
    try {
      await this.client.get(`/vault/${encoded}`);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(path: string): Promise<{ size: number; modified: string }> {
    this.validatePath(path);
    const encoded = this.encodePath(path);

    const response = await this.client.get(`/vault/${encoded}`, {
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status === 404) {
      throw new Error('File not found');
    }

    // Extract from headers (fallback if not available)
    const size = parseInt(response.headers['content-length'] || '0', 10);
    const modified = response.headers['last-modified'] || '';

    return { size, modified };
  }

  async createDirectory(path: string): Promise<{ created: boolean }> {
    this.validatePath(path);

    // Force trailing slash for directory
    const dirPath = path.endsWith('/') ? path : `${path}/`;
    const encoded = this.encodePath(dirPath);

    // Check if exists first
    const exists = await this.directoryExists(dirPath);

    if (!exists) {
      // PUT empty content to create directory
      await this.client.put(`/vault/${encoded}`, '', {
        headers: { 'Content-Type': 'text/plain' },
      });
      return { created: true };
    }

    return { created: false };
  }

  async directoryExists(path: string): Promise<boolean> {
    try {
      const dirPath = path.endsWith('/') ? path : `${path}/`;
      const encoded = this.encodePath(dirPath);
      
      // FIX: Capture response and verify status is 200
      const response = await this.client.get(`/vault/${encoded}`, {
        validateStatus: (status) => status === 200 || status === 404,
      });
      
      // If status is 200, it exists. If 404, it does not.
      return response.status === 200;
      
    } catch (error) {
      // Only catch if actual error (not 404 which is handled above)
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }
}
