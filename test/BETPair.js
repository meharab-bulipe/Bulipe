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
    token1 = await Token.deploy();

    await token0.mint(owner.address, 10000);
    await token1.mint(owner.address, 10000);

    [tokenA, tokenB] = token0.target.toLowerCase() < token1.target.toLowerCase()
        ? [token0, token1]
        : [token1, token0];

    Factory = await ethers.getContractFactory("BETFactory");
    factory = await Factory.deploy(owner.address);
    await factory.waitForDeployment();

    const tx = await factory.createPair(token0.target, token1.target);
    const receipt = await tx.wait();
    const logs = receipt.logs;

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

    pair = await ethers.getContractAt("BETPair", pairAddress);
  });

  it("should have correct initial reserves and tokens", async function () {
    const [reserve0, reserve1] = await pair.getReserves();
    expect(reserve0).to.equal(0n);
    expect(reserve1).to.equal(0n);

    expect(await pair.token0()).to.equal(tokenA.target);
    expect(await pair.token1()).to.equal(tokenB.target);
  });


it("should mint liquidity and update reserves", async function () {
  const amount0 = 2000n;
  const amount1 = 2000n;

  // Transfer token0 and token1 to the pair contract
  await token0.transfer(pairAddress, amount0);
  await token1.transfer(pairAddress, amount1);

  // Mint LP tokens to `user.address`
  await pair.mint(user.address);

  // Reserves should be updated
  const [reserve0, reserve1] = await pair.getReserves();
  expect(reserve0).to.equal(amount0);
  expect(reserve1).to.equal(amount1);

  // User should have received LP tokens
  const lpBalance = await pair.balanceOf(user.address);
  expect(lpBalance).to.be.gt(0n);

  // Check that the pair's total supply is correct
  const totalSupply = await pair.totalSupply();
  expect(totalSupply).to.be.gt(0n);

});

  it("should burn liquidity and return tokens", async function () {
  const amount0 = 2000n;
  const amount1 = 2000n;

  // Provide liquidity
  await token0.transfer(pairAddress, amount0);
  await token1.transfer(pairAddress, amount1);
  await pair.mint(user.address);

  // User sends LP tokens back to pair
  const userPair = pair.connect(user);
  const liquidity = await pair.balanceOf(user.address);
  await userPair.transfer(pairAddress, liquidity);

  // Burn and send tokens back to user
  await userPair.burn(user.address);

  // User should get back ~same amount of tokens (less MINIMUM_LIQUIDITY)
  const userToken0 = await token0.balanceOf(user.address);
  const userToken1 = await token1.balanceOf(user.address);
  expect(userToken0).to.be.eq(1000n);
  expect(userToken1).to.be.eq(1000n);

  // Reserves should be zeroed out
  const [reserve0, reserve1] = await pair.getReserves();
  expect(reserve0).to.equal(1000n);
  expect(reserve1).to.equal(1000n);
});

///*
it("should perform a token0 to token1 swap with fee", async function () {
  const liquidityAmount = 2000n;

  // Add liquidity first
  await token0.transfer(pairAddress, liquidityAmount);
  await token1.transfer(pairAddress, liquidityAmount);
  await pair.mint(owner.address);

  // Swap: send 100 token0, expect token1 in return
  const amountIn = 100n;
  const amountOutExpected = 90n; // approximate, adjust based on actual curve

  await token0.transfer(pairAddress, amountIn);

  const userToken1Before = await token1.balanceOf(user.address);
  const userToken0Before = await token0.balanceOf(user.address);

  // Perform the swap: token0 in, token1 out
  await pair.swap(0, amountOutExpected, user.address, "0x");

  const userToken1After = await token1.balanceOf(user.address);
  const userToken0After = await token0.balanceOf(user.address);

  // User should receive token1
  expect(userToken0After - userToken0Before).to.equal(amountOutExpected);
  expect(userToken1After - userToken1Before).to.equal(0);

  // Check reserves updated correctly
  const [reserve0, reserve1] = await pair.getReserves();
  expect(reserve0).to.be.gte(liquidityAmount - amountIn); // token0 in
  expect(reserve1).to.be.lte(liquidityAmount + amountOutExpected); // token1 out
});
//*/

it("should transfer excess tokens using skim()", async function () {
  const liquidityAmount = 2000n;

  // Step 1: Add liquidity
  await token0.transfer(pairAddress, liquidityAmount);
  await token1.transfer(pairAddress, liquidityAmount);
  await pair.mint(owner.address);

  // Step 2: Manually send extra tokens to the pair (not through mint/swap)
  await token0.transfer(pairAddress, 100n);
  await token1.transfer(pairAddress, 50n);

  // Step 3: Skim the excess to `user.address`
  const userToken0Before = await token0.balanceOf(user.address);
  const userToken1Before = await token1.balanceOf(user.address);

  await pair.skim(user.address);

  const userToken0After = await token0.balanceOf(user.address);
  const userToken1After = await token1.balanceOf(user.address);

  // Step 4: Verify user received the excess only
  expect(userToken0After - userToken0Before).to.equal(100n);
  expect(userToken1After - userToken1Before).to.equal(50n);

  // Reserves should remain unchanged
  const [reserve0, reserve1] = await pair.getReserves();
  expect(reserve0).to.equal(liquidityAmount);
  expect(reserve1).to.equal(liquidityAmount);
});


it("should update reserves using sync()", async function () {
  const liquidityAmount = 2000n;

  // Step 1: Add initial liquidity
  await token0.transfer(pairAddress, liquidityAmount);
  await token1.transfer(pairAddress, liquidityAmount);
  await pair.mint(owner.address);

  // Step 2: Manually transfer more tokens directly to pair (skipping mint/swap)
  await token0.transfer(pairAddress, 200n);
  await token1.transfer(pairAddress, 300n);

  // Reserves should still be at initial liquidity amounts
  let [reserve0, reserve1] = await pair.getReserves();
  expect(reserve0).to.equal(liquidityAmount);
  expect(reserve1).to.equal(liquidityAmount);

  // Step 3: Call sync()
  await pair.sync();

  // Step 4: Reserves should now reflect the full balances
  [reserve0, reserve1] = await pair.getReserves();
  expect(reserve1).to.equal(liquidityAmount + 200n);
  expect(reserve0).to.equal(liquidityAmount + 300n);
});


});
