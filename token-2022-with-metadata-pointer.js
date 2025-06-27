const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} = require('@solana/web3.js');

const {
  getMinimumBalanceForRentExemptMint,
} = require('@solana/spl-token');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const WS_ENDPOINT = 'wss://rpc.gorbchain.xyz/ws/';
const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  wsEndpoint: WS_ENDPOINT,
  disableRetryOnRateLimit: false,
});

// Custom Token-2022 Program ID for GorbChain (with our fix)
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');

// Helper function to load keypair
function loadKeypair() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('❌ Could not load wallet-keypair.json');
    throw new Error('Please ensure wallet-keypair.json exists in the current directory');
  }
}

// Load wallet
const WALLET_KEYPAIR = loadKeypair();

// Token-2022 Extension Types
const EXTENSION_TYPE_METADATA_POINTER = 18;
const EXTENSION_TYPE_TOKEN_METADATA = 19;

// Calculate space needed for extensions
function getExtensionSpace() {
  // Base mint size: 82 bytes
  // MetadataPointer extension: 32 bytes (type + length + authority + metadata address)
  // TokenMetadata extension: variable size based on metadata content
  const baseSize = 82;
  const metadataPointerSize = 32;
  const tokenMetadataSize = 256; // Estimated for our metadata
  return baseSize + metadataPointerSize + tokenMetadataSize;
}

// Create metadata pointer extension data
function createMetadataPointerExtension(authority, metadataAddress) {
  const data = Buffer.alloc(32);
  let offset = 0;
  
  // Extension type (2 bytes)
  data.writeUInt16LE(EXTENSION_TYPE_METADATA_POINTER, offset);
  offset += 2;
  
  // Extension length (2 bytes)
  data.writeUInt16LE(28, offset); // 32 bytes total - 4 bytes header
  offset += 2;
  
  // Authority (32 bytes) - optional, can be null
  if (authority) {
    authority.toBuffer().copy(data, offset);
  }
  offset += 32;
  
  // Metadata address (32 bytes) - points to the mint itself for embedded metadata
  metadataAddress.toBuffer().copy(data, offset - 32);
  
  return data;
}

// Create token metadata extension data
function createTokenMetadataExtension(metadata) {
  const nameBytes = Buffer.from(metadata.name, 'utf8');
  const symbolBytes = Buffer.from(metadata.symbol, 'utf8');
  const uriBytes = Buffer.from(metadata.uri || '', 'utf8');
  
  // Calculate total size
  const headerSize = 8; // type (2) + length (2) + update_authority (32) + mint (32)
  const metadataSize = 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length;
  const totalSize = headerSize + metadataSize;
  
  const data = Buffer.alloc(totalSize);
  let offset = 0;
  
  // Extension type (2 bytes)
  data.writeUInt16LE(EXTENSION_TYPE_TOKEN_METADATA, offset);
  offset += 2;
  
  // Extension length (2 bytes)
  data.writeUInt16LE(totalSize - 4, offset);
  offset += 2;
  
  // Update authority (32 bytes)
  WALLET_KEYPAIR.publicKey.toBuffer().copy(data, offset);
  offset += 32;
  
  // Name length + name
  data.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(data, offset);
  offset += nameBytes.length;
  
  // Symbol length + symbol  
  data.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(data, offset);
  offset += symbolBytes.length;
  
  // URI length + URI
  data.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(data, offset);
  
  return data;
}

