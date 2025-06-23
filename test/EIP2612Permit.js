const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Wallet } = ethers;

describe("EIP-2612 Permit", function () {
  let Token, token;
  let owner, spender, addr1, addr2, otherAccounts;
  let ownerWallet, spenderWallet, addr1Wallet;

  beforeEach(async function () {
      [owner, spender, addr1, addr2, ...otherAccounts] = await ethers.getSigners();
      const ownerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const spenderPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
      const addr1PrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

      ownerWallet = new Wallet(ownerPrivateKey, ethers.provider);
      spenderWallet = new Wallet(spenderPrivateKey, ethers.provider);
      addr1Wallet = new Wallet(addr1PrivateKey, ethers.provider);
  });

  async function deployFixture() {
    Token = await ethers.getContractFactory("TestBETERC20");
    token = await Token.deploy();
    return { token, owner, spender };
  }

  it("should allow permit signature and update allowance correctly", async function () {
    const { token, owner, spender } = await loadFixture(deployFixture);

    const name = await token.name();
    const version = "1";
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const nonce = await token.nonces(owner.address);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const value = 123n;

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: await token.getAddress(),
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: owner.address,
      spender: spender.address,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    const signature = await owner.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(signature);

    await expect(
      token.permit(owner.address, spender.address, value, deadline, v, r, s)
    )
      .to.emit(token, "Approval")
      .withArgs(owner.address, spender.address, value);

    const allowance = await token.allowance(owner.address, spender.address);
    expect(allowance).to.equal(value);

    const newNonce = await token.nonces(owner.address);
    expect(newNonce).to.equal(nonce + 1n);
  });

  it("should reject expired signature", async function () {
    const { token, owner, spender } = await loadFixture(deployFixture);

    const name = await token.name();
    const version = "1";
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const nonce = await token.nonces(owner.address);
    const deadline = BigInt(Math.floor(Date.now() / 1000) - 1);
    const value = 123n;

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: await token.getAddress(),
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: owner.address,
      spender: spender.address,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    const signature = await owner.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(signature);

    await expect(
      token.permit(owner.address, spender.address, value, deadline, v, r, s)
    ).to.be.revertedWith("Bulipe: EXPIRED");
  });

  it("should reject reused signature (nonce replay)", async function () {
    const { token, owner, spender } = await loadFixture(deployFixture);

    const name = await token.name();
    const version = "1";
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const nonce = await token.nonces(owner.address);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const value = 123n;

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: await token.getAddress(),
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: owner.address,
      spender: spender.address,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    const signature = await owner.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(signature);

    await token.permit(owner.address, spender.address, value, deadline, v, r, s);

    await expect(
      token.permit(owner.address, spender.address, value, deadline, v, r, s)
    ).to.be.revertedWith("Bulipe: INVALID_SIGNATURE");
  });
});
