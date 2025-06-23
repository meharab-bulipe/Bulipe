const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BETFactory", function () {
    let BETFactory, factory;
    let owner, addr1, addr2;

    addressZero = "0x0000000000000000000000000000000000000000";

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const BETFactoryContract = await ethers.getContractFactory("BETFactory");
        factory = await BETFactoryContract.deploy(owner.address);
        //await factory.deploy();
    });

    it("should set feeToSetter correctly", async function () {
        expect(await factory.feeToSetter()).to.equal(owner.address);
    });

    it("should create a new pair", async function () {
        await factory.createPair(addr1.address, addr2.address);
        const pairAddress = await factory.getPair(addr1.address, addr2.address);
        expect(pairAddress).to.properAddress;
        expect(await factory.allPairsLength()).to.equal(1);
    });

    it("should not allow identical addresses", async function () {
        await expect(factory.createPair(addr1.address, addr1.address)).to.be.revertedWith("BET: IDENTICAL_ADDRESSES");
    });

    it("should not allow zero address", async function () {
        await expect(factory.createPair(addressZero, addr1.address)).to.be.revertedWith("BET: ZERO_ADDRESS");
    });

    it("should not allow duplicate pairs", async function () {
        await factory.createPair(addr1.address, addr2.address);
        await expect(factory.createPair(addr2.address, addr1.address)).to.be.revertedWith("BET: PAIR_EXISTS");
    });
});
