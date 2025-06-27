const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
} = require('@solana/web3.js');

const {
  getMinimumBalanceForRentExemptAccount,
  ACCOUNT_SIZE,
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

// Target recipient address
const RECIPIENT_ADDRESS = new PublicKey('5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ');

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

// Helper function to load Demo Token-2022 mint info
function loadDemoToken2022MintInfo() {
  try {
    const mintData = JSON.parse(fs.readFileSync('demo-token-2022-mint-info.json', 'utf8'));
    return {
      mintAddress: new PublicKey(mintData.mintAddress),
      mintKeypair: Keypair.fromSecretKey(new Uint8Array(mintData.mintKeypair)),
      decimals: mintData.decimals,
      metadata: mintData.metadata
    };
  } catch (error) {
    console.error('❌ Could not load demo-token-2022-mint-info.json');
    console.log('💡 Please run demo-token-2022-mint.js first to create a Demo Token-2022');
    throw new Error('Demo Token-2022 mint info not found. Run demo-token-2022-mint.js first.');
  }
}

// Function to derive Associated Token Account address
function getAssociatedTokenAddress(mint, owner, programId, associatedTokenProgramId) {
  const [address] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      programId.toBuffer(),
      mint.toBuffer(),
    ],
    associatedTokenProgramId
  );
  return address;
}

// Load wallet
const WALLET_KEYPAIR = loadKeypair();

async function transferGDEMOWithATA(amount = 100) {
  try {
    console.log('🚀 Transferring GDEMO using ATA Pattern...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🎯 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`💰 Amount to transfer: ${amount} tokens`);
    
    // Load mint information
    const mintInfo = loadDemoToken2022MintInfo();
    console.log(`🪙 Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`🆔 Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔗 ATA Program: ${CUSTOM_ATA_PROGRAM_ID.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees (need at least 0.05 SOL)');
    }

    // Derive Associated Token Account address
    const ataAddress = getAssociatedTokenAddress(
      mintInfo.mintAddress,
      RECIPIENT_ADDRESS,
      CUSTOM_TOKEN_2022_PROGRAM_ID,
      CUSTOM_ATA_PROGRAM_ID
    );
    
    console.log(`🏦 Associated Token Account: ${ataAddress.toString()}`);
    console.log('📋 This is deterministic - same address every time for this mint+owner!');

    // Check if ATA already exists
    let ataExists = false;
    try {
      const ataAccount = await connection.getAccountInfo(ataAddress);
      ataExists = ataAccount !== null;
      console.log(`🔍 ATA exists: ${ataExists ? 'YES' : 'NO'}`);
    } catch (error) {
      console.log('🔍 ATA exists: NO');
    }

    // Calculate amount with decimals
    const mintAmount = amount * Math.pow(10, mintInfo.decimals);
    console.log(`📊 Minting ${amount} tokens (${mintAmount} base units)`);

    // Create transaction
    const transaction = new Transaction();
    
    // If ATA doesn't exist, create it using our custom ATA program
    if (!ataExists) {
      console.log('🔧 Creating Associated Token Account...');
      
      // Create ATA instruction using our custom ATA program
      const createATAKeys = [
        { pubkey: WALLET_KEYPAIR.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: ataAddress, isSigner: false, isWritable: true }, // associated token account
        { pubkey: RECIPIENT_ADDRESS, isSigner: false, isWritable: false }, // owner
        { pubkey: mintInfo.mintAddress, isSigner: false, isWritable: false }, // mint
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
        { pubkey: CUSTOM_TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // token program
      ];

      transaction.add(
        new TransactionInstruction({
          keys: createATAKeys,
          programId: CUSTOM_ATA_PROGRAM_ID,
          data: Buffer.alloc(0), // ATA creation instruction has no data
        })
      );
    } else {
      console.log('✅ ATA already exists, skipping creation');
    }

    // Add mint to instruction
    console.log('🔧 Adding mint instruction...');
    const mintToKeys = [
      { pubkey: mintInfo.mintAddress, isSigner: false, isWritable: true },
      { pubkey: ataAddress, isSigner: false, isWritable: true },
      { pubkey: WALLET_KEYPAIR.publicKey, isSigner: true, isWritable: false },
    ];

    const mintToData = Buffer.alloc(9);
    mintToData[0] = 7; // MintTo discriminator
    mintToData.writeBigUInt64LE(BigInt(mintAmount), 1);

    transaction.add(
      new TransactionInstruction({
        keys: mintToKeys,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
        data: mintToData,
      })
    );

    console.log('📤 Sending transaction...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [WALLET_KEYPAIR],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');
    
    console.log('🎉 SUCCESS! GDEMO transferred using ATA pattern!');
    console.log('=' .repeat(80));
    console.log(`🪙 Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`🆔 Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`👤 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`🏦 Associated Token Account: ${ataAddress.toString()}`);
    console.log(`💰 Amount Transferred: ${amount} tokens`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔗 ATA Program: ${CUSTOM_ATA_PROGRAM_ID.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log(`📋 Pattern: Associated Token Account (Standard) ✅`);
    console.log('=' .repeat(80));

    // Save ATA info
    const ataInfo = {
      associatedTokenAccount: ataAddress.toString(),
      owner: RECIPIENT_ADDRESS.toString(),
      mint: mintInfo.mintAddress.toString(),
      amount: amount,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      ataProgramId: CUSTOM_ATA_PROGRAM_ID.toString(),
      signature: signature,
      metadata: mintInfo.metadata,
      createdAt: new Date().toISOString(),
      type: 'gdemo-ata-transfer',
      pattern: 'Associated Token Account'
    };

    fs.writeFileSync('gdemo-ata-transfer-info.json', JSON.stringify(ataInfo, null, 2));
    console.log('💾 ATA transfer info saved to gdemo-ata-transfer-info.json');

    return {
      signature: signature,
      amount: amount,
      ataAddress: ataAddress.toString(),
      recipient: RECIPIENT_ADDRESS.toString(),
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      ataProgramId: CUSTOM_ATA_PROGRAM_ID.toString(),
      metadata: mintInfo.metadata
    };

  } catch (error) {
    console.error('❌ GDEMO ATA transfer failed:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let amount = 100; // default amount
  
  // Check if amount is provided as argument
  if (args.length > 0) {
    const providedAmount = parseFloat(args[0]);
    if (isNaN(providedAmount) || providedAmount <= 0) {
      console.error('❌ Invalid amount. Please provide a positive number.');
      console.log('💡 Usage: node transfer-gdemo-with-ata.js [amount]');
      console.log('💡 Example: node transfer-gdemo-with-ata.js 75');
      process.exit(1);
    }
    amount = providedAmount;
  }
  
  console.log('🎯 Transferring GDEMO using ATA pattern...');
  console.log('📋 Using our deployed ATA program for proper token account management');
  
  try {
    await transferGDEMOWithATA(amount);
    console.log('\n✅ GDEMO ATA transfer completed successfully!');
    console.log('💡 Recipient now has tokens in their deterministic ATA address');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ GDEMO ATA transfer failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { transferGDEMOWithATA, connection, CUSTOM_TOKEN_2022_PROGRAM_ID, CUSTOM_ATA_PROGRAM_ID }; 