async function createToken2022WithMetadata() {
  try {
    console.log('🚀 Creating Token-2022 with Metadata Pointer Extension...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🪙 New Token-2022 mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);

    // Token metadata
    const tokenMetadata = {
      name: "GorbChain Advanced Token",
      symbol: "GADV",
      uri: "https://gorbchain.xyz/tokens/gadv.json",
      decimals: 9,
      totalSupply: 5000,
      description: "Advanced Token-2022 with proper metadata pointer extension on GorbChain"
    };

    console.log('📋 Token Metadata (On-Chain):');
    console.log(`   Name: ${tokenMetadata.name}`);
    console.log(`   Symbol: ${tokenMetadata.symbol}`);
    console.log(`   URI: ${tokenMetadata.uri}`);
    console.log(`   Decimals: ${tokenMetadata.decimals}`);
    console.log(`   Total Supply: ${tokenMetadata.totalSupply}`);

    // Calculate space needed
    const mintSpace = getExtensionSpace();
    console.log(`📊 Mint space needed: ${mintSpace} bytes (with extensions)`);
    
    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(mintSpace);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Create transaction
    const transaction = new Transaction();
    
    // 1. Create mint account with extensions
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintSpace,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );

    // 2. Initialize Metadata Pointer Extension
    console.log('🔧 Adding metadata pointer extension...');
    const metadataPointerData = createMetadataPointerExtension(
      WALLET_KEYPAIR.publicKey, // authority
      mintKeypair.publicKey     // metadata address (self-referencing)
    );
    
    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
        ],
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
        data: Buffer.concat([
          Buffer.from([24]), // InitializeMetadataPointer instruction
          metadataPointerData
        ]),
      })
    );

    // 3. Initialize Token Metadata Extension
    console.log('🔧 Adding token metadata extension...');
    const tokenMetadataData = createTokenMetadataExtension(tokenMetadata);
    
    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
          { pubkey: WALLET_KEYPAIR.publicKey, isSigner: true, isWritable: false }, // update authority
        ],
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
        data: Buffer.concat([
          Buffer.from([39]), // InitializeTokenMetadata instruction
          tokenMetadataData
        ]),
      })
    );

    // 4. Initialize Mint
    console.log('🔧 Initializing mint...');
    const initMintKeys = [
      { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ];

    const initMintData = Buffer.alloc(67);
    initMintData[0] = 0; // InitializeMint instruction
    initMintData[1] = tokenMetadata.decimals; // decimals
    WALLET_KEYPAIR.publicKey.toBuffer().copy(initMintData, 2); // mint authority
    initMintData[34] = 1; // freeze authority option (some)
    WALLET_KEYPAIR.publicKey.toBuffer().copy(initMintData, 35); // freeze authority

    transaction.add(
      new TransactionInstruction({
        keys: initMintKeys,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
        data: initMintData,
      })
    );

    console.log('📤 Sending transaction...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [WALLET_KEYPAIR, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');
    
    console.log('🎉 SUCCESS! Token-2022 with Metadata Pointer created!');
    console.log('=' .repeat(80));
    console.log(`🪙 Token Name: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
    console.log(`🆔 Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`📊 Decimals: ${tokenMetadata.decimals}`);
    console.log(`💰 Total Supply: ${tokenMetadata.totalSupply} tokens`);
    console.log(`🔗 Metadata URI: ${tokenMetadata.uri}`);
    console.log(`👨‍💻 Mint Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log(`📋 Extensions: Metadata Pointer ✅, Token Metadata ✅`);
    console.log('=' .repeat(80));

    // Save mint information
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: WALLET_KEYPAIR.publicKey.toString(),
      decimals: tokenMetadata.decimals,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      signature: signature,
      metadata: tokenMetadata,
      extensions: ['MetadataPointer', 'TokenMetadata'],
      createdAt: new Date().toISOString(),
      type: 'token-2022-with-metadata-pointer'
    };

    fs.writeFileSync('token-2022-metadata-pointer-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 Token-2022 with metadata pointer info saved to token-2022-metadata-pointer-info.json');

    return {
      signature: signature,
      mintAddress: mintKeypair.publicKey.toString(),
      metadata: tokenMetadata,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      extensions: ['MetadataPointer', 'TokenMetadata']
    };

  } catch (error) {
    console.error('❌ Error creating Token-2022 with metadata pointer:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  console.log('🎯 Creating Token-2022 with Metadata Pointer Extension...');
  
  try {
    await createToken2022WithMetadata();
    console.log('\n✅ Token-2022 with metadata pointer creation completed successfully!');
    console.log('💡 This token now has proper on-chain metadata visible in explorers');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Token-2022 with metadata pointer creation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createToken2022WithMetadata, connection, CUSTOM_TOKEN_2022_PROGRAM_ID }; 