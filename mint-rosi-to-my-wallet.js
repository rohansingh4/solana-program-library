const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SystemProgram,
} = require('@solana/web3.js');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// Program IDs
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');

// Token-2022 account size
const TOKEN_2022_ACCOUNT_SIZE = 165;

// Load wallet
function loadKeypair() {
  const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Manual transaction confirmation
async function confirmTransaction(signature, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await connection.getSignatureStatus(signature);
      if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
        return status.value;
      }
      if (status?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }
      console.log(`⏳ Waiting for confirmation... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Transaction confirmation timeout');
}

// Get token balance from token account
async function getTokenBalance(tokenAccount) {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(tokenAccount));
    if (!accountInfo || accountInfo.data.length < 72) return 0;
    
    // Token-2022 account structure: amount is at bytes 64-72 (little-endian u64)
    const amount = accountInfo.data.readBigUInt64LE(64);
    return Number(amount) / Math.pow(10, 9); // Convert from lamports (9 decimals)
  } catch (error) {
    return 0;
  }
}

async function mintRosiToMyWallet() {
  try {
    const wallet = loadKeypair();
    
    // Load ROSI token info
    const rosiInfo = JSON.parse(fs.readFileSync('rosi-token-info.json', 'utf8'));
    const mintAddress = new PublicKey(rosiInfo.mintAddress);
    
    console.log('🌹 Minting ROSI to My Main Wallet');
    console.log('=================================');
    console.log(`💼 My Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🪙 ROSI Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log('');
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create a token account that I control (using my wallet as both payer and owner)
    const myTokenAccountKeypair = Keypair.generate();
    console.log(`🏦 Creating My Token Account: ${myTokenAccountKeypair.publicKey.toString()}`);
    
    // Amount to mint to myself
    const amountToMint = 500; // Mint 500 ROSI to myself
    console.log(`💰 Minting Amount: ${amountToMint} RSI`);
    console.log('');
    
    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);
    console.log(`💰 Token account rent: ${lamports / LAMPORTS_PER_SOL} SOL`);
    
    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });
    
    // 1. Create my token account
    console.log('🔧 Step 1: Creating my token account...');
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: myTokenAccountKeypair.publicKey,
        space: TOKEN_2022_ACCOUNT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );
    
    // 2. Initialize my token account (I am the owner)
    console.log('🔧 Step 2: Initializing my token account...');
    const initAccountData = Buffer.alloc(1 + 32); // instruction + owner pubkey
    initAccountData[0] = 18; // InitializeAccount3 instruction
    wallet.publicKey.toBuffer().copy(initAccountData, 1); // I am the owner
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: myTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: wallet.publicKey, isSigner: false, isWritable: false }, // I am the owner
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: initAccountData,
    }));
    
    // 3. Mint tokens to my account
    console.log('🔧 Step 3: Minting ROSI tokens to my account...');
    const mintAmount = amountToMint * Math.pow(10, rosiInfo.decimals);
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: myTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // I am the mint authority
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: mintData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, myTokenAccountKeypair);
    
    // Send transaction
    console.log('📤 Sending ROSI minting transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    
    console.log(`📋 Transaction signature: ${signature}`);
    console.log('⏳ Confirming transaction...');
    
    // Confirm transaction
    const confirmationStatus = await confirmTransaction(signature);
    
    console.log('');
    console.log('✅ SUCCESS! ROSI Tokens Minted to My Wallet!');
    console.log('=' .repeat(80));
    console.log(`🌹 Token: ${rosiInfo.metadata.name} (${rosiInfo.metadata.symbol})`);
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount Minted: ${amountToMint} ${rosiInfo.metadata.symbol}`);
    console.log(`👤 Owner: ${wallet.publicKey.toString()} (ME!)`);
    console.log(`🏦 My Token Account: ${myTokenAccountKeypair.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log('=' .repeat(80));
    
    // Verify balance
    console.log('🔍 Verifying my token balance...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait a bit
    const myBalance = await getTokenBalance(myTokenAccountKeypair.publicKey.toString());
    console.log(`✅ My ROSI Balance: ${myBalance} RSI`);
    
    // Save my token account info
    const myTokenAccountInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      owner: wallet.publicKey.toString(),
      myTokenAccount: myTokenAccountKeypair.publicKey.toString(),
      myTokenAccountKeypair: Array.from(myTokenAccountKeypair.secretKey),
      mintAddress: mintAddress.toString(),
      amount: amountToMint,
      balance: myBalance,
      decimals: rosiInfo.decimals,
      timestamp: new Date().toISOString(),
      method: 'mint-to-my-wallet',
      tokenSymbol: rosiInfo.metadata.symbol,
      tokenName: rosiInfo.metadata.name,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      notes: 'This is MY token account that I control directly'
    };
    
    const filename = `my-rosi-account-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(myTokenAccountInfo, null, 2));
    console.log(`💾 My token account info saved to ${filename}`);
    
    console.log('');
    console.log('🎊 NOW I HOLD ROSI TOKENS! 🎊');
    console.log(`🌹 I own ${myBalance} RSI tokens in my account!`);
    console.log(`🔑 I control the token account: ${myTokenAccountKeypair.publicKey.toString()}`);
    console.log(`💡 To check my balance, query this token account address!`);
    
    return {
      success: true,
      myTokenAccount: myTokenAccountKeypair.publicKey.toString(),
      balance: myBalance,
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus
    };
    
  } catch (error) {
    console.error('❌ Minting to my wallet failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🌹 ROSI Token: Mint to My Wallet Process');
    console.log('=======================================');
    console.log('Creating a token account that I directly control...');
    console.log('');
    
    const result = await mintRosiToMyWallet();
    
    console.log('');
    console.log('🎉 PROCESS COMPLETED SUCCESSFULLY!');
    console.log('==================================');
    console.log(`✅ My Token Account: ${result.myTokenAccount}`);
    console.log(`✅ My Balance: ${result.balance} RSI`);
    console.log(`✅ Transaction: ${result.signature}`);
    console.log(`✅ Status: ${result.confirmationStatus}`);
    console.log('');
    console.log('🔍 TO CHECK MY BALANCE:');
    console.log(`curl -X POST https://rpc.gorbchain.xyz -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["${result.myTokenAccount}",{"encoding":"base64","commitment":"confirmed"}]}'`);
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { mintRosiToMyWallet, getTokenBalance }; 