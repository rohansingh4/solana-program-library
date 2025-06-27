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

// Helper function to load Token-2022 mint info
function loadToken2022MintInfo() {
  try {
    const mintData = JSON.parse(fs.readFileSync('token-2022-mint-info.json', 'utf8'));
    return {
      mintAddress: new PublicKey(mintData.mintAddress),
      mintKeypair: Keypair.fromSecretKey(new Uint8Array(mintData.mintKeypair)),
      decimals: mintData.decimals
    };
  } catch (error) {
    console.error('❌ Could not load token-2022-mint-info.json');
    console.log('💡 Please run token-2022-mint.js first to create a Token-2022');
    throw new Error('Token-2022 mint info not found. Run token-2022-mint.js first.');
  }
}

// Load wallet
const WALLET_KEYPAIR = loadKeypair();

async function mintToRecipientToken2022(amount = 750) {
  try {
    console.log('🚀 Minting Token-2022 directly to recipient on GorbChain...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🎯 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    
    // Load mint information
    const mintInfo = loadToken2022MintInfo();
    console.log(`🪙 Token-2022 mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(WALLET_KEYPAIR.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees (need at least 0.05 SOL)');
    }

    // Create a new token account for the recipient
    const tokenAccountKeypair = Keypair.generate();
    console.log(`🏦 Token account: ${tokenAccountKeypair.publicKey.toString()}`);

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

    // 2. Initialize account instruction - using exact same format as our working mint
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

    // 3. Mint to instruction - using exact same format as our working mint
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

    console.log('📤 Sending transaction...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [WALLET_KEYPAIR, tokenAccountKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Transaction confirmed!');
    
    console.log('🎉 SUCCESS! Token-2022 minted directly to recipient!');
    console.log('=' .repeat(60));
    console.log(`🪙 Token-2022 Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`👤 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    console.log(`💰 Amount Minted: ${amount} tokens`);
    console.log(`🔧 Program ID: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log('=' .repeat(60));

    // Save token account info
    const accountInfo = {
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      owner: RECIPIENT_ADDRESS.toString(),
      mint: mintInfo.mintAddress.toString(),
      amount: amount,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      signature: signature,
      createdAt: new Date().toISOString(),
      type: 'token-2022-direct-mint'
    };

    fs.writeFileSync('token-2022-account-info.json', JSON.stringify(accountInfo, null, 2));
    console.log('💾 Token-2022 account info saved to token-2022-account-info.json');

    return {
      signature: signature,
      amount: amount,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      recipient: RECIPIENT_ADDRESS.toString(),
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString()
    };

  } catch (error) {
    console.error('❌ Error minting Token-2022:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let amount = 750; // default amount
  
  // Check if amount is provided as argument
  if (args.length > 0) {
    const providedAmount = parseFloat(args[0]);
    if (isNaN(providedAmount) || providedAmount <= 0) {
      console.error('❌ Invalid amount. Please provide a positive number.');
      console.log('💡 Usage: node mint-to-token-2022.js [amount]');
      console.log('💡 Example: node mint-to-token-2022.js 500');
      process.exit(1);
    }
    amount = providedAmount;
  }
  
  console.log(`🎯 Preparing to mint ${amount} Token-2022 tokens to recipient...`);
  
  try {
    await mintToRecipientToken2022(amount);
    console.log('\n✅ Token-2022 minting completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Token-2022 minting failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { mintToRecipientToken2022, connection, CUSTOM_TOKEN_2022_PROGRAM_ID }; 