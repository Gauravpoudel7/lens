/** Safety tips, posted one a day in this order. Copy rules: no "scam", no buy or sell advice, no URL. */
export const TIPS: readonly string[] = [
  "If the creator can still mint new coins, they can print more and dump them on you. Check that mint authority is off.",
  "If the creator can freeze coins, they can stop you from selling. Check that freeze authority is off.",
  "A coin that's only a few hours old is the riskiest kind. Waiting a day costs you little and can save you a lot.",
  "If 10 wallets own most of a coin, they can crash the price whenever they want.",
  "Low liquidity means it's hard to sell. Before you buy, ask: could I get out if I needed to?",
  "\"LP burned\" or \"LP locked\" in a post means nothing until you see it on-chain. Ask for the transaction.",
  "Never sign a transaction you don't understand. Wallet drainers look like normal \"claim\" buttons.",
  "Free airdrop in your wallet you never asked for? Don't touch it. Many are bait for a drainer site.",
  "Many coins share the same name. Always check the contract address, not just the $TICKER.",
  "If an influencer says \"100x, don't miss it\", ask who is selling to you right now.",
  "Never share your seed phrase. No real support team will ever ask for it.",
  "Check where a link really goes before you click. Fake sites copy real ones letter by letter.",
  "Only put in what you can afford to lose. New coins can go to zero in minutes.",
  "Snipers often buy most of a coin in the first seconds. If a few wallets bought at launch, be careful.",
  "\"Can't sell\" coins exist. If no exchange route lets you sell, it's a trap.",
];

/** Crypto terms in one line, posted one a day in this order. */
export const TERMS: readonly string[] = [
  "Rug pull: the creator takes the money out of the coin and disappears, leaving everyone else with worthless coins.",
  "Liquidity: the pot of money that makes buying and selling possible. Low liquidity = hard to sell.",
  "Mint authority: permission to create new coins. If it's still on, the supply can grow anytime.",
  "Freeze authority: permission to freeze people's coins so they can't move or sell them.",
  "Market cap: price × number of coins. It's not money in the bank, just what the coins are \"worth\" on paper.",
  "Slippage: getting a worse price than you expected because the price moved while your trade went through.",
  "Honeypot: a coin you can buy but can't sell. The trap closes after you get in.",
  "Sniper: a bot or insider that buys a new coin in its first seconds, often to sell to you later.",
  // "pump.fun" would become a link on X (a URL post), so the brand is written without the dot.
  "Bonding curve: Pump fun's launch system: the price rises as people buy, before the coin gets a normal pool.",
  "Contract address: a coin's unique ID on the blockchain. Names can be copied; addresses can't.",
  "Seed phrase: the 12 or 24 words that control your wallet. Whoever has them owns your money.",
  "Exit liquidity: the people who buy so insiders can sell. If you don't know who that is, it might be you.",
  "DYOR: \"do your own research\". Good advice, but most people don't know what to check. That's why Lens exists.",
  "Whale: a wallet holding a huge amount of a coin. When it sells, the price feels it.",
];
