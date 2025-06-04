const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MaxUint256, keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = ethers.utils;

describe("BETERC20", function () {
    let Token, token;
    let owner, addr1, addr2, otherAccounts;

    beforeEach(async function () {
        [owner, addr1, addr2, ...otherAccounts] = await ethers.getSigners();
        Token = await ethers.getContractFactory("BETERC20");
        token = await Token.deploy();
        await token.deployed();
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
            await token._mint(owner.address, 1000);
            expect(await token.totalSupply()).to.equal(1000);
            expect(await token.balanceOf(owner.address)).to.equal(1000);
        });

        it("Should burn tokens from address", async function () {
            await token._mint(owner.address, 1000);
            await token._burn(owner.address, 500);
            expect(await token.totalSupply()).to.equal(500);
            expect(await token.balanceOf(owner.address)).to.equal(500);
        });
    });

    describe("Transfers", function () {
        beforeEach(async function () {
            await token._mint(owner.address, 1000);
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
            await token._mint(owner.address, 1000);
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
            await token._mint(owner.address, 1000);
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
                solidityPack(
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

        it("should set allowance via permit", async function () {
            const value = 123;
            const nonce = await token.nonces(owner.address);
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const digest = getPermitDigest(
                "Uniswap V2",
                token.address,
                owner.address,
                addr1.address,
                value,
                nonce,
                deadline,
                chainId
            );

            const signingKey = new ethers.utils.SigningKey(owner._signingKey().privateKey);
            const signature = signingKey.signDigest(digest);
            const { v, r, s } = ethers.utils.splitSignature(signature);

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

        it("should fail with expired permit", async function () {
            const value = 123;
            const nonce = await token.nonces(owner.address);
            const deadline = Math.floor(Date.now() / 1000) - 100;

            const digest = getPermitDigest(
                "Uniswap V2",
                token.address,
                owner.address,
                addr1.address,
                value,
                nonce,
                deadline,
                chainId
            );
            const signingKey = new ethers.utils.SigningKey(owner._signingKey().privateKey);
            const signature = signingKey.signDigest(digest);
            const { v, r, s } = ethers.utils.splitSignature(signature);

            await expect(
                token.permit(
                    owner.address,
                    addr1.address,
                    value,
                    deadline,
                    v, r, s
                )
            ).to.be.revertedWith("UniswapV2: EXPIRED");
        });

        it("should fail on invalid signature", async function () {
            const value = 123;
            const nonce = await token.nonces(owner.address);
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const digest = getPermitDigest(
                "Uniswap V2",
                token.address,
                owner.address,
                addr1.address,
                value,
                nonce,
                deadline,
                chainId
            );
            const signingKey = new ethers.utils.SigningKey(addr2._signingKey().privateKey);
            const signature = signingKey.signDigest(digest);
            const { v, r, s } = ethers.utils.splitSignature(signature);

            await expect(
                token.permit(
                    owner.address,
                    addr1.address,
                    value,
                    deadline,
                    v, r, s
                )
            ).to.be.revertedWith("UniswapV2: INVALID_SIGNATURE");
        });
    });
});











// const {
//   time,
//   loadFixture,
// } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
// const { expect } = require("chai");

// describe("Lock", function () {
//   // We define a fixture to reuse the same setup in every test.
//   // We use loadFixture to run this setup once, snapshot that state,
//   // and reset Hardhat Network to that snapshot in every test.
//   async function deployOneYearLockFixture() {
//     const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
//     const ONE_GWEI = 1_000_000_000;

//     const lockedAmount = ONE_GWEI;
//     const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

//     // Contracts are deployed using the first signer/account by default
//     const [owner, otherAccount] = await ethers.getSigners();

//     const Lock = await ethers.getContractFactory("Lock");
//     const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

//     return { lock, unlockTime, lockedAmount, owner, otherAccount };
//   }

//   describe("Deployment", function () {
//     it("Should set the right unlockTime", async function () {
//       const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

//       expect(await lock.unlockTime()).to.equal(unlockTime);
//     });

//     it("Should set the right owner", async function () {
//       const { lock, owner } = await loadFixture(deployOneYearLockFixture);

//       expect(await lock.owner()).to.equal(owner.address);
//     });

//     it("Should receive and store the funds to lock", async function () {
//       const { lock, lockedAmount } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       expect(await ethers.provider.getBalance(lock.target)).to.equal(
//         lockedAmount
//       );
//     });

//     it("Should fail if the unlockTime is not in the future", async function () {
//       // We don't use the fixture here because we want a different deployment
//       const latestTime = await time.latest();
//       const Lock = await ethers.getContractFactory("Lock");
//       await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
//         "Unlock time should be in the future"
//       );
//     });
//   });

//   describe("Withdrawals", function () {
//     describe("Validations", function () {
//       it("Should revert with the right error if called too soon", async function () {
//         const { lock } = await loadFixture(deployOneYearLockFixture);

//         await expect(lock.withdraw()).to.be.revertedWith(
//           "You can't withdraw yet"
//         );
//       });

//       it("Should revert with the right error if called from another account", async function () {
//         const { lock, unlockTime, otherAccount } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         // We can increase the time in Hardhat Network
//         await time.increaseTo(unlockTime);

//         // We use lock.connect() to send a transaction from another account
//         await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
//           "You aren't the owner"
//         );
//       });

//       it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
//         const { lock, unlockTime } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         // Transactions are sent using the first signer by default
//         await time.increaseTo(unlockTime);

//         await expect(lock.withdraw()).not.to.be.reverted;
//       });
//     });

//     describe("Events", function () {
//       it("Should emit an event on withdrawals", async function () {
//         const { lock, unlockTime, lockedAmount } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         await time.increaseTo(unlockTime);

//         await expect(lock.withdraw())
//           .to.emit(lock, "Withdrawal")
//           .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
//       });
//     });

//     describe("Transfers", function () {
//       it("Should transfer the funds to the owner", async function () {
//         const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
//           deployOneYearLockFixture
//         );

//         await time.increaseTo(unlockTime);

//         await expect(lock.withdraw()).to.changeEtherBalances(
//           [owner, lock],
//           [lockedAmount, -lockedAmount]
//         );
//       });
//     });
//   });
// });
