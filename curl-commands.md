# GorbChain Token Verification - cURL Commands

## Account Information

### 1. Check Token Account Info
```bash
curl -X POST https://rpc.gorbchain.xyz \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getAccountInfo",
    "params": [
      "E7ULhPW7eVWqVshPkCcdrhzV6Y4MovhPAhq1pU1eDM87",
      {
        "encoding": "base64",
        "commitment": "confirmed"
      }
    ]
  }'
```

### 2. Check Token Account Balance (may not work with custom program)
```bash
curl -X POST https://rpc.gorbchain.xyz \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTokenAccountBalance",
    "params": [
      "E7ULhPW7eVWqVshPkCcdrhzV6Y4MovhPAhq1pU1eDM87"
    ]
  }'
```

### 3. Check Recipient SOL Balance
```bash
curl -X POST https://rpc.gorbchain.xyz \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getBalance",
    "params": [
      "5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ"
    ]
  }'
```

### 4. Get Transaction Details
```bash
curl -X POST https://rpc.gorbchain.xyz \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTransaction",
    "params": [
      "2nNSWn4ufLdh4thCgkLoqtvnTs95JbdLT381RpDyou625cXLVrSHjR6h3wNjpjMqBmbphDNznkGtBkUdnNoaBHxr",
      {
        "encoding": "json",
        "commitment": "confirmed",
        "maxSupportedTransactionVersion": 0
      }
    ]
  }'
```

### 5. Check Token Mint Info
```bash
curl -X POST https://rpc.gorbchain.xyz \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getAccountInfo",
    "params": [
      "HvHSzo3u2r9WaQn5RTrAk2kKeLfkuE4y1KiaZE52y7m",
      {
        "encoding": "base64",
        "commitment": "confirmed"
      }
    ]
  }'
```

### 6. Get Token Accounts by Owner (may not work with custom program)
```bash
curl -X POST https://rpc.gorbchain.xyz \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTokenAccountsByOwner",
    "params": [
      "5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ",
      {
        "programId": "8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS"
      },
      {
        "encoding": "base64",
        "commitment": "confirmed"
      }
    ]
  }'
```

## Key Addresses

- **Token Mint**: `HvHSzo3u2r9WaQn5RTrAk2kKeLfkuE4y1KiaZE52y7m`
- **Token Account**: `E7ULhPW7eVWqVshPkCcdrhzV6Y4MovhPAhq1pU1eDM87`
- **Recipient**: `5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ`
- **Custom Token Program**: `8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS`
- **Custom ATA Program**: `4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc`

## Expected Results

### Token Account Data Structure (from getAccountInfo):
- **Bytes 0-31**: Mint address (should be `HvHSzo3u2r9WaQn5RTrAk2kKeLfkuE4y1KiaZE52y7m`)
- **Bytes 32-63**: Owner address (should be `5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ`)
- **Bytes 64-71**: Token amount (should be `500000000000` = 500 tokens with 9 decimals)

### Balance Calculation:
- Raw amount: `500000000000`
- Decimals: `9`
- Human readable: `500000000000 / 10^9 = 500 tokens`

## Notes

- Some RPC methods may not work properly with custom token programs
- The `getAccountInfo` method with base64 encoding is the most reliable way to verify token accounts
- You can decode the base64 data to extract mint, owner, and balance information
- Transaction verification confirms the tokens were successfully minted and transferred 