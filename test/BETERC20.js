const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MaxUint256 } = ethers;

describe("BETERC20", function () {
    let Token, token;
    let owner, spender, addr1, addr2, otherAccounts;

    beforeEach(async function () {
        [owner, spender, addr1, addr2, ...otherAccounts] = await ethers.getSigners();
        Token = await ethers.getContractFactory("TestBETERC20");
        token = await Token.deploy();
    });

    describe("Metadata", function () {
        it("Should have correct name, symbol, decimals", async function () {
            expect(await token.name()).to.equal("Bulipe Exchang Token");
            expect(await token.symbol()).to.equal("BET");
            expect(await token.decimals()).to.equal(18);
        });
    });

    describe("Mint and Burn (internal)", function () {
        it("Should mint tokens to address", async function () {
            await token.mint(owner.address, 1000);
            expect(await token.totalSupply()).to.equal(1000);
            expect(await token.balanceOf(owner.address)).to.equal(1000);
        });

        it("Should burn tokens from address", async function () {
            await token.mint(owner.address, 1000);
            await token.burn(owner.address, 500);
            expect(await token.totalSupply()).to.equal(500);
            expect(await token.balanceOf(owner.address)).to.equal(500);
        });
    });

    describe("Transfers", function () {
        beforeEach(async function () {
            await token.mint(owner.address, 1000);
        });

        it("Should transfer tokens", async function () {
            await expect(token.transfer(addr1.address, 200))
                .to.emit(token, "Transfer")
                .withArgs(owner.address, addr1.address, 200);

            expect(await token.balanceOf(addr1.address)).to.equal(200);
            expect(await token.balanceOf(owner.address)).to.equal(800);
        });

        it("Should fail if insufficient balance", async function () {
            await expect(
                token.connect(addr1).transfer(owner.address, 10)
            ).to.be.reverted;
        });
    });

    describe("Approval & Allowance", function () {
        beforeEach(async function () {
            await token.mint(owner.address, 1000);
        });

        it("Should approve allowance", async function () {
            await expect(token.approve(addr1.address, 500))
                .to.emit(token, "Approval")
                .withArgs(owner.address, addr1.address, 500);

            expect(await token.allowance(owner.address, addr1.address)).to.equal(500);
        });

        it("Should transferFrom correctly", async function () {
            await token.approve(addr1.address, 300);

            await expect(token.connect(addr1).transferFrom(owner.address, addr2.address, 200))
                .to.emit(token, "Transfer")
                .withArgs(owner.address, addr2.address, 200);

            expect(await token.allowance(owner.address, addr1.address)).to.equal(100);
            expect(await token.balanceOf(addr2.address)).to.equal(200);
            expect(await token.balanceOf(owner.address)).to.equal(800);
        });

        it("Should not decrement allowance if max uint", async function () {
            await token.approve(addr1.address, MaxUint256);

            await token.connect(addr1).transferFrom(owner.address, addr2.address, 100);
            expect(await token.allowance(owner.address, addr1.address)).to.equal(MaxUint256);
        });

        it("Should revert if transferFrom amount exceeds allowance", async function () {
            await token.approve(addr1.address, 50);
            await expect(
                token.connect(addr1).transferFrom(owner.address, addr2.address, 100)
            ).to.be.reverted;
        });
    });

    describe("EIP-2612 Permit", function () {
        it("should set allowance via permit", async function () {
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

        it("should fail with expired permit", async function () {
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

        it("should fail on invalid signature", async function () {
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
});