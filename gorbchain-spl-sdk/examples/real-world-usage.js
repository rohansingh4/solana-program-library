const { GorbChainSDK } = require('@freekill411/gorbchain-spl-token-sdk');
const { Keypair } = require('@solana/web3.js');

// This shows how to recreate your exact Monday/Tuesday token scenario using the SDK
async function recreateYourTokens() {
  console.log('🎯 Recreating Your GorbChain Token Setup with SDK');
  console.log('==================================================');

  // Initialize SDK (auto-connects to GorbChain)
  const sdk = new GorbChainSDK();

  // Check connection
  const isReady = await sdk.isReady();
  console.log(`✅ GorbChain connection: ${isReady ? 'Ready' : 'Failed'}`);

  if (!isReady) {
    console.error('❌ Cannot connect to GorbChain RPC');
    return;
  }

  // Your wallet address
  const yourWallet = "Gmhpm85fByXJ3UQH7LqJkibW2bGLz5Diatute2YNM7ny";
  
  // For demo, we'll generate authority keypairs
  // In real usage, you'd load your actual keypairs like:
  // const authority = Keypair.fromSecretKey(new Uint8Array([your_secret_key_array]));
  const mondayAuthority = Keypair.generate();
  const tuesdayAuthority = Keypair.generate();

  console.log(`👤 Your wallet: ${yourWallet}`);

  try {
    // Create Monday Token (same as what you did manually)
    console.log('\n🚀 Creating Monday Token...');
    const mondayToken = await sdk.tokenMinter.createToken2022({
      name: "Monday Token",
      symbol: "MON",
      decimals: 9,
      supply: 10, // 10 tokens as you created
      authority: mondayAuthority
    });

    console.log('✅ Monday Token Created!');
    console.log(`   Mint: ${mondayToken.mintAddress}`);
    console.log(`   Account: ${mondayToken.tokenAccountAddress}`);
    console.log(`   Supply: ${mondayToken.supply} MON`);
    console.log(`   TX: ${mondayToken.signature}`);

    // Create Tuesday Token
    console.log('\n🚀 Creating Tuesday Token...');
    const tuesdayToken = await sdk.tokenMinter.createToken2022({
      name: "Tuesday Token", 
      symbol: "TUES",
      decimals: 9,
      supply: 100, // 100 tokens as you created
      authority: tuesdayAuthority
    });

    console.log('✅ Tuesday Token Created!');
    console.log(`   Mint: ${tuesdayToken.mintAddress}`);
    console.log(`   Account: ${tuesdayToken.tokenAccountAddress}`);
    console.log(`   Supply: ${tuesdayToken.supply} TUES`);
    console.log(`   TX: ${tuesdayToken.signature}`);

    // Example: Mint additional tokens to your wallet
    console.log('\n💰 Minting additional tokens to your wallet...');
    
    const additionalMond = await sdk.tokenMinter.mintTo({
      mintAddress: mondayToken.mintAddress,
      recipientAddress: yourWallet,
      amount: 5, // 5 more MON tokens
      authority: mondayAuthority,
      createTokenAccount: true
    });

    console.log('✅ Additional MON tokens minted!');
    console.log(`   Token Account: ${additionalMond.tokenAccountAddress}`);
    console.log(`   TX: ${additionalMond.signature}`);

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`🪙 Monday Token (MON): ${mondayToken.mintAddress}`);
    console.log(`🪙 Tuesday Token (TUES): ${tuesdayToken.mintAddress}`);
    console.log(`💰 Your wallet: ${yourWallet}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz`);
    
    // Show how easy it was compared to manual approach
    console.log('\n🎉 COMPARISON');
    console.log('=============');
    console.log('❌ Manual approach: ~150 lines of complex transaction building');
    console.log('✅ SDK approach: ~20 lines of simple function calls');
    
    return {
      mondayToken,
      tuesdayToken,
      additionalMond
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Function to demonstrate querying tokens (replaces your check-my-tokens.sh)
async function checkMyTokens() {
  console.log('\n🔍 Checking Your Token Accounts...');
  
  const sdk = new GorbChainSDK();
  const yourWallet = "Gmhpm85fByXJ3UQH7LqJkibW2bGLz5Diatute2YNM7ny";

  try {
    // This replaces your curl command with a simple SDK call
    const accounts = await sdk.connection.getProgramAccounts(
      sdk.tokenMinter.GORBCHAIN_TOKEN_2022_PROGRAM_ID,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        filters: [
          {
            memcmp: {
              offset: 32,
              bytes: yourWallet
            }
          }
        ]
      }
    );

    console.log(`✅ Found ${accounts.length} token accounts`);
    
    accounts.forEach((account, index) => {
      console.log(`\n📋 Token Account #${index + 1}:`);
      console.log(`   Address: ${account.pubkey.toString()}`);
      console.log(`   Owner: ${yourWallet}`);
    });

  } catch (error) {
    console.error('❌ Error fetching tokens:', error.message);
  }
}

// Run examples
async function main() {
  await recreateYourTokens();
  await checkMyTokens();
}

// Export for use in other scripts
module.exports = { recreateYourTokens, checkMyTokens };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
} 