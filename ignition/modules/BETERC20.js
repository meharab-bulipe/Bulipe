const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("BETERC20Module", (m) => {
  const beterc20 = m.contract("BETERC20");

  return { beterc20 };
});
