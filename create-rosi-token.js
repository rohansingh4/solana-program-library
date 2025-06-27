const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SystemProgram,
} = require('@solana/web3.js');

const {
  createInitializeMintInstruction,
} = require('@solana/spl-token');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// Program IDs
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

// Token-2022 sizes
const TOKEN_2022_MINT_SIZE = 82;
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

async function createRosiToken() {
  try {
    const wallet = loadKeypair();
    
    console.log('🌹 Creating ROSI Token (RSI) on GorbChain...');
    console.log('===============================================');
    console.log(`💼 Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🔧 Token-2022 Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 RPC: ${RPC_ENDPOINT}`);
    console.log('');
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🪙 New ROSI mint: ${mintKeypair.publicKey.toString()}`);

    // Token metadata
    const tokenMetadata = {
      name: "ROSI Token",
      symbol: "RSI",
      description: "ROSI Token - A beautiful Token-2022 on GorbChain",
      decimals: 9,
      totalSupply: 1000,
      creator: "GorbChain Foundation",
      category: "Utility",
      features: ["Token-2022", "GorbChain Native", "Beautiful Design"],
      website: "https://gorbchain.xyz",
      twitter: "@gorbchain",
      telegram: "t.me/gorbchain",
      createdAt: new Date().toISOString(),
      network: "GorbChain",
      version: "rosi-v1.0",
      theme: "Rose Garden",
      color: "#FF69B4"
    };

    console.log('📋 ROSI Token Metadata:');
    console.log(`   🌹 Name: ${tokenMetadata.name}`);
    console.log(`   🏷️ Symbol: ${tokenMetadata.symbol}`);
    console.log(`   🔢 Decimals: ${tokenMetadata.decimals}`);
    console.log(`   💰 Total Supply: ${tokenMetadata.totalSupply.toLocaleString()}`);
    console.log(`   🎨 Theme: ${tokenMetadata.theme}`);
    console.log(`   🌈 Color: ${tokenMetadata.color}`);
    console.log('');

    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_MINT_SIZE);
    console.log(`💰 Mint rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    // Create transaction
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });

    transaction.add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: TOKEN_2022_MINT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize mint
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenMetadata.decimals,
        wallet.publicKey,
        wallet.publicKey,
        CUSTOM_TOKEN_2022_PROGRAM_ID
      )
    );

    // Sign transaction
    console.log('✍️ Signing mint creation transaction...');
    transaction.sign(wallet, mintKeypair);

    // Send transaction
    console.log('📤 Sending ROSI mint creation transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log(`📋 Mint creation signature: ${signature}`);
    console.log('⏳ Confirming mint creation...');

    // Confirm transaction
    const confirmationStatus = await confirmTransaction(signature);

    console.log('✅ ROSI Token mint created successfully!');
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log('');
    
    // Save mint information
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: wallet.publicKey.toString(),
      decimals: tokenMetadata.decimals,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      signature: signature,
      metadata: tokenMetadata,
      createdAt: new Date().toISOString(),
      type: 'rosi-token-2022'
    };

    fs.writeFileSync('rosi-token-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 ROSI token info saved to rosi-token-info.json');

    return mintInfo;

  } catch (error) {
    console.error('❌ Error creating ROSI token:', error.message);
    throw error;
  }
}

async function mintRosiToAddress(mintInfo, recipientAddress, amount) {
  try {
    const wallet = loadKeypair();
    const recipientPubkey = new PublicKey(recipientAddress);
    const mintAddress = new PublicKey(mintInfo.mintAddress);
    
    console.log('🌹 Minting ROSI Tokens...');
    console.log('=========================');
    console.log(`🎯 Recipient: ${recipientAddress}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log('');
    
    // Create a new token account for the recipient
    const tokenAccountKeypair = Keypair.generate();
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    
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
    
    // 1. Create token account
    console.log('🔧 Adding create token account instruction...');
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: tokenAccountKeypair.publicKey,
        space: TOKEN_2022_ACCOUNT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );
    
    // 2. Initialize token account (InitializeAccount3)
    console.log('🔧 Adding initialize account instruction...');
    const initAccountData = Buffer.alloc(1 + 32); // instruction + owner pubkey
    initAccountData[0] = 18; // InitializeAccount3 instruction
    recipientPubkey.toBuffer().copy(initAccountData, 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: recipientPubkey, isSigner: false, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: initAccountData,
    }));
    
    // 3. Mint tokens to the account
    console.log('🔧 Adding mint tokens instruction...');
    const mintAmount = amount * Math.pow(10, mintInfo.decimals);
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: mintData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, tokenAccountKeypair);
    
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
    console.log('✅ SUCCESS! ROSI Token Minting Completed!');
    console.log('=' .repeat(80));
    console.log(`🌹 Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log(`🎯 Recipient: ${recipientAddress}`);
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log(`🎨 Theme: ${mintInfo.metadata.theme} ${mintInfo.metadata.color}`);
    console.log('=' .repeat(80));
    
    // Save transfer details
    const transferInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      recipient: recipientAddress,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      tokenAccountKeypair: Array.from(tokenAccountKeypair.secretKey),
      mintAddress: mintAddress.toString(),
      amount: amount,
      decimals: mintInfo.decimals,
      timestamp: new Date().toISOString(),
      method: 'rosi-token-2022-manual',
      tokenSymbol: mintInfo.metadata.symbol,
      tokenName: mintInfo.metadata.name,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      theme: mintInfo.metadata.theme,
      color: mintInfo.metadata.color
    };
    
    const filename = `rosi-mint-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(transferInfo, null, 2));
    console.log(`💾 ROSI mint details saved to ${filename}`);
    
    return {
      signature,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      amount,
      recipient: recipientAddress,
      mint: mintAddress.toString(),
      confirmationStatus: confirmationStatus.confirmationStatus,
      theme: mintInfo.metadata.theme
    };
    
  } catch (error) {
    console.error('❌ ROSI minting failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🌹 ROSI Token Creation & Minting Process');
    console.log('========================================');
    console.log('Creating beautiful ROSI (RSI) token on GorbChain...');
    console.log('');
    
    // Step 1: Create the ROSI token mint
    const mintInfo = await createRosiToken();
    
    // Step 2: Mint ROSI tokens to the specified address
    const recipient = 'Gmhpm85fByXJ3UQH7LqJkibW2bGLz5Diatute2YNM7ny'; // Your main wallet
    const amount = 1000; // Full supply
    
    console.log('⏳ Waiting 3 seconds before minting...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const mintResult = await mintRosiToAddress(mintInfo, recipient, amount);
    
    console.log('');
    console.log('🎊 ROSI TOKEN CREATION COMPLETE!');
    console.log('================================');
    console.log(`🌹 Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`🪙 Mint: ${mintInfo.mintAddress}`);
    console.log(`🏦 Token Account: ${mintResult.tokenAccount}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log(`🎯 Owner: ${recipient}`);
    console.log(`📊 Status: ${mintResult.confirmationStatus}`);
    console.log(`🎨 Theme: ${mintResult.theme}`);
    console.log(`🌐 Network: GorbChain`);
    console.log('');
    console.log('🌹 ROSI is now ready for use on GorbChain! 🌹');
    
  } catch (error) {
    console.error('\n💥 ROSI creation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  createRosiToken, 
  mintRosiToAddress,
  CUSTOM_TOKEN_2022_PROGRAM_ID
}; 