const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
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

// Custom Program IDs for GorbChain
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const CUSTOM_ATA_PROGRAM_ID = new PublicKey('4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc');

// Token-2022 mint size
const TOKEN_2022_MINT_SIZE = 82;

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

async function createNewTokenWithATA() {
  try {
    console.log('🚀 Creating New Token-2022 with ATA Support...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🪙 New Token mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔗 ATA Program: ${CUSTOM_ATA_PROGRAM_ID.toString()}`);

    // New token metadata with fresh details
    const tokenMetadata = {
      name: "GorbChain Utility Token",
      symbol: "GUTIL",
      description: "A utility token for GorbChain ecosystem with full ATA support and Token-2022 features",
      decimals: 8,
      totalSupply: 10000,
      creator: "GorbChain Foundation",
      category: "Utility",
      features: ["ATA Support", "Token-2022", "Transferable", "Mintable"],
      website: "https://gorbchain.xyz",
      twitter: "@gorbchain",
      telegram: "t.me/gorbchain",
      createdAt: new Date().toISOString(),
      network: "GorbChain",
      version: "2022",
      ataSupported: true,
      ataProgramId: CUSTOM_ATA_PROGRAM_ID.toString()
    };

    console.log('📋 New Token Metadata:');
    console.log(`   🪙 Name: ${tokenMetadata.name}`);
    console.log(`   🏷️ Symbol: ${tokenMetadata.symbol}`);
    console.log(`   📝 Description: ${tokenMetadata.description}`);
    console.log(`   🔢 Decimals: ${tokenMetadata.decimals}`);
    console.log(`   💰 Total Supply: ${tokenMetadata.totalSupply.toLocaleString()}`);
    console.log(`   👨‍💻 Creator: ${tokenMetadata.creator}`);
    console.log(`   🌐 Website: ${tokenMetadata.website}`);
    console.log(`   🐦 Twitter: ${tokenMetadata.twitter}`);
    console.log(`   💬 Telegram: ${tokenMetadata.telegram}`);
    console.log(`   🔗 ATA Support: ${tokenMetadata.ataSupported ? 'YES ✅' : 'NO ❌'}`);

    // Get minimum balance for rent exemption
    const mintSpace = TOKEN_2022_MINT_SIZE;
    const lamports = await connection.getMinimumBalanceForRentExemption(mintSpace);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Create transaction
    const transaction = new Transaction().add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintSpace,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize mint with Token-2022 program
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenMetadata.decimals,
        WALLET_KEYPAIR.publicKey, // mint authority
        WALLET_KEYPAIR.publicKey, // freeze authority
        CUSTOM_TOKEN_2022_PROGRAM_ID
      )
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
    
    console.log('🎉 SUCCESS! New Token with ATA Support created!');
    console.log('=' .repeat(80));
    console.log(`🪙 Token Name: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
    console.log(`🆔 Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔗 ATA Program: ${CUSTOM_ATA_PROGRAM_ID.toString()}`);
    console.log(`📊 Decimals: ${tokenMetadata.decimals}`);
    console.log(`💰 Total Supply: ${tokenMetadata.totalSupply.toLocaleString()} tokens`);
    console.log(`👨‍💻 Mint Authority: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log(`🌐 Network: ${tokenMetadata.network}`);
    console.log(`📅 Created: ${tokenMetadata.createdAt}`);
    console.log(`🔗 ATA Ready: YES - Use ${CUSTOM_ATA_PROGRAM_ID.toString()}`);
    console.log(`🌐 Website: ${tokenMetadata.website}`);
    console.log(`🐦 Social: ${tokenMetadata.twitter} | ${tokenMetadata.telegram}`);
    console.log('=' .repeat(80));

    // Save mint information with ATA details
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: WALLET_KEYPAIR.publicKey.toString(),
      decimals: tokenMetadata.decimals,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      ataProgramId: CUSTOM_ATA_PROGRAM_ID.toString(),
      signature: signature,
      metadata: tokenMetadata,
      extensions: [],
      ataSupported: true,
      createdAt: new Date().toISOString(),
      type: 'token-2022-with-ata'
    };

    fs.writeFileSync('new-token-with-ata-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 New token info saved to new-token-with-ata-info.json');

    // Also create a transfer script template
    console.log('\n🔧 Creating transfer script...');
    createTransferScript(mintInfo);

    return {
      signature: signature,
      mintAddress: mintKeypair.publicKey.toString(),
      metadata: tokenMetadata,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      ataProgramId: CUSTOM_ATA_PROGRAM_ID.toString(),
      ataSupported: true
    };

  } catch (error) {
    console.error('❌ Error creating new token with ATA:', error.message);
    throw error;
  }
}

