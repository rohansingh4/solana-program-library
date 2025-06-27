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

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const WS_ENDPOINT = 'wss://rpc.gorbchain.xyz/ws/';
const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  wsEndpoint: WS_ENDPOINT,
  disableRetryOnRateLimit: false,
});

// Custom Token-2022 Program ID for GorbChain
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');

// Target recipient address
const RECIPIENT_ADDRESS = new PublicKey('5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ');

// Token account size for Token-2022
const TOKEN_2022_ACCOUNT_SIZE = 165;

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

// Load wallet
const WALLET_KEYPAIR = loadKeypair();

async function transferDemoToken2022(amount = 250) {
  try {
    console.log('🚀 Demo: Transferring Token-2022 on GorbChain...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🎯 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`💰 Amount to transfer: ${amount} tokens`);
    
    // Load mint information
    const mintInfo = loadDemoToken2022MintInfo();
    console.log(`🪙 Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`🆔 Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`📊 Decimals: ${mintInfo.decimals}`);
    console.log(`📋 Description: ${mintInfo.metadata.description}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees (need at least 0.05 SOL)');
    }

    // Create a new token account for the recipient
    const tokenAccountKeypair = Keypair.generate();
    console.log(`🏦 New token account: ${tokenAccountKeypair.publicKey.toString()}`);

    // Get minimum balance for rent exemption
    const lamportsForAccount = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);
    console.log(`💰 Rent exemption: ${lamportsForAccount / LAMPORTS_PER_SOL} SOL`);

    // Calculate amount with decimals
    const mintAmount = amount * Math.pow(10, mintInfo.decimals);
    console.log(`📊 Minting ${amount} tokens (${mintAmount} base units)`);

    // Create transaction
    const transaction = new Transaction();
    
    // 1. Create the token account
    console.log('🔧 Creating Token-2022 account...');
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: tokenAccountKeypair.publicKey,
        space: TOKEN_2022_ACCOUNT_SIZE,
        lamports: lamportsForAccount,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );

    // 2. Initialize account instruction
    const initializeAccountKeys = [
      { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: mintInfo.mintAddress, isSigner: false, isWritable: false },
      { pubkey: RECIPIENT_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ];

    const initializeAccountData = Buffer.from([1]); // InitializeAccount discriminator

    transaction.add(
      new TransactionInstruction({
        keys: initializeAccountKeys,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
        data: initializeAccountData,
      })
    );

    // 3. Mint to instruction
    const mintToKeys = [
      { pubkey: mintInfo.mintAddress, isSigner: false, isWritable: true },
      { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
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

    console.log('📤 Sending demo transaction...');
    console.log('⚠️  Note: This may fail due to Token-2022 program ID validation');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [WALLET_KEYPAIR, tokenAccountKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');
    
    console.log('🎉 SUCCESS! Demo Token-2022 transferred successfully!');
    console.log('=' .repeat(70));
    console.log(`🪙 Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`🆔 Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`👤 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    console.log(`💰 Amount Transferred: ${amount} tokens`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log(`📋 Description: ${mintInfo.metadata.description}`);
    console.log(`🌐 Network: ${mintInfo.metadata.network}`);
    console.log('=' .repeat(70));

    // Save token account info
    const accountInfo = {
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      owner: RECIPIENT_ADDRESS.toString(),
      mint: mintInfo.mintAddress.toString(),
      amount: amount,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      signature: signature,
      metadata: mintInfo.metadata,
      createdAt: new Date().toISOString(),
      type: 'token-2022-demo-transfer'
    };

    fs.writeFileSync('demo-token-2022-account-info.json', JSON.stringify(accountInfo, null, 2));
    console.log('💾 Demo Token-2022 account info saved to demo-token-2022-account-info.json');

    return {
      signature: signature,
      amount: amount,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      recipient: RECIPIENT_ADDRESS.toString(),
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      metadata: mintInfo.metadata
    };

  } catch (error) {
    console.error('❌ Demo Token-2022 transfer failed:', error.message);
    
    // Show detailed error information
    if (error.message.includes('IncorrectProgramId')) {
      console.log('\n🔍 ANALYSIS: Token-2022 Program ID Validation Issue');
      console.log('   The Token-2022 program has hardcoded validation that rejects');
      console.log('   instructions from custom program IDs.');
      console.log('   Our custom program ID: 2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
      console.log('   Expected program ID: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
      console.log('\n💡 WORKAROUND: Use SPL Token for transfers (fully working)');
      console.log('   Token-2022 mint creation works, but transfers require canonical program ID');
    }
    
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let amount = 250; // demo amount
  
  // Check if amount is provided as argument
  if (args.length > 0) {
    const providedAmount = parseFloat(args[0]);
    if (isNaN(providedAmount) || providedAmount <= 0) {
      console.error('❌ Invalid amount. Please provide a positive number.');
      console.log('💡 Usage: node demo-transfer-token-2022.js [amount]');
      console.log('💡 Example: node demo-transfer-token-2022.js 250');
      process.exit(1);
    }
    amount = providedAmount;
  }
  
  console.log('🎯 Demo: Preparing to transfer Token-2022...');
  console.log('📋 This demo will attempt Token-2022 transfer (may fail due to program ID validation)');
  
  try {
    await transferDemoToken2022(amount);
    console.log('\n✅ Demo Token-2022 transfer completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Demo Token-2022 transfer failed (as expected)');
    console.log('\n🎯 Alternative: Try creating SPL Token version for working transfers');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { transferDemoToken2022, connection, CUSTOM_TOKEN_2022_PROGRAM_ID }; 