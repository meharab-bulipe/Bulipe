const { expect } = require("chai");
const { ethers } = require("hardhat");
/*
describe("BETPair", function () {
  let owner, user, user2;
  let Token, token0, token1;
  let pair, pairAddress;
  let Factory, factory;
  let tokenA, tokenB;

  beforeEach(async function () {
    [owner, user, user2] = await ethers.getSigners();

    Token = await ethers.getContractFactory("TestBETERC20");
    token0 = await Token.deploy();
    token1 = await Token.deploy();

    await token0.mint(owner.address, 10000n);
    await token1.mint(owner.address, 10000n);
    await token0.mint(user.address, 10000n);
    await token1.mint(user.address, 10000n);

    [tokenA, tokenB] =
      token0.target.toLowerCase() < token1.target.toLowerCase()
        ? [token0, token1]
        : [token1, token0];

    Factory = await ethers.getContractFactory("BETFactory");
    factory = await Factory.deploy(owner.address);
    await factory.waitForDeployment();

    const tx = await factory.createPair(token0.target, token1.target);
    const receipt = await tx.wait();
    const logs = receipt.logs;

    const iface = Factory.interface;
    const parsedLog = logs
      .map((log) => {
        try {
          return iface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find((log) => log?.name === "PairCreated");

    if (!parsedLog) throw new Error("PairCreated event not found");

    pairAddress = parsedLog.args.pair;
    pair = await ethers.getContractAt("BETPair", pairAddress);
  });

  it("should have correct initial reserves and tokens", async function () {
    const [reserve0, reserve1] = await pair.getReserves();
    expect(reserve0).to.equal(0n);
    expect(reserve1).to.equal(0n);

    expect(await pair.token0()).to.equal(tokenA.target);
    expect(await pair.token1()).to.equal(tokenB.target);
  });

  it("should mint LP tokens and update reserves when liquidity is added", async function () {
    // Owner approves tokens to Pair
    await tokenA.approve(pair.target, 1000n);
    await tokenB.approve(pair.target, 1000n);

    // Add liquidity
    await pair.mint(owner.address, { from: owner.address });

    const [reserve0, reserve1] = await pair.getReserves();
    expect(reserve0).to.equal(1000n);
    expect(reserve1).to.equal(1000n);

    const lpBalance = await pair.balanceOf(owner.address);
    expect(lpBalance).to.be.above(0n);
  });

  it("should not mint if no tokens sent", async function () {
    await expect(pair.mint(owner.address)).to.be.reverted;
  });

  it("should burn LP tokens and update reserves when liquidity is removed", async function () {
    // Add liquidity first
    await tokenA.approve(pair.target, 1000n);
    await tokenB.approve(pair.target, 1000n);
    await pair.mint(owner.address);

    // Burn liquidity
    const lpBalance = await pair.balanceOf(owner.address);
    await pair.approve(pair.target, lpBalance);
    await pair.burn(owner.address);

    const [reserve0, reserve1] = await pair.getReserves();
    expect(reserve0).to.equal(0n);
    expect(reserve1).to.equal(0n);

    expect(await pair.balanceOf(owner.address)).to.equal(0n);
  });

  it("should swap tokens correctly and update reserves", async function () {
    // Add initial liquidity
    await tokenA.approve(pair.target, 1000n);
    await tokenB.approve(pair.target, 1000n);
    await pair.mint(owner.address);

    // Transfer tokenA to the pair (simulate a swap-in)
    await tokenA.connect(user).approve(pair.target, 100n);
    await tokenA.connect(user).transfer(pair.target, 100n);

    // Get expected output based on x*y=k, with 0.3% fee
    const [reserve0, reserve1] = await pair.getReserves();
    const inputAmount = 100n;
    const inputReserve = reserve0;
    const outputReserve = reserve1;
    const inputAmountWithFee = inputAmount * 997n;
    const numerator = inputAmountWithFee * outputReserve;
    const denominator = inputReserve * 1000n + inputAmountWithFee;
    const expectedOutput = numerator / denominator;

    // Swap
    await pair.connect(user).swap(0n, expectedOutput, user.address, "0x");

    // After swap, user should get ~99 tokens of tokenB
    const userBalance = await tokenB.balanceOf(user.address);
    expect(userBalance).to.be.greaterThan(9999n); // Started with 10000, now should have more

    const [newReserve0, newReserve1] = await pair.getReserves();
    expect(newReserve0).to.be.above(reserve0);
    expect(newReserve1).to.be.below(reserve1);
  });

  it("should revert if swap amount out is too high", async function () {
    // Add liquidity
    await tokenA.approve(pair.target, 1000n);
    await tokenB.approve(pair.target, 1000n);
    await pair.mint(owner.address);

    await expect(
      pair.connect(user).swap(0n, 2000n, user.address, "0x")
    ).to.be.reverted;
  });

  it("should only allow factory to initialize", async function () {
    await expect(
      pair.connect(user).initialize(tokenA.target, tokenB.target)
    ).to.be.reverted;
  });

  it("should not allow zero address for tokens", async function () {
    Factory = await ethers.getContractFactory("BETFactory");
    factory = await Factory.deploy(owner.address);
    await factory.waitForDeployment();

    await expect(factory.createPair(ethers.ZeroAddress, tokenA.target)).to.be.reverted;
    await expect(factory.createPair(tokenA.target, ethers.ZeroAddress)).to.be.reverted;
  });

  it("should emit Swap, Mint, and Burn events properly", async function () {
    await tokenA.approve(pair.target, 1000n);
    await tokenB.approve(pair.target, 1000n);

    // Add liquidity
    await expect(pair.mint(owner.address))
      .to.emit(pair, "Mint")
      .withArgs(owner.address, 1000n, 1000n);

    // Swap
    await tokenA.connect(user).approve(pair.target, 100n);
    await tokenA.connect(user).transfer(pair.target, 100n);

    const [reserve0, reserve1] = await pair.getReserves();
    const inputAmount = 100n;
    const inputAmountWithFee = inputAmount * 997n;
    const numerator = inputAmountWithFee * reserve1;
    const denominator = reserve0 * 1000n + inputAmountWithFee;
    const expectedOutput = numerator / denominator;

    await expect(pair.connect(user).swap(0n, expectedOutput, user.address, "0x"))
      .to.emit(pair, "Swap");

    // Burn
    const lpBalance = await pair.balanceOf(owner.address);
    await pair.approve(pair.target, lpBalance);
    await expect(pair.burn(owner.address))
      .to.emit(pair, "Burn");
  });
});
*/