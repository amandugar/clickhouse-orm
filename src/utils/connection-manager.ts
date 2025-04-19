import { ClickHouseClient, createClient } from "@clickhouse/client"

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
  TCredentials extends ConnectionCredentials = ConnectionCredentials
> {
  credentials: TCredentials
  options?: {
    keepAlive?: boolean
  }
}

/**
 * Generic connection manager that supports multi-tenancy
 */
export class ConnectionManager<
  TCredentials extends ConnectionCredentials = ConnectionCredentials
> {
  private static instances = new Map<string, ConnectionManager>()
  private static defaultInstance: ConnectionManager | null = null
  private client: ClickHouseClient | null = null
  private readonly config: ConnectionConfig<TCredentials>

  private constructor(config: ConnectionConfig<TCredentials>) {
    this.config = config
  }

  public static setDefault(
    config: ConnectionConfig<ConnectionCredentials>
  ): void {
    this.defaultInstance = new ConnectionManager(config)
  }

  public static getDefault(): ConnectionManager {
    if (!this.defaultInstance) {
      throw new Error("Default connection configuration not set")
    }
    return this.defaultInstance
  }

  public static createDatabase(name: string): void {
    this.getDefault().with(client => {
      return client.query({
        query: `CREATE DATABASE IF NOT EXISTS ${name}`,
      })
    })
  }

  /**
   * Get a connection manager instance for a specific host
   */
  public static getInstance<T extends ConnectionCredentials>(
    config: ConnectionConfig<T>
  ): ConnectionManager<T> {
    if (!this.instances.has(config.credentials.url)) {
      this.instances.set(
        config.credentials.url,
        new ConnectionManager<T>(config)
      )
    }
    return this.instances.get(config.credentials.url) as ConnectionManager<T>
  }

  /**
   * Initialize the client if it doesn't exist
   */
  private async initializeClient(): Promise<ClickHouseClient> {
    if (!this.client) {
      const { credentials, options } = this.config

      this.client = createClient({
        url: credentials.url,
        username: credentials.username,
        password: credentials.password,
        database: credentials.database,
        keep_alive: {
          enabled: options?.keepAlive ?? true,
        },
      })
    }

    return this.client
  }

  /**
   * Execute operations within a connection context
   */
  public async with<T>(
    operation: (client: ClickHouseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.initializeClient()
    try {
      return await operation(client)
    } catch (error) {
      // Re-throw the error but you might want to add logging or error transformation here
      throw error
    }
  }

  /**
   * Close the current connection
   */
  public async close(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }

  /**
   * Close all connections across all connections
   */
  public static async closeAll(): Promise<void> {
    const closePromises = Array.from(this.instances.values()).map(instance =>
      instance.close()
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
        'Client not initialized. Please use "with" method to ensure proper connection handling.'
      )
    }
    return this.client
  }
}

/**
 * Connection manager factory for creating typed connection managers
 */
export function createConnectionManager<T extends ConnectionCredentials>(
  config: ConnectionConfig<T>
): ConnectionManager<T> {
  return ConnectionManager.getInstance<T>(config)
}
