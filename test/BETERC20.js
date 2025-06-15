const { expect } = require("chai");
const { ethers } = require("hardhat");
const defaultAbiCoder = new ethers.AbiCoder();
const { MaxUint256, keccak256, toUtf8Bytes, solidityPacked, Wallet, toBeHex, getBytes } = ethers;

describe("BETERC20", function () {
    let Token, token;
    let owner, addr1, addr2, otherAccounts;
    let ownerWallet, addr1Wallet, add2Wallet;

    beforeEach(async function () {
        [owner, addr1, addr2, ...otherAccounts] = await ethers.getSigners();
        const ownerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const addr1PrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
        const addr2PrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

        ownerWallet = new Wallet(ownerPrivateKey, ethers.provider);
        addr1Wallet = new Wallet(addr1PrivateKey, ethers.provider);
        addr2Wallet = new Wallet(addr2PrivateKey, ethers.provider);

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
        let chainId;
        beforeEach(async function () {
            chainId = (await ethers.provider.getNetwork()).chainId;
            await token.mint(owner.address, 1000);
        });

        function getPermitDigest(
            name, tokenAddress, owner, spender, value, nonce, deadline, chainId
        ) {
            const DOMAIN_SEPARATOR = keccak256(
                defaultAbiCoder.encode(
                    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
                    [
                        keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
                        keccak256(toUtf8Bytes(name)),
                        keccak256(toUtf8Bytes("1")),
                        chainId,
                        tokenAddress
                    ]
                )
            );
            const PERMIT_TYPEHASH = keccak256(
                toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
            );
            return keccak256(
                solidityPacked(
                    ["string", "bytes32", "bytes32"],
                    [
                        "\x19\x01",
                        DOMAIN_SEPARATOR,
                        keccak256(
                            defaultAbiCoder.encode(
                                ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
                                [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline]
                            )
                        )
                    ]
                )
            );
        }
/*
        it("should set allowance via permit", async function () {
            const value = 123;
            const nonce = await token.nonces(owner.address);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            // console.log("token:", token?.target);
            // console.log("Owner:", owner?.address);
            // console.log("Addr1:", addr1?.address);
            // console.log("Value:", value);
            // console.log("Nonce", nonce);
            // console.log("Deadline", deadline);
            // console.log("ChainId:", chainId);
            // console.log("token:", token);

            const digest = getPermitDigest(
                "Bulipe Exchang Token",
                token.target,
                owner.address,
                addr1.address,
                value,
                nonce,
                deadline,
                chainId
            );

            // const signingKey = new ethers.utils.SigningKey(owner._signingKey().privateKey);
            // const signature = signingKey.signDigest(digest);
            // const { v, r, s } = ethers.utils.splitSignature(signature);
            // const ownerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // for owner
            // Use wallet directly with the private key
            // const wallet = new Wallet(ownerPrivateKey); // owner
            const flatSignature = await ownerWallet.signMessage(getBytes(digest));
            const { v, r, s } = ethers.Signature.from(flatSignature);

            await expect(
                token.permit(
                    owner.address,
                    addr1.address,
                    value,
                    deadline,
                    v, r, s
                )
            ).to.emit(token, "Approval").withArgs(owner.address, addr1.address, value);

            expect(await token.allowance(owner.address, addr1.address)).to.equal(value);

            expect(await token.nonces(owner.address)).to.equal(nonce.add(1));
        });
*/

        it("should fail with expired permit", async function () {
            const value = 123;
            const nonce = await token.nonces(owner.address);
            const deadline = Math.floor(Date.now() / 1000) - 100;

            const digest = getPermitDigest(
                "Bulipe Exchang Token",
                token.target,
                owner.address,
                addr1.address,
                value,
                nonce,
                deadline,
                chainId
            );

            const flatSignature = await ownerWallet.signMessage(getBytes(digest));
            const { v, r, s } = ethers.Signature.from(flatSignature);

            await expect(
                token.permit(
                    owner.address,
                    addr1.address,
                    value,
                    deadline,
                    v, r, s
                )
            ).to.be.revertedWith("Bulipe: EXPIRED");
        });

        it("should fail on invalid signature", async function () {
            const value = 123;
            const nonce = await token.nonces(owner.address);
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const digest = getPermitDigest(
                "Bulipe Exchang Token",
                token.target,
                owner.address,
                addr1.address,
                value,
                nonce,
                deadline,
                chainId
            );

            const flatSignature = await ownerWallet.signMessage(getBytes(digest));
            const { v, r, s } = ethers.Signature.from(flatSignature);

            await expect(
                token.permit(
                    owner.address,
                    addr1.address,
                    value,
                    deadline,
                    v, r, s
                )
            ).to.be.revertedWith("Bulipe: INVALID_SIGNATURE");
        });
    });
});