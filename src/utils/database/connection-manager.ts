import { ClickHouseClient, createClient } from '@clickhouse/client'
// Internal implementation of crypto functionality

const generateHash = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

/**
 * Custom error class for connection-related errors
 */
export class ConnectionError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly isRetryable: boolean = true,
  ) {
    super(message)
    this.name = 'ConnectionError'
  }
}

/**
 * Interface for connection credentials
 */
export interface ConnectionCredentials {
  url: string
  username?: string
  password?: string
  database?: string
}

export interface ConnectionConfig<
  TCredentials extends ConnectionCredentials = ConnectionCredentials,
> {
  credentials: TCredentials
  options?: {
    keepAlive?: boolean
    // Connection timeout settings
    requestTimeout?: number // milliseconds
    // Keep-alive settings
    keepAliveTimeout?: number // milliseconds
    // Connection pool settings
    maxConnections?: number
    // Retry settings
    maxRetries?: number
    retryDelay?: number // milliseconds
  }
}

/**
 * Generic connection manager that supports multi-tenancy
 */
export class ConnectionManager<
  TCredentials extends ConnectionCredentials = ConnectionCredentials,
> {
  private static instances = new Map<string, ConnectionManager>()
  private static defaultInstance: ConnectionManager | null = null
  private client: ClickHouseClient | null = null
  private readonly config: ConnectionConfig<TCredentials>
  private isInitializing: boolean = false
  private lastError: Error | null = null

  private constructor(config: ConnectionConfig<TCredentials>) {
    this.config = config
  }

  public getConfig(): ConnectionConfig<TCredentials> {
    return this.config
  }

  public static setDefault(
    config: ConnectionConfig<ConnectionCredentials>,
  ): void {
    this.defaultInstance = new ConnectionManager(config)
  }

  public static getDefault(): ConnectionManager {
    if (!this.defaultInstance) {
      throw new Error('Default connection configuration not set')
    }
    return this.defaultInstance
  }

  public static async createDatabase(name: string): Promise<void> {
    await this.getDefault().with((client) => {
      return client.query({
        query: `CREATE DATABASE IF NOT EXISTS ${name}`,
      })
    })
  }

  /**
   * Get a connection manager instance for a specific host
   */
  public static getInstance<T extends ConnectionCredentials>(
    config: ConnectionConfig<T>,
  ): ConnectionManager<T> {
    const hash = generateHash(JSON.stringify(config.credentials))

    if (!this.instances.has(hash)) {
      this.instances.set(hash, new ConnectionManager<T>(config))
    }
    return this.instances.get(hash) as ConnectionManager<T>
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false

    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toLowerCase() || ''

    // Network-related errors that are typically retryable
    const retryablePatterns = [
      'aborted',
      'econnreset',
      'econnrefused',
      'enetunreach',
      'etimedout',
      'ehostunreach',
      'socket hang up',
      'connection closed',
      'connection timeout',
      'read timeout',
      'write timeout',
      'tls handshake',
      'certificate',
      'network error',
      'connection refused',
    ]

    return retryablePatterns.some(
      (pattern) =>
        errorMessage.includes(pattern) || errorCode.includes(pattern),
    )
  }

  /**
   * Initialize the client if it doesn't exist
   */
  private async initializeClient(): Promise<ClickHouseClient> {
    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      if (this.client) {
        return this.client
      }
    }

    if (!this.client) {
      this.isInitializing = true
      try {
        const { credentials, options } = this.config

        this.client = createClient({
          url: credentials.url,
          username: credentials.username,
          password: credentials.password,
          database: credentials.database,
          keep_alive: {
            enabled: options?.keepAlive ?? true,
            idle_socket_ttl: options?.keepAliveTimeout,
          },
          request_timeout: options?.requestTimeout,
          max_open_connections: options?.maxConnections,
        })

        this.lastError = null
      } catch (error) {
        this.lastError = error as Error
        throw new ConnectionError(
          `Failed to initialize ClickHouse client: ${(error as Error).message}`,
          error as Error,
          false,
        )
      } finally {
        this.isInitializing = false
      }
    }

    return this.client
  }

  /**
   * Reset the client connection
   */
  private async resetClient(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close()
      } catch (error) {
        console.warn('Error closing client', error)
        // Ignore errors when closing a potentially broken connection
      }
      this.client = null
    }
  }

  /**
   * Execute operations within a connection context with retry logic
   */
  public async with<T>(
    operation: (client: ClickHouseClient) => Promise<T>,
  ): Promise<T> {
    const maxRetries = this.config.options?.maxRetries ?? 3
    const retryDelay = this.config.options?.retryDelay ?? 1000

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const client = await this.initializeClient()
        return await operation(client)
      } catch (error) {
        lastError = error as Error

        // Check if this is a retryable error
        if (this.isRetryableError(error) && attempt < maxRetries) {
          console.warn(
            `Connection attempt ${attempt + 1} failed: ${(error as Error).message}. Retrying...`,
          )

          // Reset the client for the next attempt
          await this.resetClient()

          // Wait before retrying
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * (attempt + 1)),
            )
          }

          continue
        }

        // If it's not retryable or we've exhausted retries, throw the error
        if (this.isRetryableError(error)) {
          throw new ConnectionError(
            `Operation failed after ${maxRetries + 1} attempts. Last error: ${(error as Error).message}`,
            error as Error,
            false,
          )
        } else {
          throw new ConnectionError(
            `Operation failed: ${(error as Error).message}`,
            error as Error,
            false,
          )
        }
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Unknown error occurred')
  }

  public static getDefaultOrCreate(
    config?: ConnectionConfig<ConnectionCredentials>,
  ): ConnectionManager {
    if (config) {
      return this.getInstance(config)
    }
    return this.getDefault()
  }

  /**
   * Close the current connection
   */
  public async close(): Promise<void> {
    await this.resetClient()
  }

  /**
   * Close all connections across all connections
   */
  public static async closeAll(): Promise<void> {
    const closePromises = Array.from(this.instances.values()).map((instance) =>
      instance.close(),
    )
    await Promise.all(closePromises)
    this.instances.clear()
  }

  /**
   * Get the current client instance
   * @throws Error if client is not initialized
   */
  public getClient(): ClickHouseClient {
    if (!this.client) {
      throw new Error(
        'Client not initialized. Please use "with" method to ensure proper connection handling.',
      )
    }
    return this.client
  }

  /**
   * Get the last error that occurred
   */
  public getLastError(): Error | null {
    return this.lastError
  }

  /**
   * Check if the connection is healthy
   */
  public async isHealthy(): Promise<boolean> {
    try {
      await this.with(async (client) => {
        await client.query({ query: 'SELECT 1' })
      })
      return true
    } catch (error) {
      console.warn('Error checking health', error)
      return false
    }
  }
}

/**
 * Connection manager factory for creating typed connection managers
 */
export function createConnectionManager<T extends ConnectionCredentials>(
  config: ConnectionConfig<T>,
): ConnectionManager<T> {
  return ConnectionManager.getInstance<T>(config)
}