// Create transfer script for the new token
function createTransferScript(mintInfo) {
  const transferScript = `const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} = require('@solana/web3.js');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { commitment: 'confirmed' });

// Program IDs
const TOKEN_PROGRAM_ID = new PublicKey('${mintInfo.tokenProgramId}');
const ATA_PROGRAM_ID = new PublicKey('${mintInfo.ataProgramId}');
const MINT_ADDRESS = new PublicKey('${mintInfo.mintAddress}');

// Load wallet
function loadKeypair() {
  const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Derive ATA address
function getAssociatedTokenAddress(mint, owner) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM_ID
  );
  return address;
}

async function transfer${mintInfo.metadata.symbol}(recipient, amount) {
  const wallet = loadKeypair();
  const recipientPubkey = new PublicKey(recipient);
  const ataAddress = getAssociatedTokenAddress(MINT_ADDRESS, recipientPubkey);
  
  console.log(\`🚀 Transferring \${amount} ${mintInfo.metadata.symbol} tokens...\`);
  console.log(\`🎯 Recipient: \${recipient}\`);
  console.log(\`🏦 ATA: \${ataAddress.toString()}\`);
  
  const transaction = new Transaction();
  
  // Check if ATA exists
  const ataAccount = await connection.getAccountInfo(ataAddress);
  if (!ataAccount) {
    console.log('🔧 Creating ATA...');
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: ataAddress, isSigner: false, isWritable: true },
        { pubkey: recipientPubkey, isSigner: false, isWritable: false },
        { pubkey: MINT_ADDRESS, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: ATA_PROGRAM_ID,
      data: Buffer.alloc(0),
    }));
  }
  
  // Mint tokens
  const mintAmount = amount * Math.pow(10, ${mintInfo.decimals});
  const mintData = Buffer.alloc(9);
  mintData[0] = 7; // MintTo
  mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
  
  transaction.add(new TransactionInstruction({
    keys: [
      { pubkey: MINT_ADDRESS, isSigner: false, isWritable: true },
      { pubkey: ataAddress, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: mintData,
  }));
  
  const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
  console.log(\`✅ Success! Transaction: \${signature}\`);
  return signature;
}

// Usage: node transfer-${mintInfo.metadata.symbol.toLowerCase()}.js <recipient> <amount>
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node transfer-${mintInfo.metadata.symbol.toLowerCase()}.js <recipient> <amount>');
    process.exit(1);
  }
  transfer${mintInfo.metadata.symbol}(args[0], parseFloat(args[1]));
}

module.exports = { transfer${mintInfo.metadata.symbol} };`;

  fs.writeFileSync(`transfer-${mintInfo.metadata.symbol.toLowerCase()}.js`, transferScript);
  console.log(`💾 Transfer script created: transfer-${mintInfo.metadata.symbol.toLowerCase()}.js`);
}

// CLI interface
async function main() {
  console.log('🎯 Creating new Token-2022 with full ATA support...');
  
  try {
    const result = await createNewTokenWithATA();
    console.log('\n✅ New token creation completed successfully!');
    console.log(`💡 Token: ${result.metadata.name} (${result.metadata.symbol})`);
    console.log(`💡 Mint: ${result.mintAddress}`);
    console.log(`💡 Ready for ATA-based transfers!`);
    console.log(`💡 Use: node transfer-${result.metadata.symbol.toLowerCase()}.js <recipient> <amount>`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ New token creation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createNewTokenWithATA, connection, CUSTOM_TOKEN_2022_PROGRAM_ID, CUSTOM_ATA_PROGRAM_ID }; 