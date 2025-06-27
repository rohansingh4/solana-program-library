const {
  Connection,
  PublicKey,
} = require('@solana/web3.js');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
});

// Your token account address (where your RSI tokens are stored)
const MY_TOKEN_ACCOUNT = '7LuH7fHHWLNARVgzAqXoXXzLMBiUKWc6hw4JVqEg7LJh';
const MY_WALLET = 'Gmhpm85fByXJ3UQH7LqJkibW2bGLz5Diatute2YNM7ny';
const ROSI_MINT = '7aT3Pcyqfp1WShBYfdQkEJQzvShuo1aVaDVWrXqAdP5r';

async function checkMyRosiBalance() {
  try {
    console.log('🌹 Checking My ROSI Token Balance');
    console.log('=================================');
    console.log(`💼 My Wallet: ${MY_WALLET}`);
    console.log(`🏦 My Token Account: ${MY_TOKEN_ACCOUNT}`);
    console.log(`🪙 ROSI Mint: ${ROSI_MINT}`);
    console.log('');
    
    // Get account info
    console.log('🔍 Fetching account data...');
    const accountInfo = await connection.getAccountInfo(new PublicKey(MY_TOKEN_ACCOUNT));
    
    if (!accountInfo) {
      console.log('❌ Token account not found!');
      return;
    }
    
    console.log(`📊 Account exists: ✅`);
    console.log(`📏 Account data size: ${accountInfo.data.length} bytes`);
    console.log(`💰 Account lamports: ${accountInfo.lamports}`);
    console.log(`🔧 Owner program: ${accountInfo.owner.toString()}`);
    console.log('');
    
    // Parse token account data
    if (accountInfo.data.length >= 72) {
      // Token-2022 account structure:
      // Bytes 0-32: mint address
      // Bytes 32-64: owner address  
      // Bytes 64-72: amount (u64, little-endian)
      
      const mintFromAccount = new PublicKey(accountInfo.data.slice(0, 32));
      const ownerFromAccount = new PublicKey(accountInfo.data.slice(32, 64));
      const amount = accountInfo.data.readBigUInt64LE(64);
      
      console.log('📋 TOKEN ACCOUNT DETAILS:');
      console.log(`🪙 Mint Address: ${mintFromAccount.toString()}`);
      console.log(`👤 Owner Address: ${ownerFromAccount.toString()}`);
      console.log(`💰 Raw Amount: ${amount.toString()}`);
      
      // Convert to human readable (assuming 9 decimals for RSI)
      const humanAmount = Number(amount) / Math.pow(10, 9);
      console.log(`🌹 RSI Balance: ${humanAmount} RSI`);
      
      console.log('');
      console.log('✅ VERIFICATION:');
      console.log(`🔍 Mint matches ROSI: ${mintFromAccount.toString() === ROSI_MINT ? '✅ YES' : '❌ NO'}`);
      console.log(`🔍 Owner is me: ${ownerFromAccount.toString() === MY_WALLET ? '✅ YES' : '❌ NO'}`);
      
      if (humanAmount > 0) {
        console.log('');
        console.log('🎉 SUCCESS! YOU HAVE RSI TOKENS! 🎉');
        console.log(`🌹 You own ${humanAmount} RSI tokens!`);
        console.log(`🏦 Stored in token account: ${MY_TOKEN_ACCOUNT}`);
        console.log(`👤 Owned by your wallet: ${MY_WALLET}`);
      } else {
        console.log('');
        console.log('⚠️ No tokens found in this account');
      }
      
    } else {
      console.log('❌ Invalid token account data size');
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
  }
}

checkMyRosiBalance(); 