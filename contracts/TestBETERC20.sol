// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./BETERC20.sol";

contract TestBETERC20 is BETERC20 {
    constructor() BETERC20() {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }
}
