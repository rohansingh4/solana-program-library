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

// Helper function to load Token-2022 mint info
function loadToken2022MintInfo() {
  try {
    const mintData = JSON.parse(fs.readFileSync('token-2022-mint-info.json', 'utf8'));
    return {
      mintAddress: new PublicKey(mintData.mintAddress),
      mintKeypair: Keypair.fromSecretKey(new Uint8Array(mintData.mintKeypair)),
      decimals: mintData.decimals,
      programId: new PublicKey(mintData.programId)
    };
  } catch (error) {
    console.error('❌ Could not load token-2022-mint-info.json');
    console.log('💡 Please run token-2022-mint.js first to create a Token-2022');
    throw new Error('Token-2022 mint info not found. Run token-2022-mint.js first.');
  }
}

// Load wallet
const WALLET_KEYPAIR = loadKeypair();

// Create custom initialize account instruction
function createCustomInitializeAccountInstruction(
  account,
  mint,
  owner,
  programId
) {
  const keys = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
  ];

  const data = Buffer.from([1]); // InitializeAccount instruction discriminator

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
}

// Create custom mint to instruction
function createCustomMintToInstruction(
  mint,
  destination,
  authority,
  amount,
  programId
) {
  const keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
  ];

  // MintTo instruction data: [discriminator (1 byte)] + [amount (8 bytes)]
  const data = Buffer.alloc(9);
  data[0] = 7; // MintTo instruction discriminator
  data.writeBigUInt64LE(BigInt(amount), 1);

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
}

async function transferToken2022(amount = 1000) {
  try {
    console.log('🚀 Transferring Token-2022 on GorbChain...');
    console.log(`💼 Using wallet: ${WALLET_KEYPAIR.publicKey.toString()}`);
    console.log(`🎯 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    
    // Load mint information
    const mintInfo = loadToken2022MintInfo();
    console.log(`🪙 Token-2022 mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`🔧 Program ID: ${mintInfo.programId.toString()}`);
    
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
    const lamportsForAccount = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);

    const transaction = new Transaction();
    
    // Create the token account
    console.log('🔧 Creating Token-2022 account...');
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: WALLET_KEYPAIR.publicKey,
        newAccountPubkey: tokenAccountKeypair.publicKey,
        space: ACCOUNT_SIZE,
        lamports: lamportsForAccount,
        programId: mintInfo.programId,
      }),
      // Initialize the token account with custom instruction
      createCustomInitializeAccountInstruction(
        tokenAccountKeypair.publicKey, // account
        mintInfo.mintAddress, // mint
        RECIPIENT_ADDRESS, // owner
        mintInfo.programId // program id
      )
    );

    // Calculate amount with decimals
    const mintAmount = amount * Math.pow(10, mintInfo.decimals);
    console.log(`📊 Minting ${amount} tokens (${mintAmount} base units)`);
    
    // Add mint instruction with custom instruction
    transaction.add(
      createCustomMintToInstruction(
        mintInfo.mintAddress, // mint
        tokenAccountKeypair.publicKey, // destination
        WALLET_KEYPAIR.publicKey, // mint authority
        mintAmount, // amount
        mintInfo.programId // program id
      )
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
    
    console.log('🎉 SUCCESS! Token-2022 transferred successfully!');
    console.log('=' .repeat(60));
    console.log(`🪙 Token-2022 Mint: ${mintInfo.mintAddress.toString()}`);
    console.log(`👤 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    console.log(`💰 Amount Sent: ${amount} tokens`);
    console.log(`🔧 Program ID: ${mintInfo.programId.toString()}`);
    console.log(`🔍 Transaction: ${signature}`);
    console.log('=' .repeat(60));

    // Save token account info
    const accountInfo = {
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      owner: RECIPIENT_ADDRESS.toString(),
      mint: mintInfo.mintAddress.toString(),
      amount: amount,
      programId: mintInfo.programId.toString(),
      signature: signature,
      createdAt: new Date().toISOString(),
      type: 'token-2022'
    };

    fs.writeFileSync('token-2022-account-info.json', JSON.stringify(accountInfo, null, 2));
    console.log('💾 Token-2022 account info saved to token-2022-account-info.json');

    return {
      signature: signature,
      amount: amount,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      recipient: RECIPIENT_ADDRESS.toString(),
      programId: mintInfo.programId.toString()
    };

  } catch (error) {
    console.error('❌ Error transferring Token-2022:', error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let amount = 1000; // default amount
  
  // Check if amount is provided as argument
  if (args.length > 0) {
    const providedAmount = parseFloat(args[0]);
    if (isNaN(providedAmount) || providedAmount <= 0) {
      console.error('❌ Invalid amount. Please provide a positive number.');
      console.log('💡 Usage: node transfer-token-2022-simple.js [amount]');
      console.log('💡 Example: node transfer-token-2022-simple.js 500');
      process.exit(1);
    }
    amount = providedAmount;
  }
  
  console.log(`🎯 Preparing to transfer ${amount} Token-2022 tokens...`);
  
  try {
    await transferToken2022(amount);
    console.log('\n✅ Token-2022 transfer completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Token-2022 transfer failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { transferToken2022, connection }; 