// Connection
export { GorbChainConnection } from './connection/GorbChainConnection';
export type { GorbChainConnectionConfig } from './connection/GorbChainConnection';

// Token Operations
export { TokenMinter } from './token/TokenMinter';
export type { 
  MintTokenParams, 
  CreateTokenParams, 
  TokenInfo 
} from './token/TokenMinter';

// Constants and Utils
export {
  GORBCHAIN_RPC_ENDPOINT,
  GORBCHAIN_EXPLORER,
  GORBCHAIN_TOKEN_2022_PROGRAM_ID,
  GORBCHAIN_ATA_PROGRAM_ID,
  GORBCHAIN_SPL_TOKEN_PROGRAM_ID,
  DEFAULT_DECIMALS,
  DEFAULT_COMMITMENT,
  TOKEN_2022_INSTRUCTIONS,
  ERROR_MESSAGES
} from './utils/constants';

// Import types for internal use
import { GorbChainConnection, GorbChainConnectionConfig } from './connection/GorbChainConnection';
import { TokenMinter } from './token/TokenMinter';

// Easy-to-use combined interface
export class GorbChainSDK {
  public connection: GorbChainConnection;
  public tokenMinter: TokenMinter;

  constructor(config?: GorbChainConnectionConfig) {
    this.connection = new GorbChainConnection(config);
    this.tokenMinter = new TokenMinter(this.connection);
  }

  // Quick health check
  async isReady(): Promise<boolean> {
    return await this.connection.isHealthy();
  }

  // Get network info
  async getNetworkInfo() {
    const connection = this.connection.getConnection();
    const version = await connection.getVersion();
    const slot = await this.connection.getCurrentSlot();
    
    return {
      rpcEndpoint: this.connection.rpcEndpoint,
      version,
      currentSlot: slot,
      commitment: this.connection.commitment
    };
  }
} 