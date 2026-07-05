import nextConfig from "eslint-config-next/core-web-vitals";

export default [
  ...nextConfig,
  {
    // eslint-config-next@16 ships the React Compiler-era react-hooks rules,
    // which flag 53 pre-existing spots (mostly setState-in-effect in the game
    // components). Burn these down incrementally, then re-enable — tracked in
    // the Open Recommendations Ledger. New code should still avoid these
    // patterns even though the rules are off.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];
