const {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
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

// Custom Program IDs for GorbChain
const CUSTOM_TOKEN_PROGRAM_ID = new PublicKey('8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS');

// Target recipient address
const RECIPIENT_ADDRESS = new PublicKey('5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ');

// Helper function to load mint info
function loadMintInfo() {
  try {
    const mintData = JSON.parse(fs.readFileSync('token-mint-info.json', 'utf8'));
    return {
      mintAddress: new PublicKey(mintData.mintAddress),
      decimals: mintData.decimals
    };
  } catch (error) {
    console.error('❌ Could not load token-mint-info.json');
    console.log('💡 Please run mint-token.js first to create a token');
    throw new Error('Token mint info not found. Run mint-token.js first.');
  }
}

// Helper function to load token account info
function loadTokenAccountInfo() {
  try {
    const accountData = JSON.parse(fs.readFileSync('token-account-info.json', 'utf8'));
    return {
      tokenAccount: new PublicKey(accountData.tokenAccount),
      owner: new PublicKey(accountData.owner),
      mint: new PublicKey(accountData.mint),
      amount: accountData.amount,
      signature: accountData.signature
    };
  } catch (error) {
    console.error('❌ Could not load token-account-info.json');
    console.log('💡 Please run transfer-token-simple.js first to create a token account');
    return null;
  }
}

async function checkBalance() {
  try {
    console.log('🔍 Checking SPL Token Balance on GorbChain...');
    console.log(`👤 Recipient: ${RECIPIENT_ADDRESS.toString()}`);
    
    // Load mint information
    const mintInfo = loadMintInfo();
    console.log(`🪙 Token Mint: ${mintInfo.mintAddress.toString()}`);
    
    // Load token account info if available
    const accountInfo = loadTokenAccountInfo();
    
    if (accountInfo) {
      console.log(`🏦 Token Account: ${accountInfo.tokenAccount.toString()}`);
      console.log(`📊 Expected Amount: ${accountInfo.amount} tokens`);
      console.log(`🔗 Creation Transaction: ${accountInfo.signature}`);
    }
    
    console.log('=' .repeat(50));
    
    // Check SOL balance first
    const solBalance = await connection.getBalance(RECIPIENT_ADDRESS);
    console.log(`💰 SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Method 1: Check specific token account if we have it
    if (accountInfo) {
      console.log('\n🔍 Method 1: Checking specific token account...');
      try {
        const tokenBalance = await connection.getTokenAccountBalance(accountInfo.tokenAccount);
        console.log(`✅ Token Balance: ${tokenBalance.value.uiAmount} tokens`);
        console.log(`📊 Raw Amount: ${tokenBalance.value.amount}`);
        console.log(`⚡ Decimals: ${tokenBalance.value.decimals}`);
      } catch (error) {
        console.log(`❌ Error checking token account: ${error.message}`);
      }
    }
    
    // Method 2: Find all token accounts for this owner and our mint
    console.log('\n🔍 Method 2: Searching for all token accounts...');
    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(
        RECIPIENT_ADDRESS,
        {
          mint: mintInfo.mintAddress,
        },
        'confirmed'
      );
      
      if (tokenAccounts.value.length === 0) {
        console.log('❌ No token accounts found for this mint and owner');
      } else {
        console.log(`✅ Found ${tokenAccounts.value.length} token account(s):`);
        
        for (let i = 0; i < tokenAccounts.value.length; i++) {
          const account = tokenAccounts.value[i];
          console.log(`\n📍 Account ${i + 1}:`);
          console.log(`   Address: ${account.pubkey.toString()}`);
          
          try {
            const balance = await connection.getTokenAccountBalance(account.pubkey);
            console.log(`   Balance: ${balance.value.uiAmount} tokens`);
            console.log(`   Raw Amount: ${balance.value.amount}`);
          } catch (balanceError) {
            console.log(`   Balance: Error - ${balanceError.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error searching token accounts: ${error.message}`);
    }
    
    // Method 3: Get all token accounts for the owner (any mint)
    console.log('\n🔍 Method 3: All token accounts for this address...');
    try {
      const allTokenAccounts = await connection.getTokenAccountsByOwner(
        RECIPIENT_ADDRESS,
        {
          programId: CUSTOM_TOKEN_PROGRAM_ID,
        },
        'confirmed'
      );
      
      if (allTokenAccounts.value.length === 0) {
        console.log('❌ No token accounts found for this address');
      } else {
        console.log(`✅ Found ${allTokenAccounts.value.length} total token account(s):`);
        
        for (let i = 0; i < allTokenAccounts.value.length; i++) {
          const account = allTokenAccounts.value[i];
          console.log(`\n📍 Token Account ${i + 1}:`);
          console.log(`   Address: ${account.pubkey.toString()}`);
          
          // Parse account data to get mint
          const accountData = account.account.data;
          if (accountData.length >= 32) {
            // First 32 bytes should be the mint address
            const mintBytes = accountData.slice(0, 32);
            const mintAddress = new PublicKey(mintBytes).toString();
            console.log(`   Mint: ${mintAddress}`);
            
            // Check if this is our mint
            if (mintAddress === mintInfo.mintAddress.toString()) {
              console.log(`   🎯 This is our token!`);
            }
          }
          
          try {
            const balance = await connection.getTokenAccountBalance(account.pubkey);
            console.log(`   Balance: ${balance.value.uiAmount} tokens`);
          } catch (balanceError) {
            console.log(`   Balance: Error - ${balanceError.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error getting all token accounts: ${error.message}`);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Balance check completed!');
    
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  checkBalance()
    .then(() => {
      console.log('\n✅ Balance check completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Balance check failed:', error.message);
      process.exit(1);
    });
}

module.exports = { checkBalance, connection, CUSTOM_TOKEN_PROGRAM_ID }; 