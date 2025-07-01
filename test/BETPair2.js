const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BETPair", function () {
  let owner, user;
  let Token, token0, token1;
  let pair, pairAddress;
  let Factory, factory;
  let tokenA, tokenB;

  beforeEach(async function () {
    [owner, user, token0, token1] = await ethers.getSigners();

    Token = await ethers.getContractFactory("TestBETERC20");
    token0 = await Token.deploy();
    console.log("Token0 Address:", token0.target);
    token1 = await Token.deploy();
    console.log("Token1 Address:", token1.target);

    await token0.mint(owner.address, 1000);
    console.log("Minted 1000 Token0 to owner:", owner.address);
    await token1.mint(owner.address, 1000);
    console.log("Minted 1000 Token1 to owner:", owner.address);

    [tokenA, tokenB] =
      token0.target.toLowerCase() < token1.target.toLowerCase()
        ? [token0, token1]
        : [token1, token0];

    Factory = await ethers.getContractFactory("BETFactory");
    factory = await Factory.deploy(owner.address);
    await factory.waitForDeployment();
    console.log("Factory Address:", factory.target);

    const tx = await factory.createPair(token0.target, token1.target);
    const receipt = await tx.wait();
    console.log("Pair creation transaction hash:", tx.hash);
    const logs = receipt.logs;
    console.log("Pair creation logs:", logs);

    const iface = Factory.interface;
    const parsedLog = logs.map(log => {
      try {
        return iface.parseLog(log);
      } catch (e) {
        return null;
      }
    }).find(log => log?.name === "PairCreated");

    if (!parsedLog) throw new Error("PairCreated event not found");

    pairAddress = parsedLog.args.pair;
    console.log("Pair Address:", pairAddress);    

    pair = await ethers.getContractAt("BETPair", pairAddress);
  });

  it("should have correct initial reserves and tokens", async function () {
    const [reserve0, reserve1] = await pair.getReserves();
    expect(reserve0).to.equal(0n);
    expect(reserve1).to.equal(0n);

    const actualToken0 = await pair.token0();
    const actualToken1 = await pair.token1();

    const expectedToken0 = token0.target.toLowerCase() < token1.target.toLowerCase()
      ? token0.target
      : token1.target;

    const expectedToken1 = token0.target.toLowerCase() < token1.target.toLowerCase()
      ? token1.target
      : token0.target;

    expect(actualToken0).to.equal(expectedToken0);
    expect(actualToken1).to.equal(expectedToken1);
    expect(await pair.token0()).to.equal(tokenA.target);
    expect(await pair.token1()).to.equal(tokenB.target);
  });
});
