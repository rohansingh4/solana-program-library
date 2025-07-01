import { Connection, Commitment, ConnectionConfig, sendAndConfirmTransaction } from '@solana/web3.js';
import { GORBCHAIN_RPC_ENDPOINT, DEFAULT_COMMITMENT } from '../utils/constants';

export interface GorbChainConnectionConfig {
  rpcEndpoint?: string;
  commitment?: Commitment;
  disableRetryOnRateLimit?: boolean;
  wsEndpoint?: string;
}

export class GorbChainConnection {
  private connection: Connection;
  public readonly rpcEndpoint: string;
  public readonly commitment: Commitment;

  constructor(config: GorbChainConnectionConfig = {}) {
    this.rpcEndpoint = config.rpcEndpoint || GORBCHAIN_RPC_ENDPOINT;
    this.commitment = config.commitment || DEFAULT_COMMITMENT;

    const connectionConfig: ConnectionConfig = {
      commitment: this.commitment,
      disableRetryOnRateLimit: config.disableRetryOnRateLimit ?? false,
      wsEndpoint: config.wsEndpoint,
    };

    this.connection = new Connection(this.rpcEndpoint, connectionConfig);
  }

  /**
   * Get the underlying Solana web3.js Connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Check if the connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.connection.getVersion();
      return true;
    } catch (error) {
      console.error('GorbChain connection health check failed:', error);
      return false;
    }
  }

  /**
   * Get the current slot
   */
  async getCurrentSlot(): Promise<number> {
    return await this.connection.getSlot(this.commitment);
  }

  /**
   * Get recent blockhash
   */
  async getLatestBlockhash() {
    return await this.connection.getLatestBlockhash(this.commitment);
  }

  /**
   * Get minimum balance for rent exemption
   */
  async getMinimumBalanceForRentExemption(size: number): Promise<number> {
    return await this.connection.getMinimumBalanceForRentExemption(size);
  }

  /**
   * Send and confirm a transaction
   */
  async sendAndConfirmTransaction(transaction: any, signers: any[], options?: any) {
    return await sendAndConfirmTransaction(this.connection, transaction, signers, options);
  }

  /**
   * Send a raw transaction
   */
  async sendRawTransaction(rawTransaction: Buffer | Uint8Array | Array<number>, options?: any) {
    return await this.connection.sendRawTransaction(rawTransaction, options);
  }

  /**
   * Get transaction status
   */
  async getSignatureStatus(signature: string) {
    return await this.connection.getSignatureStatus(signature);
  }

  /**
   * Confirm transaction manually with retry logic
   */
  async confirmTransaction(signature: string, maxRetries: number = 30): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const status = await this.getSignatureStatus(signature);
        
        if (status?.value?.confirmationStatus === 'confirmed' || 
            status?.value?.confirmationStatus === 'finalized') {
          return status.value;
        }
        
        if (status?.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        
        // Wait 2 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Transaction confirmation timeout');
  }

  /**
   * Get account info
   */
  async getAccountInfo(publicKey: any, commitment?: Commitment) {
    return await this.connection.getAccountInfo(publicKey, commitment || this.commitment);
  }

  /**
   * Get token accounts by owner using custom program ID
   */
  async getTokenAccountsByOwner(owner: any, filter: any, commitment?: Commitment) {
    return await this.connection.getTokenAccountsByOwner(
      owner, 
      filter, 
      commitment || this.commitment
    );
  }

  /**
   * Get program accounts with filters
   */
  async getProgramAccounts(programId: any, config?: any) {
    return await this.connection.getProgramAccounts(programId, config);
  }

  /**
   * Get balance for an address
   */
  async getBalance(publicKey: any, commitment?: Commitment): Promise<number> {
    return await this.connection.getBalance(publicKey, commitment || this.commitment);
  }
} 