// This should be provided by https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/utils/consts.ts one day
export default function chainIdToString(id: number): string {
  return id === 0
    ? "Unset"
    : id === 1
      ? "Solana"
      : id === 2
        ? "Ethereum"
        : id === 3
          ? "Terra Classic"
          : id === 4
            ? "BSC"
            : id === 5
              ? "Polygon"
              : id === 6
                ? "Avalanche"
                : id === 7
                  ? "Oasis"
                  : id === 8
                    ? "Algorand"
                    : id === 9
                      ? "Aurora"
                      : id === 10
                        ? "Fantom"
                        : id === 11
                          ? "Karura"
                          : id === 12
                            ? "Acala"
                            : id === 13
                              ? "Klaytn"
                              : id === 14
                                ? "Celo"
                                : id === 15
                                  ? "Near"
                                  : id === 16
                                    ? "Moonbeam"
                                    : id === 17
                                      ? "Neon"
                                      : id === 18
                                        ? "Terra 2"
                                        : id === 19
                                          ? "Injective"
                                          : id === 20
                                            ? "Osmosis"
                                            : id === 21
                                              ? "Sui"
                                              : id === 22
                                                ? "Aptos"
                                                : id === 23
                                                  ? "Arbitrum"
                                                  : id === 24
                                                    ? "Optimism"
                                                    : id === 25
                                                      ? "Gnosis"
                                                      : id === 26
                                                        ? "Pythnet"
                                                        : id === 28
                                                          ? "XPLA"
                                                          : id === 29
                                                            ? "BTC"
                                                            : id === 3104
                                                              ? "Wormchain"
                                                              : "";
}
